// Types for trims, equipment, and reliability

export interface Trim {
  id: string;
  generation_id: string;
  name: string;
  marketing_name?: string;
  base_price: number;
  is_base_trim: boolean;
  sort_order: number;
  summary_fr?: string;
}

export type EquipmentCategory =
  | "safety"
  | "comfort"
  | "tech"
  | "exterior"
  | "interior"
  | "performance"
  | "practical";

export interface Equipment {
  id: string;
  name: string;
  name_fr: string;
  category: EquipmentCategory;
  description_fr?: string;
  is_essential: boolean;
}

export type EquipmentStatus = "standard" | "option" | "pack" | "unavailable";

export interface TrimEquipment {
  trim_id: string;
  equipment_id: string;
  status: EquipmentStatus;
  option_price?: number;
  pack_name?: string;
}

export const EQUIPMENT_CATEGORIES: Record<
  EquipmentCategory,
  { label: string; icon: string }
> = {
  safety: { label: "Sécurité", icon: "🛡️" },
  comfort: { label: "Confort", icon: "🛋️" },
  tech: { label: "Technologie", icon: "📱" },
  exterior: { label: "Extérieur", icon: "🚗" },
  interior: { label: "Intérieur", icon: "🪑" },
  performance: { label: "Performance", icon: "⚡" },
  practical: { label: "Pratique", icon: "📦" },
};

// Reliability

export type IssueSeverity = "critical" | "major" | "moderate" | "minor";
export type IssueType = "recall" | "tsb" | "common_failure" | "wear_item";

export interface ReliabilityIssue {
  id: string;
  generation_id: string;
  engine_code?: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  title: string;
  title_fr: string;
  description?: string;
  description_fr?: string;
  symptoms_fr?: string[];
  affected_years?: number[];
  repair_cost_eur_min?: number;
  repair_cost_eur_max?: number;
  source?: string;
}

export interface EngineRedFlag {
  engine_code: string;
  patterns: string[];
  brand: string;
  engine_family: string;
  title_fr: string;
  description_fr: string;
  severity: IssueSeverity;
  symptoms_fr: string[];
  affected_years?: string;
  repair_cost_range?: string;
  source?: string;
}

