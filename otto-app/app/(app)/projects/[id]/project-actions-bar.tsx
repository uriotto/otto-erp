"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { deleteProject } from "../actions";
import { EditProjectDialog } from "./edit-project-dialog";

export function ProjectActionsBar({
  project,
  customers,
  parentOptions,
}: {
  project: Tables<"projects">;
  customers: { id: string; name: string }[];
  parentOptions: { id: string; name: string }[];
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleDelete() {
    if (!confirm("למחוק את הפרויקט הזה?")) return;
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("הפרויקט נמחק");
      router.push("/projects");
    });
  }

  return (
    <>
      <div className="border-ink-line mt-4 flex items-center gap-2 border-t pt-4">
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="border-ink-line text-navy hover:border-navy flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <Edit2 size={13} />
          ערוך
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-busy={pending}
          className="text-ink-faded ms-auto flex items-center gap-1.5 text-xs transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Spinner size={13} /> : <Trash2 size={13} />}
          {pending ? "מוחק" : "מחק פרויקט"}
        </button>
      </div>

      {showEdit && (
        <EditProjectDialog
          project={project}
          customers={customers}
          parentOptions={parentOptions}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
