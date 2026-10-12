import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidCv, parseSubmissionPayload } from "../_shared/applicationSubmission.ts";
import { semanticFieldErrors, validateApplicationSemanticPayload } from "../_shared/semanticValidationRuntime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_DIRECT_PAYLOAD_BYTES = 24 * 1024;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function errorResponse(error: string, status: number) {
  return response({ ok: false, error }, status);
}

function logDiagnostic(stage: string) {
  console.log(`submit-application diagnostic: ${stage}`);
}

function logSafeErrorDiagnostic(context: string, error: unknown) {
  const diagnostic: Record<string, string> = { context };
  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    for (const key of ["code", "message", "details", "hint"]) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim()) {
        diagnostic[key] = value.trim().slice(0, 500);
      }
    }
  }
  console.error("submit-application error diagnostic", diagnostic);
}

async function authenticateRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser(token);
  const email = normalizeEmail(data.user?.email);
  if (error || !data.user || !data.user.email_confirmed_at || !email) return null;

  return { userId: data.user.id, email };
}

type DraftClaim = {
  draft_id: string;
  claim_id: string;
  payload: Record<string, unknown>;
};

type DraftClaimFailure =
  | "draft_not_found_or_expired"
  | "verified_email_mismatch"
  | "draft_already_claimed_or_unavailable"
  | "claim_rpc_failure"
  | "unexpected_claim_result";

type DraftClaimResult =
  | { claim: DraftClaim; error: null }
  | { claim: null; error: DraftClaimFailure };

type RollbackResult = {
  applicationDeleted: boolean;
  cvCleanupSucceeded: boolean;
};

type SubmissionRegistryRow = {
  id: string;
};

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashNormalizedEmail(email: string) {
  return hashToken(email);
}

async function findSubmissionRegistry(
  admin: ReturnType<typeof createClient>,
  userId: string,
  normalizedEmail: string,
) {
  const emailHash = await hashNormalizedEmail(normalizedEmail);
  const { data: emailRegistry, error: emailRegistryError } = await admin
    .from("application_submission_registry")
    .select("id")
    .eq("email_hash", emailHash)
    .maybeSingle();
  if (emailRegistryError) throw emailRegistryError;
  if (emailRegistry) return emailRegistry as SubmissionRegistryRow;

  const { data: userRegistry, error: userRegistryError } = await admin
    .from("application_submission_registry")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (userRegistryError) throw userRegistryError;
  return userRegistry as SubmissionRegistryRow | null;
}

type CreatedApplication = {
  application_id: string;
  registry_id: string;
  submitted_at: string;
};

async function createApplicationWithSubmissionRegistry(
  admin: ReturnType<typeof createClient>,
  applicantId: string,
  userId: string,
  applicationFields: {
    motivation: string;
    strongestSkills: string;
    careerChallenge: string;
    portfolioUrl: string;
    additionalNotes: string;
  },
) {
  const { data, error } = await admin
    .rpc("create_application_with_submission_registry", {
      p_applicant_id: applicantId,
      p_auth_user_id: userId,
      p_motivation: applicationFields.motivation,
      p_strongest_skills: applicationFields.strongestSkills,
      p_career_challenge: applicationFields.careerChallenge,
      p_portfolio_url: applicationFields.portfolioUrl || null,
      p_additional_notes: applicationFields.additionalNotes || null,
      p_privacy_consent_version: "2026-09",
    });
  if (error) {
    logSafeErrorDiagnostic("atomic_application_create_rpc_error", error);
    throw error;
  }
  const created = Array.isArray(data) ? data[0] : data;
  if (!created?.application_id || !created?.registry_id || !created?.submitted_at) {
    logSafeErrorDiagnostic("atomic_application_create_unexpected_result", null);
    throw new Error("Atomic application creation failed");
  }
  return created as CreatedApplication;
}

async function removeCreatedSubmissionRegistry(
  admin: ReturnType<typeof createClient>,
  applicationId: string,
  registryId: string | null,
) {
  if (!registryId) return true;
  try {
    const { data, error } = await admin.rpc("rollback_application_submission_registry", {
      p_application_id: applicationId,
      p_registry_id: registryId,
    });
    const deleted = !error && data === true;
    if (!deleted) console.error("submit-application submission registry rollback failed");
    return deleted;
  } catch {
    console.error("submit-application submission registry rollback failed");
    return false;
  }
}

