# Beta Readiness

This beta release assumes the app is deployed with managed Postgres and the
current Drizzle migrations applied.

## Environment

Required runtime values on Vercel:

- `APP_NAME`
- `APP_URL`
- `PUBLIC_BETA_NOINDEX=true`
- `DATABASE_URL` using the Supabase transaction pooler on port `6543`
- `DIRECT_DATABASE_URL` using the Supabase session pooler on port `5432`
- `CRON_SECRET` (at least 32 random characters) for the scheduled retention job
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `TRUSTED_ORIGINS`
- `TRUSTED_PROXY_IP_HEADER=x-vercel-forwarded-for` (the Vercel-owned client-IP header)
- `TRUSTED_PROXY_HOPS=1` (fallback X-Forwarded-For proxy depth)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`PUBLIC_BETA_NOINDEX=true` keeps beta pages out of search results through
headers and meta tags. Do not add a sitemap route during beta.

## Migrations

Vercel runs migrations through the IPv4-compatible Supabase session pooler
before each build via `npm run deploy:build`. Runtime traffic uses the
transaction pooler, which is intended for autoscaling and serverless workloads.
A failed migration stops the deployment. To run the same step manually:

```bash
DIRECT_DATABASE_URL="postgres://..." npm run db:migrate
```

GitHub Actions validates typechecking, lint, unit/component tests, the
production bundle, and the no-database Playwright smoke suite on pull requests
and pushes to `main`. The workflows use the same Node 24 runtime as Vercel,
immutable action commit SHAs, least-privilege tokens, CodeQL, dependency review,
and weekly Dependabot updates.

Vercel's Git integration owns deployments so GitHub Actions does not need a
long-lived Vercel token and cannot create a duplicate deployment. A successful
Vercel production deployment triggers a secretless GitHub Actions smoke check
for the public page and `/up` database readiness endpoint. Production migrations
remain part of `npm run deploy:build` and use the Supabase session pooler.

Do not expose production database credentials to pull-request workflows or
preview deployments. Configure a separate Supabase branch before enabling
database-backed Vercel previews so preview migrations cannot alter production.

Migration 0016 retires the standalone starter-prompt source. It removes any
obsolete starter-prompt questions and narrows `question_source` to
`public_profile`.

## Seed

Seed fixtures are deterministic and use only `beta_` IDs, usernames, public IDs,
session IDs, and emails.

```bash
BETA_SEED_CONFIRM=reset-beta-fixtures \
BETA_SEED_SCOPE=preview \
DIRECT_DATABASE_URL="postgres://..." \
npm run beta:seed
```

The seed script refuses `NODE_ENV=production` and `VERCEL_ENV=production`. It
resets only deterministic beta rows, then recreates completed, incomplete,
suspended, and admin users; signed Better Auth sessions; inbox and filtered
questions; a published thread; social rows; reports; and blocks.

## Admin Role Management

Admin roles remain a manual operations task during MVP. Every change requires
an action-specific confirmation; production also requires the explicit
`--allow-production` override. Demotion refuses to remove the last admin.

```bash
npm run admin:promote -- user@example.com --confirm=promote
npm run admin:demote -- user@example.com --confirm=demote

NODE_ENV=production npm run admin:demote -- user@example.com \
  --confirm=demote --allow-production
```

## Smoke Tests

Run foundation smoke without a database:

```bash
npm run test:e2e
```

When `DATABASE_URL` is available, Playwright runs the DB-backed beta smoke loop:
setup, no-JavaScript public ask, inbox, self-asking, publish, public thread,
inline follow-up, like/follow, report creation, admin action, settings, and
mobile profile and inbox checks.

External smoke still needs real service credentials:

- Google OAuth sign-in
- Resend magic-link delivery
- Vercel preview and production routing
- Supabase branch migration on the target deployment

## Visual QA

The redesign uses `design/prototype` as the source artifact. Recapture prototype
reference screens when the prototype changes:

```bash
npm run prototype:dev -- --host 127.0.0.1 --port 5177
node design/prototype/capture-screenshots.mjs http://127.0.0.1:5177/
```

For real routes, seed beta fixtures and run the Playwright desktop/mobile
projects:

```bash
BETA_SEED_CONFIRM=reset-beta-fixtures \
BETA_SEED_SCOPE=preview \
DIRECT_DATABASE_URL="postgres://..." \
npm run beta:seed

npm run test:e2e
```

Completed-profile app checks should start from `/feed`. Desktop and mobile runs
must report zero horizontal overflow and no console, page, or server errors.

## Cleanup Notes

Vercel runs `/api/cron/cleanup` daily at 03:00 UTC. The route requires the
`Authorization: Bearer $CRON_SECRET` header and uses `DIRECT_DATABASE_URL` (or
the runtime database URL as a fallback). It anonymizes expired deletion
requests, deletes expired notifications and stale rate-limit counters, releases
failed-signup invite claims after 30 minutes, and scrubs expired question safety
metadata. Configure the same `CRON_SECRET` in
the Vercel project before enabling the beta; a missing secret causes production
startup validation to fail.

The production app is organized around feature slices:

- Route modules live in `routes/`.
- Feature-local UI lives in `components/`.
- Read helpers live in `queries/`.
- Server mutations and domain workflows live in `services/`.
- Shared DTO exports live in `types/`.
- Zod schemas live in `validations/`.

Shared production UI now lives in `app/components/layout`,
`app/components/shared`, and primitive-specific folders under
`app/components/ui`.

Signed-in app routes are top-level product URLs such as `/feed`, `/inbox`,
`/notifications`, and `/settings/profile`.

`design/prototype` remains the visual source artifact for the redesign. Its
local prototype components are not production route code.

Cleanup verification should include:

- Static reachability checks for removed files and old route names.
- `npm run typecheck`.
- `npm run lint`.
- `npm run test`.
- `npm run build`.
- `npm run test:e2e` when `DATABASE_URL` is available for DB-backed smoke coverage.
