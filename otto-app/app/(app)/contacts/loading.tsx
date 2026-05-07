export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="bg-cream-deep h-7 w-40 animate-pulse rounded-lg" />
        <div className="bg-cream-deep mt-2 h-4 w-60 animate-pulse rounded" />
      </div>
      <div className="border-ink-line overflow-hidden rounded-2xl border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-ink-line/50 flex gap-4 border-b px-4 py-3">
            <div className="bg-cream-deep h-4 w-32 animate-pulse rounded" />
            <div className="bg-cream-deep h-4 w-24 animate-pulse rounded" />
            <div className="bg-cream-deep h-4 w-28 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
