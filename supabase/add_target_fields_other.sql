-- Run once in the Supabase SQL Editor for an existing CareerFit Lab project.
alter table public.applicant_profiles
  add column if not exists target_fields_other text;
