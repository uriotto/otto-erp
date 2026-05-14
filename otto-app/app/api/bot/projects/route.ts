import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const QuerySchema = z.object({
  customer_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  customer_id: z.string().uuid().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  budget: z.number().optional(),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    customer_id: url.searchParams.get("customer_id") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("projects")
    .select(
      "id, name, status, customer_id, description, budget, due_date, start_date, health, phase, created_at, updated_at",
    )
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (parsed.data.customer_id) query = query.eq("customer_id", parsed.data.customer_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (parsed.data.status) query = query.eq("status", parsed.data.status as any);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ projects: data ?? [], count: data?.length ?? 0 });
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

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...(parsed.data as any), tenant_id: auth.tenantId, created_by: auth.userId })
    .select("id, name")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ created: true, project: data }, { status: 201 });
}
