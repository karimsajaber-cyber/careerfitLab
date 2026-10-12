# CareerFit Lab — Developer Onboarding

This document is the starting point for any developer joining CareerFit Lab.

The goal is simple: after receiving repository access and Supabase project access, a developer should be able to clone the project, configure it, run it locally, understand the main architecture, make a safe branch, run the relevant checks, and open a pull request without asking for setup instructions.

---

## 1. What this project is

CareerFit Lab is a React + Vite application backed by Supabase.

Current major areas include:

- User authentication
- Career Profile
- Application flow
- Application submission protection
- Admin flows
- Supabase Edge Functions
- Semantic validation / AI-assisted validation
- CareerFit Assistant
- Database-side security and RPC logic

The backend and database rules are authoritative. Frontend behavior must not bypass server-side validation, identity checks, rate limits, RLS, or protected RPC flows.

---

## 2. Required access before starting

A team member needs these two permissions once:

1. Access to the GitHub repository:
   `https://github.com/karimsajaber-cyber/careerfitLab`

2. Access to the CareerFit Supabase project through their own Supabase account.

Do not share passwords, personal API keys, service-role keys, or owner credentials between team members.

---

## 3. Local prerequisites

Install:

- Git
- Node.js 20+ recommended
- npm
- VS Code recommended

Supabase CLI does not need to be installed globally. This repository includes the Supabase CLI as a development dependency and commands should use:

```powershell
npx supabase ...
```

Confirm tools:

```powershell
git --version
node --version
npm --version
```

---

## 4. Clone the project

Open PowerShell in the folder where you keep development projects:

```powershell
git clone https://github.com/karimsajaber-cyber/careerfitLab.git
cd careerfitLab
```

Confirm the repository is on `main`:

```powershell
git branch --show-current
```

Expected:

```text
main
```

---

## 5. Install dependencies

Run:

```powershell
npm install
```

Do not manually install packages that are already declared in `package.json`.

Current core stack includes:

- React
- React DOM
- Vite
- Supabase JavaScript client
- Supabase CLI

---

## 6. Create the local environment file

Create your local `.env` from the committed template:

```powershell
Copy-Item .env.example .env
```

`.env` is local-only and must never be committed.

The frontend currently needs the public Supabase browser configuration, including:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The project may also contain public-contact variables such as:

```text
VITE_CONTACT_EMAIL=
VITE_CONTACT_WHATSAPP=
```

Use the actual variables already listed in `.env.example` as the source of truth.

### Where to get the Supabase frontend values

Open the CareerFit Supabase project using your own authorized account and retrieve the project URL and public/anon key from the project API settings.

Only values intended for browser use belong in Vite variables.

### Never put these in `.env`

Never place any of the following in a Vite/frontend environment file:

- `SUPABASE_SERVICE_ROLE_KEY`
- AI provider secret keys
- private tokens
- database passwords
- owner credentials
- any secret intended only for Edge Functions or backend infrastructure

Anything prefixed with `VITE_` is bundled into frontend code and must be treated as public.

---

## 7. Run CareerFit locally

Start the frontend:

```powershell
npm run dev
```

Vite will print the local address, normally similar to:

```text
http://localhost:5173/
```

Open that address in the browser.

To stop the development server:

```text
Ctrl + C
```

---

## 8. Build check

Before opening a pull request for frontend/shared-code changes, run:

```powershell
npm run build
```

A successful Vite build is required.

A bundle-size warning is not automatically a failed build, but real build errors must be fixed.

---

## 9. Main project structure

```text
src/
  components/        React UI and feature components
  lib/               shared validation, policies, helpers, and tests
  App.jsx             main application composition
  main.jsx            React entry point
  styles.css          project styling

supabase/
  functions/          Supabase Edge Functions
  schema.sql          database/schema reference
  *.sql               reviewed database change/reference files
```

Important Edge Function areas currently include:

```text
supabase/functions/create-application-draft/
supabase/functions/submit-application/
supabase/functions/cleanup-application-drafts/
supabase/functions/careerfit-assistant/
supabase/functions/_shared/
```

---

## 10. Canonical CareerFit flows

### Career Profile

The intended behavior is:

```text
No profile row
→ Create

Existing profile row
→ View

View
→ explicit Edit

Cancel
→ restore persisted View

Save
→ authoritative backend save
→ View
```

Row existence controls whether the user is creating or viewing a profile.

Validation controls whether Save is allowed.

An existing incomplete/legacy profile must not silently be replaced by Application data.

### Application

The intended flow is:

```text
Application text
→ text-only draft
→ Magic Link verification
→ verified return
→ optional CV
→ final submission
→ success
```

Do not introduce pre-verification CV staging.

Final submission is authoritative only when the backend creates the real Application successfully.

### Identity model

Keep these concepts separate:

```text
auth.users
= person identity

Application draft
= temporary submission attempt

Application
= submitted application

Career Profile
= professional identity/profile

Admin
= privileged operational context
```

Admin status alone does not automatically bypass normal Application submission invariants.

---

## 11. Security rules

These rules are mandatory.

Do not:

- expose `service_role` in frontend code
- put secrets in Git
- bypass backend validation from the UI
- weaken RLS to make a feature work
- log sensitive personal data unnecessarily
- trust client-supplied identity when the backend can derive it
- remove duplicate-submission protection
- expand RPC permissions without an explicit security review
- execute review SQL files casually
- use `git add .` without checking what will be staged
- force-push `main`
- rewrite Git history as part of normal development

Prefer:

- least privilege
- backend-authoritative validation
- explicit identity checks
- bounded retries
- reversible changes
- narrow pull requests
- tests that match the actual change blast radius

---

## 12. Database / SQL rules

The repository currently contains SQL files directly under `supabase/`.

