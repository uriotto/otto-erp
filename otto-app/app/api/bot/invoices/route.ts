import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const StatusEnum = z.enum([
  "draft",
  "pending_review",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]);

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  let status: z.infer<typeof StatusEnum> | undefined;
  if (statusParam) {
    const parsed = StatusEnum.safeParse(statusParam);
    if (!parsed.success) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }
    status = parsed.data;
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, number, customer_id, status, total_amount, currency, issue_date, due_date, paid_at, document_type",
    )
    .eq("tenant_id", auth.tenantId)
    .order("issue_date", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ invoices: data ?? [], count: data?.length ?? 0 });
}

const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
});

const CreateInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  items: z.array(InvoiceItemSchema).min(1),
  due_date: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { customer_id, items, due_date } = parsed.data;
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createServiceClient();

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: auth.tenantId,
      created_by: auth.userId,
      customer_id,
      status: "draft",
      issue_date: today,
      due_date: due_date ?? null,
      subtotal,
      tax_rate: 18,
      currency: "ILS",
      type: "project",
    })
    .select("id, number")
    .single();

  if (invErr || !invoice) {
    return Response.json({ error: invErr?.message ?? "failed to create invoice" }, { status: 500 });
  }

  const itemRows = items.map((item, index) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    order_index: index,
  }));

  const { error: itemsErr } = await supabase.from("invoice_items").insert(itemRows);
  if (itemsErr) {
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  return Response.json(
    { created: true, invoice: { id: invoice.id, number: invoice.number } },
    { status: 201 },
  );
}
