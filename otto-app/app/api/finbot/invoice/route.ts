import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  finbot_invoice_id: z.string().min(1),
  finbot_url: z.string().url().optional().nullable(),
  number: z.string().min(1).optional().nullable(),
  status: z.enum(["draft", "sent", "paid", "cancelled"]).optional().nullable(),
});

function unauthorized(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 });
}

export async function POST(req: Request) {
  const expected = process.env.MAKE_INBOUND_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== expected) return unauthorized("invalid token");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "supabase env missing" }, { status: 500 });
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const update: {
    finbot_invoice_id: string;
    finbot_url?: string | null;
    number?: string | null;
    status?: "draft" | "sent" | "paid" | "cancelled";
  } = { finbot_invoice_id: parsed.data.finbot_invoice_id };

  if (parsed.data.finbot_url !== undefined) update.finbot_url = parsed.data.finbot_url;
  if (parsed.data.number) update.number = parsed.data.number;
  if (parsed.data.status) update.status = parsed.data.status;

  const { error } = await admin
    .from("invoices")
    .update(update)
    .eq("id", parsed.data.invoice_id)
    .eq("tenant_id", parsed.data.tenant_id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
