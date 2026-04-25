import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "דשבורד — OTTO",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase.from("users").select("email, role").single();

  const { data: tenant } = await supabase.from("tenants").select("name, slug, plan").single();

  const roleLabel: Record<string, string> = {
    admin: "מנהל",
    team: "צוות",
    client: "לקוח",
  };
  const role = profile?.role ?? "team";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="מותג" value={tenant?.name ?? "—"} hint={`slug: ${tenant?.slug ?? "—"}`} />
        <Card label="תוכנית" value={tenant?.plan ?? "—"} hint="free tier" />
        <Card label="תפקיד" value={roleLabel[role] ?? role} hint={profile?.email ?? ""} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <p className="text-ink-faded text-sm">
          זה דשבורד פלייסהולדר. תוכן אמיתי מגיע ב-Phase 2 (לקוחות, לידים, שעות, פיננסים).
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="bg-cream-paper text-navy border-ink-line hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
          >
            התנתק
          </button>
        </form>
      </div>
    </>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-cream-paper border-ink-line hover:border-ink-soft rounded-2xl border p-6 transition-colors">
      <span className="text-micro text-ink-faded mb-3 block uppercase">{label}</span>
      <div className="text-display-sm text-navy mb-1">{value}</div>
      {hint && <div className="text-ink-soft text-sm">{hint}</div>}
    </div>
  );
}
