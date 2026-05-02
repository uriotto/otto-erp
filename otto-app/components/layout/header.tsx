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
    <header className="border-ink-line mb-8 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="bg-cream-paper shadow-card text-ink-soft hover:text-navy flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all hover:shadow-md lg:hidden"
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
            <span className="font-caveat text-accent mt-0.5 inline-block text-[21px]" dir="auto">
              {subline}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:max-w-[600px]">
        <Timer />
        <NotificationBell />

        <div className="flex-1 md:w-[380px] md:flex-none">
          <HeaderSearch />
        </div>

        <Link
          href="/settings"
          aria-label="הגדרות"
          className="bg-cream-paper shadow-card text-ink-soft hover:text-navy flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all hover:shadow-md"
        >
          <Settings className="h-[17px] w-[17px]" />
        </Link>
      </div>
    </header>
  );
}
