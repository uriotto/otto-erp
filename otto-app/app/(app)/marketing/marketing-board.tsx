"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Megaphone, Calendar, Tag, Trash2, ChevronDown } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { NewContentDialog } from "./new-content-dialog";
import { updateContentStatus, deleteContent } from "./actions";
import { useToast } from "@/components/ui/toast";
import { saveFilters, loadFilters } from "@/lib/persist-filters";

type ContentItem = Tables<"marketing_content">;
type Status = ContentItem["status"];
type Platform = ContentItem["platform"];

const STATUS_COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: "idea", label: "רעיון", color: "border-gray-200 bg-gray-50" },
  { key: "planned", label: "מתוכנן", color: "border-blue-200 bg-blue-50" },
  { key: "in_progress", label: "בעבודה", color: "border-amber-200 bg-amber-50" },
  { key: "published", label: "פורסם", color: "border-emerald-200 bg-emerald-50" },
];

const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter / X",
  blog: "בלוג",
  email: "אימייל",
  whatsapp: "WhatsApp",
  other: "אחר",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  linkedin: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-indigo-100 text-indigo-700",
  twitter: "bg-sky-100 text-sky-700",
  blog: "bg-orange-100 text-orange-700",
  email: "bg-gray-100 text-gray-700",
  whatsapp: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-600",
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export function MarketingBoard({ items }: { items: ContentItem[] }) {
  const [showNew, setShowNew] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>(
    () => loadFilters("marketing")?.platform ?? "all",
  );
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  // Persist filter state to localStorage on every change
  useEffect(() => {
    saveFilters("marketing", { platform: filterPlatform });
  }, [filterPlatform]);

  const platforms = Array.from(new Set(items.map((i) => i.platform)));

  const filtered =
    filterPlatform === "all" ? items : items.filter((i) => i.platform === filterPlatform);

  const byStatus = (status: Status) => filtered.filter((i) => i.status === status);

  function handleStatusChange(id: string, status: Status) {
    startTransition(async () => {
      const result = await updateContentStatus(id, status);
      if (result.error) toast.error(result.error);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteContent(id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className={isPending ? "opacity-70 transition-opacity" : ""}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">שיווק</h1>
          <p className="text-ink-soft mt-1 text-sm">{items.length} פריטי תוכן</p>
        </div>
        <div className="flex items-center gap-2">
          {platforms.length > 1 && (
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="all">כל הפלטפורמות</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowNew(true)}
            className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            תוכן חדש
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STATUS_COLUMNS.map((col) => {
          const colItems = byStatus(col.key);
          return (
            <div key={col.key}>
              <div
                className={`mb-3 flex items-center justify-between rounded-xl border px-3 py-2 ${col.color}`}
              >
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-ink-soft text-xs font-medium">{colItems.length}</span>
              </div>
              <div className="space-y-2">
                {colItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {colItems.length === 0 && (
                  <div className="border-ink-line/50 rounded-xl border-2 border-dashed py-8 text-center">
                    <p className="text-ink-faded text-xs">אין פריטים</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <NewContentDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}

function ContentCard({
  item,
  onStatusChange,
  onDelete,
}: {
  item: ContentItem;
  onStatusChange: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const nextStatuses: Status[] = [
    "idea",
    "planned",
    "in_progress",
    "published",
    "cancelled",
  ].filter((s) => s !== item.status) as Status[];

  const STATUS_LABELS: Record<Status, string> = {
    idea: "רעיון",
    planned: "מתוכנן",
    in_progress: "בעבודה",
    published: "פורסם",
    cancelled: "מבוטל",
  };

  return (
    <div className="bg-cream-paper border-ink-line group relative rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[item.platform]}`}
        >
          {PLATFORM_LABELS[item.platform]}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-ink-faded hover:text-navy rounded p-0.5"
            >
              <ChevronDown size={14} />
            </button>
            {showMenu && (
              <div className="border-ink-line bg-cream-paper absolute end-0 top-full z-10 mt-1 min-w-32 rounded-lg border shadow-lg">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(item.id, s);
                      setShowMenu(false);
                    }}
                    className="text-ink-soft hover:bg-cream hover:text-navy block w-full px-3 py-2 text-start text-xs"
                  >
                    → {STATUS_LABELS[s]}
                  </button>
                ))}
                <hr className="border-ink-line/50" />
                <button
                  onClick={() => {
                    onDelete(item.id);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-start text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                  מחק
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-navy mb-2 text-sm leading-snug font-medium">{item.title}</p>

      {item.body && (
        <p className="text-ink-soft mb-2 line-clamp-2 text-xs leading-relaxed">{item.body}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {item.scheduled_date && (
          <span className="text-ink-faded flex items-center gap-1 text-xs">
            <Calendar size={11} />
            {formatDate(item.scheduled_date)}
          </span>
        )}
        {item.tags && item.tags.length > 0 && (
          <span className="text-ink-faded flex items-center gap-1 text-xs">
            <Tag size={11} />
            {item.tags.slice(0, 2).join(", ")}
            {item.tags.length > 2 && ` +${item.tags.length - 2}`}
          </span>
        )}
      </div>
    </div>
  );
}

// Silence unused import warning
void Megaphone;
