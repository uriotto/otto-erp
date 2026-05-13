import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid query" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("events")
    .select(
      "id, title, description, start_at, end_at, all_day, location, meeting_url, customer_id, project_id, type",
    )
    .eq("tenant_id", auth.tenantId)
    .order("start_at", { ascending: true })
    .limit(100);

  if (parsed.data.from) query = query.gte("start_at", parsed.data.from);
  if (parsed.data.to) query = query.lte("start_at", parsed.data.to);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ events: data ?? [], count: data?.length ?? 0 });
}
