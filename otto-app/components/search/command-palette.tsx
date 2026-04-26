"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, TrendingUp, FileText, Loader2 } from "lucide-react";
import type { SearchResults, SearchResultItem } from "@/app/api/search/route";

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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const flatList: SearchResultItem[] = [
    ...results.customers,
    ...results.leads,
    ...results.activities,
  ];
  const total = flatList.length;

  function navigate(item: SearchResultItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(total - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatList[activeIndex];
      if (item) navigate(item);
    }
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
          {query.length < 2 ? (
            <div className="text-ink-soft px-4 py-8 text-center text-sm">
              הקלד לפחות 2 תווים לחיפוש
              <div className="text-ink-faded mt-2 text-xs">
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
                לבחירה,{" "}
                <kbd className="bg-cream-paper border-ink-line rounded border px-1.5 py-0.5 text-[10px]">
                  Esc
                </kbd>{" "}
                לסגור
              </div>
            </div>
          ) : total === 0 && !loading ? (
            <div className="text-ink-soft px-4 py-8 text-center text-sm">לא נמצאו תוצאות</div>
          ) : (
            <>
              <ResultGroup
                title="לקוחות"
                icon={<Users size={13} className="text-blue-600" />}
                items={results.customers}
                flatList={flatList}
                activeIndex={activeIndex}
                onSelect={navigate}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="לידים"
                icon={<TrendingUp size={13} className="text-purple-600" />}
                items={results.leads}
                flatList={flatList}
                activeIndex={activeIndex}
                onSelect={navigate}
                onHover={setActiveIndex}
              />
              <ResultGroup
                title="פעילויות"
                icon={<FileText size={13} className="text-gray-600" />}
                items={results.activities}
                flatList={flatList}
                activeIndex={activeIndex}
                onSelect={navigate}
                onHover={setActiveIndex}
              />
            </>
          )}
        </div>
      </div>
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
