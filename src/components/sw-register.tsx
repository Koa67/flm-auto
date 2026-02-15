"use client";

import { useEffect } from "react";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register(`/sw.js?v=${BUILD_ID}`)
        .then((reg) => {
          // Force update check on every page load
          reg.update();
        })
        .catch(() => {
          // SW registration failed — not critical
        });
    }
  }, []);

  return null;
}
