"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { NAV_SECTIONS } from "./sidebar-nav";

type Props = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <aside className="bg-cream-sidebar border-ink-line h-full overflow-y-auto border-l px-4 py-7">
      <div className="mb-0.5 flex items-baseline gap-0.5 px-1" dir="ltr">
        <span className="text-navy text-[36px] leading-none font-extrabold tracking-tight">
          OTTO
        </span>
        <span className="bg-navy mb-1 inline-block h-2 w-2 rounded-full" aria-hidden />
      </div>

      <span
        className="font-caveat text-ink-faded mb-6 inline-block -rotate-1 px-1 text-[17px]"
        dir="ltr"
      >
        automate your success
      </span>

      <div className="bg-ink-line mb-6 h-px" />

      <nav className="space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-ink-soft mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
              {section.label}
            </div>

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      prefetch={true}
                      className={`group focus-visible:ring-navy/40 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] ${
                        isActive
                          ? "bg-cream-paper text-navy shadow-card border-navy border-e-[3px] font-semibold"
                          : "text-ink-soft hover:bg-cream-paper/70 hover:text-navy"
                      }`}
                    >
                      <NavItemContent
                        Icon={item.icon}
                        label={item.label}
                        badge={item.badge}
                        isActive={isActive}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function NavItemContent({
  Icon,
  label,
  badge,
  isActive,
}: {
  Icon: LucideIcon;
  label: string;
  badge?: number;
  isActive: boolean;
}) {
  const { pending } = useLinkStatus();
  const showSpinner = pending && !isActive;

  return (
    <>
      {showSpinner ? (
        <span
          className="border-navy/30 border-t-navy h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2"
          aria-hidden
        />
      ) : (
        <Icon
          className={`h-[17px] w-[17px] shrink-0 transition-colors ${isActive ? "text-navy" : "text-ink-faded group-hover:text-navy"}`}
          strokeWidth={isActive ? 2.5 : 2}
        />
      )}
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
            isActive ? "bg-navy/10 text-navy" : "bg-cream-shadow text-ink-soft"
          }`}
        >
          {badge}
        </span>
      )}
    </>
  );
}
