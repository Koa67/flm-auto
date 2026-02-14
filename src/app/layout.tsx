import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Toaster } from "sonner";
import { CommandPalette } from "@/components/command-palette";
import { FloatingCompareBar } from "@/components/compare/floating-compare-bar";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ConditionalAnalytics } from "@/components/analytics-wrapper";
import { CookieBanner } from "@/components/cookie-banner";
import dynamic from "next/dynamic";
const AlainChatWidget = dynamic(() => import("@/components/alain/chat-widget").then(m => m.AlainChatWidget));
import { AuthProvider } from "@/components/auth/auth-provider";
import { SWRegister } from "@/components/sw-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FLM Auto \u2014 Encyclop\u00e9die Automobile",
    template: "%s | FLM Auto",
  },
  description:
    "Encyclop\u00e9die automobile compl\u00e8te : 32 marques, 4000+ g\u00e9n\u00e9rations, fiches techniques, photos, comparateur et Family Fit.",
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "FLM Auto",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://gtixhrjeshkaobwxuvox.supabase.co" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <SWRegister />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
        >
          Aller au contenu principal
        </a>
        <ThemeProvider>
          <AuthProvider>
          <Nav />
          <CommandPalette />
          <Toaster richColors position="bottom-right" />
          <main id="main-content" className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <FloatingCompareBar />
          <OnboardingTour />
          <Footer />
          <AlainChatWidget />
          <CookieBanner />
          </AuthProvider>
        </ThemeProvider>
        <ConditionalAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
