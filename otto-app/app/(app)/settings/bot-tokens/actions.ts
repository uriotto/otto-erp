"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generatePlaintextToken, hashToken } from "@/lib/bot-auth";
import { createClient } from "@/lib/supabase/server";

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null as null };
  const { data: profile } = await supabase
    .from("users")
    .select("id, tenant_id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

const LabelSchema = z.string().trim().max(60).optional();

export async function createBotToken(
  label: string | undefined,
): Promise<{ error?: string; token?: string }> {
  const parsed = LabelSchema.safeParse(label);
  if (!parsed.success) return { error: "תיוג ארוך מדי" };

  const { supabase, profile } = await getProfile();
  if (!profile) return { error: "לא מחובר" };

  const token = generatePlaintextToken();
  const { error } = await supabase.from("bot_api_tokens").insert({
    user_id: profile.id,
    tenant_id: profile.tenant_id,
    token_hash: hashToken(token),
    label: parsed.data || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/bot-tokens");
  return { token };
}

export async function revokeBotToken(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "מזהה לא תקין" };

  const { supabase, profile } = await getProfile();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("bot_api_tokens")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/bot-tokens");
  return {};
}
