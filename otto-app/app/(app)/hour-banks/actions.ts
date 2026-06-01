"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fireMakeWebhook } from "@/lib/make-webhook";
import { buildHoursDetail } from "@/lib/hours-detail";
import type { TablesUpdate } from "@/lib/supabase/types";

const CreateSchema = z.object({
  customer_id: z.string().uuid("יש לבחור לקוח"),
  purchased_hours: z.string().min(1, "חובה"),
  hourly_rate: z.string().optional(),
  purchase_date: z.string().optional(),
  expiry_date: z.string().optional(),
  alert_threshold_pct: z.string().optional(),
  alert_threshold_hours: z.string().optional(),
  notes: z.string().optional(),
  confirm_duplicate: z.string().optional(),
  document_type: z.enum(["payment_request", "tax_invoice", "tax_invoice_receipt"]).optional(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  purchased_hours: z.string().optional(),
  hourly_rate: z.string().optional(),
  expiry_date: z.string().optional(),
  alert_threshold_pct: z.string().optional(),
  alert_threshold_hours: z.string().optional(),
  notes: z.string().optional(),
});

export type HourBankFormState = {
  error?: string;
  warning?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  bankId?: string;
  unhandledOverageCount?: number;
  unhandledOverageHours?: number;
  unhandledOverageAmount?: number;
  unhandledOverageEntryIds?: string[];
  customerId?: string;
  customerName?: string;
};

function num(value: string | undefined): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.toString().trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  return value;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function createHourBank(
  _prev: HourBankFormState,
  formData: FormData,
): Promise<HourBankFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;
  const purchasedHours = num(data.purchased_hours);
  if (purchasedHours === null || purchasedHours <= 0) {
    return { fieldErrors: { purchased_hours: ["שעות חובה ושיהיו גדולות מ-0"] } };
  }

  // Load tenant settings & customer override for defaults
  const [{ data: settings }, { data: customer }] = await Promise.all([
    supabase
      .from("tenant_settings")
      .select(
        "default_hourly_rate, default_alert_threshold_pct, default_alert_threshold_hours, default_hour_bank_expiry_months",
      )
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("id, hourly_rate_override")
      .eq("id", data.customer_id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle(),
  ]);

  if (!customer) return { error: "לקוח לא נמצא" };

  const defaultRate =
    customer.hourly_rate_override != null
      ? Number(customer.hourly_rate_override)
      : settings?.default_hourly_rate != null
        ? Number(settings.default_hourly_rate)
        : 400;

  const hourlyRate = num(data.hourly_rate) ?? defaultRate;
  if (hourlyRate <= 0) {
    return { fieldErrors: { hourly_rate: ["מחיר שעה חובה"] } };
  }

  const purchaseDate = dateOrNull(data.purchase_date) ?? new Date().toISOString().slice(0, 10);
  const expiryMonths = settings?.default_hour_bank_expiry_months ?? 12;
  const expiryDate = dateOrNull(data.expiry_date) ?? addMonths(purchaseDate, expiryMonths);

  const alertPct = num(data.alert_threshold_pct) ?? settings?.default_alert_threshold_pct ?? 30;
  const alertHours =
    num(data.alert_threshold_hours) ?? Number(settings?.default_alert_threshold_hours ?? 3);

  // Warn if active bank exists for this customer (allow user to confirm)
  if (data.confirm_duplicate !== "1") {
    const { data: existing } = await supabase
      .from("hour_banks")
      .select("id")
      .eq("customer_id", data.customer_id)
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "active")
      .limit(1);
    if (existing && existing.length > 0) {
      return { warning: "ללקוח זה כבר יש בנק פעיל. לאישור שלח שוב." };
    }
  }

  const { data: bank, error } = await supabase
    .from("hour_banks")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      customer_id: data.customer_id,
      purchased_hours: purchasedHours,
      hourly_rate: hourlyRate,
      purchase_date: purchaseDate,
      expiry_date: expiryDate,
      alert_threshold_pct: alertPct,
      alert_threshold_hours: alertHours,
      notes: data.notes || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Retroactively allocate existing pending entries for this customer to the new bank
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc("backfill_pending_entries_to_bank", { p_bank_id: bank.id });

  // Auto-create an advance invoice draft linked to this bank
  await createAdvanceInvoiceForBank({
    supabase,
    tenant_id: profile.tenant_id,
    created_by: profile.id,
    customer_id: data.customer_id,
    bank_id: bank.id,
    purchased_hours: purchasedHours,
    hourly_rate: hourlyRate,
    document_type: data.document_type ?? "payment_request",
  });

  // Fire Make webhook (best-effort, non-blocking semantics)
  await fireMakeWebhook(profile.tenant_id, "hour_bank.created", {
    bank_id: bank.id,
    customer_id: data.customer_id,
    purchased_hours: purchasedHours,
    hourly_rate: hourlyRate,
    purchase_date: purchaseDate,
    expiry_date: expiryDate,
  });

  // Detect unhandled overage entries for this customer
  const { data: overageRows } = await supabase
    .from("time_entries")
    .select("id, duration_minutes, hourly_rate_at_entry")
    .eq("tenant_id", profile.tenant_id)
    .eq("customer_id", data.customer_id)
    .eq("is_overage", true)
    .eq("billing_status", "overage");

  const overage = overageRows ?? [];
  const overageHours = overage.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0) / 60;
  const overageAmount = overage.reduce(
    (sum, e) =>
      sum +
      ((Number(e.duration_minutes) || 0) / 60) * (Number(e.hourly_rate_at_entry) || hourlyRate),
    0,
  );

  const { data: customerRow } = await supabase
    .from("customers")
    .select("name")
    .eq("id", data.customer_id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  revalidatePath("/hour-banks");
  return {
    success: true,
    bankId: bank.id,
    unhandledOverageCount: overage.length,
    unhandledOverageHours: Math.round(overageHours * 100) / 100,
    unhandledOverageAmount: Math.round(overageAmount * 100) / 100,
    unhandledOverageEntryIds: overage.map((e) => e.id),
    customerId: data.customer_id,
    customerName: customerRow?.name,
  };
}

