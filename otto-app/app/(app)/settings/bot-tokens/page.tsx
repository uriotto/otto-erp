import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { BotTokensCard } from "./bot-tokens-card";

export const metadata = { title: "טוקני בוט — OTTO" };

export default async function BotTokensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("bot_api_tokens")
    .select("id, label, last_used_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-micro text-ink-faded mb-2 uppercase">הגדרות</p>
        <h1 className="text-display-md text-navy">טוקני בוט</h1>
        <p className="text-ink-soft mt-1 text-sm">
          טוקנים לשימוש של בוטים חיצוניים (כמו טלגרם) שמתחברים ל-API של OTTO
        </p>
      </div>

      <BotTokensCard tokens={tokens ?? []} />
    </div>
  );
}