There is not yet a general migration workflow that a developer should invent independently.

Therefore:

### Do not run arbitrary `*_review.sql` files

A filename ending in `_review.sql` does **not** mean:

> run this automatically

Some files are implementation records, reviewed production changes, diagnostics, security work, or one-time operational scripts.

Before applying a database change:

1. understand the exact target object
2. review the current production definition
3. review permissions/security impact
4. keep the change narrowly scoped
5. get the change reviewed
6. apply it intentionally
7. verify production afterward

Never bulk-run the `supabase` SQL directory.

---

## 13. Supabase Edge Functions

Use the repository-local CLI:

```powershell
npx supabase --version
```

A developer must use their own authorized Supabase account.

Login when needed:

```powershell
npx supabase login
```

Linking or deploying must target the CareerFit project intentionally.

Do not deploy a function merely because its local code changed. Review the diff and affected flow first.

Typical deploy syntax is:

```powershell
npx supabase functions deploy <function-name>
```

Examples of function names in this project:

```text
create-application-draft
submit-application
cleanup-application-drafts
careerfit-assistant
```

Backend secrets must remain Supabase Edge Function secrets.

Do not copy service-role or AI secrets into frontend files.

---

## 14. Semantic validation / AI rules

CareerFit uses semantic validation in selected flows.

The core business behavior must remain provider-independent.

Important principles:

- deterministic validation is preferred where AI is unnecessary
- AI/provider calls are used only where semantic interpretation adds value
- provider failures must degrade safely
- AI output must not silently override core business rules
- sensitive personal data should not be unnecessarily sent to AI providers
- shared semantic modules can affect multiple flows, so regression scope must widen when shared modules change

Do not change semantic rollout modes, provider behavior, quotas, or enforcement policy casually.

---

## 15. Tests

The repository contains targeted test files for application, profile, and semantic behavior.

Useful existing checks include files such as:

```text
src/lib/applicationSubmissionParity.test.mjs
src/lib/applicationSubmissionRegistry.test.mjs
src/lib/professionalDataValidation.test.mjs
supabase/functions/_shared/semanticIntegration.test.mjs
supabase/functions/_shared/semanticValidationPhase2.test.mjs
```

Run the tests relevant to the code you changed.

Do not repeatedly run expensive provider/evaluation tests when the change cannot affect them.

For shared validation or shared semantic modules, widen the regression scope.

Always run:

```powershell
npm run build
```

for changes that can affect the frontend build.

---

## 16. Git workflow

Do not develop directly on `main`.

Start from an updated main branch:

```powershell
git checkout main
git pull origin main
```

Create a branch:

```powershell
git checkout -b feature/short-description
```

Examples:

```text
feature/profile-improvement
fix/application-validation
chore/test-cleanup
```

Before committing:

```powershell
git status --short
```

Stage only the intended files.

Example:

```powershell
git add -- src/components/Example.jsx src/lib/example.js
```

Avoid:

```powershell
git add .
git add -A
```

unless you have deliberately reviewed every affected file.

Check the staged diff without dumping unnecessary output:

```powershell
git diff --cached --stat
git diff --cached --check
```

Commit:

```powershell
git commit -m "Describe the change clearly"
```

Push your branch:

```powershell
git push -u origin HEAD
```

Then open a pull request.

Do not push directly to `main` unless the repository owner explicitly uses that workflow for a specific change.

Never use `--force` on `main`.

---

## 17. Pull request checklist

A pull request should explain:

- what changed
- why it changed
- which CareerFit flow is affected
- security impact
- database impact
- Edge Function impact
- tests performed
- manual acceptance performed, if applicable

Before requesting review, confirm:

```text
[ ] Only intended files are included
[ ] No .env file is included
[ ] No secrets are included
[ ] No personal credentials are included
[ ] Build passes when relevant
[ ] Relevant tests pass
[ ] Backend/security invariants are preserved
[ ] Database change is explicitly identified
[ ] No unrelated refactor was mixed in
```

---

## 18. Files that should remain local/private

Do not commit:

```text
.env
.env.local
.env.*.local
supabase/.temp/
```

Also do not commit local diagnostics, temporary review bundles, personal notes, secret-bearing files, or machine-specific outputs unless they are intentionally converted into a safe project artifact.

Use `.gitignore` as an additional safeguard, not as a substitute for reviewing `git status`.

---

## 19. Contact variables vs secrets

CareerFit may use frontend environment variables for public contact information.

Remember:

- hiding a value from GitHub does not make it secret if it is sent to the browser
- Vite variables are client-visible
- public contact data may be configured via `.env`
- passwords, tokens, private API keys, service-role keys, and infrastructure credentials must never be exposed to the browser

---

## 20. If something fails

Do not immediately patch around the symptom.

Use this order:

```text
1. Reproduce the problem once
2. Identify the affected flow
3. Check the strongest source of truth
4. Find the narrow root cause
5. Make one bounded change
6. Run the relevant regression gate
7. Stop once acceptance passes
```

Do not weaken security, disable validation, or remove guards just to make an error disappear.

---

## 21. Quick start — normal frontend contributor

For a developer who already has GitHub and Supabase access:

```powershell
git clone https://github.com/karimsajaber-cyber/careerfitLab.git
cd careerfitLab
npm install
Copy-Item .env.example .env
```

Fill the public Supabase frontend values in `.env`, then:

```powershell
npm run dev
```

Before submitting work:

```powershell
npm run build
git status --short
```

Create a branch, commit only intended files, push the branch, and open a pull request.

---

## 22. First-day rule

A new team member should **not** need the owner's password, personal email password, Supabase service-role key, AI provider key, or any private credential to start normal frontend development.

If the application appears to require one of those values in frontend code, stop: the architecture is being used incorrectly.