// ---------- Renewal drafts ----------

export type InvoiceDocumentType = "payment_request" | "tax_invoice" | "tax_invoice_receipt";

export async function approveRenewalDraft(
  draftId: string,
  documentType: InvoiceDocumentType = "payment_request",
): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data: bank, error } = await supabase
    .from("hour_banks")
    .update({ status: "active" })
    .eq("id", draftId)
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "draft")
    .select("id, customer_id, parent_bank_id, purchased_hours, hourly_rate, expiry_date")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!bank) return { error: "טיוטה לא נמצאה" };

  // Auto-create an advance invoice draft for the renewed bank
  await createAdvanceInvoiceForBank({
    supabase,
    tenant_id: profile.tenant_id,
    created_by: profile.id,
    customer_id: bank.customer_id,
    bank_id: bank.id,
    purchased_hours: Number(bank.purchased_hours),
    hourly_rate: Number(bank.hourly_rate),
    document_type: documentType,
  });

  await fireMakeWebhook(profile.tenant_id, "hour_bank.renewed", {
    bank_id: bank.id,
    parent_bank_id: bank.parent_bank_id,
    customer_id: bank.customer_id,
    purchased_hours: bank.purchased_hours,
    hourly_rate: bank.hourly_rate,
    expiry_date: bank.expiry_date,
  });

  revalidatePath("/hour-banks");
  revalidatePath("/hour-banks/draft-renewals");
  revalidatePath(`/hour-banks/${bank.id}`);
  return {};
}

export async function discardRenewalDraft(draftId: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("hour_banks")
    .delete()
    .eq("id", draftId)
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "draft");

  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath("/hour-banks/draft-renewals");
  return {};
}

// ---------- Overage handling ----------

export async function absorbOverageIntoBank(
  bankId: string,
): Promise<{ error?: string; absorbedHours?: number }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data: bank } = await supabase
    .from("hour_banks")
    .select("id, customer_id, absorbed_overage_hours")
    .eq("id", bankId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!bank || !bank.customer_id) return { error: "בנק לא נמצא" };

  const { data: entries, error: fetchErr } = await supabase
    .from("time_entries")
    .select("id, duration_minutes")
    .eq("tenant_id", profile.tenant_id)
    .eq("customer_id", bank.customer_id)
    .eq("is_overage", true)
    .eq("billing_status", "overage");

  if (fetchErr) return { error: fetchErr.message };
  if (!entries || entries.length === 0) return { absorbedHours: 0 };

  const totalHours = entries.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0) / 60;

  const ids = entries.map((e) => e.id);

  const { error: updErr } = await supabase
    .from("time_entries")
    .update({
      billing_status: "allocated_to_bank",
      consumed_from_bank_id: bankId,
      is_overage: false,
    })
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id);

  if (updErr) return { error: updErr.message };

  const newAbsorbed =
    (Number(bank.absorbed_overage_hours) || 0) + Math.round(totalHours * 100) / 100;

  const { error: bankErr } = await supabase
    .from("hour_banks")
    .update({ absorbed_overage_hours: newAbsorbed })
    .eq("id", bankId)
    .eq("tenant_id", profile.tenant_id);

  if (bankErr) return { error: bankErr.message };

  revalidatePath("/hour-banks");
  revalidatePath(`/hour-banks/${bankId}`);
  return { absorbedHours: Math.round(totalHours * 100) / 100 };
}

