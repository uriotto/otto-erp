import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional(),
  description: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_date, due_at, customer_id, project_id, lead_id, assigned_to, tags, created_at, updated_at",
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "task not found" }, { status: 404 });

  return Response.json({ task: data });
}

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

  const parsed = UpdateTaskSchema.safeParse(body);
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

  // Verify task belongs to this tenant
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates = { ...parsed.data, updated_at: new Date().toISOString() } as any;
  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ updated: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();

  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return Response.json({ error: "task not found" }, { status: 404 });

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    if (error.code === "23503") {
      return Response.json({ error: "task is referenced by other records" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
