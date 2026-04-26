"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2 } from "lucide-react";
import { createInvoice } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import {
  TYPE_LABELS,
  type CustomerOption,
  type ProjectOption,
  type HourBankOption,
  type InvoiceTypeUI,
} from "./invoices-list";

type ItemRow = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function newRow(): ItemRow {
  return {
    key: Math.random().toString(36).slice(2),
    description: "",
    quantity: "1",
    unit_price: "",
  };
}

export function NewInvoiceDialog({
  customers,
  projects,
  hourBanks,
  onClose,
}: {
  customers: CustomerOption[];
  projects: ProjectOption[];
  hourBanks: HourBankOption[];
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [hourBankId, setHourBankId] = useState("");
  const [type, setType] = useState<InvoiceTypeUI>("monthly_hours");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(plusDaysISO(30));
  const [taxRate, setTaxRate] = useState("18");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const customerProjects = useMemo(
    () => projects.filter((p) => p.customer_id === customerId),
    [projects, customerId],
  );
  const customerBanks = useMemo(
    () => hourBanks.filter((b) => b.customer_id === customerId),
    [hourBanks, customerId],
  );

  const subtotal = items.reduce((sum, it) => {
    const q = Number(it.quantity);
    const p = Number(it.unit_price);
    if (!Number.isFinite(q) || !Number.isFinite(p)) return sum;
    return sum + q * p;
  }, 0);
  const taxRateNum = Number(taxRate);
  const taxAmount = Number.isFinite(taxRateNum) ? (subtotal * taxRateNum) / 100 : 0;
  const total = subtotal + taxAmount;

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }
  function addItem() {
    setItems((prev) => [...prev, newRow()]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!customerId) {
      setErrors({ customer_id: "יש לבחור לקוח" });
      return;
    }

    const parsedItems = items
      .map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      }))
      .filter((it) => it.description.length > 0);

    if (parsedItems.length === 0) {
      setErrors({ items: "חובה לפחות שורה אחת עם תיאור" });
      return;
    }
    for (const it of parsedItems) {
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        setErrors({ items: "כמות חייבת להיות גדולה מ-0 בכל השורות" });
        return;
      }
      if (!Number.isFinite(it.unit_price) || it.unit_price < 0) {
        setErrors({ items: "מחיר לא תקין" });
        return;
      }
    }

    startTransition(async () => {
      const result = await createInvoice({
        customer_id: customerId,
        project_id: projectId || null,
        hour_bank_id: hourBankId || null,
        type,
        number: number.trim() || null,
        issue_date: issueDate,
        due_date: dueDate || null,
        tax_rate: Number.isFinite(taxRateNum) ? taxRateNum : 18,
        notes: notes.trim() || null,
        items: parsedItems,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("החשבונית נוצרה");
      onClose();
      router.push(`/invoices/${result.id}`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">חשבונית חדשה</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="לקוח *" error={errors.customer_id}>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setProjectId("");
                  setHourBankId("");
                }}
                className={baseInput}
                required
              >
                <option value="">— בחר לקוח —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="סוג">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as InvoiceTypeUI)}
                className={baseInput}
              >
                {(Object.keys(TYPE_LABELS) as InvoiceTypeUI[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="פרויקט (אופציונלי)">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={baseInput}
                disabled={!customerId}
              >
                <option value="">— ללא —</option>
                {customerProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="בנק שעות (אופציונלי)">
              <select
                value={hourBankId}
                onChange={(e) => setHourBankId(e.target.value)}
                className={baseInput}
                disabled={!customerId || customerBanks.length === 0}
              >
                <option value="">— ללא —</option>
                {customerBanks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.purchased_hours}h · ₪{b.hourly_rate}/h
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="מספר חשבונית (Finbot)">
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="הזן ידנית מ-Finbot"
                className={baseInput}
                dir="ltr"
              />
            </Field>
            <Field label="תאריך הוצאה *">
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className={baseInput}
              />
            </Field>
            <Field label="תשלום עד">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={baseInput}
              />
            </Field>
          </div>

          <div className="border-ink-line bg-cream-paper rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-navy text-sm font-semibold">פריטים</h3>
              <button
                type="button"
                onClick={addItem}
                className="border-ink-line text-navy hover:border-navy flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Plus size={12} />
                הוסף שורה
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it) => {
                const q = Number(it.quantity);
                const p = Number(it.unit_price);
                const lineAmount = Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
                return (
                  <div
                    key={it.key}
                    className="grid grid-cols-12 items-start gap-2 rounded-lg bg-white/60 p-2"
                  >
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="תיאור"
                        value={it.description}
                        onChange={(e) => updateItem(it.key, { description: e.target.value })}
                        className={baseInput}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        placeholder="כמות"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                        className={`${baseInput} font-mono`}
                        dir="ltr"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="₪/יח'"
                        value={it.unit_price}
                        onChange={(e) => updateItem(it.key, { unit_price: e.target.value })}
                        className={`${baseInput} font-mono`}
                        dir="ltr"
                      />
                    </div>
                    <div
                      className="text-navy col-span-1 px-2 py-2 text-end font-mono text-sm"
                      dir="ltr"
                    >
                      ₪{lineAmount.toLocaleString("he-IL", { maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        disabled={items.length === 1}
                        className="text-ink-faded rounded-lg p-2 transition-colors hover:text-rose-600 disabled:opacity-30"
                        aria-label="הסר שורה"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {errors.items && <p className="mt-2 text-xs text-red-600">{errors.items}</p>}
          </div>

          {/* Totals */}
          <div className="border-ink-line bg-cream-paper grid grid-cols-1 gap-2 rounded-xl border p-4 md:grid-cols-2">
            <Field label="מע״מ (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className={`${baseInput} font-mono`}
                dir="ltr"
              />
            </Field>
            <div className="text-ink-soft flex flex-col justify-end gap-1 text-sm">
              <Row label="סכום ביניים" value={subtotal} />
              <Row label={`מע״מ (${taxRate}%)`} value={taxAmount} />
              <Row label='סה"כ' value={total} bold />
            </div>
          </div>

          <Field label="הערות">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={baseInput}
            />
          </Field>

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
              disabled={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <Spinner size={14} />
                  <span>יוצר</span>
                </span>
              ) : (
                "צור חשבונית"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const baseInput =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none border-ink-line focus:border-navy placeholder:text-ink-faded disabled:bg-cream-deep disabled:cursor-not-allowed";

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="text-micro text-ink-soft mb-1 block uppercase">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span dir="ltr" className={`font-mono ${bold ? "text-navy text-base font-semibold" : ""}`}>
        ₪{value.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
