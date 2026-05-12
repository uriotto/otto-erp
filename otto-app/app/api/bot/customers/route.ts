import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("tenant_id", auth.tenantId)
    .order("name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ customers: data ?? [] });
}
