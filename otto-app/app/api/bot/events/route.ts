import { z } from "zod";

import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const CreateEventSchema = z.object({
  title: z.string().min(1),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  customer_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  meeting_url: z.string().url().optional(),
  all_day: z.boolean().optional(),
});

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

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
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ events: data ?? [], count: data?.length ?? 0 });
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
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      tenant_id: auth.tenantId,
      title: parsed.data.title,
      start_at: parsed.data.start_at,
      end_at: parsed.data.end_at,
      customer_id: parsed.data.customer_id ?? null,
      project_id: parsed.data.project_id ?? null,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      meeting_url: parsed.data.meeting_url ?? null,
      all_day: parsed.data.all_day ?? false,
    })
    .select("id, title, start_at, end_at")
    .single();

  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ created: true, event: data }, { status: 201 });
}
