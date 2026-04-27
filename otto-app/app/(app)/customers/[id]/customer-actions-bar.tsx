"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { WhatsAppButton } from "@/components/contact/whatsapp-button";
import { EditCustomerDialog } from "./edit-customer-dialog";
import { DeactivateCustomerButton } from "./delete-customer-button";

export function CustomerActionsBar({ customer }: { customer: Tables<"customers"> }) {
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <WhatsAppButton phone={customer.phone} variant="full" />
      <button
        onClick={() => setShowEdit(true)}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
      >
        <Pencil size={13} />
        ערוך
      </button>
      <DeactivateCustomerButton id={customer.id} active={customer.active ?? true} />
      {showEdit && <EditCustomerDialog customer={customer} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
