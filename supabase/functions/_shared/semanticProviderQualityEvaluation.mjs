import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SEMANTIC_PROVIDER_EVALUATION_SCENARIOS = [
  {
    id: "valid_arabic",
    candidate: {
      professionalSummary: "خريج هندسة حاسوب مهتم بتطوير حلول رقمية عملية وتحسين تجربة المستخدم.",
      targetRoles: ["مطور برمجيات"],
      skills: ["Python", "SQL", "تحليل المتطلبات"],
      experienceSummary: "طورت مشاريع ويب جامعية وتعاونت مع فريق صغير لتنظيم المتطلبات واختبار الحلول.",
      educationSummary: "حاصل على بكالوريوس في هندسة الحاسوب وأكملت تدريبًا عمليًا في تطوير الويب.",
    },
    expectations: ["professionalSummary", "targetRoles", "skills", "experienceSummary", "educationSummary"].map((field) => ({ id: `valid_arabic_${field}`, field, expected: ["valid"] })),
  },
  {
    id: "valid_english",
    candidate: {
      professionalSummary: "Business graduate focused on practical operations, customer support, and data analysis roles.",
      targetRoles: ["Operations Coordinator"],
      skills: ["Excel", "Customer Support", "Data Analysis"],
      experienceSummary: "Managed customer requests, organized records, and prepared weekly operational reports.",
      educationSummary: "Bachelor's degree in Business Administration with a practical data analytics course.",
    },
    expectations: ["professionalSummary", "targetRoles", "skills", "experienceSummary", "educationSummary"].map((field) => ({ id: `valid_english_${field}`, field, expected: ["valid"] })),
  },
  {
    id: "valid_mixed_technical",
    candidate: {
      professionalSummary: "مطور برمجيات يهتم ببناء حلول B2B وتحسين جودة المنتجات الرقمية.",
      targetRoles: [".NET Software Developer", "Power BI Analyst"],
      skills: ["Python", "Django", ".NET", "QA", "ORM", "SQL", "Power BI", "SAP S/4HANA", "C++", "B2B"],
      experienceSummary: "Worked on web applications باستخدام Python وDjango، وساهمت في QA وتحليل متطلبات العملاء.",
      educationSummary: "حاصل على بكالوريوس في التكنولوجيا الحيوية، وأكملت تدريبًا في تطوير البرمجيات Full-Stack.",
    },
    expectations: [
      { id: "valid_mixed_technical_professionalSummary", field: "professionalSummary", expected: ["valid"] },
      { id: "valid_mixed_technical_targetRoles", field: "targetRoles", expected: ["valid"] },
      { id: "valid_mixed_technical_skills", field: "skills", expected: ["valid"] },
      { id: "valid_mixed_technical_experienceSummary", field: "experienceSummary", expected: ["valid"] },
      { id: "education_ar_mixed_regression", field: "educationSummary", expected: ["valid"] },
    ],
  },
  {
    id: "short_legitimate_professional",
    candidate: {
      professionalSummary: "QA and HR professional supporting reliable teams.",
      targetRoles: [".NET Developer", "C++ Developer", "Power BI Analyst"],
      skills: ["QA", "HR", "AI", "SQL", "ORM"],
      experienceSummary: "Supported QA checks, HR coordination, and SQL reporting for internal projects.",
      educationSummary: "Completed technical courses in software quality and data reporting.",
    },
    expectations: ["professionalSummary", "targetRoles", "skills", "experienceSummary", "educationSummary"].map((field) => ({ id: `short_legitimate_professional_${field}`, field, expected: ["valid"] })),
  },
  {
    id: "non_traditional_education",
    candidate: {
      professionalSummary: "Entry-level web developer focused on practical project delivery.",
      targetRoles: ["Full-Stack Developer"],
      skills: ["JavaScript", "React", "Git"],
      experienceSummary: "Built portfolio projects and volunteered to maintain a local community website.",
      educationSummary: "Completed a Full-Stack bootcamp, a cloud certification, and vocational web development training.",
    },
    expectations: ["professionalSummary", "targetRoles", "skills", "experienceSummary", "educationSummary"].map((field) => ({ id: `non_traditional_education_${field}`, field, expected: ["valid"] })),
  },
  {
    id: "minor_human_imperfections",
    candidate: {
      professionalSummary: "Data analyst who enjoys turning messy reports into clear insights..",
      targetRoles: ["Data Analyst"],
      skills: ["sql", "Excel", "Power BI"],
      experienceSummary: "I build report dashboards and help teams understand there data, with care.",
      educationSummary: "Completed  a data analytics course, and practical reporting labs.",
    },
    expectations: ["professionalSummary", "targetRoles", "skills", "experienceSummary", "educationSummary"].map((field) => ({ id: `minor_human_imperfections_${field}`, field, expected: ["valid"] })),
  },
  {
    id: "plausible_ambiguous",
    candidate: {
      professionalSummary: "Professional exploring a broader career direction.",
      targetRoles: ["Technology or operations"],
      skills: ["Communication", "Excel"],
      experienceSummary: "Supported projects, coordinated tasks, and learned from practical team work.",
      educationSummary: "Completed professional training in business operations.",
    },
    expectations: [
      { id: "plausible_ambiguous_professionalSummary", field: "professionalSummary", expected: ["valid"] },
      { id: "plausible_ambiguous_targetRoles", field: "targetRoles", classification: "calibration" },
      { id: "plausible_ambiguous_skills", field: "skills", expected: ["valid"] },
      { id: "plausible_ambiguous_experienceSummary", field: "experienceSummary", expected: ["valid"] },
      { id: "plausible_ambiguous_educationSummary", field: "educationSummary", expected: ["valid"] },
    ],
  },
  {
    id: "clear_nonsense",
    candidate: {
      professionalSummary: "qwertyuiop asdasdasdasd",
      targetRoles: ["Software Engineer"],
      skills: ["SQL", "Git"],
      experienceSummary: "Built small web projects and documented feature requirements.",
      educationSummary: "Completed a software development course.",
    },
    expectations: [
      { id: "clear_nonsense_professionalSummary", field: "professionalSummary", expected: ["invalid"] },
      { id: "clear_nonsense_targetRoles", field: "targetRoles", expected: ["valid"] },
      { id: "clear_nonsense_skills", field: "skills", expected: ["valid"] },
      { id: "clear_nonsense_experienceSummary", field: "experienceSummary", expected: ["valid"] },
      { id: "clear_nonsense_educationSummary", field: "educationSummary", expected: ["valid"] },
    ],
  },
  {
    id: "placeholder_test_content",
    candidate: {
      professionalSummary: "Junior operations professional interested in organized service delivery.",
      targetRoles: ["Operations Assistant"],
      skills: ["Excel", "Customer Service"],
      experienceSummary: "test test test",
      educationSummary: "Completed a customer service training program.",
    },
    expectations: [
      { id: "placeholder_test_content_professionalSummary", field: "professionalSummary", expected: ["valid"] },
      { id: "placeholder_test_content_targetRoles", field: "targetRoles", expected: ["valid"] },
      { id: "placeholder_test_content_skills", field: "skills", expected: ["valid"] },
      { id: "placeholder_test_content_experienceSummary", field: "experienceSummary", expected: ["invalid"] },
      { id: "placeholder_test_content_educationSummary", field: "educationSummary", expected: ["valid"] },
    ],
  },
  {
    id: "wrong_field_context_interaction",
    candidate: {
      professionalSummary: "Customer support professional improving service processes and response quality.",
      targetRoles: ["Customer Support Specialist"],
      skills: ["CRM", "Communication", "Excel"],
      experienceSummary: "Handled customer requests, documented recurring issues, and shared practical improvements.",
      educationSummary: "I enjoy watching football every weekend.",
    },
    expectations: [
      { id: "wrong_field_context_professionalSummary", field: "professionalSummary", expected: ["valid"] },
      { id: "wrong_field_context_targetRoles", field: "targetRoles", expected: ["valid"] },
      { id: "wrong_field_context_skills", field: "skills", expected: ["valid"] },
      { id: "wrong_field_context_experienceSummary", field: "experienceSummary", expected: ["valid"] },
      { id: "wrong_field_context_educationSummary", field: "educationSummary", expected: ["invalid"] },
    ],
  },
];

