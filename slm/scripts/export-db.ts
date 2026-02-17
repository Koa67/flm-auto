// slm/scripts/export-db.ts
//
// Exporte les données FLM AUTO en format d'entraînement JSONL (ChatML)
// Compatible Qwen2.5 fine-tuning via MLX
//
// Usage : npx ts-node --compiler-options '{"module":"CommonJS"}' slm/scripts/export-db.ts

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatMLExample {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

interface ToolCallExample {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    tool_calls?: Array<{
      type: "function";
      function: { name: string; arguments: string };
    }>;
  }>;
}

const SYSTEM_PROMPT = `Tu es ALAIN, assistant automobile expert de FLM AUTO. Tu réponds en français, de manière concise et technique. Tu as accès à une base de données de véhicules via des outils. Utilise-les pour donner des réponses précises.`;

// Paginate helper — Supabase default limit is 1000
async function paginateAll<T>(
  table: string,
  select: string,
  filter?: { column: string; op: string; value: any }
): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (filter) {
      q = q.eq(filter.column, filter.value);
    }
    const { data, error } = await q;
    if (error) {
      console.error(`  Error paginating ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function exportSpecs(): Promise<ChatMLExample[]> {
  const examples: ChatMLExample[] = [];

  console.log("  Loading generations...");
  const gens = await paginateAll<any>(
    "generations",
    "id, name, slug, internal_code, body_style, production_start, production_end, models!inner(name, slug, segment, brands!inner(name, slug, country_origin))"
  );
  console.log(`  ${gens.length} generations loaded`);

  // Batch load engine variants, safety, dimensions
  const genIds = gens.map((g) => g.id);

  console.log("  Loading engine variants...");
  const allVariants = await paginateAll<any>(
    "engine_variants",
    "id, generation_id, name, badge, fuel_type, engine_code, powertrain_specs(*), performance_specs(*)"
  );
  console.log(`  ${allVariants.length} variants loaded`);

  console.log("  Loading safety ratings...");
  const allSafety = await paginateAll<any>(
    "safety_ratings",
    "generation_id, stars, test_year, adult_occupant_pct, child_occupant_pct, safety_assist_pct, confidence"
  );
  console.log(`  ${allSafety.length} safety ratings loaded`);

  console.log("  Loading interior dimensions...");
  const allDims = await paginateAll<any>(
    "interior_dimensions",
    "generation_id, trunk_volume_liters, trunk_volume_max_liters, seating_capacity"
  );
  console.log(`  ${allDims.length} interior dimensions loaded`);

  // Index by generation_id
  const variantsByGen = new Map<string, any[]>();
  for (const v of allVariants) {
    if (!variantsByGen.has(v.generation_id)) variantsByGen.set(v.generation_id, []);
    variantsByGen.get(v.generation_id)!.push(v);
  }

  const safetyByGen = new Map<string, any>();
  for (const s of allSafety) {
    if (!safetyByGen.has(s.generation_id)) safetyByGen.set(s.generation_id, s);
  }

  const dimsByGen = new Map<string, any>();
  for (const d of allDims) {
    if (!dimsByGen.has(d.generation_id)) dimsByGen.set(d.generation_id, d);
  }

  console.log("  Generating Q&A pairs...");

  for (const gen of gens) {
    const model = gen.models as any;
    const brand = model?.brands;
    if (!brand || !model) continue;

    const fullName = `${brand.name} ${model.name} ${gen.internal_code || gen.name}`;
    const yearStart = gen.production_start ? new Date(gen.production_start).getFullYear() : null;
    const yearEnd = gen.production_end ? new Date(gen.production_end).getFullYear() : null;
    const years = yearStart ? `${yearStart}-${yearEnd || "..."}` : "";

    const variants = variantsByGen.get(gen.id) || [];
    const safety = safetyByGen.get(gen.id);
    const dims = dimsByGen.get(gen.id);

    // --- Q1: Puissance ---
    const topVariant = variants
      .map((v: any) => {
        const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs;
        const perf = Array.isArray(v.performance_specs) ? v.performance_specs[0] : v.performance_specs;
        return { ...v, pt, perf };
      })
      .filter((v: any) => v.pt?.power_hp)
      .sort((a: any, b: any) => (b.pt?.power_hp || 0) - (a.pt?.power_hp || 0))[0];

    if (topVariant) {
      examples.push({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Quelle est la puissance de la ${fullName} ?` },
          {
            role: "assistant",
            content: `La ${fullName} ${years} développe **${topVariant.pt.power_hp} ch** et **${topVariant.pt.torque_nm || "?"} Nm** de couple.${topVariant.perf?.acceleration_0_100_kmh ? ` Le 0-100 km/h est abattu en **${topVariant.perf.acceleration_0_100_kmh}s**.` : ""}${topVariant.pt?.transmission_type ? ` Transmission : ${topVariant.pt.transmission_type}.` : ""}`,
          },
        ],
      });

      // 0-100 variant
      if (topVariant.perf?.acceleration_0_100_kmh) {
        examples.push({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Combien de temps met la ${fullName} pour faire le 0-100 ?` },
            {
              role: "assistant",
              content: `La ${fullName} fait le 0-100 km/h en **${topVariant.perf.acceleration_0_100_kmh} secondes** avec ses **${topVariant.pt.power_hp} ch**.${topVariant.perf?.top_speed_kmh ? ` Vitesse max : **${topVariant.perf.top_speed_kmh} km/h**.` : ""}`,
            },
          ],
        });
      }

      // Motorisations list
      if (variants.length > 1) {
        const motorList = variants
          .map((v: any) => {
            const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs;
            return pt?.power_hp ? `${v.name || v.badge || "?"} (${pt.power_hp} ch, ${v.fuel_type || "?"})` : null;
          })
          .filter(Boolean)
          .slice(0, 6);

        if (motorList.length > 1) {
          examples.push({
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Quelles motorisations sont disponibles pour la ${fullName} ?` },
              {
                role: "assistant",
                content: `La ${fullName} est disponible en ${variants.length} motorisations :\n${motorList.map((m) => `- ${m}`).join("\n")}`,
              },
            ],
          });
        }
      }
    }

    // --- Q2: Sécurité ---
    if (safety && safety.stars != null) {
      examples.push({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `La ${fullName} est-elle sûre ? Combien d'étoiles Euro NCAP ?` },
          {
            role: "assistant",
            content: `La ${fullName} a obtenu **${safety.stars} étoiles Euro NCAP**${safety.test_year ? ` (test ${safety.test_year})` : ""}.${safety.adult_occupant_pct ? ` Protection adultes : **${safety.adult_occupant_pct}%**.` : ""}${safety.child_occupant_pct ? ` Protection enfants : **${safety.child_occupant_pct}%**.` : ""}${safety.safety_assist_pct ? ` Aide à la conduite : **${safety.safety_assist_pct}%**.` : ""}`,
          },
        ],
      });
    }

    // --- Q3: Coffre ---
    if (dims?.trunk_volume_liters) {
      examples.push({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Quel est le volume du coffre de la ${fullName} ?` },
          {
            role: "assistant",
            content: `La ${fullName} offre un coffre de **${dims.trunk_volume_liters} litres**${dims.trunk_volume_max_liters ? ` (${dims.trunk_volume_max_liters} L sièges rabattus)` : ""}.${dims.seating_capacity ? ` ${dims.seating_capacity} places.` : ""}`,
          },
        ],
      });
    }

    // --- Q4: Fiche résumé ---
    const summary: string[] = [];
    if (years) summary.push(`produite de ${years}`);
    if (gen.body_style) summary.push(`carrosserie ${gen.body_style}`);
    if (variants.length > 0) summary.push(`${variants.length} motorisation(s)`);
    if (safety?.stars != null) summary.push(`${safety.stars}★ Euro NCAP`);
    if (dims?.trunk_volume_liters) summary.push(`coffre ${dims.trunk_volume_liters}L`);

    if (summary.length >= 2) {
      const questionVariants = [
        `Parle-moi de la ${fullName}`,
        `C'est quoi la ${fullName} ?`,
        `Fiche technique ${fullName}`,
      ];
      const q = questionVariants[Math.floor(Math.random() * questionVariants.length)];
      examples.push({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: q },
          {
            role: "assistant",
            content: `La **${fullName}** : ${summary.join(", ")}. Voir la fiche complète sur /marques/${brand.slug}/${model.slug}/${gen.slug}.`,
          },
        ],
      });
    }
  }

  return examples;
}

