import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

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
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ started: true, started_at: startedAt });
}
