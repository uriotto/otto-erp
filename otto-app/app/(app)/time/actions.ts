"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const TimeEntrySchema = z
  .object({
    customer_id: z.string().uuid("בחר לקוח"),
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
  const { data: profile } = await supabase.from("users").select("tenant_id, id").single();
  return { supabase, profile };
}

function diffMinutes(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  // Minimum 1 minute — DB constraint requires duration_minutes > 0
  return Math.max(1, Math.round((e - s) / 60000));
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

  const { error } = await supabase
    .from("time_entries")
    .update({
      customer_id: data.customer_id,
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

  if (error) return { error: error.message };

  revalidatePath("/time");
  return { success: true, entryId: data.id };
}

export async function deleteTimeEntry(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/time");
  return {};
}

const TimerSchema = z.object({
  customer_id: z.string().uuid(),
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
      customer_id: data.customer_id,
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      start_time: startISO,
      end_time: endISO,
      duration_minutes: duration,
      notes: data.notes || null,
      billable: data.billable ?? true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/time");
  return { entryId: entry.id, durationMinutes: duration };
}
