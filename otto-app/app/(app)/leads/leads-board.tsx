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
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { NewLeadDialog } from "./new-lead-dialog";
import { updateLeadStatus, exportLeadsCsv } from "./actions";
import { ExportCsvButton } from "@/components/ui/export-csv-button";

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

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
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
  }, [leads, query, source, statusFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setTags(
      selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag],
    );
  };

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
      <div className="mb-6 flex items-start justify-between">
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
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilterAndUrl(key)}
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
      ) : (
        <div className="space-y-6">
          {STATUSES.map(({ key, label, color }) => {
            const group = filteredLeads.filter((l) => l.status === key);
            if (group.length === 0) return null;
            return (
              <div key={key}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
                  >
                    {label}
                  </span>
                  <span className="text-ink-faded text-xs">{group.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewLeadDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const [, startTransition] = useTransition();

  const status = STATUSES.find((s) => s.key === lead.status);
  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  function handleStatusChange(next: string) {
    startTransition(async () => {
      await updateLeadStatus(lead.id, next);
    });
  }

  return (
    <div className="bg-cream-paper border-ink-line hover:border-ink-soft rounded-2xl border p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start gap-3">
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
