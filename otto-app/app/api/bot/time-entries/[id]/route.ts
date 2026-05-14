import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchTimeEntrySchema = z.object({
  duration_minutes: z.number().positive().int().optional(),
  notes: z.string().optional(),
  customer_id: z.string().uuid().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = PatchTimeEntrySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: existing, error: findErr } = await supabase
    .from("time_entries")
    .select("id, start_time, duration_minutes")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (findErr) return Response.json({ error: findErr.message }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const updates: {
    duration_minutes?: number;
    notes?: string;
    customer_id?: string;
    end_time?: string;
  } = { ...parsed.data };

  if (parsed.data.duration_minutes !== undefined) {
    const startMs = new Date(existing.start_time).getTime();
    const endMs = startMs + parsed.data.duration_minutes * 60 * 1000;
    updates.end_time = new Date(endMs).toISOString();
  }

  const { error: updateErr } = await supabase
    .from("time_entries")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ updated: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();

  const { data: existing, error: findErr } = await supabase
    .from("time_entries")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (findErr) return Response.json({ error: findErr.message }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { error: deleteErr } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId)
    .eq("tenant_id", auth.tenantId);

  if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 });

  return Response.json({ deleted: true });
}
