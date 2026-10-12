import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");

const [handler, migration, cleanup, adminDelete] = await Promise.all([
  read("supabase/functions/submit-application/index.ts"),
  read("supabase/application_submission_registry_review.sql"),
  read("supabase/application_test_data_cleanup_review.sql"),
  read("supabase/admin_delete_application_review.sql"),
]);

const registryPreflight = handler.indexOf('if (await findSubmissionRegistry(admin, identity.userId, identity.email))');
const applicantMutation = handler.indexOf('.from("applicants")\n        .insert(');
const profileMutation = handler.indexOf('admin.from("applicant_profiles").upsert');
const registryCreate = handler.indexOf('createdSubmissionRegistryId = await createSubmissionRegistry(');
const atomicCreate = handler.lastIndexOf('createApplicationWithSubmissionRegistry(admin, applicantId, identity.userId');
const draftFinalize = handler.indexOf('admin.rpc("finalize_application_draft"');
const rollbackCall = handler.indexOf('const rollbackResult = await rollbackCreatedApplication');
const registryRollback = handler.lastIndexOf('await removeCreatedSubmissionRegistry(admin, createdApplicationId, createdSubmissionRegistryId)');

assert.ok(registryPreflight >= 0, "the handler must check durable submission history");
assert.ok(registryPreflight < applicantMutation, "history is checked before applicant creation");
assert.ok(registryPreflight < profileMutation, "history is checked before profile mutation");
assert.equal(registryCreate, -1, "the handler must not create registry rows directly");
assert.ok(registryPreflight < atomicCreate, "history is checked before atomic application creation");
assert.ok(atomicCreate > profileMutation, "the atomic RPC follows profile persistence");
assert.ok(atomicCreate < draftFinalize, "draft finalization cannot consume a draft before atomic creation succeeds");
assert.match(handler, /\.rpc\("create_application_with_submission_registry"/);
assert.match(handler, /\.rpc\("rollback_application_submission_registry"/);
assert.doesNotMatch(handler, /p_email_hash/);
assert.doesNotMatch(handler, /from\("applications"\)\s*\.insert\(/);
assert.ok(rollbackCall >= 0 && registryRollback > rollbackCall, "registry cleanup follows application rollback confirmation");
assert.ok(handler.includes('if (!rollbackResult.applicationDeleted)'), "uncertain application rollback fails closed");

assert.match(migration, /alter table public\.application_submission_registry enable row level security/i);
assert.match(migration, /revoke all on table public\.application_submission_registry from public, anon, authenticated/i);
assert.match(migration, /grant select on table public\.application_submission_registry to service_role/i);
assert.doesNotMatch(migration, /grant .*delete.* on table public\.application_submission_registry to service_role/i);
assert.match(migration, /create unique index if not exists applications_one_per_applicant_idx\s+on public\.applications \(applicant_id\)/i);
assert.match(migration, /duplicate applications per applicant exist/i);
assert.match(migration, /email_hash text not null unique/i);
assert.match(migration, /auth_user_id uuid unique/i);
assert.match(migration, /first_application_id uuid not null unique/i);
assert.match(migration, /create or replace function public\.create_application_with_submission_registry/i);
assert.match(migration, /insert into public\.applications[\s\S]*insert into public\.application_submission_registry/i);
assert.doesNotMatch(migration, /p_email_hash/);
assert.match(migration, /select lower\(btrim\(a\.email\)\)\s+into v_email/i);
assert.match(migration, /v_email_hash := encode\(extensions\.digest\(v_email, 'sha256'\), 'hex'\)/i);
assert.match(migration, /create or replace function public\.rollback_application_submission_registry/i);
assert.match(migration, /from public\.applications ap\s+where ap\.id = p_application_id[\s\S]*return false/i);
assert.match(migration, /where r\.id = p_registry_id\s+and r\.first_application_id = p_application_id/i);
assert.match(migration, /where r\.email_hash = v_email_hash\s+or r\.auth_user_id = v_user_id/i);
assert.match(migration, /return 'legacy_identity_conflict'/i);
assert.match(migration, /return 'identity_conflict'/i);
assert.match(migration, /Only disposable test identities may be reset/i);
assert.match(migration, /example\\\\\.test\|test\\\\\.invalid/i);

assert.doesNotMatch(cleanup, /delete from public\.application_submission_registry/i);
assert.doesNotMatch(adminDelete, /application_submission_registry/i);

console.log("application submission registry contract tests passed");
