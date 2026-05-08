"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, ExternalLink, Trash2, Building2, Pencil, Link2 } from "lucide-react";
import { deleteQuote, bulkDeleteQuotes } from "./actions";
import { NewQuoteDialog } from "./new-quote-dialog";
import { EditQuoteDialog } from "./edit-quote-dialog";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import type { Tables } from "@/lib/supabase/types";

type Quote = Tables<"quotes"> & {
  customer_name?: string;
  project_name?: string;
  public_token?: string;
};
type CustomerOption = { id: string; name: string; company: string | null };
type ProjectOption = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  signed: "חתומה",
  rejected: "נדחתה",
  expired: "פגה תוקף",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-sky-50 text-sky-700 border-sky-200",
  sent: "bg-amber-50 text-amber-700 border-amber-200",
  signed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-gray-100 text-gray-400 border-gray-200",
  expired: "bg-gray-100 text-gray-400 border-gray-200",
};

function formatAmount(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("he-IL");
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function handleCopy() {
    const url = `${window.location.origin}/proposal/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("הקישור הועתק");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("לא ניתן להעתיק");
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`rounded p-1 transition-colors ${copied ? "text-green-500" : "text-ink-faded hover:text-navy"}`}
      title="העתק קישור להצעה"
    >
      <Link2 size={12} />
    </button>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("למחוק הצעת מחיר זו?")) return;
    startTransition(async () => {
      const res = await deleteQuote(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("הצעת המחיר נמחקה");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-ink-faded rounded p-1 transition-colors hover:text-red-500 disabled:opacity-50"
      title="מחק"
    >
      {pending ? <Spinner size={12} /> : <Trash2 size={12} />}
    </button>
  );
}

export function QuotesList({
  quotes,
  customers,
  projects,
}: {
  quotes: Quote[];
  customers: CustomerOption[];
  projects: ProjectOption[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === quotes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(quotes.map((q) => q.id)));
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק ${ids.length} הצעות מחיר?`)) return;
    startBulk(async () => {
      const res = await bulkDeleteQuotes(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`נמחקו ${res.deleted} הצעות`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-sm text-navy">הצעות מחיר</h1>
          <p className="text-ink-soft mt-1 text-sm">{quotes.length} הצעות</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          הצעה חדשה
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <FileText size={40} className="text-navy/30 mb-4" />
          <h3 className="text-display-sm text-navy mb-2">אין הצעות מחיר עדיין</h3>
          <p className="text-ink-soft mb-5 text-sm">צור הצעת מחיר ראשונה</p>
          <button
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <Plus size={16} />
            הצעה חדשה
          </button>
        </div>
      ) : (
        <div className="bg-cream-paper border-ink-line overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === quotes.length && quotes.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">כותרת</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">לקוח</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סכום</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תוקף</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  className={`transition-colors ${selected.has(q.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-ink-faded shrink-0" />
                      <span className="text-navy font-medium">{q.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {q.customer_id ? (
                      <Link
                        href={`/customers/${q.customer_id}`}
                        className="text-ink-soft hover:text-navy inline-flex items-center gap-1 text-xs"
                      >
                        <Building2 size={11} />
                        {q.customer_name ?? q.customer_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    <span className="text-navy text-xs font-medium">
                      {q.amount != null ? formatAmount(Number(q.amount)) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[q.status] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {STATUS_LABELS[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {formatDate(q.valid_until) ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {q.public_token && <CopyLinkButton token={q.public_token} />}
                      {q.document_url && (
                        <a
                          href={q.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="פתח מסמך"
                          className="text-ink-faded hover:text-navy rounded p-1 transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button
                        onClick={() => setEditingQuote(q)}
                        className="text-ink-faded hover:text-navy rounded p-1 transition-colors"
                        title="ערוך"
                      >
                        <Pencil size={12} />
                      </button>
                      <DeleteButton id={q.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "מחק",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkDelete,
          },
        ]}
      />

      {showNew && (
        <NewQuoteDialog
          customers={customers}
          projects={projects}
          onClose={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {editingQuote && (
        <EditQuoteDialog
          quote={editingQuote}
          customers={customers}
          projects={projects}
          onClose={() => {
            setEditingQuote(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
