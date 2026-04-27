import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Receipt, LayoutGrid, FolderKanban, Clock } from "lucide-react";

export const metadata = { title: "פורטל לקוחות — OTTO" };

function formatILS(n: number) {
  return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

export default async function PortalDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [invoicesRes, hourBanksRes, projectsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, status, total_amount, due_date, issue_date")
      .order("issue_date", { ascending: false })
      .limit(5),
    supabase
      .from("hour_banks_summary")
      .select(
        "id, purchased_hours, consumed_hours, available_hours, hourly_rate, status, expiry_date",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, status")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const invoices = invoicesRes.data ?? [];
  const hourBanks = hourBanksRes.data ?? [];
  const projects = projectsRes.data ?? [];

  const openTotal = invoices
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  const totalActiveHours = hourBanks.reduce((s, b) => s + Number(b.available_hours ?? 0), 0);

  const STATUS_LABELS: Record<string, string> = {
    draft: "טיוטה",
    pending_review: "ממתין",
    sent: "נשלחה",
    partial: "חלקי",
    paid: "שולם",
    overdue: "בפיגור",
    cancelled: "מבוטל",
  };

  const STATUS_STYLES: Record<string, string> = {
    draft: "bg-gray-50 text-gray-600 border-gray-200",
    pending_review: "bg-amber-50 text-amber-700 border-amber-200",
    sent: "bg-sky-50 text-sky-700 border-sky-200",
    partial: "bg-indigo-50 text-indigo-700 border-indigo-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    overdue: "bg-rose-50 text-rose-700 border-rose-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md text-navy">שלום 👋</h1>
        <p className="text-ink-soft mt-1 text-sm">{user?.email}</p>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          icon={<Receipt size={18} />}
          label="לתשלום"
          value={formatILS(openTotal)}
          href="/portal/invoices"
          tone={openTotal > 0 ? "warning" : undefined}
        />
        <KpiCard
          icon={<LayoutGrid size={18} />}
          label="שעות זמינות"
          value={`${Math.round(totalActiveHours * 10) / 10}h`}
          href="/portal/hour-banks"
        />
        <KpiCard
          icon={<FolderKanban size={18} />}
          label="פרויקטים פעילים"
          value={String(projects.filter((p) => p.status === "active").length)}
          href="/portal/projects"
        />
      </div>

      {/* Recent invoices */}
      {invoices.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-navy font-semibold">חשבוניות אחרונות</h2>
            <Link href="/portal/invoices" className="text-ink-faded hover:text-navy text-xs">
              כל החשבוניות →
            </Link>
          </div>
          <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
            <ul className="divide-ink-line/60 divide-y">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="hover:bg-cream flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <div className="text-navy text-sm font-medium">
                      {inv.number ? `חשבונית ${inv.number}` : "טיוטה"}
                    </div>
                    <div className="text-ink-faded mt-0.5 text-xs">
                      {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("he-IL") : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status ?? "draft"] ?? STATUS_STYLES.draft}`}
                    >
                      {STATUS_LABELS[inv.status ?? "draft"] ?? inv.status}
                    </span>
                    <span className="text-navy font-mono text-sm font-semibold" dir="ltr">
                      {formatILS(Number(inv.total_amount ?? 0))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Active hour banks */}
      {hourBanks.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-navy font-semibold">בנקי שעות פעילים</h2>
            <Link href="/portal/hour-banks" className="text-ink-faded hover:text-navy text-xs">
              כולם →
            </Link>
          </div>
          <div className="space-y-3">
            {hourBanks.map((bank) => {
              const purchased = Number(bank.purchased_hours ?? 0);
              const consumed = Number(bank.consumed_hours ?? 0);
              const available = Number(bank.available_hours ?? 0);
              const pct = purchased > 0 ? Math.min(100, (consumed / purchased) * 100) : 0;
              return (
                <div
                  key={bank.id}
                  className="bg-cream-paper border-ink-line rounded-2xl border p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-ink-soft" />
                      <span className="text-navy text-sm font-medium" dir="ltr">
                        {(Math.round(available * 10) / 10).toFixed(1)}h נותרו
                      </span>
                    </div>
                    <span className="text-ink-faded text-xs" dir="ltr">
                      {consumed.toFixed(1)} / {purchased.toFixed(1)}h שומשו
                    </span>
                  </div>
                  <div className="bg-cream-deep h-2 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-navy"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {bank.expiry_date && (
                    <p className="text-ink-faded mt-2 text-xs">
                      תוקף: {new Date(bank.expiry_date).toLocaleDateString("he-IL")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  tone?: "warning";
}) {
  const bg = tone === "warning" ? "border-red-200 bg-red-50/40" : "border-ink-line bg-cream-paper";
  const textColor = tone === "warning" ? "text-red-700" : "text-navy";

  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-4 transition-all hover:shadow-sm ${bg}`}
    >
      <div className="text-ink-soft mb-1.5 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <div className={`font-mono text-2xl font-bold ${textColor}`} dir="ltr">
        {value}
      </div>
    </Link>
  );
}
