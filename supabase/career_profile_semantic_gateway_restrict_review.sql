-- REVIEW ONLY: execute only after save-career-profile Edge Function and new frontend are deployed and verified.
-- Rollback: grant execute on function public.save_my_career_profile(jsonb, integer) to authenticated.
begin;
revoke all on function public.save_my_career_profile(jsonb, integer) from public, anon, authenticated;
commit;
