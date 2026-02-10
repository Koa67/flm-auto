import { VehicleCardsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded bg-accent" />
      <div className="mt-2 h-5 w-72 animate-pulse rounded bg-accent" />
      <div className="mt-8">
        <VehicleCardsSkeleton />
      </div>
    </div>
  );
}
