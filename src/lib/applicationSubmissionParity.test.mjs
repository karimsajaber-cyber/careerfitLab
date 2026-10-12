import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  isValidLongProfessionalNarrative,
  isValidPhone,
  isValidProfessionalRole,
  isValidSkillListText,
  isValidShortProfessionalDescription,
} from "./professionalDataValidation.js";

async function loadBackendParser() {
  const result = await build({
    entryPoints: [path.resolve("supabase/functions/_shared/applicationSubmission.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), "careerfit-parser-"));
  const outputPath = path.join(directory, "applicationSubmission.mjs");
  await writeFile(outputPath, result.outputFiles[0].text, "utf8");
  try {
    return await import(pathToFileURL(outputPath).href);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const backend = await loadBackendParser();
const validPayload = {
  fullName: "Karim Jaber",
  email: "karim@example.com",
  phone: "+970 59 123 4567",
  opportunityType: "first_professional_job",
  targetRole: "AI Engineer",
  targetFields: ["software_it"],
  targetFieldsOther: "",
  relevantExperience: "I worked on several Django and REST API projects.",
  strongestSkills: "Python, Django, REST APIs",
  careerChallenge: "I need clearer job targets and stronger application experience.",
  careerfitHelp: "I want support choosing roles and preparing stronger applications.",
  linkedinUrl: "",
  portfolioUrl: "",
  additionalNotes: "",
  cvStatus: "",
  changesSinceCv: "",
  privacyConsent: true,
};

const invalidCases = [
  ["targetRole", "asdwgeweg"],
  ["strongestSkills", "test test test"],
  ["relevantExperience", "randomlookingjunkwordrandomlookingjunkword"],
  ["careerChallenge", "qwerty qwerty qwerty"],
  ["careerfitHelp", "111111111111111111"],
  ["phone", "0000000"],
  ["phone", "1111111111"],
  ["phone", "1234567"],
];
const keyboardJunk = ["qwerty", "qwertyuiop", "asdf", "asdfgh", "asdwgeweg", "zxcvbn", "sdfghj", "asdasdasdasd", "abcabcabcabcabc", "test test test", "111111111", "!!!!!!!!!!!!"];
const professionalRegressionValues = [
  "Point of Sale Specialist", "Reward Operations Manager", "Trend Analyst", "Power BI Analyst", "PowerShell",
  "Property Management", "Customer Service Expert", "Software Testing", "Quality Engineer", "Research Assistant",
  "Data Entry Specialist", "Supply Chain Coordinator", "React Developer", "SAP S/4HANA Consultant", "B2B Sales",
  "3D Designer", "UI/UX Designer", ".NET Developer", "Node.js Developer", "C++ Developer",
  "point", "pointer", "pointing", "reward", "rewards", "were", "tree", "trend", "Power BI", "PowerPoint",
  "Expert", "Property Manager",
];
const narrativeRegressionValues = [
  "We were responsible for customer support.",
  "I worked with Point of Sale systems and Power BI.",
  "I have experience managing property and logistics operations.",
  "I am an expert in customer support and operations.",
  "خبرة في خدمة العملاء والمشتريات والعمل مع الموردين.",
];

assert.ok(backend.parseSubmissionPayload(validPayload, false), "backend must accept the valid English payload");
assert.ok(backend.parseSubmissionPayload({ ...validPayload, relevantExperience: "خبرة في خدمة العملاء والمشتريات والعمل مع الموردين." }, false), "backend must accept Arabic narrative");
for (const [field, value] of invalidCases) {
  const payload = { ...validPayload, [field]: value };
  assert.equal(backend.parseSubmissionPayload(payload, false), null, `backend must reject ${field}: ${value}`);
}
for (const value of keyboardJunk) {
  assert.equal(backend.parseSubmissionPayload({ ...validPayload, targetRole: value }, false), null, `backend must reject keyboard junk role: ${value}`);
  assert.equal(isValidProfessionalRole(value), false, `frontend must reject keyboard junk role: ${value}`);
}
for (const value of professionalRegressionValues) {
  assert.ok(backend.parseSubmissionPayload({ ...validPayload, targetRole: value }, false), `backend must accept professional role: ${value}`);
  assert.equal(isValidProfessionalRole(value), true, `frontend must accept professional role: ${value}`);
}
for (const value of narrativeRegressionValues) {
  assert.ok(backend.parseSubmissionPayload({ ...validPayload, relevantExperience: value }, false), `backend must accept narrative: ${value}`);
  assert.equal(isValidLongProfessionalNarrative(value, 20), true, `frontend must accept narrative: ${value}`);
}
for (const [field, value] of [["additionalNotes", "No preference"], ["additionalNotes", "غير متاح"], ["changesSinceCv", "Added Python"], ["changesSinceCv", "تم تحديث السيرة"]]) {
  assert.ok(backend.parseSubmissionPayload({ ...validPayload, [field]: value }, false), `backend must accept concise ${field}: ${value}`);
  assert.equal(isValidShortProfessionalDescription(value), true, `frontend must accept concise ${field}: ${value}`);
}
for (const [field, value] of [["additionalNotes", "test test test"], ["changesSinceCv", "111111111"]]) {
  assert.equal(backend.parseSubmissionPayload({ ...validPayload, [field]: value }, false), null, `backend must reject junk ${field}: ${value}`);
}
for (const field of ["relevantExperience", "careerChallenge", "careerfitHelp"]) {
  assert.equal(backend.parseSubmissionPayload({ ...validPayload, [field]: "New job" }, false), null, `backend must retain three-token rule for ${field}`);
}

assert.equal(isValidProfessionalRole("AI Engineer"), true);
assert.equal(isValidProfessionalRole("asdwgeweg"), false);
assert.equal(isValidSkillListText("Python, Django, REST APIs"), true);
assert.equal(isValidSkillListText("test test test"), false);
assert.equal(isValidLongProfessionalNarrative(validPayload.relevantExperience, 20), true);
assert.equal(isValidLongProfessionalNarrative("randomlookingjunkwordrandomlookingjunkword", 20), false);
assert.equal(isValidPhone(validPayload.phone), true);
for (const value of ["0000000", "1111111111", "1234567"]) assert.equal(isValidPhone(value), false);

console.log("application parser parity: PASS");
