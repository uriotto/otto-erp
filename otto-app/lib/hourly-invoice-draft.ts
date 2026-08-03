/**
 * Builds the exact content of an hours-based invoice WITHOUT writing anything.
 *
 * Single source of truth for the billing math, shared by:
 *   - the preview dialog in /billing-run (read-only draft shown before issuing)
 *   - createHourlyInvoice in app/(app)/time/actions.ts (the real issue path)
 *
 * Keeping both on the same function guarantees the preview the user approves is
 * byte-for-byte what gets sent to Finbot.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildHoursDetail, type HoursDetail, type HoursDetailLine } from "@/lib/hours-detail";

type Supabase = SupabaseClient<Database>;

export const VAT_RATE = 18;

export type HourlyInvoiceItem = {
  description: string;
  quantity: number;
  unit_price: number;
  order_index: number;
};

/** Serializable draft shown in the pre-issue preview dialog. */
export type InvoiceDraftPreview = {
  customerName: string;
  customerEmail: string | null;
  items: HourlyInvoiceItem[];
  hoursLines: HoursDetailLine[];
  totalHours: number;
  entryCount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  /** Set when an equivalent document already exists (retainer double-billing guard). */
  warning?: string;
};

export type HourlyInvoiceDraft = {
  customerName: string;
  customerEmail: string | null;
  entryIds: string[];
  entryCount: number;
  items: HourlyInvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  detail: HoursDetail;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function draftToPreview(d: HourlyInvoiceDraft): InvoiceDraftPreview {
  return {
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    items: d.items,
    hoursLines: d.detail.lines,
    totalHours: d.detail.totalHours,
    entryCount: d.entryCount,
    subtotal: d.subtotal,
    taxRate: d.taxRate,
    taxAmount: d.taxAmount,
    total: d.total,
  };
}

export async function buildHourlyInvoiceDraft(
  supabase: Supabase,
  tenantId: string,
  customerId: string,
  opts?: { until?: string },
): Promise<{ error?: string; draft?: HourlyInvoiceDraft }> {
  const { data: customer } = await supabase
    .from("customers")
    .select("name, email, hourly_rate_override")
    .eq("id", customerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!customer) return { error: "לקוח לא נמצא" };

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("default_hourly_rate")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Rate precedence: rate frozen on the entry -> customer override -> tenant default.
  const fallbackRate =
    Number(customer.hourly_rate_override) || Number(settings?.default_hourly_rate) || 0;
  if (fallbackRate <= 0) {
    return { error: "ללקוח אין תעריף מוגדר ואין תעריף ברירת מחדל - הגדר תעריף לפני הפקת חשבונית" };
  }

  let entriesQuery = supabase
    .from("time_entries")
    .select("id, start_time, duration_minutes, notes, task_id, hourly_rate_at_entry, is_overage")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .eq("billable", true)
    .in("billing_status", ["pending", "overage"]);
  if (opts?.until) entriesQuery = entriesQuery.lt("start_time", opts.until);

  const { data: entries, error: fetchError } = await entriesQuery;

  if (fetchError) return { error: fetchError.message };
  if (!entries || entries.length === 0) return { error: "אין שעות ממתינות לחיוב" };

  // Resolve task titles to enrich descriptions where the entry has no notes.
  const taskIds = Array.from(
    new Set(entries.map((e) => e.task_id).filter((id): id is string => !!id)),
  );
  const taskTitle = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", taskIds);
    for (const t of tasks ?? []) taskTitle.set(t.id, t.title);
  }

  // Group hours by rate + overage flag so regular and overage hours get separate,
  // clearly-labelled invoice lines.
  const byGroup = new Map<string, { rate: number; overage: boolean; hours: number }>();
  for (const e of entries) {
    const rate = Number(e.hourly_rate_at_entry) || fallbackRate;
    const overage = e.is_overage === true;
    const minutes = Number(e.duration_minutes) || 0;
    const key = `${overage ? "o" : "r"}:${rate}`;
    const g = byGroup.get(key) ?? { rate, overage, hours: 0 };
    g.hours += minutes / 60;
    byGroup.set(key, g);
  }

  const items: HourlyInvoiceItem[] = Array.from(byGroup.values())
    .sort((a, b) => Number(a.overage) - Number(b.overage) || a.rate - b.rate)
    .map((g, idx) => ({
      description: `${g.overage ? "שעות חריגה" : "שעות עבודה"} — ${round2(g.hours)} שעות`,
      quantity: round2(g.hours),
      unit_price: g.rate,
      order_index: idx,
    }));

  const subtotal = round2(items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0));
  const taxAmount = round2((subtotal * VAT_RATE) / 100);

  const detail = buildHoursDetail(
    entries.map((e) => ({
      start_time: e.start_time,
      duration_minutes: e.duration_minutes,
      description: (e.notes ?? "").trim() || (e.task_id ? (taskTitle.get(e.task_id) ?? "") : ""),
    })),
  );

  return {
    draft: {
      customerName: customer.name,
      customerEmail: customer.email,
      entryIds: entries.map((e) => e.id),
      entryCount: entries.length,
      items,
      subtotal,
      taxRate: VAT_RATE,
      taxAmount,
      total: round2(subtotal + taxAmount),
      detail,
    },
  };
}
