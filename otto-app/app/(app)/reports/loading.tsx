export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-cream-shadow h-7 w-32 animate-pulse rounded-lg" />
        <div className="bg-cream-shadow h-9 w-28 animate-pulse rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-cream-shadow h-36 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}
