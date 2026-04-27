import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalSignOutButton } from "./sign-out-button";

type PortalCustomer = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  portal_enabled: boolean;
  portal_last_login?: string | null;
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, company, email, portal_enabled")
    .eq("email", user.email ?? "")
    .eq("portal_enabled", true)
    .maybeSingle();

  if (!customer) {
    redirect("/portal/login?error=" + encodeURIComponent("אין הרשאת גישה לפורטל"));
  }

  return (
    <div className="bg-cream min-h-screen" dir="rtl">
      <PortalHeader customer={customer} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

function PortalHeader({ customer }: { customer: PortalCustomer }) {
  return (
    <header className="bg-cream-paper border-ink-line border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4">
          <span className="text-navy text-lg font-bold tracking-tight">OTTO</span>
          <span className="text-ink-line">|</span>
          <span className="text-ink-soft text-sm">{customer.company ?? customer.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink href="/portal/dashboard">בית</NavLink>
          <NavLink href="/portal/invoices">חשבוניות</NavLink>
          <NavLink href="/portal/hour-banks">בנקי שעות</NavLink>
          <NavLink href="/portal/projects">פרויקטים</NavLink>
          <PortalSignOutButton />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ink-soft hover:text-navy hover:bg-cream rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
    >
      {children}
    </Link>
  );
}