async function releaseDraftClaim(admin: ReturnType<typeof createClient>, claim: DraftClaim | null) {
  if (!claim) return;
  try {
    await admin.rpc("release_application_draft_claim", {
      p_draft_id: claim.draft_id,
      p_claim_id: claim.claim_id,
    });
  } catch {
    console.error("submit-application draft release failed");
  }
}

async function rollbackCreatedApplication(
  admin: ReturnType<typeof createClient>,
  applicationId: string | null,
  cvStoragePath: string | null,
) : Promise<RollbackResult> {
  let cvCleanupSucceeded = true;
  let applicationDeleted = !applicationId;

  if (applicationId) {
    // Existing application-scoped cascades remove CV metadata and quiz rows.
    try {
      const { data, error } = await admin.from("applications").delete().eq("id", applicationId).select("id");
      applicationDeleted = !error && Array.isArray(data) && data.some((row) => row?.id === applicationId);
      if (!applicationDeleted) console.error("submit-application application rollback failed");
    } catch {
      applicationDeleted = false;
      console.error("submit-application application rollback failed");
    }
  }

  // Keep the object intact if the database row cannot be confirmed deleted.
  if (applicationDeleted && cvStoragePath) {
    try {
      const { error } = await admin.storage.from("cvs").remove([cvStoragePath]);
      if (error) {
        cvCleanupSucceeded = false;
        console.error("submit-application CV rollback failed");
      }
    } catch {
      cvCleanupSucceeded = false;
      console.error("submit-application CV rollback failed");
    }
  }

  return { applicationDeleted, cvCleanupSucceeded };
}

