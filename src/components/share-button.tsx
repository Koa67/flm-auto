"use client";

import { useState } from "react";
import { Share2, Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  title?: string;
  text?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}

export function ShareButton({
  title,
  text,
  variant = "outline",
  size = "sm",
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const shareTitle = title || document.title;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text, url });
      } catch {
        // user cancelled or error — silently ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      className={className}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Copié
        </>
      ) : (
        <>
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Partager
        </>
      )}
    </Button>
  );
}
