import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProfileCard } from "./profile-card";
import { TenantCard } from "./tenant-card";
import { TagsCard } from "./tags-card";
import { ExportCard } from "./export-card";
import { DangerZoneCard } from "./danger-zone-card";
import { listTagsUsage } from "./actions";

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

        <TagsCard initialTags={tags} />

        <ExportCard />

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
