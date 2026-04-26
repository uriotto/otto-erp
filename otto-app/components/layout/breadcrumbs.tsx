"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "דשבורד",
  customers: "לקוחות",
  leads: "לידים",
  activities: "פעילויות",
  today: "היום",
  settings: "הגדרות",
};

type Crumb = {
  label: string;
  href: string;
};

function buildCrumbs(pathname: string, entityLabel: string | null): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: Crumb[] = [];
  let acc = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    acc += `/${seg}`;

    const known = SEGMENT_LABELS[seg];
    if (known) {
      crumbs.push({ label: known, href: acc });
      continue;
    }

    const parent = i > 0 ? segments[i - 1] : undefined;
    if (parent === "customers" || parent === "leads") {
      crumbs.push({ label: entityLabel ?? "פרטים", href: acc });
      continue;
    }

    crumbs.push({ label: seg, href: acc });
  }

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const [entityLabel, setEntityLabel] = useState<string | null>(null);

  useEffect(() => {
    function onLabel(e: Event) {
      const ce = e as CustomEvent<{ pathname: string; label: string }>;
      if (!ce.detail) return;
      if (ce.detail.pathname === pathname) {
        setEntityLabel(ce.detail.label);
      }
    }
    window.addEventListener("otto:breadcrumb-label", onLabel);
    return () => window.removeEventListener("otto:breadcrumb-label", onLabel);
  }, [pathname]);

  // Reset label when path changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntityLabel(null);
  }, [pathname]);

  const crumbs = buildCrumbs(pathname, entityLabel);

  if (crumbs.length === 0) return null;
  if (pathname === "/dashboard" || pathname === "/") return null;

  return (
    <nav
      aria-label="פירורי לחם"
      className="text-ink-faded mb-6 flex flex-wrap items-center gap-1.5 text-xs"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronLeft className="h-3 w-3 shrink-0" aria-hidden />}
            {isLast ? (
              <span className="text-ink-soft font-medium">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-navy transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
