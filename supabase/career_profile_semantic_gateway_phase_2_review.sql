-- REVIEW ONLY: deploy with save-career-profile Edge Function. Do not execute alone.
-- Rollback: revoke this gateway from service_role and restore authenticated execute on save_my_career_profile.
begin;
create or replace function public.save_career_profile_from_semantic_gateway(p_user_id uuid, p_profile_data jsonb, p_schema_version integer default 1)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare v_existing jsonb := '{}'::jsonb; v_known jsonb; v_saved jsonb; v_location jsonb; v_work jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from public.applicants a join public.applications ap on ap.applicant_id = a.id and ap.status = 'accepted' where a.auth_user_id = p_user_id) then raise exception 'Career Profile access required' using errcode = '42501'; end if;
  if p_schema_version <> 1 or jsonb_typeof(p_profile_data) <> 'object' then raise exception 'Invalid profile data' using errcode = '22023'; end if;
  v_location := coalesce(p_profile_data->'location_preferences', '{}'::jsonb); v_work := coalesce(p_profile_data->'work_preferences', '{}'::jsonb);
  if not public.careerfit_profile_text_is_valid(p_profile_data->>'professional_summary', 40, 2000, true) or not public.careerfit_profile_items_are_valid(p_profile_data->'target_roles', 1) or not public.careerfit_profile_items_are_valid(p_profile_data->'skills', 2) or not public.careerfit_profile_text_is_valid(p_profile_data->>'experience_summary', 20, 2000, true) or not public.careerfit_profile_text_is_valid(p_profile_data->>'education_summary', 10, 2000, true) or not public.careerfit_profile_items_are_valid(p_profile_data->'languages', 1) or not public.careerfit_profile_items_are_valid(coalesce(p_profile_data->'career_constraints', '[]'::jsonb), 0) or not public.careerfit_profile_text_is_valid(v_location->>'preferred_location', 2, 100) or coalesce(v_location->>'relocation' not in ('yes','no','flexible'), true) or coalesce(v_work->>'arrangement' not in ('remote','hybrid','onsite','flexible'), true) or coalesce(v_work->>'availability' not in ('full_time','part_time','flexible'), true) then raise exception 'Invalid profile data' using errcode = '22023'; end if;
  select profile_data into v_existing from public.career_profiles where user_id = p_user_id; v_existing := coalesce(v_existing, '{}'::jsonb);
  v_known := jsonb_build_object('professional_summary', p_profile_data->'professional_summary', 'target_roles', p_profile_data->'target_roles', 'skills', p_profile_data->'skills', 'experience_summary', p_profile_data->'experience_summary', 'education_summary', p_profile_data->'education_summary', 'languages', p_profile_data->'languages', 'location_preferences', coalesce(v_existing->'location_preferences','{}'::jsonb) || jsonb_build_object('preferred_location',v_location->'preferred_location','relocation',v_location->'relocation'), 'work_preferences', coalesce(v_existing->'work_preferences','{}'::jsonb) || jsonb_build_object('arrangement',v_work->'arrangement','availability',v_work->'availability'), 'career_constraints',coalesce(p_profile_data->'career_constraints','[]'::jsonb));
  insert into public.career_profiles(user_id,profile_data,schema_version) values(p_user_id,v_known,1) on conflict(user_id) do update set profile_data = public.career_profiles.profile_data || v_known, schema_version=1, updated_at=now() returning profile_data into v_saved; return v_saved;
end; $$;
revoke all on function public.save_career_profile_from_semantic_gateway(uuid,jsonb,integer) from public, anon, authenticated;
grant execute on function public.save_career_profile_from_semantic_gateway(uuid,jsonb,integer) to service_role;
commit;
