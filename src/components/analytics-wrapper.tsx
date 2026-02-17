"use client";

import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";

const COOKIE_CONSENT_KEY = "flm-cookie-consent";

export function ConditionalAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted");

    // Listen for consent changes from the cookie banner
    function onStorage(e: StorageEvent) {
      if (e.key === COOKIE_CONSENT_KEY) {
        setConsented(e.newValue === "accepted");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!consented) return null;
  return <Analytics />;
}
