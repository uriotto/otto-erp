import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchSchema = z.object({
  notes: z.string().min(1),
  append_mode: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const appendMode = parsed.data.append_mode ?? true;

  const supabase = createServiceClient();
  const { data: existing, error: readError } = await supabase
    .from("active_timers")
    .select("notes")
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (readError) {
    return Response.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return Response.json({ error: "no active timer" }, { status: 404 });
  }

  const nextNotes =
    appendMode && existing.notes ? `${existing.notes}\n${parsed.data.notes}` : parsed.data.notes;

  const { error: updateError } = await supabase
    .from("active_timers")
    .update({ notes: nextNotes })
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ updated: true, notes: nextNotes });
}
