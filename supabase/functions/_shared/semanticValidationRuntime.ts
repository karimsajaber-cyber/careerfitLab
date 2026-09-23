import { createOpenAISemanticProvider } from "./semanticValidationOpenAI.ts";
import { buildSemanticPayload, orchestrateSemanticValidation, SemanticValidationDecision } from "./semanticValidation.ts";
import { createSupabaseSemanticValidationRepository } from "./semanticValidationSupabase.ts";

export async function validateApplicationSemanticPayload(client: any, payload: Record<string, unknown>): Promise<SemanticValidationDecision> {
  const candidate = Object.fromEntries(Object.entries({ targetRole: payload.targetRole, targetFieldsOther: payload.targetFieldsOther, relevantExperience: payload.relevantExperience, strongestSkills: payload.strongestSkills, careerChallenge: payload.careerChallenge, careerfitHelp: payload.careerfitHelp }).filter(([, value]) => typeof value === "string" && value.trim()));
  return orchestrateSemanticValidation(buildSemanticPayload("application", candidate), { repository: createSupabaseSemanticValidationRepository(client), provider: createOpenAISemanticProvider(Deno.env.get("SEMANTIC_VALIDATION_API_KEY") || ""), cacheHmacSecret: Deno.env.get("SEMANTIC_VALIDATION_HMAC_SECRET") });
}

export async function validateCareerProfileSemanticPayload(client: any, profile: Record<string, unknown>): Promise<SemanticValidationDecision> {
  const candidate = { professionalSummary: profile.professional_summary, targetRoles: profile.target_roles, skills: profile.skills, experienceSummary: profile.experience_summary, educationSummary: profile.education_summary };
  return orchestrateSemanticValidation(buildSemanticPayload("career_profile", candidate), { repository: createSupabaseSemanticValidationRepository(client), provider: createOpenAISemanticProvider(Deno.env.get("SEMANTIC_VALIDATION_API_KEY") || ""), cacheHmacSecret: Deno.env.get("SEMANTIC_VALIDATION_HMAC_SECRET") });
}

export function semanticFieldErrors(decision: SemanticValidationDecision) { return Object.fromEntries(decision.results.filter((result) => decision.blockedFieldKeys.includes(result.key)).map((result) => [result.key, result.reasonCode])); }
