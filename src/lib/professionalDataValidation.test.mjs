import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isValidCareerConstraint,
  isValidEducationNarrative,
  isValidLongProfessionalNarrative,
  isValidLocation,
  isValidPersonName,
  isValidPhone,
  isValidProfessionalRole,
  isValidSkill,
  isValidSkillListText,
  isValidShortProfessionalDescription,
} from "./professionalDataValidation.js";
import { applyCareerProfileSeed, deriveProfileSkills, seedEmptyCareerProfile } from "./careerProfileSeed.js";

const rejects = ["qwerty", "qwertyuiop", "asdf", "asdfgh", "asdwgeweg", "zxcvbn", "sdfghj", "asdasdasdasd", "abcabcabcabcabc", "test test test", "111111111", "!!!!!!!!!!!!", "asdasdasdasdasdasdasdasdasd", "aaaaabaaaaabaaaaab"];
for (const value of rejects) {
  assert.equal(isValidProfessionalRole(value), false, `role must reject ${value}`);
  assert.equal(isValidSkill(value), false, `skill must reject ${value}`);
  assert.equal(isValidLongProfessionalNarrative(`${value} ${value} ${value}`, 15), false, `narrative must reject ${value}`);
}

for (const value of ["asdwgeweg", "mnbvcxlkjhgfd", "plmoknijbuhvyg", "abcdefghijklmnop", "randomlookingjunkwordrandomlookingjunkword", "abcabcabcabcabc", "test test test", "111111111", "!!!!!!!!!!!!"]) {
  assert.equal(isValidLongProfessionalNarrative(value, 1), false, `narrative must reject long junk: ${value}`);
}

for (const value of ["QA", "HR", "AI Engineer", "UX Designer"]) {
  assert.equal(isValidProfessionalRole(value), true, `role must accept ${value}`);
}
for (const value of [
  "Point of Sale Specialist",
  "Reward Operations Manager",
  "Trend Analyst",
  "Power BI Analyst",
  "PowerShell",
  "Property Management",
  "Customer Service Expert",
  "Software Testing",
  "Quality Engineer",
  "Research Assistant",
  "Data Entry Specialist",
  "Supply Chain Coordinator",
  "React Developer",
  "SAP S/4HANA Consultant",
  "B2B Sales",
  "3D Designer",
  "UI/UX Designer",
  ".NET Developer",
  "Node.js Developer",
  "C++ Developer",
  "point",
  "pointer",
  "pointing",
  "reward",
  "rewards",
  "were",
  "tree",
  "trend",
  "Power BI",
  "PowerPoint",
  "Expert",
  "Property Manager",
]) {
  assert.equal(isValidProfessionalRole(value), true, `role must accept legitimate keyboard-prefix text: ${value}`);
}
for (const value of ["SQL", "QA", "AI"]) {
  assert.equal(isValidSkill(value), true, `skill must accept ${value}`);
}
for (const value of ["QA", "HR", "AI", "SQL", "UX Designer", "AI Engineer", "Python, Django, REST APIs"]) {
  assert.equal(isValidSkillListText(value), true, `skill list must accept ${value}`);
}
for (const value of ["We were responsible for customer support.", "I worked with Point of Sale systems and Power BI.", "I worked on several Django and REST API projects.", "I work with Power BI and Excel.", "I am an expert in customer support and operations.", "I have experience managing property and logistics operations.", "خبرة في خدمة العملاء والمشتريات والعمل مع الموردين.", "أبحث عن فرصة أفضل في مجال تطوير البرمجيات والعمل عن بعد."]) {
  assert.equal(isValidLongProfessionalNarrative(value, 15), true, `narrative must accept ${value}`);
}
for (const value of ["No preference", "غير متاح", "Added Python", "تم تحديث السيرة"]) {
  assert.equal(isValidShortProfessionalDescription(value), true, `short description must accept ${value}`);
}
for (const value of ["New job", "Updated CV"]) {
  assert.equal(isValidLongProfessionalNarrative(value, 1), false, `main narrative must require three tokens: ${value}`);
}
assert.equal(isValidProfessionalRole("asdwgeweg"), false, "Application target role must reject junk input");
assert.equal(isValidProfessionalRole("AI Engineer"), true, "Application target role must accept a corrected professional role");
assert.equal(isValidLongProfessionalNarrative("test test test", 20), false, "Application narratives must reject placeholder text");
assert.equal(isValidLongProfessionalNarrative("I completed customer support training and handled client requests.", 20), true, "Application narratives must accept corrected professional text");
assert.equal(isValidEducationNarrative("Bachelor degree in business administration and practical logistics training."), true, "Career Profile education must accept meaningful text");
assert.equal(isValidEducationNarrative("asdfgh"), false, "Career Profile education must reject keyboard junk");
assert.equal(isValidLocation("Ramallah"), true, "Career Profile location must accept a real location");
assert.equal(isValidLocation("qwerty"), false, "Career Profile location must reject keyboard junk");
assert.equal(isValidCareerConstraint("Remote work preferred"), true, "Career Profile constraints must accept meaningful preferences");
assert.equal(isValidCareerConstraint("test test test"), false, "Career Profile constraints must reject placeholders");

