import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShieldX } from "lucide-react";

export const metadata = { title: "אין גישה — OTTO" };

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AccessPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <ShieldX size={40} className="text-red-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900">אין לך גישה למערכת</h1>
        <p className="mb-1 text-sm text-gray-600">
          החשבון <strong>{user?.email}</strong> לא מורשה להיכנס ל-OTTO.
        </p>
        <p className="mb-6 text-sm text-gray-500">פנה למנהל המערכת לקבלת גישה.</p>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
          >
            התנתק
          </button>
        </form>
      </div>
    </div>
  );
}
