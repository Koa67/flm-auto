import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FLM Auto \u2014 Encyclop\u00e9die Automobile",
    template: "%s | FLM Auto",
  },
  description:
    "Encyclop\u00e9die automobile compl\u00e8te : 32 marques, 4000+ g\u00e9n\u00e9rations, fiches techniques, photos, comparateur et Family Fit.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "FLM Auto",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Nav />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
