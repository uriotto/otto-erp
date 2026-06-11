import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";

  const supabase = createServiceClient();
  let query = supabase
    .from("notifications")
    .select("id, title, body, link, severity, read_at, created_at")
    .eq("tenant_id", auth.tenantId)
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error) return Response.json({ error: "internal error" }, { status: 500 });

  return Response.json({ notifications: data ?? [], count: data?.length ?? 0 });
}
