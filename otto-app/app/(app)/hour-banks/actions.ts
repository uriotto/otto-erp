"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fireMakeWebhook } from "@/lib/make-webhook";
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

  // Auto-create an advance invoice draft linked to this bank
  await createAdvanceInvoiceForBank({
    supabase,
    tenant_id: profile.tenant_id,
    created_by: profile.id,
    customer_id: data.customer_id,
    bank_id: bank.id,
    purchased_hours: purchasedHours,
    hourly_rate: hourlyRate,
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

export async function approveRenewalDraft(draftId: string): Promise<{ error?: string }> {
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
): Promise<{ error?: string }> {
  if (overageEntryIds.length === 0) return {};
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("time_entries")
    .update({ billing_status: "invoiced" })
    .in("id", overageEntryIds)
    .eq("tenant_id", profile.tenant_id)
    .eq("customer_id", customerId);

  if (error) return { error: error.message };

  await fireMakeWebhook(profile.tenant_id, "overage.invoice_requested", {
    customer_id: customerId,
    time_entry_ids: overageEntryIds,
  });

  revalidatePath("/hour-banks");
  revalidatePath("/time");
  return {};
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

  // Fire Make webhook for the new invoice draft
  await fireMakeWebhook(input.tenant_id, "invoice.draft_for_bank", {
    invoice_id: invoice.id,
    bank_id: input.bank_id,
    customer_id: input.customer_id,
    total_amount: invoice.total_amount,
    purchased_hours: input.purchased_hours,
    hourly_rate: input.hourly_rate,
  });
}
