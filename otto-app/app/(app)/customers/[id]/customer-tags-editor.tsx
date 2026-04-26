"use client";

import { useRef, useState, useTransition } from "react";
import { TagsInput } from "@/components/tags/tags-input";
import { updateCustomerTags } from "@/components/tags/actions";

interface CustomerTagsEditorProps {
  customerId: string;
  initialTags: string[];
}

export function CustomerTagsEditor({ customerId, initialTags }: CustomerTagsEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);
  const lastSavedRef = useRef<string[]>(initialTags);

  function handleChange(next: string[]) {
    setTags(next);
    setError(null);
    const myId = ++requestId.current;
    startTransition(async () => {
      const result = await updateCustomerTags(customerId, next);
      // אם בינתיים נשלחה קריאה חדשה — מתעלם מהתוצאה הזו
      if (myId !== requestId.current) return;
      if (result.error) {
        setTags(lastSavedRef.current);
        setError(result.error);
      } else {
        lastSavedRef.current = next;
      }
    });
  }

  return (
    <div className="border-ink-line mt-5 border-t pt-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-micro text-ink-faded uppercase">תגיות</p>
        {pending && <span className="text-ink-faded text-[10px]">שומר...</span>}
      </div>
      <TagsInput value={tags} onChange={handleChange} disabled={pending} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
