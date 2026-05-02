"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

const TimerSchema = z.object({
  customer_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  task_id: z.string().uuid().nullish(),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  notes: z.string().nullish(),
  billable: z.boolean().optional(),
});

export type TimerCreateInput = z.infer<typeof TimerSchema>;

export async function createTimeEntryFromTimer(
  input: TimerCreateInput,
): Promise<{ error?: string; entryId?: string; durationMinutes?: number }> {
  const parsed = TimerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "נתוני טיימר לא תקינים" };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const data = parsed.data;
  const startISO = new Date(data.start_time).toISOString();
  const startMs = new Date(data.start_time).getTime();
  const endMs = new Date(data.end_time).getTime();
  // Ensure end > start by at least 60s; minimum duration is 1 minute
  const safeEndMs = Math.max(endMs, startMs + 60000);
  const endISO = new Date(safeEndMs).toISOString();
  const duration = diffMinutes(startISO, endISO);

  const { data: entry, error } = await supabase
    .from("time_entries")
    .insert({
      tenant_id: profile.tenant_id,
      user_id: profile.id,
      customer_id: data.customer_id || null,
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      start_time: startISO,
      end_time: endISO,
      duration_minutes: duration,
      notes: data.notes || null,
      billable: data.billable ?? true,
      // entries without customer cannot be allocated yet — keep pending
      billing_status: data.customer_id ? "pending" : "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/time");
  return { entryId: entry.id, durationMinutes: duration };
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
