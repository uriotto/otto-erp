"use server";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function readClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export type SignResult = { ok: true } | { ok: false; error: string };

export async function signProposal(
  token: string,
  signerName: string,
  signerEmail: string,
  signatureData: string,
  selectedModuleIds: string[],
): Promise<SignResult> {
  if (!signerName.trim()) return { ok: false, error: "שם חובה" };
  if (!signerEmail.trim()) return { ok: false, error: "אימייל חובה" };
  if (!signatureData) return { ok: false, error: "חתימה חובה" };

  const supabase = serviceClient();

  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("id, status, valid_until, modules, tenant_id")
    .eq("public_token", token)
    .single();

  if (fetchError || !quote) return { ok: false, error: "הצעת המחיר לא נמצאה" };
  if (quote.status === "signed") return { ok: false, error: "הצעה זו כבר נחתמה" };
  if (quote.status === "rejected") return { ok: false, error: "הצעה זו נדחתה" };
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    return { ok: false, error: "תוקף ההצעה פג" };
  }

  const modules = Array.isArray(quote.modules) ? quote.modules : [];
  const finalModules = (modules as ProposalModule[]).map((m) => ({
    ...m,
    selected: m.optional ? selectedModuleIds.includes(m.id) : true,
  }));

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signature_data: signatureData,
      signer_name: signerName.trim(),
      signer_email: signerEmail.trim(),
      modules:
        finalModules as unknown as Database["public"]["Tables"]["quotes"]["Update"]["modules"],
    })
    .eq("id", quote.id);

  if (updateError) return { ok: false, error: updateError.message };

  // Notify admin
  await supabase.from("notifications").insert({
    tenant_id: quote.tenant_id,
    title: "הצעת מחיר נחתמה",
    body: `${signerName} חתם על הצעה`,
    severity: "success",
    link: `/quotes`,
  });

  return { ok: true };
}

export type ProposalModule = {
  id: string;
  name: string;
  description: string;
  price: number;
  optional: boolean;
};

export async function getProposalByToken(token: string) {
  const supabase = readClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, title, notes, amount, modules, status, valid_until, signed_at, signer_name, customers(name, company)",
    )
    .eq("public_token", token)
    .single();

  if (error || !data) return null;
  return data;
}
