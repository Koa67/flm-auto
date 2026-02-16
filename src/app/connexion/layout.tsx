import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion",
  robots: "noindex",
};

export default function ConnexionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
