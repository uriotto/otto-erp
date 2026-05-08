"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Clock, CalendarDays, Menu } from "lucide-react";

type Props = {
  onMenuClick: () => void;
};

const NAV_ITEMS = [
  { label: "בית", href: "/dashboard", icon: Home },
  { label: "לקוחות", href: "/customers", icon: Users },
  { label: "היום", href: "/today", icon: Clock },
  { label: "יומן", href: "/calendar", icon: CalendarDays },
] as const;

export function BottomNav({ onMenuClick }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="bg-navy-deep border-navy fixed inset-x-0 bottom-0 z-30 flex border-t lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              isActive ? "text-accent" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
            {isActive && <span className="bg-accent absolute bottom-0 h-0.5 w-8 rounded-full" />}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onMenuClick}
        className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-white/50 transition-colors hover:text-white/80"
        aria-label="פתח תפריט"
      >
        <Menu className="h-5 w-5" />
        <span>עוד</span>
      </button>
    </nav>
  );
}
