import { z } from "zod";

import { authenticateBot, unauthorized } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";

const PatchInvoiceSchema = z.object({
  status: z
    .enum(["draft", "pending_review", "sent", "partial", "paid", "overdue", "cancelled"])
    .optional(),
  finbot_invoice_id: z.string().optional(),
  finbot_url: z.string().optional(),
  number: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBot(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = PatchInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: existing, error: findErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (findErr) return Response.json({ error: findErr.message }, { status: 500 });
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  type InvoiceStatus =
    | "draft"
    | "pending_review"
    | "sent"
    | "partial"
    | "paid"
    | "overdue"
    | "cancelled";
  const updates: {
    status?: InvoiceStatus;
    finbot_invoice_id?: string;
    finbot_url?: string;
    number?: string;
    paid_at?: string;
  } = { ...parsed.data };
  if (parsed.data.status === "paid") {
    updates.paid_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  return Response.json({ updated: true });
}
