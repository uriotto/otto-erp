"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Mail, Phone, Building2, Search, X } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { NewCustomerDialog } from "./new-customer-dialog";

type Customer = Tables<"customers">;
type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "active", label: "פעיל" },
  { key: "inactive", label: "לא פעיל" },
];

export function CustomersList({ customers }: { customers: Customer[] }) {
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const hasCustomers = customers.length > 0;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-sm text-navy">לקוחות</h1>
          <p className="text-ink-soft mt-1 text-sm">
            {hasCustomers ? `${filtered.length} מתוך ${customers.length} לקוחות` : "0 לקוחות"}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          לקוח חדש
        </button>
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
                  onClick={() => setStatusFilter(key)}
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
              onClick={() => setSelectedTags([])}
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
        <NoResults />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CustomerCard key={c.id} customer={c} />
          ))}
        </div>
      )}

      {showNew && <NewCustomerDialog onClose={() => setShowNew(false)} />}
    </>
  );
}

function CustomerCard({ customer: c }: { customer: Customer }) {
  const initials = c.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/customers/${c.id}`}
      className="focus-visible:outline-navy/40 block focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="bg-cream-paper border-ink-line hover:border-ink-soft group rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:shadow-sm">
        <div className="mb-3 flex items-start gap-3">
          <div className="bg-navy text-cream-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-navy truncate font-semibold">{c.name}</div>
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

function NoResults() {
  return (
    <div className="border-ink-line flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <div className="bg-cream-paper mb-4 rounded-2xl p-4">
        <Search size={28} className="text-ink-faded" />
      </div>
      <p className="text-navy mb-1 font-semibold">לא נמצאו לקוחות התואמים לחיפוש</p>
      <p className="text-ink-soft text-sm">נסה לשנות את החיפוש או את הסינון</p>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="border-ink-line flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
      <div className="bg-cream-paper mb-4 rounded-2xl p-4">
        <Building2 size={32} className="text-ink-faded" />
      </div>
      <p className="text-navy mb-1 font-semibold">אין עדיין לקוחות</p>
      <p className="text-ink-soft mb-5 text-sm">הוסף את הלקוח הראשון שלך</p>
      <button
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        לקוח חדש
      </button>
    </div>
  );
}
