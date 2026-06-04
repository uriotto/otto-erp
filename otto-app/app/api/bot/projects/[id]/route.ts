import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  budget: z.number().optional(),
  customer_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
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

  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return Response.json({ error: "no fields to update" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify project belongs to this tenant and is not deleted
  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates = { ...parsed.data, updated_at: new Date().toISOString() } as any;
  const { error } = await supabase
    .from("projects")
    .update(updates)
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

  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) return Response.json({ error: "internal error" }, { status: 500 });
  if (!existing) return Response.json({ error: "project not found" }, { status: 404 });

  const { error } = await supabase
    .from("projects")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ deleted: true });
}
