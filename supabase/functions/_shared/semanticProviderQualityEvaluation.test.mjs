import assert from "node:assert/strict";
import {
  CALIBRATION_SEMANTIC_PROVIDER_EVALUATION_CASES,
  HARD_SEMANTIC_PROVIDER_EVALUATION_CASES,
  MAX_PROVIDER_REQUESTS_PER_EVALUATION,
  SEMANTIC_PROVIDER_EVALUATION_CASES,
  SEMANTIC_PROVIDER_EVALUATION_SCENARIOS,
  classifyEvaluationResult,
  createEvaluationConfiguration,
  evaluateScenario,
  isExpectedState,
  loadProductionSemanticModules,
} from "./semanticProviderQualityEvaluation.mjs";

const careerProfileKeys = ["educationSummary", "experienceSummary", "professionalSummary", "skills", "targetRoles"];
const expectedStates = new Set(["valid", "invalid", "uncertain"]);
assert.equal(SEMANTIC_PROVIDER_EVALUATION_SCENARIOS.length, 10);
assert.equal(MAX_PROVIDER_REQUESTS_PER_EVALUATION, 10);
assert.equal(SEMANTIC_PROVIDER_EVALUATION_SCENARIOS.length <= MAX_PROVIDER_REQUESTS_PER_EVALUATION, true);
assert.equal(SEMANTIC_PROVIDER_EVALUATION_CASES.length, 50);
assert.equal(HARD_SEMANTIC_PROVIDER_EVALUATION_CASES.length, 49);
assert.equal(CALIBRATION_SEMANTIC_PROVIDER_EVALUATION_CASES.length, 1);
assert.equal(new Set(SEMANTIC_PROVIDER_EVALUATION_SCENARIOS.map((scenario) => scenario.id)).size, 10, "scenario IDs must be unique");
assert.equal(new Set(SEMANTIC_PROVIDER_EVALUATION_CASES.map((item) => item.id)).size, 50, "scored assertion IDs must be unique");
assert.ok(HARD_SEMANTIC_PROVIDER_EVALUATION_CASES.every((item) => item.expected.length === 1 && item.expected.every((state) => expectedStates.has(state))));
assert.equal(
  SEMANTIC_PROVIDER_EVALUATION_SCENARIOS.find((scenario) => scenario.id === "valid_mixed_technical").candidate.educationSummary,
  "حاصل على بكالوريوس في التكنولوجيا الحيوية، وأكملت تدريبًا في تطوير البرمجيات Full-Stack.",
);
assert.deepEqual(
  SEMANTIC_PROVIDER_EVALUATION_CASES.find((item) => item.id === "education_ar_mixed_regression"),
  { id: "education_ar_mixed_regression", field: "educationSummary", expected: ["valid"], scenarioId: "valid_mixed_technical" },
);
assert.ok(SEMANTIC_PROVIDER_EVALUATION_CASES.some((item) => item.id === "clear_nonsense_professionalSummary" && item.expected.includes("invalid")));
assert.ok(SEMANTIC_PROVIDER_EVALUATION_CASES.some((item) => item.id === "placeholder_test_content_experienceSummary" && item.expected.includes("invalid")));
assert.ok(SEMANTIC_PROVIDER_EVALUATION_CASES.some((item) => item.id === "wrong_field_context_educationSummary" && item.expected.includes("invalid")));
const ambiguousScenario = SEMANTIC_PROVIDER_EVALUATION_SCENARIOS.find((scenario) => scenario.id === "plausible_ambiguous");
const ambiguousTargetRoleExpectation = SEMANTIC_PROVIDER_EVALUATION_CASES.find((item) => item.id === "plausible_ambiguous_targetRoles");
assert.deepEqual(ambiguousScenario.candidate.targetRoles, ["Technology or operations"]);
assert.equal(ambiguousTargetRoleExpectation.classification, "calibration");
assert.equal(HARD_SEMANTIC_PROVIDER_EVALUATION_CASES.includes(ambiguousTargetRoleExpectation), false);
assert.equal(CALIBRATION_SEMANTIC_PROVIDER_EVALUATION_CASES.includes(ambiguousTargetRoleExpectation), true);
for (const observedState of ["valid", "uncertain"]) {
  const result = classifyEvaluationResult(ambiguousTargetRoleExpectation, observedState);
  assert.equal(result.classification, "calibration");
  assert.equal(result.hardPassed, null);
  assert.equal(result.invalidViolation, false);
}
assert.equal(classifyEvaluationResult(ambiguousTargetRoleExpectation, "invalid").invalidViolation, true);

for (const scenario of SEMANTIC_PROVIDER_EVALUATION_SCENARIOS) {
  assert.ok(scenario.id);
  assert.equal(scenario.expectations.length, 5);
  assert.equal("surface" in scenario, false, "evaluation scenarios must not introduce an Application surface dependency");
  assert.deepEqual(Object.keys(scenario.candidate).sort(), careerProfileKeys);
}
const fixtures = JSON.stringify(SEMANTIC_PROVIDER_EVALUATION_SCENARIOS);
assert.match(fixtures, /[\u0600-\u06ff]/, "valid Arabic coverage is required");
assert.match(fixtures, /Business graduate/, "valid English coverage is required");
assert.match(fixtures, /استخدام Python|using Python|Worked on web applications/, "valid mixed-language coverage is required");
assert.match(fixtures, /SAP S\/4HANA/, "short technical coverage is required");
assert.match(fixtures, /bootcamp|certification|vocational/i, "non-traditional education coverage is required");
assert.match(fixtures, /there data|\.\./, "minor human imperfection coverage is required");
assert.doesNotMatch(fixtures, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, "fixtures must not contain email addresses");
assert.doesNotMatch(fixtures, /\b\d{7,}\b/, "fixtures must not contain phone-like values");
assert.equal(isExpectedState(SEMANTIC_PROVIDER_EVALUATION_CASES[0], "valid"), true);
assert.equal(isExpectedState(SEMANTIC_PROVIDER_EVALUATION_CASES[0], "invalid"), false);

const { modules, cleanup } = await loadProductionSemanticModules();
try {
  const configuration = createEvaluationConfiguration(
    modules.DEFAULT_SEMANTIC_VALIDATION_CONFIGURATION,
  );
  assert.equal(configuration.timeoutMs, 6000, "evaluation timeout must not fall back to the 2500 ms default");
  for (const scenario of SEMANTIC_PROVIDER_EVALUATION_SCENARIOS) {
    const payload = modules.buildSemanticPayload("career_profile", scenario.candidate);
    assert.equal(payload.ok, true, `${scenario.id} must build through the production field-policy path`);
    assert.equal(payload.payload.surface, "career_profile");
    assert.deepEqual(payload.payload.fields.map((field) => field.key).sort(), careerProfileKeys);
    assert.equal(payload.payload.fields.every((field) => field.policy), true, `${scenario.id} must receive production field policies`);
  }
  let providerCalls = 0;
  const firstScenario = SEMANTIC_PROVIDER_EVALUATION_SCENARIOS[0];
  const fakeProvider = {
    async validate(request) {
      providerCalls += 1;
      return { result: { results: request.fields.map((field) => ({ key: field.key, state: "valid", reason_code: null })) } };
    },
  };
  const results = await evaluateScenario({ modules, scenario: firstScenario, configuration, provider: fakeProvider });
  assert.equal(providerCalls, 1, "one full-profile scenario must issue no more than one provider request");
  assert.equal(results.length, 5);
} finally {
  await cleanup();
}

console.log("semantic provider quality evaluation harness: PASS");
