import Link from "next/link";
import { Gauge, Clock, Repeat, Banknote, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSnapshot } from "@/lib/business-metrics";

function nis(value: number): string {
  return `₪${value.toLocaleString("he-IL")}`;
}

function MetricCard({
  value,
  label,
  sub,
  icon,
  href,
  accent,
}: {
  value: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div
      className={[
        "bg-cream-paper flex flex-col gap-2 rounded-2xl p-5",
        accent ? "ring-accent/30 shadow-card ring-1" : "shadow-card",
        href && "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={`text-[26px] leading-none font-bold tracking-tight tabular-nums ${
          accent ? "text-accent" : "text-navy"
        }`}
        dir="ltr"
        style={{ textAlign: "start" }}
      >
        {value}
      </div>
      <div>
        <div className="text-ink-soft flex items-center gap-1.5 text-xs font-medium">
          <span className="shrink-0">{icon}</span>
          {label}
        </div>
        {sub && <div className="text-ink-faded mt-0.5 text-[11px]">{sub}</div>}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export async function DashboardBusinessState() {
  const supabase = await createClient();
  const m = await getBusinessSnapshot(supabase);

  return (
    <section className="space-y-3">
      <h2 className="text-ink-soft text-xs font-semibold tracking-wide">מצב העסק · החודש</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          <MetricCard
            key="rate"
            icon={<Gauge size={13} />}
            label="תעריף אפקטיבי"
            value={m.effectiveHourlyRate > 0 ? `${nis(m.effectiveHourlyRate)}/ש׳` : "—"}
            sub="ממוצע משוקלל החודש"
            accent
          />,
          <MetricCard
            key="hours"
            icon={<Clock size={13} />}
            label="שעות החודש"
            value={`${m.hoursThisMonth}`}
            sub={m.hoursThisMonth > 0 ? `${m.utilizationPct}% חיוביות` : undefined}
            href="/time"
          />,
          <MetricCard
            key="mrr"
            icon={<Repeat size={13} />}
            label="MRR (ריטיינרים)"
            value={nis(m.mrr)}
            href="/customers"
          />,
          <MetricCard
            key="income"
            icon={<Banknote size={13} />}
            label="הכנסה החודש"
            value={nis(m.paymentsThisMonth)}
            href="/finance"
          />,
          <MetricCard
            key="open"
            icon={<FileText size={13} />}
            label="חשבוניות פתוחות"
            value={nis(m.openInvoicesTotal)}
            sub={m.overdue30Plus > 0 ? `${nis(m.overdue30Plus)} בפיגור 30+` : undefined}
            href="/finance"
          />,
        ].map((card, i) => (
          <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
            {card}
          </div>
        ))}
      </div>
    </section>
  );
}
