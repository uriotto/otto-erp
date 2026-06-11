import { z } from "zod";

import { botScopedClient, guardBotRequest } from "@/lib/bot-auth";

const QuerySchema = z.object({
  status: z.string().optional(),
});

const CreateLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  value: z.number().optional(),
  company: z.string().optional(),
});

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }

  const db = botScopedClient(guard.auth);
  let query = db
    .select(
      "leads",
      "id, name, phone, email, status, source, notes, company, value, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (parsed.data.status) query = query.eq("status", parsed.data.status);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ leads: data ?? [], count: data?.length ?? 0 });
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

  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = botScopedClient(guard.auth);
  const { data, error } = await db.insert("leads", parsed.data).select("id, name").single();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ created: true, lead: data }, { status: 201 });
}
