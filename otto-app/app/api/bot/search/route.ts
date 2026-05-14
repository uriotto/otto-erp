import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.length < 2) {
    return Response.json({ error: "q must be at least 2 characters" }, { status: 400 });
  }

  const pattern = `%${q}%`;
  const supabase = createServiceClient();

  const [customers, leads, invoices, tasks, events] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("tenant_id", auth.tenantId)
      .ilike("name", pattern)
      .limit(5),

    supabase
      .from("leads")
      .select("id, name, status")
      .eq("tenant_id", auth.tenantId)
      .ilike("name", pattern)
      .limit(5),

    supabase
      .from("invoices")
      .select("id, number, status, total_amount")
      .eq("tenant_id", auth.tenantId)
      .ilike("number", pattern)
      .limit(5),

    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("tenant_id", auth.tenantId)
      .ilike("title", pattern)
      .limit(5),

    supabase
      .from("events")
      .select("id, title, start_at")
      .eq("tenant_id", auth.tenantId)
      .ilike("title", pattern)
      .limit(5),
  ]);

  return Response.json({
    customers: customers.data ?? [],
    leads: leads.data ?? [],
    invoices: invoices.data ?? [],
    tasks: tasks.data ?? [],
    events: events.data ?? [],
  });
}
