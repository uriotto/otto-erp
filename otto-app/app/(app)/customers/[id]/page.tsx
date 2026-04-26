import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Phone, Globe, MapPin, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { CustomerActionsBar } from "./customer-actions-bar";
import { CustomerTagsEditor } from "./customer-tags-editor";
import { RecentTracker } from "@/components/search/recent-tracker";

export const metadata = { title: "לקוח — OTTO" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!customer) notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("id, type, title, body, occurred_at, due_at, end_at, completed_at")
    .eq("customer_id", id)
    .order("occurred_at", { ascending: false });

  const initials = customer.name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <RecentTracker
        type="customer"
        id={customer.id}
        label={customer.name}
        sublabel={customer.company ?? undefined}
      />
      <div className="mb-6">
        <Link
          href="/customers"
          className="text-ink-soft hover:text-navy mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowRight size={14} />
          חזרה ללקוחות
        </Link>
      </div>

      <div className="bg-cream-paper border-ink-line rounded-2xl border p-6">
        <div className="mb-6 flex items-start gap-4">
          <div className="bg-navy text-cream-paper flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-display-sm text-navy">{customer.name}</h1>
            {customer.company && (
              <div className="text-ink-soft mt-0.5 flex items-center gap-1 text-sm">
                <Building2 size={13} />
                {customer.company}
              </div>
            )}
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              customer.status === "active"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 bg-gray-100 text-gray-500"
            }`}
          >
            {customer.status === "active" ? "פעיל" : "לא פעיל"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {customer.email && (
            <InfoRow
              icon={<Mail size={15} />}
              label="אימייל"
              value={customer.email}
              href={`mailto:${customer.email}`}
            />
          )}
          {customer.phone && (
            <InfoRow
              icon={<Phone size={15} />}
              label="טלפון"
              value={customer.phone}
              href={`tel:${customer.phone}`}
            />
          )}
          {customer.website && (
            <InfoRow
              icon={<Globe size={15} />}
              label="אתר"
              value={customer.website}
              href={customer.website}
              external
            />
          )}
          {customer.address && (
            <InfoRow icon={<MapPin size={15} />} label="כתובת" value={customer.address} />
          )}
        </div>

        {customer.notes && (
          <div className="border-ink-line mt-6 border-t pt-5">
            <p className="text-micro text-ink-faded mb-2 uppercase">הערות</p>
            <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-wrap">
              {customer.notes}
            </p>
          </div>
        )}

        <CustomerTagsEditor customerId={customer.id} initialTags={customer.tags} />

        <div className="border-ink-line mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-ink-faded text-xs">
            נוצר {new Date(customer.created_at).toLocaleDateString("he-IL")}
          </p>
          <CustomerActionsBar customer={customer} />
        </div>
      </div>

      <div className="mt-6">
        <ActivityFeed
          activities={activities ?? []}
          customerId={customer.id}
          parentPath={`/customers/${customer.id}`}
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
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
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

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }
  return content;
}
