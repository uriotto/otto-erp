import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const UpdateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  company: z.string().optional(),
  value: z.number().optional(),
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

  const parsed = UpdateLeadSchema.safeParse(body);
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

  // Verify lead belongs to this tenant
  const { data: existing, error: fetchError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "lead not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("leads")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ updated: true });
}
