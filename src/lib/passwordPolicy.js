export const MIN_PASSWORD_LENGTH = 12;

// UX only. Supabase Auth must enforce the matching policy server-side.
export function validateCareerFitPassword(password, confirmation) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (password !== confirmation) return "mismatch";
  return null;
}