export async function invoiceOverageSeparately(
  customerId: string,
  overageEntryIds: string[],
  documentType: InvoiceDocumentType = "payment_request",
  attachHoursDetail: boolean = true,
): Promise<{ error?: string; invoiceId?: string }> {
  if (overageEntryIds.length === 0) return {};
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  // Pull the entries so we can build invoice line items from real hours/rates.
  const { data: entries, error: entriesErr } = await supabase
    .from("time_entries")
    .select("id, start_time, duration_minutes, notes, task_id, hourly_rate_at_entry")
    .in("id", overageEntryIds)
    .eq("tenant_id", profile.tenant_id)
    .eq("customer_id", customerId);

  if (entriesErr) return { error: entriesErr.message };
  if (!entries || entries.length === 0) return { error: "לא נמצאו שעות לחיוב" };

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "name, email, phone, company, address, company_registration_number, hourly_rate_override",
    )
    .eq("id", customerId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!customer) return { error: "לקוח לא נמצא" };

  const fallbackRate = Number(customer.hourly_rate_override) || 0;

  // Group hours by their effective rate so each rate becomes one invoice line.
  const byRate = new Map<number, number>();
  for (const e of entries) {
    const rate = Number(e.hourly_rate_at_entry) || fallbackRate;
    const hours = (Number(e.duration_minutes) || 0) / 60;
    byRate.set(rate, (byRate.get(rate) ?? 0) + hours);
  }

  const items = Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, hours], idx) => ({
      description: `שעות חריגה — ${Math.round(hours * 100) / 100} שעות`,
      quantity: Math.round(hours * 100) / 100,
      unit_price: rate,
      order_index: idx,
    }));

  const subtotal =
    Math.round(items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0) * 100) / 100;

  // Resolve task titles to enrich descriptions where the entry has no notes.
  const taskIds = Array.from(
    new Set(entries.map((e) => e.task_id).filter((id): id is string => !!id)),
  );
  const taskTitle = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", taskIds);
    for (const t of tasks ?? []) taskTitle.set(t.id, t.title);
  }

  const detail = buildHoursDetail(
    entries.map((e) => ({
      start_time: e.start_time,
      duration_minutes: e.duration_minutes,
      description: (e.notes ?? "").trim() || (e.task_id ? (taskTitle.get(e.task_id) ?? "") : ""),
    })),
  );
  const baseNote = "חשבונית על שעות חריגה (טיוטה)";

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      customer_id: customerId,
      type: "overage",
      document_type: documentType,
      status: "draft",
      issue_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      subtotal,
      tax_rate: 18,
      currency: "ILS",
      notes: attachHoursDetail ? `${baseNote}\n\n${detail.notesText}` : baseNote,
    })
    .select("id, total_amount, tax_amount, subtotal")
    .single();

  if (invErr || !invoice) return { error: invErr?.message ?? "שגיאה ביצירת חשבונית" };

  const { error: itemsErr } = await supabase
    .from("invoice_items")
    .insert(items.map((it) => ({ ...it, invoice_id: invoice.id })));

  if (itemsErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: itemsErr.message };
  }

  // Link the entries to the new invoice and mark them invoiced.
  const { error: linkErr } = await supabase
    .from("time_entries")
    .update({ billing_status: "invoiced", invoice_id: invoice.id })
    .in("id", overageEntryIds)
    .eq("tenant_id", profile.tenant_id)
    .eq("customer_id", customerId);

  if (linkErr) return { error: linkErr.message };

  await fireMakeWebhook(profile.tenant_id, "invoice.created", {
    invoice_id: invoice.id,
    type: "overage",
    document_type: documentType,
    status: "draft",
    issue_date: today.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    subtotal,
    tax_rate: 18,
    tax_amount: invoice.tax_amount == null ? null : Number(invoice.tax_amount),
    total_amount: invoice.total_amount == null ? null : Number(invoice.total_amount),
    currency: "ILS",
    customer: {
      id: customerId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      address: customer.address,
      tax_id: customer.company_registration_number,
    },
    items,
    hours_detail: attachHoursDetail ? detail.lines : null,
    time_entry_ids: overageEntryIds,
  });

  revalidatePath("/hour-banks");
  revalidatePath("/time");
  revalidatePath("/invoices");
  return { invoiceId: invoice.id };
}

