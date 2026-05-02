"use client";

import { useActionState, useEffect, useRef } from "react";
import { Sparkles, Bot, Webhook, X, Plus } from "lucide-react";
import { createAgent, updateAgent, type AgentFormState, type ExternalAgent } from "./actions";

const CONTEXT_OPTIONS = [
  { value: "customer", label: "לקוח" },
  { value: "project", label: "פרויקט" },
  { value: "recording", label: "תמלול" },
  { value: "lead", label: "ליד" },
] as const;

const ICON_OPTIONS = [
  "Sparkles",
  "Bot",
  "Webhook",
  "Zap",
  "Brain",
  "FileText",
  "MessageSquare",
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  agent?: ExternalAgent | null;
};

export function NewAgentDialog({ open, onClose, agent }: Props) {
  const isEdit = !!agent;

  const boundAction = isEdit
    ? updateAgent.bind(null, agent.id)
    : createAgent;

  const [state, dispatch, isPending] = useActionState<AgentFormState, FormData>(
    boundAction,
    {},
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onClose();
    }
  }, [state.success, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-cream-paper border-ink-line relative z-10 w-full max-w-lg rounded-2xl border p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-navy text-cream-paper flex h-8 w-8 items-center justify-center rounded-lg">
              <Sparkles size={16} />
            </div>
            <h2 className="text-navy text-lg font-semibold">
              {isEdit ? "עריכת סוכן" : "סוכן חדש"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {state.error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form ref={formRef} action={dispatch} className="space-y-4">
          {/* שם */}
          <div>
            <label className="text-ink-soft mb-1.5 block text-sm font-medium">
              שם הסוכן <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              defaultValue={agent?.name ?? ""}
              placeholder="לדוגמה: מחולל הצעת מחיר"
              dir="auto"
              className="border-ink-line bg-cream focus:border-navy w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
            />
            {state.fieldErrors?.name && (
              <p className="mt-1 text-xs text-red-500">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          {/* תיאור */}
          <div>
            <label className="text-ink-soft mb-1.5 block text-sm font-medium">תיאור</label>
            <textarea
              name="description"
              defaultValue={agent?.description ?? ""}
              placeholder="מה הסוכן עושה?"
              dir="auto"
              rows={2}
              className="border-ink-line bg-cream focus:border-navy w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
            />
          </div>

          {/* Webhook URL */}
          <div>
            <label className="text-ink-soft mb-1.5 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Webhook size={13} />
                כתובת Webhook <span className="text-red-500">*</span>
              </span>
            </label>
            <input
              name="webhook_url"
              defaultValue={agent?.webhook_url ?? ""}
              placeholder="https://hook.make.com/..."
              dir="ltr"
              className="border-ink-line bg-cream focus:border-navy w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
            />
            {state.fieldErrors?.webhook_url && (
              <p className="mt-1 text-xs text-red-500">{state.fieldErrors.webhook_url[0]}</p>
            )}
          </div>

          {/* הקשרים */}
          <div>
            <label className="text-ink-soft mb-2 block text-sm font-medium">
              הקשרים <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_OPTIONS.map((ctx) => {
                const isChecked = agent?.trigger_contexts.includes(ctx.value) ?? false;
                return (
                  <label
                    key={ctx.value}
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      name="trigger_contexts"
                      value={ctx.value}
                      defaultChecked={isChecked}
                      className="accent-navy"
                    />
                    <span className="text-ink-soft text-sm">{ctx.label}</span>
                  </label>
                );
              })}
            </div>
            {state.fieldErrors?.trigger_contexts && (
              <p className="mt-1 text-xs text-red-500">
                {state.fieldErrors.trigger_contexts[0]}
              </p>
            )}
          </div>

          {/* אייקון */}
          <div>
            <label className="text-ink-soft mb-1.5 block text-sm font-medium">אייקון</label>
            <select
              name="icon"
              defaultValue={agent?.icon ?? "Sparkles"}
              className="border-ink-line bg-cream focus:border-navy w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors"
            >
              {ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>

          {isEdit && (
            <input
              type="hidden"
              name="is_active"
              value={agent?.is_active ? "true" : "false"}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line text-ink-soft hover:border-navy rounded-xl border px-4 py-2 text-sm transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-navy text-cream-paper flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {isPending ? (
                "שומר..."
              ) : (
                <>
                  <Plus size={14} />
                  {isEdit ? "שמור שינויים" : "הוסף סוכן"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// מוצאים את ה-icon component לפי שם — להוספה ב-AgentButton
export function resolveAgentIcon(iconName: string): React.ReactNode {
  const size = 16;
  switch (iconName) {
    case "Bot":
      return <Bot size={size} />;
    case "Webhook":
      return <Webhook size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}
