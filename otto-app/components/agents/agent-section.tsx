import { createClient } from "@/lib/supabase/server";
import { AgentButton } from "./agent-button";
import type { ExternalAgent } from "@/app/(app)/agents/actions";

type Props = {
  contextType: string;
  contextId: string;
  contextData?: Record<string, unknown>;
};

export async function AgentSection({ contextType, contextId, contextData = {} }: Props) {
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("external_agents")
    .select("*")
    .eq("is_active", true)
    .contains("trigger_contexts", [contextType])
    .order("created_at");

  if (!agents || agents.length === 0) return null;

  return (
    <div className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-5">
      <p className="text-ink-faded mb-3 text-xs font-medium uppercase">סוכני AI</p>
      <AgentButton
        contextType={contextType}
        contextId={contextId}
        contextData={contextData}
        agents={agents as ExternalAgent[]}
      />
    </div>
  );
}
