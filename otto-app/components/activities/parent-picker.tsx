"use client";

import { useEffect, useRef, useState } from "react";
import { User, Users, TrendingUp, Search, X } from "lucide-react";

export type ParentOption =
  | { kind: "personal" }
  | { kind: "customer"; id: string; name: string }
  | { kind: "lead"; id: string; name: string };

export type ParentSearchItem = {
  id: string;
  name: string;
  kind: "customer" | "lead";
};

export function ParentPicker({
  items,
  initial,
}: {
  items: ParentSearchItem[];
  initial?: ParentOption;
}) {
  const [selected, setSelected] = useState<ParentOption>(initial ?? { kind: "personal" });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = query
    ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  const customerId = selected.kind === "customer" ? selected.id : "";
  const leadId = selected.kind === "lead" ? selected.id : "";

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="lead_id" value={leadId} />

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="border-ink-line hover:border-navy flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm transition-colors"
      >
        <span className="flex items-center gap-2">
          {selected.kind === "personal" && (
            <>
              <User size={14} className="text-ink-soft" />
              <span>אישי (לא משויך)</span>
            </>
          )}
          {selected.kind === "customer" && (
            <>
              <Users size={14} className="text-blue-600" />
              <span>לקוח: {selected.name}</span>
            </>
          )}
          {selected.kind === "lead" && (
            <>
              <TrendingUp size={14} className="text-purple-600" />
              <span>ליד: {selected.name}</span>
            </>
          )}
        </span>
        <span className="text-ink-faded text-xs">שנה</span>
      </button>

      {open && (
        <div className="border-ink-line absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              setSelected({ kind: "personal" });
              setOpen(false);
            }}
            className="hover:bg-cream flex w-full items-center gap-2 border-b px-3 py-2 text-right text-sm transition-colors"
          >
            <User size={14} className="text-ink-soft" />
            אישי (לא משויך)
          </button>

          <div className="border-b p-2">
            <div className="relative">
              <Search
                size={12}
                className="text-ink-faded absolute top-1/2 right-2 -translate-y-1/2"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש לקוח / ליד..."
                className="border-ink-line focus:border-navy w-full rounded-md border bg-white py-1.5 ps-7 pe-2 text-xs outline-none"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 left-2 -translate-y-1/2"
                >
                  <X size={12} className="text-ink-faded hover:text-navy" />
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 && (
            <p className="text-ink-faded px-3 py-3 text-center text-xs">לא נמצאו תוצאות</p>
          )}

          {filtered.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => {
                setSelected(
                  item.kind === "customer"
                    ? { kind: "customer", id: item.id, name: item.name }
                    : { kind: "lead", id: item.id, name: item.name },
                );
                setOpen(false);
                setQuery("");
              }}
              className="hover:bg-cream flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition-colors"
            >
              {item.kind === "customer" ? (
                <Users size={13} className="shrink-0 text-blue-600" />
              ) : (
                <TrendingUp size={13} className="shrink-0 text-purple-600" />
              )}
              <span className="truncate">{item.name}</span>
              <span className="text-ink-faded ms-auto text-xs">
                {item.kind === "customer" ? "לקוח" : "ליד"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
