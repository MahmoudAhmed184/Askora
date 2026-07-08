# Beta Readiness

This beta release assumes the app is deployed with managed Postgres and the
current Drizzle migrations applied.

## Environment

Required runtime values on Vercel:

- `APP_NAME`
- `APP_URL`
- `PUBLIC_BETA_NOINDEX=true`
- `DATABASE_URL` for pooled Neon runtime access
- `DIRECT_DATABASE_URL` for migrations and admin scripts
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `TRUSTED_ORIGINS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`

`PUBLIC_BETA_NOINDEX=true` keeps beta pages out of search results through
headers and meta tags. Do not add a sitemap route during beta.

## Migrations

Run migrations against the direct Neon connection:

```bash
DIRECT_DATABASE_URL="postgres://..." npm run db:migrate
```

Slice 16 adds `starter_prompt` to the `question_source` enum. Existing
`public_profile` questions remain the default.

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

## Smoke Tests

Run foundation smoke without a database:

```bash
npm run test:e2e
```

When `DATABASE_URL` is available, Playwright runs the DB-backed beta smoke loop:
setup, no-JavaScript public ask, inbox, starter prompt creation, publish, public
thread, follow-up, like/follow, report creation, admin action, and mobile profile
and inbox checks.

External smoke still needs real service credentials:

- Google OAuth sign-in
- Resend magic-link delivery
- Vercel preview and production routing
- Neon branch migration on the target deployment

## Visual QA

The redesign uses `design/prototype` as the source artifact. Recapture prototype
reference screens when the prototype changes:

```bash
npm run prototype:dev -- --host 127.0.0.1 --port 5177
node design/prototype/capture-screenshots.mjs http://127.0.0.1:5177/
```

For real routes, seed beta fixtures, start the app, and capture mobile plus
desktop screenshots:

```bash
BETA_SEED_CONFIRM=reset-beta-fixtures \
BETA_SEED_SCOPE=preview \
DIRECT_DATABASE_URL="postgres://..." \
npm run beta:seed

npm run dev -- --host 127.0.0.1 --port 5173
SCREENSHOT_DIR=screenshots/redesign-20260601-port \
node scripts/capture-page-screenshots.mjs --base-url http://127.0.0.1:5173 --viewport=all
```

The real-route capture reports console issues, page errors, 5xx responses,
final URLs, and horizontal overflow for public, signed-in app, inbox workflow,
answer editor, settings, profile, thread, follow-up, and admin surfaces.

Current redesign QA evidence:

- Prototype screenshots: `design/prototype/screenshots/`.
- Real app screenshots: `screenshots/redesign-20260601-port/`.
- Completed-profile app captures should start from `/feed`.
- Mobile and desktop captures should report zero horizontal overflow and no
  console/page/server errors after any dev-server warm-up recapture.

## Cleanup Notes

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
`/prompts`, `/notifications`, and `/settings/profile`.

`design/prototype` remains the visual source artifact for the redesign. Its
local prototype components are not production route code.

Cleanup verification should include:

- Static reachability checks for removed files and old route names.
- `npm run typecheck`.
- `npm run lint`.
- `npm run test`.
- `npm run build`.
- `npm run test:e2e` when `DATABASE_URL` is available for DB-backed smoke coverage.
