import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const CreateContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  customer_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id");

  const supabase = createServiceClient();
  let query = supabase
    .from("contacts")
    .select("id, name, role, email, phone, notes, customer_id, created_at, updated_at")
    .eq("tenant_id", auth.tenantId)
    .order("name");

  if (customerId) query = query.eq("customer_id", customerId);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ contacts: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = CreateContactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  if (parsed.data.customer_id) {
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customer_id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (custErr) return Response.json({ error: "internal error" }, { status: 500 });
    if (!customer) return Response.json({ error: "customer not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      tenant_id: auth.tenantId,
      name: parsed.data.name,
      role: parsed.data.role ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
      customer_id: parsed.data.customer_id ?? null,
    })
    .select("id, name, role, email, phone, customer_id")
    .single();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ created: true, contact: data }, { status: 201 });
}
