import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createTimeEntryFromTimerForUser } from "@/lib/time-entries";

const StartSchema = z.object({
  customer_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  task_id: z.string().uuid().nullish(),
  notes: z.string().nullish(),
  source: z.enum(["telegram", "api"]).optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Stop any existing timer first so we never silently overwrite a running session.
  const { data: existing, error: readError } = await supabase
    .from("active_timers")
    .select("customer_id, project_id, task_id, notes, started_at")
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (readError) {
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  let stoppedPrevious: { entry_id: string; duration_minutes: number } | undefined;
  if (existing) {
    const stopResult = await createTimeEntryFromTimerForUser(supabase, auth.userId, auth.tenantId, {
      customer_id: existing.customer_id,
      project_id: existing.project_id,
      task_id: existing.task_id,
      notes: existing.notes,
      start_time: existing.started_at,
      end_time: new Date().toISOString(),
      billable: true,
    });
    if (stopResult.error) {
      return Response.json({ error: stopResult.error }, { status: 500 });
    }
    stoppedPrevious = {
      entry_id: stopResult.entryId!,
      duration_minutes: stopResult.durationMinutes!,
    };
  }

  const startedAt = new Date().toISOString();
  const { error } = await supabase.from("active_timers").upsert(
    {
      user_id: auth.userId,
      tenant_id: auth.tenantId,
      customer_id: parsed.data.customer_id ?? null,
      project_id: parsed.data.project_id ?? null,
      task_id: parsed.data.task_id ?? null,
      notes: parsed.data.notes ?? null,
      started_at: startedAt,
      source: parsed.data.source ?? "telegram",
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  return Response.json({
    started: true,
    started_at: startedAt,
    ...(stoppedPrevious ? { stopped_previous: stoppedPrevious } : {}),
  });
}
