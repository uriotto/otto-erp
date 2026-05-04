"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Mail,
  Phone,
  Building2,
  Search,
  X,
  Users,
  SearchX,
  UserX,
  Check,
  LayoutGrid,
  Table2,
  Trash2,
  Pencil,
  ChevronDown,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { NewCustomerDialog } from "./new-customer-dialog";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  bulkDeactivateCustomers,
  bulkDeleteCustomers,
  exportCustomersCsv,
  quickUpdateCustomer,
} from "./actions";
import { Eye, EyeOff } from "lucide-react";
import { ViewToggle, useStoredView } from "@/components/ui/view-toggle";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

type Customer = Tables<"customers">;
type StatusFilter = "all" | "active" | "inactive";

const BILLING_LABELS: Record<string, string> = {
  hourly: "שעתי",
  hour_bank: "בנק שעות",
  fixed_price: "מחיר קבוע",
  retainer: "ריטיינר",
};
const BILLING_OPTIONS = Object.entries(BILLING_LABELS);

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "active", label: "פעיל" },
  { key: "inactive", label: "לא פעיל" },
];

const SEARCH_DEBOUNCE_MS = 200;

function parseStatus(value: string | null): StatusFilter {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

function parseTags(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function CustomersList({
  customers,
  showInactive = false,
}: {
  customers: Customer[];
  showInactive?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toast = useToast();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useStoredView<"grid" | "table">("customers-view", "grid");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatus(searchParams.get("status")),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    parseTags(searchParams.get("tags")),
  );

  const updateUrl = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v && v.length > 0) sp.set(k, v);
        else sp.delete(k);
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Debounced URL update for query
  useEffect(() => {
    const handle = setTimeout(() => {
      updateUrl({ q: query.trim() || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setStatus = (next: StatusFilter) => {
    setStatusFilter(next);
    updateUrl({ status: next === "all" ? undefined : next });
  };

  const setTags = (next: string[]) => {
    setSelectedTags(next);
    updateUrl({ tags: next.length > 0 ? next.join(",") : undefined });
  };

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      for (const tag of c.tags ?? []) {
        const t = tag.trim();
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (selectedTags.length > 0) {
        const tags = c.tags ?? [];
        if (!selectedTags.some((t) => tags.includes(t))) return false;
      }
      if (!q) return true;
      const haystack = [c.name, c.email, c.phone, c.company]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase());
      return haystack.some((v) => v.includes(q));
    });
  }, [customers, query, statusFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setTags(
      selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag],
    );
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedCustomers = useMemo(
    () => customers.filter((c) => selectedIds.has(c.id)),
    [customers, selectedIds],
  );
  const allSelectedInactive =
    selectedCustomers.length > 0 && selectedCustomers.every((c) => c.active === false);

  const handleBulkDeactivate = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (allSelectedInactive) {
      if (!confirm(`להפעיל מחדש ${ids.length} לקוחות?`)) return;
      startDeleteTransition(async () => {
        const result = await bulkDeactivateCustomers(ids, true);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`הופעלו מחדש ${result.updated ?? ids.length} לקוחות`);
        setSelectedIds(new Set());
        router.refresh();
      });
    } else {
      if (!confirm(`להשבית ${ids.length} לקוחות?`)) return;
      startDeleteTransition(async () => {
        const result = await bulkDeactivateCustomers(ids, false);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`הושבתו ${result.updated ?? ids.length} לקוחות`);
        setSelectedIds(new Set());
        router.refresh();
      });
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`למחוק ${ids.length} לקוחות לצמיתות?`)) return;
    startDeleteTransition(async () => {
      const result = await bulkDeleteCustomers(ids);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`נמחקו ${result.deleted} לקוחות`);
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const clearAll = () => {
    setQuery("");
    setStatusFilter("all");
    setSelectedTags([]);
    updateUrl({ q: undefined, status: undefined, tags: undefined });
  };

  const hasCustomers = customers.length > 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-navy">לקוחות</h1>
          <p className="text-ink-soft mt-1 text-sm">
            {hasCustomers ? `${filtered.length} מתוך ${customers.length} לקוחות` : "0 לקוחות"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            storageKey="customers-view"
            views={[
              { id: "grid", icon: LayoutGrid, label: "כרטיסים" },
              { id: "table", icon: Table2, label: "טבלה" },
            ]}
            defaultView="grid"
            current={view}
            onChange={setView}
          />
          <Link
            href={showInactive ? "/customers" : "/customers?inactive=1"}
            className="text-ink-soft hover:text-navy flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2.5 text-xs font-medium transition-colors hover:border-current"
            title={showInactive ? "הצג פעילים בלבד" : "הצג מושבתים"}
          >
            {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
            {showInactive ? "הסתר מושבתים" : "מושבתים"}
          </Link>
          <ExportCsvButton label="ייצא CSV" action={exportCustomersCsv} />
          <button
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            לקוח חדש
          </button>
        </div>
      </div>

      {hasCustomers && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-sm sm:flex-1">
            <Search
              size={16}
              className="text-ink-faded pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, אימייל, טלפון או חברה"
              className="bg-cream-paper border-ink-line text-navy placeholder:text-ink-faded focus:border-ink-soft w-full rounded-xl border py-2.5 ps-10 pe-9 text-sm transition-colors outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="נקה חיפוש"
                className="text-ink-faded hover:text-navy absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(({ key, label }) => {
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-navy text-cream-paper border-navy"
                      : "bg-cream-paper text-ink-soft border-ink-line hover:border-ink-soft"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasCustomers && availableTags.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {availableTags.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  isActive
                    ? "border-navy bg-navy text-cream-paper"
                    : "border-ink-line text-ink-soft hover:border-navy bg-white"
                }`}
              >
                {tag}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setTags([])}
              className="text-ink-soft hover:text-navy ms-1 text-xs underline"
            >
              נקה תגיות
            </button>
          )}
        </div>
      )}

      {customers.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : filtered.length === 0 ? (
        <NoResults query={query} onClear={clearAll} />
      ) : view === "table" ? (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={filtered.every((c) => selectedIds.has(c.id)) && filtered.length > 0}
                    onChange={() => {
                      const allSelected = filtered.every((c) => selectedIds.has(c.id));
                      setSelectedIds(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
                    }}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">שם</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">חברה</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">אימייל</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">מודל חיוב</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תגיות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  customer={c}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={() => toggleSelected(c.id)}
                  onNavigate={() => router.push(`/customers/${c.id}`)}
                  onSaved={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CustomerCard
              key={c.id}
              customer={c}
              selected={selectedIds.has(c.id)}
              onToggleSelect={() => toggleSelected(c.id)}
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={clearSelection}
        actions={[
          {
            label: allSelectedInactive ? "הפעל מחדש" : "השבת",
            icon: UserX,
            isPending: pendingDelete,
            onClick: handleBulkDeactivate,
          },
          {
            label: "מחק",
            icon: Trash2,
            variant: "danger",
            isPending: pendingDelete,
            onClick: handleBulkDelete,
          },
        ]}
      />

      {showNew && <NewCustomerDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

function InlineEditCell({
  value,
  onSave,
  type = "text",
  className = "",
}: {
  value: string;
  onSave: (val: string) => Promise<void>;
  type?: "text" | "email" | "tel";
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, startSaving] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    startSaving(async () => {
      await onSave(draft);
      setEditing(false);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        dir={type === "email" || type === "tel" ? "ltr" : undefined}
        className={`border-navy text-navy focus:ring-navy/20 w-full rounded border bg-white px-2 py-0.5 text-sm outline-none focus:ring-2 disabled:opacity-60 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={start}
      title="לחץ לעריכה"
      className={`hover:bg-cream-deep group/cell inline-flex cursor-text items-center gap-1 rounded px-1 py-0.5 transition-colors ${className}`}
    >
      <span className={value ? "" : "text-ink-faded"}>{value || "—"}</span>
      <Pencil
        size={11}
        className="text-ink-faded shrink-0 opacity-0 transition-opacity group-hover/cell:opacity-100"
      />
    </span>
  );
}

function InlineBillingCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (val: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();

  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null;
    startSaving(async () => {
      await onSave(val);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={value ?? ""}
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        className="border-navy text-navy focus:ring-navy/20 rounded border bg-white px-2 py-0.5 text-xs outline-none focus:ring-2"
      >
        <option value="">—</option>
        {BILLING_OPTIONS.map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={start}
      title="לחץ לעריכה"
      className="hover:bg-cream-deep group/cell inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors"
    >
      <span className={value ? "text-ink-soft" : "text-ink-faded"}>
        {value ? (BILLING_LABELS[value] ?? value) : "—"}
      </span>
      <ChevronDown
        size={11}
        className="text-ink-faded shrink-0 opacity-0 transition-opacity group-hover/cell:opacity-100"
      />
    </span>
  );
}

function TableRow({
  customer: c,
  selected,
  onToggleSelect,
  onNavigate,
  onSaved,
}: {
  customer: Customer;
  selected: boolean;
  onToggleSelect: () => void;
  onNavigate: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();

  const save = async (field: string, val: string | null) => {
    const result = await quickUpdateCustomer(c.id, { [field]: val });
    if (result.error) toast.error(result.error);
    else onSaved();
  };

  return (
    <tr
      className={`border-ink-line cursor-pointer border-t transition-colors ${selected ? "bg-navy/5" : "hover:bg-cream-deep/40"}`}
      onClick={onNavigate}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer rounded"
        />
      </td>
      <td className="px-4 py-3 font-medium">
        <InlineEditCell
          value={c.name}
          onSave={(v) => save("name", v)}
          className="text-navy font-semibold"
        />
      </td>
      <td className="text-ink-soft px-4 py-3">
        <InlineEditCell value={c.company ?? ""} onSave={(v) => save("company", v)} />
      </td>
      <td className="text-ink-soft px-4 py-3">
        <InlineEditCell value={c.email ?? ""} onSave={(v) => save("email", v)} type="email" />
      </td>
      <td className="px-4 py-3">
        <InlineBillingCell
          value={c.billing_model_default}
          onSave={(v) => save("billing_model_default", v)}
        />
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${c.active !== false ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-500"}`}
        >
          {c.active !== false ? "פעיל" : "לא פעיל"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(c.tags ?? []).slice(0, 3).map((t) => (
            <span key={t} className="bg-navy/5 text-ink-soft rounded-full px-2 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function CustomerCard({
  customer: c,
  selected,
  onToggleSelect,
  onSaved,
}: {
  customer: Customer;
  selected: boolean;
  onToggleSelect: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  const [draft, setDraft] = useState({
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    company: c.company ?? "",
    billing_model_default: c.billing_model_default ?? "",
  });
  const toast = useToast();

  const initials = c.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleSelect();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      billing_model_default: c.billing_model_default ?? "",
    });
    setEditing(true);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draft.name.trim()) return;
    startSaving(async () => {
      const result = await quickUpdateCustomer(c.id, {
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        company: draft.company,
        billing_model_default: draft.billing_model_default || null,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("הלקוח עודכן");
        setEditing(false);
        onSaved();
      }
    });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-cream-paper border-navy ring-navy/20 rounded-2xl border p-5 ring-2">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-navy text-sm font-semibold">עריכת לקוח</span>
          <button
            type="button"
            onClick={handleCancel}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2.5">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="שם *"
            className="border-ink-line text-navy placeholder:text-ink-faded focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <input
            type="text"
            value={draft.company}
            onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
            placeholder="חברה"
            className="border-ink-line text-navy placeholder:text-ink-faded focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
            onClick={(e) => e.stopPropagation()}
          />
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="אימייל"
            className="border-ink-line text-navy placeholder:text-ink-faded focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
            dir="ltr"
            onClick={(e) => e.stopPropagation()}
          />
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            placeholder="טלפון"
            className="border-ink-line text-navy placeholder:text-ink-faded focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
            dir="ltr"
            onClick={(e) => e.stopPropagation()}
          />
          <select
            value={draft.billing_model_default}
            onChange={(e) => setDraft((d) => ({ ...d, billing_model_default: e.target.value }))}
            className="border-ink-line text-navy focus:border-navy w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">ללא מודל חיוב</option>
            {BILLING_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="border-ink-line text-ink-soft hover:text-navy rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? <Spinner size={12} /> : <Check size={12} />}
            שמור
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/customers/${c.id}`}
      className="focus-visible:outline-navy/40 relative block focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div
        className={`bg-cream-paper group rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:shadow-sm ${
          selected ? "border-navy ring-navy/30 ring-2" : "border-ink-line hover:border-ink-soft"
        }`}
      >
        {/* Checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={selected ? "בטל בחירת לקוח" : "בחר לקוח"}
          onClick={handleCheckboxClick}
          className={`absolute end-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
            selected
              ? "bg-navy border-navy text-cream-paper"
              : "border-ink-line bg-white opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </button>

        {/* Edit pencil */}
        <button
          type="button"
          aria-label="ערוך לקוח"
          onClick={handleEditClick}
          className="text-ink-faded hover:text-navy hover:bg-cream-deep absolute end-9 top-3 z-10 rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
        >
          <Pencil size={13} />
        </button>

        <div className="mb-3 flex items-start gap-3">
          <div className="bg-navy text-cream-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-navy truncate font-semibold">{c.name}</div>
              {c.active === false && (
                <span className="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  מושבת
                </span>
              )}
            </div>
            {c.company && (
              <div className="text-ink-soft flex items-center gap-1 text-xs">
                <Building2 size={11} />
                {c.company}
              </div>
            )}
          </div>
          <StatusPill status={c.status} />
        </div>

        <div className="space-y-1">
          {c.email && (
            <div className="text-ink-soft flex items-center gap-2 text-xs">
              <Mail size={12} />
              <span className="truncate">{c.email}</span>
            </div>
          )}
          {c.phone && (
            <div className="text-ink-soft flex items-center gap-2 text-xs">
              <Phone size={12} />
              {c.phone}
            </div>
          )}
        </div>

        {c.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {c.tags.map((tag) => (
              <span
                key={tag}
                className="bg-cream border-ink-line rounded-md border px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-gray-100 text-gray-500 border-gray-200";
  const label = status === "active" ? "פעיל" : "לא פעיל";
  return (
    <span
      className={`ms-auto shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  const trimmed = query.trim();
  return (
    <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="bg-cream-deep mb-5 flex h-20 w-20 items-center justify-center rounded-full">
        <SearchX size={48} className="text-navy/60" />
      </div>
      <h3 className="text-display-sm text-navy mb-2">
        {trimmed ? "לא מצאנו לקוחות שתואמים את החיפוש" : "לא מצאנו לקוחות שתואמים את הסינון"}
      </h3>
      <p className="text-ink-soft mx-auto mb-5 max-w-md text-sm">
        {trimmed ? (
          <>
            לא נמצאו תוצאות עבור <span className="text-navy font-semibold">{`"${trimmed}"`}</span>.
            נסו ביטוי אחר או נקו את הסינון.
          </>
        ) : (
          "אף לקוח לא תואם לסינון הנוכחי. נסו לשנות את הפילטרים."
        )}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="text-navy hover:text-navy-deep inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
      >
        <X size={14} />
        נקה חיפוש וסינון
      </button>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="border-ink-line bg-cream-paper/40 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
      <div className="bg-cream-deep mb-5 flex h-20 w-20 items-center justify-center rounded-full">
        <Users size={48} className="text-navy/60" />
      </div>
      <h3 className="text-display-sm text-navy mb-2">הוסף את הלקוח הראשון</h3>
      <p className="text-ink-soft mx-auto mb-6 max-w-md text-sm leading-relaxed">
        כאן תנהל את כל הלקוחות שלך — פרטי קשר, פעילויות, תגיות והיסטוריה במקום אחד.
      </p>
      <button
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        לקוח חדש
      </button>
    </div>
  );
}
