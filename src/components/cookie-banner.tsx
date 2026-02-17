"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "flm-cookie-consent";

type ConsentValue = "accepted" | "declined";

export function getAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Show banner after a short delay to not block initial render
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleConsent(value: ConsentValue) {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row">
        <Cookie className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
        <p className="flex-1 text-sm text-muted-foreground">
          FLM Auto utilise des cookies analytiques (Vercel Analytics) pour
          am&eacute;liorer votre exp&eacute;rience. Aucune donn&eacute;e personnelle n&rsquo;est
          collect&eacute;e.{" "}
          <Link
            href="/confidentialite"
            className="underline hover:text-foreground"
          >
            En savoir plus
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleConsent("declined")}
          >
            Refuser
          </Button>
          <Button size="sm" onClick={() => handleConsent("accepted")}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
