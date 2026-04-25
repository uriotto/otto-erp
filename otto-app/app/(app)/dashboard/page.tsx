import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "דשבורד — OTTO",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role, tenant_id")
    .single();

  const { data: tenant } = await supabase.from("tenants").select("name, slug, plan").single();

  const displayName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "אורי";
  const roleLabel: Record<string, string> = {
    admin: "מנהל",
    team: "צוות",
    client: "לקוח",
  };
  const role = profile?.role ?? "team";

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-display-lg text-navy mb-2">
            {getGreeting()}, {displayName}
          </h1>
          <span className="font-caveat text-ink-faded inline-block -rotate-1 text-2xl" dir="ltr">
            automate your success
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="bg-cream-paper text-navy border-ink-line hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
          >
            התנתק
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="מותג" value={tenant?.name ?? "—"} hint={`slug: ${tenant?.slug ?? "—"}`} />
        <Card label="תוכנית" value={tenant?.plan ?? "—"} hint="free tier" />
        <Card label="תפקיד" value={roleLabel[role] ?? role} hint={profile?.email ?? ""} />
      </div>

      <p className="text-ink-faded mt-10 text-sm">
        זה דשבורד פלייסהולדר — תוכן אמיתי מגיע ב-Phase 2.
      </p>
    </main>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <span className="text-micro text-ink-faded mb-3 block uppercase">{label}</span>
      <div className="text-display-sm text-navy mb-1">{value}</div>
      {hint && <div className="text-ink-soft text-sm">{hint}</div>}
    </div>
  );
}
