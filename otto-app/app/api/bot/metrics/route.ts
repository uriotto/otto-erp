import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getBusinessSnapshot } from "@/lib/business-metrics";

/**
 * GET /api/bot/metrics
 * Returns the "מצב העסק" snapshot (effective rate, hours, MRR, payments,
 * open invoices, pipeline) for the morning brief and the Telegram bot.
 */
export async function GET(request: Request) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const supabase = createServiceClient();

  try {
    const snapshot = await getBusinessSnapshot(supabase, { tenantId: auth.tenantId });
    return Response.json({ metrics: snapshot });
  } catch (err) {
    // Log detail server-side; return a generic message so internal table/column
    // names never reach the vault file the snapshot script writes.
    console.error("[bot/metrics] failed to compute snapshot:", err);
    return Response.json({ error: "failed to compute metrics" }, { status: 500 });
  }
}
