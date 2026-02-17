// ─── FLM AUTO — TCO Calculator (France 2026) ───────────

export interface TCOParams {
  prixAchat: number;
  dureeDetentionMois: number;
  kmAnnuels: number;
  consoReelleL100: number;
  prixCarburantL: number;
  emissionsCO2: number;
  typeCarburant: "essence" | "diesel" | "electrique" | "hybride" | "hybride_rechargeable";
  puissanceCv: number;
  segment: string;
  /** Optional: real market prices by age (year 0..5) for market-based depreciation */
  occasionPrices?: { age: number; price: number }[];
}

export interface TCOResult {
  mensuel: number;
  total: number;
  details: {
    depreciation: number;
    carburant: number;
    assurance: number;
    entretien: number;
    malus: number;
    carteGrise: number;
  };
  detailsMensuels: {
    depreciation: number;
    carburant: number;
    assurance: number;
    entretien: number;
    malus: number;
    carteGrise: number;
  };
}

// Bar\u00e8me malus \u00e9cologique 2025 (simplifi\u00e9)
export function calculateMalus2025(co2: number): number {
  if (co2 <= 117) return 0;
  if (co2 <= 118) return 50;
  if (co2 <= 119) return 75;
  if (co2 <= 120) return 100;
  if (co2 <= 121) return 125;
  if (co2 <= 122) return 150;
  if (co2 <= 123) return 170;
  if (co2 <= 124) return 190;
  if (co2 <= 125) return 210;
  if (co2 <= 126) return 230;
  if (co2 <= 127) return 240;
  if (co2 <= 128) return 260;
  if (co2 <= 129) return 280;
  if (co2 <= 130) return 310;
  if (co2 <= 131) return 330;
  if (co2 <= 132) return 360;
  if (co2 <= 133) return 400;
  if (co2 <= 134) return 450;
  if (co2 <= 135) return 540;
  if (co2 <= 136) return 650;
  if (co2 <= 137) return 740;
  if (co2 <= 138) return 818;
  if (co2 <= 139) return 898;
  if (co2 <= 140) return 983;
  if (co2 <= 141) return 1074;
  if (co2 <= 142) return 1172;
  if (co2 <= 143) return 1276;
  if (co2 <= 144) return 1386;
  if (co2 <= 145) return 1504;
  if (co2 <= 146) return 1629;
  if (co2 <= 147) return 1761;
  if (co2 <= 148) return 1901;
  if (co2 <= 149) return 2049;
  if (co2 <= 150) return 2205;
  if (co2 <= 155) return 3784;
  if (co2 <= 160) return 5765;
  if (co2 <= 165) return 8145;
  if (co2 <= 170) return 10987;
  if (co2 <= 175) return 14386;
  if (co2 <= 180) return 18484;
  if (co2 <= 185) return 23489;
  if (co2 <= 190) return 29715;
  if (co2 <= 195) return 37611;
  if (co2 <= 200) return 47734;
  return Math.min(60000, 47734 + (co2 - 200) * 2000); // Plafond 60 000 \u20ac
}

// Estimation assurance annuelle
export function estimateInsurance(segment: string, puissanceCv: number): number {
  const base: Record<string, number> = {
    citadine: 450,
    compacte: 550,
    berline: 650,
    suv: 700,
    break: 600,
    coupe: 800,
    cabriolet: 900,
    monospace: 600,
    utilitaire: 500,
  };
  let annual = base[segment.toLowerCase()] || 600;
  // Ajustement puissance
  if (puissanceCv > 200) annual *= 1.4;
  else if (puissanceCv > 150) annual *= 1.2;
  else if (puissanceCv > 100) annual *= 1.05;
  return Math.round(annual);
}

// Estimation entretien annuel
export function estimateMaintenanceCost(
  typeCarburant: string,
  kmAnnuels: number
): number {
  const basePar1000km: Record<string, number> = {
    essence: 45,
    diesel: 50,
    electrique: 20,
    hybride: 40,
    hybride_rechargeable: 38,
  };
  const rate = basePar1000km[typeCarburant] || 45;
  return Math.round((kmAnnuels / 1000) * rate);
}

