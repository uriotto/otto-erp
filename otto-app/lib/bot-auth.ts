import { createHash, randomBytes } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";

export interface BotAuthContext {
  userId: string;
  tenantId: string;
  tokenId: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePlaintextToken(): string {
  // 32 bytes => 64 hex chars. Prefix makes it easy to spot in logs.
  return `otto_bot_${randomBytes(32).toString("hex")}`;
}

export async function authenticateBot(request: Request): Promise<BotAuthContext | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("bot_api_tokens")
    .select("id, user_id, tenant_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;

  // Best-effort last_used_at bump - don't block on it
  void supabase
    .from("bot_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, tenantId: data.tenant_id, tokenId: data.id };
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
