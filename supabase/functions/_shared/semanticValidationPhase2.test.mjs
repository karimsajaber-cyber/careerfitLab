import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const result = await build({ entryPoints: [path.resolve("supabase/functions/_shared/semanticValidation.ts")], bundle: true, format: "esm", platform: "node", target: "node20", write: false });
const dir = await mkdtemp(path.join(os.tmpdir(), "careerfit-semantic-v2-")); const output = path.join(dir, "core.mjs"); await writeFile(output, result.outputFiles[0].text, "utf8");
const semantic = await import(pathToFileURL(output).href);
const config = { ...semantic.DEFAULT_SEMANTIC_VALIDATION_CONFIGURATION, mode: "enforced", applicationEnabled: true, careerProfileEnabled: true, cacheEnabled: false, timeoutMs: 15, supportOperationTimeoutMs: 15 };
const candidate = { targetRole: "Power BI Analyst", relevantExperience: "I work with Power BI and Excel on operational reporting." };
const payload = semantic.buildSemanticPayload("application", candidate); assert.equal(payload.ok, true);
assert.equal(semantic.buildSemanticPayload("application", { ...candidate, email: "person@example.com" }).ok, false, "email must be rejected at the server-owned semantic boundary");
assert.equal(semantic.buildSemanticPayload("application", { fullName: "Abdussalam" }).ok, false, "names must never enter the semantic payload");
assert.equal(semantic.buildSemanticPayload("career_profile", { unknown: "value" }).ok, false, "unknown profile keys must be explicit contract failures");
assert.equal(semantic.buildSemanticPayload("application", { targetRole: ["not a scalar"] }).ok, false, "wrong value shape must not fall through to no_fields");
const profile = semantic.buildSemanticPayload("career_profile", {
  professionalSummary: "Mixed Arabic and English professional summary for software delivery.",
  targetRoles: [".NET Software Developer"],
  skills: ["QA", "ORM", "Power BI", "SAP S/4HANA", "C++", "CNC", "B2B"],
  experienceSummary: "لدي خبرة في تطوير تطبيقات الويب والعمل على مشاريع باستخدام Python وDjango والتعامل مع احتياجات المستخدمين.",
  educationSummary: "Bootcamp and university learning in software development.",
});
assert.equal(profile.ok, true);
assert.equal(profile.payload.contractVersion, "career-profile-semantic-policy-v2");
for (const field of profile.payload.fields) {
  assert.ok(field.policy, `${field.key} must include a server-owned field policy`);
  assert.match(field.policy.invalid_content, /random or nonsensical/i);
  assert.match(field.policy.uncertain_rule, /uncertain/i);
}
assert.match(profile.payload.fields.find((field) => field.key === "experienceSummary").policy.valid_content, /Arabic, English, and mixed-language/i);
assert.match(profile.payload.fields.find((field) => field.key === "targetRoles").policy.valid_content, /\.NET Software Developer/i);
assert.match(profile.payload.fields.find((field) => field.key === "skills").policy.valid_content, /QA, ORM, AI, SQL, .NET, C\+\+, CNC, B2B, SAP S\/4HANA, and Power BI/i);
assert.match(profile.payload.fields[0].policy.invalid_content, /placeholder or test content/i);
assert.match(profile.payload.fields[0].policy.invalid_content, /wrong-field content/i);
function repo(overrides = {}) { const events = []; return { events, async readConfiguration() { return { ...config, ...overrides }; }, async readCache() { return null; }, async writeCache() {}, async consumeProviderBudget() { return { allowed: true }; }, async recordEvent(event) { events.push(event); } }; }
function provider(handler) { return { calls: 0, async validate(request, signal) { this.calls += 1; return handler(request, signal); } }; }
const valid = (request, usage = undefined) => ({ result: { results: request.fields.map((field) => ({ key: field.key, state: "valid", reason_code: null })) }, usage, providerId: "openai_responses", model: "configured-model" });
const invalid = (request) => ({ result: { results: request.fields.map((field, index) => ({ key: field.key, state: index ? "valid" : "invalid", reason_code: index ? null : "wrong_field_semantics" })) } });
async function run(overrides, handler, repository = repo(overrides)) { const p = provider(handler); const decision = await semantic.orchestrateSemanticValidation(payload, { repository, provider: p, cacheHmacSecret: "test-key" }); return { decision, p, repository }; }
{ const { decision, p, repository } = await run({ mode: "off" }, valid); assert.equal(decision.executionPath, "off"); assert.equal(p.calls, 0); assert.equal(repository.events[0].providerRequestStarted, false); }
{ const repository = repo(); repository.consumeProviderBudget = async () => ({ allowed: false }); const { decision, p } = await run({}, valid, repository); assert.equal(decision.fallbackReason, "provider_guard"); assert.equal(p.calls, 0); assert.equal(repository.events[0].providerRequestStarted, false); }
{ const repository = repo(); let budgetCalls = 0; repository.consumeProviderBudget = async () => { budgetCalls += 1; return { allowed: true }; }; const p = { calls: 0, preflight: () => "provider_guard", async validate() { this.calls += 1; return valid({ fields: payload.payload.fields }); } }; const decision = await semantic.orchestrateSemanticValidation(payload, { repository, provider: p, cacheHmacSecret: "test-key" }); assert.equal(decision.fallbackReason, "provider_guard"); assert.equal(p.calls, 0); assert.equal(budgetCalls, 0, "missing local provider prerequisites must not consume provider budget"); assert.equal(repository.events[0].providerRequestStarted, false); }
{ const repository = repo({ cacheEnabled: true }); const key = await semantic.createSemanticCacheKey("test-key", "application", config.validatorVersion, payload.payload.fields); repository.readCache = async () => ({ cacheKey: key, surface: "application", validatorVersion: config.validatorVersion, expiresAt: new Date(Date.now() + 60000).toISOString(), results: valid({ fields: payload.payload.fields }).result.results.map((item) => ({ key: item.key, state: item.state, reasonCode: item.reason_code })) }); const { decision, p } = await run({ cacheEnabled: true }, valid, repository); assert.equal(decision.executionPath, "cache_hit"); assert.equal(p.calls, 0); assert.equal(repository.events[0].providerRequestStarted, false); }
{ const first = await semantic.createSemanticCacheKey("test-key", "career_profile", "v1:career-profile-semantic-policy-v2", profile.payload.fields, profile.payload.contractVersion); const second = await semantic.createSemanticCacheKey("test-key", "career_profile", "v1:career-profile-semantic-policy-v3", profile.payload.fields, "career-profile-semantic-policy-v3"); assert.notEqual(first, second, "a changed policy contract must not reuse prior cache results"); }
{ const { decision, p, repository } = await run({ timeoutMs: 5 }, async () => new Promise(() => {})); assert.equal(decision.fallbackReason, "provider_timeout"); assert.equal(p.calls, 1); assert.equal(repository.events[0].providerRequestStarted, true); assert.equal(repository.events[0].providerSucceeded, false); }
{ const { decision } = await run({ mode: "shadow" }, invalid); assert.deepEqual(decision.blockedFieldKeys, []); }
{ const { decision } = await run({}, async (request) => ({ result: { results: request.fields.map((field) => ({ key: field.key, state: "uncertain", reason_code: null })) } })); assert.deepEqual(decision.blockedFieldKeys, []); }
{ const { repository } = await run({}, async (request) => valid(request, { inputTokens: 12, outputTokens: 3, totalTokens: 15 })); assert.deepEqual(repository.events[0].usage, { inputTokens: 12, outputTokens: 3, totalTokens: 15 }); }
{ const { repository } = await run({}, valid); assert.equal(repository.events[0].usage, null, "missing provider usage is unknown, never zero"); }
for (const operation of ["readConfiguration", "readCache", "consumeProviderBudget", "writeCache", "recordEvent"]) { const repository = repo({ cacheEnabled: operation === "readCache" || operation === "writeCache" }); repository[operation] = async () => new Promise(() => {}); const p = provider(valid); const started = Date.now(); await semantic.orchestrateSemanticValidation(payload, { repository, provider: p, cacheHmacSecret: "test-key" }); assert.ok(Date.now() - started < 1_000, `${operation} must be bounded`); }
await rm(dir, { recursive: true, force: true });
console.log("semantic validation phase 2 core gate: PASS");
