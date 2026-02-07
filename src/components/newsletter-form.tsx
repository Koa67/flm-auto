"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Check, Mail } from "lucide-react";

export function NewsletterForm({
  source = "unknown",
  className,
}: {
  source?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      if (!res.ok) throw new Error();

      setStatus("success");
      toast.success("Inscription réussie !", {
        description: "Vous recevrez nos prochains classements et analyses.",
      });
    } catch {
      setStatus("error");
      toast.error("Erreur", {
        description: "Impossible de vous inscrire. Réessayez.",
      });
      setStatus("idle");
    }
  };

  if (status === "success") {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${className}`}>
        <Check className="h-5 w-5" />
        <span className="text-sm font-medium">Inscription confirmée !</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <Input
        type="email"
        placeholder="votre@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1"
      />
      <Button type="submit" disabled={status === "loading"}>
        {status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "S'inscrire"
        )}
      </Button>
    </form>
  );
}

export function NewsletterSection({
  source = "unknown",
}: {
  source?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Restez informé</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Recevez nos classements, analyses et guides automobiles.
      </p>
      <NewsletterForm source={source} className="mt-4" />
    </div>
  );
}
