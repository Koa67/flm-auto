/**
 * Generate FAQPage JSON-LD for /meilleur category pages.
 */
export function generateFAQSchema(
  categoryTitle: string,
  categoryDescription: string,
  categoryGroup: string,
  topVehicleName?: string
): Record<string, unknown> {
  const faqs: { question: string; answer: string }[] = [
    {
      question: `Quel est le classement ${categoryTitle.toLowerCase().replace(/^les /, "")} ?`,
      answer: topVehicleName
        ? `En ${new Date().getFullYear()}, le ${topVehicleName} arrive en tête de notre classement. ${categoryDescription}`
        : `Consultez notre classement actualisé. ${categoryDescription}`,
    },
    {
      question: "Comment est établi ce classement ?",
      answer: `${categoryDescription} Nos données proviennent de sources officielles (Euro NCAP, constructeurs) et sont mises à jour régulièrement.`,
    },
  ];

  // Group-specific FAQ
  if (categoryGroup === "famille") {
    faqs.push({
      question: "Quels critères pour une voiture familiale ?",
      answer:
        "Nous évaluons le score Family Fit incluant : nombre de points ISOFIX, compatibilité 3-across (3 sièges enfants côte à côte), volume de coffre et sécurité Euro NCAP.",
    });
  }
  if (categoryGroup === "securite") {
    faqs.push({
      question: "Comment Euro NCAP attribue les étoiles ?",
      answer:
        "Euro NCAP évalue sur 4 critères : protection des adultes, protection des enfants, protection des piétons/usagers vulnérables et technologies d'aide à la conduite.",
    });
  }
  if (categoryGroup === "performance") {
    faqs.push({
      question: "Les temps 0-100 km/h constructeur sont-ils fiables ?",
      answer:
        "Les temps constructeur sont souvent optimistes. Nous utilisons les données constructeur et indiquons quand des mesures indépendantes existent.",
    });
  }
  if (categoryGroup === "coffre") {
    faqs.push({
      question: "Comment le volume de coffre est-il mesuré ?",
      answer:
        "Le volume de coffre est mesuré selon la norme VDA (Verband der Automobilindustrie) en litres. Nous utilisons le volume banquette relevée comme référence.",
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}
