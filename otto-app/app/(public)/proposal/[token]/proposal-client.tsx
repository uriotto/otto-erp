"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, PenLine, RotateCcw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { signProposal, type ProposalModule } from "./sign-action";

type Proposal = NonNullable<Awaited<ReturnType<typeof import("./sign-action").getProposalByToken>>>;

function formatCurrency(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ProposalClient({ proposal, token }: { proposal: Proposal; token: string }) {
  const modules = (Array.isArray(proposal.modules) ? proposal.modules : []) as ProposalModule[];
  const mandatory = modules.filter((m) => !m.optional);
  const optional = modules.filter((m) => m.optional);

  const [selected, setSelected] = useState<Set<string>>(new Set(optional.map((m) => m.id)));
  const [showSignature, setShowSignature] = useState(false);
  const [signed, setSigned] = useState(proposal.status === "signed");

  const total =
    mandatory.reduce((s, m) => s + m.price, 0) +
    optional.filter((m) => selected.has(m.id)).reduce((s, m) => s + m.price, 0);

  const toggleModule = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (signed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          {proposal.status === "signed" && proposal.signer_name
            ? `תודה, ${proposal.signer_name}!`
            : "ההצעה נחתמה בהצלחה!"}
        </h1>
        <p className="text-gray-500">
          {proposal.signed_at
            ? `נחתם ב-${formatDate(proposal.signed_at)}`
            : "ההצעה שלך התקבלה ונשמרה במערכת"}
        </p>
      </div>
    );
  }

  const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="mb-1 text-sm font-semibold tracking-widest text-gray-400 uppercase">OTTO</p>
        <h1 className="text-3xl font-bold text-gray-900">{proposal.title}</h1>
        {proposal.customers && (
          <p className="mt-1 text-gray-500">
            {(proposal.customers as { name: string; company: string | null }).company ||
              (proposal.customers as { name: string }).name}
          </p>
        )}
        {proposal.valid_until && (
          <p className={`mt-2 text-sm ${isExpired ? "text-red-500" : "text-gray-400"}`}>
            {isExpired ? "תוקף ההצעה פג" : `בתוקף עד ${formatDate(proposal.valid_until)}`}
          </p>
        )}
      </div>

      {/* Notes */}
      {proposal.notes && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
            {proposal.notes}
          </p>
        </div>
      )}

      {/* Modules */}
      {modules.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
            פירוט השירותים
          </h2>

          {mandatory.map((m) => (
            <ModuleRow key={m.id} module={m} checked disabled />
          ))}

          {optional.length > 0 && (
            <>
              <p className="pt-1 text-xs text-gray-400">
                שירותים אופציונליים — בחר מה רלוונטי עבורך
              </p>
              {optional.map((m) => (
                <ModuleRow
                  key={m.id}
                  module={m}
                  checked={selected.has(m.id)}
                  onChange={() => toggleModule(m.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Total */}
      <div className="mb-8 flex items-center justify-between rounded-2xl bg-gray-900 px-6 py-4 text-white">
        <span className="text-sm font-medium">
          {modules.length > 0 ? "סה״כ לתשלום" : "סכום ההצעה"}
        </span>
        <span className="text-xl font-bold" dir="ltr">
          {modules.length > 0
            ? formatCurrency(total)
            : proposal.amount
              ? formatCurrency(proposal.amount)
              : "—"}
        </span>
      </div>

      {/* Sign button / form */}
      {isExpired ? (
        <div className="rounded-2xl bg-red-50 p-5 text-center text-sm text-red-600">
          תוקף ההצעה פג. ניתן ליצור קשר לקבלת הצעה מעודכנת.
        </div>
      ) : showSignature ? (
        <SignatureForm
          token={token}
          selectedModuleIds={Array.from(selected)}
          onSigned={() => setSigned(true)}
          onCancel={() => setShowSignature(false)}
        />
      ) : (
        <button
          onClick={() => setShowSignature(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-base font-semibold text-white transition hover:bg-gray-800 active:scale-[0.98]"
        >
          <PenLine size={18} />
          אישור וחתימה
        </button>
      )}
    </div>
  );
}

function ModuleRow({
  module,
  checked,
  disabled,
  onChange,
}: {
  module: ProposalModule;
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-all ${
        checked ? "ring-gray-900/20" : "ring-gray-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded accent-gray-900 disabled:cursor-default"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-medium ${checked ? "text-gray-900" : "text-gray-400"}`}>
              {module.name}
            </span>
            <span
              className={`shrink-0 text-sm font-bold ${checked ? "text-gray-900" : "text-gray-300"}`}
              dir="ltr"
            >
              {formatCurrency(module.price)}
            </span>
          </div>
          {module.description && (
            <>
              {expanded && (
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{module.description}</p>
              )}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? "פחות" : "פרטים"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SignatureForm({
  token,
  selectedModuleIds,
  onSigned,
  onCancel,
}: {
  token: string;
  selectedModuleIds: string[];
  onSigned: () => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    const me = e as React.MouseEvent;
    return {
      x: (me.clientX - rect.left) * scaleX,
      y: (me.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setDrawing(true);
    setHasDrawn(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDraw() {
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function handleSubmit() {
    if (!hasDrawn) {
      setError("נא לחתום בתיבת החתימה");
      return;
    }
    if (!name.trim()) {
      setError("שם מלא חובה");
      return;
    }
    if (!email.trim()) {
      setError("אימייל חובה");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("כתובת אימייל לא תקינה");
      return;
    }
    const signatureData = canvasRef.current!.toDataURL("image/png");
    setError(null);
    startTransition(async () => {
      const res = await signProposal(token, name, email, signatureData, selectedModuleIds);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSigned();
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">אישור וחתימה</h3>

      <div className="mb-4 space-y-3">
        <input
          type="text"
          placeholder="שם מלא"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gray-400"
        />
        <input
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gray-400"
          dir="ltr"
        />
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-gray-400">חתמו בתיבה למטה</span>
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <RotateCcw size={11} />
          נקה
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={560}
        height={160}
        className="mb-4 w-full cursor-crosshair touch-none rounded-xl bg-gray-50"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
          אשר וחתום
        </button>
      </div>
    </div>
  );
}
