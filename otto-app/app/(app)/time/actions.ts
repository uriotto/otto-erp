"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTimeEntryFromTimerForUser, type TimerCreateInput } from "@/lib/time-entries";
import { issueDocumentForInvoice } from "@/lib/finbot";
import {
  buildHourlyInvoiceDraft,
  draftToPreview,
  type InvoiceDraftPreview,
} from "@/lib/hourly-invoice-draft";
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

/**
 * Read-only draft of the hours invoice for a customer - exactly what
 * createHourlyInvoice would produce. Nothing is written, nothing is sent.
 */
export async function previewHourlyInvoice(
  customerId: string,
  until?: string,
): Promise<{ error?: string; preview?: InvoiceDraftPreview }> {
  if (!z.string().uuid().safeParse(customerId).success) return { error: "קלט לא תקין" };
  if (until && !z.string().datetime().safeParse(until).success) return { error: "תאריך לא תקין" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const built = await buildHourlyInvoiceDraft(supabase, profile.tenant_id, customerId, { until });
  if (!built.draft) return { error: built.error ?? "שגיאה בהכנת הטיוטה" };

  return { preview: draftToPreview(built.draft) };
}

const SettleSchema = z.object({
  customer_id: z.string().uuid(),
  until: z.string().datetime().optional(),
});

/**
 * Closes a customer's pending hours as "paid outside OTTO" - no invoice, no
 * Finbot document. The hours leave the billing queue but stay in the ledger with
 * a distinct status so the move is visible and reversible from /time.
 */
export async function settleHoursExternally(input: {
  customer_id: string;
  until?: string;
}): Promise<{ error?: string; count?: number; hours?: number }> {
  const parsed = SettleSchema.safeParse(input);
  if (!parsed.success) return { error: "קלט לא תקין" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  let query = supabase
    .from("time_entries")
    .select("id, duration_minutes")
    .eq("customer_id", parsed.data.customer_id)
    .eq("tenant_id", profile.tenant_id)
    .eq("billable", true)
    .in("billing_status", ["pending", "overage"]);
  if (parsed.data.until) query = query.lt("start_time", parsed.data.until);

  const { data: entries, error: fetchErr } = await query;
  if (fetchErr) return { error: fetchErr.message };
  if (!entries || entries.length === 0) return { error: "אין שעות ממתינות לחיוב" };

  const minutes = entries.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);

  const { error: updateErr } = await supabase
    .from("time_entries")
    .update({ billing_status: "settled_externally" })
    .in(
      "id",
      entries.map((e) => e.id),
    )
    .eq("tenant_id", profile.tenant_id);

  if (updateErr) return { error: updateErr.message };

  revalidatePath("/billing-run");
  revalidatePath("/time");
  revalidatePath(`/customers/${parsed.data.customer_id}`);

  return { count: entries.length, hours: Math.round((minutes / 60) * 100) / 100 };
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
  if (opts?.until && !z.string().datetime().safeParse(opts.until).success) {
    return { error: "תאריך לא תקין" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  // Same builder the /billing-run preview dialog uses - what Uri approved is what gets issued.
  const built = await buildHourlyInvoiceDraft(supabase, profile.tenant_id, customerId, {
    until: opts?.until,
  });
  if (!built.draft) return { error: built.error ?? "שגיאה בהכנת החשבונית" };
  const { items, subtotal, detail, entryIds } = built.draft;

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

  const { error: linkErr } = await supabase
    .from("time_entries")
    .update({ billing_status: "invoiced", invoice_id: invoice.id })
    .in("id", entryIds)
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
    count: entryIds.length,
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
