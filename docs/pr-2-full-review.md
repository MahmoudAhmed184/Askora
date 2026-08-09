# PR #2 Full Review — AI Question Generation

Reviewed branch: `feat/ai-question-generation`

Base: `origin/main`

Review date: 2026-08-09

Status: **Merge-ready locally; all 33 findings are resolved and the complete validation gate passes.**

## Scope and method

This review covered the complete `origin/main...HEAD` diff (95 files, approximately 17k added lines), including database migrations and constraints, authentication and authorization boundaries, encryption/key rotation, provider integration, duplicate prevention, privacy/provenance, UI and accessibility, progressive form behavior, CI, end-to-end coverage, dependency changes, and operational documentation.

The review combined source inspection with unit/type/lint/build checks, a real PostgreSQL 17 migration rehearsal, a DB-backed Playwright lifecycle run, dependency-tree inspection, and comparison against the committed product specification.

## Findings summary

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| PR2-01 | P1 | Production upgrade from migration 0017 fails | Resolved |
| PR2-02 | P1 | Hidden and edited original question text is disclosed to Gemini | Resolved |
| PR2-03 | P1 | Lazy key rotation can resurrect or overwrite a credential | Resolved |
| PR2-04 | P1 | New normalization misses duplicates against pre-PR hashes | Resolved |
| PR2-05 | P1 | Deterministic output safety permits prohibited content | Resolved |
| PR2-06 | P1 | Generated questions enter invalid moderation flows and leak provenance | Resolved |
| PR2-07 | P1 | Unrelated settings actions erase displayed model/interests | Resolved |
| PR2-08 | P1 | A valid 500-character model output can fail question normalization | Resolved |
| PR2-09 | P1 | CI skips every DB-backed lifecycle and migration check | Resolved |
| PR2-10 | P1 | New authenticated mutations do not enforce same-origin/CSRF protection | Resolved |
| PR2-11 | P1 | Optional Select values cannot be reset to the empty/default choice | Resolved |
| PR2-12 | P2 | Encryption key-version aliases silently overwrite keys | Resolved |
| PR2-13 | P2 | `.env.example` contains invalid new encryption placeholders | Resolved |
| PR2-14 | P2 | Local Playwright can bypass the Gemini mock or test stale code | Resolved |
| PR2-15 | P2 | Repository, migration, and cleanup tests do not exercise PostgreSQL | Resolved |
| PR2-16 | P2 | Radix Select regresses server-rendered/native form semantics | Resolved |
| PR2-17 | P2 | Generated-question direction is not preserved | Resolved |
| PR2-18 | P2 | Rate-limit retry timing is discarded by both UIs | Resolved |
| PR2-19 | P2 | Mobile generation dialog is neither a bottom sheet nor full-height | Resolved |
| PR2-20 | P2 | Long interest chips can overflow and hide their remove button | Resolved |
| PR2-21 | P2 | A typed, uncommitted interest is silently lost on Save | Resolved |
| PR2-22 | P2 | New Select animations ignore reduced-motion preferences | Resolved |
| PR2-23 | P2 | Unconfigured generation dialog has no visible dismissal control | Resolved |
| PR2-24 | P2 | Topic/interest limits count UTF-16 code units, not Unicode characters | Resolved |
| PR2-25 | P2 | Egyptian Arabic and MSA output validation are indistinguishable | Resolved |
| PR2-26 | P2 | Credential validation collapses actionable provider failures | Resolved |
| PR2-27 | P2 | Real SDK timeouts are misclassified and Auto can exceed 30 seconds | Resolved |
| PR2-28 | P2 | Suspended users cannot delete stored Gemini credentials | Resolved |
| PR2-29 | P2 | Generation failures lack privacy-safe operational diagnostics | Resolved |
| PR2-30 | P2 | The documented rolling-day limit is implemented as a fixed window | Resolved |
| PR2-31 | P2 | Credential compatibility check fails open when actions are absent | Resolved |
| PR2-32 | P3 | The committed lifecycle E2E omits model persistence and final deletion | Resolved |
| PR2-33 | P3 | Generation success triggers redundant loader revalidation | Resolved |

