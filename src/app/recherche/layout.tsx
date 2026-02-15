import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recherche de v\u00e9hicules",
  description: "Recherchez parmi 4000+ g\u00e9n\u00e9rations de v\u00e9hicules par marque, mod\u00e8le, motorisation et plus.",
  openGraph: {
    images: [{ url: "/api/og?title=Recherche&subtitle=4000%2B%20g%C3%A9n%C3%A9rations%20de%20v%C3%A9hicules" }],
  },
};

export default function RechercheLayout({ children }: { children: React.ReactNode }) {
  return children;
}
