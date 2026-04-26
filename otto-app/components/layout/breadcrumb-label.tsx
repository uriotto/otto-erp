"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function BreadcrumbLabel({ label }: { label: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!label) return;
    window.dispatchEvent(
      new CustomEvent("otto:breadcrumb-label", {
        detail: { pathname, label },
      }),
    );
  }, [pathname, label]);

  return null;
}