## Remediation summary

- **Database and CI:** migration 0018 now replaces the enum safely inside the migrator transaction; migration 0020 supports a true rolling-window limiter; CI provisions PostgreSQL 17 and runs the production-state rehearsal, migrations, live integration tests, and mocked-provider browser tests.
- **Privacy and security:** Gemini context uses only the published display question; key rotation is compare-and-swap; old and new normalized hashes are checked before and during persistence; custom mutations enforce trusted browser origins; generated self-questions cannot be reported or blocked; admin DTOs do not reveal fingerprint presence.
- **Provider correctness:** output policy checks cover sensitive data, individualized advice, links, persuasion, and solicitation in English/Arabic; 500-code-point repair is deterministic; Egyptian and MSA modes receive distinct checks; validation error categories are preserved; Auto shares one 30-second deadline and recognizes real SDK aborts.
- **Settings and UI:** unrelated actions retain loader-backed preferences, pending interests are included on Save, suspended owners can still delete their key, Select preserves native SSR/no-JavaScript submission and empty values, retry timing is visible, generated direction is exact, and mobile/reduced-motion/overflow/dismissal issues are covered.
- **Test fidelity:** live PostgreSQL exercises 3/5/10 persistence, transaction rollback, same-owner concurrency, legacy-hash rejection, credential rotation CAS, rolling limiting, account cleanup, and unrelated-owner isolation. The lifecycle browser test now persists a non-default model and deletes the remaining generated question.

## Detailed findings

### PR2-01 — Production upgrade from migration 0017 fails (P1)

`drizzle/0018_premium_nekra.sql:4` adds `ai_generated` to the existing `question_source` enum, then lines 62–74 use that value in constraints within the same transaction. Drizzle applies pending PostgreSQL migrations in one transaction, and PostgreSQL does not permit a newly added enum value to be used until it is committed.

Reproduction: applying the exact `npm run db:migrate` command to a PostgreSQL 17 database stopped at migration 0017 exits with `unsafe use of new value "ai_generated" of enum type question_source` and leaves the database at 0017. A blank database passes only because migration 0016 creates the enum inside that same transaction.

Required fix: replace/recreate the enum using an in-transaction-safe cast strategy while preserving existing `public_profile` data and defaults, then test the exact 0017-to-latest upgrade. Splitting the statements into another pending migration is insufficient because the migrator wraps the batch in one transaction.

### PR2-02 — Hidden and edited original question text is disclosed to Gemini (P1)

`app/features/question-generation/question-generation.repository.server.ts:306-326` always selects `questions.originalText` for published personalization context. Published thread items can intentionally hide the question or expose only an edited replacement. The retained private original is therefore still sent to Google after the owner hides or edits it.

Required fix: source prompt context from `threadItems.displayQuestionText`, omit hidden/null pairs, and cover original, edited, and hidden modes with query/service tests.

### PR2-03 — Lazy key rotation can resurrect or overwrite a credential (P1)

`question-generation-settings.service.server.ts:188-206` reads/decrypts old material and later performs an owner-only update through `question-generation.repository.server.ts:253-269`. A concurrent disconnect or replacement between those operations is overwritten by the stale rotation, which can restore a deleted key or replace a newly connected key.

Required fix: make rotation a compare-and-swap over the previously read ciphertext, nonce, authentication tag, and key version. Treat zero affected rows as a concurrent change, not permission to retry the stale write. Test disconnect-versus-rotation and replacement-versus-rotation races.

### PR2-04 — New normalization misses duplicates against pre-PR hashes (P1)

