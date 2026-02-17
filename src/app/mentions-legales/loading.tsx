export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="h-8 w-64 animate-pulse rounded-md bg-accent" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-accent" />
        ))}
      </div>
    </div>
  );
}
