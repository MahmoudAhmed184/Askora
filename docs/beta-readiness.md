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