`question-generation-normalize.ts` introduces NFKC, Arabic character/punctuation changes, and terminal question-mark removal. Existing production hashes were generated with the former trim/whitespace/lowercase algorithm, but no migration or compatibility lookup updates them. `findDuplicateHashes` and the transaction recheck query only the new hash, so an existing question ending in `?` can be generated verbatim again.

Required fix: version/backfill hashes or query both legacy and current HMAC values during compatibility. The transaction-time duplicate check must use the same compatibility set. Add a regression fixture with a pre-PR stored hash.

### PR2-05 — Deterministic output safety permits prohibited content (P1)

`question-generation.service.server.ts:303-321` relies on a short set of phrases and TLDs. Prohibited examples such as individualized insulin dosing, requests for passport numbers, and URLs on unlisted TLDs pass. Provider safety filters do not replace the application-level medical/legal/financial, PII, credential, link, and solicitation contract.

Required fix: use maintained, fail-closed deterministic categories, robust URL/domain detection, and adversarial English/Arabic tests. Do not log rejected question text or provider bodies.

### PR2-06 — Generated questions enter invalid moderation flows and leak provenance (P1)

`question-card.tsx`, `answer-editor.tsx`, and `question-moderation-controls.tsx` render report/block controls for generated self-questions. Blocking must fail because asker and recipient are the same account. Reporting is accepted, however, and the admin view combines an account-backed sender with a null safety fingerprint—an invariant unique to generated questions—allowing a signed-in non-owner administrator to infer private AI provenance.

Required fix: select the source into server-side inbox authorization, reject report/block for `ai_generated`, and pass a capability that removes both enhanced and `<noscript>` actions while retaining answer/delete. Ensure admin report DTOs cannot recreate provenance, and add action/UI/privacy tests.

### PR2-07 — Unrelated settings actions erase displayed model/interests (P1)

`question-generation-settings-form.tsx:51-58` initializes shared preference state from every action result. Connect, disconnect, and disclosure forms omit some or all preference fields, while the service defaults omissions to `auto`/`[]`. `question-generation.route.tsx:45-50` then deliberately remounts on every result. A successful or failed unrelated action can make saved preferences appear empty, and the next Save overwrites the real values. This was reproduced in the DB-backed lifecycle.

Required fix: scope action values to their intent. Revalidated loader settings should remain authoritative after unrelated successes; failures should preserve only the fields that form actually submitted. Add nonempty model/interests regression coverage for connect, disconnect, and disclosure successes and failures.

### PR2-08 — A valid 500-character model output can fail normalization (P1)

`question-generation.service.server.ts:297-301` appends a question mark unless that would exceed 500 characters. At exactly 500 characters it returns the unchanged text, after which the terminal-question contract rejects it. Shorter outputs are repaired, so this boundary is internally inconsistent.

Required fix: reserve room by trimming the normalized content to 499 Unicode characters before appending the terminal question mark, preserving the 500-character cap. Add exact boundary and Unicode tests.

### PR2-09 — CI skips every DB-backed lifecycle and migration check (P1)

`.github/workflows/ci.yml:96-97` runs Playwright without PostgreSQL or `DATABASE_URL`. `tests/e2e/beta-smoke.spec.ts:17-21` consequently skips the complete DB-backed suite, including the mocked-provider lifecycle. No CI job exercises migrations. This is why PR2-01 passed green.

Required fix: add a PostgreSQL service/job that verifies the production-state upgrade and runs at least the desktop mocked-provider lifecycle, with deterministic seed/reset behavior.

### PR2-10 — New authenticated mutations do not enforce same-origin/CSRF protection (P1)

The new actions in `settings/question-generation.route.tsx` and `inbox.route.tsx` authenticate a cookie session but do not validate a session token or the request `Origin`/`Referer`. Same-site sibling origins can submit cookies and replace/disconnect BYOK credentials or consume the victim's provider quota.

Required fix: apply a shared same-origin/explicitly trusted-origin guard to these authenticated mutations and add cross-origin rejection tests. This should be consistent with the application's deployment origin configuration.

