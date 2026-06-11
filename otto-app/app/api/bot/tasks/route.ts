import { z } from "zod";

import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const QuerySchema = z.object({
  customer_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  customer_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  priority: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

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
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, due_at, customer_id, project_id, description, created_at, updated_at",
    )
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (parsed.data.customer_id) query = query.eq("customer_id", parsed.data.customer_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (parsed.data.status) query = query.eq("status", parsed.data.status as any);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ tasks: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tasks")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...(parsed.data as any), tenant_id: auth.tenantId, created_by: auth.userId })
    .select("id, title")
    .single();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ created: true, task: data }, { status: 201 });
}
