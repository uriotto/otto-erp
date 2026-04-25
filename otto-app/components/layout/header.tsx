"use client";

import { Menu, Search, Settings } from "lucide-react";

type Props = {
  greeting: string;
  displayName: string;
  subline?: string;
  onMenuClick?: () => void;
};

export function AppHeader({ greeting, displayName, subline, onMenuClick }: Props) {
  return (
    <header className="mb-9 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex h-10 w-10 items-center justify-center rounded-full border transition-colors lg:hidden"
            aria-label="פתח תפריט"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div>
          <h1 className="text-display-lg text-navy">
            {greeting}, {displayName}
          </h1>
          {subline && (
            <span className="font-caveat text-ink-faded mt-1 inline-block text-[22px]" dir="auto">
              {subline}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="bg-cream-paper border-ink-line text-navy hover:border-navy hidden items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors sm:flex">
          <span className="bg-navy h-2 w-2 animate-pulse rounded-full" aria-hidden />
          <span dir="ltr">00:00:00</span>
          <span className="text-ink-faded text-xs font-medium">— אין טיימר פעיל</span>
        </div>

        <button
          type="button"
          aria-label="חיפוש"
          className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          aria-label="הגדרות"
          className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
