import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEquals(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ ok: false, error: "not_found" }, 404);

  const expectedSecret = Deno.env.get("APPLICATION_DRAFT_CLEANUP_SECRET");
  const providedSecret = request.headers.get("x-application-draft-cleanup-secret");
  if (!expectedSecret || !providedSecret || !constantTimeEquals(providedSecret, expectedSecret)) {
    return response({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Cleanup service is not configured");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: draftsError } = await admin.rpc("cleanup_expired_application_drafts");
    if (draftsError) throw draftsError;
    const { error: rateLimitsError } = await admin.rpc("cleanup_stale_application_draft_rate_limits");
    if (rateLimitsError) throw rateLimitsError;

    return response({ ok: true });
  } catch {
    console.error("cleanup-application-drafts failed");
    return response({ ok: false, error: "cleanup_unavailable" }, 500);
  }
});
