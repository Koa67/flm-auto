import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Family Fit \u2014 Compatibilit\u00e9 si\u00e8ges enfants",
  description: "V\u00e9rifiez la compatibilit\u00e9 des si\u00e8ges auto pour enfants avec votre v\u00e9hicule.",
  openGraph: {
    images: [{ url: "/api/og?title=Family%20Fit&subtitle=Compatibilit%C3%A9%20si%C3%A8ges%20enfants" }],
  },
};

export default function FamilyFitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
