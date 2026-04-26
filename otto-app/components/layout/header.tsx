"use client";

import Link from "next/link";
import { Menu, Settings } from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";

import { HeaderSearch } from "./header-search";
import { Timer } from "./timer";

type Props = {
  greeting: string;
  displayName: string;
  subline?: string;
  onMenuClick?: () => void;
};

export function AppHeader({ greeting, displayName, subline, onMenuClick }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors lg:hidden"
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

      <div className="flex flex-1 items-center justify-end gap-2.5 md:max-w-[640px]">
        <Timer />
        <NotificationBell />

        <div className="flex-1 md:w-[400px] md:flex-none">
          <HeaderSearch />
        </div>

        <Link
          href="/settings"
          aria-label="הגדרות"
          className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
