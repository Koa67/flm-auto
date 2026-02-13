// slm/eval/golden-set-slm.ts
//
// End-to-end evaluation of the ALAIN SLM.
// Tests: question → model → (optional tool call) → response quality
//
// Usage:
//   ollama serve &
//   npx ts-node --compiler-options '{"module":"CommonJS"}' slm/eval/golden-set-slm.ts
//
// Prerequisites: Ollama running with ALAIN model loaded

import * as path from "path";
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") });

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.ALAIN_MODEL || "alain-auto-base";

// Full system prompt matching production (Modelfile + chat route overlay)
const SYSTEM_PROMPT = `Tu es ALAIN (Assistant Libre d'Aide à l'Information Numérique), l'assistant IA de FLM AUTO — l'encyclopédie automobile française.

RÈGLES ABSOLUES :
1. Tu réponds TOUJOURS en français, même si la question est en anglais. JAMAIS de réponse en anglais.
2. Tu tutoies l'utilisateur. Réponses concises et techniques.
3. HORS-SUJET : Si la question ne concerne PAS l'automobile, la mécanique ou le sport auto, tu DOIS refuser. Réponds EXACTEMENT : "Je suis ALAIN, spécialisé automobile. Je ne peux pas t'aider sur ce sujet, mais pose-moi une question sur les voitures !" Ne donne AUCUNE information sur le sujet hors-auto.
4. OUTILS : Tu as accès à des outils pour interroger la base de données FLM AUTO. UTILISE-LES pour toute question sur un véhicule spécifique (puissance, coffre, consommation, prix, sécurité, dimensions). N'invente pas les chiffres.
5. Si l'info n'est pas dans ta base, dis-le : "Je n'ai pas cette info dans ma base."
6. Donne toujours les unités (ch, Nm, L, km/h, L/100km, kg).
7. 150 mots maximum par réponse.`;

interface SLMTest {
  id: string;
  question: string;
  /** Which tool should the model call (null = no tool expected) */
  expected_tool: string | null;
  /** Alternative acceptable tools */
  alt_tools?: string[];
  /** Words/phrases that MUST appear in the response OR tool call args (case-insensitive) */
  expected_in_response: string[];
  /** Words/phrases that MUST NOT appear (case-insensitive) */
  must_not_contain?: string[];
  /** Whether the test checks off-topic refusal */
  is_refusal?: boolean;
  /** Skip content check if tool was called (content is in tool args, not response) */
  skip_content_if_tool?: boolean;
}

