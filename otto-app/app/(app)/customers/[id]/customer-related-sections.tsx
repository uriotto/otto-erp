"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
  Clock,
  ExternalLink,
  FileText,
  Phone,
  MessageCircle,
  Pencil,
} from "lucide-react";
import { deleteContact } from "@/app/(app)/contacts/actions";
import { ContactDialog } from "@/app/(app)/contacts/contact-dialog";
import { useToast } from "@/components/ui/toast";
import type { Tables } from "@/lib/supabase/types";
import { NewProjectDialog } from "@/app/(app)/projects/new-project-dialog";
import { NewHourBankDialog } from "@/app/(app)/hour-banks/new-hour-bank-dialog";
import { NewQuoteDialog } from "@/app/(app)/quotes/new-quote-dialog";
import { useRouter } from "next/navigation";
import type { ProjectListItem, TemplateOption } from "@/app/(app)/projects/projects-list";

type Project = Pick<Tables<"projects">, "id" | "name" | "status">;
type QuoteItem = {
  id: string;
  title: string;
  amount: number | null;
  status: string;
  document_url: string | null;
  signed_at: string | null;
  valid_until: string | null;
};
type HourBank = {
  id: string | null;
  status: string | null;
  purchased_hours: number | null;
  available_hours: number | null;
  purchase_date: string | null;
  notes: string | null;
};
type CustomerOpt = { id: string; name: string; hourly_rate_override: number | null };

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "תכנון",
  active: "פעיל",
  on_hold: "בהמתנה",
  completed: "הושלם",
  cancelled: "בוטל",
};

const PROJECT_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  planning: "bg-sky-50 text-sky-700 border-sky-200",
  on_hold: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-gray-100 text-gray-500 border-gray-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

const BANK_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  draft: "bg-sky-50 text-sky-700 border-sky-200",
  depleted: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

const BANK_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  draft: "טיוטה",
  depleted: "אוזל",
  expired: "פג תוקף",
  cancelled: "בוטל",
};

