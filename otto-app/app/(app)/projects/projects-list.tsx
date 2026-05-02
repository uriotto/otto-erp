"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  FolderKanban,
  Search,
  SearchX,
  Activity,
  AlertTriangle,
  Calendar,
  Building2,
  ListTree,
  LayoutGrid,
  Table2,
  Trash2,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { NewProjectDialog } from "./new-project-dialog";
import { ViewToggle, useStoredView } from "@/components/ui/view-toggle";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { bulkDeleteProjects, bulkUpdateProjectStatus } from "./actions";
import { useToast } from "@/components/ui/toast";

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

const HEALTH_LABELS: Record<string, string> = {
  on_track: "בקצב",
  at_risk: "בסיכון",
  off_track: "מחוץ למסלול",
};

const BILLING_LABELS: Record<string, string> = {
  hourly: "שעתי",
  hour_bank: "בנק שעות",
  fixed_price: "מחיר קבוע",
  retainer: "ריטיינר",
};

export type ProjectListItem = Pick<
  Tables<"projects">,
  | "id"
  | "name"
  | "status"
  | "phase"
  | "billing_model"
  | "health"
  | "budget"
  | "estimated_hours"
  | "start_date"
  | "due_date"
  | "customer_id"
  | "tags"
  | "created_at"
  | "parent_project_id"
> & { customer_name: string | null };

export type CustomerOption = Pick<Tables<"customers">, "id" | "name">;
export type TemplateOption = Pick<
  Tables<"project_templates">,
  "id" | "name" | "description" | "default_billing_model"
>;

const SEARCH_DEBOUNCE_MS = 200;

