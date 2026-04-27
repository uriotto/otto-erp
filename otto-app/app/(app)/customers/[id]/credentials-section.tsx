"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Eye, EyeOff, Copy, Pencil, Trash2, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  addCredential,
  updateCredential,
  deleteCredential,
  revealSecret,
} from "./credentials-actions";

type Credential = {
  id: string;
  label: string;
  credential_type: string;
  username: string | null;
  url: string | null;
  notes: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  password: "סיסמה",
  api_key: "API Key",
  oauth: "OAuth",
  ssh: "SSH",
  other: "אחר",
};

const TYPE_STYLES: Record<string, string> = {
  password: "bg-blue-50 text-blue-700 border-blue-200",
  api_key: "bg-purple-50 text-purple-700 border-purple-200",
  oauth: "bg-orange-50 text-orange-700 border-orange-200",
  ssh: "bg-emerald-50 text-emerald-700 border-emerald-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

function CredentialForm({
  customerId,
  initial,
  onDone,
}: {
  customerId: string;
  initial?: Credential;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = initial
        ? await updateCredential(initial.id, customerId, fd)
        : await addCredential(customerId, fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(initial ? "עודכן" : "נוסף");
        onDone();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-ink-line bg-cream space-y-3 rounded-xl border border-dashed p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-ink-faded mb-1 block text-[11px] uppercase">תווית *</label>
          <input
            name="label"
            required
            defaultValue={initial?.label}
            placeholder='למשל "WordPress Admin"'
            className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-ink-faded mb-1 block text-[11px] uppercase">סוג</label>
          <select
            name="credential_type"
            defaultValue={initial?.credential_type ?? "password"}
            className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-ink-faded mb-1 block text-[11px] uppercase">שם משתמש / מזהה</label>
          <input
            name="username"
            defaultValue={initial?.username ?? ""}
            className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-ink-faded mb-1 block text-[11px] uppercase">
            {initial ? "סיסמה / מפתח (השאר ריק לשמור הישן)" : "סיסמה / מפתח"}
          </label>
          <input
            name="secret"
            type="password"
            autoComplete="new-password"
            className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-ink-faded mb-1 block text-[11px] uppercase">כתובת URL</label>
        <input
          name="url"
          type="url"
          defaultValue={initial?.url ?? ""}
          placeholder="https://"
          className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
          dir="ltr"
        />
      </div>

      <div>
        <label className="text-ink-faded mb-1 block text-[11px] uppercase">הערות</label>
        <input
          name="notes"
          defaultValue={initial?.notes ?? ""}
          className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="border-ink-line text-navy hover:border-navy rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-navy text-cream-paper rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "שומר…" : "שמור"}
        </button>
      </div>
    </form>
  );
}

function RevealButton({ id }: { id: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleReveal() {
    if (secret !== null) {
      setShown((s) => !s);
      return;
    }
    startTransition(async () => {
      const res = await revealSecret(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSecret(res.secret ?? "");
      setShown(true);
    });
  }

  async function handleCopy() {
    const val = secret ?? "";
    if (!val) return;
    await navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1">
      {shown && secret !== null && (
        <span className="text-navy font-mono text-xs" dir="ltr">
          {secret}
        </span>
      )}
      <button
        type="button"
        onClick={handleReveal}
        disabled={pending}
        title={shown ? "הסתר" : "הצג"}
        className="text-ink-faded hover:text-navy rounded p-0.5 transition-colors disabled:opacity-40"
      >
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      {secret !== null && (
        <button
          type="button"
          onClick={handleCopy}
          title="העתק"
          className="text-ink-faded hover:text-navy rounded p-0.5 transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );
}

export function CustomerCredentialsSection({
  customerId,
  credentials,
}: {
  customerId: string;
  credentials: Credential[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleDelete(id: string) {
    if (!confirm("למחוק את הפרטים האלה?")) return;
    startTransition(async () => {
      const res = await deleteCredential(id, customerId);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="bg-cream-paper border-ink-line mt-6 rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-ink-soft" />
          <h2 className="text-navy text-sm font-semibold">סיסמאות ומפתחות</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
          }}
          className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          <Plus size={13} />
          הוסף
        </button>
      </div>

      {showAdd && (
        <div className="mb-3">
          <CredentialForm
            customerId={customerId}
            onDone={() => {
              setShowAdd(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {credentials.length === 0 && !showAdd ? (
        <p className="text-ink-faded py-4 text-center text-xs">אין פרטי גישה עדיין</p>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {credentials.map((cred) => (
            <li key={cred.id} className="group py-3">
              {editingId === cred.id ? (
                <CredentialForm
                  customerId={customerId}
                  initial={cred}
                  onDone={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-navy text-sm font-medium">{cred.label}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLES[cred.credential_type] ?? TYPE_STYLES.other}`}
                      >
                        {TYPE_LABELS[cred.credential_type] ?? cred.credential_type}
                      </span>
                    </div>
                    {cred.username && (
                      <p className="text-ink-soft mt-0.5 font-mono text-xs" dir="ltr">
                        {cred.username}
                      </p>
                    )}
                    {cred.url && (
                      <a
                        href={cred.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-faded hover:text-navy mt-0.5 block truncate text-xs"
                        dir="ltr"
                      >
                        {cred.url}
                      </a>
                    )}
                    {cred.notes && <p className="text-ink-faded mt-0.5 text-xs">{cred.notes}</p>}
                    <div className="mt-1">
                      <RevealButton id={cred.id} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingId(cred.id)}
                      className="text-ink-faded hover:text-navy rounded p-1 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cred.id)}
                      disabled={pending}
                      className="text-ink-faded rounded p-1 transition-colors hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
