interface PDFVehicle {
  brand: string;
  model: string;
  generation: string;
  years: string;
  top_spec: {
    power_hp: number | null;
    torque_nm: number | null;
    displacement_cc: number | null;
    acceleration_0_100: number | null;
    top_speed_kmh: number | null;
  } | null;
  variants_count: number;
  safety: { rating: number; year: number } | null;
  dimensions: {
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    wheelbase_mm: number | null;
    trunk_liters: number | null;
    trunk_max_liters: number | null;
  };
  weight_kg: number | null;
  consumption_l_100: number | null;
  co2_g_km: number | null;
}

export async function exportComparisonPDF(vehicles: PDFVehicle[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const fmt = (v: number | null | undefined, unit: string) =>
    v != null ? `${v} ${unit}` : "\u2014";

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FLM AUTO \u2014 Comparaison", 14, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    new Date().toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    14,
    22
  );

  const headers = [
    "Caract\u00e9ristique",
    ...vehicles.map((v) => `${v.brand} ${v.model}`),
  ];

  const rows = [
    ["G\u00e9n\u00e9ration", ...vehicles.map((v) => v.generation)],
    ["Ann\u00e9es", ...vehicles.map((v) => v.years)],
    ["Motorisations", ...vehicles.map((v) => String(v.variants_count))],
    [
      "Puissance max",
      ...vehicles.map((v) => fmt(v.top_spec?.power_hp, "ch")),
    ],
    ["Couple max", ...vehicles.map((v) => fmt(v.top_spec?.torque_nm, "Nm"))],
    [
      "Cylindr\u00e9e",
      ...vehicles.map((v) => fmt(v.top_spec?.displacement_cc, "cm\u00b3")),
    ],
    [
      "0-100 km/h",
      ...vehicles.map((v) =>
        v.top_spec?.acceleration_0_100
          ? `${v.top_spec.acceleration_0_100}s`
          : "\u2014"
      ),
    ],
    [
      "V. max",
      ...vehicles.map((v) => fmt(v.top_spec?.top_speed_kmh, "km/h")),
    ],
    ["Longueur", ...vehicles.map((v) => fmt(v.dimensions?.length_mm, "mm"))],
    ["Largeur", ...vehicles.map((v) => fmt(v.dimensions?.width_mm, "mm"))],
    ["Hauteur", ...vehicles.map((v) => fmt(v.dimensions?.height_mm, "mm"))],
    [
      "Empattement",
      ...vehicles.map((v) => fmt(v.dimensions?.wheelbase_mm, "mm")),
    ],
    ["Coffre", ...vehicles.map((v) => fmt(v.dimensions?.trunk_liters, "L"))],
    [
      "Coffre max",
      ...vehicles.map((v) => fmt(v.dimensions?.trunk_max_liters, "L")),
    ],
    ["Poids", ...vehicles.map((v) => fmt(v.weight_kg, "kg"))],
    [
      "Conso. mixte",
      ...vehicles.map((v) =>
        v.consumption_l_100 ? `${v.consumption_l_100} L/100` : "\u2014"
      ),
    ],
    [
      "CO\u2082",
      ...vehicles.map((v) => fmt(v.co2_g_km, "g/km")),
    ],
    [
      "Euro NCAP",
      ...vehicles.map((v) =>
        v.safety ? `${v.safety.rating}/5 (${v.safety.year})` : "\u2014"
      ),
    ],
  ];

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [9, 9, 11],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
    styles: { cellPadding: 3 },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text("G\u00e9n\u00e9r\u00e9 sur flm-auto.fr", 14, pageHeight - 8);

  // Download
  const names = vehicles.map((v) => `${v.brand}-${v.model}`).join("_vs_");
  doc.save(`comparaison-${names}.pdf`);
}