export async function cancelOverageEntries(overageEntryIds: string[]): Promise<{ error?: string }> {
  if (overageEntryIds.length === 0) return {};
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("time_entries")
    .update({ billing_status: "cancelled" })
    .in("id", overageEntryIds)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath("/time");
  return {};
}

export async function updateHourBank(
  _prev: HourBankFormState,
  formData: FormData,
): Promise<HourBankFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;

  const update: TablesUpdate<"hour_banks"> = {};
  if (data.purchased_hours !== undefined) {
    const v = num(data.purchased_hours);
    if (v != null && v > 0) update.purchased_hours = v;
  }
  if (data.hourly_rate !== undefined) {
    const v = num(data.hourly_rate);
    if (v != null && v > 0) update.hourly_rate = v;
  }
  if (data.expiry_date !== undefined) update.expiry_date = dateOrNull(data.expiry_date);
  if (data.alert_threshold_pct !== undefined) {
    const v = num(data.alert_threshold_pct);
    if (v != null) update.alert_threshold_pct = v;
  }
  if (data.alert_threshold_hours !== undefined) {
    const v = num(data.alert_threshold_hours);
    if (v != null) update.alert_threshold_hours = v;
  }
  if (data.notes !== undefined) update.notes = data.notes || null;

  const { error } = await supabase
    .from("hour_banks")
    .update(update)
    .eq("id", data.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath(`/hour-banks/${data.id}`);
  return { success: true, bankId: data.id };
}

export async function cancelHourBank(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("hour_banks")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath(`/hour-banks/${id}`);
  return {};
}

// ---------- Phase 3.9: Expiry management ----------

const ExtendExpirySchema = z.object({
  id: z.string().uuid(),
  expiry_date: z.string().min(1, "תאריך חובה"),
});

export async function extendBankExpiry(input: {
  id: string;
  expiry_date: string;
}): Promise<{ error?: string }> {
  const parsed = ExtendExpirySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ערכים לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.expiry_date <= today) {
    return { error: "תאריך התפוגה חייב להיות עתידי" };
  }

  const { error } = await supabase
    .from("hour_banks")
    .update({ expiry_date: parsed.data.expiry_date, status: "active" })
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath("/hour-banks/expired");
  revalidatePath(`/hour-banks/${parsed.data.id}`);
  return {};
}

const PartialRefundSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().min(1, "הערה חובה").max(2000, "הערה ארוכה מדי"),
});

export async function partialRefundExpiredBank(input: {
  id: string;
  notes: string;
}): Promise<{ error?: string }> {
  const parsed = PartialRefundSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ערכים לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data: bank, error: loadErr } = await supabase
    .from("hour_banks")
    .select("notes")
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (loadErr) return { error: loadErr.message };
  if (!bank) return { error: "בנק לא נמצא" };

  const stamp = new Date().toISOString().slice(0, 10);
  const refundLine = `[${stamp}] החזר חלקי: ${parsed.data.notes}`;
  const combinedNotes = bank.notes ? `${bank.notes}\n${refundLine}` : refundLine;

  const { error } = await supabase
    .from("hour_banks")
    .update({ status: "cancelled", notes: combinedNotes })
    .eq("id", parsed.data.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath("/hour-banks/expired");
  revalidatePath(`/hour-banks/${parsed.data.id}`);
  return {};
}

export async function runExpiryCheckNow(): Promise<{ error?: string; processed?: boolean }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data: roleRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", profile.id)
    .single();

  if (!roleRow || roleRow.role !== "admin") {
    return { error: "רק מנהלים יכולים להריץ בדיקת תפוגות" };
  }

  const { error } = await supabase.rpc("process_expired_hour_banks");
  if (error) return { error: error.message };

  revalidatePath("/hour-banks");
  revalidatePath("/hour-banks/expired");
  return { processed: true };
}

