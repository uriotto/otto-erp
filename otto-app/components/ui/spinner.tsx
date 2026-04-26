export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[2px] border-current/30 border-t-current ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
