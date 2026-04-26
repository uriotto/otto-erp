"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, X } from "lucide-react";
import { ACTIVITY_META, ACTIVITY_TYPES, type ActivityType } from "./activity-types";
import { DateTimePicker } from "./datetime-picker";
import { ParentPicker, type ParentSearchItem } from "./parent-picker";
import { createActivity, type ActivityFormState } from "@/app/(app)/activities/actions";
import { quickCreateTask } from "@/app/(app)/tasks/actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const init: ActivityFormState = {};

type ComposerType = ActivityType | "task";

const ALL_COMPOSER_TYPES: ComposerType[] = ["meeting", "call", "email", "whatsapp", "note", "task"];

const TASK_META = {
  label: "משימה",
  icon: CheckSquare,
  color: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function NewActivityDialog({
  customerId,
  leadId,
  parentItems,
  defaultType,
  onClose,
}: {
  customerId?: string;
  leadId?: string;
  parentItems?: ParentSearchItem[];
  defaultType?: ComposerType;
  onClose: () => void;
}) {
  const [type, setType] = useState<ComposerType>(defaultType ?? "meeting");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">
            {type === "task" ? "משימה חדשה" : "פעילות חדשה"}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-micro text-ink-soft mb-2 block uppercase">סוג</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ALL_COMPOSER_TYPES.map((t) => {
              const meta = t === "task" ? TASK_META : ACTIVITY_META[t];
              const Icon = meta.icon;
              const isActive = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`border-ink-line flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs transition-all ${
                    isActive
                      ? "border-navy bg-navy text-cream-paper"
                      : "hover:border-navy/40 bg-white"
                  }`}
                >
                  <Icon size={16} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {type === "task" ? (
          <TaskForm
            customerId={customerId}
            leadId={leadId}
            parentItems={parentItems}
            onClose={onClose}
          />
        ) : (
          <ActivityForm
            type={type}
            customerId={customerId}
            leadId={leadId}
            parentItems={parentItems}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ---------------- Activity form ----------------

function ActivityForm({
  type,
  customerId,
  leadId,
  parentItems,
  onClose,
}: {
  type: ActivityType;
  customerId?: string;
  leadId?: string;
  parentItems?: ParentSearchItem[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createActivity, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("הפעילות נוצרה");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  const showStartEnd = type === "meeting";
  const showSimpleWhen = !showStartEnd;
  const showParentPicker = !customerId && !leadId && parentItems !== undefined;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      {customerId && <input type="hidden" name="customer_id" value={customerId} />}
      {leadId && <input type="hidden" name="lead_id" value={leadId} />}

      {showParentPicker && parentItems && (
        <div>
          <label className="text-micro text-ink-soft mb-2 block uppercase">משויך ל</label>
          <ParentPicker items={parentItems} initial={{ kind: "personal" }} />
        </div>
      )}

      <div>
        <label className="text-micro text-ink-soft mb-1 block uppercase">כותרת *</label>
        <input
          name="title"
          placeholder={titlePlaceholder(type)}
          className="border-ink-line focus:border-navy placeholder:text-ink-faded w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        />
        {state.fieldErrors?.title?.[0] && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      <div>
        <label className="text-micro text-ink-soft mb-1 block uppercase">פרטים</label>
        <textarea
          name="body"
          rows={3}
          placeholder="תיאור / הערות"
          className="border-ink-line focus:border-navy placeholder:text-ink-faded w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        />
      </div>

      {showStartEnd && (
        <>
          <div>
            <label className="text-micro text-ink-soft mb-2 block uppercase">התחלה</label>
            <DateTimePicker name="occurred_at" defaultDaysFromNow={0} defaultTime="14:00" />
          </div>
          <div>
            <label className="text-micro text-ink-soft mb-2 block uppercase">סיום</label>
            <DateTimePicker name="end_at" defaultDaysFromNow={0} defaultTime="15:00" />
          </div>
        </>
      )}

      {showSimpleWhen && (
        <div>
          <label className="text-micro text-ink-soft mb-2 block uppercase">תאריך ושעה</label>
          <DateTimePicker
            name="occurred_at"
            defaultDaysFromNow={0}
            defaultTime={currentRoundedTime()}
          />
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <FormButtons pending={pending} onClose={onClose} />
    </form>
  );
}

// ---------------- Task form ----------------

type DueOption = "today" | "tomorrow" | "this_week" | "none";

const DUE_LABELS: Record<DueOption, string> = {
  today: "היום",
  tomorrow: "מחר",
  this_week: "השבוע",
  none: "ללא תאריך",
};

function dateFor(option: DueOption): string | null {
  if (option === "none") return null;
  const d = new Date();
  if (option === "tomorrow") d.setDate(d.getDate() + 1);
  if (option === "this_week") {
    const dow = d.getDay();
    const offset = (5 - dow + 7) % 7;
    d.setDate(d.getDate() + offset);
  }
  return d.toISOString().slice(0, 10);
}

const PRIORITIES: { value: "low" | "medium" | "high" | "urgent"; label: string }[] = [
  { value: "low", label: "נמוכה" },
  { value: "medium", label: "בינונית" },
  { value: "high", label: "גבוהה" },
  { value: "urgent", label: "דחוף" },
];

function TaskForm({
  customerId,
  leadId,
  parentItems,
  onClose,
}: {
  customerId?: string;
  leadId?: string;
  parentItems?: ParentSearchItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueOption>("today");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [pending, startTransition] = useTransition();
  const [parent, setParent] = useState<{ kind: "customer" | "lead" | "personal"; id?: string }>(
    customerId
      ? { kind: "customer", id: customerId }
      : leadId
        ? { kind: "lead", id: leadId }
        : { kind: "personal" },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;
    startTransition(async () => {
      const res = await quickCreateTask({
        title: title.trim(),
        customer_id: parent.kind === "customer" ? (parent.id ?? null) : null,
        lead_id: parent.kind === "lead" ? (parent.id ?? null) : null,
        priority,
        due_date: dateFor(due),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("המשימה נוצרה");
      onClose();
      router.refresh();
    });
  };

  const showParentPicker = !customerId && !leadId && parentItems !== undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showParentPicker && parentItems && (
        <div>
          <label className="text-micro text-ink-soft mb-2 block uppercase">משויך ל</label>
          <ParentPicker
            items={parentItems}
            initial={{ kind: "personal" }}
            onChange={(p) => setParent(p)}
          />
        </div>
      )}

      <div>
        <label className="text-micro text-ink-soft mb-1 block uppercase">כותרת *</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: לחזור ללקוח עם הצעת מחיר"
          className="border-ink-line focus:border-navy placeholder:text-ink-faded w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        />
      </div>

      <div>
        <label className="text-micro text-ink-soft mb-2 block uppercase">תאריך יעד</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DUE_LABELS) as DueOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setDue(opt)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                due === opt
                  ? "border-navy bg-navy text-cream-paper"
                  : "border-ink-line text-ink-soft hover:border-navy bg-white"
              }`}
            >
              {DUE_LABELS[opt]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-micro text-ink-soft mb-2 block uppercase">עדיפות</label>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                priority === p.value
                  ? "border-navy bg-navy text-cream-paper"
                  : "border-ink-line text-ink-soft hover:border-navy bg-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <FormButtons pending={pending} onClose={onClose} disabled={!title.trim()} />
    </form>
  );
}

// ---------------- Shared ----------------

function FormButtons({
  pending,
  onClose,
  disabled,
}: {
  pending: boolean;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
      >
        ביטול
      </button>
      <button
        type="submit"
        disabled={pending || disabled}
        aria-busy={pending}
        className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <Spinner size={14} />
            <span>שומר</span>
          </span>
        ) : (
          "שמור"
        )}
      </button>
    </div>
  );
}

function titlePlaceholder(type: ActivityType): string {
  switch (type) {
    case "call":
      return "לדוגמה: שיחה ראשונית";
    case "email":
      return "לדוגמה: שלחתי הצעת מחיר";
    case "whatsapp":
      return "לדוגמה: ווטסאפ עם פרטי הפגישה";
    case "meeting":
      return "לדוגמה: פגישת היכרות";
    case "note":
      return "לדוגמה: לקוח חדש מהמלצה";
  }
}

function currentRoundedTime(): string {
  const d = new Date();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes() < 30 ? "00" : "30";
  return `${hours}:${minutes}`;
}
