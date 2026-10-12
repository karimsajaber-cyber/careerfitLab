import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  parsePayloadJson,
  parseSubmissionPayload,
} from "../_shared/applicationSubmission.ts";
import { semanticFieldErrors, validateApplicationSemanticPayload } from "../_shared/semanticValidationRuntime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const DRAFT_TTL_MS = 30 * 60 * 1000;
const MAX_DRAFT_PAYLOAD_BYTES = 24 * 1024;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function errorResponse(error: string, status: number) {
  return response({ ok: false, error }, status);
}

function createOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const form = await request.formData();
    if (String(form.get("website") || "").trim()) return response({ ok: true });

    const rawPayload = form.get("payload");
    if (new TextEncoder().encode(String(rawPayload || "")).length > MAX_DRAFT_PAYLOAD_BYTES) {
      return errorResponse("invalid_submission", 400);
    }
    const cv = form.get("cv");
    // CV files are intentionally not accepted before email verification.
    if (cv !== null) return errorResponse("invalid_submission", 400);

    const parsedPayload = parsePayloadJson(rawPayload);
    const payload = parseSubmissionPayload(parsedPayload, false);
    if (!payload) return errorResponse("invalid_submission", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Draft service is not configured");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: rateLimitAllowed, error: rateLimitError } = await admin.rpc(
      "consume_application_draft_email_rate_limit",
      { p_email_hash: await hashValue(payload.email) },
    );
    if (rateLimitError) throw rateLimitError;
    if (rateLimitAllowed !== true) return errorResponse("draft_rate_limited", 429);

    const semanticDecision = await validateApplicationSemanticPayload(admin, payload);
    if (semanticDecision.blockedFieldKeys.length) {
      return response({ ok: false, error: "semantic_invalid", fieldErrors: semanticFieldErrors(semanticDecision) }, 400);
    }

    const draftId = crypto.randomUUID();
    const token = createOpaqueToken();
    const tokenHash = await hashValue(token);
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS).toISOString();
    const draftPayload = {
      ...payload,
      privacyConsent: true,
    };

    const { error: draftError } = await admin.from("application_drafts").insert({
      id: draftId,
      token_hash: tokenHash,
      email: payload.email,
      payload: draftPayload,
      semantic_validation: {
        validator_version: semanticDecision.configuredMode === "off" ? null : "server-configured",
        execution_path: semanticDecision.executionPath,
        mode_snapshot: semanticDecision.configuredMode,
        results: semanticDecision.results,
      },
      expires_at: expiresAt,
    });
    if (draftError) throw draftError;

    return response({ ok: true, draftToken: token });
  } catch {
    console.error("create-application-draft failed");
    return response({ ok: false, error: "draft_unavailable" }, 500);
  }
});
