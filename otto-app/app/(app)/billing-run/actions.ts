"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { issueDocumentForInvoice } from "@/lib/finbot";
import { todayIL } from "@/lib/dates";

const RetainerSchema = z.object({
  customer_id: z.string().uuid(),
  month_label: z.string().min(1).max(60),
  document_type: z.enum(["payment_request", "tax_invoice"]).default("payment_request"),
});

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

/**
 * Issues the fixed monthly retainer invoice for a customer and produces the
 * document in Finbot. Used from the billing-run screen (explicit, per-customer).
 */
export async function issueRetainerInvoice(input: {
  customer_id: string;
  month_label: string;
  document_type?: "payment_request" | "tax_invoice";
}): Promise<{ error?: string; invoiceId?: string; finbotError?: string }> {
  const parsed = RetainerSchema.safeParse(input);
  if (!parsed.success) return { error: "קלט לא תקין" };

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, retainer_monthly_amount")
    .eq("id", parsed.data.customer_id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!customer) return { error: "לקוח לא נמצא" };
  const amount = Number(customer.retainer_monthly_amount);
  if (!(amount > 0)) return { error: "ללקוח אין סכום ריטיינר מוגדר" };

  // Avoid double billing: one retainer invoice per customer per month label.
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("tenant_id", profile.tenant_id)
    .eq("customer_id", customer.id)
    .eq("type", "monthly_hours")
    .ilike("notes", `%ריטיינר חודשי — ${parsed.data.month_label}%`)
    .neq("status", "cancelled")
    .limit(1);

  if (existing && existing.length > 0) {
    return { error: `כבר קיימת חשבונית ריטיינר ל${parsed.data.month_label} ללקוח זה` };
  }

  const today = todayIL();
  const due = new Date();
  due.setDate(due.getDate() + 14);

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      created_by: profile.id,
      customer_id: customer.id,
      type: "monthly_hours",
      document_type: parsed.data.document_type,
      status: "draft",
      issue_date: today,
      due_date: due.toISOString().slice(0, 10),
      subtotal: amount,
      tax_rate: 18,
      currency: "ILS",
      notes: `ריטיינר חודשי — ${parsed.data.month_label}`,
    })
    .select("id")
    .single();

  if (invErr || !invoice) return { error: invErr?.message ?? "שגיאה ביצירת חשבונית" };

  const { error: itemErr } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: `ריטיינר חודשי — ${parsed.data.month_label}`,
    quantity: 1,
    unit_price: amount,
    order_index: 0,
  });

  if (itemErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: itemErr.message };
  }

  const finbot = await issueDocumentForInvoice(supabase, profile.tenant_id, invoice.id);

  revalidatePath("/billing-run");
  revalidatePath("/invoices");
  return { invoiceId: invoice.id, finbotError: finbot.ok ? undefined : finbot.error };
}
