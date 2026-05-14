import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("active_timers")
    .select("customer_id, started_at, notes")
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (!data) {
    return Response.json({
      active: false,
      customer_id: null,
      customer_name: null,
      started_at: null,
      elapsed_minutes: null,
      notes: null,
    });
  }

  let customer_name: string | null = null;
  if (data.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", data.customer_id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    customer_name = customer?.name ?? null;
  }

  const elapsed_minutes = data.started_at
    ? Math.floor((Date.now() - new Date(data.started_at).getTime()) / 60000)
    : null;

  return Response.json({
    active: true,
    customer_id: data.customer_id,
    customer_name,
    started_at: data.started_at,
    elapsed_minutes,
    notes: data.notes,
  });
}

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
