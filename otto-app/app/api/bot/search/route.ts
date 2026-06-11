import { botScopedClient, guardBotRequest } from "@/lib/bot-auth";

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.length < 2) {
    return Response.json({ error: "q must be at least 2 characters" }, { status: 400 });
  }

  const pattern = `%${q}%`;
  const db = botScopedClient(guard.auth);

  const [customers, leads, invoices, tasks, events] = await Promise.all([
    db.select("customers", "id, name").ilike("name", pattern).limit(5),
    db.select("leads", "id, name, status").ilike("name", pattern).limit(5),
    db.select("invoices", "id, number, status, total_amount").ilike("number", pattern).limit(5),
    db.select("tasks", "id, title, status").ilike("title", pattern).limit(5),
    db.select("events", "id, title, start_at").ilike("title", pattern).limit(5),
  ]);

  return Response.json({
    customers: customers.data ?? [],
    leads: leads.data ?? [],
    invoices: invoices.data ?? [],
    tasks: tasks.data ?? [],
    events: events.data ?? [],
  });
}
