import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/supabase/types";

export const TimerSchema = z.object({
  customer_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  task_id: z.string().uuid().nullish(),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  notes: z.string().nullish(),
  billable: z.boolean().optional(),
});

export type TimerCreateInput = z.infer<typeof TimerSchema>;

function diffMinutes(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.ceil((e - s) / 60000));
}

export async function createTimeEntryFromTimerForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  tenantId: string,
  input: TimerCreateInput,
): Promise<{ error?: string; entryId?: string; durationMinutes?: number }> {
  const parsed = TimerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "נתוני טיימר לא תקינים" };
  }

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
      tenant_id: tenantId,
      user_id: userId,
      customer_id: data.customer_id || null,
      project_id: data.project_id || null,
      task_id: data.task_id || null,
      start_time: startISO,
      end_time: endISO,
      duration_minutes: duration,
      notes: data.notes || null,
      billable: data.billable ?? true,
      billing_status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { entryId: entry.id, durationMinutes: duration };
}