export const MAX_PROVIDER_REQUESTS_PER_EVALUATION = 10;

export const SEMANTIC_PROVIDER_EVALUATION_CASES =
  SEMANTIC_PROVIDER_EVALUATION_SCENARIOS.flatMap((scenario) =>
    scenario.expectations.map((expectation) => ({ ...expectation, scenarioId: scenario.id })),
  );

export const HARD_SEMANTIC_PROVIDER_EVALUATION_CASES =
  SEMANTIC_PROVIDER_EVALUATION_CASES.filter(
    (evaluationCase) => evaluationCase.classification !== "calibration",
  );

export const CALIBRATION_SEMANTIC_PROVIDER_EVALUATION_CASES =
  SEMANTIC_PROVIDER_EVALUATION_CASES.filter(
    (evaluationCase) => evaluationCase.classification === "calibration",
  );

export function isExpectedState(evaluationCase, actualState) {
  return evaluationCase.expected.includes(actualState);
}

export function classifyEvaluationResult(evaluationCase, actualState) {
  if (evaluationCase.classification === "calibration") {
    return {
      classification: "calibration",
      invalidViolation: actualState === "invalid",
      hardPassed: null,
    };
  }
  return {
    classification: "hard",
    invalidViolation: false,
    hardPassed: isExpectedState(evaluationCase, actualState),
  };
}

