"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const lastPathname = useRef(pathname);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const link = target?.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
        return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (link.target && link.target !== "_self") return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;

      if (finishTimer.current) clearTimeout(finishTimer.current);
      setActive(true);
      setWidth(15);
      requestAnimationFrame(() => setWidth(60));
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    if (!active) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(100);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 280);
  }, [pathname, active]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] bg-transparent"
    >
      <div
        className="bg-navy h-full transition-[width,opacity] duration-300 ease-out"
        style={{
          width: `${width}%`,
          opacity: width >= 100 ? 0 : 1,
          boxShadow: "0 0 10px rgba(20, 30, 60, 0.6)",
        }}
      />
    </div>
  );
}
