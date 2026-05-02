export const metadata = { title: "פגישות — פורטל לקוחות" };

export default function PortalMeetingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">פגישות וסיכומים</h1>
        <p className="text-ink-soft mt-1 text-sm">סיכומי פגישות ותמלולים</p>
      </div>

      <div className="bg-cream-paper border-ink-line rounded-2xl border px-6 py-16 text-center">
        <div className="bg-cream-deep border-ink-line mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-soft"
          >
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14" />
            <rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
          </svg>
        </div>
        <p className="text-navy font-semibold">בקרוב</p>
        <p className="text-ink-soft mt-1 text-sm">
          סיכומי פגישות ותמלולים יופיעו כאן לאחר הפעלת מודול ההקלטות
        </p>
      </div>
    </div>
  );
}
