import { getPortalCustomer } from "@/lib/portal";

export const metadata = { title: "חשבוניות — פורטל לקוחות" };

function formatILS(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("he-IL") : "—";
}

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  pending_review: "ממתין לאישור",
  sent: "נשלחה",
  partial: "חלקי",
  paid: "שולם",
  overdue: "בפיגור",
  cancelled: "מבוטל",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-sky-50 text-sky-700 border-sky-200",
  partial: "bg-indigo-50 text-indigo-700 border-indigo-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export default async function PortalInvoicesPage() {
  const { supabase, customer } = await getPortalCustomer();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, status, type, total_amount, issue_date, due_date, paid_at, notes")
    .eq("customer_id", customer.id)
    .order("issue_date", { ascending: false });

  const rows = invoices ?? [];

  const openTotal = rows
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  const paidTotal = rows
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">חשבוניות</h1>
        <p className="text-ink-soft mt-1 text-sm">{rows.length} חשבוניות</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border-ink-line bg-cream-paper rounded-2xl border p-4">
          <div className="text-ink-soft mb-1 text-xs">לתשלום</div>
          <div className="text-navy font-mono text-xl font-bold" dir="ltr">
            {formatILS(openTotal)}
          </div>
        </div>
        <div className="border-ink-line bg-cream-paper rounded-2xl border p-4">
          <div className="text-ink-soft mb-1 text-xs">שולם (סך הכל)</div>
          <div className="font-mono text-xl font-bold text-emerald-700" dir="ltr">
            {formatILS(paidTotal)}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-faded py-12 text-center text-sm">אין חשבוניות עדיין</p>
      ) : (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <ul className="divide-ink-line/60 divide-y">
            {rows.map((inv) => (
              <li key={inv.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-navy font-medium">
                        {inv.number ? `חשבונית ${inv.number}` : "טיוטה"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status ?? "draft"] ?? STATUS_STYLES.draft}`}
                      >
                        {STATUS_LABELS[inv.status ?? "draft"] ?? inv.status}
                      </span>
                    </div>
                    <div className="text-ink-faded mt-1 flex items-center gap-3 text-xs">
                      <span>הופקה: {formatDate(inv.issue_date)}</span>
                      {inv.due_date && <span>לתשלום עד: {formatDate(inv.due_date)}</span>}
                      {inv.paid_at && (
                        <span className="text-emerald-600">שולם: {formatDate(inv.paid_at)}</span>
                      )}
                    </div>
                    {inv.notes && <p className="text-ink-soft mt-1 text-xs">{inv.notes}</p>}
                  </div>
                  <div className="text-navy font-mono text-base font-bold" dir="ltr">
                    {formatILS(Number(inv.total_amount ?? 0))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
