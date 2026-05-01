export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="bg-cream-deep h-8 w-32 animate-pulse rounded-xl" />
          <div className="bg-cream-deep h-4 w-20 animate-pulse rounded-lg" />
        </div>
        <div className="bg-cream-deep h-9 w-32 animate-pulse rounded-xl" />
      </div>
      <div className="bg-cream-deep h-11 w-full animate-pulse rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-cream-deep h-44 animate-pulse rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
