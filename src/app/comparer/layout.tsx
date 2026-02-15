import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparateur de v\u00e9hicules",
  description: "Comparez jusqu\u2019\u00e0 4 v\u00e9hicules c\u00f4te \u00e0 c\u00f4te : performances, dimensions, s\u00e9curit\u00e9, consommation.",
  openGraph: {
    images: [{ url: "/api/og?title=Comparateur&subtitle=Comparez%20jusqu%27%C3%A0%204%20v%C3%A9hicules" }],
  },
};

export default function ComparerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
