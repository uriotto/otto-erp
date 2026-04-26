"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditProfileDialog } from "./edit-profile-dialog";

type Props = {
  fullName: string;
  email: string;
  role: string;
  memberSince: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל",
  member: "חבר צוות",
  customer: "לקוח",
};

export function ProfileCard({ fullName, email, role, memberSince }: Props) {
  const [open, setOpen] = useState(false);

  const memberSinceLabel = new Date(memberSince).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
  });

  return (
    <>
      <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">הפרופיל שלי</h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border-ink-line text-navy hover:border-navy inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
          >
            <Pencil size={14} />
            ערוך
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label="שם מלא" value={fullName || "—"} />
          <Item label="אימייל" value={email} />
          <Item label="תפקיד" value={ROLE_LABELS[role] ?? role} />
          <Item label="חבר/ה מאז" value={memberSinceLabel} />
        </dl>
      </section>

      {open && <EditProfileDialog initialFullName={fullName} onClose={() => setOpen(false)} />}
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream border-ink-line rounded-xl border p-3">
      <dt className="text-micro text-ink-faded uppercase">{label}</dt>
      <dd className="text-navy mt-1 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
