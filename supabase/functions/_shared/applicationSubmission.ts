export const MAX_CV_SIZE = 5 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF-";
const MAX_FULL_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_DIGITS = 15;
const MIN_PHONE_DIGITS = 7;
const MAX_TARGET_ROLE_LENGTH = 100;
const MAX_TARGET_FIELD_LENGTH = 100;
const MAX_TARGET_FIELDS = 3;
const MAX_RELEVANT_EXPERIENCE_LENGTH = 2000;
const MAX_OPPORTUNITY_TYPE_LENGTH = 100;
const MAX_CAREERFIT_HELP_LENGTH = 2000;
const MAX_STRONGEST_SKILLS_LENGTH = 1000;
const MAX_CAREER_CHALLENGE_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const MAX_ADDITIONAL_NOTES_LENGTH = 2000;
const MAX_CHANGES_SINCE_CV_LENGTH = 2000;
const OPPORTUNITY_TYPES = new Set([
  "first_professional_job", "career_change", "better_job", "remote_international_work",
  "improve_readiness", "internship_experience", "other",
]);
const TARGET_FIELDS = new Set([
  "software_it", "data_ai", "technical_support", "customer_support_success",
  "sales_business_development", "marketing_content", "operations",
  "supply_chain_logistics_procurement", "project_management", "product_management",
  "human_resources_recruitment", "finance_accounting", "healthcare_life_sciences",
  "education_training", "design_ux", "administration_office", "engineering",
  "research_academia", "ngo_development", "other",
]);

export type SubmissionPayload = {
  fullName: string;
  email: string;
  phone: string;
  opportunityType: string;
  targetRole: string;
  targetFields: string[];
  targetFieldsOther: string;
  relevantExperience: string;
  strongestSkills: string;
  careerChallenge: string;
  careerfitHelp: string;
  linkedinUrl: string;
  portfolioUrl: string;
  additionalNotes: string;
  cvStatus: string;
  changesSinceCv: string;
  quiz: Record<string, unknown> | null;
};

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function hasLetterOrNumber(value: string) {
  return /[\p{L}\p{N}]/u.test(value);
}

