import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { semanticFieldErrors, validateCareerProfileSemanticPayload } from "../_shared/semanticValidationRuntime.ts";
import { hasAcceptedCareerProfileAccess } from "../_shared/careerProfileEligibility.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!url || !serviceKey || !token) return reply({ ok: false, error: "unauthorized" }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return reply({ ok: false, error: "unauthorized" }, 401);
    if (!(await hasAcceptedCareerProfileAccess(admin, userData.user.id))) return reply({ ok: false, error: "profile_access_denied" }, 403);
    const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ ok: false, error: "invalid_profile" }, 400);
    const profileData = (body as Record<string, unknown>).profile_data; const schemaVersion = (body as Record<string, unknown>).schema_version;
    if (!profileData || typeof profileData !== "object" || Array.isArray(profileData) || schemaVersion !== 1) return reply({ ok: false, error: "invalid_profile" }, 400);
    const semantic = await validateCareerProfileSemanticPayload(admin, profileData as Record<string, unknown>);
    if (semantic.blockedFieldKeys.length) return reply({ ok: false, error: "semantic_invalid", fieldErrors: semanticFieldErrors(semantic) }, 400);
    const { data, error } = await admin.rpc("save_career_profile_from_semantic_gateway", { p_user_id: userData.user.id, p_profile_data: profileData, p_schema_version: schemaVersion });
    if (error || !data || typeof data !== "object") throw new Error("profile save unavailable");
    return reply({ ok: true, profile_data: data });
  } catch { return reply({ ok: false, error: "profile_unavailable" }, 500); }
});
