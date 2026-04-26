"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import { updateTenant, type SettingsFormState } from "./actions";
import { useToast } from "@/components/ui/toast";

const init: SettingsFormState = {};

type Props = {
  initialName: string;
  onClose: () => void;
};

export function EditTenantDialog({ initialName, onClose }: Props) {
  const [state, action, pending] = useActionState(updateTenant, init);
  const toast = useToast();

  useEffect(() => {
    if (state.success) {
      toast.success("המותג עודכן");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-cream w-full max-w-md rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת המותג</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label className="text-micro text-ink-soft mb-1 block uppercase">שם המותג</label>
            <input
              name="name"
              defaultValue={initialName}
              className="border-ink-line focus:border-navy placeholder:text-ink-faded w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors outline-none"
            />
            {state.fieldErrors?.name?.[0] && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {pending ? "שומר..." : "שמור"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
