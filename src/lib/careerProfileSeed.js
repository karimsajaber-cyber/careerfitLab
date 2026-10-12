import {
  isValidLongProfessionalNarrative,
  isValidProfessionalRole,
  isValidSkill,
  normalizeProfessionalText,
} from "./professionalDataValidation.js";

const EXPLICIT_LIST_SEPARATOR = /[,;\n،؛]/u;

export function deriveProfileSkills(strongestSkills) {
  const source = normalizeProfessionalText(strongestSkills);
  if (!source) return [];

  const candidates = EXPLICIT_LIST_SEPARATOR.test(source)
    ? source.split(EXPLICIT_LIST_SEPARATOR)
    : [source];
  const skills = candidates.map(normalizeProfessionalText).filter(Boolean);

  // A prose sentence without an explicit separator is not a structured skill list.
  if (!EXPLICIT_LIST_SEPARATOR.test(source) && (skills.length !== 1 || source.split(/\s+/u).length > 4)) return [];

  const unique = [...new Map(skills.map((skill) => [skill.toLocaleLowerCase(), skill])).values()];
  return unique.length > 0 && unique.every(isValidSkill) ? unique : [];
}

export function seedEmptyCareerProfile(applicationSeed) {
  const targetRole = normalizeProfessionalText(applicationSeed?.target_role);
  const experienceSummary = normalizeProfessionalText(applicationSeed?.relevant_experience);
  return {
    targetRoles: isValidProfessionalRole(targetRole) ? [targetRole] : [],
    experienceSummary: isValidLongProfessionalNarrative(experienceSummary, 20) ? experienceSummary : "",
    skills: deriveProfileSkills(applicationSeed?.strongest_skills),
  };
}

export function applyCareerProfileSeed(profile, applicationSeed, hasExistingProfile) {
  if (hasExistingProfile) return profile;
  const seed = seedEmptyCareerProfile(applicationSeed);
  return { ...profile, ...seed };
}
