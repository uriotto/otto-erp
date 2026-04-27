"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { quickUpdateProjectStatus, quickUpdateProjectHealth } from "../actions";

const STATUS_OPTIONS = [
  { value: "planning", label: "תכנון", style: "border-blue-200 bg-blue-50 text-blue-700" },
  { value: "active", label: "פעיל", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "on_hold", label: "בהמתנה", style: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  { value: "completed", label: "הושלם", style: "border-gray-200 bg-gray-100 text-gray-600" },
  { value: "cancelled", label: "בוטל", style: "border-rose-200 bg-rose-50 text-rose-700" },
] as const;

const HEALTH_OPTIONS = [
  { value: "on_track", label: "בקצב", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "at_risk", label: "בסיכון", style: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  { value: "off_track", label: "מחוץ למסלול", style: "border-rose-200 bg-rose-50 text-rose-700" },
] as const;

function QuickDropdown<T extends string>({
  current,
  options,
  onSelect,
  pending,
}: {
  current: T;
  options: readonly { value: T; label: string; style: string }[];
  onSelect: (v: T) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentOption = options.find((o) => o.value === current) ?? options[0]!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-opacity disabled:opacity-60 ${currentOption.style}`}
      >
        {currentOption.label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="border-ink-line bg-cream-paper absolute end-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border shadow-lg">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className={`hover:bg-cream-deep/60 flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  o.value === current ? "font-semibold" : ""
                }`}
              >
                <span className={`h-2 w-2 rounded-full border ${o.style}`} />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProjectStatusBadge({ projectId, status }: { projectId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function handleSelect(v: (typeof STATUS_OPTIONS)[number]["value"]) {
    if (v === status) return;
    startTransition(async () => {
      const res = await quickUpdateProjectStatus(projectId, v);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <QuickDropdown
      current={status as (typeof STATUS_OPTIONS)[number]["value"]}
      options={STATUS_OPTIONS}
      onSelect={handleSelect}
      pending={pending}
    />
  );
}

export function ProjectHealthBadge({ projectId, health }: { projectId: string; health: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function handleSelect(v: (typeof HEALTH_OPTIONS)[number]["value"]) {
    if (v === health) return;
    startTransition(async () => {
      const res = await quickUpdateProjectHealth(projectId, v);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <QuickDropdown
      current={health as (typeof HEALTH_OPTIONS)[number]["value"]}
      options={HEALTH_OPTIONS}
      onSelect={handleSelect}
      pending={pending}
    />
  );
}