### PR2-11 — Optional Select values cannot be reset to the empty/default choice (P1)

`app/components/ui/select/select.tsx:89-90` removes every `value=""` item from the Radix list. The answer editor uses the empty value for “Profile default.” After selecting an override, the user cannot return to the profile default.

Required fix: map empty values to a collision-safe internal sentinel or use a native select for optional mutation fields. Test nonempty selection followed by reset to empty.

### PR2-12 — Encryption key-version aliases silently overwrite keys (P2)

`app/lib/env.server.ts:207-220` converts JSON property names with `Number()` and inserts them into a `Map`. Aliases such as `1`, `01`, and `1e0` collapse to the same version, silently overwriting the key needed to decrypt existing credentials.

Required fix: accept canonical positive decimal names only, enforce the database integer range, and reject duplicate numeric versions. Add alias and range regression tests.

### PR2-13 — `.env.example` contains invalid new encryption placeholders (P2)

The new nonempty `QUESTION_GENERATION_ENCRYPTION_KEYS` placeholder is not a valid base64-encoded 32-byte key. Copying `.env.example` as instructed causes startup environment parsing to fail.

Required fix: leave the optional development pair blank/commented and retain the `openssl rand -base64 32` production instructions.

### PR2-14 — Local Playwright can bypass the Gemini mock or test stale code (P2)

`playwright.config.ts` reuses any local server on port 5173, but injects mock-provider and encryption variables only when Playwright starts the process. A common already-running development server can receive the fake E2E key without the mock base URL, call real Google, or serve stale code.

Required fix: run DB-backed generation tests on a dedicated app/mock port and do not reuse an arbitrary server for that configuration.

### PR2-15 — Repository, migration, and cleanup tests do not exercise PostgreSQL (P2)

`question-generation.repository.server.test.ts` and `question-generation-migration.test.mjs` inspect source strings; `cleanup-account-deletions.test.mjs` simulates SQL with schema-invalid in-memory data. They do not prove constraints, rollback, cascades, concurrent same-owner generation, or isolation of unrelated owners.

Required fix: add disposable-PostgreSQL integration coverage for 3/5/10 persistence, forced partial-insert rollback, two concurrent requests, 0017 upgrade, cleanup cascades, and preservation of an unrelated owner.

### PR2-16 — Radix Select regresses server-rendered/native form semantics (P2)

`app/components/ui/select/select.tsx` renders an inert button on the server. Radix portal options and its hidden native field are created after hydration. Existing mutation forms therefore lose the prior component's native/no-JavaScript submission behavior, and controlled values are not represented by server-rendered `<option>` elements.

Required fix: preserve a real native select for mutation forms or implement a progressively enhanced native control. Add render-to-string and no-JavaScript FormData tests for a controlled nonempty value.

### PR2-17 — Generated-question direction is not preserved (P2)

Inbox, editor, drafts, owner profile, and public thread surfaces use `dir="auto"`. An Arabic question beginning with a Latin product name resolves LTR even though the generated batch language is known to be Arabic. The specification requires generated Arabic to render RTL and English LTR.

Required fix: derive a safe display-direction field server-side without exposing provider/batch metadata, propagate it across lifecycle DTOs, and render an exact `rtl`/`ltr`. Test Latin-leading Arabic and English content.

### PR2-18 — Rate-limit retry timing is discarded by both UIs (P2)

Inbox and settings action results include `retryAfterSeconds`, but both forms display only a generic message. The specification requires users to know when another attempt is available.

Required fix: format the retry time in the visible error and live region. Add the HTTP `Retry-After` header where the route returns a rate-limit response, and test both output paths.

### PR2-19 — Mobile generation dialog is neither a bottom sheet nor full-height (P2)

