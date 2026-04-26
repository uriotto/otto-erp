import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Fires a Make.com webhook for tenant-scoped automations.
 * Reads the webhook URL from `tenant_settings.make_webhook_url`.
 * Uses service-role admin if available, otherwise falls back to the user's
 * authenticated server client (works inside server actions / route handlers).
 * Errors are swallowed (logged) so they never break the calling action.
 */
export async function fireMakeWebhook(
  tenantId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const reader =
      url && serviceKey
        ? createSupabaseClient<Database>(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : await createClient();

    const { data: settings, error } = await reader
      .from("tenant_settings")
      .select("make_webhook_url")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      console.error("[make-webhook] settings fetch failed", error);
      return;
    }

    const webhookUrl = settings?.make_webhook_url ?? null;
    if (!webhookUrl) {
      console.info("[make-webhook] no webhook URL configured for tenant", tenantId);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          payload,
          tenant_id: tenantId,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.error("[make-webhook] non-2xx response", res.status, await res.text());
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[make-webhook] failed", err);
  }
}
