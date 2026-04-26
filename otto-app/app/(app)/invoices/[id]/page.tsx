import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Receipt, Building2, Calendar, ExternalLink, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label";
import { InvoiceActionsBar } from "./invoice-actions-bar";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_LABELS,
  type InvoiceStatusUI,
  type InvoiceTypeUI,
} from "../invoices-list";

export const metadata = { title: "חשבונית — OTTO" };

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "העברה בנקאית",
  credit_card: "כרטיס אשראי",
  bit: "ביט",
  cash: "מזומן",
  check: "המחאה",
  other: "אחר",
};

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();

  if (!invoice) notFound();

  const [{ data: customer }, { data: items }, { data: payments }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, email, phone")
      .eq("id", invoice.customer_id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price, amount, order_index")
      .eq("invoice_id", id)
      .order("order_index", { ascending: true }),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, reference, notes")
      .eq("invoice_id", id)
      .order("paid_at", { ascending: false }),
  ]);

  const status = invoice.status as InvoiceStatusUI;
  const type = invoice.type as InvoiceTypeUI;
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxRate = Number(invoice.tax_rate ?? 0);
  const taxAmount = Number(invoice.tax_amount ?? 0);
  const total = Number(invoice.total_amount ?? 0);
  const paidAmount = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const balance = Math.max(total - paidAmount, 0);

  const breadcrumbLabel = invoice.number
    ? `חשבונית ${invoice.number}`
    : `חשבונית ${customer?.name ?? ""}`;

  return (
    <div className="mx-auto max-w-4xl">
      <BreadcrumbLabel label={breadcrumbLabel} />

      <div className="mb-6">
        <Link
          href="/invoices"
          className="text-ink-soft hover:text-navy inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowRight size={14} />
          חזרה לחשבוניות
        </Link>
      </div>

      <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
        <div className="mb-4 flex items-start gap-4">
          <div className="bg-navy text-cream-paper flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Receipt size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-display-sm text-navy font-mono" dir="ltr">
                {invoice.number ?? "—"}
              </h1>
              <span className="text-ink-soft text-sm">· {TYPE_LABELS[type] ?? type}</span>
            </div>
            {customer && (
              <Link
                href={`/customers/${customer.id}`}
                className="text-ink-soft hover:text-navy mt-1 inline-flex items-center gap-1 text-sm"
              >
                <Building2 size={12} />
                {customer.name}
                {customer.company && <span className="text-ink-faded">· {customer.company}</span>}
              </Link>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLES[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="text-ink-soft grid grid-cols-2 gap-y-2 text-sm md:grid-cols-4">
          <Stat
            icon={<Calendar size={14} />}
            label="הוצאה"
            value={
              invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString("he-IL") : "—"
            }
          />
          <Stat
            icon={<Calendar size={14} />}
            label="תשלום עד"
            value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("he-IL") : "—"}
          />
          <Stat icon={<Receipt size={14} />} label='סה"כ' value={formatILS(total)} dir="ltr" />
          <Stat
            icon={<Receipt size={14} />}
            label="יתרה"
            value={formatILS(balance)}
            dir="ltr"
            className={balance > 0 ? "text-rose-700" : "text-emerald-700"}
          />
        </div>

        {invoice.finbot_url && (
          <a
            href={invoice.finbot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-navy hover:text-navy-deep mt-4 inline-flex items-center gap-1 text-sm font-medium"
          >
            <ExternalLink size={14} />
            צפייה ב-Finbot
          </a>
        )}

        <InvoiceActionsBar
          invoice={{
            id: invoice.id,
            status,
            number: invoice.number,
            issue_date: invoice.issue_date,
            due_date: invoice.due_date,
            notes: invoice.notes,
            finbot_url: invoice.finbot_url,
            finbot_invoice_id: invoice.finbot_invoice_id,
            balance,
            total,
          }}
        />
      </div>

      {/* Items */}
      <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
        <h2 className="text-navy mb-4 flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} />
          פריטים
        </h2>
        <div className="border-ink-line overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep text-ink-soft text-xs">
              <tr>
                <th className="px-4 py-2 text-start font-medium">תיאור</th>
                <th className="px-4 py-2 text-end font-medium">כמות</th>
                <th className="px-4 py-2 text-end font-medium">מחיר</th>
                <th className="px-4 py-2 text-end font-medium">סכום</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((it) => (
                <tr key={it.id} className="border-ink-line border-t">
                  <td className="text-navy px-4 py-3">{it.description}</td>
                  <td className="px-4 py-3 text-end font-mono" dir="ltr">
                    {Number(it.quantity).toLocaleString("he-IL")}
                  </td>
                  <td className="px-4 py-3 text-end font-mono" dir="ltr">
                    {formatILS(Number(it.unit_price))}
                  </td>
                  <td className="text-navy px-4 py-3 text-end font-mono" dir="ltr">
                    {formatILS(Number(it.amount ?? Number(it.quantity) * Number(it.unit_price)))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-ink-soft text-sm">
              <tr className="border-ink-line border-t">
                <td colSpan={3} className="px-4 py-2 text-end">
                  סכום ביניים
                </td>
                <td className="px-4 py-2 text-end font-mono" dir="ltr">
                  {formatILS(subtotal)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-end">
                  מע״מ ({taxRate}%)
                </td>
                <td className="px-4 py-2 text-end font-mono" dir="ltr">
                  {formatILS(taxAmount)}
                </td>
              </tr>
              <tr className="bg-cream-deep">
                <td colSpan={3} className="text-navy px-4 py-3 text-end font-semibold">
                  סה״כ
                </td>
                <td
                  className="text-navy px-4 py-3 text-end font-mono text-base font-semibold"
                  dir="ltr"
                >
                  {formatILS(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {invoice.notes && (
          <div className="text-ink-soft mt-4 text-sm whitespace-pre-wrap">{invoice.notes}</div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
        <h2 className="text-navy mb-4 text-sm font-semibold">תשלומים</h2>
        {(payments ?? []).length === 0 ? (
          <p className="text-ink-soft text-sm">עדיין לא נרשמו תשלומים</p>
        ) : (
          <ul className="space-y-2">
            {(payments ?? []).map((p) => (
              <li
                key={p.id}
                className="border-ink-line bg-cream/40 flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div>
                  <div className="text-navy font-mono text-sm font-semibold" dir="ltr">
                    {formatILS(Number(p.amount ?? 0))}
                  </div>
                  <div className="text-ink-soft mt-0.5 text-xs">
                    {METHOD_LABELS[p.method] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                  {p.notes && (
                    <div className="text-ink-faded mt-1 text-xs whitespace-pre-wrap">{p.notes}</div>
                  )}
                </div>
                <div className="text-ink-soft text-xs">
                  {new Date(p.paid_at).toLocaleDateString("he-IL")}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="text-ink-soft mt-4 flex items-center justify-between text-sm">
          <span>סך תשלומים שנרשמו</span>
          <span className="text-navy font-mono font-semibold" dir="ltr">
            {formatILS(paidAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  dir,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  dir?: "ltr";
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {icon}
      <span className="text-ink-faded">{label}:</span>
      <span dir={dir} className="text-navy font-medium">
        {value}
      </span>
    </div>
  );
}
