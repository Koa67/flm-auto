import type Anthropic from "@anthropic-ai/sdk";

export const ALAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_vehicles",
    description:
      "Recherche des véhicules par nom de marque, modèle, code châssis ou catégorie. Retourne une liste de résultats avec marque, modèle, génération et slug.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Texte de recherche (ex: 'BMW Série 3', 'Peugeot 308', 'E46', 'SUV familial')",
        },
        limit: {
          type: "number",
          description: "Nombre max de résultats (défaut: 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_vehicle_details",
    description:
      "Récupère la fiche technique complète d'une génération : motorisations, performances, dimensions, sécurité Euro NCAP, compatibilité famille.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "check_engine_warnings",
    description:
      "Vérifie si un code moteur est connu pour avoir des problèmes de fiabilité (red flags). Retourne les alertes connues avec symptômes et coûts de réparation.",
    input_schema: {
      type: "object" as const,
      properties: {
        engine_code: {
          type: "string",
          description: "Code moteur à vérifier (ex: 'EB2', 'N47D20', 'H5Ft', 'EA211')",
        },
      },
      required: ["engine_code"],
    },
  },
  {
    name: "compare_vehicles",
    description:
      "Compare 2 générations de véhicules côte à côte : specs, performances, dimensions, prix, sécurité.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id_a: {
          type: "string",
          description: "UUID de la première génération",
        },
        generation_id_b: {
          type: "string",
          description: "UUID de la seconde génération",
        },
      },
      required: ["generation_id_a", "generation_id_b"],
    },
  },
  {
    name: "check_family_fit",
    description:
      "Vérifie la compatibilité sièges enfants d'un véhicule : ISOFIX, 3-across, largeur banquette, score famille.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "get_cargo_info",
    description:
      "Récupère les données coffre d'un véhicule : volume en litres, volume max (sièges rabattus), dimensions.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "rag_search",
    description:
      "Recherche sémantique dans la base FLM AUTO. Utilise ce tool quand la recherche par nom ne suffit pas, ou pour trouver des véhicules par caractéristiques (ex: 'SUV avec grand coffre', 'voiture fiable pour autoroute', 'électrique familiale abordable').",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Question ou description en langage naturel (ex: 'SUV familial 7 places fiable', 'berline sportive moins de 40k')",
        },
        limit: {
          type: "number",
          description: "Nombre max de résultats (défaut: 5, max: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recalls",
    description:
      "Récupère les rappels constructeur (recalls) d'un véhicule : date, composant concerné, description du problème et remède.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "get_photos",
    description:
      "Récupère les meilleures photos d'un véhicule : extérieur, intérieur, détails. Retourne les URLs et types d'images triés par qualité.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération",
        },
        limit: {
          type: "number",
          description: "Nombre max de photos (défaut: 10)",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "get_reliability",
    description:
      "Récupère les données de fiabilité d'un véhicule : alertes moteur (red flags), taux de panne TÜV, problèmes connus, score de fiabilité. Utilise ce tool quand l'utilisateur demande si un véhicule est fiable.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "calculate_tco",
    description:
      "Calcule le coût total de possession (TCO) d'un véhicule sur une durée donnée. Inclut dépréciation, carburant, assurance, entretien, malus écologique 2025 et carte grise. Retourne le coût mensuel et le détail.",
    input_schema: {
      type: "object" as const,
      properties: {
        generation_id: {
          type: "string",
          description: "UUID de la génération (pour récupérer les données automatiquement)",
        },
        prix_achat: {
          type: "number",
          description: "Prix d'achat en euros (optionnel si disponible en base)",
        },
        km_annuels: {
          type: "number",
          description: "Kilométrage annuel estimé (défaut: 15000)",
        },
        duree_mois: {
          type: "number",
          description: "Durée de détention en mois (défaut: 48)",
        },
      },
      required: ["generation_id"],
    },
  },
  {
    name: "search_and_detail",
    description:
      "Combo : recherche un véhicule par nom puis récupère sa fiche technique complète en une seule étape. Idéal pour les questions 'fiche technique de X', 'specs de X', 'tout sur X'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Nom du véhicule à chercher (ex: 'BMW M3 G80', 'Peugeot 308 III', 'Golf 8 GTI')",
        },
      },
      required: ["query"],
    },
  },
];
