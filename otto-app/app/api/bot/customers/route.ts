import { z } from "zod";

import { botScopedClient, guardBotRequest } from "@/lib/bot-auth";

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  hourly_rate: z.number().positive().optional(),
  billing_type: z.string().optional(),
});

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;

  const db = botScopedClient(guard.auth);
  const { data, error } = await db
    .select("customers", "id, name, phone, email, status")
    .order("name");

  if (error) {
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json({ customers: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;

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

  const db = botScopedClient(guard.auth);
  const { data, error } = await db
    .insert("customers", {
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
