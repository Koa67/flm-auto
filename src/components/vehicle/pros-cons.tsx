"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";

interface ProCon {
  text: string;
  icon: string;
}

interface ProsConsProps {
  pros: ProCon[];
  cons: ProCon[];
}

export function ProsCons({ pros, cons }: ProsConsProps) {
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Pros */}
      {pros.length > 0 && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-500/20 p-2">
              <ThumbsUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-500">Points forts</p>
          </div>
          <div className="space-y-3">
            {pros.map((pro, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-green-500/5 p-3"
              >
                <span className="text-lg">{pro.icon}</span>
                <p className="text-sm">{pro.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cons */}
      {cons.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-500/20 p-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-lg font-bold text-red-500">Points faibles</p>
          </div>
          <div className="space-y-3">
            {cons.map((con, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-red-500/5 p-3"
              >
                <span className="text-lg">{con.icon}</span>
                <p className="text-sm">{con.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

