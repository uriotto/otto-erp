"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Bot, Webhook, ChevronDown, Loader2, X } from "lucide-react";
import { invokeAgent, getInvocationResult } from "@/app/(app)/agents/actions";
import { useToast } from "@/components/ui/toast";
import type { ExternalAgent } from "@/app/(app)/agents/actions";

function AgentIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  switch (icon) {
    case "Bot":
      return <Bot size={size} />;
    case "Webhook":
      return <Webhook size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}

type Props = {
  contextType: string;
  contextId: string;
  contextData?: Record<string, unknown>;
  agents: ExternalAgent[];
};

type InvocationState =
  | { status: "idle" }
  | { status: "running"; agentName: string }
  | { status: "done"; agentName: string; result: string }
  | { status: "error"; agentName: string; message: string };

export function AgentButton({ contextType, contextId, contextData = {}, agents }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [invState, setInvState] = useState<InvocationState>({ status: "idle" });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const relevantAgents = agents.filter(
    (a) => a.is_active && a.trigger_contexts.includes(contextType),
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (relevantAgents.length === 0) return null;

  async function handleInvoke(agent: ExternalAgent) {
    setDropdownOpen(false);
    setInvState({ status: "running", agentName: agent.name });

    const result = await invokeAgent(agent.id, contextType, contextId, {
      ...contextData,
      context_type: contextType,
      context_id: contextId,
    });

    if (result.error) {
      setInvState({ status: "error", agentName: agent.name, message: result.error });
      toast.error(`שגיאה: ${result.error}`);
      return;
    }

    if (!result.invocationId) {
      setInvState({ status: "error", agentName: agent.name, message: "שגיאה לא ידועה" });
      return;
    }

    // polling לתוצאה
    let attempts = 0;
    const maxAttempts = 20;
    const pollInterval = 1500;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setInvState({
          status: "error",
          agentName: agent.name,
          message: "הסוכן לא הגיב בזמן",
        });
        return;
      }
      attempts++;

      const data = await getInvocationResult(result.invocationId!);
      if (!data) {
        setInvState({ status: "error", agentName: agent.name, message: "invocation לא נמצא" });
        return;
      }

      if (data.status === "completed") {
        setInvState({
          status: "done",
          agentName: agent.name,
          result: data.result_html ?? "הסוכן סיים ללא תוצאה",
        });
      } else if (data.status === "failed") {
        setInvState({
          status: "error",
          agentName: agent.name,
          message: data.error ?? "הסוכן נכשל",
        });
        toast.error(data.error ?? "הסוכן נכשל");
      } else {
        await new Promise((r) => setTimeout(r, pollInterval));
        await poll();
      }
    };

    await poll();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* כפתור */}
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        disabled={invState.status === "running"}
        className="border-ink-line text-ink-soft hover:border-navy hover:text-navy flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm transition-colors disabled:opacity-60"
      >
        {invState.status === "running" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
        <span>
          {invState.status === "running" ? `מריץ: ${invState.agentName}...` : "הפעל סוכן"}
        </span>
        {invState.status !== "running" && <ChevronDown size={13} />}
      </button>

      {/* dropdown */}
      {dropdownOpen && (
        <div className="border-ink-line absolute start-0 top-full z-50 mt-1 min-w-48 rounded-xl border bg-white shadow-lg">
          {relevantAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleInvoke(agent)}
              className="text-ink-soft hover:bg-cream flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="text-navy">
                <AgentIcon icon={agent.icon} />
              </span>
              <div>
                <p className="text-navy font-medium">{agent.name}</p>
                {agent.description && (
                  <p className="text-ink-faded text-xs">{agent.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* תוצאה */}
      {invState.status === "done" && (
        <div className="border-ink-line mt-3 rounded-xl border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-ink-soft flex items-center gap-1.5 text-xs">
              <Sparkles size={12} />
              תוצאה: {invState.agentName}
            </span>
            <button
              onClick={() => setInvState({ status: "idle" })}
              className="text-ink-faded hover:text-navy rounded p-0.5"
            >
              <X size={13} />
            </button>
          </div>
          <div
            className="text-navy prose-sm max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: invState.result }}
          />
        </div>
      )}

      {invState.status === "error" && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <span>{invState.message}</span>
          <button
            onClick={() => setInvState({ status: "idle" })}
            className="ms-2 opacity-70 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
