"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "./sidebar-nav";

type Props = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <aside className="bg-cream-paper border-ink-line h-full overflow-y-auto border-l px-5 py-8">
      <div className="mb-1 flex items-baseline gap-0.5" dir="ltr">
        <span className="text-navy text-[38px] leading-none font-extrabold tracking-tight">
          OTTO
        </span>
        <span className="bg-navy mb-1 inline-block h-2 w-2 rounded-full" aria-hidden />
      </div>

      <span className="font-caveat text-ink-faded mb-10 inline-block -rotate-1 text-lg" dir="ltr">
        automate your success
      </span>

      <nav className="space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-ink-faded mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] uppercase">
              {section.label}
            </div>

            <ul className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-navy text-cream-paper font-semibold"
                          : "text-ink-soft hover:bg-cream-deep hover:text-navy"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          className={`min-w-[18px] rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${
                            isActive ? "bg-cream-paper text-navy" : "bg-navy text-cream-paper"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
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