function compactText(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

const KEYBOARD_ROWS = ["qwertyuiop", "poiuytrewq", "asdfghjkl", "lkjhgfdsa", "zxcvbnm", "mnbvcxz"];
const KEYBOARD_RUN_PREFIX = /^(?:asd|sdf|dfg|fgh|ghj|hjk|jkl|lkj|kjh|jhg|hgf|gfd|fds|qwe|wer|ert|rty|tyu|yui|uio|iop|poi|oiu|iuy|uyt|ytr|tre|rew|zxc|xcv|cvb|vbn|bnm|mnb|nbv|bvc|vcx)/u;

function isCompleteKeyboardRun(token: string) {
  return token.length >= 4 && KEYBOARD_ROWS.some((row) => row.includes(token));
}

function hasRepeatedCharacterStructure(token: string) {
  const counts = new Map<string, number>();
  for (const character of token) counts.set(character, (counts.get(character) || 0) + 1);
  return [...counts.values()].filter((count) => count >= 2).length >= 3;
}

function isStructuredKeyboardJunk(token: string) {
  return token.length >= 8
    && KEYBOARD_RUN_PREFIX.test(token)
    && hasRepeatedCharacterStructure(token);
}

function isObviousJunk(value: string) {
  const compact = compactText(value);
  if (!compact || /^\p{N}+$/u.test(compact) || /^(.)(?:\1){5,}$/u.test(compact)) return true;

  // Restrict these checks to unmistakable placeholders, not natural language quality.
  const tokens = value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (tokens.some((token) => isCompleteKeyboardRun(token) || isStructuredKeyboardJunk(token))) return true;
  if (/^(?:test|testing|example|sample|dummy|loremipsum|اختبار|تجربة|مثال|عينة|نموذج|تجريبي)+$/u.test(compact)) return true;
  if (compact.length >= 6 && /^(.{1,8})\1{2,}$/u.test(compact)) return true;

  if (compact.length >= 12 && new Set(compact).size <= 3) return true;

  return tokens.length >= 3 && new Set(tokens).size === 1;
}

export function isMeaningfulText(value: string) {
  return Boolean(value) && hasLetterOrNumber(value) && !isObviousJunk(value);
}

function isValidName(value: string) {
  return hasLength(value, 2, MAX_FULL_NAME_LENGTH)
    && /\p{L}/u.test(value)
    && isMeaningfulText(value);
}

function isValidProfessionalRole(value: string) {
  return hasLength(value, 2, MAX_TARGET_ROLE_LENGTH) && /\p{L}/u.test(value) && isMeaningfulText(value);
}

function isValidSkillList(value: string) {
  if (!hasLength(value, 2, MAX_STRONGEST_SKILLS_LENGTH)) return false;
  const parts = /[,;\n،؛]/u.test(value)
    ? value.split(/[,;\n،؛]/u).map(normalizeText).filter(Boolean)
    : [value];
  return parts.length > 0 && parts.every((part) => hasLength(part, 2, 100) && /\p{L}/u.test(part) && isMeaningfulText(part));
}

function isValidNarrative(value: string, min: number, max: number) {
  const tokens = value.match(/[\p{L}\p{N}]+/gu) || [];
  return hasLength(value, min, max) && tokens.length >= 3 && isMeaningfulText(value);
}

function isValidShortDescription(value: string, max: number) {
  return hasLength(value, 1, max) && isMeaningfulText(value);
}

function normalizePhone(value: unknown) {
  const phone = normalizeText(value);
  if (!phone) return "";
  if (!/^\+?[\d\s()-]+$/.test(phone)) return null;
  if ((phone.match(/\+/g) || []).length > 1 || (phone.includes("+") && !phone.startsWith("+"))) return null;

  let balance = 0;
  for (const character of phone) {
    if (character === "(") balance += 1;
    if (character === ")") {
      balance -= 1;
      if (balance < 0) return null;
    }
  }
  if (balance !== 0) return null;

  const digits = phone.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (isSimpleDigitSequence(digits) || isRepeatedDigitPattern(digits)) return null;
  return phone.startsWith("+") ? `+${digits}` : digits;
}

function isSimpleDigitSequence(value: string) {
  if (value.length < MIN_PHONE_DIGITS) return false;
  const direction = Number(value[1]) - Number(value[0]);
  if (direction !== 1 && direction !== -1) return false;
  for (let index = 2; index < value.length; index += 1) {
    if (Number(value[index]) - Number(value[index - 1]) !== direction) return false;
  }
  return true;
}

function isRepeatedDigitPattern(value: string) {
  for (let length = 2; length <= 4; length += 1) {
    if (value.length % length !== 0 || value.length / length < 3) continue;
    if (value === value.slice(0, length).repeat(value.length / length)) return true;
  }
  return false;
}

function isValidUrl(value: string, linkedinOnly = false) {
  if (!value || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return !linkedinOnly || hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function normalizeTargetFields(value: unknown) {
  const fields = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [...new Set(fields.map(normalizeText).filter(Boolean))];
}

function hasLength(value: string, min: number, max: number) {
  return value.length >= min && value.length <= max;
}

export function parseSubmissionPayload(value: unknown, hasCv: boolean): SubmissionPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  const fullName = normalizeText(payload.fullName);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const opportunityType = normalizeText(payload.opportunityType);
  const targetRole = normalizeText(payload.targetRole);
  const targetFields = normalizeTargetFields(payload.targetFields);
  const targetFieldsOther = normalizeText(payload.targetFieldsOther);
  const relevantExperience = normalizeText(payload.relevantExperience);
  const strongestSkills = normalizeText(payload.strongestSkills);
  const careerChallenge = normalizeText(payload.careerChallenge);
  const careerfitHelp = normalizeText(payload.careerfitHelp);
  const linkedinUrl = normalizeText(payload.linkedinUrl);
  const portfolioUrl = normalizeText(payload.portfolioUrl);
  const additionalNotes = normalizeText(payload.additionalNotes);
  const cvStatus = normalizeText(payload.cvStatus);
  const changesSinceCv = normalizeText(payload.changesSinceCv);
  const quiz = payload.quiz && typeof payload.quiz === "object" && !Array.isArray(payload.quiz)
    ? payload.quiz as Record<string, unknown>
    : null;
  const validCvStatuses = new Set(["current", "needs_update", "not_sure"]);

  if (
    !isValidName(fullName) ||
    !hasLength(email, 3, MAX_EMAIL_LENGTH) || !/^\S+@\S+\.\S+$/.test(email) ||
    phone === null ||
    !OPPORTUNITY_TYPES.has(opportunityType) ||
    (targetRole && !isValidProfessionalRole(targetRole)) ||
    targetFields.length === 0 ||
    targetFields.length > MAX_TARGET_FIELDS ||
    targetFields.some((field) => !TARGET_FIELDS.has(field)) ||
    (targetFields.includes("other") && !isValidProfessionalRole(targetFieldsOther)) ||
    !isValidNarrative(relevantExperience, 20, MAX_RELEVANT_EXPERIENCE_LENGTH) ||
    !isValidSkillList(strongestSkills) ||
    !isValidNarrative(careerChallenge, 15, MAX_CAREER_CHALLENGE_LENGTH) ||
    !isValidNarrative(careerfitHelp, 15, MAX_CAREERFIT_HELP_LENGTH) ||
    (linkedinUrl && !isValidUrl(linkedinUrl, true)) ||
    (portfolioUrl && !isValidUrl(portfolioUrl)) ||
    (additionalNotes && !isValidShortDescription(additionalNotes, MAX_ADDITIONAL_NOTES_LENGTH)) ||
    (changesSinceCv && !isValidShortDescription(changesSinceCv, MAX_CHANGES_SINCE_CV_LENGTH)) ||
    payload.privacyConsent !== true ||
    (hasCv && !validCvStatuses.has(cvStatus))
  ) {
    return null;
  }

  return {
    fullName,
    email,
    phone,
    opportunityType,
    targetRole,
    targetFields,
    targetFieldsOther: targetFields.includes("other") ? targetFieldsOther : "",
    relevantExperience,
    strongestSkills,
    careerChallenge,
    careerfitHelp,
    linkedinUrl,
    portfolioUrl,
    additionalNotes,
    cvStatus,
    changesSinceCv,
    quiz,
  };
}

export async function hasValidPdfSignature(file: File) {
  const header = await file.slice(0, PDF_SIGNATURE.length).text();
  return header === PDF_SIGNATURE;
}

export async function isValidCv(file: File) {
  return file.type === "application/pdf"
    && file.size > 0
    && file.size <= MAX_CV_SIZE
    && await hasValidPdfSignature(file);
}

export function parsePayloadJson(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
