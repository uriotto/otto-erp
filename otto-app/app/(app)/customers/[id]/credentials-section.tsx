"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Eye, EyeOff, Copy, Pencil, Trash2, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  type CredentialField,
  addCredential,
  updateCredential,
  deleteCredential,
  revealFields,
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

const TYPE_DEFAULTS: Record<string, CredentialField[]> = {
  password: [{ key: "password", value: "", hidden: true }],
  api_key: [{ key: "api_key", value: "", hidden: true }],
  oauth: [
    { key: "client_id", value: "", hidden: false },
    { key: "client_secret", value: "", hidden: true },
    { key: "access_token", value: "", hidden: true },
    { key: "refresh_token", value: "", hidden: true },
  ],
  ssh: [
    { key: "host", value: "", hidden: false },
    { key: "username", value: "", hidden: false },
    { key: "private_key", value: "", hidden: true },
  ],
  other: [{ key: "value", value: "", hidden: true }],
};

function FieldEditor({
  fields,
  onChange,
}: {
  fields: CredentialField[];
  onChange: (fields: CredentialField[]) => void;
}) {
  function updateField(i: number, patch: Partial<CredentialField>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeField(i: number) {
    onChange(fields.filter((_, idx) => idx !== i));
  }
  function addField() {
    onChange([...fields, { key: "", value: "", hidden: false }]);
  }

  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={f.key}
            onChange={(e) => updateField(i, { key: e.target.value })}
            placeholder="שם שדה"
            className="border-ink-line bg-cream-paper text-navy w-28 shrink-0 rounded-lg border px-2 py-1.5 font-mono text-xs"
            dir="ltr"
          />
          <input
            value={f.value}
            onChange={(e) => updateField(i, { value: e.target.value })}
            type={f.hidden ? "password" : "text"}
            placeholder="ערך"
            autoComplete="new-password"
            className="border-ink-line bg-cream-paper text-navy min-w-0 flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => updateField(i, { hidden: !f.hidden })}
            title={f.hidden ? "הצג" : "הסתר"}
            className="text-ink-faded hover:text-navy shrink-0 rounded p-1 transition-colors"
          >
            {f.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            type="button"
            onClick={() => removeField(i)}
            className="text-ink-faded shrink-0 rounded p-1 transition-colors hover:text-rose-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addField}
        className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors"
      >
        <Plus size={12} />
        הוסף שדה
      </button>
    </div>
  );
}

function CredentialForm({
  customerId,
  initial,
  initialFields,
  onDone,
}: {
  customerId: string;
  initial?: Credential;
  initialFields?: CredentialField[];
  onDone: () => void;
}) {
  const [type, setType] = useState(initial?.credential_type ?? "password");
  const [fields, setFields] = useState<CredentialField[]>(
    initialFields ?? TYPE_DEFAULTS[initial?.credential_type ?? "password"] ?? [],
  );
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleTypeChange(newType: string) {
    setType(newType);
    if (!initial) setFields(TYPE_DEFAULTS[newType] ?? [{ key: "value", value: "", hidden: true }]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("fields", JSON.stringify(fields));
    startTransition(async () => {
      const res = initial
        ? await updateCredential(initial.id, customerId, fd)
        : await addCredential(customerId, fd);
      if (res.error) toast.error(res.error);
      else {
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
            placeholder='למשל "Google OAuth"'
            className="border-ink-line text-navy bg-cream-paper w-full rounded-lg border px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-ink-faded mb-1 block text-[11px] uppercase">סוג</label>
          <select
            name="credential_type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
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

      <div>
        <label className="text-ink-faded mb-1.5 block text-[11px] uppercase">שדות</label>
        <FieldEditor fields={fields} onChange={setFields} />
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

function RevealedFields({ id, customerId }: { id: string; customerId: string }) {
  const [fields, setFields] = useState<CredentialField[] | null>(null);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleLoad() {
    if (fields !== null) {
      setFields(null);
      setShown({});
      return;
    }
    startTransition(async () => {
      const res = await revealFields(id, customerId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setFields(res.fields ?? []);
    });
  }

  async function handleCopy(value: string, i: number) {
    await navigator.clipboard.writeText(value);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  if (fields === null) {
    return (
      <button
        type="button"
        onClick={handleLoad}
        disabled={pending}
        className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs transition-colors disabled:opacity-40"
      >
        <Eye size={13} />
        {pending ? "טוען…" : "הצג שדות"}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {fields.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-ink-faded w-28 shrink-0 font-mono text-[11px]" dir="ltr">
            {f.key}
          </span>
          <span className="text-navy min-w-0 flex-1 truncate font-mono text-xs" dir="ltr">
            {shown[i] || !f.hidden ? f.value : "●".repeat(Math.min(f.value.length, 20))}
          </span>
          {f.hidden && (
            <button
              type="button"
              onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))}
              className="text-ink-faded hover:text-navy shrink-0 rounded p-0.5 transition-colors"
            >
              {shown[i] ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleCopy(f.value, i)}
            className="text-ink-faded hover:text-navy shrink-0 rounded p-0.5 transition-colors"
          >
            {copied === i ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleLoad}
        className="text-ink-faded hover:text-navy flex items-center gap-1 pt-1 text-[11px] transition-colors"
      >
        <EyeOff size={11} />
        הסתר
      </button>
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
  const [editing, setEditing] = useState<{ cred: Credential; fields: CredentialField[] } | null>(
    null,
  );
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleEdit(cred: Credential) {
    setLoadingEdit(cred.id);
    startTransition(async () => {
      const res = await revealFields(cred.id, customerId);
      setLoadingEdit(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setEditing({ cred, fields: res.fields ?? [] });
    });
  }

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
            setEditing(null);
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
              {editing?.cred.id === cred.id ? (
                <CredentialForm
                  customerId={customerId}
                  initial={editing.cred}
                  initialFields={editing.fields}
                  onDone={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div>
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
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleEdit(cred)}
                        disabled={loadingEdit === cred.id}
                        className="text-ink-faded hover:text-navy rounded p-1 transition-colors disabled:opacity-40"
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
                  <RevealedFields id={cred.id} customerId={customerId} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
