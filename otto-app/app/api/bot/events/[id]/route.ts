import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchEventSchema = z.object({
  title: z.string().min(1).optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  meeting_url: z.string().url().optional(),
  all_day: z.boolean().optional(),
  customer_id: z.string().uuid().nullable().optional(),
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
  const parsed = PatchEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Verify the event belongs to this tenant
  const { data: existing, error: checkError } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: "internal error" }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.start_at !== undefined) updates.start_at = parsed.data.start_at;
  if (parsed.data.end_at !== undefined) updates.end_at = parsed.data.end_at;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.location !== undefined) updates.location = parsed.data.location;
  if (parsed.data.meeting_url !== undefined) updates.meeting_url = parsed.data.meeting_url;
  if (parsed.data.all_day !== undefined) updates.all_day = parsed.data.all_day;
  if (parsed.data.customer_id !== undefined) updates.customer_id = parsed.data.customer_id;

  if (Object.keys(updates).length === 0) {
    return Response.json({ updated: true });
  }

  const { error } = await supabase
    .from("events")
    .update(updates as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ updated: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();

  // Verify the event belongs to this tenant
  const { data: existing, error: checkError } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: "internal error" }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ deleted: true });
}
