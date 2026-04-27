"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fireMakeWebhook } from "@/lib/make-webhook";
import type { TablesUpdate, Enums } from "@/lib/supabase/types";

const InvoiceTypeEnum = z.enum([
  "advance",
  "monthly_hours",
  "project",
  "expense",
  "overage",
  "other",
]);

const InvoiceStatusEnum = z.enum([
  "draft",
  "pending_review",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]);

const PaymentMethodEnum = z.enum(["bank_transfer", "credit_card", "bit", "cash", "check", "other"]);

const ItemSchema = z.object({
  description: z.string().min(1, "תיאור חובה").max(500),
  quantity: z.number().positive("כמות חייבת להיות גדולה מ-0"),
  unit_price: z.number().min(0, "מחיר לא יכול להיות שלילי"),
});

const CreateInvoiceSchema = z.object({
  customer_id: z.string().uuid("יש לבחור לקוח"),
  project_id: z.string().uuid().optional().nullable(),
  hour_bank_id: z.string().uuid().optional().nullable(),
  type: InvoiceTypeEnum,
  number: z.string().max(60).optional().nullable(),
  issue_date: z.string().min(1, "תאריך הוצאה חובה"),
  due_date: z.string().optional().nullable(),
  tax_rate: z.number().min(0).max(100).default(18),
  notes: z.string().max(4000).optional().nullable(),
  items: z.array(ItemSchema).min(1, "חובה לפחות שורה אחת"),
});

export type InvoiceActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id, role")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function createInvoice(
  input: z.infer<typeof CreateInvoiceSchema>,
): Promise<InvoiceActionResult> {
  const parsed = CreateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const data = parsed.data;
  const subtotal = data.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  // Verify customer belongs to tenant
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, company, email")
    .eq("id", data.customer_id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!customer) return { ok: false, error: "לקוח לא נמצא" };

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      customer_id: data.customer_id,
      project_id: data.project_id || null,
      hour_bank_id: data.hour_bank_id || null,
      type: data.type,
      number: data.number || null,
      issue_date: data.issue_date,
      due_date: data.due_date || null,
      subtotal: Math.round(subtotal * 100) / 100,
      tax_rate: data.tax_rate,
      notes: data.notes || null,
      status: "draft",
      currency: "ILS",
    })
    .select("id, total_amount, tax_amount, subtotal, status, type, issue_date, due_date, number")
    .single();

  if (invErr || !invoice) {
    return { ok: false, error: invErr?.message ?? "שגיאה ביצירת חשבונית" };
  }

  const itemsRows = data.items.map((it, idx) => ({
    invoice_id: invoice.id,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    order_index: idx,
  }));

  const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsRows);

  if (itemsErr) {
    // Rollback invoice (no tx in supabase-js, best-effort)
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { ok: false, error: itemsErr.message };
  }

  await fireMakeWebhook(profile.tenant_id, "invoice.created", {
    invoice_id: invoice.id,
    number: invoice.number,
    type: invoice.type,
    status: invoice.status,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    subtotal: Number(invoice.subtotal),
    tax_rate: data.tax_rate,
    tax_amount: invoice.tax_amount == null ? null : Number(invoice.tax_amount),
    total_amount: invoice.total_amount == null ? null : Number(invoice.total_amount),
    currency: "ILS",
    customer: {
      id: customer.id,
      name: customer.name,
      company: customer.company,
      email: customer.email,
    },
    items: data.items,
    notes: data.notes ?? null,
  });

  revalidatePath("/invoices");
  return { ok: true, id: invoice.id };
}

const UpdateInvoiceSchema = z.object({
  id: z.string().uuid(),
  number: z.string().max(60).optional().nullable(),
  issue_date: z.string().optional(),
  due_date: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: InvoiceStatusEnum.optional(),
  finbot_url: z.string().url().optional().nullable(),
  finbot_invoice_id: z.string().optional().nullable(),
});

export async function updateInvoice(
  input: z.infer<typeof UpdateInvoiceSchema>,
): Promise<InvoiceActionResult> {
  const parsed = UpdateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
    };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const data = parsed.data;

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", data.id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "חשבונית לא נמצאה" };

  if (existing.status === "paid") {
    return { ok: false, error: "לא ניתן לערוך חשבונית ששולמה" };
  }

  const update: TablesUpdate<"invoices"> = {};
  if (data.number !== undefined) update.number = data.number || null;
  if (data.issue_date !== undefined && data.issue_date) update.issue_date = data.issue_date;
  if (data.due_date !== undefined) update.due_date = data.due_date || null;
  if (data.notes !== undefined) update.notes = data.notes || null;
  if (data.finbot_url !== undefined) update.finbot_url = data.finbot_url || null;
  if (data.finbot_invoice_id !== undefined)
    update.finbot_invoice_id = data.finbot_invoice_id || null;
  if (data.status !== undefined) {
    if (profile.role !== "admin") {
      return { ok: false, error: "רק מנהלים יכולים לשנות סטטוס ידנית" };
    }
    update.status = data.status;
  }

  const { error } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", data.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${data.id}`);
  return { ok: true, id: data.id };
}