const applicationSource = await readFile(new URL("../components/ApplicationForm.jsx", import.meta.url), "utf8");
const careerProfileSource = await readFile(new URL("../components/CareerProfile.jsx", import.meta.url), "utf8");
assert.match(careerProfileSource, /if \(!data\) \{/);
assert.doesNotMatch(careerProfileSource, /Object\.keys\(loadedData\)\.length === 0/);
assert.match(careerProfileSource, /setProfileMode\(data \? "view" : "create"\)/);
assert.match(careerProfileSource, /setActionError\(copy\.validationNotice\)/);
for (const message of [
  "clear professional role or job title",
  "real, clear professional field of up to 100 characters",
  "Enter a clear answer of at least 20 characters using several meaningful words",
  "Enter real, clear skills or strengths",
  "Describe a real current career challenge",
  "Describe a clear outcome you want CareerFit to help with",
  "اكتب مسمى وظيفياً أو دوراً مهنياً واضحاً",
]) {
  assert.ok(applicationSource.includes(message), `Application source must contain semantic validation copy: ${message}`);
}
assert.match(
  applicationSource,
  /renderTextField\("phone", "رقم الهاتف", "Phone", false, "tel"\)/u,
  "Phone must remain visibly required while retaining its tel input type",
);
assert.equal(isValidProfessionalRole("asdwgeweg"), false, "Other target field must reject professional junk");
assert.equal(isValidProfessionalRole("Cybersecurity"), true, "Other target field must accept a real professional field");
for (const message of [
  "Write a clear professional summary",
  "Write a clear experience summary",
  "Write a clear education or training summary",
  "اكتب نبذة مهنية واضحة",
  "اكتب ملخص خبرة واضحاً",
  "اكتب ملخص تعليم أو تدريب واضحاً",
]) {
  assert.ok(careerProfileSource.includes(message), `Career Profile source must contain semantic validation copy: ${message}`);
}
const removeItemImplementation = careerProfileSource.match(/const removeItem = \(field, value\) => \{[\s\S]*?\n  \};/u)?.[0] || "";
assert.match(removeItemImplementation, /const nextProfile = \{ \.\.\.profile, \[field\]: profile\[field\]\.filter/u, "Removing an item must calculate the next profile before validation");
assert.match(removeItemImplementation, /if \(touchedFields\[field\] \|\| hasSaveAttempted\)/u, "Removing an item must revalidate touched or submitted fields");
assert.match(removeItemImplementation, /validateProfile\(nextProfile\)/u, "Removing an item must validate the next profile state, not stale React state");
assert.equal(isValidPersonName("كريم جابر"), true);
assert.equal(isValidPersonName("Trevor Reed"), true);
for (const value of ["0000000", "1111111111", "1234567"]) assert.equal(isValidPhone(value), false, `phone must reject ${value}`);
for (const value of ["+970 59 123 4567", "(059) 123-4567"]) assert.equal(isValidPhone(value), true, `phone must accept ${value}`);

const seed = seedEmptyCareerProfile({ target_role: "AI Engineer", relevant_experience: "I worked on several Django and REST API projects.", strongest_skills: "Python, Django, REST APIs" });
assert.deepEqual(seed.targetRoles, ["AI Engineer"]);
assert.equal(seed.experienceSummary, "I worked on several Django and REST API projects.");
assert.deepEqual(seed.skills, ["Python", "Django", "REST APIs"]);
assert.deepEqual(deriveProfileSkills("I enjoy Python and Django projects with my team."), []);
const existing = { targetRoles: ["UX Designer"], skills: ["Figma"], experienceSummary: "Existing profile data" };
assert.equal(applyCareerProfileSeed(existing, { target_role: "AI Engineer" }, true), existing);

console.log("professional data validation: PASS");
