"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, TrendingUp, FileText, Loader2, Clock } from "lucide-react";
import type { SearchResults, SearchResultItem } from "@/app/api/search/route";
import { clearRecent, getRecent, type RecentItem } from "./recent-items";

const RECENT_LIMIT = 8;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    customers: [],
    leads: [],
    activities: [],
  });
  const [loading, setLoading] = useState(false);
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
    function onOpenEvent() {
      setOpen(true);
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
      setTimeout(() => inputRef.current?.focus(), 50);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(getRecent(RECENT_LIMIT));
    } else {
       
      setQuery("");
      setResults({ customers: [], leads: [], activities: [] });
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ customers: [], leads: [], activities: [] });
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as SearchResults;
          setResults(data);
          setActiveIndex(0);
        }
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
    () => [...results.customers, ...results.leads, ...results.activities],
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]">
      <div
        className="bg-cream w-full max-w-xl overflow-hidden rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-ink-line relative flex items-center border-b">
          <Search size={18} className="text-ink-soft absolute right-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="חפש לקוחות, לידים, פעילויות..."
            className="placeholder:text-ink-faded text-navy w-full bg-transparent py-4 ps-12 pe-4 text-base outline-none"
          />
          {loading && (
            <Loader2 size={16} className="text-ink-faded absolute left-12 animate-spin" />
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-ink-faded hover:text-navy absolute left-4 transition-colors"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {showRecent ? (
            <RecentSection
              recent={recent}
              activeIndex={activeIndex}
              onSelect={navigateRecent}
              onHover={setActiveIndex}
              onClear={handleClearRecent}
            />
          ) : searchFlatList.length === 0 && !loading ? (
            <div className="text-ink-soft px-4 py-8 text-center text-sm">לא נמצאו תוצאות</div>
          ) : (
            <>
              <ResultGroup
                title="לקוחות"
                icon={<Users size={13} className="text-blue-600" />}
                items={results.customers}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="לידים"
                icon={<TrendingUp size={13} className="text-purple-600" />}
                items={results.leads}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="פעילויות"
                icon={<FileText size={13} className="text-gray-600" />}
                items={results.activities}
                flatList={searchFlatList}
                activeIndex={activeIndex}
                onSelect={navigateSearch}
                onHover={setActiveIndex}
              />
            </>
          )}
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
      <div className="text-ink-soft px-4 py-8 text-center text-sm">
        אין פעילות אחרונה
        <div className="text-ink-faded mt-2 text-xs">
          הקלד לפחות 2 תווים לחיפוש{" "}
          <kbd className="bg-cream-paper border-ink-line rounded border px-1.5 py-0.5 text-[10px]">
            ↑
          </kbd>{" "}
          <kbd className="bg-cream-paper border-ink-line rounded border px-1.5 py-0.5 text-[10px]">
            ↓
          </kbd>{" "}
          לניווט,{" "}
          <kbd className="bg-cream-paper border-ink-line rounded border px-1.5 py-0.5 text-[10px]">
            Enter
          </kbd>{" "}
          לבחירה
        </div>
      </div>
    );
  }

  return (
    <div className="border-ink-line border-b last:border-b-0">
      <div className="text-micro text-ink-faded flex items-center justify-between px-4 py-2 uppercase">
        <span className="flex items-center gap-1.5">
          <Clock size={13} className="text-ink-soft" />
          פריטים אחרונים
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
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors ${
              isActive ? "bg-navy/5" : "hover:bg-cream-paper"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-navy truncate text-sm font-medium">{item.label}</div>
              <div className="text-ink-faded truncate text-xs">
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
      <div className="text-micro text-ink-faded flex items-center gap-1.5 px-4 py-2 uppercase">
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
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors ${
              isActive ? "bg-navy/5" : "hover:bg-cream-paper"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-navy truncate text-sm font-medium">{item.title}</div>
              {item.subtitle && (
                <div className="text-ink-faded truncate text-xs">{item.subtitle}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
