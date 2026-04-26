"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
  const { data: profile } = await supabase.from("users").select("tenant_id, id").single();
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

  revalidatePath("/hour-banks");
  return { success: true, bankId: bank.id };
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
