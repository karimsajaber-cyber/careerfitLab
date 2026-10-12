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

Configure OpenAI only as a Supabase Edge Function secret. Never put this value in Vite variables, frontend source, or Git:

```sh
npx supabase secrets set AI_API_KEY="your-provider-key"
```

The provider adapter uses OpenAI's Responses API at `https://api.openai.com/v1/responses` with the development model `gpt-5-mini`, a 400-token output limit, and `store: false`. Replace only `callAIProvider()` if the provider changes; the frontend request and response contract remain stable.

Deploy the function with:

```sh
npx supabase functions deploy careerfit-assistant
```

## Developer Setup

New contributors should start here:

[Developer Onboarding Guide](./DEVELOPER_ONBOARDING.md)
