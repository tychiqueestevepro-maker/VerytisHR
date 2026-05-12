import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { HR_CORE_MODEL, getOpenAIKeyForCompany, completeHrJson } from "./openai";
import OpenAI from "openai";
import { asObject, pickString } from "./utils";

export async function processHrChat(params: {
  companyId: string;
  message: string;
  flowId: string;
  contextId: string | null;
  locale?: string;
}) {
  const { companyId, message, flowId, contextId, locale = "en" } = params;
  const apiKey = await getOpenAIKeyForCompany(companyId);
  if (!apiKey) throw new Error("No OpenAI API key found");

  const openai = new OpenAI({ apiKey });
  const supabase = createSupabaseServiceClient();

  // 1. Context Gathering
  // If we have a contextId (mission ID), we fetch the mission details and top candidates to provide context to the AI.
  let missionContext = "";
  let candidateContext = "";

  if (contextId) {
    const { data: mission } = await supabase
      .from("missions")
      .select("*")
      .eq("id", contextId)
      .eq("company_id", companyId) // Strict isolation check
      .single();

    if (mission) {
      missionContext = `Mission Actuelle: ${mission.title} (${mission.status})\nDescription: ${mission.description || "N/A"}\n`;
      
      // Fetch stats for this mission with isolation check
      const { data: candidates } = await supabase
        .from("candidate_missions")
        .select("*, candidate:candidates(*)")
        .eq("mission_id", contextId)
        .eq("company_id", companyId); // Strict isolation check

      if (candidates && candidates.length > 0) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const total = candidates.length;
        const analyzed = candidates.filter((cm: any) => cm.fit_score !== null).length;
        const receivedToday = candidates.filter((cm: any) => new Date(cm.created_at) >= todayStart).length;
        
        const recommendations = candidates.reduce((acc: any, cm: any) => {
          const rec = cm.recommendation || "À réviser";
          acc[rec] = (acc[rec] || 0) + 1;
          return acc;
        }, {});

        candidateContext = `Statistiques du Pipeline:
- Total candidats: ${total}
- Reçus aujourd'hui: ${receivedToday}
- Analysés: ${analyzed}
- En attente: ${total - analyzed}
- Recommandations: ${Object.entries(recommendations).map(([k, v]) => `${k}: ${v}`).join(", ")}

Top Candidats (Indexés par Fit Score):
` + candidates
        .sort((a: any, b: any) => (b.fit_score || 0) - (a.fit_score || 0))
        .slice(0, 10)
        .map((cm: any) => {
          const c = cm.candidate;
          const dateStr = new Date(cm.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: 'numeric', month: 'short' });
          return `- **${c.first_name} ${c.last_name}** (Fit: **${cm.fit_score || "N/A"}%**, Reçu le: ${dateStr}): ${cm.recommendation || "Review"}. Actuellement ${c.current_title || "N/A"} chez ${c.current_company_name || "N/A"}`;
        }).join("\n");
      }
    }
  }

  // 2. AI Processing
  const isEn = locale === "en";
  
  const systemPrompt = isEn 
    ? `You are the Verytis Intelligent Assistant, an elite AI specialized in recruitment strategy and high-level data analysis.

OBJECTIVE:
Provide precise, actionable insights on recruitment data for the ${flowId === 'sourcing' ? 'Sourcing' : 'Applications'} workflow.
Today's date: ${new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

ORGANIZATIONAL CONTEXT:
${missionContext}
${candidateContext}

KEY CAPABILITIES:
1. Candidate Analysis: Rank and explain why certain profiles are high-priority.
2. Pipeline Health: Summarize the progress of sourcing or applications.
3. Strategic Advice: Suggest adjustments based on the current talent pool quality.

TONE & STYLE:
- Language: ALWAYS RESPOND IN ENGLISH.
- Professional, impactful, and data-driven.
- Structure: Use Markdown (headers, bullet points).
- Concision: Be direct. If the user just says "Hello" or "Hi", respond with a professional and friendly greeting and ask how you can assist them with their ${flowId} workflow. DO NOT use dashes, separators, or bullet points for simple greetings. Keep it natural and conversational.
- Data Privacy: All data is strictly isolated for organization ${companyId}.`
    : `Tu es l'Assistant Intelligent de Verytis, une IA d'élite spécialisée dans la stratégie de recrutement et l'analyse de données de haut niveau.

OBJECTIF:
Fournir des analyses précises et actionnables sur les données de recrutement pour le workflow de ${flowId === 'sourcing' ? 'Sourcing' : 'Applications'}.
Date du jour: ${new Date().toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

CONTEXTE DE L'ORGANISATION:
${missionContext}
${candidateContext}

CAPACITÉS CLÉS:
1. Analyse de Candidats: Classer et expliquer pourquoi certains profils sont prioritaires.
2. Santé du Pipeline: Résumer l'état d'avancement du sourcing ou des candidatures.
3. Conseils Stratégiques: Suggérer des ajustements basés sur la qualité du vivier actuel.

TON & STYLE:
- Langue: RÉPONDRE TOUJOURS EN FRANÇAIS.
- Professionnel, percutant et axé sur la donnée.
- Structure: Utilise Markdown (titres, listes à puces) uniquement pour les analyses complexes.
- Concision: Sois direct. Si l'utilisateur dit simplement "Bonjour" ou "Salut", réponds par une salutation professionnelle et amicale et demande comment tu peux l'aider dans son workflow ${flowId}. NE mets PAS de tirets, de séparateurs ou de puces pour les salutations simples. Reste naturel et conversationnel.
- Confidentialité: Toutes les données sont strictement isolées pour l'organisation ${companyId}.`;

  // 2. AI Processing with Structured Output
  const result = await completeHrJson({
    companyId,
    model: HR_CORE_MODEL,
    schemaName: "hr_chat_response",
    schema: {
      type: "object",
      properties: {
        thought: { 
          type: "string", 
          description: "Ta réflexion interne sur les données et la stratégie avant de répondre." 
        },
        response: { 
          type: "string", 
          description: "La réponse finale adressée à l'utilisateur, formatée en Markdown." 
        }
      },
      required: ["thought", "response"],
      additionalProperties: false
    },
    system: systemPrompt,
    user: message,
  });

  if (!result) throw new Error("Échec de la génération de la réponse IA");

  return {
    thought: result.data.thought,
    response: result.data.response
  };
}
