export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="bg-cream-paper border-ink-line w-full max-w-2xl rounded-2xl border p-10">
        <span className="text-micro text-ink-faded mb-4 block uppercase">OTTO · גרסה 0.1</span>

        <h1 className="text-display-lg text-navy mb-3">ברוך הבא ל-OTTO</h1>

        <span className="font-caveat text-ink-faded mb-8 inline-block -rotate-1 text-3xl" dir="ltr">
          automate your success
        </span>

        <p className="text-ink-soft mb-8 text-base leading-relaxed">
          זוהי בדיקת בסיס לפלטת הצבעים, הטיפוגרפיה, וה-RTL. אם הטקסט זורם נכון מימין לשמאל ושני
          הפונטים נטענים — Phase 1.1 תקין.
        </p>

        <div className="mb-8 grid grid-cols-4 gap-3">
          <ColorSwatch label="cream" className="bg-cream border-ink-line" />
          <ColorSwatch label="cream-deep" className="bg-cream-deep border-ink-line" />
          <ColorSwatch label="cream-paper" className="bg-cream-paper border-ink-line" />
          <ColorSwatch label="cream-shadow" className="bg-cream-shadow border-ink-line" />
          <ColorSwatch label="navy" className="bg-navy text-cream-paper border-navy" />
          <ColorSwatch
            label="navy-deep"
            className="bg-navy-deep text-cream-paper border-navy-deep"
          />
          <ColorSwatch
            label="navy-soft"
            className="bg-navy-soft text-cream-paper border-navy-soft"
          />
          <ColorSwatch label="navy-pale" className="bg-navy-pale border-ink-line" />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2.5 font-semibold transition-colors"
          >
            כפתור ראשי
          </button>
          <button
            type="button"
            className="bg-cream-paper text-navy border-ink-line hover:border-navy rounded-lg border px-5 py-2.5 font-semibold transition-colors"
          >
            משני
          </button>
        </div>
      </div>
    </main>
  );
}

function ColorSwatch({ label, className }: { label: string; className: string }) {
  return (
    <div className={`flex h-16 items-end rounded-xl border p-2 font-mono text-[11px] ${className}`}>
      {label}
    </div>
  );
}
