import { cn } from "@/lib/utils";

export function GradientDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("gradient-divider", className)}
      role="separator"
    />
  );
}
