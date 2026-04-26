"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function sanitizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const clean = raw.trim();
    if (!clean) continue;
    if (clean.length > 64) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

export async function updateCustomerTags(
  customerId: string,
  tags: string[],
): Promise<{ error?: string }> {
  if (!customerId) return { error: "מזהה לקוח חסר" };
  const clean = sanitizeTags(tags);
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ tags: clean }).eq("id", customerId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return {};
}

export async function updateLeadTags(leadId: string, tags: string[]): Promise<{ error?: string }> {
  if (!leadId) return { error: "מזהה ליד חסר" };
  const clean = sanitizeTags(tags);
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ tags: clean }).eq("id", leadId);
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}
