import { z } from "zod";

import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const GetQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  customer_id: z.string().uuid().optional(),
});

const CreateExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  customer_id: z.string().uuid().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
});

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

  const url = new URL(request.url);
  const parsed = GetQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    customer_id: url.searchParams.get("customer_id") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("expenses")
    .select(
      "id, amount, description, customer_id, occurred_on, category, currency, invoiced, reimbursable",
    )
    .eq("tenant_id", auth.tenantId)
    .order("occurred_on", { ascending: false })
    .limit(50);

  if (parsed.data.from) query = query.gte("occurred_on", parsed.data.from);
  if (parsed.data.to) query = query.lte("occurred_on", parsed.data.to);
  if (parsed.data.customer_id) query = query.eq("customer_id", parsed.data.customer_id);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  const total_amount = (data ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0);
  return Response.json({ expenses: data ?? [], total_amount, count: data?.length ?? 0 });
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

  const parsed = CreateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amount, description, customer_id, date, category } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createServiceClient();
  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      tenant_id: auth.tenantId,
      created_by: auth.userId,
      amount,
      description,
      customer_id: customer_id ?? null,
      occurred_on: date ?? today,
      category: category ?? "general",
      currency: "ILS",
    })
    .select("id, amount")
    .single();

  if (error || !expense) {
    return Response.json({ error: error?.message ?? "failed to create expense" }, { status: 500 });
  }

  return Response.json(
    { created: true, expense: { id: expense.id, amount: expense.amount } },
    { status: 201 },
  );
}
