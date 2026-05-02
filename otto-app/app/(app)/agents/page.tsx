import { createClient } from "@/lib/supabase/server";
import { AgentsList } from "./agents-list";
import type { ExternalAgent } from "./actions";

export const metadata = { title: "סוכנים — OTTO" };

export default async function AgentsPage() {
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("external_agents")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <AgentsList agents={(agents ?? []) as ExternalAgent[]} />
    </div>
  );
}
