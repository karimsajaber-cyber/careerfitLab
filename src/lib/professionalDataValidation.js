const KEYBOARD_ROWS = ["qwertyuiop", "poiuytrewq", "asdfghjkl", "lkjhgfdsa", "zxcvbnm", "mnbvcxz"];
const KEYBOARD_RUN_PREFIX = /^(?:asd|sdf|dfg|fgh|ghj|hjk|jkl|lkj|kjh|jhg|hgf|gfd|fds|qwe|wer|ert|rty|tyu|yui|uio|iop|poi|oiu|iuy|uyt|ytr|tre|rew|zxc|xcv|cvb|vbn|bnm|mnb|nbv|bvc|vcx)/u;
const GENERIC_PLACEHOLDER = /^(?:test|testing|example|sample|dummy|loremipsum|اختبار|تجربة|مثال|عينة|نموذج|تجريبي)+$/u;

export function normalizeProfessionalText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function compactText(value) {
  return normalizeProfessionalText(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function hasExtremeLowDiversity(value) {
  return value.length >= 12 && new Set(value).size <= 3;
}

function isCompleteKeyboardRun(token) {
  return token.length >= 4 && KEYBOARD_ROWS.some((row) => row.includes(token));
}

function hasRepeatedCharacterStructure(token) {
  const counts = new Map();
  for (const character of token) counts.set(character, (counts.get(character) || 0) + 1);
  return [...counts.values()].filter((count) => count >= 2).length >= 3;
}

function isStructuredKeyboardJunk(token) {
  return token.length >= 8
    && KEYBOARD_RUN_PREFIX.test(token)
    && hasRepeatedCharacterStructure(token);
}

export function isObviousProfessionalJunk(value) {
  const normalized = normalizeProfessionalText(value);
  const compact = compactText(normalized);
  if (!compact || /^\p{N}+$/u.test(compact) || /^(.)(?:\1){5,}$/u.test(compact)) return true;
  const tokens = normalized.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (tokens.some((token) => isCompleteKeyboardRun(token) || isStructuredKeyboardJunk(token))) return true;
  if (GENERIC_PLACEHOLDER.test(compact)) return true;
  if (compact.length >= 6 && /^(.{1,8})\1{2,}$/u.test(compact)) return true;
  if (hasExtremeLowDiversity(compact)) return true;
  return tokens.length >= 3 && new Set(tokens).size === 1;
}

export function hasProfessionalLetters(value) {
  return /\p{L}/u.test(normalizeProfessionalText(value));
}

export function isValidPersonName(value) {
  const text = normalizeProfessionalText(value);
  return text.length >= 2 && text.length <= 100 && hasProfessionalLetters(text) && !isObviousProfessionalJunk(text);
}

export function isValidProfessionalRole(value) {
  const text = normalizeProfessionalText(value);
  return text.length >= 2 && text.length <= 100 && hasProfessionalLetters(text) && !isObviousProfessionalJunk(text);
}

export function isValidSkill(value) {
  const text = normalizeProfessionalText(value);
  return text.length >= 2 && text.length <= 100 && hasProfessionalLetters(text) && !isObviousProfessionalJunk(text);
}

export function isValidSkillListText(value) {
  const source = normalizeProfessionalText(value);
  if (!source || source.length > 1000) return false;
  const parts = /[,;\n،؛]/u.test(source)
    ? source.split(/[,;\n،؛]/u).map(normalizeProfessionalText).filter(Boolean)
    : [source];
  return parts.length > 0 && parts.every(isValidSkill);
}

export function isValidLanguage(value) {
  return isValidSkill(value);
}

export function isValidCareerConstraint(value) {
  const text = normalizeProfessionalText(value);
  return text.length >= 2 && text.length <= 100 && hasProfessionalLetters(text) && !isObviousProfessionalJunk(text);
}

export function isValidLocation(value) {
  const text = normalizeProfessionalText(value);
  return text.length >= 2 && text.length <= 100 && hasProfessionalLetters(text) && !isObviousProfessionalJunk(text);
}

export function isValidLongProfessionalNarrative(value, minLength, maxLength = 2000) {
  const text = normalizeProfessionalText(value);
  const lexicalTokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  return text.length >= minLength
    && text.length <= maxLength
    && hasProfessionalLetters(text)
    && lexicalTokens.length >= 3
    && !isObviousProfessionalJunk(text);
}

export function isValidShortProfessionalDescription(value, maxLength = 2000) {
  const text = normalizeProfessionalText(value);
  return text.length >= 1
    && text.length <= maxLength
    && hasProfessionalLetters(text)
    && !isObviousProfessionalJunk(text);
}

export function isValidEducationNarrative(value) {
  return isValidLongProfessionalNarrative(value, 10);
}

export function normalizePhone(value) {
  const phone = normalizeProfessionalText(value);
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
  const digits = phone.replace(/\D/g, "");
  if (balance !== 0 || digits.length < 7 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits) || isSimpleDigitSequence(digits) || isRepeatedDigitPattern(digits)) return null;
  return phone.startsWith("+") ? `+${digits}` : digits;
}

export function isValidPhone(value) {
  return normalizePhone(value) !== null;
}

function isSimpleDigitSequence(value) {
  if (value.length < 7) return false;
  const direction = Number(value[1]) - Number(value[0]);
  if (direction !== 1 && direction !== -1) return false;
  for (let index = 2; index < value.length; index += 1) {
    if (Number(value[index]) - Number(value[index - 1]) !== direction) return false;
  }
  return true;
}

function isRepeatedDigitPattern(value) {
  for (let length = 2; length <= 4; length += 1) {
    if (value.length % length !== 0 || value.length / length < 3) continue;
    if (value === value.slice(0, length).repeat(value.length / length)) return true;
  }
  return false;
}

export function isValidProfessionalUrl(value, linkedinOnly = false) {
  const urlValue = normalizeProfessionalText(value);
  if (!urlValue || urlValue.length > 2048) return false;
  try {
    const url = new URL(urlValue);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    return !linkedinOnly || hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}
