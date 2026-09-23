-- REVIEW ONLY: Phase 1 semantic-validation control plane. Do not execute yet.
begin;

create table if not exists public.semantic_validation_configuration (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'off' check (mode in ('off', 'shadow', 'enforced')),
  application_enabled boolean not null default false,
  career_profile_enabled boolean not null default false,
  timeout_ms integer not null default 2500 check (timeout_ms between 250 and 10000),
  support_operation_timeout_ms integer not null default 750 check (support_operation_timeout_ms between 100 and 5000),
  cache_enabled boolean not null default true,
  cache_ttl_seconds integer not null default 86400 check (cache_ttl_seconds between 60 and 2592000),
  validator_version text not null default 'v1' check (char_length(validator_version) between 1 and 64),
  provider_id text not null default 'openai_responses' check (char_length(provider_id) between 1 and 64),
  provider_model text not null default 'gpt-5-mini' check (char_length(provider_model) between 1 and 128),
  daily_provider_call_limit integer null check (daily_provider_call_limit is null or daily_provider_call_limit between 1 and 1000000),
  monthly_provider_call_limit integer null check (monthly_provider_call_limit is null or monthly_provider_call_limit between 1 and 10000000),
  updated_at timestamptz not null default now()
);

insert into public.semantic_validation_configuration (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.semantic_validation_cache (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  surface text not null check (surface in ('application', 'career_profile')),
  validator_version text not null check (char_length(validator_version) between 1 and 64),
  results jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);
create index if not exists semantic_validation_cache_expiry_idx on public.semantic_validation_cache (expires_at);

create table if not exists public.semantic_validation_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  configured_mode text not null check (configured_mode in ('off', 'shadow', 'enforced')),
  execution_path text not null check (execution_path in ('off', 'surface_disabled', 'no_fields', 'invalid_field_contract', 'cache_hit', 'provider', 'deterministic_fallback')),
  surface text not null check (surface in ('application', 'career_profile')),
  provider_attempted boolean not null default false,
  provider_eligible boolean not null default false,
  provider_request_started boolean not null default false,
  provider_succeeded boolean not null,
  provider_skipped boolean not null default false,
  cache_hit boolean not null,
  fallback_reason text null check (fallback_reason is null or fallback_reason in ('configuration_unavailable', 'cache_identity_unavailable', 'provider_timeout', 'provider_failure', 'malformed_provider_response', 'provider_guard', 'invalid_field_contract')),
  valid_count integer not null default 0 check (valid_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  uncertain_count integer not null default 0 check (uncertain_count >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  input_tokens integer null check (input_tokens is null or input_tokens >= 0),
  output_tokens integer null check (output_tokens is null or output_tokens >= 0),
  total_tokens integer null check (total_tokens is null or total_tokens >= 0),
  provider_id text null check (provider_id is null or char_length(provider_id) <= 64),
  provider_model text null check (provider_model is null or char_length(provider_model) <= 128)
);

-- Phase 2 application-draft attestation. Server-owned only; never client supplied.
alter table public.application_drafts add column if not exists semantic_validation jsonb null;
create index if not exists semantic_validation_events_created_idx on public.semantic_validation_events (created_at desc);

create table if not exists public.semantic_validation_provider_counters (
  surface text not null check (surface in ('application', 'career_profile')),
  window_kind text not null check (window_kind in ('day', 'month')),
  window_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (surface, window_kind, window_start)
);

alter table public.semantic_validation_configuration enable row level security;
alter table public.semantic_validation_cache enable row level security;
alter table public.semantic_validation_events enable row level security;
alter table public.semantic_validation_provider_counters enable row level security;

create or replace function public.consume_semantic_validation_provider_budget(p_surface text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_config public.semantic_validation_configuration%rowtype;
  v_day_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_day_attempts integer;
  v_month_attempts integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  if p_surface not in ('application', 'career_profile') then raise exception 'Invalid surface' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('careerfit_semantic_budget_' || p_surface));
  select * into v_config from public.semantic_validation_configuration where singleton = true;
  if not found then raise exception 'Semantic configuration unavailable' using errcode = '55000'; end if;

  select attempts into v_day_attempts from public.semantic_validation_provider_counters where surface = p_surface and window_kind = 'day' and window_start = v_day_start;
  select attempts into v_month_attempts from public.semantic_validation_provider_counters where surface = p_surface and window_kind = 'month' and window_start = v_month_start;
  if (v_config.daily_provider_call_limit is not null and coalesce(v_day_attempts, 0) >= v_config.daily_provider_call_limit)
    or (v_config.monthly_provider_call_limit is not null and coalesce(v_month_attempts, 0) >= v_config.monthly_provider_call_limit) then
    return false;
  end if;

  insert into public.semantic_validation_provider_counters (surface, window_kind, window_start, attempts)
  values (p_surface, 'day', v_day_start, 1), (p_surface, 'month', v_month_start, 1)
  on conflict (surface, window_kind, window_start) do update set attempts = public.semantic_validation_provider_counters.attempts + 1;
  return true;
end;
$$;

revoke all on table public.semantic_validation_configuration, public.semantic_validation_cache, public.semantic_validation_events, public.semantic_validation_provider_counters from public, anon, authenticated;
revoke all on function public.consume_semantic_validation_provider_budget(text) from public, anon, authenticated;
grant select, insert, update, delete on table public.semantic_validation_configuration, public.semantic_validation_cache, public.semantic_validation_events, public.semantic_validation_provider_counters to service_role;
grant usage, select on sequence public.semantic_validation_events_id_seq to service_role;
grant execute on function public.consume_semantic_validation_provider_budget(text) to service_role;

commit;
