interface HourBankProgressProps {
  purchased: number;
  consumed: number;
  alertThresholdPct: number;
  alertThresholdHours: number;
  size?: "sm" | "md";
}

export function HourBankProgress({
  purchased,
  consumed,
  alertThresholdPct,
  alertThresholdHours,
  size = "md",
}: HourBankProgressProps) {
  const safePurchased = purchased > 0 ? purchased : 0;
  const safeConsumed = Math.max(0, consumed);
  const available = Math.max(0, safePurchased - safeConsumed);
  const consumedPct = safePurchased > 0 ? Math.min(100, (safeConsumed / safePurchased) * 100) : 0;
  const remainingPct = 100 - consumedPct;

  const isCritical = available <= alertThresholdHours;
  const isWarning = !isCritical && remainingPct <= alertThresholdPct;

  const fillClass = isCritical ? "bg-rose-500" : isWarning ? "bg-yellow-500" : "bg-emerald-500";

  const textClass = isCritical
    ? "text-rose-600"
    : isWarning
      ? "text-yellow-700"
      : "text-emerald-700";

  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div>
      <div className="text-ink-soft mb-1 flex items-center justify-between text-xs">
        <span dir="ltr" className="font-mono">
          {safeConsumed.toFixed(2)}h / {safePurchased.toFixed(2)}h
        </span>
        <span dir="ltr" className={`font-mono font-medium ${textClass}`}>
          {available.toFixed(2)}h ({Math.round(remainingPct)}%)
        </span>
      </div>
      <div
        className={`bg-cream-deep w-full overflow-hidden rounded-full ${heightClass}`}
        role="progressbar"
        aria-valuenow={Math.round(consumedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`${fillClass} h-full transition-all duration-300`}
          style={{ width: `${consumedPct}%` }}
        />
      </div>
    </div>
  );
}