async function claimDraft(
  admin: ReturnType<typeof createClient>,
  draftToken: string,
  userId: string,
  verifiedEmail: string,
) : Promise<DraftClaimResult> {
  if (!/^[a-f0-9]{64}$/i.test(draftToken)) {
    logDiagnostic("draft_claim_result_draft_not_found_or_expired");
    return { claim: null, error: "draft_not_found_or_expired" };
  }

  const { data, error } = await admin.rpc("claim_application_draft_diagnostic", {
    p_token_hash: await hashToken(draftToken),
    p_user_id: userId,
    p_verified_email: verifiedEmail,
  });
  if (error) {
    logDiagnostic("draft_claim_result_claim_rpc_failure");
    logSafeErrorDiagnostic("draft_claim_rpc_error", error);
    console.error("submit-application draft_claim_failed: claim_rpc_failure");
    return { claim: null, error: "claim_rpc_failure" };
  }
  if (!Array.isArray(data) || data.length !== 1) {
    logDiagnostic("draft_claim_result_unexpected_claim_result");
    console.error("submit-application draft_claim_failed: unexpected_claim_result");
    return { claim: null, error: "unexpected_claim_result" };
  }

  const result = data[0] as { outcome?: string } & Partial<DraftClaim>;
  if (result?.outcome === "claimed") {
    if (!result.draft_id || !result.claim_id || !result.payload || typeof result.payload !== "object") {
      logDiagnostic("draft_claim_result_unexpected_claim_result");
      console.error("submit-application draft_claim_failed: unexpected_claim_result");
      return { claim: null, error: "unexpected_claim_result" };
    }
    logDiagnostic("draft_claim_result_claimed");
    return {
      claim: {
        draft_id: result.draft_id,
        claim_id: result.claim_id,
        payload: result.payload,
      },
      error: null,
    };
  }

  if ([
    "draft_not_found_or_expired",
    "verified_email_mismatch",
    "draft_already_claimed_or_unavailable",
  ].includes(result?.outcome || "")) {
    logDiagnostic(`draft_claim_result_${result.outcome}`);
    console.error(`submit-application draft_claim_failed: ${result.outcome}`);
    return { claim: null, error: result.outcome as DraftClaimFailure };
  }

  logDiagnostic("draft_claim_result_unexpected_claim_result");
  console.error("submit-application draft_claim_failed: unexpected_claim_result");
  return { claim: null, error: "unexpected_claim_result" };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  let admin: ReturnType<typeof createClient> | null = null;
  let draftClaim: DraftClaim | null = null;
  let shouldReleaseDraft = false;
  let createdApplicationId: string | null = null;
  let createdSubmissionRegistryId: string | null = null;
  let uploadedCvStoragePath: string | null = null;
  let diagnosticStage = "request_entered";
  logDiagnostic(diagnosticStage);

  try {
    const identity = await authenticateRequest(request);
    if (!identity) {
      logDiagnostic("authentication_failed");
      return errorResponse("unauthorized", 401);
    }
    diagnosticStage = "authentication_succeeded";
    logDiagnostic(diagnosticStage);

    diagnosticStage = "formdata_parsing";
    const form = await request.formData();
    diagnosticStage = "formdata_parsed";
    logDiagnostic(diagnosticStage);
    if (String(form.get("website") || "").trim()) return response({ ok: true });

    diagnosticStage = "service_client_prerequisites";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Service client is not configured");
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    diagnosticStage = "service_client_ready";
    logDiagnostic(diagnosticStage);

    const draftToken = normalizeText(form.get("draft_token"));
    diagnosticStage = draftToken ? "draft_token_present" : "draft_token_absent";
    logDiagnostic(diagnosticStage);
    const suppliedCv = form.get("cv");
    let payload: Record<string, unknown>;
    let cv: FormDataEntryValue | null;
    if (draftToken) {
      // Draft text comes only from the server-side claim; a CV is accepted only now.
      if (suppliedCv !== null && !(suppliedCv instanceof File)) return errorResponse("invalid_cv", 400);
      diagnosticStage = "draft_claim_attempt_started";
      logDiagnostic(diagnosticStage);
      const draftClaimResult = await claimDraft(admin, draftToken, identity.userId, identity.email);
      if (!draftClaimResult.claim) {
        const status = ["claim_rpc_failure", "unexpected_claim_result"].includes(draftClaimResult.error)
          ? 503
          : 409;
        return errorResponse(draftClaimResult.error, status);
      }
      draftClaim = draftClaimResult.claim;
      shouldReleaseDraft = true;
      payload = draftClaim.payload;
      cv = suppliedCv;
      diagnosticStage = "draft_claim_succeeded";
      logDiagnostic(diagnosticStage);
    } else {
      try {
        const rawPayload = String(form.get("payload") || "");
        if (new TextEncoder().encode(rawPayload).length > MAX_DIRECT_PAYLOAD_BYTES) {
          return errorResponse("invalid_submission", 400);
        }
        const parsedPayload = JSON.parse(rawPayload || "{}");
        if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
          return errorResponse("invalid_submission", 400);
        }
        payload = parsedPayload as Record<string, unknown>;
      } catch {
        return errorResponse("invalid_submission", 400);
      }
      cv = suppliedCv;
    }
    diagnosticStage = "payload_parse_started";
    logDiagnostic(diagnosticStage);
    const normalizedPayload = parseSubmissionPayload(
      payload,
      cv instanceof File,
    );
    if (!normalizedPayload) return errorResponse("invalid_submission", 400);
    diagnosticStage = "payload_parse_succeeded";
    logDiagnostic(diagnosticStage);

    diagnosticStage = "email_match_check_started";
    logDiagnostic(diagnosticStage);
    if (normalizedPayload.email !== identity.email) return errorResponse("email_mismatch", 400);
    diagnosticStage = "email_match_check_passed";
    logDiagnostic(diagnosticStage);

    if (cv instanceof File) {
      diagnosticStage = "cv_validation_started";
      logDiagnostic(diagnosticStage);
      if (!(await isValidCv(cv))) return errorResponse("invalid_cv", 400);
      diagnosticStage = "cv_validation_passed";
      logDiagnostic(diagnosticStage);
    } else {
      diagnosticStage = "cv_validation_not_applicable";
      logDiagnostic(diagnosticStage);
    }
    const {
      fullName,
      phone,
      opportunityType,
      targetRole,
      targetFields,
      targetFieldsOther,
      relevantExperience,
      strongestSkills,
      careerChallenge,
      careerfitHelp,
      linkedinUrl,
      portfolioUrl,
      additionalNotes,
    } = normalizedPayload;

    const now = new Date().toISOString();
    diagnosticStage = "applicant_lookup_started";
    logDiagnostic(diagnosticStage);
    const { data: authApplicant, error: authApplicantError } = await admin
      .from("applicants")
      .select("id")
      .eq("auth_user_id", identity.userId)
      .maybeSingle();
    if (authApplicantError) throw authApplicantError;

    let applicantId = authApplicant?.id;
    if (!applicantId) {
      const { data: emailApplicant, error: emailApplicantError } = await admin
        .from("applicants")
        .select("id, auth_user_id")
        .eq("email", identity.email)
        .maybeSingle();
      if (emailApplicantError) throw emailApplicantError;
      if (emailApplicant) {
        return errorResponse(
          emailApplicant.auth_user_id ? "identity_conflict" : "legacy_identity_conflict",
          409,
        );
      }
    }
    diagnosticStage = "applicant_lookup_succeeded";
    logDiagnostic(diagnosticStage);

    // Preserve identity-conflict outcomes above, then make the durable history
    // check before any applicant, profile, or application mutation.
    diagnosticStage = "duplicate_check_started";
    logDiagnostic(diagnosticStage);
    if (await findSubmissionRegistry(admin, identity.userId, identity.email)) {
      return errorResponse("application_already_exists", 409);
    }
    diagnosticStage = "duplicate_check_passed";
    logDiagnostic(diagnosticStage);

    // Draft payloads were semantically evaluated before their server-only row was created.
    // Direct authenticated submissions have no such attestation and validate here once.
    if (!draftToken) {
      const semanticDecision = await validateApplicationSemanticPayload(admin, normalizedPayload);
      if (semanticDecision.blockedFieldKeys.length) {
        return response({ ok: false, error: "semantic_invalid", fieldErrors: semanticFieldErrors(semanticDecision) }, 400);
      }
    }

    if (!applicantId) {
      diagnosticStage = "applicant_create_started";
      logDiagnostic(diagnosticStage);
      const { data: applicant, error: applicantCreateError } = await admin
        .from("applicants")
        .insert({ auth_user_id: identity.userId, full_name: fullName, email: identity.email, phone: phone || null, updated_at: now })
        .select("id")
        .single();
      if (applicantCreateError || !applicant) throw applicantCreateError || new Error("Applicant creation failed");
      applicantId = applicant.id;
      diagnosticStage = "applicant_create_succeeded";
      logDiagnostic(diagnosticStage);
    }

    diagnosticStage = "application_duplicate_check_started";
    logDiagnostic(diagnosticStage);
    const { data: existingApplication, error: existingApplicationError } = await admin
      .from("applications")
      .select("id")
      .eq("applicant_id", applicantId)
      .limit(1)
      .maybeSingle();
    if (existingApplicationError) throw existingApplicationError;
    if (existingApplication) return errorResponse("application_already_exists", 409);
    diagnosticStage = "application_duplicate_check_passed";
    logDiagnostic(diagnosticStage);

    if (authApplicant) {
      diagnosticStage = "applicant_update_started";
      logDiagnostic(diagnosticStage);
      const { error: applicantUpdateError } = await admin
        .from("applicants")
        .update({ full_name: fullName, email: identity.email, phone: phone || null, updated_at: now })
        .eq("id", applicantId)
        .eq("auth_user_id", identity.userId);
      if (applicantUpdateError) throw applicantUpdateError;
      diagnosticStage = "applicant_update_succeeded";
      logDiagnostic(diagnosticStage);
    }

    const profile = {
      applicant_id: applicantId,
      target_role: targetRole || null,
      target_fields: targetFields.join(","),
      target_fields_other: targetFields.includes("other") ? targetFieldsOther : null,
      career_goal: opportunityType,
      current_profile_summary: relevantExperience,
      linkedin_url: linkedinUrl || null,
      updated_at: now,
    };
    diagnosticStage = "applicant_profile_upsert_started";
    logDiagnostic(diagnosticStage);
    const { error: profileError } = await admin.from("applicant_profiles").upsert(profile, { onConflict: "applicant_id" });
    if (profileError) throw profileError;
    diagnosticStage = "applicant_profile_upsert_succeeded";
    logDiagnostic(diagnosticStage);
    let application: CreatedApplication;
    try {
      diagnosticStage = "atomic_application_create_started";
      logDiagnostic(diagnosticStage);
      application = await createApplicationWithSubmissionRegistry(admin, applicantId, identity.userId, {
        motivation: careerfitHelp,
        strongestSkills,
        careerChallenge,
        portfolioUrl,
        additionalNotes,
      });
    } catch (error) {
      // The database RPC rolls back both rows when either unique boundary fails.
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        return errorResponse("application_already_exists", 409);
      }
      throw error;
    }
    createdApplicationId = application.application_id;
    createdSubmissionRegistryId = application.registry_id;
    diagnosticStage = "atomic_application_create_succeeded";
    logDiagnostic(diagnosticStage);
    if (cv instanceof File) {
      diagnosticStage = "cv_persistence_started";
      logDiagnostic(diagnosticStage);
      const safeName = cv.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${applicantId}/${application.application_id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await admin.storage.from("cvs").upload(path, cv, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      uploadedCvStoragePath = path;
      const { error: documentError } = await admin.from("cv_documents").insert({ applicant_id: applicantId, application_id: application.application_id, storage_path: path, original_filename: cv.name, mime_type: "application/pdf", file_size: cv.size, cv_status: normalizedPayload.cvStatus || "current", changes_since_cv: normalizedPayload.changesSinceCv || null });
      if (documentError) throw documentError;
      diagnosticStage = "cv_persistence_succeeded";
      logDiagnostic(diagnosticStage);
    }
    if (normalizedPayload.quiz?.completedAt && Array.isArray(normalizedPayload.quiz.answers)) {
      diagnosticStage = "quiz_persistence_started";
      logDiagnostic(diagnosticStage);
      const { error: quizError } = await admin.from("quiz_attempts").insert({ applicant_id: applicantId, application_id: application.application_id, answers: normalizedPayload.quiz.answers, score: normalizedPayload.quiz.score, result_tier: normalizedPayload.quiz.resultTier, completed_at: normalizedPayload.quiz.completedAt });
      if (quizError) throw quizError;
      diagnosticStage = "quiz_persistence_succeeded";
      logDiagnostic(diagnosticStage);
    }
    if (draftClaim) {
      diagnosticStage = "draft_finalize_started";
      logDiagnostic(diagnosticStage);
      const { data: finalized, error: finalizeError } = await admin.rpc("finalize_application_draft", {
        p_draft_id: draftClaim.draft_id,
        p_claim_id: draftClaim.claim_id,
      });
      if (finalizeError || finalized !== true) throw new Error("Draft finalization failed");
      shouldReleaseDraft = false;
      diagnosticStage = "draft_finalize_succeeded";
      logDiagnostic(diagnosticStage);
    }
    // All post-insert work completed. Catch-path compensation is no longer needed.
    createdApplicationId = null;
    createdSubmissionRegistryId = null;
    uploadedCvStoragePath = null;
    diagnosticStage = "response_success";
    logDiagnostic(diagnosticStage);
    return response({ ok: true, applicationId: application.application_id });
  } catch (error) {
    console.error(`submit-application diagnostic: unexpected_exception_${diagnosticStage}`);
    logSafeErrorDiagnostic(`unexpected_exception_${diagnosticStage}`, error);
    if (admin && createdApplicationId) {
      const rollbackResult = await rollbackCreatedApplication(admin, createdApplicationId, uploadedCvStoragePath);
      if (!rollbackResult.applicationDeleted) {
        // Do not release the claimed draft into a retry path while the final state is unknown.
        shouldReleaseDraft = false;
        console.error("submit-application rollback state uncertain");
        return errorResponse("submission_state_uncertain", 503);
      }
      if (!(await removeCreatedSubmissionRegistry(admin, createdApplicationId, createdSubmissionRegistryId))) {
        // A surviving registry after DB compensation would incorrectly block a retry.
        shouldReleaseDraft = false;
        console.error("submit-application rollback state uncertain");
        return errorResponse("submission_state_uncertain", 503);
      }
      createdApplicationId = null;
      createdSubmissionRegistryId = null;
      uploadedCvStoragePath = null;
    }
    if (admin && shouldReleaseDraft) {
      await releaseDraftClaim(admin, draftClaim);
      shouldReleaseDraft = false;
    }
    console.error("submit-application failed");
    return response(
      { error: "We could not save your application. Please try again." },
      500,
    );
  } finally {
    if (admin && shouldReleaseDraft) await releaseDraftClaim(admin, draftClaim);
  }
});
