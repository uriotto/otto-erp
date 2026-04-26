"use client";

import { useState } from "react";

import { Sidebar } from "./sidebar";
import { AppHeader } from "./header";
import { Breadcrumbs } from "./breadcrumbs";

type Props = {
  greeting: string;
  displayName: string;
  subline?: string;
  children: React.ReactNode;
};

export function AppShell({ greeting, displayName, subline, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr]">
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <Sidebar />
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="סגור תפריט"
            onClick={() => setMobileOpen(false)}
            className="bg-navy/40 fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[280px] lg:hidden">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <main className="min-h-screen px-6 py-10 md:px-10 lg:max-w-[1400px] lg:px-12">
        <AppHeader
          greeting={greeting}
          displayName={displayName}
          subline={subline}
          onMenuClick={() => setMobileOpen(true)}
        />
        <Breadcrumbs />
        {children}
      </main>
    </div>
  );
}
