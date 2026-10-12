-- REVIEW ONLY: production function correction. Do not execute automatically.
-- Rollback: reapply the immediately previous function body. That restores the
-- prior behavior, including the erroneous email-regex rejection, so use only
-- if this isolated correction itself must be reverted.
begin;

do $$
declare
  v_email_pattern constant text := '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
begin
  if not ('user@example.com' ~ v_email_pattern)
     or not ('user.name+tag@example.co.uk' ~ v_email_pattern)
     or 'invalid' ~ v_email_pattern
     or 'user@domain' ~ v_email_pattern
     or '@example.com' ~ v_email_pattern
     or 'user@example.' ~ v_email_pattern then
    raise exception 'Application email regex verification failed';
  end if;
end;
$$;

create or replace function public.create_application_with_submission_registry(
  p_applicant_id uuid,
  p_auth_user_id uuid,
  p_motivation text,
  p_strongest_skills text,
  p_career_challenge text,
  p_portfolio_url text,
  p_additional_notes text,
  p_privacy_consent_version text
)
returns table (
  application_id uuid,
  registry_id uuid,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_application public.applications%rowtype;
  v_registry_id uuid;
  v_email text;
  v_email_hash text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if p_applicant_id is null
     or p_auth_user_id is null then
    raise exception 'Invalid application submission identity';
  end if;

  select lower(btrim(a.email))
  into v_email
  from public.applicants a
  where a.id = p_applicant_id
    and a.auth_user_id = p_auth_user_id
  for key share;
  if not found
     or v_email is null
     or v_email = ''
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Applicant identity mismatch';
  end if;
  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  insert into public.applications (
    applicant_id,
    motivation,
    strongest_skills,
    career_challenge,
    portfolio_url,
    additional_notes,
    privacy_consent,
    privacy_consent_version
  )
  values (
    p_applicant_id,
    p_motivation,
    p_strongest_skills,
    p_career_challenge,
    p_portfolio_url,
    p_additional_notes,
    true,
    p_privacy_consent_version
  )
  returning * into v_application;

  insert into public.application_submission_registry (
    email_hash,
    auth_user_id,
    first_application_id,
    first_submitted_at
  )
  values (
    v_email_hash,
    p_auth_user_id,
    v_application.id,
    v_application.submitted_at
  )
  returning id into v_registry_id;

  return query
  select v_application.id, v_registry_id, v_application.submitted_at;
end;
$$;

commit;
