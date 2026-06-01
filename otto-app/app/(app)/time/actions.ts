"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTimeEntryFromTimerForUser, type TimerCreateInput } from "@/lib/time-entries";
import { fireMakeWebhook } from "@/lib/make-webhook";
import { buildHoursDetail } from "@/lib/hours-detail";

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
    .select("consumed_from_bank_id, billing_status, is_overage, customer_id")
    .eq("id", data.id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

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
  opts?: { documentType?: InvoiceDocumentType; attachHoursDetail?: boolean },
): Promise<{
  error?: string;
  hours?: number;
  amount?: number;
  count?: number;
  invoiceId?: string;
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
    .maybeSingle();

  const fallbackRate =
    Number(customer.hourly_rate_override) || Number(settings?.default_hourly_rate) || 0;

  const { data: entries, error: fetchError } = await supabase
    .from("time_entries")
    .select("id, start_time, duration_minutes, notes, task_id, hourly_rate_at_entry")
    .eq("customer_id", customerId)
    .eq("tenant_id", profile.tenant_id)
    .eq("billable", true)
    .in("billing_status", ["pending", "overage"]);

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

  // Group hours by their effective rate so each rate becomes one invoice line.
  const byRate = new Map<number, number>();
  for (const e of entries) {
    const rate = Number(e.hourly_rate_at_entry) || fallbackRate;
    const minutes = Number(e.duration_minutes) || 0;
    byRate.set(rate, (byRate.get(rate) ?? 0) + minutes / 60);
  }

  const items = Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, hrs], idx) => ({
      description: `שעות עבודה — ${Math.round(hrs * 100) / 100} שעות`,
      quantity: Math.round(hrs * 100) / 100,
      unit_price: rate,
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

  const today = new Date();
  const due = new Date(today);
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
      issue_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
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

  await fireMakeWebhook(profile.tenant_id, "invoice.created", {
    invoice_id: invoice.id,
    type: "monthly_hours",
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
    hours_detail: attachDetail ? detail.lines : null,
    time_entry_ids: ids,
  });

  revalidatePath("/time");
  revalidatePath("/invoices");
  revalidatePath(`/customers/${customerId}`);

  const hours = detail.totalHours;
  const amount = Math.round(subtotal);
  return { hours, amount, count: entries.length, invoiceId: invoice.id };
}

export async function bulkToggleBillable(
  ids: string[],
  billable: boolean,
): Promise<{ updated: number; error?: string }> {
  if (ids.length === 0) return { updated: 0 };
  const { supabase, profile } = await getTenant();
  if (!profile) return { updated: 0, error: "לא מחובר" };

  const { error, count } = await supabase
    .from("time_entries")
    .update({ billable })
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { updated: 0, error: error.message };
  revalidatePath("/time");
  return { updated: count ?? ids.length };
}