function exportToolCallExamples(): ToolCallExample[] {
  const examples: ToolCallExample[] = [];

  // Pattern 1: Search
  const searchQueries = [
    "BMW Série 3", "Peugeot 308", "Tesla Model 3", "Porsche 911",
    "SUV familial", "voiture électrique", "break 7 places", "berline sportive",
    "Renault Clio", "Audi A4", "Mercedes Classe C", "Volkswagen Golf",
    "Hyundai Tucson", "Toyota Yaris", "Volvo XC60", "Skoda Octavia",
    "G20", "W206", "992", "E46", "F30", "FK8",
  ];

  for (const q of searchQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Montre-moi la ${q}` },
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            type: "function",
            function: {
              name: "search_vehicles",
              arguments: JSON.stringify({ query: q, limit: 5 }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 2: Fiche technique
  const ficheQueries = [
    { q: "Fiche technique de la BMW M3 G80", search: "BMW M3 G80" },
    { q: "Specs de la Porsche 911 992", search: "Porsche 911 992" },
    { q: "Détails de la Mercedes Classe C W206", search: "Mercedes Classe C W206" },
    { q: "Motorisations de l'Audi A4 B9", search: "Audi A4 B9" },
  ];

  for (const fq of ficheQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fq.q },
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            type: "function",
            function: {
              name: "search_vehicles",
              arguments: JSON.stringify({ query: fq.search, limit: 3 }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 3: Comparaison
  const comparisons = [
    { q: "Compare la BMW M3 et la Mercedes C63", a: "BMW M3", b: "Mercedes C63" },
    { q: "BMW Série 3 vs Audi A4", a: "BMW Série 3", b: "Audi A4" },
    { q: "Tesla Model 3 ou Polestar 2 ?", a: "Tesla Model 3", b: "Polestar 2" },
    { q: "Peugeot 308 contre Renault Mégane", a: "Peugeot 308", b: "Renault Mégane" },
    { q: "Golf GTI vs 308 GT", a: "Golf GTI", b: "308 GT" },
  ];

  for (const cq of comparisons) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: cq.q },
        {
          role: "assistant",
          content: `Je vais d'abord chercher les deux véhicules pour les comparer.`,
          tool_calls: [{
            type: "function",
            function: {
              name: "search_vehicles",
              arguments: JSON.stringify({ query: cq.a, limit: 1 }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 4: Fiabilité moteur
  const engineQueries = [
    { q: "Le PureTech est fiable ?", code: "EB2" },
    { q: "Problèmes connus sur le moteur N47 ?", code: "N47" },
    { q: "Le 1.0 TSI Volkswagen a des soucis ?", code: "EA211" },
    { q: "Fiabilité du moteur diesel BMW", code: "N47D20" },
    { q: "Le 1.2 PureTech Peugeot est-il un bon moteur ?", code: "EB2" },
    { q: "Problèmes chaîne de distribution BMW", code: "N47" },
    { q: "Le 2.0 TDI est fiable ?", code: "EA288" },
    { q: "Problèmes connus du 1.5 BlueHDi", code: "DV5" },
  ];

  for (const eq of engineQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: eq.q },
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            type: "function",
            function: {
              name: "check_engine_warnings",
              arguments: JSON.stringify({ engine_code: eq.code }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 5: Family Fit
  const familyQueries = [
    "Est-ce qu'on peut mettre 3 sièges auto dans la BMW X3 ?",
    "La Skoda Superb est-elle familiale ?",
    "ISOFIX dans le Volkswagen Tiguan ?",
    "Meilleure voiture pour 3 enfants ?",
    "La banquette arrière est assez large pour 3 sièges ?",
  ];

  for (const fq of familyQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fq },
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            type: "function",
            function: {
              name: "search_vehicles",
              arguments: JSON.stringify({
                query: fq.replace(/est-ce qu'on peut|la |le |dans |meilleure |pour /gi, "").trim(),
                limit: 3,
              }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 6: Coffre
  const cargoQueries = [
    "Volume coffre Skoda Superb Combi ?",
    "Quel est le coffre de la Tesla Model Y ?",
    "Combien de litres dans le coffre du Tiguan ?",
  ];

  for (const cq of cargoQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: cq },
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            type: "function",
            function: {
              name: "search_vehicles",
              arguments: JSON.stringify({
                query: cq.replace(/volume coffre|quel est le coffre|combien de litres/gi, "").trim(),
                limit: 3,
              }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 7: Rappels
  const recallQueries = [
    "Y a-t-il des rappels sur la Peugeot 3008 ?",
    "Rappels de sécurité BMW X3 ?",
    "La Tesla Model 3 a eu des rappels ?",
  ];

  for (const rq of recallQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rq },
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            type: "function",
            function: {
              name: "search_vehicles",
              arguments: JSON.stringify({
                query: rq.replace(/y a-t-il des rappels|rappels de sécurité|a eu des rappels/gi, "").trim(),
                limit: 1,
              }),
            },
          }],
        },
      ],
    });
  }

  // Pattern 8: Hors-sujet → refus poli
  const offTopicQueries = [
    "Quelle est la météo demain ?",
    "Écris-moi un poème",
    "Comment faire un gâteau au chocolat ?",
    "Quel est le sens de la vie ?",
    "Traduis ça en anglais",
    "Raconte-moi une blague",
    "Aide-moi avec mes devoirs de maths",
    "Quel est le meilleur restaurant à Paris ?",
  ];

  for (const oq of offTopicQueries) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: oq },
        {
          role: "assistant",
          content: `Je suis ALAIN, spécialisé dans l'automobile. Je ne peux pas t'aider sur ce sujet, mais pose-moi une question sur un véhicule, une comparaison ou une fiche technique !`,
        },
      ],
    });
  }

  return examples;
}

