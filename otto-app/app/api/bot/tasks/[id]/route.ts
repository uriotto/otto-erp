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