The generation dialog changes dimensions at small widths, but the base content remains vertically centered through `top-1/2 -translate-y-1/2`. This produces a centered auto-height panel with a square lower edge rather than the specified bottom sheet/full-height treatment.

Required fix: bottom-anchor the small-screen layout (including top rounding and safe-area padding) or use full height, while restoring the centered desktop layout at `sm`. Add mobile viewport assertions.

### PR2-20 — Long interest chips can overflow and hide their remove button (P2)

The legal 40-character interest pill is intrinsic-width `inline-flex`; its label has no shrink/wrap/truncation constraint while the panel clips overflow. Narrow screens can hide the remove button.

Required fix: constrain the pill to `max-w-full`, allow the text area to shrink/truncate or break safely, and keep the remove control `shrink-0`. Add a 320px overflow regression.

### PR2-21 — A typed, uncommitted interest is silently lost on Save (P2)

Only the committed chip array is serialized. The visible interest input has no form name and remains separate. Clicking Save after typing a valid token submits without it, remounts, clears it, and reports success.

Required fix: commit a valid pending token on submit/blur or include it in server normalization. Test typing followed directly by Save.

### PR2-22 — New Select animations ignore reduced-motion preferences (P2)

The Radix Select chevron always transitions/rotates and its content always fades/zooms. It lacks the `motion-reduce` handling already used by other animated UI.

Required fix: disable transition, transform, animation, and duration under reduced motion; add a class/accessibility regression.

### PR2-23 — Unconfigured generation dialog has no visible dismissal control (P2)

The unconfigured branch contains explanation plus a settings link. The shared dialog content has no close button and the Cancel footer only exists in the configured branch. Touch and screen-reader users have no visible/focusable dismissal without leaving the page.

Required fix: render an always-available dialog close/cancel control and test keyboard/touch dismissal plus focus return.

### PR2-24 — Topic/interest limits count UTF-16 code units, not Unicode characters (P2)

Native `maxLength` and Zod `.max()` use JavaScript UTF-16 code units. Supplementary characters therefore count twice, contrary to the specification's Unicode-character limits (topic 160; interests 2–40).

Required fix: define the metric explicitly (Unicode code points is sufficient unless product requires graphemes), apply it consistently on client/server, remove contradictory native limits, and test emoji and combining sequences.

### PR2-25 — Egyptian Arabic and MSA output validation are indistinguishable (P2)

`question-generation.service.server.ts:311-321` uses the same Arabic/Latin character-ratio validation for both modes. Clearly MSA output passes an Egyptian request and vice versa despite an exact-language requirement.

Required fix: add conservative dialect-specific checks with adversarial cross-dialect tests, or narrow the product promise if deterministic distinction cannot be made reliably.

### PR2-26 — Credential validation collapses actionable provider failures (P2)

The validator produces invalid credential, permission/billing, quota, unavailable model, and unavailable provider categories. `question-generation-settings.service.server.ts` preserves only invalid credential; all others become a generic retry-later response.

Required fix: extend the safe action-result taxonomy and provide distinct remediation without exposing provider response bodies.

### PR2-27 — Real SDK timeouts are misclassified and Auto can exceed 30 seconds (P2)

`gemini-question-generator.server.ts` recognizes only `TimeoutError`, while the installed SDK abort path can surface as `AbortError`. Real timeouts can therefore become `provider_unavailable`. Auto also gives the primary and fallback independent 30-second timeouts, allowing approximately 60 seconds total.

Required fix: enforce one monotonic overall deadline, pass only remaining time to fallback, and classify the SDK's real abort/timeout variants without conflating unrelated cancellation. Add fake-timer tests around both attempts.

### PR2-28 — Suspended users cannot delete stored Gemini credentials (P2)

`question-generation-settings.service.server.ts:137` rejects suspended users before dispatching `disconnect`. That prevents immediate deletion of sensitive user-provided key material.

Required fix: allow disconnect before the suspension guard while retaining the guard for connection, preference, and generation actions. Add a suspended-disconnect test.

