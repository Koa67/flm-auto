import { cn } from "@/lib/utils";

function Shimmer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-accent",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function BrandGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border bg-card p-4"
        >
          <Shimmer className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VehicleCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border bg-card">
          <Shimmer className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-5 w-32" />
            <div className="flex gap-3 pt-1">
              <Shimmer className="h-3 w-14" />
              <Shimmer className="h-3 w-14" />
              <Shimmer className="h-3 w-10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SpecsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="ml-auto h-4 w-20" />
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function VehiclePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex gap-2">
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-20" />
      </div>

      {/* Title */}
      <div className="mt-4 space-y-2">
        <Shimmer className="h-9 w-72" />
        <div className="flex gap-2">
          <Shimmer className="h-5 w-24" />
          <Shimmer className="h-5 w-20 rounded-full" />
          <Shimmer className="h-5 w-28 rounded-full" />
        </div>
      </div>

      {/* Hero image */}
      <Shimmer className="mt-6 aspect-[16/9] w-full rounded-xl" />

      {/* Tabs */}
      <div className="mt-8 flex gap-2">
        <Shimmer className="h-9 w-28 rounded-lg" />
        <Shimmer className="h-9 w-24 rounded-lg" />
        <Shimmer className="h-9 w-20 rounded-lg" />
      </div>

      {/* Table */}
      <div className="mt-6">
        <SpecsTableSkeleton />
      </div>
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Shimmer className="h-8 w-40" />
      <Shimmer className="mt-2 h-5 w-72" />
      <Shimmer className="mt-6 h-12 w-full rounded-xl" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
            <div className="flex-1 space-y-1">
              <Shimmer className="h-5 w-48" />
            </div>
            <Shimmer className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Shimmer className="h-8 w-48" />
      <Shimmer className="mt-2 h-5 w-64" />
      <div className="mt-6 flex gap-3">
        <Shimmer className="h-8 w-32 rounded-full" />
        <Shimmer className="h-8 w-32 rounded-full" />
      </div>
      <Shimmer className="mt-4 h-10 w-80 rounded-lg" />
      <Shimmer className="mt-4 h-10 w-32 rounded-lg" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="flex flex-col items-center px-4 py-24 text-center sm:py-32">
        <Shimmer className="h-14 w-80 sm:h-16 sm:w-96" />
        <Shimmer className="mt-3 h-14 w-48 sm:h-16 sm:w-56" />
        <Shimmer className="mt-4 h-5 w-72" />
        <Shimmer className="mt-8 h-12 w-full max-w-xl rounded-xl" />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className="flex justify-center gap-8 px-4 py-12 sm:gap-12">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Shimmer className="h-6 w-6 rounded" />
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Popular */}
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Shimmer className="mx-auto h-7 w-48" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border bg-card">
              <Shimmer className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Shimmer className="h-5 w-32" />
                <Shimmer className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SubPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex gap-2">
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-16" />
      </div>
      {/* Title */}
      <Shimmer className="mt-4 h-9 w-80" />
      <Shimmer className="mt-2 h-5 w-64" />
      {/* Nav tabs */}
      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 shrink-0 rounded-lg" />
        ))}
      </div>
      {/* Content */}
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function GallerySkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex gap-2">
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-20" />
      </div>
      <Shimmer className="mt-4 h-9 w-64" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Shimmer key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function VideosSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex gap-2">
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-20" />
      </div>
      <Shimmer className="mt-4 h-9 w-64" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border bg-card">
            <Shimmer className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Shimmer className="h-5 w-48" />
              <Shimmer className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SafetySkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex gap-2">
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-20" />
      </div>
      <Shimmer className="mt-4 h-9 w-72" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 shrink-0 rounded-lg" />
        ))}
      </div>
      {/* Stars card */}
      <div className="mt-6 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <Shimmer className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Shimmer className="h-8 w-32" />
            <Shimmer className="h-4 w-48" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RankingsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Shimmer className="h-4 w-24" />
      <Shimmer className="mt-4 h-9 w-80" />
      <Shimmer className="mt-2 h-5 w-72" />
      <div className="mt-10 space-y-12">
        {Array.from({ length: 3 }).map((_, g) => (
          <div key={g}>
            <Shimmer className="h-6 w-40" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <Shimmer className="h-10 w-10 shrink-0 rounded-lg" />
                  <div className="space-y-1">
                    <Shimmer className="h-5 w-36" />
                    <Shimmer className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BadgesSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Shimmer className="mx-auto h-9 w-48" />
      <Shimmer className="mx-auto mt-4 h-3 w-full max-w-md rounded-full" />
      <Shimmer className="mx-auto mt-2 h-4 w-24" />
      <div className="mt-8 flex justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
