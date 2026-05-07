"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Building2,
  Calendar,
  Banknote,
  FileClock,
  LayoutGrid,
  Wallet,
  Table2,
  Trash2,
} from "lucide-react";
import { HourBankProgress } from "@/components/domain/hour-bank-progress";
import { NewHourBankDialog } from "./new-hour-bank-dialog";
import { ViewToggle, useStoredView } from "@/components/ui/view-toggle";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { bulkCancelHourBanks, bulkDeleteHourBanks } from "./actions";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { saveFilters, loadFilters } from "@/lib/persist-filters";

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
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useStoredView<"grid" | "table">("hour-banks-view", "grid");
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<"all" | HourBankStatus>(
    () => (loadFilters("hour-banks")?.tab as HourBankStatus) ?? "active"
  );
  const [customerFilter, setCustomerFilter] = useState<string>(
    () => loadFilters("hour-banks")?.customer ?? "all"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  // Persist filter state to localStorage on every change
  useEffect(() => {
    saveFilters("hour-banks", { tab, customer: customerFilter });
  }, [tab, customerFilter]);

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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((b) => b.id)));
    }
  }

  function handleBulkCancel() {
    const ids = Array.from(selected);
    if (!confirm(`לבטל ${ids.length} בנקי שעות?`)) return;
    startBulk(async () => {
      const res = await bulkCancelHourBanks(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`בוטלו ${res.cancelled} בנקים`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק לגמרי ${ids.length} בנקי שעות? פעולה זו בלתי הפיכה.`)) return;
    startBulk(async () => {
      const res = await bulkDeleteHourBanks(ids);
      if (res.error && res.deleted === 0) {
        toast.error(res.error);
        return;
      }
      if (res.skipped && res.skipped > 0) {
        toast.success(
          `נמחקו ${res.deleted} בנקים. ${res.skipped} דולגו (יש שעות מוקצות — ניתן לבטל בלבד).`,
        );
      } else {
        toast.success(`נמחקו ${res.deleted} בנקים`);
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">בנקי שעות</h1>
          <p className="text-ink-soft mt-1 text-sm">{banks.length} בנקים סך הכל</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            storageKey="hour-banks-view"
            views={[
              { id: "grid", icon: LayoutGrid, label: "גריד" },
              { id: "table", icon: Table2, label: "טבלה" },
            ]}
            defaultView="grid"
            current={view}
            onChange={setView}
          />
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
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
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
      ) : view === "table" ? (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">לקוח</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">שעות שנרכשו</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">זמינות</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תפוגה</th>
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className={`transition-colors ${selected.has(b.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleSelect(b.id)}
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/hour-banks/${b.id}`}
                      className="text-navy font-medium hover:underline"
                    >
                      {b.customer_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    <span className="text-navy text-xs font-medium">{b.purchased_hours}h</span>
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    <span
                      className={`text-xs font-medium ${b.available_hours <= 0 ? "text-rose-600" : "text-emerald-700"}`}
                    >
                      {b.available_hours}h
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status]}`}
                    >
                      {STATUS_LABELS[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("he-IL") : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <HourBankCard key={b.id} bank={b} />
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "בטל",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkCancel,
          },
          {
            label: "מחק לגמרי",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkDelete,
          },
        ]}
      />

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
    <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
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
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        בנק חדש
      </button>
    </div>
  );
}

function NoResults() {
  return (
    <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <LayoutGrid size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">אין בנקים בסינון הזה</h2>
    </div>
  );
}
