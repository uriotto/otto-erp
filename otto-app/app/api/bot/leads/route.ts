import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

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
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("leads")
    .select("id, name, phone, email, status, source, notes, company, value, created_at, updated_at")
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (parsed.data.status) query = query.eq("status", parsed.data.status);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ leads: data ?? [], count: data?.length ?? 0 });
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

  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...parsed.data,
      tenant_id: auth.tenantId,
    })
    .select("id, name")
    .single();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ created: true, lead: data }, { status: 201 });
}
