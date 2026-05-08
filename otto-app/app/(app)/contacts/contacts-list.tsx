"use client";

import { useState, useEffect } from "react";
import { Plus, Phone, MessageCircle, Pencil, Trash2, Search, Users } from "lucide-react";
import { saveFilters, loadFilters } from "@/lib/persist-filters";
import { deleteContact } from "./actions";
import { ContactDialog } from "./contact-dialog";
import { useToast } from "@/components/ui/toast";
import type { Tables } from "@/lib/supabase/types";

type Contact = Tables<"contacts"> & {
  customer?: { id: string; name: string } | null;
};
type Customer = { id: string; name: string };

const PAGE_KEY = "contacts";

function formatWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

function ContactActions({
  contact,
  customers,
  onDeleted,
}: {
  contact: Contact;
  customers: Customer[];
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  async function handleDelete() {
    if (!confirm(`למחוק את ${contact.name}?`)) return;
    const result = await deleteContact(contact.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("נמחק");
      onDeleted();
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {contact.phone && (
          <>
            <a
              href={`tel:${contact.phone}`}
              className="text-ink-faded hover:text-navy rounded p-1.5 transition-colors"
              title="התקשר"
            >
              <Phone size={15} />
            </a>
            <a
              href={`https://wa.me/${formatWhatsApp(contact.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-faded rounded p-1.5 transition-colors hover:text-green-600"
              title="WhatsApp"
            >
              <MessageCircle size={15} />
            </a>
          </>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-ink-faded hover:text-navy rounded p-1.5 transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={handleDelete}
          className="text-ink-faded rounded p-1.5 transition-colors hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {editing && (
        <ContactDialog contact={contact} customers={customers} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

export function ContactsList({
  initialContacts,
  customers,
}: {
  initialContacts: Contact[];
  customers: Customer[];
}) {
  const saved = loadFilters(PAGE_KEY);
  const [search, setSearch] = useState(saved?.search ?? "");
  const [customerFilter, setCustomerFilter] = useState(saved?.customer ?? "all");
  const [showNew, setShowNew] = useState(false);
  const [contacts, setContacts] = useState(initialContacts);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    saveFilters(PAGE_KEY, { search, customer: customerFilter });
  }, [search, customerFilter]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.role ?? "").toLowerCase().includes(q);
    const matchCustomer =
      customerFilter === "all" ||
      (customerFilter === "none" && !c.customer_id) ||
      c.customer_id === customerFilter;
    return matchSearch && matchCustomer;
  });

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="text-ink-faded absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש שם, אימייל, טלפון..."
            className="border-ink-line focus:border-navy w-full rounded-lg border bg-white py-2 ps-9 pe-3 text-sm outline-none"
          />
        </div>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="border-ink-line focus:border-navy rounded-lg border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="all">כל הלקוחות</option>
          <option value="none">ללא לקוח</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowNew(true)}
          className="bg-navy text-cream-paper flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
        >
          <Plus size={15} />
          איש קשר חדש
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-ink-faded flex flex-col items-center py-16 text-sm">
          <Users size={32} className="mb-3 opacity-30" />
          {search || customerFilter !== "all" ? "לא נמצאו אנשי קשר" : "אין אנשי קשר עדיין"}
        </div>
      ) : (
        <div className="border-ink-line overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-cream-deep/40">
              <tr>
                <th className="text-ink-faded text-micro px-4 py-3 text-start font-medium uppercase">
                  שם
                </th>
                <th className="text-ink-faded text-micro px-4 py-3 text-start font-medium uppercase">
                  תפקיד
                </th>
                <th className="text-ink-faded text-micro px-4 py-3 text-start font-medium uppercase">
                  לקוח
                </th>
                <th className="text-ink-faded text-micro px-4 py-3 text-start font-medium uppercase">
                  אימייל
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-ink-line/50 divide-y">
              {filtered.map((contact) => (
                <tr key={contact.id} className="hover:bg-cream-deep/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-navy font-medium">{contact.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft">{contact.role ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {contact.customer ? (
                      <a
                        href={`/customers/${contact.customer.id}`}
                        className="text-navy text-xs hover:underline"
                      >
                        {contact.customer.name}
                      </a>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-ink-soft hover:text-navy text-xs"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ContactActions
                      contact={contact}
                      customers={customers}
                      onDeleted={() =>
                        setContacts((prev) => prev.filter((c) => c.id !== contact.id))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <ContactDialog customers={customers} onClose={() => setShowNew(false)} />}
    </div>
  );
}
