import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_CV_SIZE = 5 * 1024 * 1024;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const form = await request.formData();
    if (String(form.get("website") || "").trim()) return response({ ok: true });
    const payload = JSON.parse(String(form.get("payload") || "{}"));
    const cv = form.get("cv");
    const fullName = String(payload.fullName || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const phone = String(payload.phone || "").trim();
    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || phone.length < 6 || !payload.currentStatus || !payload.englishLevel || !payload.privacyConsent) {
      return response({ error: "Please review the required fields." }, 400);
    }
    if (cv instanceof File && (cv.type !== "application/pdf" || cv.size > MAX_CV_SIZE)) {
      return response({ error: "Your CV must be a PDF smaller than 5 MB." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: applicant, error: applicantError } = await admin.from("applicants").upsert({ full_name: fullName, email, phone, updated_at: new Date().toISOString() }, { onConflict: "email" }).select("id").single();
    if (applicantError) throw applicantError;
    const profile = { applicant_id: applicant.id, institution: payload.institution || null, major: payload.major || null, graduation_year: payload.graduationYear || null, current_status: payload.currentStatus, target_role: payload.targetRole || null, target_industry: payload.targetIndustry || null, target_fields: payload.targetFields || null, english_level: payload.englishLevel, career_goal: payload.careerGoal || null, availability: payload.availability || null, current_profile_summary: payload.currentProfileSummary || null, linkedin_url: payload.linkedin || null, updated_at: new Date().toISOString() };
    const { error: profileError } = await admin.from("applicant_profiles").upsert(profile, { onConflict: "applicant_id" });
    if (profileError) throw profileError;
    const { data: application, error: applicationError } = await admin.from("applications").insert({ applicant_id: applicant.id, motivation: payload.motivation || null, target_job_url: payload.targetJobUrl || null, privacy_consent: true, privacy_consent_version: "2026-09" }).select("id").single();
    if (applicationError) throw applicationError;
    if (cv instanceof File) {
      const safeName = cv.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${applicant.id}/${application.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await admin.storage.from("cvs").upload(path, cv, { contentType: "application/pdf", upsert: false });
      if (uploadError) { await admin.from("applications").delete().eq("id", application.id); throw uploadError; }
      const { error: documentError } = await admin.from("cv_documents").insert({ applicant_id: applicant.id, application_id: application.id, storage_path: path, original_filename: cv.name, mime_type: "application/pdf", file_size: cv.size, cv_status: payload.cvStatus || "current", changes_since_cv: payload.changesSinceCv || null });
      if (documentError) { await admin.storage.from("cvs").remove([path]); await admin.from("applications").delete().eq("id", application.id); throw documentError; }
    }
    if (payload.quiz?.completedAt && Array.isArray(payload.quiz.answers)) {
      const { error: quizError } = await admin.from("quiz_attempts").insert({ applicant_id: applicant.id, application_id: application.id, answers: payload.quiz.answers, score: payload.quiz.score, result_tier: payload.quiz.resultTier, completed_at: payload.quiz.completedAt });
      if (quizError) throw quizError;
    }
    return response({ ok: true, applicationId: application.id });
  } catch (error) {
    console.error("submit-application", error);
    return response({ error: "We could not save your application. Please try again." }, 500);
  }
});
