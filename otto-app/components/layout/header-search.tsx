"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Search } from "lucide-react";

export function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      navigate(value);
    }
    if (e.key === "Escape") {
      setValue("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-[400px]">
      <Search className="text-ink-faded pointer-events-none absolute end-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="חפש או לחץ ⌘K"
        dir="rtl"
        aria-label="חיפוש (Cmd+K)"
        className="bg-cream-paper border-ink-line text-navy placeholder:text-ink-faded focus:border-navy flex h-10 w-full items-center rounded-full border px-4 pe-10 text-sm transition-colors outline-none focus:shadow-sm"
      />
    </div>
  );
}
