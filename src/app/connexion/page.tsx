"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  Chrome,
  Apple,
} from "lucide-react";

function ConnexionPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const error = searchParams.get("error");

  const supabase = createAuthClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect"
        : error.message);
      setLoading(false);
      return;
    }

    // Merge anonymous favorites
    try {
      await fetch("/api/wishlist/merge", { method: "POST" });
    } catch {}

    router.push(redirect);
    router.refresh();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caract\u00e8res");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("V\u00e9rifiez votre email pour confirmer votre compte");
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email de r\u00e9initialisation envoy\u00e9");
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      toast.error(
        error.message.includes("not enabled")
          ? "Ce fournisseur n\u2019est pas encore configur\u00e9"
          : error.message
      );
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold">Bienvenue</h1>
          <p className="mt-2 text-muted-foreground">
            Connectez-vous pour sauvegarder vos recherches et recevoir des
            alertes
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Une erreur est survenue lors de la connexion. Veuillez r&eacute;essayer.
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            {/* OAuth */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuth("google")}
                disabled={loading}
              >
                <Chrome className="mr-2 h-4 w-4" />
                Continuer avec Google
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOAuth("apple")}
                disabled={loading}
              >
                <Apple className="mr-2 h-4 w-4" />
                Continuer avec Apple
              </Button>
            </div>

            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-secondary)] px-4 text-xs text-muted-foreground">
                ou
              </span>
            </div>

            {/* Email/Password */}
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">
                  Connexion
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1">
                  Inscription
                </TabsTrigger>
                <TabsTrigger value="forgot" className="flex-1">
                  Oubli&eacute;
                </TabsTrigger>
              </TabsList>

              {/* Login */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-muted-foreground">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-muted-foreground">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>

              {/* Register */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-muted-foreground">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-muted-foreground">
                      Mot de passe (8 caract&egrave;res min.)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        required
                        minLength={8}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Cr&eacute;er un compte
                  </Button>
                </form>
              </TabsContent>

              {/* Forgot Password */}
              <TabsContent value="forgot">
                <form
                  onSubmit={handleForgotPassword}
                  className="mt-4 space-y-4"
                >
                  <div>
                    <label className="mb-2 block text-sm text-muted-foreground">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Envoyer le lien
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          En vous connectant, vous acceptez nos{" "}
          <Link href="/cgu" className="underline hover:text-primary">
            CGU
          </Link>{" "}
          et notre{" "}
          <Link
            href="/confidentialite"
            className="underline hover:text-primary"
          >
            politique de confidentialit&eacute;
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense>
      <ConnexionPageContent />
    </Suspense>
  );
}
