import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-cream-paper flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {/* big number */}
        <div className="relative mb-6 select-none">
          <span
            className="text-navy/5 block leading-none font-bold"
            style={{ fontSize: "clamp(8rem, 30vw, 14rem)" }}
            aria-hidden
          >
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-ink-line bg-cream-paper rounded-2xl border px-5 py-3 shadow-sm">
              <span className="text-navy text-2xl font-bold tracking-tight">OTTO</span>
              <span className="bg-navy ms-1 inline-block h-2 w-2 rounded-full" aria-hidden />
            </div>
          </div>
        </div>

        <h1 className="text-navy mb-2 text-xl font-semibold">הדף לא נמצא</h1>
        <p className="text-ink-soft mb-8 text-sm leading-relaxed">
          הקישור שביקשת לא קיים או הוסר.
          <br />
          בדוק שהכתובת נכונה או חזור לדף הבית.
        </p>

        <Link
          href="/dashboard"
          className="bg-navy text-cream hover:bg-navy-deep inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
