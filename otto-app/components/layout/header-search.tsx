"use client";

import { useRef } from "react";
import { Search } from "lucide-react";

export function HeaderSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = (query?: string) => {
    window.dispatchEvent(
      new CustomEvent("otto:command-palette:open", { detail: { query: query ?? "" } }),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      inputRef.current?.blur();
      return;
    }
    // כל הקלדה — פותח את ה-palette עם מה שהוקלד
    const char = e.key.length === 1 ? e.key : "";
    if (char) {
      e.preventDefault();
      openPalette(char);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      openPalette((e.currentTarget as HTMLInputElement).value);
    }
  };

  return (
    <div className="relative w-full max-w-[400px]">
      <Search className="text-ink-faded pointer-events-none absolute end-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
      <input
        ref={inputRef}
        type="text"
        readOnly
        onClick={() => openPalette()}
        onFocus={() => openPalette()}
        onKeyDown={handleKeyDown}
        placeholder="חפש או לחץ ⌘K"
        dir="rtl"
        aria-label="חיפוש (Cmd+K)"
        className="bg-cream-paper border-ink-line text-navy placeholder:text-ink-faded focus:border-navy flex h-10 w-full cursor-pointer items-center rounded-full border px-4 pe-10 text-sm transition-colors outline-none focus:shadow-sm"
      />
    </div>
  );
}
