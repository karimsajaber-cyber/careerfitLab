// Phase 2 keeps this public module path stable while moving the implementation
// into a focused core module that has an explicit server-owned field contract.
export * from "./semanticValidationCore.ts";

/* Legacy Phase 1 implementation retained in source history for task-scoped review.
export type SemanticMode = "off" | "shadow" | "enforced";
export type SemanticSurface = "application" | "career_profile";
export type SemanticFieldType = "professional_role" | "skill_or_skill_list" | "career_narrative" | "education_narrative";
export type SemanticState = "valid" | "invalid" | "uncertain";
export type SemanticReasonCode = "random_or_nonsensical" | "placeholder_or_test" | "wrong_field_semantics" | "insufficient_meaning";
export type SemanticExecutionPath = "off" | "surface_disabled" | "no_fields" | "cache_hit" | "provider" | "deterministic_fallback";
export type SemanticFallbackReason = "configuration_unavailable" | "cache_identity_unavailable" | "provider_timeout" | "provider_failure" | "malformed_provider_response" | "provider_guard";

export type SemanticValidationConfiguration = {
  mode: SemanticMode;
  applicationEnabled: boolean;
  careerProfileEnabled: boolean;
  timeoutMs: number;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  validatorVersion: string;
  dailyProviderCallLimit: number | null;
  monthlyProviderCallLimit: number | null;
};

export type SemanticField = {
  key: string;
  type: SemanticFieldType;
  value: string;
};

export type SemanticFieldResult = {
  key: string;
  state: SemanticState;
  reasonCode: SemanticReasonCode | null;
};

export type SemanticProviderRequest = {
  surface: SemanticSurface;
  validatorVersion: string;
  fields: SemanticField[];
};

export type SemanticProvider = {
  validate(request: SemanticProviderRequest, signal: AbortSignal): Promise<unknown>;
};

export type SemanticCacheRecord = {
  cacheKey: string;
  surface: SemanticSurface;
  validatorVersion: string;
  results: SemanticFieldResult[];
  expiresAt: string;
};

export type SemanticValidationEvent = {
  configuredMode: SemanticMode;
  executionPath: SemanticExecutionPath;
  surface: SemanticSurface;
  providerAttempted: boolean;
  providerSucceeded: boolean;
  cacheHit: boolean;
  fallbackReason: SemanticFallbackReason | null;
  resultCounts: { valid: number; invalid: number; uncertain: number };
  latencyMs: number;
};

export type SemanticValidationRepository = {
  readConfiguration(): Promise<SemanticValidationConfiguration>;
  readCache(cacheKey: string): Promise<SemanticCacheRecord | null>;
  writeCache(record: SemanticCacheRecord): Promise<void>;
  consumeProviderBudget(surface: SemanticSurface): Promise<{ allowed: boolean }>;
  recordEvent(event: SemanticValidationEvent): Promise<void>;
};

export type SemanticValidationDependencies = {
  repository: SemanticValidationRepository;
  provider: SemanticProvider;
  cacheHmacSecret: string | undefined;
  now?: () => number;
};

export type SemanticValidationDecision = {
  configuredMode: SemanticMode;
  executionPath: SemanticExecutionPath;
  fallbackReason: SemanticFallbackReason | null;
  results: SemanticFieldResult[];
  blockedFieldKeys: string[];
};

export const DEFAULT_SEMANTIC_VALIDATION_CONFIGURATION: SemanticValidationConfiguration = {
  mode: "off",
  applicationEnabled: false,
  careerProfileEnabled: false,
  timeoutMs: 2500,
  cacheEnabled: true,
  cacheTtlSeconds: 60 * 60 * 24,
  validatorVersion: "v1",
  dailyProviderCallLimit: null,
  monthlyProviderCallLimit: null,
};

const ALLOWED_FIELD_TYPES = new Set<SemanticFieldType>(["professional_role", "skill_or_skill_list", "career_narrative", "education_narrative"]);
const ALLOWED_STATES = new Set<SemanticState>(["valid", "invalid", "uncertain"]);
const ALLOWED_REASON_CODES = new Set<SemanticReasonCode>(["random_or_nonsensical", "placeholder_or_test", "wrong_field_semantics", "insufficient_meaning"]);

export class SemanticTechnicalFailure extends Error {
  constructor(public readonly reason: SemanticFallbackReason) {
    super(reason);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeField(field: SemanticField): SemanticField | null {
  const key = String(field?.key || "").trim();
  const value = String(field?.value || "").trim().replace(/\s+/g, " ");
  if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(key) || !value || !ALLOWED_FIELD_TYPES.has(field.type)) return null;
  return { key, type: field.type, value };
}

export function canonicalizeSemanticFields(fields: SemanticField[]) {
  const normalized = fields.map(normalizeField).filter((field): field is SemanticField => field !== null);
  const seen = new Set<string>();
  const unique = normalized.filter((field) => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
  return unique.sort((left, right) => left.key.localeCompare(right.key));
}

export async function createSemanticCacheKey(
  secret: string,
  surface: SemanticSurface,
  validatorVersion: string,
  fields: SemanticField[],
) {
  const canonicalPayload = JSON.stringify({ surface, validatorVersion, fields: canonicalizeSemanticFields(fields) });
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(canonicalPayload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseSemanticProviderResult(value: unknown, expectedFields: SemanticField[]): SemanticFieldResult[] {
  if (!isPlainObject(value) || !Array.isArray(value.results) || value.results.length !== expectedFields.length) {
    throw new SemanticTechnicalFailure("malformed_provider_response");
  }

  const expectedKeys = new Set(expectedFields.map((field) => field.key));
  const results: SemanticFieldResult[] = [];
  for (const item of value.results) {
    if (!isPlainObject(item) || typeof item.key !== "string" || typeof item.state !== "string") {
      throw new SemanticTechnicalFailure("malformed_provider_response");
    }
    const key = item.key.trim();
    if (!expectedKeys.delete(key) || !ALLOWED_STATES.has(item.state as SemanticState)) {
      throw new SemanticTechnicalFailure("malformed_provider_response");
    }
    const state = item.state as SemanticState;
    const reasonCode = item.reason_code === null || item.reason_code === undefined ? null : item.reason_code;
    if (reasonCode !== null && (typeof reasonCode !== "string" || !ALLOWED_REASON_CODES.has(reasonCode as SemanticReasonCode))) {
      throw new SemanticTechnicalFailure("malformed_provider_response");
    }
    if (state === "invalid" && reasonCode === null) throw new SemanticTechnicalFailure("malformed_provider_response");
    results.push({ key, state, reasonCode: reasonCode as SemanticReasonCode | null });
  }
  if (expectedKeys.size > 0) throw new SemanticTechnicalFailure("malformed_provider_response");
  return results.sort((left, right) => left.key.localeCompare(right.key));
}

function isSurfaceEnabled(configuration: SemanticValidationConfiguration, surface: SemanticSurface) {
  return surface === "application" ? configuration.applicationEnabled : configuration.careerProfileEnabled;
}

function resultCounts(results: SemanticFieldResult[]) {
  return results.reduce((counts, result) => {
    counts[result.state] += 1;
    return counts;
  }, { valid: 0, invalid: 0, uncertain: 0 });
}

function decision(configuration: SemanticValidationConfiguration, executionPath: SemanticExecutionPath, results: SemanticFieldResult[], fallbackReason: SemanticFallbackReason | null = null): SemanticValidationDecision {
  return {
    configuredMode: configuration.mode,
    executionPath,
    fallbackReason,
    results,
    blockedFieldKeys: configuration.mode === "enforced"
      ? results.filter((result) => result.state === "invalid").map((result) => result.key)
      : [],
  };
}

async function recordSafely(repository: SemanticValidationRepository, startedAt: number, surface: SemanticSurface, decisionValue: SemanticValidationDecision, providerAttempted: boolean, providerSucceeded: boolean, cacheHit: boolean, now: () => number) {
  try {
    await repository.recordEvent({
      configuredMode: decisionValue.configuredMode,
      executionPath: decisionValue.executionPath,
      surface,
      providerAttempted,
      providerSucceeded,
      cacheHit,
      fallbackReason: decisionValue.fallbackReason,
      resultCounts: resultCounts(decisionValue.results),
      latencyMs: Math.max(0, now() - startedAt),
    });
  } catch {
    // Observability is never allowed to change the user-facing decision.
  }
}

async function callProviderWithTimeout(provider: SemanticProvider, request: SemanticProviderRequest, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new SemanticTechnicalFailure("provider_timeout"));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([provider.validate(request, controller.signal), timeoutResult]);
    if (timedOut) throw new SemanticTechnicalFailure("provider_timeout");
    return result;
  } catch (error) {
    if (timedOut || controller.signal.aborted) throw new SemanticTechnicalFailure("provider_timeout");
    if (error instanceof SemanticTechnicalFailure) throw error;
    throw new SemanticTechnicalFailure("provider_failure");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function orchestrateSemanticValidation(
  surface: SemanticSurface,
  fields: SemanticField[],
  dependencies: SemanticValidationDependencies,
): Promise<SemanticValidationDecision> {
  const now = dependencies.now || Date.now;
  const startedAt = now();
  let configuration: SemanticValidationConfiguration;
  try {
    configuration = await dependencies.repository.readConfiguration();
  } catch {
    const fallback = decision(DEFAULT_SEMANTIC_VALIDATION_CONFIGURATION, "deterministic_fallback", [], "configuration_unavailable");
    await recordSafely(dependencies.repository, startedAt, surface, fallback, false, false, false, now);
    return fallback;
  }

  // OFF is a hard cost kill switch: no cache or provider work is performed.
  if (configuration.mode === "off") {
    const offDecision = decision(configuration, "off", []);
    await recordSafely(dependencies.repository, startedAt, surface, offDecision, false, false, false, now);
    return offDecision;
  }
  if (!isSurfaceEnabled(configuration, surface)) {
    const disabledDecision = decision(configuration, "surface_disabled", []);
    await recordSafely(dependencies.repository, startedAt, surface, disabledDecision, false, false, false, now);
    return disabledDecision;
  }

  const canonicalFields = canonicalizeSemanticFields(fields);
  if (canonicalFields.length === 0) {
    const noFieldsDecision = decision(configuration, "no_fields", []);
    await recordSafely(dependencies.repository, startedAt, surface, noFieldsDecision, false, false, false, now);
    return noFieldsDecision;
  }

  let cacheKey: string | null = null;
  if (configuration.cacheEnabled) {
    if (!dependencies.cacheHmacSecret) {
      const fallback = decision(configuration, "deterministic_fallback", [], "cache_identity_unavailable");
      await recordSafely(dependencies.repository, startedAt, surface, fallback, false, false, false, now);
      return fallback;
    }
    cacheKey = await createSemanticCacheKey(dependencies.cacheHmacSecret, surface, configuration.validatorVersion, canonicalFields);
    try {
      const cached = await dependencies.repository.readCache(cacheKey);
      if (cached && cached.surface === surface && cached.validatorVersion === configuration.validatorVersion && Date.parse(cached.expiresAt) > now()) {
        const cachedResults = parseSemanticProviderResult({ results: cached.results.map((result) => ({ ...result, reason_code: result.reasonCode })) }, canonicalFields);
        const cacheDecision = decision(configuration, "cache_hit", cachedResults);
        await recordSafely(dependencies.repository, startedAt, surface, cacheDecision, false, false, true, now);
        return cacheDecision;
      }
    } catch {
      // A cache outage or corrupt entry is a miss; it must not block a request.
    }
  }

  try {
    const guard = await dependencies.repository.consumeProviderBudget(surface);
    if (!guard.allowed) throw new SemanticTechnicalFailure("provider_guard");
    const rawResult = await callProviderWithTimeout(
      dependencies.provider,
      { surface, validatorVersion: configuration.validatorVersion, fields: canonicalFields },
      configuration.timeoutMs,
    );
    const results = parseSemanticProviderResult(rawResult, canonicalFields);
    const providerDecision = decision(configuration, "provider", results);
    if (cacheKey && configuration.cacheEnabled) {
      try {
        await dependencies.repository.writeCache({
          cacheKey,
          surface,
          validatorVersion: configuration.validatorVersion,
          results,
          expiresAt: new Date(now() + configuration.cacheTtlSeconds * 1000).toISOString(),
        });
      } catch {
        // A cache write failure never changes an accepted provider result.
      }
    }
    await recordSafely(dependencies.repository, startedAt, surface, providerDecision, true, true, false, now);
    return providerDecision;
  } catch (error) {
    const fallbackReason = error instanceof SemanticTechnicalFailure ? error.reason : "provider_failure";
    const fallback = decision(configuration, "deterministic_fallback", [], fallbackReason);
    await recordSafely(dependencies.repository, startedAt, surface, fallback, true, false, false, now);
    return fallback;
  }
}
*/