// ---------- Internal helper: auto-create advance invoice for a bank ----------

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function createAdvanceInvoiceForBank(input: {
  supabase: SupabaseLike;
  tenant_id: string;
  created_by: string;
  customer_id: string;
  bank_id: string;
  purchased_hours: number;
  hourly_rate: number;
  document_type: InvoiceDocumentType;
}): Promise<void> {
  const subtotal = Math.round(input.purchased_hours * input.hourly_rate * 100) / 100;
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  const dueIso = due.toISOString().slice(0, 10);

  const { data: invoice, error } = await input.supabase
    .from("invoices")
    .insert({
      tenant_id: input.tenant_id,
      created_by: input.created_by,
      customer_id: input.customer_id,
      hour_bank_id: input.bank_id,
      type: "advance",
      document_type: input.document_type,
      status: "draft",
      issue_date: today.toISOString().slice(0, 10),
      due_date: dueIso,
      subtotal,
      tax_rate: 18,
      currency: "ILS",
      notes: "מקדמה לבנק שעות (טיוטה אוטומטית)",
    })
    .select("id, total_amount")
    .single();

  if (error || !invoice) return;

  await input.supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: `מקדמה — ${input.purchased_hours} שעות`,
    quantity: input.purchased_hours,
    unit_price: input.hourly_rate,
    order_index: 0,
  });

  // Fetch customer details so the Make scenario has everything it needs to
  // produce the Finbot document without a follow-up lookup.
  const { data: customer } = await input.supabase
    .from("customers")
    .select("name, email, phone, company, address, company_registration_number")
    .eq("id", input.customer_id)
    .maybeSingle();

  await fireMakeWebhook(input.tenant_id, "invoice.draft_for_bank", {
    invoice_id: invoice.id,
    bank_id: input.bank_id,
    customer_id: input.customer_id,
    customer: customer
      ? {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          company: customer.company,
          address: customer.address,
          tax_id: customer.company_registration_number,
        }
      : null,
    total_amount: invoice.total_amount,
    subtotal: input.purchased_hours * input.hourly_rate,
    tax_rate: 18,
    currency: "ILS",
    purchased_hours: input.purchased_hours,
    hourly_rate: input.hourly_rate,
    document_type: input.document_type,
  });
}

export async function bulkCancelHourBanks(
  ids: string[],
): Promise<{ cancelled: number; error?: string }> {
  if (ids.length === 0) return { cancelled: 0 };
  const { supabase, profile } = await getTenant();
  if (!profile) return { cancelled: 0, error: "לא מחובר" };

  const { error, count } = await supabase
    .from("hour_banks")
    .update({ status: "cancelled" })
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["active", "draft"]);

  if (error) return { cancelled: 0, error: error.message };
  revalidatePath("/hour-banks");
  return { cancelled: count ?? ids.length };
}

export async function bulkDeleteHourBanks(
  ids: string[],
): Promise<{ deleted: number; error?: string; skipped?: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const { supabase, profile } = await getTenant();
  if (!profile) return { deleted: 0, error: "לא מחובר" };

  // Only delete banks with no allocated time entries
  const { data: allocated } = await supabase
    .from("time_entries")
    .select("consumed_from_bank_id")
    .in("consumed_from_bank_id", ids)
    .eq("tenant_id", profile.tenant_id)
    .limit(ids.length);

  const blockedIds = new Set((allocated ?? []).map((e) => e.consumed_from_bank_id));
  const deletableIds = ids.filter((id) => !blockedIds.has(id));

  if (deletableIds.length === 0) {
    return {
      deleted: 0,
      skipped: ids.length,
      error: "לא ניתן למחוק בנקים עם שעות מוקצות. ביטול בלבד.",
    };
  }

  const { error, count } = await supabase
    .from("hour_banks")
    .delete()
    .in("id", deletableIds)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { deleted: 0, error: error.message };
  revalidatePath("/hour-banks");
  return { deleted: count ?? deletableIds.length, skipped: ids.length - deletableIds.length };
}

export async function backfillPendingEntries(bankId: string) {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("backfill_pending_entries_to_bank", {
    p_bank_id: bankId,
  });
  if (error) return { error: error.message as string };
  revalidatePath(`/hour-banks/${bankId}`);
  return { allocated: (data as number) ?? 0 };
}
