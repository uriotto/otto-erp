"use client";

import { useRef, useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, RotateCcw, PenLine } from "lucide-react";
import { signDocument } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

export function SignatureDialog({
  documentId,
  documentTitle,
  onClose,
}: {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#faf8f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a2744";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      if (!t) return { x: 0, y: 0 };
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  }

  function stopDraw() {
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#faf8f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  const handleSign = useCallback(() => {
    if (!hasSignature) {
      toast.error("יש לחתום בשדה החתימה");
      return;
    }
    if (!name.trim()) {
      toast.error("שם חובה");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL("image/png");

    startTransition(async () => {
      const result = await signDocument({
        id: documentId,
        signature_data: signatureData,
        signed_by_name: name.trim(),
        signed_by_email: email.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("המסמך נחתם בהצלחה");
      router.refresh();
      onClose();
    });
  }, [hasSignature, name, email, documentId, toast, router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="bg-navy/30 fixed inset-0" onClick={onClose} />
      <div className="bg-cream-paper border-ink-line relative z-10 w-full max-w-md rounded-t-2xl border sm:rounded-2xl">
        <div className="border-ink-line flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <PenLine size={16} className="text-navy" />
            <h2 className="text-navy font-semibold">חתימה דיגיטלית</h2>
          </div>
          <button onClick={onClose} className="text-ink-faded hover:text-navy rounded p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-ink-soft text-sm">
            חותם על: <span className="text-navy font-medium">{documentTitle}</span>
          </p>

          {/* Signature canvas */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-ink-soft text-xs">חתימה</label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-ink-faded hover:text-navy flex items-center gap-1 text-xs"
              >
                <RotateCcw size={11} /> נקה
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={440}
              height={160}
              className="border-ink-line w-full cursor-crosshair touch-none rounded-xl border"
              style={{ background: "#faf8f5" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasSignature && (
              <p className="text-ink-faded mt-1 text-center text-xs">חתום כאן בעכבר או אצבע</p>
            )}
          </div>

          <div>
            <label className="text-ink-soft mb-1 block text-xs">שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-ink-line bg-cream focus:border-navy w-full rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="ישראל ישראלי"
              required
            />
          </div>
          <div>
            <label className="text-ink-soft mb-1 block text-xs">אימייל (אופציונלי)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-ink-line bg-cream focus:border-navy w-full rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="name@example.com"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line hover:bg-cream rounded-lg border px-4 py-2 text-sm"
            >
              ביטול
            </button>
            <button
              onClick={handleSign}
              disabled={isPending || !hasSignature || !name.trim()}
              className="bg-navy text-cream-paper hover:bg-navy/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Spinner size={14} /> שומר...
                </>
              ) : (
                "אשר חתימה"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
