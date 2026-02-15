import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon profil",
  description:
    "Cr\u00e9ez votre profil conducteur pour recevoir des recommandations personnalis\u00e9es de v\u00e9hicules.",
  robots: "noindex",
};

export default function ProfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