export async function markInvoiceSent(id: string): Promise<InvoiceActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: inv } = await supabase
    .from("invoices")
    .select(
      "id, status, number, type, total_amount, subtotal, tax_amount, issue_date, due_date, currency, customer_id, finbot_url",
    )
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!inv) return { ok: false, error: "חשבונית לא נמצאה" };
  if (inv.status === "paid" || inv.status === "cancelled") {
    return { ok: false, error: "לא ניתן לסמן כנשלחה במצב הנוכחי" };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, company, email")
    .eq("id", inv.customer_id)
    .maybeSingle();

  await fireMakeWebhook(profile.tenant_id, "invoice.sent", {
    invoice_id: inv.id,
    number: inv.number,
    type: inv.type,
    status: "sent",
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    subtotal: inv.subtotal == null ? null : Number(inv.subtotal),
    tax_amount: inv.tax_amount == null ? null : Number(inv.tax_amount),
    total_amount: inv.total_amount == null ? null : Number(inv.total_amount),
    currency: inv.currency,
    finbot_url: inv.finbot_url,
    customer,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { ok: true, id };
}

export async function cancelInvoice(id: string): Promise<InvoiceActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!inv) return { ok: false, error: "חשבונית לא נמצאה" };

  const { count: paymentCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", id)
    .eq("tenant_id", profile.tenant_id);

  if ((paymentCount ?? 0) > 0) {
    return { ok: false, error: "לא ניתן לבטל חשבונית עם תשלומים" };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { ok: true, id };
}

export async function deleteInvoice(id: string): Promise<InvoiceActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, status, hour_bank_id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!inv) return { ok: false, error: "חשבונית לא נמצאה" };

  const { count: paymentCount } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", id)
    .eq("tenant_id", profile.tenant_id);

  if ((paymentCount ?? 0) > 0) {
    return { ok: false, error: "לא ניתן למחוק חשבונית עם תשלומים. בטל את התשלומים קודם." };
  }

  // Delete items first (FK), then invoice
  await supabase.from("invoice_items").delete().eq("invoice_id", id);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/invoices");
  if (inv.hour_bank_id) revalidatePath(`/hour-banks/${inv.hour_bank_id}`);
  return { ok: true, id };
}

const RecordPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive("סכום חייב להיות גדול מ-0"),
  method: PaymentMethodEnum,
  reference: z.string().max(120).optional().nullable(),
  paid_at: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function recordPayment(
  input: z.infer<typeof RecordPaymentSchema>,
): Promise<InvoiceActionResult> {
  const parsed = RecordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
    };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const data = parsed.data;

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, status, total_amount, number, customer_id, currency")
    .eq("id", data.invoice_id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!inv) return { ok: false, error: "חשבונית לא נמצאה" };
  if (inv.status === "cancelled") {
    return { ok: false, error: "לא ניתן להוסיף תשלום לחשבונית מבוטלת" };
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      invoice_id: data.invoice_id,
      amount: data.amount,
      method: data.method,
      reference: data.reference || null,
      notes: data.notes || null,
      paid_at: data.paid_at || new Date().toISOString(),
    })
    .select("id, amount, method, paid_at, reference")
    .single();

  if (error || !payment) return { ok: false, error: error?.message ?? "שגיאה ברישום תשלום" };

  await fireMakeWebhook(profile.tenant_id, "invoice.payment_recorded", {
    invoice_id: inv.id,
    invoice_number: inv.number,
    customer_id: inv.customer_id,
    payment_id: payment.id,
    amount: Number(payment.amount),
    method: payment.method,
    reference: payment.reference,
    paid_at: payment.paid_at,
    invoice_total: inv.total_amount == null ? null : Number(inv.total_amount),
    currency: inv.currency,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${data.invoice_id}`);
  return { ok: true, id: payment.id };
}

export async function deletePayment(paymentId: string): Promise<InvoiceActionResult> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { ok: false, error: "לא מחובר" };

  const { data: pay } = await supabase
    .from("payments")
    .select("id, invoice_id")
    .eq("id", paymentId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!pay) return { ok: false, error: "תשלום לא נמצא" };

  const { data: inv } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", pay.invoice_id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (inv?.status === "paid") {
    return { ok: false, error: "לא ניתן למחוק תשלום מחשבונית סגורה. בטל סטטוס תחילה." };
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${pay.invoice_id}`);
  return { ok: true, id: paymentId };
}

export type InvoiceStatus = Enums<"invoice_status">;
export type InvoiceType = Enums<"invoice_type">;
export type PaymentMethod = Enums<"payment_method">;
