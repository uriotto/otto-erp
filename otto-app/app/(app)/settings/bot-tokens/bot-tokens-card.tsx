"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, Trash2, KeyRound } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

import { createBotToken, revokeBotToken } from "./actions";

type TokenRow = {
  id: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
};

function formatDate(value: string | null): string {
  if (!value) return "לא בשימוש";
  return new Date(value).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BotTokensCard({ tokens }: { tokens: TokenRow[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createBotToken(label.trim() || undefined);
      if (res.error || !res.token) {
        toast.error(res.error ?? "שגיאה ביצירה");
        return;
      }
      setNewToken(res.token);
      setLabel("");
    });
  };

  const handleCopy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      toast.success("הועתק");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  };

  const handleRevoke = (id: string) => {
    if (!confirm("לבטל את הטוקן? בוטים שמשתמשים בו יפסיקו לעבוד מיד.")) return;
    startTransition(async () => {
      const res = await revokeBotToken(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("הטוקן בוטל");
    });
  };

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <div className="mb-5 flex items-center gap-2">
        <KeyRound size={18} className="text-navy" />
        <h2 className="text-display-sm text-navy">טוקנים פעילים</h2>
      </div>

      {newToken && (
        <div className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">הטוקן נוצר - העתק/י עכשיו</p>
          <p className="mt-1 text-xs text-emerald-800">
            לא תוכל/י לראות אותו שוב. אם איבדת אותו - בטל וצור חדש.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code
              dir="ltr"
              className="flex-1 overflow-x-auto rounded border border-emerald-300 bg-white px-3 py-2 font-mono text-xs"
            >
              {newToken}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              <Copy size={13} />
              העתק
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewToken(null)}
            className="mt-3 text-xs text-emerald-800 underline"
          >
            סגור
          </button>
        </div>
      )}

      <div className="mb-5">
        <label className="text-navy mb-1 block text-sm font-semibold">תיוג (אופציונלי)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="לדוגמה: Telegram Bot"
            maxLength={60}
            className="border-ink-line focus:border-navy text-navy placeholder:text-ink-faded flex-1 rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Spinner size={14} /> : <Plus size={14} />}
            צור טוקן
          </button>
        </div>
      </div>

      {tokens.length === 0 ? (
        <p className="text-ink-faded text-sm">אין טוקנים פעילים.</p>
      ) : (
        <ul className="divide-ink-line divide-y">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-navy text-sm font-semibold">{t.label || "ללא תיוג"}</p>
                <p className="text-ink-faded text-xs">
                  נוצר {formatDate(t.created_at)} · שימוש אחרון {formatDate(t.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(t.id)}
                disabled={pending}
                aria-label="בטל טוקן"
                className="text-ink-faded rounded-lg p-2 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
