"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Building2, Calendar, Banknote, FileClock, LayoutGrid, Wallet } from "lucide-react";
import { HourBankProgress } from "@/components/domain/hour-bank-progress";
import { NewHourBankDialog } from "./new-hour-bank-dialog";

export type HourBankStatus = "draft" | "active" | "depleted" | "expired" | "cancelled";

export type HourBankListItem = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  purchased_hours: number;
  consumed_hours: number;
  available_hours: number;
  hourly_rate: number;
  total_amount: number;
  purchase_date: string | null;
  expiry_date: string | null;
  status: HourBankStatus;
  alert_threshold_pct: number;
  alert_threshold_hours: number;
  notes: string | null;
};

export type CustomerOption = {
  id: string;
  name: string;
  hourly_rate_override: number | null;
};

const STATUS_LABELS: Record<HourBankStatus, string> = {
  draft: "טיוטה",
  active: "פעיל",
  depleted: "נוצל",
  expired: "פג תוקף",
  cancelled: "בוטל",
};

const STATUS_STYLES: Record<HourBankStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  depleted: "border-gray-200 bg-gray-100 text-gray-600",
  expired: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

const TABS: Array<{ key: "all" | HourBankStatus; label: string }> = [
  { key: "active", label: "פעילים" },
  { key: "depleted", label: "נוצלו" },
  { key: "expired", label: "פגי תוקף" },
  { key: "cancelled", label: "מבוטלים" },
  { key: "all", label: "הכל" },
];

export function HourBanksList({
  banks,
  customers,
  draftCount,
  defaultHourlyRate,
  defaultExpiryMonths,
  defaultAlertPct,
  defaultAlertHours,
}: {
  banks: HourBankListItem[];
  customers: CustomerOption[];
  draftCount: number;
  defaultHourlyRate: number;
  defaultExpiryMonths: number;
  defaultAlertPct: number;
  defaultAlertHours: number;
}) {
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<"all" | HourBankStatus>("active");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: banks.length };
    for (const b of banks) map[b.status] = (map[b.status] ?? 0) + 1;
    return map;
  }, [banks]);

  const filtered = useMemo(() => {
    return banks.filter((b) => {
      if (tab !== "all" && b.status !== tab) return false;
      if (customerFilter !== "all" && b.customer_id !== customerFilter) return false;
      return true;
    });
  }, [banks, tab, customerFilter]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">בנקי שעות</h1>
          <p className="text-ink-soft mt-1 text-sm">{banks.length} בנקים סך הכל</p>
        </div>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Link
              href="/hour-banks/draft-renewals"
              className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            >
              <FileClock size={16} />
              טיוטות חידוש ({draftCount})
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            בנק חדש
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="border-ink-line bg-cream-paper inline-flex rounded-lg border p-1">
          {TABS.map((t) => {
            const isActive = tab === t.key;
            const count = counts[t.key] ?? 0;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-navy text-cream-paper" : "text-ink-soft hover:text-navy"
                }`}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="border-ink-line focus:border-navy ms-auto rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הלקוחות</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {banks.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : filtered.length === 0 ? (
        <NoResults />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <HourBankCard key={b.id} bank={b} />
          ))}
        </div>
      )}

      {showNew && (
        <NewHourBankDialog
          customers={customers}
          defaultHourlyRate={defaultHourlyRate}
          defaultExpiryMonths={defaultExpiryMonths}
          defaultAlertPct={defaultAlertPct}
          defaultAlertHours={defaultAlertHours}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function HourBankCard({ bank }: { bank: HourBankListItem }) {
  const expiry = bank.expiry_date ? new Date(bank.expiry_date) : null;
  const isExpiringSoon =
    expiry &&
    bank.status === "active" &&
    // eslint-disable-next-line react-hooks/purity
    expiry.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30;

  return (
    <Link
      href={`/hour-banks/${bank.id}`}
      className="focus-visible:outline-navy/40 block focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="bg-cream-paper border-ink-line hover:border-ink-soft relative rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]">
        <div className="mb-4 flex items-start gap-3">
          <div className="bg-navy text-cream-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Wallet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-navy truncate font-semibold">{bank.customer_name ?? "—"}</div>
            <div className="text-ink-soft mt-0.5 flex items-center gap-1 text-xs">
              <Building2 size={11} />
              <span dir="ltr" className="font-mono">
                ₪{bank.hourly_rate.toLocaleString("he-IL")}/h
              </span>
              <span>·</span>
              <span dir="ltr" className="font-mono">
                ₪{bank.total_amount.toLocaleString("he-IL")}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[bank.status]
            }`}
          >
            {STATUS_LABELS[bank.status]}
          </span>
        </div>

        <HourBankProgress
          purchased={bank.purchased_hours}
          consumed={bank.consumed_hours}
          alertThresholdPct={bank.alert_threshold_pct}
          alertThresholdHours={bank.alert_threshold_hours}
        />

        <div className="text-ink-soft mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {bank.purchase_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              נרכש {new Date(bank.purchase_date).toLocaleDateString("he-IL")}
            </span>
          )}
          {expiry && (
            <span
              className={`inline-flex items-center gap-1 ${
                isExpiringSoon ? "text-yellow-700" : ""
              }`}
            >
              <Calendar size={12} />
              עד {expiry.toLocaleDateString("he-IL")}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Banknote size={12} />
            התראה: {bank.alert_threshold_pct}% / {bank.alert_threshold_hours}h
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <LayoutGrid size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">צור בנק שעות ראשון</h2>
      <p className="text-ink-soft mb-6 max-w-md text-sm">
        בנק שעות מאפשר ללקוח לרכוש מראש מנת שעות במחיר מועדף, ולעקוב בקלות אחרי הניצול שלהן
      </p>
      <button
        type="button"
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        בנק חדש
      </button>
    </div>
  );
}

function NoResults() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <LayoutGrid size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">אין בנקים בסינון הזה</h2>
    </div>
  );
}
