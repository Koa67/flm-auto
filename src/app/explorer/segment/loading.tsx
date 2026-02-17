import { VehicleCardsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="h-4 w-32 animate-pulse rounded bg-accent" />
      <div className="mt-4 h-8 w-48 animate-pulse rounded-md bg-accent" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded bg-accent" />
      <div className="mt-8">
        <VehicleCardsSkeleton count={12} />
      </div>
    </div>
  );
}
