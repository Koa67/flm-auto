import { VehicleCardsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="relative h-8 w-48 overflow-hidden rounded-md bg-accent">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      <div className="relative mt-2 h-5 w-56 overflow-hidden rounded-md bg-accent">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      <div className="mt-8">
        <VehicleCardsSkeleton count={9} />
      </div>
    </div>
  );
}