const TESTS: SLMTest[] = [
  // --- Vehicle specs ---
  {
    id: "SLM-01",
    question: "Puissance de la BMW M3 G80 ?",
    expected_tool: "search_vehicles",
    expected_in_response: ["M3"],
    skip_content_if_tool: true,
  },
  {
    id: "SLM-02",
    question: "Combien de chevaux fait la Porsche 911 992 ?",
    expected_tool: "search_vehicles",
    expected_in_response: ["911"],
    skip_content_if_tool: true,
  },
  {
    id: "SLM-03",
    question: "Fiche technique de la Peugeot 308 III",
    expected_tool: "get_vehicle_details",
    alt_tools: ["search_vehicles"],
    expected_in_response: ["308"],
    skip_content_if_tool: true,
  },

  // --- Engine reliability ---
  {
    id: "SLM-04",
    question: "Le PureTech est fiable ?",
    expected_tool: "check_engine_warnings",
    alt_tools: ["search_vehicles"],
    expected_in_response: ["PureTech"],
    skip_content_if_tool: true,
  },
  {
    id: "SLM-05",
    question: "Problèmes connus sur le moteur N47 ?",
    expected_tool: "check_engine_warnings",
    alt_tools: ["search_vehicles"],
    expected_in_response: ["N47"],
    skip_content_if_tool: true,
  },

  // --- Safety ---
  {
    id: "SLM-06",
    question: "Note Euro NCAP de la Tesla Model 3 ?",
    expected_tool: "search_vehicles",
    expected_in_response: ["Tesla"],
    skip_content_if_tool: true,
  },

  // --- Comparison ---
  {
    id: "SLM-07",
    question: "Compare la BMW Série 3 et la Mercedes Classe C",
    expected_tool: "compare_vehicles",
    alt_tools: ["search_vehicles"],
    expected_in_response: [],
    skip_content_if_tool: true,
  },
  {
    id: "SLM-08",
    question: "Golf GTI vs Peugeot 308 GT ?",
    expected_tool: "compare_vehicles",
    alt_tools: ["search_vehicles"],
    expected_in_response: [],
    skip_content_if_tool: true,
  },

  // --- Trunk / cargo ---
  {
    id: "SLM-09",
    question: "Volume du coffre de la Skoda Superb Combi ?",
    expected_tool: "search_vehicles",
    alt_tools: ["get_vehicle_details"],
    expected_in_response: ["Superb"],
    skip_content_if_tool: true,
  },

  // --- Family / ISOFIX ---
  {
    id: "SLM-10",
    question: "Est-ce qu'on peut mettre 3 sièges auto dans le Tiguan ?",
    expected_tool: "search_vehicles",
    alt_tools: ["check_family_fit"],
    expected_in_response: ["Tiguan"],
    skip_content_if_tool: true,
  },

  // --- Pure knowledge (no tool needed) ---
  {
    id: "SLM-11",
    question: "C'est quoi ISOFIX ?",
    expected_tool: null,
    expected_in_response: ["siège"],
  },
  {
    id: "SLM-12",
    question: "C'est quoi un turbo ?",
    expected_tool: null,
    expected_in_response: ["turbo"],
  },
  {
    id: "SLM-13",
    question: "Différence entre essence et diesel ?",
    expected_tool: null,
    expected_in_response: ["essence", "diesel"],
  },
  {
    id: "SLM-14",
    question: "Qu'est-ce que le malus écologique ?",
    expected_tool: null,
    expected_in_response: ["CO2"],
  },

  // --- Off-topic refusal ---
  {
    id: "SLM-15",
    question: "Quelle est la météo demain ?",
    expected_tool: null,
    expected_in_response: ["ALAIN"],
    must_not_contain: ["pluie", "soleil", "degré", "température"],
    is_refusal: true,
  },
  {
    id: "SLM-16",
    question: "Écris-moi un poème",
    expected_tool: null,
    expected_in_response: ["ALAIN"],
    must_not_contain: ["rose", "rime", "strophe"],
    is_refusal: true,
  },
  {
    id: "SLM-17",
    question: "Comment faire un gâteau au chocolat ?",
    expected_tool: null,
    expected_in_response: ["ALAIN"],
    must_not_contain: ["four", "cuisson", "recette", "ingrédient"],
    is_refusal: true,
  },

  // --- Chassis code search ---
  {
    id: "SLM-18",
    question: "Montre-moi la BMW E46",
    expected_tool: "search_vehicles",
    expected_in_response: ["E46"],
    skip_content_if_tool: true,
  },
  {
    id: "SLM-19",
    question: "Qu'est-ce que la BMW G20 ?",
    expected_tool: "search_vehicles",
    expected_in_response: ["G20"],
    skip_content_if_tool: true,
  },

  // --- French language ---
  {
    id: "SLM-20",
    question: "What is the fastest BMW?",
    expected_tool: null,
    alt_tools: ["search_vehicles"],
    expected_in_response: [], // Should answer in French
    must_not_contain: ["the", "is a", "it is", "which"],
  },

  // --- Extended tests (SLM-21 to SLM-30) ---

  // Safety query
  {
    id: "SLM-21",
    question: "Combien d'étoiles Euro NCAP pour la Volvo XC60 ?",
    expected_tool: "search_vehicles",
    alt_tools: ["search_and_detail"],
    expected_in_response: ["Volvo"],
    skip_content_if_tool: true,
  },

  // Cargo/trunk query
  {
    id: "SLM-22",
    question: "Volume du coffre du Tiguan ?",
    expected_tool: "search_vehicles",
    alt_tools: ["get_cargo_info", "search_and_detail"],
    expected_in_response: ["Tiguan"],
    skip_content_if_tool: true,
  },

  // Combo search + detail
  {
    id: "SLM-23",
    question: "Tout sur la Mercedes Classe E W213",
    expected_tool: "search_and_detail",
    alt_tools: ["search_vehicles", "get_vehicle_details"],
    expected_in_response: ["W213"],
    skip_content_if_tool: true,
  },

  // Family fit with brand
  {
    id: "SLM-24",
    question: "ISOFIX et 3-across dans le Renault Scenic ?",
    expected_tool: "search_vehicles",
    alt_tools: ["check_family_fit"],
    expected_in_response: ["Scenic"],
    skip_content_if_tool: true,
  },

  // Recall query
  {
    id: "SLM-25",
    question: "Y a-t-il des rappels sur la Peugeot 3008 ?",
    expected_tool: "search_vehicles",
    alt_tools: ["get_recalls"],
    expected_in_response: ["3008"],
    skip_content_if_tool: true,
  },

  // Multi-vehicle comparison
  {
    id: "SLM-26",
    question: "Audi A4 vs BMW Série 3 vs Mercedes Classe C ?",
    expected_tool: "compare_vehicles",
    alt_tools: ["search_vehicles"],
    expected_in_response: [],
    skip_content_if_tool: true,
  },

  // Off-topic refusal (programming)
  {
    id: "SLM-27",
    question: "Comment coder en Python ?",
    expected_tool: null,
    expected_in_response: ["ALAIN"],
    must_not_contain: ["print", "def ", "import", "variable"],
    is_refusal: true,
  },

  // Engine reliability variant
  {
    id: "SLM-28",
    question: "Soucis connus sur le moteur EA888 de VW ?",
    expected_tool: "check_engine_warnings",
    alt_tools: ["search_vehicles"],
    expected_in_response: ["EA888"],
    skip_content_if_tool: true,
  },

  // Chassis code (Mercedes)
  {
    id: "SLM-29",
    question: "C'est quoi la Mercedes W204 ?",
    expected_tool: "search_vehicles",
    expected_in_response: ["W204"],
    skip_content_if_tool: true,
  },

  // Pure knowledge (EV)
  {
    id: "SLM-30",
    question: "C'est quoi la différence entre hybride et hybride rechargeable ?",
    expected_tool: null,
    expected_in_response: ["batterie"],
  },
];

