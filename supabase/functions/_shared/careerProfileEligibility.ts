// Server-side only. The authenticated user ID comes from a verified JWT.
export async function hasAcceptedCareerProfileAccess(client: any, userId: string) {
  const { data: applicant, error: applicantError } = await client.from("applicants").select("id").eq("auth_user_id", userId).maybeSingle();
  if (applicantError || !applicant?.id) return false;
  const { data: application, error: applicationError } = await client.from("applications").select("id").eq("applicant_id", applicant.id).eq("status", "accepted").limit(1).maybeSingle();
  return !applicationError && Boolean(application?.id);
}
