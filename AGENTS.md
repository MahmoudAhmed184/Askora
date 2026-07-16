# Repository Guidelines

## Project Structure & Module Organization

Askora is a React Router 7 application written in TypeScript. Production code lives in `app/`: feature slices are under `app/features/<feature>`, shared UI under `app/components`, common utilities under `app/lib`, and database code under `app/db`. Within a feature, keep routes in `routes/`, UI in `components/`, reads in `queries/`, server workflows in `services/`, DTOs in `types/`, and Zod schemas in `validations/`. Drizzle migrations live in `drizzle/`, static assets in `public/`, operational scripts in `scripts/`, and Playwright tests in `tests/e2e/`. `design/prototype/` is a separate Vite prototype and is excluded from main lint and typecheck runs.

## Build, Test, and Development Commands

- `npm ci`: install locked dependencies; Node 22.12 or newer is required.
- `npm run dev`: start the React Router development server.
- `npm run build && npm start`: build and serve the production bundle.
- `npm run typecheck`: generate route types and run strict TypeScript checks.
- `npm run lint` / `npm run lint:fix`: check ESLint rules or apply safe fixes.
- `npm test` / `npm run test:watch`: run Vitest once or in watch mode.
- `npm run test:e2e`: run Playwright on desktop and mobile Chromium.
- `npm run db:local:up`, `npm run db:migrate`, `npm run db:generate`: manage local Postgres and Drizzle migrations.

## Coding Style & Naming Conventions

Use strict TypeScript, React function components, 2-space indentation, double quotes, and semicolons. Prefer type-only imports and the `~/` or `@/` aliases for app code. Name routes `*.route.tsx`, server-only modules `*.server.ts`, unit/component tests `*.test.ts(x)`, and browser tests `*.spec.ts`. Keep feature-specific code within its slice; promote only genuinely reusable code to shared modules.

## Testing Guidelines

Vitest uses `jsdom` and `tests/setup.ts`; colocate tests with the implementation. Playwright owns end-to-end flows in `tests/e2e/`. There is no configured coverage threshold, but every behavior change or bug fix should include focused regression coverage. Before opening a PR, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

## Commit & Pull Request Guidelines

Follow the scoped Conventional Commit style found in history, such as `fix(auth): align rate-limit schema` or `test(e2e): update smoke assertions`. Keep commits focused and imperative. PRs should explain behavior changes, link the relevant issue or specification, list validation performed, and include screenshots or recordings for UI work.

## Security & Configuration

Copy `.env.example` to `.env`; never commit credentials. Consult `docs/specification.md` and `docs/beta-readiness.md` before changing product rules, migrations, authentication, or deployment behavior.
