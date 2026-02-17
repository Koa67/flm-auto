export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="space-y-6 text-center">
        <div className="mx-auto h-10 w-40 animate-pulse rounded-md bg-accent" />
        <div className="mx-auto h-4 w-64 animate-pulse rounded bg-accent" />
        <div className="mx-auto h-12 w-full animate-pulse rounded-lg bg-accent" />
      </div>
    </div>
  );
}