export const ENGINE_RED_FLAGS: Record<string, EngineRedFlag> = {
  psa_puretech: {
    engine_code: "EB2",
    patterns: ["EB2", "EB2DT", "EB2ADTS", "EB2ADT", "PureTech"],
    brand: "PSA (Peugeot/Citroën/DS/Opel)",
    engine_family: "PureTech 1.2 turbo",
    title_fr: "Courroie humide (wet belt) — Désagrégation",
    description_fr:
      "La courroie de distribution baignée dans l'huile se dégrade prématurément, pouvant causer la casse moteur. Concerne les PureTech 1.2 (110/130 ch) produits avant mi-2020.",
    severity: "critical",
    symptoms_fr: [
      "Voyant pression huile",
      "Résidus noirs dans l'huile",
      "Bruit de claquement au démarrage",
      "Perte de puissance soudaine",
    ],
    affected_years: "2014–2020",
    repair_cost_range: "800 – 5 000 €",
    source: "Rappel PSA + class action",
  },
  psa_bluehdi_adblue: {
    engine_code: "DV5/DW10",
    patterns: ["DV5", "DW10", "DV6", "BlueHDi"],
    brand: "PSA (Peugeot/Citroën/DS/Opel)",
    engine_family: "BlueHDi 1.5/2.0 diesel",
    title_fr: "Cristallisation AdBlue — Panne pompe SCR",
    description_fr:
      "Le système de dépollution AdBlue (SCR) cristallise et bloque la pompe. Le véhicule refuse de démarrer après le compte à rebours. Fréquent sur les 1.5 et 2.0 BlueHDi.",
    severity: "major",
    symptoms_fr: [
      'Message "Démarrage impossible dans X km"',
      "Voyant AdBlue permanent",
      "Limitation de puissance",
    ],
    affected_years: "2017–2023",
    repair_cost_range: "500 – 2 500 €",
    source: "Forums + rapports DGCCRF",
  },
  renault_tce_oil: {
    engine_code: "H5Ft",
    patterns: ["H5Ft", "H5F", "TCe 130", "TCe 150", "M5M"],
    brand: "Renault/Nissan/Dacia",
    engine_family: "TCe 1.2/1.3 turbo",
    title_fr: "Surconsommation d'huile excessive",
    description_fr:
      "Le moteur 1.2 TCe (puis 1.3 TCe) consomme anormalement de l'huile à cause de segments de piston défaillants. Peut mener à la casse moteur si le niveau n'est pas surveillé.",
    severity: "major",
    symptoms_fr: [
      "Consommation huile > 0.5L/1000km",
      "Fumée bleue/noire au démarrage",
      "Claquement chaîne de distribution à froid",
    ],
    affected_years: "2012–2019",
    repair_cost_range: "1 500 – 4 000 €",
    source: "Rappel Renault + class action Pays-Bas",
  },
  bmw_n47_chain: {
    engine_code: "N47D20",
    patterns: ["N47", "N47D20", "N47D16"],
    brand: "BMW",
    engine_family: "N47 2.0 diesel",
    title_fr: "Chaîne de distribution arrière — Casse prématurée",
    description_fr:
      "La chaîne de distribution, montée côté boîte de vitesses (accès très difficile), s'allonge et peut casser, détruisant le moteur. Coût de remplacement préventif élevé car il faut séparer moteur et boîte.",
    severity: "critical",
    symptoms_fr: [
      "Bruit de cliquetis/ferraille au ralenti",
      "Voyant moteur allumé",
      "Bruit métallique au démarrage à froid",
      "Codes défaut chaîne de distribution",
    ],
    affected_years: "2007–2014",
    repair_cost_range: "2 000 – 5 000 €",
    source: "TSB BMW + forums spécialisés",
  },
  vag_ea211_chain: {
    engine_code: "EA211",
    patterns: ["EA211", "CZCA", "CZDA", "CZEA", "DKLA", "DKRF", "TSI 1.4", "TSI 1.0"],
    brand: "VAG (VW/Audi/Seat/Skoda)",
    engine_family: "EA211 TSI 1.0/1.4/1.5",
    title_fr: "Tendeur de chaîne — Usure prématurée",
    description_fr:
      "Le tendeur de chaîne de distribution des moteurs EA211 s'use prématurément, provoquant un jeu excessif dans la chaîne. Peut sauter un cran et causer des dommages moteur importants.",
    severity: "major",
    symptoms_fr: [
      "Bruit de claquement au démarrage à froid",
      "Voyant moteur intermittent",
      "Légère perte de puissance",
      "Bruit de chaîne en décélération",
    ],
    affected_years: "2012–2019",
    repair_cost_range: "800 – 2 500 €",
    source: "TSB VAG + forums spécialisés",
  },
  ford_ecoboost_10: {
    engine_code: "M1DA",
    patterns: ["M1DA", "M2DA", "SFJA", "SFJB", "SFJC", "SFJD", "EcoBoost 1.0"],
    brand: "Ford",
    engine_family: "EcoBoost 1.0 3-cylindres",
    title_fr: "Intrusion liquide de refroidissement — Culasse fissurée",
    description_fr:
      "Le 3-cylindres 1.0 EcoBoost peut développer des fuites de liquide de refroidissement dans la chambre de combustion à cause d'une culasse fissurée. Ford a étendu la garantie sur certains modèles.",
    severity: "critical",
    symptoms_fr: [
      "Niveau LR qui baisse sans fuite visible",
      "Fumée blanche à l'échappement",
      "Surchauffe moteur",
      "Ratés d'allumage",
    ],
    affected_years: "2012–2018",
    repair_cost_range: "2 000 – 6 000 €",
    source: "Ford TSB + programme garantie étendue",
  },
  renault_k9k_dpf: {
    engine_code: "K9K",
    patterns: ["K9K", "dCi 75", "dCi 85", "dCi 90", "dCi 110"],
    brand: "Renault/Dacia/Nissan",
    engine_family: "1.5 dCi K9K",
    title_fr: "Colmatage FAP et casse turbo en trajets courts",
    description_fr:
      "Le K9K 1.5 dCi, très répandu, souffre de colmatage prématuré du FAP en usage urbain. Les régénérations forcées peuvent endommager le turbo.",
    severity: "major",
    symptoms_fr: [
      "Voyant FAP allumé",
      "Perte de puissance",
      "Sifflement turbo anormal",
      "Fumée noire excessive",
      "Mode dégradé",
    ],
    affected_years: "2010–2019",
    repair_cost_range: "1 000 – 3 000 €",
    source: "Renault TSB + forums spécialisés",
  },
  bmw_n63_hotv: {
    engine_code: "N63",
    patterns: ["N63", "N63B44", "S63"],
    brand: "BMW",
    engine_family: "N63 4.4 V8 twin-turbo",
    title_fr: "Fuites d'huile Hot-V et joints de queues de soupapes",
    description_fr:
      "Le V8 N63 a les turbos montés dans le V (Hot-V). La chaleur extrême dégrade les joints de soupapes, les joints d'injecteurs et les conduites d'huile turbo.",
    severity: "major",
    symptoms_fr: [
      "Consommation huile >1L/1000km",
      "Fumée bleue au démarrage",
      "Odeur d'huile dans l'habitacle",
      "Fuite joint de couvre-culasse",
    ],
    affected_years: "2008–2013",
    repair_cost_range: "3 000 – 8 000 €",
    source: "BMW TSB (N63 Customer Care Package)",
  },
  mercedes_m271_chain: {
    engine_code: "M271",
    patterns: ["M271", "271.820", "271.860", "271.940", "271.950"],
    brand: "Mercedes-Benz",
    engine_family: "M271 1.8 compresseur",
    title_fr: "Allongement chaîne de distribution et défaillance arbre d'équilibrage",
    description_fr:
      "Le moteur M271 1.8L compresseur souffre d'allongement de chaîne et de rupture du pignon d'arbre d'équilibrage, causant potentiellement la destruction du moteur. Fréquent sur Classe C W203/W204, Classe E W211.",
    severity: "critical",
    symptoms_fr: [
      "Cliquetis au démarrage à froid",
      "Voyant moteur allumé",
      "Ralenti instable",
      "Perte de puissance",
      "Particules métalliques dans l'huile",
    ],
    affected_years: "2002–2012",
    repair_cost_range: "2 000 – 5 000 €",
    source: "Mercedes TSB + spécialistes indépendants",
  },
  fiat_multijet_13: {
    engine_code: "169A1",
    patterns: ["169A1", "199A3", "199B1", "MultiJet 1.3", "1.3 JTDM", "1.3 CDTi"],
    brand: "Fiat/Opel/Alfa Romeo/Suzuki",
    engine_family: "1.3 MultiJet/JTDM/CDTi",
    title_fr: "Encrassement vanne EGR et volets de tubulure",
    description_fr:
      "Le très répandu 1.3 MultiJet souffre d'encrassement de la vanne EGR en ville et de casse des volets de tubulure d'admission. Les volets peuvent se détacher et entrer dans le moteur.",
    severity: "moderate",
    symptoms_fr: [
      "Ralenti instable",
      "Perte de puissance à bas régime",
      "Voyant moteur",
      "Fumée noire",
    ],
    affected_years: "2005–2018",
    repair_cost_range: "500 – 1 500 €",
    source: "Fiat TSB + forums spécialisés",
  },
  vag_ea888_gen12: {
    engine_code: "EA888",
    patterns: ["EA888", "CCZA", "CCZB", "CDNC", "CPMA", "CPMB", "CNCD", "TSI 2.0"],
    brand: "VAG (VW/Audi/Seat/Skoda)",
    engine_family: "EA888 2.0 TSI/TFSI Gen 1-2",
    title_fr: "Casse tendeur de chaîne et surconsommation d'huile",
    description_fr:
      "Les premiers EA888 2.0 TSI/TFSI (Gen 1 et 2) souffrent de casse du tendeur de chaîne et de surconsommation d'huile due aux segments de pistons. Révisé en Gen 3.",
    severity: "major",
    symptoms_fr: [
      "Cliquetis au démarrage à froid",
      "Consommation huile >0.5L/1000km",
      "Fumée bleue",
      "Voyant moteur",
      "Voyant pression d'huile",
    ],
    affected_years: "2008–2013",
    repair_cost_range: "1 200 – 3 500 €",
    source: "TSB VAG + class actions",
  },
  renault_m9r_injector: {
    engine_code: "M9R",
    patterns: ["M9R", "2.0 dCi 150", "2.0 dCi 175", "2.0 dCi 130"],
    brand: "Renault/Nissan",
    engine_family: "2.0 dCi M9R",
    title_fr: "Fuites joints cuivre injecteurs et joint de culasse",
    description_fr:
      "Le 2.0 dCi M9R développe des fuites aux joints cuivre d'injecteurs, causant une entrée de gaz d'échappement dans le circuit de refroidissement. Fréquent sur Laguna III, Koleos, Trafic.",
    severity: "moderate",
    symptoms_fr: [
      "Niveau LR qui baisse",
      "Bulles de gaz dans le vase d'expansion",
      "Mayonnaise sur le bouchon d'huile",
      "Tendance à la surchauffe",
    ],
    affected_years: "2006–2015",
    repair_cost_range: "800 – 2 500 €",
    source: "Forums Renault + spécialistes",
  },
  psa_prince_ep6: {
    engine_code: "EP6",
    patterns: ["EP6", "EP6DT", "EP6CDT", "EP6FDTM", "THP 150", "THP 175", "VTi 120", "N13", "N18"],
    brand: "PSA/BMW (Peugeot/Citroën/Mini)",
    engine_family: "Prince 1.6 THP/VTi (EP6)",
    title_fr: "Allongement chaîne de distribution et fuites couvre-culasse",
    description_fr:
      "Le moteur Prince (1.6 THP/VTi, aussi N13/N18 chez Mini/BMW) souffre d'allongement de chaîne, de défaillance du tendeur hydraulique et de fuites chroniques au couvre-culasse. Très fréquent sur 308 I, C4, Mini Cooper S.",
    severity: "major",
    symptoms_fr: [
      "Cliquetis au démarrage à froid",
      "Fuite d'huile au couvre-culasse",
      "Voyant moteur (distribution)",
      "Perte de puissance",
    ],
    affected_years: "2007–2014",
    repair_cost_range: "1 000 – 3 000 €",
    source: "PSA/BMW TSB + forums spécialisés",
  },
  toyota_2zr_oil: {
    engine_code: "2ZR-FAE",
    patterns: ["2ZR-FAE", "2ZR-FE", "2ZR-FXE", "Valvematic 1.8"],
    brand: "Toyota",
    engine_family: "2ZR-FAE 1.8 Valvematic",
    title_fr: "Surconsommation d'huile — Segments de pistons",
    description_fr:
      "Le Toyota 2ZR-FAE 1.8L peut consommer excessivement de l'huile à cause des segments de pistons. Toyota a émis un TSB et étendu la garantie. Fréquent sur Corolla, Auris, Avensis.",
    severity: "moderate",
    symptoms_fr: [
      "Consommation huile >0.5L/1000km",
      "Voyant niveau d'huile bas",
      "Pas de fuite externe visible",
      "Légère teinte bleue à l'échappement",
    ],
    affected_years: "2007–2015",
    repair_cost_range: "800 – 2 000 €",
    source: "Toyota TSB (EG-052)",
  },
  hyundai_kia_theta2: {
    engine_code: "G4KD",
    patterns: ["G4KD", "G4KE", "G4KF", "G4KJ", "G4KH", "Theta II", "Theta 2"],
    brand: "Hyundai/Kia",
    engine_family: "Theta II 2.0/2.4 GDI",
    title_fr: "Casse de bielle — Serrage moteur",
    description_fr:
      "Les moteurs Theta II 2.0/2.4 GDI souffrent de débris métalliques de fabrication contaminant les coussinets de vilebrequin, menant à la casse de bielle et au serrage complet. Rappel massif (>3 millions de véhicules).",
    severity: "critical",
    symptoms_fr: [
      "Bruit de cognement du moteur",
      "Perte de puissance soudaine",
      "Calage moteur en roulant",
      "Limaille de fer dans l'huile",
    ],
    affected_years: "2011–2019",
    repair_cost_range: "4 000 – 8 000 €",
    source: "NHTSA recall 17V-226 + Hyundai/Kia settlement",
  },
  mercedes_om651_chain: {
    engine_code: "OM651",
    patterns: ["OM651", "651.911", "651.912", "651.913", "651.916", "651.924", "651.930"],
    brand: "Mercedes-Benz",
    engine_family: "OM651 2.1 CDI",
    title_fr: "Chaîne de distribution — Allongement et guides usés",
    description_fr:
      "Le 4 cylindres diesel OM651 souffre d'allongement de chaîne et de casse des guides en plastique, surtout au-delà de 150 000 km. Peut sauter un cran et provoquer la collision piston-soupape.",
    severity: "critical",
    symptoms_fr: [
      "Bruit de cliquetis au démarrage à froid",
      "Codes défaut arbre à cames",
      "Ralenti instable",
      "Perte de puissance",
    ],
    affected_years: "2008–2018",
    repair_cost_range: "2 000 – 4 500 €",
    source: "Mercedes TSB + forums spécialisés",
  },
  bmw_n20_chain: {
    engine_code: "N20",
    patterns: ["N20", "N20B20", "N26", "N26B20"],
    brand: "BMW",
    engine_family: "N20/N26 2.0 turbo",
    title_fr: "Guide de chaîne de distribution — Casse prématurée",
    description_fr:
      "Le 4 cylindres turbo N20 (BMW 320i/328i/528i F30/F10) souffre de casse du guide supérieur de chaîne en plastique, qui peut se fragmenter et tomber dans le carter. Peut mener à la casse moteur.",
    severity: "critical",
    symptoms_fr: [
      "Bruit de ferraille côté distribution",
      "Voyant moteur allumé",
      "Codes défaut VANOS",
      "Débris dans l'huile moteur",
    ],
    affected_years: "2011–2015",
    repair_cost_range: "2 500 – 5 000 €",
    source: "BMW TSB + class action USA",
  },
  mercedes_m272_balance: {
    engine_code: "M272",
    patterns: ["M272", "M273", "M272.940", "M272.960", "M273.960"],
    brand: "Mercedes-Benz",
    engine_family: "M272/M273 V6/V8",
    title_fr: "Pignon d'arbre d'équilibrage — Usure prématurée",
    description_fr:
      "Les V6 M272 et V8 M273 souffrent d'un pignon d'arbre d'équilibrage qui s'use prématurément à cause d'un traitement de surface déficient. Provoque un bruit de cliquetis et peut endommager la chaîne de distribution.",
    severity: "major",
    symptoms_fr: [
      "Cliquetis au ralenti",
      "Voyant moteur (codes camshaft)",
      "Vibrations moteur",
      "Bruit métallique cyclique",
    ],
    affected_years: "2004–2011",
    repair_cost_range: "2 500 – 6 000 €",
    source: "Mercedes TSB + class action",
  },
  opel_a14net_turbo: {
    engine_code: "A14NET",
    patterns: ["A14NET", "A14NEL", "A16LET", "A16XER", "B14NET", "B14NEL"],
    brand: "Opel/Vauxhall/Chevrolet",
    engine_family: "1.4/1.6 Turbo (Ecotec)",
    title_fr: "Casse turbo et fuite collecteur d'échappement",
    description_fr:
      "Les 1.4 et 1.6 turbo Ecotec souffrent de casse turbo précoce et de fissures du collecteur d'échappement intégré. Le wastegate peut aussi se bloquer.",
    severity: "major",
    symptoms_fr: [
      "Sifflement turbo anormal",
      "Fumée bleue/blanche",
      "Perte de puissance en accélération",
      "Fuite d'huile côté turbo",
    ],
    affected_years: "2010–2018",
    repair_cost_range: "1 500 – 3 500 €",
    source: "GM TSB + forums spécialisés",
  },
  audi_30tdi_chain: {
    engine_code: "CAPA",
    patterns: ["CAPA", "CCWA", "CCWB", "CDUC", "CDUD", "CGKA", "CREC", "3.0 TDI"],
    brand: "Audi/VW",
    engine_family: "3.0 TDI V6 (EA897)",
    title_fr: "Allongement chaîne de distribution + colmatage DPF",
    description_fr:
      "Le V6 3.0 TDI souffre d'allongement de chaîne de distribution (côté boîte, accès difficile) et de colmatage prématuré du DPF. Le problème de chaîne concerne surtout les versions pré-2012.",
    severity: "major",
    symptoms_fr: [
      "Cliquetis au démarrage",
      "Voyant moteur (distribution)",
      "Voyant DPF fréquent",
      "Perte de puissance progressive",
    ],
    affected_years: "2004–2014",
    repair_cost_range: "2 000 – 5 500 €",
    source: "Audi TSB + forums spécialisés",
  },
  bmw_n55_wastegate: {
    engine_code: "N55",
    patterns: ["N55", "N55B30"],
    brand: "BMW",
    engine_family: "N55 3.0 turbo",
    title_fr: "Wastegate — Claquement et jeu excessif",
    description_fr:
      "Le 6 cylindres N55 souffre d'un claquement de wastegate à chaud. Le mécanisme de commande du wastegate développe un jeu excessif, causant un bruit de claquement au ralenti et en décélération.",
    severity: "moderate",
    symptoms_fr: [
      "Bruit de claquement au ralenti à chaud",
      "Bruit en décélération",
      "Voyant moteur (codes suralimentation)",
      "Baisse de pression de suralimentation intermittente",
    ],
    affected_years: "2009–2015",
    repair_cost_range: "1 000 – 3 000 €",
    source: "BMW TSB + forums spécialisés",
  },
  ford_duratorq_injector: {
    engine_code: "QXBA",
    patterns: ["QXBA", "QXBB", "TXBA", "UFBA", "UFMA", "DW10", "Duratorq 2.0"],
    brand: "Ford",
    engine_family: "Duratorq 2.0 TDCi (DW10)",
    title_fr: "Injecteurs défaillants et pompe HP",
    description_fr:
      "Le 2.0 TDCi (DW10 PSA) monté chez Ford souffre de défaillance d'injecteurs et de pompe haute pression. Les débris métalliques contaminent le circuit de carburant, nécessitant le remplacement complet du système.",
    severity: "major",
    symptoms_fr: [
      "Ratés d'allumage",
      "Fumée noire excessive",
      "Perte de puissance",
      "Bruit d'injecteur (claquement)",
    ],
    affected_years: "2007–2015",
    repair_cost_range: "1 500 – 4 000 €",
    source: "Ford TSB + forums spécialisés",
  },
  renault_r9m_adblue: {
    engine_code: "R9M",
    patterns: ["R9M", "1.6 dCi 130", "1.6 dCi 160", "R9M 402", "R9M 409"],
    brand: "Renault/Nissan/Mercedes",
    engine_family: "1.6 dCi R9M",
    title_fr: "Encrassement EGR + cristallisation AdBlue",
    description_fr:
      "Le 1.6 dCi R9M souffre d'encrassement sévère de la vanne EGR en usage urbain et de cristallisation du système AdBlue. Le moteur est aussi monté dans le Mercedes Classe A/B (OM607).",
    severity: "major",
    symptoms_fr: [
      "Voyant moteur EGR",
      "Perte de puissance",
      "Voyant AdBlue",
      "Mode dégradé en ville",
    ],
    affected_years: "2011–2019",
    repair_cost_range: "800 – 2 500 €",
    source: "Renault TSB + forums spécialisés",
  },
  honda_16idtec_dilution: {
    engine_code: "N16A1",
    patterns: ["N16A1", "N16A2", "1.6 i-DTEC", "N16"],
    brand: "Honda",
    engine_family: "1.6 i-DTEC",
    title_fr: "Dilution d'huile par le carburant — Régénérations DPF",
    description_fr:
      "Le 1.6 i-DTEC en usage urbain voit son niveau d'huile monter à cause de la dilution par le gazole lors des régénérations DPF fréquentes. L'huile diluée perd ses propriétés lubrifiantes.",
    severity: "moderate",
    symptoms_fr: [
      "Niveau d'huile qui monte sur la jauge",
      "Odeur de gazole dans l'huile",
      "Régénérations DPF très fréquentes",
      "Voyant DPF",
    ],
    affected_years: "2013–2019",
    repair_cost_range: "300 – 1 200 €",
    source: "Honda TSB + forums spécialisés",
  },
  volvo_d5_swirl: {
    engine_code: "D5244T",
    patterns: ["D5244T", "D5204T", "D5", "D4204T"],
    brand: "Volvo",
    engine_family: "D5 2.4 diesel / D4 2.0 diesel",
    title_fr: "Volets de tubulure d'admission — Détachement",
    description_fr:
      "Les diesels Volvo D5 (2.4) et D4 (2.0) souffrent de volets de tubulure d'admission (swirl flaps) qui peuvent se détacher et être aspirés dans le moteur, causant des dommages catastrophiques.",
    severity: "critical",
    symptoms_fr: [
      "Bruit de claquement soudain",
      "Perte de puissance brutale",
      "Voyant moteur",
      "Fumée excessive",
    ],
    affected_years: "2006–2016",
    repair_cost_range: "500 – 5 000 €",
    source: "Volvo TSB + forums spécialisés",
  },
  mazda_skyactiv_d_egr: {
    engine_code: "SH-VPTS",
    patterns: ["SH-VPTS", "SH-VPTR", "SH", "SkyActiv-D 2.2", "S8-DPTS"],
    brand: "Mazda",
    engine_family: "SkyActiv-D 2.2 diesel",
    title_fr: "Encrassement EGR et calamine — Volets d'admission",
    description_fr:
      "Le SkyActiv-D 2.2 peut souffrir d'encrassement de la vanne EGR et de dépôts de calamine dans la tubulure d'admission. Fréquent en usage urbain, peut causer la perte de puissance.",
    severity: "moderate",
    symptoms_fr: [
      "Perte de puissance progressive",
      "Voyant moteur",
      "Ralenti instable",
      "Fumée noire au démarrage",
    ],
    affected_years: "2012–2020",
    repair_cost_range: "500 – 1 500 €",
    source: "Mazda TSB + forums spécialisés",
  },
  nissan_mr20de_chain: {
    engine_code: "MR20DE",
    patterns: ["MR20DE", "MR20DD", "MR20", "QR25DE", "QR25"],
    brand: "Nissan/Renault",
    engine_family: "MR20/QR25 2.0/2.5",
    title_fr: "Allongement chaîne de distribution",
    description_fr:
      "Les moteurs MR20 et QR25 souffrent d'allongement de chaîne de distribution au-delà de 120 000 km. Le tendeur hydraulique perd progressivement son efficacité.",
    severity: "major",
    symptoms_fr: [
      "Cliquetis au démarrage à froid",
      "Voyant moteur",
      "Ralenti légèrement instable",
      "Bruit de chaîne en décélération",
    ],
    affected_years: "2007–2017",
    repair_cost_range: "1 000 – 2 500 €",
    source: "Nissan TSB + forums spécialisés",
  },
  fiat_fire_14: {
    engine_code: "350A1",
    patterns: ["350A1", "169A3", "312A1", "330A1", "Fire 1.4", "169A4"],
    brand: "Fiat/Alfa Romeo/Lancia",
    engine_family: "Fire 1.4 8v/16v",
    title_fr: "Tendeur courroie de distribution — Défaillance",
    description_fr:
      "Le moteur Fire 1.4 souffre de défaillance du galet tendeur de courroie de distribution. La courroie peut sauter et causer la casse moteur. Remplacement préventif recommandé à 60 000 km.",
    severity: "major",
    symptoms_fr: [
      "Bruit de grincement côté distribution",
      "Courroie qui se décentre",
      "Fuite LR au niveau de la pompe",
      "Calage moteur brutal",
    ],
    affected_years: "2003–2019",
    repair_cost_range: "400 – 2 000 €",
    source: "Fiat TSB + forums spécialisés",
  },
  vw_19tdi_camshaft: {
    engine_code: "BKC",
    patterns: ["BKC", "BXE", "BLS", "BKD", "BMM", "BMP", "1.9 TDI PD"],
    brand: "VAG (VW/Audi/Seat/Skoda)",
    engine_family: "1.9 TDI PD (pompe-injecteurs)",
    title_fr: "Usure arbre à cames et poussoirs PD",
    description_fr:
      "Les 1.9 TDI PD (pompe-injecteurs) souffrent d'usure prématurée de l'arbre à cames et des poussoirs à cause des contraintes élevées du système PD. L'usure dégrade les performances et les émissions.",
    severity: "moderate",
    symptoms_fr: [
      "Bruit de claquement au ralenti",
      "Légère perte de puissance",
      "Fumée noire au démarrage",
      "Ralenti légèrement irrégulier",
    ],
    affected_years: "2003–2010",
    repair_cost_range: "800 – 2 500 €",
    source: "VAG TSB + forums spécialisés",
  },
  kia_gdi_carbon: {
    engine_code: "G4FD",
    patterns: ["G4FD", "G4FJ", "G4FL", "G4FP", "1.6 T-GDI", "1.6 GDI"],
    brand: "Hyundai/Kia",
    engine_family: "1.6 GDI/T-GDI Gamma",
    title_fr: "Encrassement soupapes d'admission — Injection directe",
    description_fr:
      "Les moteurs GDI/T-GDI Gamma 1.6 accumulent des dépôts de calamine sur les soupapes d'admission (l'injection directe ne les lave pas). Perte de puissance progressive et ratés d'allumage.",
    severity: "moderate",
    symptoms_fr: [
      "Perte de puissance progressive",
      "Ratés d'allumage à froid",
      "Ralenti instable",
      "Consommation en hausse",
    ],
    affected_years: "2011–2020",
    repair_cost_range: "500 – 1 500 €",
    source: "Hyundai/Kia TSB + forums spécialisés",
  },
};
