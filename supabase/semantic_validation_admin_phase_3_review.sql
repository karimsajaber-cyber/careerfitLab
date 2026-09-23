-- REVIEW ONLY: Admin-only semantic configuration and observability.
-- Rollback: revoke authenticated execute on both functions; no data is deleted.
begin;
create or replace function public.admin_get_semantic_validation()
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_config jsonb; v_metrics jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select to_jsonb(c) - 'singleton' into v_config from public.semantic_validation_configuration c where singleton = true;
  select jsonb_build_object('provider_requests', count(*) filter (where provider_request_started), 'provider_successes', count(*) filter (where provider_succeeded), 'provider_failures', count(*) filter (where provider_request_started and not provider_succeeded), 'provider_skips', count(*) filter (where provider_skipped), 'fallbacks', count(*) filter (where execution_path = 'deterministic_fallback'), 'cache_hits', count(*) filter (where cache_hit), 'invalid', coalesce(sum(invalid_count),0), 'uncertain', coalesce(sum(uncertain_count),0), 'average_latency_ms', coalesce(round(avg(latency_ms))::integer,0), 'input_tokens', sum(input_tokens), 'output_tokens', sum(output_tokens), 'total_tokens', sum(total_tokens)) into v_metrics from public.semantic_validation_events;
  return jsonb_build_object('configuration', v_config, 'metrics', v_metrics);
end; $$;
create or replace function public.admin_update_semantic_validation(p_mode text, p_application_enabled boolean, p_career_profile_enabled boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_mode not in ('off','shadow','enforced') then raise exception 'Invalid mode' using errcode = '22023'; end if;
  update public.semantic_validation_configuration set mode=p_mode, application_enabled=p_application_enabled, career_profile_enabled=p_career_profile_enabled, updated_at=now() where singleton=true returning to_jsonb(semantic_validation_configuration) - 'singleton' into v_result;
  if v_result is null then raise exception 'Semantic configuration unavailable' using errcode = '55000'; end if;
  return v_result;
end; $$;
revoke all on function public.admin_get_semantic_validation() from public, anon, authenticated;
revoke all on function public.admin_update_semantic_validation(text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.admin_get_semantic_validation() to authenticated;
grant execute on function public.admin_update_semantic_validation(text,boolean,boolean) to authenticated;
commit;
