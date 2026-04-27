import { Sparkles, Clock } from "lucide-react";

export const metadata = { title: "סוכנים — OTTO" };

export default function AgentsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="border-ink-line bg-cream-paper mb-6 rounded-2xl border p-6">
        <Sparkles size={40} className="text-navy mx-auto mb-4 opacity-40" />
        <div className="mb-2 flex items-center justify-center gap-2">
          <Clock size={14} className="text-ink-faded" />
          <span className="text-ink-faded text-sm">בפיתוח — Phase 6.2</span>
        </div>
        <h1 className="text-display-sm text-navy mb-2">סוכנים חיצוניים</h1>
        <p className="text-ink-soft max-w-sm text-sm">
          בקרוב: חיבור סוכנים חיצוניים (כמו מחולל הצעות מחיר) לכרטיסי לקוחות, פרויקטים ותמלולים.
        </p>
      </div>
    </div>
  );
}
