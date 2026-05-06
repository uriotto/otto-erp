"use client";

import { useState, useTransition } from "react";
import { Sparkles, Bot, Webhook, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { deleteAgent, type ExternalAgent } from "./actions";
import { NewAgentDialog } from "./new-agent-dialog";
import { useToast } from "@/components/ui/toast";

const CONTEXT_LABELS: Record<string, string> = {
  customer: "לקוח",
  project: "פרויקט",
  recording: "תמלול",
  lead: "ליד",
};

function AgentIcon({ icon }: { icon: string }) {
  const size = 18;
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
  agents: ExternalAgent[];
};

export function AgentsList({ agents }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ExternalAgent | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleEdit(agent: ExternalAgent) {
    setEditingAgent(agent);
    setDialogOpen(true);
  }

  function handleNew() {
    setEditingAgent(null);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingAgent(null);
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את הסוכן "${name}"?`)) return;
    startTransition(async () => {
      const result = await deleteAgent(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("הסוכן נמחק");
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-sm text-navy flex items-center gap-2">
            <Sparkles size={22} className="text-navy opacity-70" />
            סוכנים חיצוניים
          </h1>
          <p className="text-ink-soft mt-1 text-sm">
            חיבור סוכני AI חיצוניים לכרטיסי לקוחות, פרויקטים ותמלולים
          </p>
        </div>
        <button
          onClick={handleNew}
          className="bg-navy text-cream-paper flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium"
        >
          <Plus size={15} />
          הוסף סוכן
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="bg-cream-paper border-ink-line flex flex-col items-center justify-center rounded-2xl border py-16 text-center">
          <div className="text-ink-faded mb-4 opacity-40">
            <Sparkles size={40} />
          </div>
          <p className="text-navy mb-1 font-semibold">אין סוכנים עדיין</p>
          <p className="text-ink-soft mb-4 text-sm">הוסף סוכן AI חיצוני כדי לאוטומציה של משימות</p>
          <button
            onClick={handleNew}
            className="bg-navy text-cream-paper flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium"
          >
            <Plus size={14} />
            הוסף סוכן ראשון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-cream-paper border-ink-line flex flex-col rounded-2xl border p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-navy text-cream-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <AgentIcon icon={agent.icon} />
                  </div>
                  <div>
                    <h3 className="text-navy font-semibold">{agent.name}</h3>
                    <div className="mt-0.5 flex items-center gap-1">
                      {agent.is_active ? (
                        <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                          <CheckCircle size={11} /> פעיל
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-xs text-gray-400">
                          <XCircle size={11} /> מושבת
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleEdit(agent)}
                    className="text-ink-faded hover:text-navy rounded-lg p-1.5 transition-colors"
                    title="ערוך"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id, agent.name)}
                    disabled={isPending}
                    className="text-ink-faded rounded-lg p-1.5 transition-colors hover:text-red-500"
                    title="מחק"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {agent.description && (
                <p className="text-ink-soft mb-3 text-sm leading-relaxed">{agent.description}</p>
              )}

              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {agent.trigger_contexts.map((ctx) => (
                  <span
                    key={ctx}
                    className="border-ink-line bg-cream text-ink-soft rounded-lg border px-2 py-0.5 text-xs"
                  >
                    {CONTEXT_LABELS[ctx] ?? ctx}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewAgentDialog open={dialogOpen} onClose={handleClose} agent={editingAgent} />
    </div>
  );
}
