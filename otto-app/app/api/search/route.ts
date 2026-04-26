import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type SearchResultItem = {
  id: string;
  type: "customer" | "lead" | "activity";
  title: string;
  subtitle?: string | null;
  href: string;
};

export type SearchResults = {
  customers: SearchResultItem[];
  leads: SearchResultItem[];
  activities: SearchResultItem[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ customers: [], leads: [], activities: [] } satisfies SearchResults);
  }

  const supabase = await createClient();

  // tenant scope מפורש (defense-in-depth מעבר ל-RLS)
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) {
    return NextResponse.json({ customers: [], leads: [], activities: [] } satisfies SearchResults);
  }

  // Sanitize: PostgREST .or() parser שובר על תווים מיוחדים. לפיכך מסירים אותם.
  const safeQ = q.replace(/[,()"\\]/g, " ").trim();
  if (safeQ.length < 2) {
    return NextResponse.json({ customers: [], leads: [], activities: [] } satisfies SearchResults);
  }
  const like = `%${safeQ}%`;

  const [customersRes, leadsRes, activitiesRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, email, phone")
      .eq("tenant_id", profile.tenant_id)
      .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(6),
    supabase
      .from("leads")
      .select("id, name, company, email, phone")
      .eq("tenant_id", profile.tenant_id)
      .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(6),
    supabase
      .from("activities")
      .select("id, title, customer_id, lead_id, type")
      .eq("tenant_id", profile.tenant_id)
      .or(`title.ilike.${like},body.ilike.${like}`)
      .limit(6),
  ]);

  const customers: SearchResultItem[] = (customersRes.data ?? []).map((c) => ({
    id: c.id,
    type: "customer" as const,
    title: c.name,
    subtitle: c.company ?? c.email ?? c.phone ?? null,
    href: `/customers/${c.id}`,
  }));

  const leads: SearchResultItem[] = (leadsRes.data ?? []).map((l) => ({
    id: l.id,
    type: "lead" as const,
    title: l.name,
    subtitle: l.company ?? l.email ?? l.phone ?? null,
    href: `/leads/${l.id}`,
  }));

  const activities: SearchResultItem[] = (activitiesRes.data ?? []).map((a) => ({
    id: a.id,
    type: "activity" as const,
    title: a.title,
    subtitle: typeLabel(a.type),
    href: a.customer_id
      ? `/customers/${a.customer_id}`
      : a.lead_id
        ? `/leads/${a.lead_id}`
        : "/today",
  }));

  return NextResponse.json({ customers, leads, activities } satisfies SearchResults);
}

function typeLabel(t: string): string {
  switch (t) {
    case "call":
      return "שיחה";
    case "email":
      return "אימייל";
    case "meeting":
      return "פגישה";
    case "note":
      return "הערה";
    default:
      return t;
  }
}