function exportAutoKnowledge(): ChatMLExample[] {
  const examples: ChatMLExample[] = [];

  const knowledge = [
    {
      q: "C'est quoi un turbo ?",
      a: "Un **turbocompresseur** utilise les gaz d'échappement pour entraîner une turbine qui compresse l'air admis dans le moteur. Résultat : plus d'air = plus de carburant brûlé = plus de puissance, sans augmenter la cylindrée. Un moteur 2.0L turbo peut produire autant qu'un 3.0L atmosphérique. Inconvénient : le **turbo lag** (temps de réponse) et la chaleur générée.",
    },
    {
      q: "Différence entre essence et diesel ?",
      a: "**Essence** : allumage par bougie, régime élevé, plus de puissance spécifique (ch/L). **Diesel** : allumage par compression, plus de couple à bas régime, consommation inférieure (~15-20%). Le diesel est plus efficace sur autoroute, l'essence en ville. Depuis Euro 6d, les deux sont proches en émissions.",
    },
    {
      q: "C'est quoi ISOFIX ?",
      a: "**ISOFIX** est un système standardisé (ISO 13216) de fixation des sièges enfants. Deux crochets métalliques entre l'assise et le dossier, plus un **Top Tether** ou **pied de support**. Installation simple et sûre. Obligatoire sur tous les véhicules EU depuis 2014. FLM AUTO référence le nombre de points ISOFIX par véhicule.",
    },
    {
      q: "Qu'est-ce que le malus écologique ?",
      a: "Le **malus écologique** est une taxe française à l'immatriculation basée sur les émissions de CO2. En 2025, il démarre à **118 g/km** et peut atteindre **60 000€** pour les véhicules les plus polluants (>193 g/km). Les véhicules électriques en sont exemptés. C'est un coût d'acquisition unique.",
    },
    {
      q: "Différence entre propulsion et traction ?",
      a: "**Traction** (FWD) : roues avant motrices. Majoritaire en Europe. Meilleure motricité neige, sous-virage. **Propulsion** (RWD) : roues arrière. BMW, Mercedes, Porsche. Meilleur équilibre, survirage contrôlable. **4 roues motrices** (AWD) : toutes les roues, meilleure motricité mais plus lourd.",
    },
    {
      q: "C'est quoi le couple moteur ?",
      a: "Le **couple** (en Nm) mesure la force de rotation du moteur. La **puissance** (en ch) = couple × régime. Un diesel a souvent plus de couple qu'un essence de même puissance, disponible plus bas dans les tours. Pour la conduite quotidienne, le couple compte plus que la puissance pure.",
    },
    {
      q: "DSG, PDK, DCT — c'est quoi ?",
      a: "Des **boîtes à double embrayage** (DCT). **DSG** = Volkswagen, **PDK** = Porsche, **DCT** = terme générique. Deux embrayages gèrent les rapports pairs et impairs. Passage en ~200ms. Plus rapide qu'un humain, efficace en consommation. Inconvénient : coût d'entretien élevé.",
    },
    {
      q: "Euro NCAP comment ça marche ?",
      a: "**Euro NCAP** teste sur 4 critères : protection adultes, enfants, piétons/cyclistes, aide à la conduite. Chaque critère donne un pourcentage, converti en **1 à 5 étoiles**. Tests : choc frontal, latéral, poteau, freinage automatique. Attention : les protocoles changent — 5★ en 2015 ≠ 5★ en 2024.",
    },
    {
      q: "C'est quoi un hybride rechargeable (PHEV) ?",
      a: "Un **PHEV** combine thermique + électrique avec batterie rechargeable (~10-20 kWh). Autonomie électrique : 40-80 km. Avantage : 0 émission en ville, thermique pour longs trajets. Inconvénient : poids élevé (~200-300 kg de plus), consommation réelle souvent supérieure au WLTP si on ne recharge pas.",
    },
    {
      q: "La courroie de distribution, c'est grave ?",
      a: "**Oui, potentiellement catastrophique.** Elle synchronise vilebrequin et arbre à cames. Si elle casse : pistons percutent soupapes = **moteur HS** (2000-5000€+). Remplacement préventif : 100-160 000 km ou 5-8 ans. Certains moteurs ont une **chaîne** (théoriquement sans remplacement, mais peut s'allonger — cf. BMW N47, PSA Prince).",
    },
    {
      q: "Qu'est-ce que le Nürburgring Nordschleife ?",
      a: "Le **Nürburgring Nordschleife** (\"Boucle Nord\") est un circuit de 20.8 km en Allemagne, surnommé \"l'Enfer Vert\". Référence pour les chronos voitures de série. Record : **Porsche 911 GT2 RS MR** en 6:43. Bon temps : <8 min (rapide), <7:30 (exceptionnel), <7:00 (hypercar).",
    },
    {
      q: "C'est quoi le rapport poids/puissance ?",
      a: "Le **rapport poids/puissance** (kg/ch) est le meilleur indicateur de performance brute. Formule : poids ÷ puissance. Exemples : Clio RS = 6.0 kg/ch, M3 G80 = 3.4 kg/ch, 911 GT3 RS = 2.8 kg/ch. En dessous de 3 kg/ch, c'est une arme. Au-dessus de 8, c'est une voiture normale.",
    },
    {
      q: "C'est quoi la norme WLTP ?",
      a: "**WLTP** (Worldwide Harmonised Light Vehicle Test Procedure) est le protocole de mesure des émissions et consommations depuis 2018 (remplace NEDC). Plus réaliste que NEDC : vitesses plus élevées, accélérations plus franches, climatisation parfois incluse. La consommation réelle reste souvent 10-20% au-dessus du WLTP.",
    },
    {
      q: "Quelle différence entre EPA et WLTP pour les autonomies EV ?",
      a: "**WLTP** (Europe) et **EPA** (USA) mesurent l'autonomie différemment. L'EPA est ~15-20% plus conservateur que le WLTP. Un EV annoncé à 500 km WLTP fera ~400-425 km EPA. En pratique, l'EPA est plus proche de la réalité. Tesla affiche souvent en EPA, les constructeurs européens en WLTP.",
    },
    {
      q: "C'est quoi le TCO d'une voiture ?",
      a: "Le **TCO** (Total Cost of Ownership) = coût total de possession. Il inclut : prix d'achat, assurance, entretien, carburant/électricité, décote, malus, contrôle technique. Sur 5 ans, un EV peut coûter moins qu'un thermique malgré un prix d'achat supérieur, grâce à l'entretien et l'énergie moins chers.",
    },
    {
      q: "C'est quoi un moteur atmosphérique ?",
      a: "Un moteur **atmosphérique** (ou \"atmo\") aspire l'air à la pression ambiante, sans turbo ni compresseur. Avantages : réponse linéaire, son pur, fiabilité. Inconvénients : moins de couple à bas régime, consommation plus élevée à puissance égale. En voie de disparition (normes anti-pollution) mais adoré des puristes. Exemples : Porsche 911 GT3 (4.0L flat-6), Honda Civic Type R FK8 (2.0L).",
    },
  ];

  for (const k of knowledge) {
    examples.push({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: k.q },
        { role: "assistant", content: k.a },
      ],
    });
  }

  return examples;
}

