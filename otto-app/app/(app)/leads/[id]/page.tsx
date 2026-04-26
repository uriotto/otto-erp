import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Phone, Building2, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { LeadActionsBar } from "./lead-actions-bar";
import { LeadTagsEditor } from "./lead-tags-editor";

export const metadata = { title: "ליד — OTTO" };

const STATUS_LABELS: Record<string, string> = {
  new: "חדש",
  contacted: "יצרנו קשר",
  qualified: "מוכשר",
  proposal: "הצעה",
  won: "נסגר",
  lost: "הפסד",
};

const STATUS_STYLES: Record<string, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-700",
  contacted: "border-yellow-200 bg-yellow-50 text-yellow-700",
  qualified: "border-purple-200 bg-purple-50 text-purple-700",
  proposal: "border-orange-200 bg-orange-50 text-orange-700",
  won: "border-green-200 bg-green-50 text-green-700",
  lost: "border-gray-200 bg-gray-100 text-gray-500",
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("id, type, title, body, occurred_at, due_at, end_at, completed_at")
    .eq("lead_id", id)
    .order("occurred_at", { ascending: false });

  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/leads"
          className="text-ink-soft hover:text-navy mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowRight size={14} />
          חזרה ללידים
        </Link>
      </div>

      <div className="bg-cream-paper border-ink-line rounded-2xl border p-6">
        <div className="mb-6 flex items-start gap-4">
          <div className="bg-cream border-ink-line flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold text-gray-600">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-display-sm text-navy">{lead.name}</h1>
            {lead.company && (
              <div className="text-ink-soft mt-0.5 flex items-center gap-1 text-sm">
                <Building2 size={13} />
                {lead.company}
              </div>
            )}
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLES[lead.status] ?? ""}`}
          >
            {STATUS_LABELS[lead.status] ?? lead.status}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lead.email && (
            <InfoRow
              icon={<Mail size={15} />}
              label="אימייל"
              value={lead.email}
              href={`mailto:${lead.email}`}
            />
          )}
          {lead.phone && (
            <InfoRow
              icon={<Phone size={15} />}
              label="טלפון"
              value={lead.phone}
              href={`tel:${lead.phone}`}
            />
          )}
          {lead.value != null && (
            <InfoRow
              icon={<TrendingUp size={15} />}
              label="שווי עסקה"
              value={`₪${lead.value.toLocaleString("he-IL")}`}
            />
          )}
          {lead.source && (
            <InfoRow icon={<TrendingUp size={15} />} label="מקור" value={lead.source} />
          )}
        </div>

        {lead.notes && (
          <div className="border-ink-line mt-6 border-t pt-5">
            <p className="text-micro text-ink-faded mb-2 uppercase">הערות</p>
            <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-wrap">
              {lead.notes}
            </p>
          </div>
        )}

        <LeadTagsEditor leadId={lead.id} initialTags={lead.tags} />

        <div className="border-ink-line mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-ink-faded text-xs">
            נוצר {new Date(lead.created_at).toLocaleDateString("he-IL")}
          </p>
          <LeadActionsBar lead={lead} />
        </div>
      </div>

      <div className="mt-6">
        <ActivityFeed
          activities={activities ?? []}
          leadId={lead.id}
          parentPath={`/leads/${lead.id}`}
        />
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="bg-cream hover:border-ink-soft border-ink-line flex items-center gap-2.5 rounded-xl border p-3 transition-colors">
      <span className="text-ink-soft">{icon}</span>
      <div className="min-w-0">
        <p className="text-micro text-ink-faded uppercase">{label}</p>
        <p className="text-navy truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );

  if (href) return <a href={href}>{content}</a>;
  return content;
}
