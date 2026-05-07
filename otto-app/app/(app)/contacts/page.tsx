import { createClient } from "@/lib/supabase/server";
import { ContactsList } from "./contacts-list";
import type { Tables } from "@/lib/supabase/types";

export const metadata = { title: "אנשי קשר — OTTO" };

type ContactWithCustomer = Tables<"contacts"> & {
  customer?: { id: string; name: string } | null;
};

export default async function ContactsPage() {
  const supabase = await createClient();

  const [{ data: contacts }, { data: customers }] = await Promise.all([
    supabase.from("contacts").select("*, customer:customers(id, name)").order("name"),
    supabase.from("customers").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-sm text-navy">אנשי קשר</h1>
          <p className="text-ink-soft mt-1 text-sm">לקוחות, ספקים ושותפים עסקיים</p>
        </div>
      </div>
      <ContactsList
        initialContacts={(contacts ?? []) as ContactWithCustomer[]}
        customers={customers ?? []}
      />
    </div>
  );
}
