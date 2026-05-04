"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Mail,
  Phone,
  Building2,
  TrendingUp,
  Search,
  X,
  Filter,
  Sparkles,
  SearchX,
  Trash2,
  Table2,
  KanbanSquare,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { NewLeadDialog } from "./new-lead-dialog";
import {
  updateLeadStatus,
  exportLeadsCsv,
  bulkDeleteLeads,
  bulkUpdateLeadsStatus,
} from "./actions";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { useToast } from "@/components/ui/toast";
import { ViewToggle, useStoredView } from "@/components/ui/view-toggle";

type Lead = Tables<"leads">;

const ALL_SOURCES = "__all__";
const SEARCH_DEBOUNCE_MS = 200;

const STATUSES: { key: Lead["status"]; label: string; color: string }[] = [
  { key: "new", label: "חדש", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { key: "contacted", label: "יצרנו קשר", color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  { key: "qualified", label: "מוכשר", color: "bg-purple-50 border-purple-200 text-purple-700" },
  { key: "proposal", label: "הצעה", color: "bg-orange-50 border-orange-200 text-orange-700" },
  { key: "won", label: "נסגר ✓", color: "bg-green-50 border-green-200 text-green-700" },
  { key: "lost", label: "הפסד", color: "bg-gray-100 border-gray-200 text-gray-500" },
];

const STATUS_KEYS = STATUSES.map((s) => s.key) as Lead["status"][];

function parseTags(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function parseStatusFilter(value: string | null): Lead["status"] | "all" {
  if (!value) return "all";
  if ((STATUS_KEYS as string[]).includes(value)) return value as Lead["status"];
  return "all";
}

export function LeadsBoard({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [source, setSource] = useState<string>(() => searchParams.get("source") ?? ALL_SOURCES);
  const [statusFilter, setStatusFilter] = useState<Lead["status"] | "all">(() =>
    parseStatusFilter(searchParams.get("status")),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    parseTags(searchParams.get("tags")),
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkPending, startBulk] = useTransition();
  const toast = useToast();
  const [view, setView] = useStoredView<"kanban" | "table">("leads-view", "kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Lead["status"] | null>(null);
  const [, startDrag] = useTransition();
  const [optimisticStatuses, setOptimisticStatuses] = useState<Map<string, Lead["status"]>>(
    new Map(),
  );

  useEffect(() => {
    if (optimisticStatuses.size === 0) return;
    setOptimisticStatuses((prev) => {
      const next = new Map(prev);
      for (const [id, status] of next) {
        const lead = leads.find((l) => l.id === id);
        if (lead && lead.status === status) next.delete(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [leads]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

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

  // Debounced URL update for the search query
  useEffect(() => {
    const handle = setTimeout(() => {
      updateUrl({ q: query.trim() || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setSourceAndUrl = (next: string) => {
    setSource(next);
    updateUrl({ source: next === ALL_SOURCES ? undefined : next });
  };

  const setStatusFilterAndUrl = (next: Lead["status"] | "all") => {
    setStatusFilter(next);
    updateUrl({ status: next === "all" ? undefined : next });
  };

  const setTags = (next: string[]) => {
    setSelectedTags(next);
    updateUrl({ tags: next.length > 0 ? next.join(",") : undefined });
  };

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      const s = lead.source?.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [leads]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      for (const tag of lead.tags ?? []) {
        const t = tag.trim();
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [leads]);

  const effectiveLeads = useMemo(
    () =>
      leads.map((l) =>
        optimisticStatuses.has(l.id) ? { ...l, status: optimisticStatuses.get(l.id)! } : l,
      ),
    [leads, optimisticStatuses],
  );

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return effectiveLeads.filter((lead) => {
      if (source !== ALL_SOURCES && (lead.source ?? "") !== source) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (selectedTags.length > 0) {
        const tags = lead.tags ?? [];
        if (!selectedTags.some((t) => tags.includes(t))) return false;
      }
      if (!q) return true;
      const haystack = [lead.name, lead.email, lead.phone, lead.company]
        .filter((v): v is string => Boolean(v))
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [effectiveLeads, query, source, statusFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setTags(
      selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag],
    );
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  const activeLeads = filteredLeads.filter((l) => l.status !== "won" && l.status !== "lost");
  const totalValue = activeLeads.reduce((sum, l) => sum + (l.value ?? 0), 0);

  const hasFilters =
    query.trim().length > 0 ||
    source !== ALL_SOURCES ||
    statusFilter !== "all" ||
    selectedTags.length > 0;

  const clearFilters = () => {
    setQuery("");
    setSource(ALL_SOURCES);
    setStatusFilter("all");
    setSelectedTags([]);
    updateUrl({ q: undefined, source: undefined, status: undefined, tags: undefined });
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-navy">לידים</h1>
          <div className="text-ink-soft mt-1 flex items-center gap-3 text-sm">
            <span>
              {hasFilters
                ? `מציג ${filteredLeads.length} מתוך ${leads.length} לידים`
                : `${leads.length} לידים`}
            </span>
            {totalValue > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp size={13} />
                {totalValue.toLocaleString("he-IL")} ₪ פוטנציאל
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            storageKey="leads-view"
            views={[
              { id: "kanban", icon: KanbanSquare, label: "קנבן" },
              { id: "table", icon: Table2, label: "טבלה" },
            ]}
            defaultView="kanban"
            current={view}
            onChange={setView}
          />
          <ExportCsvButton label="ייצא CSV" action={exportLeadsCsv} />
          <button
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            ליד חדש
          </button>
        </div>
      </div>

      {leads.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="text-ink-faded pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, אימייל, טלפון או חברה"
              className="bg-cream-paper border-ink-line text-navy placeholder:text-ink-faded focus:border-navy w-full rounded-xl border py-2.5 ps-10 pe-10 text-sm transition-colors outline-none"
            />
            {query.length > 0 && (
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
          <div className="relative sm:w-56">
            <Filter
              size={16}
              className="text-ink-faded pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
            />
            <select
              value={source}
              onChange={(e) => setSourceAndUrl(e.target.value)}
              className="bg-cream-paper border-ink-line text-navy focus:border-navy w-full appearance-none rounded-xl border py-2.5 ps-10 pe-3 text-sm transition-colors outline-none"
            >
              <option value={ALL_SOURCES}>כל המקורות</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {leads.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilterAndUrl("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-navy text-cream-paper border-navy"
                : "bg-cream-paper text-ink-soft border-ink-line hover:border-ink-soft"
            }`}
          >
            כל הסטטוסים
          </button>
          {STATUSES.map(({ key, label }) => {
            const isActive = statusFilter === key;
            const count = statusCounts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilterAndUrl(key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-navy text-cream-paper border-navy"
                    : "bg-cream-paper text-ink-soft border-ink-line hover:border-ink-soft"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? "bg-cream-paper/20 text-cream-paper" : "bg-ink-line/40 text-ink-soft"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {leads.length > 0 && availableTags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
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

      {leads.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : filteredLeads.length === 0 ? (
        <NoResults query={query} onClear={clearFilters} />
      ) : view === "table" ? (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={() => {
                      if (selected.size === filteredLeads.length) {
                        setSelected(new Set());
                      } else {
                        setSelected(new Set(filteredLeads.map((l) => l.id)));
                      }
                    }}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">שם</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">חברה</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">מקור</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">ציון</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תגיות</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תאריך</th>
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {filteredLeads.map((lead) => {
                const status = STATUSES.find((s) => s.key === lead.status);
                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors ${selected.has(lead.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelected(lead.id)}
                        className="cursor-pointer rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-navy font-medium hover:underline"
                      >
                        {lead.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-soft text-xs">{lead.company ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {status && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-soft text-xs">{lead.source ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.value != null ? (
                        <span className="text-navy text-xs font-medium" dir="ltr">
                          ₪{lead.value.toLocaleString("he-IL")}
                        </span>
                      ) : (
                        <span className="text-ink-faded text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(lead.tags ?? []).slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="bg-navy/5 text-ink-soft rounded-full px-1.5 py-0.5 text-[10px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-soft text-xs">
                        {new Date(lead.created_at).toLocaleDateString("he-IL")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 pb-4">
          {STATUSES.map(({ key, label, color }) => {
            const group = filteredLeads.filter((l) => l.status === key);
            const isOver = dragOverStatus === key;
            return (
              <div
                key={key}
                className={`flex min-w-0 flex-1 flex-col rounded-2xl border transition-colors duration-150 ${
                  isOver ? "border-navy/40 bg-navy/5" : "border-ink-line bg-cream-paper/60"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStatus(key);
                }}
                onDragLeave={(e) => {
                  const related = e.relatedTarget as Node | null;
                  if (!related || !e.currentTarget.contains(related)) {
                    setDragOverStatus(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = draggingId;
                  setDraggingId(null);
                  setDragOverStatus(null);
                  if (!id) return;
                  const lead = effectiveLeads.find((l) => l.id === id);
                  if (!lead || lead.status === key) return;
                  const prevStatus = lead.status;
                  setOptimisticStatuses((prev) => new Map(prev).set(id, key));
                  startDrag(async () => {
                    const res = await updateLeadStatus(id, key);
                    if (res?.error) {
                      setOptimisticStatuses((prev) => new Map(prev).set(id, prevStatus));
                      toast.error(res.error);
                    }
                  });
                }}
              >
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
                  >
                    {label}
                  </span>
                  <span className="text-ink-faded text-xs">{group.length}</span>
                </div>
                <div
                  className="flex flex-col gap-2 overflow-y-auto p-2 pt-1"
                  style={{ maxHeight: "calc(100vh - 300px)", minHeight: "5rem" }}
                >
                  {group.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isSelected={selected.has(lead.id)}
                      onToggleSelect={() => toggleSelected(lead.id)}
                      isDragging={draggingId === lead.id}
                      onDragStart={() => setDraggingId(lead.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                    />
                  ))}
                  {group.length === 0 && (
                    <div className="text-ink-faded flex flex-1 items-center justify-center rounded-xl border border-dashed border-current/20 py-8 text-xs">
                      גרור לכאן
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bg-navy text-cream-paper fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-5 py-3 shadow-lg">
          <span className="text-sm font-semibold">{selected.size} נבחרו</span>
          <div className="bg-cream-paper/20 h-5 w-px" />
          <select
            disabled={bulkPending}
            defaultValue=""
            onChange={(e) => {
              const status = e.target.value;
              if (!status) return;
              const ids = Array.from(selected);
              startBulk(async () => {
                const res = await bulkUpdateLeadsStatus(ids, status);
                if (res.error) toast.error(res.error);
                else {
                  toast.success(`עודכנו ${res.count ?? ids.length} לידים`);
                  clearSelection();
                }
              });
              e.target.value = "";
            }}
            className="bg-cream-paper/10 border-cream-paper/30 text-cream-paper rounded-lg border px-2 py-1 text-xs outline-none disabled:opacity-50"
          >
            <option value="" className="text-navy">
              שנה סטטוס ל...
            </option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key} className="text-navy">
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={bulkPending}
            onClick={() => {
              const ids = Array.from(selected);
              if (!confirm(`למחוק ${ids.length} לידים?`)) return;
              startBulk(async () => {
                const res = await bulkDeleteLeads(ids);
                if (res.error) toast.error(res.error);
                else {
                  toast.success(`נמחקו ${res.count ?? ids.length} לידים`);
                  clearSelection();
                }
              });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-rose-500/90 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-rose-500 disabled:opacity-50"
          >
            <Trash2 size={13} />
            מחק
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={bulkPending}
            className="text-cream-paper/80 hover:text-cream-paper text-xs underline disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      )}

      {showNew && <NewLeadDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

function LeadCard({
  lead,
  isSelected,
  onToggleSelect,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  isSelected: boolean;
  onToggleSelect: () => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);

  const status = STATUSES.find((s) => s.key === lead.status);
  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  function handleStatusChange(next: string) {
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
    startTransition(async () => {
      await updateLeadStatus(lead.id, next);
    });
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`bg-cream-paper cursor-grab rounded-2xl border p-4 transition-all duration-200 ease-out active:cursor-grabbing ${
        isDragging ? "scale-95 opacity-40 shadow-lg" : "hover:-translate-y-0.5 hover:shadow-md"
      } ${
        isSelected ? "border-navy ring-navy/20 ring-2" : "border-ink-line hover:border-ink-soft"
      } ${flash ? "bg-navy/5 scale-[0.99]" : ""}`}
    >
      <div className="mb-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label="בחר ליד"
          className="accent-navy mt-1 h-4 w-4 shrink-0 cursor-pointer"
        />
        <div className="bg-cream border-ink-line flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold text-gray-600">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="text-navy font-semibold hover:underline">
            {lead.name}
          </Link>
          {lead.company && (
            <div className="text-ink-soft flex items-center gap-1 text-xs">
              <Building2 size={11} />
              {lead.company}
            </div>
          )}
        </div>
        {lead.value && (
          <span className="text-navy shrink-0 text-xs font-semibold">
            ₪{lead.value.toLocaleString("he-IL")}
          </span>
        )}
      </div>

      <div className="mb-3 space-y-1">
        {lead.email && (
          <div className="text-ink-soft flex items-center gap-2 text-xs">
            <Mail size={11} />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="text-ink-soft flex items-center gap-2 text-xs">
            <Phone size={11} />
            {lead.phone}
          </div>
        )}
      </div>

      <select
        defaultValue={lead.status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className={`w-full rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors outline-none ${status?.color ?? ""}`}
      >
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
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
        {trimmed ? "לא מצאנו לידים שתואמים את החיפוש" : "לא מצאנו לידים שתואמים את הסינון"}
      </h3>
      <p className="text-ink-soft mx-auto mb-5 max-w-md text-sm">
        {trimmed ? (
          <>
            לא נמצאו תוצאות עבור <span className="text-navy font-semibold">{`"${trimmed}"`}</span>.
            נסו ביטוי אחר או נקו את הסינון.
          </>
        ) : (
          "אף ליד לא תואם לסינון הנוכחי. נסו לשנות את המקור או התגיות."
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
        <Sparkles size={48} className="text-navy/60" />
      </div>
      <h3 className="text-display-sm text-navy mb-2">התחל לעקוב אחרי לידים</h3>
      <p className="text-ink-soft mx-auto mb-6 max-w-md text-sm leading-relaxed">
        הוסיפו לידים חדשים, נהלו את הסטטוס שלהם בלוח, והמירו אותם ללקוחות בלחיצה.
      </p>
      <button
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        ליד חדש
      </button>
    </div>
  );
}
