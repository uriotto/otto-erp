"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, TrendingUp, FileText, Loader2, Clock } from "lucide-react";
import type { SearchResults, SearchResultItem } from "@/app/api/search/route";
import { clearRecent, getRecent, type RecentItem } from "./recent-items";

const RECENT_LIMIT = 8;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    customers: [],
    leads: [],
    projects: [],
    tasks: [],
    documents: [],
  });
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const showRecent = query.trim().length < 2;

  // Open with Cmd+K / Ctrl+K, או דרך event מ-header
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function onOpenEvent(e: Event) {
      setOpen(true);
      if (e instanceof CustomEvent && typeof e.detail?.query === "string" && e.detail.query) {
        setQuery(e.detail.query);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("otto:command-palette:open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("otto:command-palette:open", onOpenEvent);
    };
  }, [open]);

  // Focus on open + load recent items
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        // move cursor to end of any pre-filled query
        el.setSelectionRange(el.value.length, el.value.length);
      }, 50);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(getRecent(RECENT_LIMIT));
    } else {
      setQuery("");
      setResults({ customers: [], leads: [], projects: [], tasks: [], documents: [] });
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ customers: [], leads: [], projects: [], tasks: [], documents: [] });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSearchError(false);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!cancelled) {
          if (res.ok) {
            const data = (await res.json()) as SearchResults;
            setResults(data);
            setActiveIndex(0);
            setSearchError(false);
          } else {
            setSearchError(true);
          }
        }
      } catch {
        if (!cancelled) setSearchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const searchFlatList: SearchResultItem[] = useMemo(
    () => [
      ...results.customers,
      ...results.leads,
      ...results.projects,
      ...results.tasks,
      ...results.documents,
    ],
    [results],
  );

  const navItemsLength = showRecent ? recent.length : searchFlatList.length;

  // Reset active index when switching mode or recent list changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [showRecent, recent.length]);

  function navigateSearch(item: SearchResultItem) {
    setOpen(false);
    router.push(item.href);
  }

  function navigateRecent(item: RecentItem) {
    setOpen(false);
    const href = item.type === "customer" ? `/customers/${item.id}` : `/leads/${item.id}`;
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(navItemsLength - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showRecent) {
        const item = recent[activeIndex];
        if (item) navigateRecent(item);
      } else {
        const item = searchFlatList[activeIndex];
        if (item) navigateSearch(item);
      }
    }
  }

  function handleClearRecent() {
    clearRecent();
    setRecent([]);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      style={{ background: "oklch(17% 0.025 237 / 0.35)", backdropFilter: "blur(2px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-cream-paper w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(0,63,124,0.1), 0 8px 32px rgba(0,31,60,0.2), 0 2px 8px rgba(0,0,0,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* search bar */}
        <div className="border-ink-line relative flex items-center gap-3 border-b px-5">
          <Search size={16} className="text-ink-faded shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="חפש לקוחות, לידים, פרויקטים, משימות..."
            dir="rtl"
            className="placeholder:text-ink-faded text-navy min-w-0 flex-1 bg-transparent py-4 text-[15px] outline-none"
          />
          {loading && <Loader2 size={14} className="text-ink-faded shrink-0 animate-spin" />}
          <kbd className="border-ink-line text-ink-faded shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium">
            esc
          </kbd>
        </div>

        {/* results */}
        <div className="max-h-[55vh] overflow-y-auto">
          {showRecent ? (
            <RecentSection
              recent={recent}
              activeIndex={activeIndex}
              onSelect={navigateRecent}
              onHover={setActiveIndex}
              onClear={handleClearRecent}
            />
          ) : searchError ? (
            <div className="text-ink-soft px-5 py-10 text-center text-sm">
              שגיאה בחיפוש — נסה שוב
            </div>
          ) : searchFlatList.length === 0 && !loading ? (
            <div className="text-ink-soft px-5 py-10 text-center text-sm">לא נמצאו תוצאות</div>
          ) : (
            <>
              <ResultGroup
                title="לקוחות"
                icon={<Users size={12} className="text-navy/60" />}
                items={results.customers}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="לידים"
                icon={<TrendingUp size={12} className="text-navy/60" />}
                items={results.leads}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="פרויקטים"
                icon={<FileText size={12} className="text-navy/60" />}
                items={results.projects}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="משימות"
                icon={<FileText size={12} className="text-navy/60" />}
                items={results.tasks}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="מסמכים"
                icon={<FileText size={12} className="text-navy/60" />}
                items={results.documents}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
            </>
          )}
        </div>

        {/* footer hints */}
        <div className="border-ink-line text-ink-faded flex items-center gap-5 border-t px-5 py-2.5 text-[11px]">
          <span className="flex items-center gap-1">
            <kbd className="border-ink-line rounded border px-1 py-px font-mono text-[9px]">↑↓</kbd>
            ניווט
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border-ink-line rounded border px-1 py-px font-mono text-[9px]">⏎</kbd>
            בחר
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border-ink-line rounded border px-1 py-px font-mono text-[9px]">
              esc
            </kbd>
            סגור
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentSection({
  recent,
  activeIndex,
  onSelect,
  onHover,
  onClear,
}: {
  recent: RecentItem[];
  activeIndex: number;
  onSelect: (item: RecentItem) => void;
  onHover: (idx: number) => void;
  onClear: () => void;
}) {
  if (recent.length === 0) {
    return (
      <div className="text-ink-faded px-5 py-10 text-center text-sm">הקלד לחיפוש או בחר ⌘K</div>
    );
  }

  return (
    <div className="border-ink-line border-b last:border-b-0">
      <div className="text-micro text-ink-faded flex items-center justify-between px-5 py-2.5 uppercase">
        <span className="flex items-center gap-1.5">
          <Clock size={12} />
          אחרון
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-ink-faded hover:text-navy text-[10px] normal-case transition-colors"
        >
          נקה
        </button>
      </div>
      {recent.map((item, idx) => {
        const isActive = idx === activeIndex;
        const typeLabel = item.type === "customer" ? "לקוח" : "ליד";
        return (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(idx)}
            className={`flex w-full items-center gap-3 px-5 py-2.5 text-right transition-colors ${
              isActive ? "bg-navy/[0.05]" : "hover:bg-cream"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-navy truncate text-[13px] font-medium">{item.label}</div>
              <div className="text-ink-faded truncate text-[11px]">
                {typeLabel}
                {item.sublabel ? ` · ${item.sublabel}` : ""}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ResultGroup({
  title,
  icon,
  items,
  flatList,
  activeIndex,
  onSelect,
  onHover,
}: {
  title: string;
  icon: React.ReactNode;
  items: SearchResultItem[];
  flatList: SearchResultItem[];
  activeIndex: number;
  onSelect: (item: SearchResultItem) => void;
  onHover: (idx: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-ink-line border-b last:border-b-0">
      <div className="text-micro text-ink-faded flex items-center gap-1.5 px-5 py-2.5 uppercase">
        {icon}
        {title}
      </div>
      {items.map((item) => {
        const idx = flatList.findIndex((i) => i.id === item.id && i.type === item.type);
        const isActive = idx === activeIndex;
        return (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(idx)}
            className={`flex w-full items-center gap-3 px-5 py-2.5 text-right transition-colors ${
              isActive ? "bg-navy/[0.05]" : "hover:bg-cream"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-navy truncate text-[13px] leading-snug font-medium">
                {item.title}
              </div>
              {item.subtitle && (
                <div className="text-ink-faded truncate text-[11px] leading-snug">
                  {item.subtitle}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
