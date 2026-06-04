import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  hourly_rate: z.number().positive().nullable().optional(),
  billing_type: z.string().nullable().optional(),
  status: z.string().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, company, hourly_rate_override, billing_model_default, status, active, notes, created_at",
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ customer: data });
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
  const parsed = PatchCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Verify the customer exists, belongs to this tenant, and is not deleted
  const { data: existing, error: checkError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: "internal error" }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.hourly_rate !== undefined) updates.hourly_rate_override = parsed.data.hourly_rate;
  if (parsed.data.billing_type !== undefined)
    updates.billing_model_default = parsed.data.billing_type;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  if (Object.keys(updates).length === 0) {
    return Response.json({ updated: true });
  }

  const { error } = await supabase
    .from("customers")
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

  const { data: existing, error: checkError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: "internal error" }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    if (error.code === "23503") {
      return Response.json(
        { error: "customer is referenced by other records (projects, invoices, etc.)" },
        { status: 409 },
      );
    }
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
