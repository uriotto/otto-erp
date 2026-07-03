"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTimeEntryFromTimerForUser, type TimerCreateInput } from "@/lib/time-entries";
import { issueDocumentForInvoice } from "@/lib/finbot";
import { buildHoursDetail } from "@/lib/hours-detail";
import { todayIL, ilDayKey } from "@/lib/dates";

type InvoiceDocumentType = "payment_request" | "tax_invoice" | "tax_invoice_receipt";

const TimeEntrySchema = z
  .object({
    customer_id: z.string().uuid().optional().or(z.literal("")),
    project_id: z.string().uuid().optional().or(z.literal("")),
    task_id: z.string().uuid().optional().or(z.literal("")),
    start_time: z.string().min(1, "שעת התחלה חובה"),
    end_time: z.string().min(1, "שעת סיום חובה"),
    notes: z.string().optional(),
    billable: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .refine(
    (d) => {
      const s = new Date(d.start_time).getTime();
      const e = new Date(d.end_time).getTime();
      return Number.isFinite(s) && Number.isFinite(e) && e > s;
    },
    { message: "שעת סיום חייבת להיות אחרי שעת התחלה", path: ["end_time"] },
  );

export type TimeEntryFormState = {
  error?: string;
  warning?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  entryId?: string;
};

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

function diffMinutes(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  // Always round UP to next minute. Minimum 1 minute (any positive duration → 1 min).
  return Math.max(1, Math.ceil((e - s) / 60000));
}

export async function createTimeEntry(
  _prev: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = TimeEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;
  const startISO = new Date(data.start_time).toISOString();
  const endISO = new Date(data.end_time).toISOString();

  const { data: entry, error } = await supabase
    .from("time_entries")
    .insert({
      tenant_id: profile.tenant_id,
      user_id: profile.id,
      customer_id: data.customer_id,
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      start_time: startISO,
      end_time: endISO,
      duration_minutes: diffMinutes(startISO, endISO),
      notes: data.notes || null,
      billable: data.billable,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/time");
  return { success: true, entryId: entry.id };
}

const UpdateSchema = TimeEntrySchema.and(z.object({ id: z.string().uuid() }));

export async function updateTimeEntry(
  _prev: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;
  const startISO = new Date(data.start_time).toISOString();
  const endISO = new Date(data.end_time).toISOString();

  // Capture previous bank/overage state to recalc after the change
  const { data: prevEntry } = await supabase
    .from("time_entries")
    .select("consumed_from_bank_id, billing_status, is_overage, customer_id, invoice_id")
    .eq("id", data.id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  // Invoiced entries: the fields may change, but the billing linkage stays frozen.
  // The invoice keeps its original snapshot (items + notes) - no re-allocation.
  if (prevEntry?.billing_status === "invoiced") {
    const { error: invoicedErr } = await supabase
      .from("time_entries")
      .update({
        customer_id: data.customer_id || null,
        project_id: data.project_id || null,
        task_id: data.task_id || null,
        start_time: startISO,
        end_time: endISO,
        duration_minutes: diffMinutes(startISO, endISO),
        notes: data.notes || null,
        billable: data.billable,
      })
      .eq("id", data.id)
      .eq("tenant_id", profile.tenant_id);

    if (invoicedErr) return { error: invoicedErr.message };

    revalidatePath("/time");
    return {
      success: true,
      entryId: data.id,
      warning: "הרשומה כבר על חשבונית - החשבונית לא השתנתה",
    };
  }

  // Reset bank linkage so the new state will be recomputed
  // billing_status=pending forces the allocation function to redo the math
  const { error } = await supabase
    .from("time_entries")
    .update({
      customer_id: data.customer_id || null,
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      start_time: startISO,
      end_time: endISO,
      duration_minutes: diffMinutes(startISO, endISO),
      notes: data.notes || null,
      billable: data.billable,
      billing_status: "pending",
      consumed_from_bank_id: null,
      is_overage: false,
    })
    .eq("id", data.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  // If the entry was previously linked to a bank, recompute its status
  // (might transition depleted → active when freed time comes back)
  if (prevEntry?.consumed_from_bank_id) {
    await supabase.rpc("recalculate_bank", { p_bank_id: prevEntry.consumed_from_bank_id });
  }

  // Re-allocate. If still billable + has customer, it'll allocate to current
  // active bank (FIFO). Will split if duration exceeds remaining.
  if (data.customer_id && data.billable) {
    await supabase.rpc("allocate_time_entry_to_bank", { p_entry_id: data.id });
  }

  // Old customer's hour-banks page should also refresh if customer changed
  if (prevEntry?.customer_id && prevEntry.customer_id !== data.customer_id) {
    revalidatePath(`/customers/${prevEntry.customer_id}`);
  }

  revalidatePath("/time");
  revalidatePath("/hour-banks");
  if (data.customer_id) revalidatePath(`/customers/${data.customer_id}`);
  return { success: true, entryId: data.id };
}

export async function deleteTimeEntry(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  // Capture bank before delete so we can recalc its status after
  const { data: prevEntry } = await supabase
    .from("time_entries")
    .select("consumed_from_bank_id, customer_id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  if (prevEntry?.consumed_from_bank_id) {
    await supabase.rpc("recalculate_bank", { p_bank_id: prevEntry.consumed_from_bank_id });
  }

  revalidatePath("/time");
  revalidatePath("/hour-banks");
  if (prevEntry?.customer_id) revalidatePath(`/customers/${prevEntry.customer_id}`);
  return {};
}

export async function createTimeEntryFromTimer(
  input: TimerCreateInput,
): Promise<{ error?: string; entryId?: string; durationMinutes?: number }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };
  const result = await createTimeEntryFromTimerForUser(
    supabase,
    profile.id,
    profile.tenant_id,
    input,
  );
  if (!result.error) revalidatePath("/time");
  return result;
}

const AssignCustomerSchema = z.object({
  entry_id: z.string().uuid(),
  customer_id: z.string().uuid(),
});

export async function assignCustomerToEntry(input: {
  entry_id: string;
  customer_id: string;
}): Promise<{ error?: string }> {
  const parsed = AssignCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: "קלט לא תקין" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("time_entries")
    .update({ customer_id: parsed.data.customer_id })
    .eq("id", parsed.data.entry_id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  // Trigger allocation (entries with billing_status='pending' will allocate via trigger)
  // The DB function allocate_time_entry_to_bank can be called explicitly
  await supabase.rpc("allocate_time_entry_to_bank", { p_entry_id: parsed.data.entry_id });

  revalidatePath("/time");
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  return {};
}

export async function bulkDeleteTimeEntries(
  ids: string[],
): Promise<{ deleted: number; error?: string }> {
  if (ids.length === 0) return { deleted: 0 };
  const { supabase, profile } = await getTenant();
  if (!profile) return { deleted: 0, error: "לא מחובר" };

  const { error, count } = await supabase
    .from("time_entries")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id)
    .neq("billing_status", "invoiced");

  if (error) return { deleted: 0, error: error.message };
  revalidatePath("/time");
  return { deleted: count ?? ids.length };
}

export async function allocateEntryToBank(entryId: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase.rpc("allocate_time_entry_to_bank", {
    p_entry_id: entryId,
  });
  if (error) return { error: error.message };

  revalidatePath("/time");
  revalidatePath("/hour-banks");
  return {};
}

export async function markEntryAsInvoiced(entryId: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("time_entries")
    .update({ billing_status: "invoiced" })
    .eq("id", entryId)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/time");
  return {};
}

export async function resetEntryToPending(entryId: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("time_entries")
    .update({ billing_status: "pending", consumed_from_bank_id: null, is_overage: false })
    .eq("id", entryId)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/time");
  return {};
}

export async function createHourlyInvoice(
  customerId: string,
  opts?: {
    documentType?: InvoiceDocumentType;
    attachHoursDetail?: boolean;
    /** ISO timestamp - bill only entries that started before this instant (billing-run month cutoff). */
    until?: string;
  },
): Promise<{
  error?: string;
  hours?: number;
  amount?: number;
  count?: number;
  invoiceId?: string;
  finbotError?: string;
}> {
  const documentType = opts?.documentType ?? "payment_request";
  const attachDetail = opts?.attachHoursDetail ?? true;

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "name, email, phone, company, address, company_registration_number, hourly_rate_override",
    )
    .eq("id", customerId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!customer) return { error: "לקוח לא נמצא" };

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("default_hourly_rate")
    .eq("tenant_id", profile.tenant_id)
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
    .eq("tenant_id", profile.tenant_id)
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

  const items = Array.from(byGroup.values())
    .sort((a, b) => Number(a.overage) - Number(b.overage) || a.rate - b.rate)
    .map((g, idx) => ({
      description: `${g.overage ? "שעות חריגה" : "שעות עבודה"} — ${Math.round(g.hours * 100) / 100} שעות`,
      quantity: Math.round(g.hours * 100) / 100,
      unit_price: g.rate,
      order_index: idx,
    }));

  const subtotal =
    Math.round(items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0) * 100) / 100;

  const detail = buildHoursDetail(
    entries.map((e) => ({
      start_time: e.start_time,
      duration_minutes: e.duration_minutes,
      description: (e.notes ?? "").trim() || (e.task_id ? (taskTitle.get(e.task_id) ?? "") : ""),
    })),
  );

  const issueDate = todayIL();
  const due = new Date();
  due.setDate(due.getDate() + 14);

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      customer_id: customerId,
      type: "monthly_hours",
      document_type: documentType,
      status: "draft",
      issue_date: issueDate,
      due_date: ilDayKey(due),
      subtotal,
      tax_rate: 18,
      currency: "ILS",
      notes: attachDetail ? detail.notesText : null,
    })
    .select("id, total_amount, tax_amount")
    .single();

  if (invErr || !invoice) return { error: invErr?.message ?? "שגיאה ביצירת חשבונית" };

  const { error: itemsErr } = await supabase
    .from("invoice_items")
    .insert(items.map((it) => ({ ...it, invoice_id: invoice.id })));

  if (itemsErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: itemsErr.message };
  }

  const ids = entries.map((e) => e.id);
  const { error: linkErr } = await supabase
    .from("time_entries")
    .update({ billing_status: "invoiced", invoice_id: invoice.id })
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id);

  if (linkErr) return { error: linkErr.message };

  // Issue the document directly in Finbot (failure keeps the draft; UI offers retry).
  const finbot = await issueDocumentForInvoice(supabase, profile.tenant_id, invoice.id);

  revalidatePath("/time");
  revalidatePath("/invoices");
  revalidatePath(`/customers/${customerId}`);

  const hours = detail.totalHours;
  const amount = Math.round(subtotal);
  return {
    hours,
    amount,
    count: entries.length,
    invoiceId: invoice.id,
    finbotError: finbot.ok ? undefined : finbot.error,
  };
}

