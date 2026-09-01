-- Run this file in the Supabase SQL Editor before deploying the Edge Function.
create extension if not exists pgcrypto;

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null,
  phone text not null check (char_length(trim(phone)) >= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists applicants_email_normalized_idx
  on public.applicants (lower(email));

create table if not exists public.applicant_profiles (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  institution text,
  major text,
  graduation_year text,
  current_status text,
  target_role text,
  target_industry text,
  target_fields text,
  english_level text,
  career_goal text,
  availability text,
  current_profile_summary text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists applicant_profiles_applicant_id_idx
  on public.applicant_profiles(applicant_id);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'accepted', 'waitlisted', 'rejected', 'withdrawn')),
  motivation text,
  target_job_url text,
  privacy_consent boolean not null check (privacy_consent),
  privacy_consent_version text not null default '2026-09',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_applicant_submitted_idx
  on public.applications(applicant_id, submitted_at desc);

create table if not exists public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  cv_status text not null default 'current' check (cv_status in ('current', 'needs_update', 'not_sure')),
  changes_since_cv text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cv_documents_application_id_idx on public.cv_documents(application_id);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  answers jsonb not null,
  score integer not null check (score >= 0),
  result_tier text not null check (result_tier in ('ready', 'preparing', 'starter')),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_application_id_idx on public.quiz_attempts(application_id);

alter table public.applicants enable row level security;
alter table public.applicant_profiles enable row level security;
alter table public.applications enable row level security;
alter table public.cv_documents enable row level security;
alter table public.quiz_attempts enable row level security;

-- No public table policies: anonymous browsers cannot read or write applicant data.
-- The Edge Function uses the Supabase service role and performs validated writes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

-- No storage.objects policies: CV files stay private and are only written by the Edge Function.
