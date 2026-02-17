export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-accent" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-accent" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-accent" />
          ))}
        </div>
      </div>
    </div>
  );
}
