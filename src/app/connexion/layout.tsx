import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion | FLM AUTO",
  robots: "noindex",
};

export default function ConnexionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
