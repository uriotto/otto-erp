import { z } from "zod";
import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const supabase = createServiceClient();
  const body = await request.text();
  let input: { session_id: string; revision: number };
  if (body.trim()) {
    let parsed;
    try {
      parsed = z
        .object({ session_id: z.string().uuid(), revision: z.number().int().positive() })
        .safeParse(JSON.parse(body));
    } catch {
      return Response.json({ error: "invalid body" }, { status: 400 });
    }
    if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });
    input = parsed.data;
  } else {
    const { data: timer, error } = await supabase
      .from("active_timers")
      .select("session_id, revision")
      .eq("user_id", guard.auth.userId)
      .eq("tenant_id", guard.auth.tenantId)
      .maybeSingle();
    if (error) return Response.json({ error: "internal error" }, { status: 500 });
    if (!timer) return Response.json({ error: "no active timer" }, { status: 404 });
    input = timer;
  }
  const { data, error } = await supabase.rpc("bot_timer", {
    p_user: guard.auth.userId,
    p_tenant: guard.auth.tenantId,
    p_operation: "stop",
    p_input: input,
  });
  if (error)
    return Response.json(
      { error: "timer changed or stop failed; refresh before retrying" },
      { status: 409 },
    );
  const result = data as { operation_result: { entry_id: string; duration_minutes: number } };
  return Response.json({ stopped: true, ...result.operation_result });
}
