# Cloud Certification Simulator

A practice platform for two AWS certifications:

- **AWS Certified Solutions Architect – Associate (SAA-C03)**
- **AWS Certified AI Practitioner (AIF-C01)**

Visitors can browse the landing page, sign in with Google or GitHub, and answer 20 free questions per certification in Learning Mode. A Premium subscription (monthly or annual, through Stripe) unlocks the full question bank, timed mock exams, reviews of incorrect answers, saved sessions and topic analytics.

> The platform is independent. It is not affiliated with, endorsed by or sponsored by Amazon Web Services. All bundled questions are original practice material.

---

## Contents

1. [Architecture](#architecture)
2. [Local development](#local-development)
3. [Configure Supabase](#configure-supabase)
4. [Configure Google OAuth](#configure-google-oauth)
5. [Configure GitHub OAuth](#configure-github-oauth)
6. [Configure Stripe](#configure-stripe)
7. [Deploy to Vercel](#deploy-to-vercel)
8. [Environment variables](#environment-variables)
9. [Content management](#content-management)
10. [Security model](#security-model)
11. [Testing](#testing)
12. [Project structure](#project-structure)
13. [Known limitations](#known-limitations)

---

## Architecture

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4, hand-rolled accessible components (no UI kit dependency) |
| Auth | Supabase Auth with Google and GitHub OAuth (PKCE, server-side code exchange) |
| Database | Supabase PostgreSQL with Row Level Security |
| Payments | Stripe Billing: Checkout, Customer Portal and signed webhooks |
| Hosting | Vercel, or any Node 20.9+ host |

```
Browser ──► Next.js pages (server components) ──► services ──► Supabase (service role, explicit user filters)
   │                                                 ▲
   └──► /api/* route handlers ── auth + same-origin + rate limit ─┘
Stripe ──► /api/stripe/webhook ── signature check ── idempotency ledger ── re-fetch subscription ── entitlements
```

**Key design decisions**

- **The server is the only source of truth for access.** Every simulator request runs through `PracticeEngine` ([src/lib/practice/engine.ts](src/lib/practice/engine.ts)). It checks session ownership, the user's current premium entitlement, the free-question set and the exam timer before it serves or scores anything. The UI never decides access.
- **Correct answers never reach the browser early.** The `questions` table has no client policies, and table privileges are revoked from client roles. Questions go to the browser through `toPublicQuestion()`, which strips answers and explanations. An answer is revealed only after the user submits it in Learning Mode, or after an exam is finished.
- **Entitlements come from webhooks.** Each Stripe webhook is verified, recorded in `billing_events` (for idempotency), and then the subscription's **current** state is fetched from Stripe. Duplicate and out-of-order events therefore converge on the same result. Each entitlement row has a `valid_until` date, which every request checks, so access lapses on time even if a webhook is missed.
- **Prices are configuration.** Plans live in the `plans` table, and admins edit them at `/admin/plans`. The bundled seed contains no prices.

---

## Local development

Prerequisites: Node 20.9+, Docker (for local Supabase).

```bash
npm install
cp .env.example .env.local

# 1. Start a local Supabase stack. This applies the migrations and supabase/seed.sql.
npx supabase start
#    Copy the printed "API URL", "anon key" and "service_role key" into .env.local

# 2. Load the 60 bundled practice questions (20 free + 10 premium per certification)
npm run seed:questions

# 3. Run the app
npm run dev        # http://localhost:3000
```

**Sign in locally.** Google and GitHub need OAuth apps, so set them up as described below and set `enabled = true` in [supabase/config.toml](supabase/config.toml). Then run `npx supabase stop && npx supabase start`.

**Make yourself an admin** after your first sign-in:

```bash
npx supabase db query "update public.profiles set role = 'admin' where email = 'you@example.com';"
# or run the same SQL in the Supabase dashboard SQL editor for a hosted project
```

Useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests: entitlements, practice engine, CSV validation, billing helpers |
| `npm run test:integration` | RLS tests against the Supabase in `.env.local` (local stack recommended) |
| `npm run seed:questions` | Insert or update bundled questions (idempotent, keyed by `external_ref`) |
| `npx supabase db reset` | Recreate the local DB from migrations and the seed |

---

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Alternatively, paste [supabase/migrations/20261010000000_init.sql](supabase/migrations/20261010000000_init.sql) into the SQL editor.
3. Seed the catalogue by running [supabase/seed.sql](supabase/seed.sql) in the SQL editor. Then run `npm run seed:questions` with the project's URL and service role key in `.env.local`.
4. Go to **Authentication → URL Configuration**:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback` (add `http://localhost:3000/auth/callback` for development)
5. Go to **Authentication → Providers**, enable Google and GitHub, and paste the client IDs and secrets from the next two sections. The secrets stay in Supabase and never reach the frontend.
6. **Account linking.** Supabase automatically links identities that share the same *verified* email into one user. If someone signs in with Google and later with GitHub using the same email, they get a single account and a single subscription. The `providers` column on `profiles` shows every linked provider. If a provider returns an unverified email, Supabase creates a separate user rather than risk an account takeover.

## Configure Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services → OAuth consent screen** and configure it (External; app name, support email, authorised domain).
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorised redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback` (local: `http://127.0.0.1:54321/auth/v1/callback`).
4. Copy the Client ID and Client secret into Supabase (**Authentication → Providers → Google**). For local development, put them in `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` instead.

## Configure GitHub OAuth

1. Go to GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL**: your site. **Authorization callback URL**: `https://<project-ref>.supabase.co/auth/v1/callback` (local: `http://127.0.0.1:54321/auth/v1/callback`).
3. Generate a client secret. Copy the Client ID and secret into Supabase (**Providers → GitHub**), or into `SUPABASE_AUTH_EXTERNAL_GITHUB_*` for local development.

## Configure Stripe

1. **Products and prices.** In the Stripe Dashboard, create a product such as "Premium" with two **recurring** prices: monthly and yearly, in your chosen currency.
2. **Link the prices.** Sign in as an admin, open `/admin/plans`, and for each Premium plan enter the display price, the currency and the Stripe `price_…` ID. Customers are charged the Stripe price; the display price is what the pricing page shows, so keep the two in sync.
3. **Customer portal.** Go to **Settings → Billing → Customer portal** and enable cancellation, payment method updates and invoice history. Optionally allow switching between the two prices.
4. **Webhook.** Go to **Developers → Webhooks → Add endpoint** and enter `https://your-domain.com/api/stripe/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `customer.subscription.paused`, `customer.subscription.resumed`
   - `invoice.paid`, `invoice.payment_failed`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. **Local testing** with the [Stripe CLI](https://docs.stripe.com/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints a whsec_… secret for .env.local
   stripe trigger checkout.session.completed
   ```
   Use test card `4242 4242 4242 4242`.

**Access policy**

| Stripe status | Premium access |
|---|---|
| `active`, `trialing` | Until `current_period_end` + 1 hour (renewal buffer) |
| `active` with `cancel_at_period_end` | Until the end of the paid period, then it stops |
| `past_due` | Until `current_period_end` + `SUBSCRIPTION_GRACE_DAYS` (default 3) |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` | None |

The policy is implemented in [src/lib/domain/entitlements.ts](src/lib/domain/entitlements.ts) and covered by unit tests. A subscription whose price isn't mapped to a plan grants **no** access and logs an error.

---

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework preset is Next.js.
2. Add every variable from [Environment variables](#environment-variables) under **Project → Settings → Environment Variables**. Mark the server-only ones as Sensitive.
3. Set `NEXT_PUBLIC_SITE_URL` to the production URL. Update the Supabase redirect URLs and the Stripe webhook endpoint to the same domain.
4. Deploy, sign in once, promote yourself to admin (SQL above), then configure plans at `/admin/plans`.
5. **Monitoring.** Logs are structured JSON lines (see [src/lib/logger.ts](src/lib/logger.ts)), and unhandled server errors are captured by `onRequestError` in [src/instrumentation.ts](src/instrumentation.ts). Connect a Vercel log drain (Datadog, Axiom, Better Stack and so on), and alert on `"level":"error"` and on `stripe webhook` failures.

Any Node 20.9+ host works the same way: `npm ci && npm run build && npm start`.

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL, used for OAuth and Stripe redirects and the CSRF origin check |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server** | Server data access. Never expose. |
| `STRIPE_SECRET_KEY` | **server** | Stripe API key. Checkout is disabled when unset. |
| `STRIPE_WEBHOOK_SECRET` | **server** | Verifies webhook signatures |
| `SUBSCRIPTION_GRACE_DAYS` | server | Days of access while a payment is past due (0–30, default 3) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | public | Shown on the Contact and legal pages |
| `SUPABASE_AUTH_EXTERNAL_{GOOGLE,GITHUB}_{CLIENT_ID,SECRET}` | local only | Read by `supabase/config.toml` for the local auth server |

See [.env.example](.env.example).

---

## Content management

Admins (`profiles.role = 'admin'`) get an **Admin** link in the header.

- **`/admin`** shows question counts per certification and warns when the published free set isn't exactly 20, or when plans have no price.
- **`/admin/questions`** lets you search and filter, bulk publish or unpublish, and edit.
- **`/admin/questions/new`** and **`/admin/questions/[id]`** are the editor: certification, single or multiple answer, options A–F, correct answer(s), explanation, topic, difficulty, free or premium, free order, and published flag.
- **`/admin/import`** handles CSV import, which happens in two steps:
  1. **Validate.** The server checks every row: missing fields, invalid question types, answers that refer to options that don't exist, single-answer questions with several answers, gaps in the options, bad booleans, duplicates inside the file (by normalised text or `external_ref`), duplicates against the database, and malformed CSV. It also warns if the free set won't contain exactly 20 questions.
  2. **Import.** The server validates the file again and applies it in **one database transaction** (`import_questions`), so it all succeeds or nothing changes. Rows whose `external_ref` already exists update that question. New rows are drafts unless `is_active=true`.
- **`/admin/plans`** edits plan names, display prices, currency, Stripe price IDs, features, and whether each plan is shown.

CSV columns: `certification, external_ref, question_type, question_text, option_a … option_h, correct_answer, explanation, topic, difficulty, is_free, free_order, is_active`. You can download a template from the import page.

**Free set.** The free questions are the published questions with `is_free = true`, ordered by `free_order`, capped at `certifications.free_question_limit` (20). If a question is moved out of the free set, open free sessions stop serving it immediately.

**Bundled content.** [content/questions/](content/questions/) holds 30 original questions per certification. The unit tests validate all of them. Add your own original or properly licensed questions. Don't import exam dumps.

---

## Security model

| Concern | Control |
|---|---|
| Authentication | Supabase OAuth with PKCE. The code is exchanged on the server (`/auth/callback`), and sessions live in HTTP-only cookies that the proxy refreshes. `getUser()`, which validates the token, is used on the server, never `getSession()` alone. |
| Authorisation | Every protected page calls `requireUser()` or `requireAdmin()` itself, because layouts and the proxy are not security boundaries. Every API route calls `requireApiUser()` or `requireApiAdmin()`. Admin endpoints return 404 to non-admins. |
| Paid access | Checked on the server for every session start, view and answer through `user_entitlements.valid_until`. Frontend flags and local storage are never trusted. |
| Answer secrecy | `questions` has no client grants. Public question objects carry no answer fields. Exam answers are hidden until the exam is finished. A server-side timer, with 10 s of latency grace, rejects late answers. |
| RLS | Clients can read their own profile, sessions, answers, subscriptions and entitlements, plus active certifications and plans. All client writes are revoked, and every write goes through the server. |
| CSRF | Mutating endpoints require a same-origin `Origin` header (or `Sec-Fetch-Site: same-origin`). Auth cookies are `SameSite=Lax`. |
| XSS | React escaping. The only `dangerouslySetInnerHTML` is a static theme script (no user input). Restrictive CSP, `frame-ancestors 'none'`, `nosniff` and HSTS are set in [next.config.ts](next.config.ts). |
| SQL injection | Only parameterised PostgREST queries. Search terms have LIKE wildcards escaped. |
| Open redirects | `?next=` accepts relative same-site paths only ([src/lib/safe-redirect.ts](src/lib/safe-redirect.ts)). |
| Abuse | Per-user and per-IP rate limits on sign-in, session creation, answers, billing, admin and webhooks ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)). Request bodies are capped in size. |
| Payments | No card data touches the app. Webhooks are signature-verified, idempotent, and re-fetch state from Stripe. Customer creation uses idempotency keys. Checkout is refused while a subscription is active, which prevents double subscriptions. |
| Secrets | All secrets are server-side environment variables. OAuth client secrets live in Supabase. |

---

## Testing

```bash
npm test                  # 55 unit tests
npm run test:integration  # RLS tests (needs a running Supabase and .env.local)
```

The unit tests cover:

- **Entitlement policy**: every Stripe status, grace periods, expiry.
- **Practice engine** (against an in-memory repository with the same semantics as the database):
  - Free sessions are capped at exactly 20 free questions, separately per certification.
  - Free users can't start premium sessions or Exam Mode.
  - Answers stay hidden until they should be revealed.
  - Exam answers can be changed until submission, then are revealed in full.
  - The timer auto-submits and rejects late answers.
  - A lapsed subscription blocks continuing or reviewing premium sessions, while free practice still works.
  - Other users' sessions return 404.
  - A question moved out of the free set stops being served.
- **CSV validation**: each rejection rule, duplicates and malformed files. The bundled questions are also validated.
- **Billing helpers**: both Stripe API shapes for the period end, and price-to-plan mapping.
- **Redirect safety and rate limiting.**

The integration tests check RLS with real JWTs. Clients can't read questions, can't read other users' data, and can't write entitlements, subscriptions, scores, roles or prices.

---

## Project structure

```
content/questions/          Original practice questions (JSON), loaded by npm run seed:questions
scripts/seed-questions.ts   Validated, idempotent question loader
supabase/
  migrations/               Schema, RLS policies, import function
  seed.sql                  Certifications and plans (no prices)
  config.toml               Local Supabase settings
src/
  proxy.ts                  Session refresh and optimistic redirect for signed-out users
  instrumentation.ts        Structured logging of unhandled server errors
  app/                      Pages and route handlers (api/, auth/, admin/, practice/ …)
  components/               UI (simulator/, admin/, landing sections)
  lib/
    domain/                 Pure logic: entitlements, questions, CSV, billing, sessions (unit tested)
    practice/               PracticeEngine plus its Supabase repository
    services/               Catalogue, access, billing, analytics, admin queries
    server/                 HTTP helpers: auth guards, CSRF, rate limits, error mapping
    supabase/               User-scoped and service-role clients
tests/                      Unit tests; integration/ holds the RLS tests
```

## Known limitations

- The in-memory rate limiter works per server instance. For strict global limits on serverless, swap it for a shared store such as Upstash Redis behind the same `limit()` function.
- Practice scores are simple percentages. The real exams use scaled scoring, and the UI says so.
- The 30 bundled questions per certification are enough to exercise every feature. Grow the bank through the admin importer before launch.
- The legal pages are templates. Have them reviewed for your jurisdiction, particularly the refund terms.