### PR2-29 — Generation failures lack privacy-safe operational diagnostics (P2)

`inbox-generation-action.server.ts` maps exceptions and typed provider/database failures without safe structured logging. Production SDK and persistence failures are operationally invisible.

Required fix: record category, duration, non-secret account/profile identifiers, and execution stage. Explicitly exclude key material, topic/interests, prompts, responses, generated text, and raw provider bodies.

### PR2-30 — The documented rolling-day limit is implemented as a fixed window (P2)

The 25-per-24-hours policy uses the generic fixed-window limiter. A user can submit 25 just before reset and 25 just after it, reaching 50 in a short rolling interval.

Required fix: implement a true rolling/sliding window (or equivalent bucket approximation whose bound satisfies the policy) and test requests across the old reset boundary.

### PR2-31 — Credential compatibility check fails open when actions are absent (P2)

`gemini-credential-validation.server.ts:70-71` accepts a model when `supportedActions` is missing, even though generation compatibility must be positively verified.

Required fix: require `supportedActions` to include `generateContent`; treat missing metadata as an unavailable/incompatible model and test the fail-closed behavior.

### PR2-32 — The committed lifecycle E2E omits required steps (P3)

`tests/e2e/beta-smoke.spec.ts` never changes/asserts model preference and never deletes the final generated inbox item, despite both steps appearing in the committed acceptance plan.

Required fix: persist a non-default model (or explicitly assert Auto persistence) and delete/verify the remaining generated item.

### PR2-33 — Generation success triggers redundant loader revalidation (P3)

`inbox-question-generation-dialog.tsx:94-101` calls `revalidator.revalidate()` after a successful fetcher action even though successful fetcher mutations already revalidate matched loaders. This doubles inbox/settings query work and can flicker.

Required fix: remove the manual revalidation unless a route-level `shouldRevalidate` intentionally suppresses the automatic cycle, and assert a single refresh.

## Validation performed before fixes

Passed:

- `git diff --check origin/main...HEAD`
- `npm run typecheck`
- `npm run lint`
- `npm test` — 109 files passed, 526 tests passed, 1 skipped
- `npm run build`
- Added dependency resolution (`@google/genai@2.15.0`, `@radix-ui/react-select@2.3.7`)
- Blank-database migration from migration 0000

Failed as expected and captured above:

- PostgreSQL 17 production-state migration 0017 → latest
- DB-backed mocked-provider lifecycle (saved interests were lost after the settings action remount)

`npm audit --omit=dev` reports 10 vulnerabilities, but the same dependency paths and versions are present on `origin/main`; neither dependency added by this PR introduced an audit finding. This is recorded as baseline debt, not a PR-specific blocker.

## Post-fix validation

Passed after remediation:

- `npm run lint`
- `npm run typecheck`
- `npm test` — 112 files passed, 1 DB-only file skipped; 568 tests passed, 1 skipped
- `npm run build`
- `git diff --check`
- PostgreSQL 17 production-state migration rehearsal: 0017 → latest in one pending-migration transaction
- Blank-database `npm run db:migrate`
- `npm run test:postgres` against PostgreSQL 17, including production repository, rollback, concurrency, legacy-hash, key-rotation CAS, cleanup, isolation, and rolling-limit behavior
- `npm run test:e2e` against the production build and local Gemini mock — 37 passed, 5 intentional project/viewport skips
- Targeted desktop and mobile admin Select hydration regression — 2 passed
- Added dependency resolution remains clean; the 10 production audit findings are unchanged baseline dependencies from `origin/main`

## Merge gate

All six merge-gate requirements are satisfied. The complete remediation diff was independently re-reviewed after the GPT-5.6 Luna (Max) implementation, and additional issues found during verification—suspended-user UI deletion, safety false positives/political persuasion, a typed SDK test fixture, and a Playwright hydration race—were corrected before the final gate.
