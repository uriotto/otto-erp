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
      {/* Mobile: לוגו + כפתורים בשורה אחת */}
      <div className="flex items-center justify-between lg:hidden">
        <div dir="ltr" className="flex items-baseline gap-1">
          <span className="text-navy text-2xl font-extrabold tracking-tight">OTTO</span>
          <span className="bg-accent mb-0.5 inline-block h-1.5 w-1.5 rounded-full" aria-hidden />
        </div>
        <div className="flex items-center gap-2">
          <Timer />
          <NotificationBell />
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="bg-cream-paper shadow-card text-ink-soft hover:text-navy flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all"
              aria-label="פתח תפריט"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop: greeting מלא */}
      <div className="hidden items-start gap-3 lg:flex">
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

      <div className="hidden flex-1 items-center justify-end gap-2 lg:flex lg:max-w-[600px]">
        <Timer />
        <NotificationBell />

        <div className="flex-1 lg:w-[380px] lg:flex-none">
          <HeaderSearch />
        </div>

        <Link
          href="/settings"
          aria-label="הגדרות"
          className="group bg-cream-paper shadow-card text-ink-soft hover:text-navy flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all hover:shadow-md"
        >
          <Settings className="h-[17px] w-[17px] transition-transform duration-300 ease-out group-hover:rotate-90" />
        </Link>
      </div>
    </header>
  );
}
