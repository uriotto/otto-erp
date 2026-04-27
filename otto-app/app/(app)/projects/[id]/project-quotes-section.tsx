"use client";

import { useState } from "react";
import { Plus, FileText, ExternalLink, Pencil } from "lucide-react";
import { NewQuoteDialog } from "@/app/(app)/quotes/new-quote-dialog";
import { EditQuoteDialog } from "@/app/(app)/quotes/edit-quote-dialog";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";

type QuoteItem = Pick<
  Tables<"quotes">,
  | "id"
  | "title"
  | "amount"
  | "status"
  | "document_url"
  | "signed_at"
  | "valid_until"
  | "notes"
  | "customer_id"
  | "project_id"
>;

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

export function ProjectQuotesSection({
  projectId,
  quotes,
  customerId,
  customerName,
}: {
  projectId: string;
  quotes: QuoteItem[];
  customerId?: string;
  customerName?: string;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteItem | null>(null);
  const router = useRouter();

  const customers =
    customerId && customerName ? [{ id: customerId, name: customerName, company: null }] : [];

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-sm font-semibold">
          הצעות מחיר
          {quotes.length > 0 && (
            <span className="text-ink-faded ms-1.5 font-normal">({quotes.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          <Plus size={13} />
          הצעה חדשה
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="text-ink-faded py-4 text-center text-xs">אין הצעות מחיר לפרויקט זה</div>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {quotes.map((q) => (
            <li key={q.id} className="flex items-center gap-3 py-2.5">
              <FileText size={13} className="text-ink-faded shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-navy truncate text-sm font-medium">{q.title}</p>
                {q.amount != null && (
                  <p className="text-ink-faded text-xs" dir="ltr">
                    {formatAmount(q.amount)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[q.status] ?? "bg-gray-100 text-gray-500"}`}
                >
                  {STATUS_LABELS[q.status] ?? q.status}
                </span>
                {q.document_url && (
                  <a
                    href={q.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="פתח מסמך"
                    className="text-ink-faded hover:text-navy transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={() => setEditingQuote(q)}
                  className="text-ink-faded hover:text-navy transition-colors"
                  title="ערוך"
                >
                  <Pencil size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <NewQuoteDialog
          customers={customers}
          projects={[]}
          defaultCustomerId={customerId}
          defaultProjectId={projectId}
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
          projects={[{ id: projectId, name: "הפרויקט הנוכחי" }]}
          onClose={() => {
            setEditingQuote(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