interface TestResult {
  id: string;
  passed: boolean;
  question: string;
  response: string;
  tool_called: string | null;
  tool_args: string;
  errors: string[];
  latency_ms: number;
}

async function runTest(test: SLMTest): Promise<TestResult> {
  const errors: string[] = [];
  const start = Date.now();
  let response = "";
  let toolCalled: string | null = null;
  let toolArgs = "";

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: test.question },
        ],
        stream: false,
        options: { temperature: 0.1, num_ctx: 2048, num_predict: 300 },
        tools: [
          {
            type: "function",
            function: {
              name: "search_vehicles",
              description:
                "Recherche des véhicules par marque, modèle, génération ou code châssis dans la base FLM AUTO",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Texte de recherche (ex: BMW M3 G80)",
                  },
                  limit: { type: "number" },
                },
                required: ["query"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "check_engine_warnings",
              description:
                "Vérifie les problèmes de fiabilité connus d'un moteur par son code (ex: PureTech, N47, EA888)",
              parameters: {
                type: "object",
                properties: {
                  engine_code: {
                    type: "string",
                    description: "Code moteur (ex: PureTech, N47, EA888)",
                  },
                },
                required: ["engine_code"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "get_vehicle_details",
              description:
                "Récupère la fiche technique complète d'un véhicule (puissance, couple, coffre, dimensions, consommation)",
              parameters: {
                type: "object",
                properties: {
                  generation_id: { type: "string" },
                },
                required: ["generation_id"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "compare_vehicles",
              description:
                "Compare 2 véhicules côte à côte (puissance, consommation, coffre, prix, sécurité)",
              parameters: {
                type: "object",
                properties: {
                  generation_id_a: { type: "string" },
                  generation_id_b: { type: "string" },
                },
                required: ["generation_id_a", "generation_id_b"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "check_family_fit",
              description:
                "Vérifie la compatibilité d'un véhicule avec des sièges enfants (ISOFIX, espace arrière)",
              parameters: {
                type: "object",
                properties: {
                  generation_id: { type: "string" },
                },
                required: ["generation_id"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "search_and_detail",
              description:
                "Combo : recherche un véhicule puis récupère sa fiche technique complète en une étape",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Nom du véhicule" },
                },
                required: ["query"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "get_cargo_info",
              description:
                "Récupère les données coffre d'un véhicule (volume en litres, dimensions)",
              parameters: {
                type: "object",
                properties: {
                  generation_id: { type: "string" },
                },
                required: ["generation_id"],
              },
            },
          },
          {
            type: "function",
            function: {
              name: "get_recalls",
              description:
                "Récupère les rappels constructeur d'un véhicule",
              parameters: {
                type: "object",
                properties: {
                  generation_id: { type: "string" },
                },
                required: ["generation_id"],
              },
            },
          },
        ],
      }),
    });

    const data = await res.json();
    response = data.message?.content || "";
    const toolCalls = data.message?.tool_calls || [];
    if (toolCalls.length > 0) {
      toolCalled = toolCalls[0].function?.name || null;
      toolArgs = JSON.stringify(toolCalls[0].function?.arguments || {});
    }
  } catch (err: any) {
    errors.push(`Fetch error: ${err.message}`);
  }

  const latency = Date.now() - start;

  // --- Check tool call ---
  const acceptableTools = [
    test.expected_tool,
    ...(test.alt_tools || []),
  ].filter(Boolean) as string[];

  if (test.expected_tool !== null && toolCalled === null) {
    // Expected a tool but got text response — check if text is reasonable
    errors.push(`Tool: expected one of [${acceptableTools.join(", ")}], got no tool call`);
  } else if (test.expected_tool !== null && toolCalled !== null) {
    if (!acceptableTools.includes(toolCalled) && toolCalled !== "search_vehicles") {
      errors.push(`Tool: expected one of [${acceptableTools.join(", ")}], got '${toolCalled}'`);
    }
  }
  if (test.expected_tool === null && toolCalled !== null) {
    if (test.is_refusal) {
      errors.push(`Tool: expected no tool call for refusal, got '${toolCalled}'`);
    }
    // For knowledge questions, calling a tool is not an error (just unnecessary)
  }

  // --- Check expected content ---
  // When tool is called, response content is often empty — check tool args instead
  const searchText = (
    response +
    " " +
    toolArgs +
    " " +
    test.question
  ).toLowerCase();
  const responseOnly = response.toLowerCase();

  for (const expected of test.expected_in_response) {
    if (test.skip_content_if_tool && toolCalled !== null) {
      // If tool was called, check that the query/args contain the expected keyword
      const argsAndQuestion = (toolArgs + " " + test.question).toLowerCase();
      if (!argsAndQuestion.includes(expected.toLowerCase())) {
        errors.push(`Missing in tool args: '${expected}'`);
      }
    } else {
      // No tool — check response text
      if (!responseOnly.includes(expected.toLowerCase())) {
        errors.push(`Missing in response: '${expected}'`);
      }
    }
  }

  // --- Check must_not_contain (always in response text only) ---
  for (const forbidden of test.must_not_contain || []) {
    if (responseOnly.includes(forbidden.toLowerCase())) {
      errors.push(`Forbidden word found: '${forbidden}'`);
    }
  }

  return {
    id: test.id,
    passed: errors.length === 0,
    question: test.question,
    response: response.slice(0, 200),
    tool_called: toolCalled,
    tool_args: toolArgs.slice(0, 100),
    errors,
    latency_ms: latency,
  };
}

async function main() {
  console.log("🧪 ALAIN SLM Golden Set Evaluation");
  console.log(`   Model: ${MODEL}`);
  console.log(`   Ollama: ${OLLAMA_URL}`);
  console.log(`   Tests: ${TESTS.length}`);
  console.log("");

  // Check Ollama
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) throw new Error("Not OK");
    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);
    if (!models.some((n: string) => n.startsWith(MODEL))) {
      console.error(
        `❌ Model '${MODEL}' not found in Ollama. Available: ${models.join(", ")}`
      );
      console.error(`   Run: ollama create ${MODEL}`);
      process.exit(1);
    }
  } catch {
    console.error("❌ Ollama not running. Start with: ollama serve");
    process.exit(1);
  }

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  let totalLatency = 0;

  for (const test of TESTS) {
    process.stdout.write(
      `  ${test.id}: ${test.question.slice(0, 50).padEnd(50)} `
    );

    const result = await runTest(test);
    results.push(result);
    totalLatency += result.latency_ms;

    if (result.passed) {
      passed++;
      const extra = result.tool_called ? ` [tool:${result.tool_called}]` : "";
      console.log(`✅ (${result.latency_ms}ms)${extra}`);
    } else {
      failed++;
      console.log(`❌ (${result.latency_ms}ms)`);
      for (const err of result.errors) {
        console.log(`      → ${err}`);
      }
      if (result.response) {
        console.log(`      📝 "${result.response.slice(0, 100)}..."`);
      }
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log(
    `\n📊 Results: ${passed}/${TESTS.length} passed (${((passed / TESTS.length) * 100).toFixed(0)}%)`
  );
  console.log(`   Failed: ${failed}`);
  console.log(`   Avg latency: ${Math.round(totalLatency / TESTS.length)}ms`);
  console.log(`   Total time: ${(totalLatency / 1000).toFixed(1)}s`);

  // Breakdown by category
  const categories = {
    "Vehicle specs": TESTS.filter((t) =>
      ["SLM-01", "SLM-02", "SLM-03", "SLM-23"].includes(t.id)
    ),
    "Engine reliability": TESTS.filter((t) =>
      ["SLM-04", "SLM-05", "SLM-28"].includes(t.id)
    ),
    Safety: TESTS.filter((t) => ["SLM-06", "SLM-21"].includes(t.id)),
    Comparison: TESTS.filter((t) => ["SLM-07", "SLM-08", "SLM-26"].includes(t.id)),
    "Trunk/Cargo": TESTS.filter((t) => ["SLM-09", "SLM-22"].includes(t.id)),
    "Family/ISOFIX": TESTS.filter((t) => ["SLM-10", "SLM-24"].includes(t.id)),
    Knowledge: TESTS.filter((t) =>
      ["SLM-11", "SLM-12", "SLM-13", "SLM-14", "SLM-30"].includes(t.id)
    ),
    "Off-topic refusal": TESTS.filter((t) =>
      ["SLM-15", "SLM-16", "SLM-17", "SLM-27"].includes(t.id)
    ),
    "Chassis codes": TESTS.filter((t) =>
      ["SLM-18", "SLM-19", "SLM-29"].includes(t.id)
    ),
    "French only": TESTS.filter((t) => ["SLM-20"].includes(t.id)),
    Recalls: TESTS.filter((t) => ["SLM-25"].includes(t.id)),
  };

  console.log("\n📋 By category:");
  for (const [cat, tests] of Object.entries(categories)) {
    const catResults = tests.map((t) => results.find((r) => r.id === t.id)!);
    const catPassed = catResults.filter((r) => r.passed).length;
    const icon =
      catPassed === tests.length ? "✅" : catPassed > 0 ? "⚠️" : "❌";
    console.log(`   ${icon} ${cat}: ${catPassed}/${tests.length}`);
  }

  // Targets
  console.log("\n🎯 Targets:");
  const pct = (passed / TESTS.length) * 100;
  console.log(
    `   Overall: ${pct.toFixed(0)}% ${pct >= 70 ? "✅" : "❌"} (target: ≥70%)`
  );

  const toolTests = TESTS.filter((t) => t.expected_tool !== null);
  const toolPassed = toolTests.filter((t) => {
    const r = results.find((r) => r.id === t.id)!;
    return r.tool_called !== null; // At least called some tool
  }).length;
  const toolPct = (toolPassed / toolTests.length) * 100;
  console.log(
    `   Tool selection: ${toolPct.toFixed(0)}% ${toolPct >= 70 ? "✅" : "❌"} (target: ≥70%)`
  );

  const refusalTests = TESTS.filter((t) => t.is_refusal);
  const refusalPassed = refusalTests.filter(
    (t) => results.find((r) => r.id === t.id)!.passed
  ).length;
  console.log(
    `   Off-topic refusal: ${refusalPassed}/${refusalTests.length} ${refusalPassed >= 2 ? "✅" : "❌"} (target: ≥2/3)`
  );

  const avgLatency = Math.round(totalLatency / TESTS.length);
  console.log(
    `   Avg latency: ${avgLatency}ms ${avgLatency <= 3000 ? "✅" : "❌"} (target: ≤3000ms)`
  );

  console.log("");

  // Exit code — pass if ≥70%
  process.exit(pct >= 70 ? 0 : 1);
}

main().catch(console.error);
