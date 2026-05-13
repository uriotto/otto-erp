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
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ invoices: data ?? [], count: data?.length ?? 0 });
}
