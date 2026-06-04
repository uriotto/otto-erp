import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  customer_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    customer_id: url.searchParams.get("customer_id") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("time_entries")
    .select("id, customer_id, start_time, end_time, duration_minutes, notes, billable")
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.userId)
    .order("start_time", { ascending: false })
    .limit(200);

  if (parsed.data.from) query = query.gte("start_time", parsed.data.from);
  if (parsed.data.to) query = query.lte("start_time", parsed.data.to);
  if (parsed.data.customer_id) query = query.eq("customer_id", parsed.data.customer_id);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  const totalMinutes = (data ?? []).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  return Response.json({
    time_entries: data ?? [],
    total_minutes: totalMinutes,
    count: data?.length ?? 0,
  });
}
