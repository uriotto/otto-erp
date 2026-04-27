import { FileText, Clock } from "lucide-react";

export const metadata = { title: "הצעות מחיר — OTTO" };

export default function QuotesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="border-ink-line bg-cream-paper mb-6 rounded-2xl border p-6">
        <FileText size={40} className="text-navy mx-auto mb-4 opacity-40" />
        <div className="mb-2 flex items-center justify-center gap-2">
          <Clock size={14} className="text-ink-faded" />
          <span className="text-ink-faded text-sm">בפיתוח — Phase 4.4</span>
        </div>
        <h1 className="text-display-sm text-navy mb-2">הצעות מחיר אינטראקטיביות</h1>
        <p className="text-ink-soft max-w-sm text-sm">
          בקרוב: יצירת הצעות מחיר עם מודולים, timeline ו-חתימה דיגיטלית. לקוחות יוכלו לבחור מודולים
          ולחתום ישירות.
        </p>
      </div>
    </div>
  );
}
