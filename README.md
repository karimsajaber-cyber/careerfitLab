# CareerFit Lab

## Supabase setup

1. Create a Supabase project.
2. In its SQL Editor, run [supabase/schema.sql](supabase/schema.sql).
3. Deploy `supabase/functions/submit-application` with the Supabase CLI.
4. Add the project URL and anon key to `.env` using `.env.example`.
5. In Edge Function secrets, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never place the service-role key in `.env` for Vite.

The function is the only public write path. Tables and the private `cvs` storage bucket have no public RLS policies. Configure permitted origins for production before launch, and add Turnstile in the Edge Function if spam becomes a problem.
