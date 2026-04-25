import { LoginForm } from "./login-form";

export const metadata = {
  title: "כניסה — OTTO",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="bg-cream-paper border-ink-line w-full max-w-md rounded-2xl border p-10">
        <span className="text-micro text-ink-faded mb-3 block uppercase">OTTO</span>

        <h1 className="text-display-md text-navy mb-2">ברוך הבא</h1>

        <span className="font-caveat text-ink-faded mb-6 inline-block -rotate-1 text-xl" dir="ltr">
          automate your success
        </span>

        <p className="text-ink-soft mb-8 text-sm leading-relaxed">
          הזן את כתובת המייל שלך — נשלח אליך קישור לכניסה. אין צורך בסיסמה.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}