export async function bulkToggleBillable(
  ids: string[],
  billable: boolean,
): Promise<{ updated: number; error?: string; skipped?: number }> {
  if (ids.length === 0) return { updated: 0 };
  const { supabase, profile } = await getTenant();
  if (!profile) return { updated: 0, error: "לא מחובר" };

  // Invoiced entries keep their billing provenance - skip them.
  const { data: rows, error: fetchErr } = await supabase
    .from("time_entries")
    .select("id, customer_id, consumed_from_bank_id, billing_status")
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id);

  if (fetchErr) return { updated: 0, error: fetchErr.message };

  const editable = (rows ?? []).filter((r) => r.billing_status !== "invoiced");
  if (editable.length === 0) {
    return { updated: 0, skipped: ids.length, error: "כל הרשומות שנבחרו כבר על חשבונית" };
  }

  const editableIds = editable.map((r) => r.id);
  const affectedBanks = new Set(
    editable.map((r) => r.consumed_from_bank_id).filter((id): id is string => !!id),
  );

  // Reset billing linkage so allocation math is redone from a clean state.
  const { error, count } = await supabase
    .from("time_entries")
    .update({
      billable,
      billing_status: "pending",
      consumed_from_bank_id: null,
      is_overage: false,
    })
    .in("id", editableIds)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { updated: 0, error: error.message };

  // Free the released bank capacity (may flip depleted -> active).
  for (const bankId of affectedBanks) {
    await supabase.rpc("recalculate_bank", { p_bank_id: bankId });
  }

  // Entries turned billable get re-allocated to the customer's active bank.
  if (billable) {
    for (const r of editable) {
      if (r.customer_id) {
        await supabase.rpc("allocate_time_entry_to_bank", { p_entry_id: r.id });
      }
    }
  }

  revalidatePath("/time");
  revalidatePath("/hour-banks");
  return { updated: count ?? editableIds.length, skipped: ids.length - editableIds.length };
}
