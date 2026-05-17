import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchContactSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, role, email, phone, notes, customer_id, created_at, updated_at")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ contact: data });
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

  const parsed = PatchContactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: existing, error: checkError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: checkError.message }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  if (parsed.data.customer_id !== undefined && parsed.data.customer_id !== null) {
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customer_id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (custErr) return Response.json({ error: custErr.message }, { status: 500 });
    if (!customer) return Response.json({ error: "customer not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.customer_id !== undefined) updates.customer_id = parsed.data.customer_id;

  if (Object.keys(updates).length === 0) {
    return Response.json({ updated: true });
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("contacts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
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

  const { data: existing, error: checkError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: checkError.message }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    if (error.code === "23503") {
      return Response.json({ error: "contact is referenced by other records" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
