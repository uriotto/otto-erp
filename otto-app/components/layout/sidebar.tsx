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

  let navItemIndex = 0;

  return (
    <aside className="bg-navy-deep flex h-full flex-col overflow-y-auto px-4 py-7">
      <div className="px-2" dir="ltr">
        <div className="mb-0.5 flex items-baseline gap-1">
          <span className="text-[34px] leading-none font-extrabold tracking-tight text-white">
            OTTO
          </span>
          <span
            className="bg-accent animate-dot-breathe mb-1 inline-block h-2 w-2 rounded-full"
            aria-hidden
          />
        </div>
        <span className="font-caveat inline-block -rotate-1 text-[16px] text-white/50" dir="ltr">
          automate your success
        </span>
      </div>

      <div className="mx-2 my-5 h-px bg-white/10" />

      <nav className="flex flex-1 flex-col gap-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <span className="font-caveat text-accent/80 mb-1.5 block px-2 text-[15px] italic">
              {section.label}
            </span>

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const itemIdx = navItemIndex++;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                return (
                  <li
                    key={item.href}
                    className="animate-slide-up"
                    style={{ animationDelay: `${itemIdx * 15}ms` }}
                  >
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      prefetch={true}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none active:scale-[0.98] ${
                        isActive
                          ? "bg-white/10 font-semibold text-white"
                          : "text-white/85 hover:bg-white/8 hover:text-white"
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
          className="border-accent/40 border-t-accent h-[16px] w-[16px] shrink-0 animate-spin rounded-full border-2"
          aria-hidden
        />
      ) : (
        <Icon
          className={`h-[16px] w-[16px] shrink-0 transition-colors ${
            isActive
              ? "text-accent drop-shadow-[0_0_7px_rgba(224,125,60,0.6)]"
              : "text-white/65 group-hover:text-white/90"
          }`}
          strokeWidth={isActive ? 2.5 : 2}
        />
      )}
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
            isActive ? "bg-accent/20 text-accent" : "bg-white/10 text-white/40"
          }`}
        >
          {badge}
        </span>
      )}
    </>
  );
}
