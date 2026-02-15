export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-[var(--bg-tertiary)]" />
        <div className="h-4 w-80 rounded bg-[var(--bg-tertiary)]" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
