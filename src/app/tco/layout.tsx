import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateur TCO",
  description: "Calculez le co\u00fbt total de possession de votre v\u00e9hicule : carburant, assurance, entretien, d\u00e9cote.",
  openGraph: {
    images: [{ url: "/api/og?title=TCO&subtitle=Co%C3%BBt%20total%20de%20possession" }],
  },
};

export default function TcoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
