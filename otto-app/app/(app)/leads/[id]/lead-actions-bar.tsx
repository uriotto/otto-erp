"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { WhatsAppButton } from "@/components/contact/whatsapp-button";
import { EditLeadDialog } from "./edit-lead-dialog";
import { DeleteLeadButton } from "./delete-lead-button";
import { ConvertButton } from "./convert-button";

export function LeadActionsBar({ lead }: { lead: Tables<"leads"> }) {
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <WhatsAppButton phone={lead.phone} variant="full" />
      <button
        onClick={() => setShowEdit(true)}
        className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
      >
        <Pencil size={13} />
        ערוך
      </button>
      <ConvertButton
        leadId={lead.id}
        alreadyConverted={!!lead.converted_to_customer_id}
        customerId={lead.converted_to_customer_id}
      />
      <DeleteLeadButton id={lead.id} />
      {showEdit && <EditLeadDialog lead={lead} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