export function CustomerProjectsSection({
  customerId,
  customerName,
  projects,
  allCustomers,
  templates,
  parentProjects,
}: {
  customerId: string;
  customerName: string;
  projects: Project[];
  allCustomers: CustomerOpt[];
  templates: TemplateOption[];
  parentProjects: ProjectListItem[];
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-sm font-semibold">
          פרויקטים
          {projects.length > 0 && (
            <span className="text-ink-faded ms-1.5 font-normal">({projects.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          <Plus size={13} />
          פרויקט חדש
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-ink-faded py-4 text-center text-xs">אין פרויקטים עדיין</div>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="hover:bg-cream-deep/30 flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FolderOpen size={13} className="text-ink-faded shrink-0" />
                  <span className="text-navy truncate text-sm font-medium">{p.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      PROJECT_STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <ExternalLink size={11} className="text-ink-faded" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <NewProjectDialog
          customers={allCustomers}
          templates={templates}
          parentProjects={parentProjects}
          defaultCustomerId={customerId}
          onClose={() => setShowNew(false)}
        />
      )}
    </section>
  );
}

export function CustomerHourBanksSection({
  customerId,
  hourBanks,
  allCustomers,
  defaultHourlyRate,
  defaultExpiryMonths,
  defaultAlertPct,
  defaultAlertHours,
}: {
  customerId: string;
  hourBanks: HourBank[];
  allCustomers: CustomerOpt[];
  defaultHourlyRate: number;
  defaultExpiryMonths: number;
  defaultAlertPct: number;
  defaultAlertHours: number;
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-sm font-semibold">
          בנקי שעות
          {hourBanks.length > 0 && (
            <span className="text-ink-faded ms-1.5 font-normal">({hourBanks.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          <Plus size={13} />
          בנק שעות חדש
        </button>
      </div>

      {hourBanks.length === 0 ? (
        <div className="text-ink-faded py-4 text-center text-xs">אין בנקי שעות עדיין</div>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {hourBanks.map((b) => (
            <li key={b.id}>
              <Link
                href={`/hour-banks/${b.id ?? ""}`}
                className="hover:bg-cream-deep/30 flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Clock size={13} className="text-ink-faded shrink-0" />
                  <span className="text-navy truncate text-sm font-medium">
                    {b.notes
                      ? b.notes
                      : b.purchase_date
                        ? new Date(b.purchase_date).toLocaleDateString("he-IL")
                        : "—"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-ink-soft text-xs" dir="ltr">
                    {Number(b.available_hours ?? 0).toFixed(1)}/
                    {Number(b.purchased_hours ?? 0).toFixed(0)} ש׳
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      BANK_STATUS_STYLES[b.status ?? ""] ?? "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {BANK_STATUS_LABELS[b.status ?? ""] ?? b.status}
                  </span>
                  <ExternalLink size={11} className="text-ink-faded" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <NewHourBankDialog
          customers={allCustomers}
          defaultCustomerId={customerId}
          defaultHourlyRate={defaultHourlyRate}
          defaultExpiryMonths={defaultExpiryMonths}
          defaultAlertPct={defaultAlertPct}
          defaultAlertHours={defaultAlertHours}
          onClose={() => setShowNew(false)}
        />
      )}
    </section>
  );
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  signed: "חתומה",
  rejected: "נדחתה",
  expired: "פגה תוקף",
};

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-sky-50 text-sky-700 border-sky-200",
  sent: "bg-amber-50 text-amber-700 border-amber-200",
  signed: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-gray-100 text-gray-400 border-gray-200",
  expired: "bg-gray-100 text-gray-400 border-gray-200",
};

type ProjectOption = { id: string; name: string; customer_id?: string | null };

export function CustomerQuotesSection({
  customerId,
  customerName,
  quotes,
  projects,
}: {
  customerId: string;
  customerName: string;
  quotes: QuoteItem[];
  projects: ProjectOption[];
}) {
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

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
        <div className="text-ink-faded py-4 text-center text-xs">אין הצעות מחיר עדיין</div>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {quotes.map((q) => (
            <li key={q.id} className="flex items-center gap-3 py-2.5">
              <FileText size={13} className="text-ink-faded shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-navy truncate text-sm font-medium">{q.title}</p>
                {q.amount != null && (
                  <p className="text-ink-faded text-xs" dir="ltr">
                    ₪{Number(q.amount).toLocaleString("he-IL")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_STYLES[q.status] ?? "bg-gray-100 text-gray-500"}`}
                >
                  {QUOTE_STATUS_LABELS[q.status] ?? q.status}
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
              </div>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <NewQuoteDialog
          customers={[{ id: customerId, name: customerName, company: null }]}
          projects={projects}
          defaultCustomerId={customerId}
          onClose={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

type ContactItem = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  customer_id: string | null;
};

function formatWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

export function CustomerContactsSection({
  customerId,
  contacts,
  allCustomers,
}: {
  customerId: string;
  contacts: ContactItem[];
  allCustomers: { id: string; name: string }[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const toast = useToast();

  async function handleDelete(contact: ContactItem) {
    if (!confirm(`למחוק את ${contact.name}?`)) return;
    const result = await deleteContact(contact.id);
    if (result.error) toast.error(result.error);
    else toast.success("נמחק");
  }

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-navy text-sm font-semibold">
          אנשי קשר
          {contacts.length > 0 && (
            <span className="text-ink-faded ms-1.5 font-normal">({contacts.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-ink-soft hover:text-navy flex items-center gap-1 text-xs transition-colors"
        >
          <Plus size={13} />
          איש קשר חדש
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-ink-faded py-4 text-center text-xs">אין אנשי קשר עדיין</div>
      ) : (
        <ul className="divide-ink-line/60 divide-y">
          {contacts.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-navy text-sm font-medium">{c.name}</p>
                  {c.role && <p className="text-ink-faded text-xs">{c.role}</p>}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-ink-soft hover:text-navy text-xs">
                      {c.email}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.phone && (
                    <>
                      <a
                        href={`tel:${c.phone}`}
                        className="text-ink-faded hover:text-navy rounded p-1 transition-colors"
                        title="התקשר"
                      >
                        <Phone size={13} />
                      </a>
                      <a
                        href={`https://wa.me/${formatWhatsApp(c.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-faded rounded p-1 transition-colors hover:text-green-600"
                        title="WhatsApp"
                      >
                        <MessageCircle size={13} />
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => setEditingContact(c)}
                    className="text-ink-faded hover:text-navy rounded p-1 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <ContactDialog
          customers={allCustomers}
          lockedCustomerId={customerId}
          onClose={() => setShowNew(false)}
        />
      )}
      {editingContact && (
        <ContactDialog
          contact={editingContact}
          customers={allCustomers}
          lockedCustomerId={customerId}
          onClose={() => setEditingContact(null)}
        />
      )}
    </section>
  );
}
