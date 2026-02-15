import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulateur de coffre",
  description: "Testez si vos bagages, poussettes et \u00e9quipements tiennent dans le coffre de votre v\u00e9hicule.",
  openGraph: {
    images: [{ url: "/api/og?title=Coffre&subtitle=Simulateur%20de%20chargement" }],
  },
};

export default function CoffreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
