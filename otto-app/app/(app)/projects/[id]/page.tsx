import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  FolderKanban,
  Building2,
  Calendar,
  Banknote,
  Hourglass,
  AlertTriangle,
  ListTree,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label";
import { ProjectActionsBar } from "./project-actions-bar";
import { MilestonesSection } from "./milestones-section";
import { PaymentScheduleSection } from "./payment-schedule-section";
import { ProjectQuotesSection } from "./project-quotes-section";

export const metadata = { title: "פרויקט — OTTO" };

const STATUS_LABELS: Record<string, string> = {
  planning: "תכנון",
  active: "פעיל",
  on_hold: "בהמתנה",
  completed: "הושלם",
  cancelled: "בוטל",
};
const STATUS_STYLES: Record<string, string> = {
  planning: "border-blue-200 bg-blue-50 text-blue-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  on_hold: "border-yellow-200 bg-yellow-50 text-yellow-700",
  completed: "border-gray-200 bg-gray-100 text-gray-600",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};
const PHASE_LABELS: Record<string, string> = {
  discovery: "איפיון ראשוני",
  specification: "איפיון מפורט",
  development: "פיתוח",
  qa: "בדיקות",
  launch: "השקה",
  maintenance: "תחזוקה",
};
const BILLING_LABELS: Record<string, string> = {
  hourly: "שעתי",
  hour_bank: "בנק שעות",
  fixed_price: "מחיר קבוע",
  retainer: "ריטיינר",
};
const HEALTH_LABELS: Record<string, string> = {
  on_track: "בקצב",
  at_risk: "בסיכון",
  off_track: "מחוץ למסלול",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!project) notFound();

  const [
    { data: customer },
    { data: milestones },
    { data: parent },
    { data: children },
    { data: installments },
    { data: quotes },
  ] = await Promise.all([
    project.customer_id
      ? supabase
          .from("customers")
          .select("id, name, company")
          .eq("id", project.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", id)
      .order("order_index", { ascending: true }),
    project.parent_project_id
      ? supabase
          .from("projects")
          .select("id, name")
          .eq("id", project.parent_project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("parent_project_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("project_payment_schedule")
      .select("*")
      .eq("project_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quotes")
      .select(
        "id, title, amount, status, document_url, signed_at, valid_until, notes, customer_id, project_id",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const { data: customerOptions } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");
  const { data: parentOptions } = await supabase
    .from("projects")
    .select("id, name")
    .is("deleted_at", null)
    .neq("id", id)
    .order("created_at", { ascending: false });

  const due = project.due_date ? new Date(project.due_date) : null;
  const start = project.start_date ? new Date(project.start_date) : null;
  // eslint-disable-next-line react-hooks/purity
  const isOverdue = due && due.getTime() < Date.now() && project.status !== "completed";

  return (
    <div className="mx-auto max-w-3xl">
      <BreadcrumbLabel label={project.name} />

      <div className="mb-6">
        <Link
          href="/projects"
          className="text-ink-soft hover:text-navy inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowRight size={14} />
          חזרה לפרויקטים
        </Link>
      </div>

      <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
        <div className="mb-4 flex items-start gap-4">
          <div className="bg-navy text-cream-paper flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            {parent ? <ListTree size={20} /> : <FolderKanban size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            {parent && (
              <Link
                href={`/projects/${parent.id}`}
                className="text-ink-faded hover:text-navy mb-1 inline-flex items-center gap-1 text-xs"
              >
                <ListTree size={11} /> {parent.name}
              </Link>
            )}
            <h1 className="text-display-sm text-navy">{project.name}</h1>
            {customer && (
              <Link
                href={`/customers/${customer.id}`}
                className="text-ink-soft hover:text-navy mt-1 inline-flex items-center gap-1 text-sm"
              >
                <Building2 size={12} />
                {customer.name}
                {customer.company && <span className="text-ink-faded">· {customer.company}</span>}
              </Link>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${
              STATUS_STYLES[project.status] ?? ""
            }`}
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>

        {project.description && (
          <p className="text-ink-soft mb-4 text-sm whitespace-pre-wrap">{project.description}</p>
        )}

        <div className="text-ink-soft grid grid-cols-2 gap-y-2 text-sm md:grid-cols-3">
          <Stat
            icon={<Banknote size={14} />}
            label="חיוב"
            value={BILLING_LABELS[project.billing_model]}
          />
          {project.phase && (
            <Stat
              icon={<FolderKanban size={14} />}
              label="שלב"
              value={PHASE_LABELS[project.phase]}
            />
          )}
          {project.estimated_hours != null && (
            <Stat
              icon={<Hourglass size={14} />}
              label="שעות מוערכות"
              value={`${Number(project.estimated_hours)}h`}
              dir="ltr"
            />
          )}
          {project.budget != null && (
            <Stat
              icon={<Banknote size={14} />}
              label="תקציב"
              value={`₪${Number(project.budget).toLocaleString("he-IL")}`}
              dir="ltr"
            />
          )}
          {start && (
            <Stat
              icon={<Calendar size={14} />}
              label="התחלה"
              value={start.toLocaleDateString("he-IL")}
            />
          )}
          {due && (
            <Stat
              icon={<Calendar size={14} />}
              label="יעד"
              value={due.toLocaleDateString("he-IL")}
              className={isOverdue ? "text-rose-600" : ""}
            />
          )}
          {project.health !== "on_track" && (
            <Stat
              icon={<AlertTriangle size={14} />}
              label="בריאות"
              value={HEALTH_LABELS[project.health]}
              className={project.health === "off_track" ? "text-rose-600" : "text-yellow-600"}
            />
          )}
        </div>

        <ProjectActionsBar
          project={project}
          customers={customerOptions ?? []}
          parentOptions={parentOptions ?? []}
        />
      </div>

      <MilestonesSection projectId={id} milestones={milestones ?? []} />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <PaymentScheduleSection
          projectId={id}
          installments={installments ?? []}
          customerId={project.customer_id ?? undefined}
        />
        <ProjectQuotesSection
          projectId={id}
          quotes={quotes ?? []}
          customerId={customer?.id}
          customerName={customer?.name}
        />
      </div>

      {children && children.length > 0 && (
        <div className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-6">
          <h2 className="text-display-sm text-navy mb-4">תת-פרויקטים</h2>
          <ul className="space-y-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/projects/${c.id}`}
                  className="border-ink-line hover:border-navy flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm transition-colors"
                >
                  <span className="text-navy font-medium">{c.name}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      STATUS_STYLES[c.status] ?? ""
                    }`}
                  >
                    {STATUS_LABELS[c.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-6">
        <h2 className="text-display-sm text-navy mb-2">משימות</h2>
        <p className="text-ink-soft text-sm">
          המודול יתווסף ב-Phase 3.2 (משימות עם Kanban / Calendar / Gantt).
        </p>
      </div>

      <div className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-6">
        <h2 className="text-display-sm text-navy mb-2">שעות</h2>
        <p className="text-ink-soft text-sm">המודול יתווסף ב-Phase 3.4 (רישום שעות וטיימר).</p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  dir,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  dir?: "ltr";
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {icon}
      <span className="text-ink-faded">{label}:</span>
      <span dir={dir} className="text-navy font-medium">
        {value}
      </span>
    </div>
  );
}
