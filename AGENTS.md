# Repository Guidelines

## Project Structure & Module Organization

This is a React Router 7 TypeScript app. Runtime code lives under `app/`: `root.tsx`, `routes.ts`, `entry.*.tsx`, shared UI in `app/components`, shared utilities in `app/lib`, database client/schema in `app/db`, and feature slices in `app/features/<feature>`. Feature slices keep route modules in `routes/`, local components in `components/`, read helpers in `queries/`, server mutations/domain workflows in `services/`, feature DTOs in `types/`, and Zod schemas in `validations/`. Database migrations live in `drizzle/`; public static assets in `public/`; automation and seed scripts in `scripts/`; Playwright specs in `tests/e2e`; Vitest setup in `tests/setup.ts`. `design/prototype` is a separate Vite prototype excluded from main TypeScript and lint runs.

## Build, Test, and Development Commands

- `npm ci`: install locked dependencies with Node `>=22.12.0`.
- `npm run dev`: start the React Router development server.
- `npm run build` then `npm start`: build and serve production output from `build/`.
- `npm run typecheck`: generate React Router types and run `tsc --noEmit`.
- `npm run lint` / `npm run lint:fix`: run ESLint, optionally fixing safe issues.
- `npm test` / `npm run test:watch`: run Vitest once or in watch mode.
- `npm run test:e2e`: run Playwright against the built app.
- `npm run db:local:up`, `npm run db:migrate`, `npm run db:generate`: start local Postgres and manage Drizzle migrations.
- `npm run prototype:dev`: run the design prototype.

## Coding Style & Naming Conventions

Use strict TypeScript and React function components. Follow existing 2-space indentation, double quotes, semicolons, and type-only imports. Prefer `~/` or `@/` aliases for app imports. Name route files `*.route.tsx`, server-only modules `*.server.ts`, tests `*.test.ts`/`*.test.tsx`, and Playwright specs `*.spec.ts`. Keep feature-specific code inside its feature slice unless it is genuinely shared.

## Testing Guidelines

Vitest covers app and script tests matching `app/**/*.test.ts(x)` and `scripts/**/*.test.mjs`; React component tests run in `jsdom` with `tests/setup.ts`. Place tests near the code they verify. Use Playwright for browser flows in `tests/e2e` across desktop Chrome and mobile Chrome. No coverage threshold is configured; add regression tests for changed behavior.

## Commit & Pull Request Guidelines

History uses Conventional Commit style with scopes, for example `feat(admin): ...`, `test(e2e): ...`, `docs(design): ...`, and `chore(seed): ...`. Keep commits focused and imperative. PRs should summarize behavior changes, link the relevant issue or spec, list validation commands, and include screenshots or recordings for UI changes.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local setup and never commit secrets. Review `docs/specification.md`, `docs/beta-readiness.md`, and `design/DESIGN.md` before changing product behavior, beta operations, or cross-cutting architecture.
