"use client";

import { Search } from "lucide-react";

export function HeaderSearch() {
  const open = () => {
    window.dispatchEvent(new Event("otto:command-palette:open"));
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label="חיפוש (Cmd+K)"
      className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex h-10 w-full max-w-[400px] items-center gap-2 rounded-full border px-4 transition-colors"
    >
      <Search className="h-[18px] w-[18px] shrink-0" />
      <span className="text-ink-faded flex-1 text-right text-sm">חפש או לחץ ⌘K</span>
      <kbd
        className="bg-cream-deep text-ink-faded hidden rounded px-1.5 py-0.5 text-xs md:flex"
        dir="ltr"
      >
        ⌘K
      </kbd>
    </button>
  );
}
