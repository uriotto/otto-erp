import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createTimeEntryFromTimerForUser } from "@/lib/time-entries";

export async function POST(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

  const supabase = createServiceClient();

  const { data: timer, error: readError } = await supabase
    .from("active_timers")
    .select("customer_id, project_id, task_id, notes, started_at")
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (readError) {
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!timer) {
    return Response.json({ error: "no active timer" }, { status: 404 });
  }

  const endTime = new Date().toISOString();
  const result = await createTimeEntryFromTimerForUser(supabase, auth.userId, auth.tenantId, {
    customer_id: timer.customer_id,
    project_id: timer.project_id,
    task_id: timer.task_id,
    notes: timer.notes,
    start_time: timer.started_at,
    end_time: endTime,
    billable: true,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  await supabase
    .from("active_timers")
    .delete()
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId);

  return Response.json({
    stopped: true,
    entry_id: result.entryId,
    duration_minutes: result.durationMinutes,
  });
}