// Estimation carte grise (r\u00e9gion \u00cele-de-France par d\u00e9faut)
function estimateCarteGrise(puissanceCv: number): number {
  const prixCv = 54.95; // IDF 2025
  const cvFiscaux = Math.ceil(puissanceCv / 40) + 1; // Approximation
  return Math.round(cvFiscaux * prixCv);
}

// D\u00e9cote annuelle par type
function decoteAnnuelle(prixAchat: number, typeCarburant: string, annee: number): number {
  // Ann\u00e9e 1 : 20-25%, ann\u00e9es suivantes : 10-15%
  const taux = annee === 1 ? 0.22 : 0.12;
  const coefEv = typeCarburant === "electrique" ? 1.15 : 1.0; // EV d\u00e9cotent plus
  return prixAchat * taux * coefEv;
}

// TCO complet
export function calculateTCO(params: TCOParams): TCOResult {
  const {
    prixAchat,
    dureeDetentionMois,
    kmAnnuels,
    consoReelleL100,
    prixCarburantL,
    emissionsCO2,
    typeCarburant,
    puissanceCv,
    segment,
  } = params;

  const annees = dureeDetentionMois / 12;

  // D\u00e9pr\u00e9ciation \u2014 real market prices if available, else forfait
  let depreciationTotale = 0;
  if (params.occasionPrices && params.occasionPrices.length >= 2) {
    const sorted = [...params.occasionPrices].sort((a, b) => a.age - b.age);
    const endAge = Math.min(Math.round(annees), sorted[sorted.length - 1].age);
    const priceAtAge = (age: number): number => {
      const exact = sorted.find((p) => p.age === age);
      if (exact) return exact.price;
      const before = sorted.filter((p) => p.age <= age).pop();
      const after = sorted.find((p) => p.age > age);
      if (!before) return sorted[0].price;
      if (!after) return sorted[sorted.length - 1].price;
      const ratio = (age - before.age) / (after.age - before.age);
      return before.price + (after.price - before.price) * ratio;
    };
    depreciationTotale = Math.max(0, priceAtAge(0) - priceAtAge(endAge));
  } else {
    for (let a = 1; a <= Math.ceil(annees); a++) {
      const fraction = a <= Math.floor(annees) ? 1 : annees % 1;
      depreciationTotale += decoteAnnuelle(prixAchat, typeCarburant, a) * fraction;
    }
  }

  // Carburant
  const kmTotaux = kmAnnuels * annees;
  let coutCarburant: number;
  if (typeCarburant === "electrique") {
    // kWh/100km \u00d7 prix kWh (~0.25 \u20ac)
    coutCarburant = (kmTotaux * consoReelleL100 * 0.25) / 100;
  } else {
    coutCarburant = (kmTotaux * consoReelleL100 * prixCarburantL) / 100;
  }

  // Assurance
  const assuranceAnnuelle = estimateInsurance(segment, puissanceCv);
  const coutAssurance = assuranceAnnuelle * annees;

  // Entretien
  const entretienAnnuel = estimateMaintenanceCost(typeCarburant, kmAnnuels);
  const coutEntretien = entretienAnnuel * annees;

  // Malus (one-shot)
  const malus = calculateMalus2025(emissionsCO2);

  // Carte grise (one-shot)
  const carteGrise = estimateCarteGrise(puissanceCv);

  const total = depreciationTotale + coutCarburant + coutAssurance + coutEntretien + malus + carteGrise;
  const mensuel = total / dureeDetentionMois;

  return {
    mensuel: Math.round(mensuel),
    total: Math.round(total),
    details: {
      depreciation: Math.round(depreciationTotale),
      carburant: Math.round(coutCarburant),
      assurance: Math.round(coutAssurance),
      entretien: Math.round(coutEntretien),
      malus,
      carteGrise,
    },
    detailsMensuels: {
      depreciation: Math.round(depreciationTotale / dureeDetentionMois),
      carburant: Math.round(coutCarburant / dureeDetentionMois),
      assurance: Math.round(coutAssurance / dureeDetentionMois),
      entretien: Math.round(coutEntretien / dureeDetentionMois),
      malus: Math.round(malus / dureeDetentionMois),
      carteGrise: Math.round(carteGrise / dureeDetentionMois),
    },
  };
}
