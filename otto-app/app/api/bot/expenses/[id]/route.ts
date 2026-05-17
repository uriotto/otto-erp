import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  customer_id: z.string().uuid().nullable().optional(),
  date: z.string().optional(),
  category: z.string().nullable().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, amount, description, customer_id, occurred_on, category, currency, invoiced, reimbursable, created_at",
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ expense: data });
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

  const parsed = PatchExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: existing, error: checkError } = await supabase
    .from("expenses")
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
  if (parsed.data.amount !== undefined) updates.amount = parsed.data.amount;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.customer_id !== undefined) updates.customer_id = parsed.data.customer_id;
  if (parsed.data.date !== undefined) updates.occurred_on = parsed.data.date;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;

  if (Object.keys(updates).length === 0) {
    return Response.json({ updated: true });
  }

  const { error } = await supabase
    .from("expenses")
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
    .from("expenses")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (checkError) return Response.json({ error: checkError.message }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    if (error.code === "23503") {
      return Response.json({ error: "expense is referenced by other records" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ deleted: true });
}
