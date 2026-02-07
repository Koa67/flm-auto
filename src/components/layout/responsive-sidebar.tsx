"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { SmartFilters } from "@/components/filters/smart-filters";

export function ResponsiveSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-8">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-24">
          <SmartFilters />
        </div>
      </aside>

      {/* Mobile filter button */}
      <div className="fixed bottom-20 right-4 z-40 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg">
              <SlidersHorizontal className="mr-2 h-5 w-5" />
              Filtres
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
            <div className="mt-4 overflow-y-auto">
              <SmartFilters />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
