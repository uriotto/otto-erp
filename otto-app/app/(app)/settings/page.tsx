import { redirect } from "next/navigation";
import { LogOut, CalendarDays } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileCard } from "./profile-card";
import { TenantCard } from "./tenant-card";
import { TagsCard } from "./tags-card";
import { ExportCard } from "./export-card";
import { DangerZoneCard } from "./danger-zone-card";
import { BillingCard } from "./billing-card";
import { IntegrationsCard } from "./integrations-card";
import { getBillingSettings, listTagsUsage } from "./actions";

export const metadata = { title: "הגדרות — OTTO" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, tenant_id, email, full_name, role, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, plan")
    .eq("id", profile.tenant_id)
    .single();

  const tagsResult = await listTagsUsage();
  const tags = tagsResult.data ?? [];

  const billingResult = profile.role === "admin" ? await getBillingSettings() : null;
  const billing = billingResult?.data ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-micro text-ink-faded mb-2 uppercase">הגדרות</p>
        <h1 className="text-display-md text-navy">החשבון שלי</h1>
        <p className="text-ink-soft mt-1 text-sm">נהל/י את הפרופיל והמותג שלך</p>
      </div>

      <div className="space-y-6">
        <ProfileCard
          fullName={profile.full_name ?? ""}
          email={profile.email}
          role={profile.role}
          memberSince={profile.created_at}
        />

        {tenant && (
          <TenantCard
            name={tenant.name}
            slug={tenant.slug}
            plan={tenant.plan}
            canEdit={profile.role === "admin"}
          />
        )}

        {profile.role === "admin" && billing && <BillingCard initial={billing} />}

        {profile.role === "admin" && billing && (
          <IntegrationsCard initialUrl={billing.make_webhook_url} />
        )}

        <TagsCard initialTags={tags} />

        <ExportCard />

        <Link
          href="/settings/booking"
          className="border-ink-line hover:border-navy flex items-center justify-between rounded-2xl border bg-white p-5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="bg-navy/8 rounded-xl p-2.5">
              <CalendarDays size={20} className="text-navy" />
            </div>
            <div>
              <p className="text-navy font-semibold">קישורי הזמנה</p>
              <p className="text-ink-faded text-xs">צור לינקים ישירים לקביעת פגישות</p>
            </div>
          </div>
          <span className="text-ink-faded text-sm">←</span>
        </Link>

        {tenant && profile.role === "admin" && <DangerZoneCard tenantName={tenant.name} />}

        <div className="border-ink-line flex items-center justify-between rounded-2xl border border-dashed p-5">
          <div>
            <p className="text-navy text-sm font-semibold">התנתקות</p>
            <p className="text-ink-faded text-xs">סיום הגישה לחשבון במכשיר זה</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="border-ink-line text-navy hover:border-navy hover:text-navy inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold transition-colors"
            >
              <LogOut size={15} />
              התנתק/י
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
