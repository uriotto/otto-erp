"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Users, FolderKanban, CheckSquare, FileText, UserPlus } from "lucide-react";
import type { SearchResultItem, SearchResults } from "@/app/api/search/route";

const TYPE_LABELS: Record<SearchResultItem["type"], string> = {
  customer: "לקוחות",
  lead: "לידים",
  project: "פרויקטים",
  task: "משימות",
  document: "מסמכים",
};

const TYPE_ORDER: SearchResultItem["type"][] = ["customer", "lead", "project", "task", "document"];

function TypeIcon({ type }: { type: SearchResultItem["type"] }) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "customer":
      return <Users className={cls} />;
    case "lead":
      return <UserPlus className={cls} />;
    case "project":
      return <FolderKanban className={cls} />;
    case "task":
      return <CheckSquare className={cls} />;
    case "document":
      return <FileText className={cls} />;
  }
}

function ResultSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((g) => (
        <div key={g}>
          <div className="bg-ink-line mb-3 h-4 w-20 animate-pulse rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-cream-paper border-ink-line flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="bg-ink-line h-8 w-8 animate-pulse rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="bg-ink-line h-3.5 w-40 animate-pulse rounded" />
                  <div className="bg-ink-line h-3 w-24 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchClient() {
  const searchParams = useSearchParams();

  const query = searchParams.get("q")?.trim() ?? "";
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  // fetch when query (URL param) changes
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data: SearchResults) => {
        setResults(data);
      })
      .catch(() => {
        setResults(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [query]);

  // build grouped sections in fixed order
  const sections = results
    ? TYPE_ORDER.map((type) => ({
        type,
        label: TYPE_LABELS[type],
        items: (results[type as keyof SearchResults] ?? []) as SearchResultItem[],
      })).filter((s) => s.items.length > 0)
    : [];

  const totalCount = sections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="mx-auto max-w-2xl">
      {/* כותרת */}
      <div className="mb-8">
        <h1 className="text-display-md text-navy">חיפוש</h1>
        {query.length >= 2 && !loading && (
          <p className="text-ink-soft mt-1 text-sm">
            {totalCount > 0
              ? `${totalCount} תוצאות עבור "${query}"`
              : `לא נמצאו תוצאות עבור "${query}"`}
          </p>
        )}
      </div>

      {/* תוכן */}
      {loading && !results && <ResultSkeleton />}

      {!loading && query.length >= 2 && totalCount === 0 && (
        <div className="py-16 text-center">
          <Search className="text-ink-faded mx-auto mb-4 h-10 w-10" />
          <p className="text-ink-soft text-lg font-medium">לא נמצאו תוצאות עבור "{query}"</p>
          <p className="text-ink-faded mt-1 text-sm">נסה מילות חיפוש אחרות</p>
        </div>
      )}

      {!loading && query.length < 2 && (
        <div className="py-16 text-center">
          <Search className="text-ink-faded mx-auto mb-4 h-10 w-10" />
          <p className="text-ink-soft text-base">חפש לקוחות, פרויקטים, משימות, מסמכים ולידים</p>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-7">
          {sections.map(({ type, label, items }) => (
            <section key={type}>
              <h2 className="text-ink-soft mb-2.5 pe-1 text-xs font-semibold tracking-wider uppercase">
                {label}
              </h2>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="bg-cream-paper border-ink-line hover:border-navy group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-sm"
                    >
                      <span className="bg-cream-deep text-ink-soft group-hover:text-navy flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors">
                        <TypeIcon type={item.type} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-navy block truncate text-sm leading-snug font-medium">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="text-ink-faded block truncate text-xs leading-snug">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
