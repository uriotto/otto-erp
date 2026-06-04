import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  hourly_rate: z.number().positive().optional(),
  billing_type: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, email, status")
    .eq("tenant_id", auth.tenantId)
    .order("name");

  if (error) {
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json({ customers: data ?? [] });
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
  const parsed = CreateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: auth.tenantId,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      hourly_rate_override: parsed.data.hourly_rate ?? null,
      billing_model_default: parsed.data.billing_type ?? null,
    })
    .select("id, name")
    .single();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ created: true, customer: data }, { status: 201 });
}