async function main() {
  console.log("🔄 Export des données FLM AUTO pour fine-tuning SLM...\n");

  const outDir = path.join(__dirname, "..", "data", "processed");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Specs Q&A
  console.log("📊 Export specs Q&A...");
  const specsQA = await exportSpecs();
  console.log(`   → ${specsQA.length} exemples`);

  // 2. Tool calling
  console.log("🔧 Export tool calling examples...");
  const toolQA = exportToolCallExamples();
  console.log(`   → ${toolQA.length} exemples`);

  // 3. Knowledge
  console.log("🧠 Export connaissances mécaniques...");
  const knowledgeQA = exportAutoKnowledge();
  console.log(`   → ${knowledgeQA.length} exemples`);

  // Merge all
  const allExamples = [...specsQA, ...toolQA, ...knowledgeQA];
  console.log(`\n📝 Total : ${allExamples.length} exemples`);

  // Shuffle
  for (let i = allExamples.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allExamples[i], allExamples[j]] = [allExamples[j], allExamples[i]];
  }

  // Write full JSONL
  const allPath = path.join(outDir, "all-qa.jsonl");
  fs.writeFileSync(allPath, allExamples.map((e) => JSON.stringify(e)).join("\n"));
  console.log(`\n✅ Écrit: ${allPath}`);

  // Split 90/5/5
  const trainEnd = Math.floor(allExamples.length * 0.9);
  const valEnd = Math.floor(allExamples.length * 0.95);

  const splitsDir = path.join(__dirname, "..", "data", "splits");
  if (!fs.existsSync(splitsDir)) fs.mkdirSync(splitsDir, { recursive: true });

  fs.writeFileSync(
    path.join(splitsDir, "train.jsonl"),
    allExamples.slice(0, trainEnd).map((e) => JSON.stringify(e)).join("\n")
  );
  fs.writeFileSync(
    path.join(splitsDir, "val.jsonl"),
    allExamples.slice(trainEnd, valEnd).map((e) => JSON.stringify(e)).join("\n")
  );
  fs.writeFileSync(
    path.join(splitsDir, "test.jsonl"),
    allExamples.slice(valEnd).map((e) => JSON.stringify(e)).join("\n")
  );

  console.log(`\n📂 Splits:`);
  console.log(`   Train: ${trainEnd} exemples`);
  console.log(`   Val:   ${valEnd - trainEnd} exemples`);
  console.log(`   Test:  ${allExamples.length - valEnd} exemples`);
  console.log("\n✅ Done!");
}

main().catch(console.error);
