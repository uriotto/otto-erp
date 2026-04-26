"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditTenantDialog } from "./edit-tenant-dialog";

type Props = {
  name: string;
  slug: string;
  plan: string;
  canEdit: boolean;
};

const PLAN_LABELS: Record<string, string> = {
  free: "חינם",
  starter: "סטארטר",
  pro: "מקצועי",
  business: "עסקי",
  enterprise: "ארגוני",
};

export function TenantCard({ name, slug, plan, canEdit }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">המותג שלי</h2>
          {canEdit && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="border-ink-line text-navy hover:border-navy inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              <Pencil size={14} />
              ערוך
            </button>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label="שם" value={name} />
          <Item label="מזהה (slug)" value={slug} />
          <Item label="תוכנית" value={PLAN_LABELS[plan] ?? plan} />
        </dl>
      </section>

      {open && <EditTenantDialog initialName={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream border-ink-line rounded-xl border p-3">
      <dt className="text-micro text-ink-faded uppercase">{label}</dt>
      <dd className="text-navy mt-1 truncate text-sm font-medium" dir="auto">
        {value}
      </dd>
    </div>
  );
}
