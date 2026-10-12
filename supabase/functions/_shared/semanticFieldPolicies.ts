export type SemanticFieldPolicy = {
  purpose: string;
  valid_content: string;
  invalid_content: string;
  uncertain_rule: string;
};

export const CAREER_PROFILE_SEMANTIC_POLICY_VERSION =
  "career-profile-semantic-policy-v2";

const universalSafety = {
  invalid_content:
    "Invalid only when clearly random or nonsensical, obvious placeholder or test content, or clearly wrong-field content. Language, script, or unfamiliar terminology alone can never make content invalid.",
  uncertain_rule:
    "Use uncertain when the content may reasonably be legitimate but confidence is insufficient; do not classify it as invalid in that case.",
};

export const CAREER_PROFILE_SEMANTIC_FIELD_POLICIES = {
  professionalSummary: {
    purpose:
      "A professional overview, career identity, background, capabilities, focus, or value proposition.",
    valid_content:
      "Arabic, English, and mixed-language professional text are valid. Do not require polished grammar or CV-quality writing.",
    ...universalSafety,
  },
  targetRoles: {
    purpose: "Real or reasonably plausible job or career role names.",
    valid_content:
      "Short roles and technical titles are valid, including QA, HR Specialist, .NET Software Developer, and Power BI Analyst. Do not reject unfamiliar but plausible professional titles.",
    ...universalSafety,
  },
  skills: {
    purpose:
      "Professional skills, tools, technologies, methodologies, platforms, or domain capabilities.",
    valid_content:
      "Short technical terms are valid. Protect QA, ORM, AI, SQL, .NET, C++, CNC, B2B, SAP S/4HANA, and Power BI when appropriate.",
    ...universalSafety,
  },
  experienceSummary: {
    purpose:
      "Work, responsibilities, projects, achievements, practical exposure, volunteering, freelance work, internships, or relevant experience.",
    valid_content:
      "Arabic, English, and mixed-language descriptions are valid. Do not require dates, company names, metrics, perfect grammar, or CV formatting.",
    ...universalSafety,
  },
  educationSummary: {
    purpose:
      "Education, degree, study, university, school, training, bootcamp, certification, course, or professional learning.",
    valid_content:
      "Arabic, English, and mixed-language descriptions are valid. Do not require formal degree wording.",
    ...universalSafety,
  },
} as const satisfies Record<string, SemanticFieldPolicy>;

export type CareerProfileSemanticFieldKey = keyof typeof CAREER_PROFILE_SEMANTIC_FIELD_POLICIES;

export function getSemanticFieldPolicy(
  surface: "application" | "career_profile",
  key: string,
): SemanticFieldPolicy | undefined {
  if (surface !== "career_profile") return undefined;
  return CAREER_PROFILE_SEMANTIC_FIELD_POLICIES[
    key as CareerProfileSemanticFieldKey
  ];
}

export function getSemanticContractVersion(
  surface: "application" | "career_profile",
): string {
  return surface === "career_profile"
    ? CAREER_PROFILE_SEMANTIC_POLICY_VERSION
    : "application-semantic-contract-v1";
}
