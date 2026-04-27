"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const EmailSchema = z.object({
  email: z.string().email("כתובת מייל לא תקינה"),
});

export type LoginState = {
  ok: boolean;
  message: string;
} | null;

export async function signInWithEmail(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = EmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "שגיאה בקלט" };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { ok: false, message: `שליחת הקישור נכשלה: ${error.message}` };
  }

  return { ok: true, message: "שלחנו לך קישור התחברות. בדוק את המייל." };
}

export async function signInWithGoogle(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) return { error: error.message };
  return { url: data.url };
}