export function createEvaluationConfiguration(defaultConfiguration) {
  return {
    ...defaultConfiguration,
    mode: "shadow",
    careerProfileEnabled: true,
    cacheEnabled: false,
    timeoutMs: 6000,
  };
}

export async function loadProductionSemanticModules() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const directory = await mkdtemp(path.join(os.tmpdir(), "careerfit-semantic-eval-"));
  const entry = path.join(directory, "entry.mjs");
  const output = path.join(directory, "production-semantic.mjs");
  const semanticPath = path.join(root, "supabase/functions/_shared/semanticValidation.ts");
  const providerPath = path.join(root, "supabase/functions/_shared/semanticValidationOpenAI.ts");

  await writeFile(entry, `export * from ${JSON.stringify(semanticPath)}; export { createOpenAISemanticProvider } from ${JSON.stringify(providerPath)};`, "utf8");
  const bundled = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", target: "node20", write: false });
  await writeFile(output, bundled.outputFiles[0].text, "utf8");

  return {
    modules: await import(pathToFileURL(output).href),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function evaluationRepository(configuration) {
  return {
    async readConfiguration() { return configuration; },
    async readCache() { return null; },
    async writeCache() {},
    async consumeProviderBudget() { return { allowed: true }; },
    async recordEvent() {},
  };
}

export async function evaluateScenario({ modules, scenario, configuration, provider }) {
  const payload = modules.buildSemanticPayload("career_profile", scenario.candidate);
  if (!payload.ok) {
    return scenario.expectations.map((expectation) => ({
      ...expectation,
      actualState: "contract_error",
      ...classifyEvaluationResult(expectation, "contract_error"),
    }));
  }

  const decision = await modules.orchestrateSemanticValidation(payload, {
    repository: evaluationRepository(configuration),
    provider,
    cacheHmacSecret: undefined,
  });
  return scenario.expectations.map((expectation) => {
    const actualState = decision.results.find((result) => result.key === expectation.field)?.state || "error";
    return {
      ...expectation,
      actualState,
      ...classifyEvaluationResult(expectation, actualState),
    };
  });
}

export async function runSemanticProviderEvaluation() {
  const apiKey = process.env.SEMANTIC_VALIDATION_API_KEY;
  if (!apiKey) {
    console.error("ERROR | missing SEMANTIC_VALIDATION_API_KEY");
    process.exitCode = 1;
    return;
  }

  const { modules, cleanup } = await loadProductionSemanticModules();
  let hardPassed = 0;
  let hardFailed = 0;
  const calibration = [];

  try {
    const configuration = createEvaluationConfiguration(
      modules.DEFAULT_SEMANTIC_VALIDATION_CONFIGURATION,
    );
    const provider = modules.createOpenAISemanticProvider(apiKey);

    console.log("HARD SCORE");
    for (const scenario of SEMANTIC_PROVIDER_EVALUATION_SCENARIOS) {
      const results = await evaluateScenario({ modules, scenario, configuration, provider });
      for (const result of results) {
        if (result.classification === "calibration") {
          calibration.push(result);
          continue;
        }
        if (result.hardPassed) hardPassed += 1;
        else hardFailed += 1;
        console.log(`${result.id} | ${result.field} | ${result.actualState} | ${result.expected.join("/")} | ${result.hardPassed ? "PASS" : "FAIL"}`);
      }
    }
    console.log(`HARD SUMMARY | ${hardPassed}/${HARD_SEMANTIC_PROVIDER_EVALUATION_CASES.length} PASS | ${hardFailed} FAIL`);
    console.log("CALIBRATION DIAGNOSTICS");
    for (const result of calibration) {
      console.log(`${result.invalidViolation ? "CALIBRATION VIOLATION" : "CALIBRATION"} | ${result.id} | actual=${result.actualState} | invalid_violation=${result.invalidViolation}`);
    }
    const calibrationCounts = calibration.reduce((counts, result) => {
      counts[result.actualState] = (counts[result.actualState] || 0) + 1;
      return counts;
    }, { valid: 0, uncertain: 0, invalid: 0 });
    const calibrationViolations = calibration.filter((result) => result.invalidViolation).length;
    console.log(`CALIBRATION SUMMARY | ${calibration.length} case | valid=${calibrationCounts.valid} | uncertain=${calibrationCounts.uncertain} | invalid=${calibrationCounts.invalid} | violations=${calibrationViolations}`);
    if (hardFailed || calibrationViolations) process.exitCode = 1;
  } catch {
    console.error("ERROR | provider evaluation unavailable");
    process.exitCode = 1;
  } finally {
    await cleanup();
  }

}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runSemanticProviderEvaluation();
}
