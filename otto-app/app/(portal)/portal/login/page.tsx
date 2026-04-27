import { PortalLoginForm } from "./login-form";

export const metadata = { title: "כניסה לפורטל לקוחות — OTTO" };

export default function PortalLoginPage() {
  return (
    <div className="bg-cream min-h-screen" dir="rtl">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="text-navy mb-1 text-2xl font-bold tracking-tight">OTTO</div>
            <p className="text-ink-soft text-sm">פורטל לקוחות</p>
          </div>

          <div className="bg-cream-paper border-ink-line rounded-2xl border p-6 shadow-sm">
            <h1 className="text-navy mb-1 text-lg font-semibold">כניסה לפורטל</h1>
            <p className="text-ink-soft mb-6 text-sm">נשלח לך קישור כניסה למייל</p>
            <PortalLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
