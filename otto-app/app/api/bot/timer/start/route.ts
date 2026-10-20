import { z } from "zod";
import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { TimerSnapshot } from "@/lib/desktop-timer";

const StartSchema = z.object({
  request_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  task_id: z.string().uuid().nullish(),
  notes: z.string().max(4000).nullish(),
  source: z.enum(["telegram", "api"]).optional(),
});

export async function POST(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });
  const { data, error } = await createServiceClient().rpc("bot_timer", {
    p_user: guard.auth.userId,
    p_tenant: guard.auth.tenantId,
    // Legacy callers cannot safely auto-stop after an uncertain response.
    p_operation: parsed.data.request_id ? "restart" : "start",
    p_input: { ...parsed.data, source: parsed.data.source ?? "telegram" },
  });
  if (error)
    return Response.json(
      {
        error:
          error.message === "REQUEST_CONFLICT"
            ? "This request_id was already used with different timer details."
            : error.message === "TIMER_ACTIVE"
              ? "A timer is already active. Stop it before starting another."
              : "timer operation failed",
      },
      { status: ["TIMER_ACTIVE", "REQUEST_CONFLICT"].includes(error.message) ? 409 : 400 },
    );
  const snapshot = data as unknown as TimerSnapshot & {
    started_result: { session_id: string; revision: number; started_at: string };
    replayed?: boolean;
    stopped_previous?: { entry_id: string; duration_minutes: number } | null;
  };
  return Response.json({
    started: true,
    replayed: snapshot.replayed ?? false,
    ...(snapshot.stopped_previous ? { stopped_previous: snapshot.stopped_previous } : {}),
    started_at: snapshot.started_result.started_at,
    session_id: snapshot.started_result.session_id,
    revision: snapshot.started_result.revision,
  });
}