export function ProjectsList({
  projects,
  customers,
  templates,
}: {
  projects: ProjectListItem[];
  customers: CustomerOption[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [view, setView] = useStoredView<"grid" | "table">("projects-view", "grid");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(
    () => searchParams.get("status") ?? "all",
  );
  const [billingFilter, setBillingFilter] = useState<string>(
    () => searchParams.get("billing") ?? "all",
  );
  const [customerFilter, setCustomerFilter] = useState<string>(
    () => searchParams.get("customer") ?? "all",
  );

  const updateUrl = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v && v.length > 0 && v !== "all") sp.set(k, v);
        else sp.delete(k);
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      updateUrl({ q: query.trim() || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (billingFilter !== "all" && p.billing_model !== billingFilter) return false;
      if (customerFilter !== "all" && p.customer_id !== customerFilter) return false;
      if (!q) return true;
      const haystack = [p.name, p.customer_name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, query, statusFilter, billingFilter, customerFilter]);

  const stats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      map.set(p.status, (map.get(p.status) ?? 0) + 1);
    }
    return map;
  }, [projects]);

  const clearAll = () => {
    setQuery("");
    setStatusFilter("all");
    setBillingFilter("all");
    setCustomerFilter("all");
    updateUrl({ q: undefined, status: undefined, billing: undefined, customer: undefined });
  };

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק ${ids.length} פרויקטים?`)) return;
    startBulk(async () => {
      const res = await bulkDeleteProjects(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`נמחקו ${res.deleted} פרויקטים`);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleBulkStatus(status: "planning" | "active" | "on_hold" | "completed" | "cancelled") {
    const ids = Array.from(selected);
    startBulk(async () => {
      const res = await bulkUpdateProjectStatus(ids, status);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`עודכנו ${res.updated} פרויקטים`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">פרויקטים</h1>
          <p className="text-ink-soft mt-1 text-sm">{projects.length} פרויקטים סך הכל</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            storageKey="projects-view"
            views={[
              { id: "grid", icon: LayoutGrid, label: "גריד" },
              { id: "table", icon: Table2, label: "טבלה" },
            ]}
            defaultView="grid"
            current={view}
            onChange={setView}
          />
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            פרויקט חדש
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search
            size={16}
            className="text-ink-faded pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש פרויקט או לקוח..."
            className="border-ink-line focus:border-navy w-full rounded-lg border bg-white py-2 ps-10 pe-3 text-sm outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            updateUrl({ status: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הסטטוסים</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l} ({stats.get(v) ?? 0})
            </option>
          ))}
        </select>
        <select
          value={billingFilter}
          onChange={(e) => {
            setBillingFilter(e.target.value);
            updateUrl({ billing: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל מודלי החיוב</option>
          {Object.entries(BILLING_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={customerFilter}
          onChange={(e) => {
            setCustomerFilter(e.target.value);
            updateUrl({ customer: e.target.value });
          }}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הלקוחות</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {projects.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : filtered.length === 0 ? (
        <NoResults query={query} onClear={clearAll} />
      ) : view === "table" ? (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">שם</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">לקוח</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">מודל חיוב</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תאריך יצירה</th>
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`transition-colors ${selected.has(p.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      {p.parent_project_id ? (
                        <ListTree size={13} className="text-ink-faded shrink-0" />
                      ) : (
                        <FolderKanban size={13} className="text-ink-faded shrink-0" />
                      )}
                      <span className="text-navy font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.customer_name ? (
                      <span className="text-ink-soft inline-flex items-center gap-1 text-xs">
                        <Building2 size={11} />
                        {p.customer_name}
                      </span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? "border-ink-line bg-cream text-ink-soft"}`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {BILLING_LABELS[p.billing_model] ?? p.billing_model}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("he-IL") : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "העבר לפעיל",
            variant: "default",
            isPending: bulkPending,
            onClick: () => handleBulkStatus("active"),
          },
          {
            label: "סיים",
            variant: "default",
            isPending: bulkPending,
            onClick: () => handleBulkStatus("completed"),
          },
          {
            label: "מחק",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkDelete,
          },
        ]}
      />

      {showNew && (
        <NewProjectDialog
          customers={customers}
          templates={templates}
          parentProjects={projects}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectListItem }) {
  const due = project.due_date ? new Date(project.due_date) : null;
  // eslint-disable-next-line react-hooks/purity
  const isOverdue = due && due.getTime() < Date.now() && project.status !== "completed";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="focus-visible:outline-navy/40 block focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="bg-cream-paper border-ink-line hover:border-ink-soft relative rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]">
        <div className="mb-3 flex items-start gap-3">
          <div className="bg-navy text-cream-paper flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            {project.parent_project_id ? <ListTree size={18} /> : <FolderKanban size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-navy truncate font-semibold">{project.name}</div>
            {project.customer_name && (
              <div className="text-ink-soft mt-0.5 flex items-center gap-1 text-xs">
                <Building2 size={11} />
                <span className="truncate">{project.customer_name}</span>
              </div>
            )}
          </div>
          <StatusPill status={project.status} />
        </div>

        <div className="text-ink-soft flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <Activity size={12} />
            {BILLING_LABELS[project.billing_model] ?? project.billing_model}
          </span>
          {project.estimated_hours != null && (
            <span dir="ltr" className="font-mono">
              ~{Number(project.estimated_hours)}h
            </span>
          )}
          {project.budget != null && (
            <span dir="ltr" className="font-mono">
              ₪{Number(project.budget).toLocaleString("he-IL")}
            </span>
          )}
          {due && (
            <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-rose-600" : ""}`}>
              <Calendar size={12} />
              {due.toLocaleDateString("he-IL")}
            </span>
          )}
          {project.health !== "on_track" && (
            <span
              className={`inline-flex items-center gap-1 ${
                project.health === "off_track" ? "text-rose-600" : "text-yellow-600"
              }`}
            >
              <AlertTriangle size={12} />
              {HEALTH_LABELS[project.health]}
            </span>
          )}
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {project.tags.map((t) => (
              <span
                key={t}
                className="bg-cream border-ink-line rounded-md border px-2 py-0.5 text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "border-ink-line bg-cream text-ink-soft"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <FolderKanban size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">הפרויקט הראשון מתחיל כאן</h2>
      <p className="text-ink-soft mb-6 max-w-md text-sm">
        כאן תנהל את כל הפרויקטים שלך — חיוב, אבני דרך, משימות, ושעות, הכל במקום אחד
      </p>
      <button
        type="button"
        onClick={onNew}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
      >
        <Plus size={16} />
        צור פרויקט ראשון
      </button>
    </div>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-cream-deep mb-4 flex h-20 w-20 items-center justify-center rounded-full">
        <SearchX size={48} className="text-navy/60" />
      </div>
      <h2 className="text-display-sm text-navy mb-2">
        {query ? `לא נמצאו תוצאות עבור "${query}"` : "אין פרויקטים בסינון הזה"}
      </h2>
      <button
        type="button"
        onClick={onClear}
        className="text-ink-soft hover:text-navy text-sm underline"
      >
        נקה חיפוש וסינון
      </button>
    </div>
  );
}
