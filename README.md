# CareerFit Lab

## Supabase setup

1. Create a Supabase project.
2. In its SQL Editor, run [supabase/schema.sql](supabase/schema.sql).
3. Deploy `supabase/functions/submit-application` with the Supabase CLI.
4. Add the project URL and anon key to `.env` using `.env.example`.
5. In Edge Function secrets, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never place the service-role key in `.env` for Vite.

The function is the only public write path. Tables and the private `cvs` storage bucket have no public RLS policies. Configure permitted origins for production before launch, and add Turnstile in the Edge Function if spam becomes a problem.

## CareerFit Assistant Edge Function

`supabase/functions/careerfit-assistant` is an independent public assistant endpoint. It is not connected to the React chatbot yet.

The function accepts `POST` JSON in this shape:

```json
{
  "message": "visitor message",
  "language": "ar",
  "history": [{ "role": "user", "content": "..." }]
}
```

`language` is limited to `ar` or `en`. `history` is optional, limited to 12 entries, and only accepts `user` and `assistant` roles. Messages and history content are limited to 2,000 characters. Invalid requests return `{ "ok": false, "error": "invalid_request" }`.

Configure the provider only as Supabase Edge Function secrets. Never put these values in Vite variables, frontend source, or Git:

```sh
npx supabase secrets set AI_API_KEY="your-provider-key"
npx supabase secrets set AI_API_URL="https://provider.example/v1/chat/completions"
npx supabase secrets set AI_MODEL="provider-model-name"
```

The provider adapter currently expects an OpenAI-compatible chat-completions response. Replace only `callAIProvider()` if the provider changes; the frontend request and response contract remain stable.

Deploy the function with:

```sh
npx supabase functions deploy careerfit-assistant
```
