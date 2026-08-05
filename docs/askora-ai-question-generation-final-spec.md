# Askora AI Self-Question Generation
## Final Product and Technical Specification

**Status:** Implementation-ready design
**Validated:** 5 August 2026
**Primary provider:** Gemini API through the official `@google/genai` SDK
**Delivery model:** Small, synchronous, owner-initiated feature inside the existing inbox and settings flows

---

## 1. Decision Summary

Askora will let a signed-in profile owner generate thoughtful questions for themselves. A successful batch is inserted directly into the owner's existing private inbox and then follows Askora's normal question lifecycle:

```text
Inbox → Answer editor → Draft or Publish → Profile/thread
```

The implementation is intentionally narrow:

- one provider: Gemini;
- one server-side generation call per request;
- no preview step;
- no background jobs, queues, polling, streaming, embeddings, vector database, agents, tools, or provider abstraction;
- user-supplied Gemini API keys only;
- owner-private AI provenance;
- structured output validated with the project's existing Zod dependency;
- batch insertion in one PostgreSQL transaction;
- exact duplicate prevention is deterministic;
- semantic repetition reduction is best-effort in version one and is measured rather than overpromised.

This replaces the earlier living specification. There are no unresolved product or architectural decisions in this document.

---

## 2. Alignment with `AGENTS.md`

The design follows the repository rules directly.

### 2.1 No backward-compatibility layer

The current schema and domain behavior are migrated to the new design in place. There will be no deprecated route, legacy payload, adapter, dual-write path, old source alias, or compatibility fallback.

Existing `public_profile` questions remain because they are active product data, not because a legacy compatibility path is being preserved.

### 2.2 Smallest complete implementation

The first release adds only what the confirmed product requires:

- one settings record per user;
- one generation-batch record per successful request;
- one new question provenance value;
- one Gemini-specific server module;
- one settings surface;
- one inbox dialog/sheet;
- owner-only provenance presentation;
- focused tests and documentation updates.

### 2.3 Vertical delivery

Implementation proceeds as small end-to-end slices. Each slice must leave the repository working and tested. The implementation sequence is defined in Section 24.

### 2.4 Modular concerns without speculative abstraction

The feature gets a dedicated domain slice, but it does not introduce a generic AI platform. Gemini-specific behavior remains Gemini-specific until a second provider is an approved product requirement.

### 2.5 Existing packages first

The implementation reuses React Router, React, Drizzle, PostgreSQL, Zod, Radix Dialog, the current form and feedback patterns, the existing question lifecycle, and the existing rate-limit and logging facilities.

The only planned production dependency is the official Gemini SDK:

```text
@google/genai
```

Node's built-in `node:crypto` handles encryption.

### 2.6 Long-term decisions, not disposable stopgaps

The design includes authenticated encryption, key versioning, source-aware provenance, privacy boundaries, model policy, atomic persistence, and migration-safe schema constraints from the start. None is described as temporary code that should later be replaced.

---

## 3. Product Goal

Help Askora profile owners generate meaningful self-questions and place them into their existing private inbox so they can answer them through Askora's normal draft and publication workflow.

The feature must preserve Askora's editorial character:

- questions should invite considered answers, not manufacture engagement;
- generated questions are private until the owner publishes an answer;
- AI provenance is visible to the owner and hidden from everyone else;
- the existing inbox, answer editor, drafts, and thread lifecycle remain the product flow;
- private or unpublished content is not used for personalization;
- generated content must remain recognizably Askora content rather than generic AI filler.

---

## 4. Scope

### 4.1 Included

- owner-generated self-questions;
- Gemini BYOK configuration;
- saved private question interests;
- optional one-time topic;
- language, style, and quantity controls;
- synchronous structured generation;
- deterministic validation and exact duplicate blocking;
- direct atomic insertion into the inbox;
- permanent owner-private generated provenance;
- normal deletion, drafting, editing, answering, and publication behavior;
- explicit safety and privacy controls;
- rate limiting, logging, tests, and documentation.

### 4.2 Excluded

- visitor question generation;
- impersonation of human askers;
- automatic or scheduled generation;
- recommendations pushed without an owner action;
- preview-and-select workflows;
- partial batch insertion;
- regeneration of individual items;
- mixed-language batches;
- arbitrary quantities or arbitrary model IDs;
- shared Askora Gemini quota;
- OpenAI, ChatGPT, Codex, or other providers;
- provider switching or a provider registry;
- public AI labels;
- use of inbox questions, drafts, deleted content, reports, or moderation data as model context;
- embeddings, semantic search infrastructure, or a vector database;
- prompt or raw response retention;
- background jobs, queues, Redis, polling, streaming, agents, tools, or RAG;
- a quota dashboard;
- a separate AI workspace or design system.

---

## 5. User Experience

### 5.1 Entry point

The inbox includes a **Generate questions** action.

It opens:

- a Radix dialog on wider screens;
- a bottom sheet or full-height dialog on small screens, using the project's existing responsive dialog pattern.

There is no dedicated page.

### 5.2 Generation form

The surface contains:

1. **Topic — optional**
   - Label: `What would you like questions about today?`
   - Maximum: 160 Unicode characters.
   - Applies only to the current request.
   - Is never saved automatically as an interest.

2. **Language**
   - Egyptian Arabic
   - Modern Standard Arabic
   - English

3. **Style**
   - Balanced — default
   - Deep and reflective
   - Professional
   - Personal
   - Light and fun
   - Surprise me

4. **Quantity**
   - 3
   - 5 — default
   - 10

5. **Active model**
   - Read-only text.
   - The model is changed in Settings, not in this dialog.

6. **Generate questions**
   - One submit action.
   - Disabled while the request is active.
   - The client must prevent accidental double submission, but server controls remain authoritative.

### 5.3 No preview step

A valid batch is inserted directly into the inbox.

This is the simplest flow and matches the established product lifecycle. Owners can delete unwanted inbox questions through the existing question controls. The feature does not add a second staging area.

### 5.4 Success behavior

After a successful transaction:

1. return the created questions;
2. refresh or invalidate the inbox data using the existing route/data pattern;
3. close the generation surface;
4. show the existing success feedback pattern;
5. place the new questions in the normal inbox ordering.

### 5.5 Failure behavior

On failure:

- save no batch and no question;
- keep the surface open;
- preserve the selected topic, language, style, and quantity;
- show an actionable, non-sensitive error;
- allow a deliberate manual retry;
- never display raw Gemini responses, stack traces, credentials, prompts, or provider error bodies.

There is no hidden retry or hidden repair call.

---

## 6. Generated Question Behavior

Generated questions become normal Askora questions after insertion.

They use the existing:

- inbox management;
- answer editor;
- draft behavior;
- edited-question behavior;
- publication flow;
- thread rendering;
- deletion behavior;
- owner self-question notification rules.

The feature must extend the existing question domain service rather than create an independent AI-only question lifecycle.

### 6.1 Identity

A generated question is a self-question:

- the owner is the internal asker;
- public rendering does not invent or display a human asker;
- the existing self-question identity mode is reused;
- no visitor or anonymous third party is represented.

### 6.2 Editing

The feature adds no new question-editing screen.

Any editing already allowed by Askora's answer/publication flow remains available and remains distinct from AI provenance. The existing public **Edited question** behavior and the private **Generated** provenance are separate concepts.

### 6.3 Deletion

An owner may delete an unanswered generated question through the existing inbox controls. Published-answer and thread deletion continue to follow current Askora policy.

Deleting a generated question does not expose, rewrite, or transfer its batch metadata.

---

## 7. Owner-Private AI Provenance

AI provenance is permanent and private to the owner.

The owner sees a **Generated** badge:

- in the inbox;
- in the answer editor;
- in drafts;
- on their own profile after publication;
- in any other owner-management surface that represents the question.

Guests, signed-in non-owners, crawlers, public APIs, page source, loader payloads, metadata, and analytics exposed to the client must not receive generated provenance, batch IDs, model IDs, or token metadata.

### 7.1 Presentation rule

Do not serialize the full internal `source` field and rely on the browser to hide it.

The server must derive an owner-only presentation field only when the current viewer owns the profile, for example:

```ts
type OwnerQuestionProvenance = "generated" | null;
```

Public question DTOs omit provenance entirely.

### 7.2 Required leak tests

Tests must verify both:

- rendered public HTML contains no generated marker;
- public route/loader JSON contains no source, batch ID, model name, or equivalent inference channel.

---

## 8. Settings

Add a focused **Question generation** section within the existing nested Settings area.

### 8.1 API connection

The section supports:

- connect Gemini;
- show `Connected` or `Not connected`;
- validate a new key before replacing the current key;
- replace the key;
- permanently disconnect and delete the stored credential.

The saved key is never shown again, even partially. A suffix is not necessary. The UI only needs a connection status.

### 8.2 Model preference

Allowed values:

- `Auto` — default;
- `Gemini 3.6 Flash`;
- `Gemini 3.5 Flash-Lite`.

No arbitrary model ID input is allowed.

### 8.3 Question interests

Interests are private, optional tags.

Rules:

- maximum 12 interests;
- 2–40 Unicode characters each after trimming;
- duplicate interests are rejected after Unicode normalization and case folding;
- empty items are removed;
- tags can be added with Enter or comma;
- interests are reorder-independent;
- interests are never displayed publicly;
- deleting all interests is valid.

Examples:

- Software engineering
- Career
- Books
- Personal growth
- Egyptian culture

### 8.4 Data-use disclosure

Before the first generation request, the owner must acknowledge a concise disclosure explaining that Askora sends the following to Google's Gemini API using the owner's key:

- selected profile fields;
- saved question interests;
- a bounded selection of the owner's published questions and answers;
- the current optional topic;
- generation controls.

The disclosure must also state that private inbox questions, drafts, deleted content, reports, and moderation data are excluded.

Store only:

- disclosure version;
- acknowledgement timestamp.

A later material disclosure change increments the version and requires acknowledgement again.

---

## 9. Supported Languages

Each batch uses exactly one selected language:

- Egyptian Arabic;
- Modern Standard Arabic;
- English.

A batch must not intentionally mix languages.

Full application localization is outside this feature. Generated content must still render with correct directionality.

### 9.1 Language validation

Version one uses deterministic and heuristic checks, not a second model call.

Validation must reject:

- an empty response;
- a batch clearly written in the wrong script/language;
- a batch with substantial unintended language mixing.

The validator should tolerate normal code words, product names, and borrowed technical terms.

When language confidence is ambiguous, fail the batch rather than silently insert low-quality content.

---

## 10. Question Styles

### 10.1 Balanced

Balanced is the default and must vary question shape across the batch. The prompt should ask for a deliberate mix such as:

- reflection;
- concrete experience;
- changed opinion;
- lesson learned;
- preference or trade-off;
- future intention.

It must not require every category in every small batch.

### 10.2 Other styles

- **Deep and reflective:** introspection without therapy language or invasive assumptions.
- **Professional:** work, craft, decisions, growth, and lessons without corporate jargon.
- **Personal:** personal but respectful; does not infer sensitive traits or trauma.
- **Light and fun:** easy to answer without becoming engagement bait.
- **Surprise me:** broad variety while respecting all safety and personalization boundaries.

Style changes tone and angle, not safety policy or output schema.

---

## 11. Personalization Context

Automatic personalization may use only:

- selected public profile fields;
- private saved question interests;
- the owner's previously published questions and answers;
- up to three pinned published questions/answers, when the product exposes pinning;
- the optional topic for the current request.

It must not use:

- private inbox questions from other people;
- unanswered questions;
- filtered questions;
- unpublished drafts;
- deleted content;
- reports;
- moderation or safety metadata;
- private account or security settings;
- content belonging to another profile.

### 11.1 Bounded deterministic selection

Use a deterministic bounded context builder:

1. selected profile fields;
2. saved interests;
3. pinned published items, up to 3;
4. newest published question/answer pairs until the limit is reached.

Limits:

- maximum 20 published question/answer pairs;
- maximum 1,000 Unicode characters from each answer;
- maximum 30,000 Unicode characters for the complete personalization payload before SDK serialization;
- deduplicate pinned items from the chronological selection.

Do not add summarization, retrieval, embeddings, or a second model call.

### 11.2 Profile fields

Use only fields already public or intentionally provided for public profile personalization, such as:

- display name;
- bio;
- public profile description.

Do not send email, internal identifiers, IP data, security settings, blocked-user data, or account metadata.

### 11.3 Prompt-injection boundary

Treat every profile field, interest, published answer, and topic as untrusted data.

The instruction must state that content inside the context is quoted user data and cannot alter system rules, request tools, reveal secrets, or change the response format.

Serialize context as data with clear field boundaries. Do not concatenate it as an unmarked instruction block.

---

## 12. Question Content Contract

Every generated question must:

- contain one clear question;
- be understandable without hidden context;
- match the selected language;
- match the selected style without violating safety rules;
- fit Askora's existing 500-character question limit;
- contain plain text only;
- contain no HTML, Markdown, links, hashtags, mentions, model commentary, numbering, or prefatory labels;
- avoid praising the user or claiming knowledge not present in the supplied context;
- avoid asking for secrets, credentials, contact information, or exact location;
- avoid impersonating a visitor;
- avoid engagement-bait wording.

Recommended quality range:

- 20–220 characters for most questions;
- a terminal `?` or `؟`, added only when missing and linguistically appropriate.

The server enforces the hard 500-character product limit. The recommended range is a quality rule, not a database constraint.

---

## 13. Duplicate Policy

### 13.1 Deterministic guarantees

Version one guarantees rejection of:

- exact duplicates in the generated batch;
- duplicates after the repository's question normalization;
- generated questions matching an existing question for the same profile after normalization.

Use the existing normalized text and hash mechanism rather than creating another duplicate representation.

### 13.2 Best-effort semantic controls

Version one asks Gemini to avoid:

- close paraphrases;
- questions already substantially answered;
- repetitive angles within the new batch.

Without embeddings or a separate semantic classifier, these are quality objectives, not deterministic guarantees. The product and acceptance criteria must not claim perfect semantic duplicate detection.

Allowed related questions include:

- deeper follow-ups;
- changed perspectives;
- updates;
- contradictions;
- lessons learned;
- a genuinely new angle on the same subject.

### 13.3 Normalization

Reuse and, only where necessary, extend the repository's current question normalization. It should include:

- Unicode NFKC normalization;
- trimming;
- collapsing repeated whitespace;
- stable case folding where applicable;
- conservative normalization of Arabic punctuation and common letter variants;
- ignoring a final question mark for duplicate comparison.

Do not add stemming, transliteration, embeddings, edit-distance thresholds, or language-specific NLP packages in version one.

### 13.4 Transaction-time recheck

Perform duplicate checks again inside the final database transaction before insertion. This protects against two concurrent generation requests from the same owner.

If any item fails, rollback the entire batch.

---

## 14. Gemini Integration

### 14.1 SDK and API

Use the official:

```text
@google/genai
```

Use the stable Gemini API surface supported by the SDK and one stateless `models.generateContent` request.

Do not use:

- REST wrappers written by Askora;
- OpenAI-compatible endpoints;
- Interactions state;
- chat sessions;
- tools;
- grounding;
- agents;
- streaming;
- a provider-neutral interface.

### 14.2 Model policy as of 5 August 2026

Code-owned allowlist:

```ts
const QUESTION_GENERATION_MODELS = {
  auto: "auto",
  gemini36Flash: "gemini-3.6-flash",
  gemini35FlashLite: "gemini-3.5-flash-lite",
} as const;
```

Resolution:

- `Auto` resolves to `gemini-3.6-flash`.
- `gemini-3.5-flash` is an internal Auto fallback only.
- An explicitly selected model never falls back silently.

Fallback is allowed only when the Auto primary model is unavailable or retired, represented by a provider response that specifically identifies the model as unavailable, missing, or no longer supported.

Fallback is forbidden for:

- invalid credentials;
- permission errors;
- billing errors;
- quota or rate-limit errors;
- malformed requests;
- content or safety blocks;
- timeouts or network failures;
- invalid structured output.

The exact model used is recorded for each successful batch.

### 14.3 Model validation

When connecting or replacing a key:

1. create a short-lived server-side SDK client;
2. call the official model metadata endpoint for the selected model or Auto primary;
3. verify the key can access a compatible text-generation model;
4. save the encrypted credential only after validation succeeds.

Do not validate API keys with a regular expression. Google key formats and authorization behavior can change.

A successful key check does not guarantee future quota, billing, or availability.

### 14.4 Generation configuration

Use:

- response MIME type `application/json`;
- JSON Schema derived from the same Zod 4 output schema used for runtime validation;
- explicit safety settings;
- low thinking effort for this bounded generation task;
- the model's documented default temperature;
- no tools and no external grounding.

Do not lower temperature as an attempt to make structured output valid. Schema validation is authoritative.

### 14.5 Structured output schema

Conceptual schema:

```ts
const GeneratedQuestionSchema = z.object({
  text: z.string().trim().min(1).max(500),
}).strict();

const GeneratedQuestionBatchSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
}).strict();
```

After parsing, enforce the requested array length exactly.

Use one schema source for:

- TypeScript inference;
- Gemini JSON Schema;
- server runtime validation.

### 14.6 No automatic repair call

If Gemini returns:

- malformed JSON;
- the wrong number of questions;
- invalid fields;
- invalid language;
- unsafe content;
- duplicates;
- content that violates product rules;

the request fails atomically.

Do not make a hidden second call to repair or replace items. The owner may retry manually.

---

## 15. Safety Policy

### 15.1 Explicit provider settings

Set Gemini safety thresholds explicitly for the supported adjustable harm categories. Do not rely on provider defaults.

Use a medium-and-above blocking threshold for:

- harassment;
- hate speech;
- sexually explicit content;
- dangerous content.

Provider safety is one layer, not the complete product policy.

### 15.2 Askora generation policy

The instruction and post-validation must prohibit questions that:

- request medical diagnosis or individualized treatment;
- request individualized legal or financial advice;
- encourage self-harm, suicide, eating-disorder behavior, or dangerous challenges;
- facilitate violence, illegal activity, weapon construction, exploitation, or evasion;
- contain explicit sexual content;
- harass, demean, or target protected groups;
- solicit passwords, API keys, authentication codes, financial identifiers, private contact details, or exact location;
- expose or infer private personal data;
- assume trauma, illness, religion, ethnicity, sexuality, political affiliation, disability, or other sensitive traits;
- perform political persuasion or personalized political targeting;
- pressure the owner into disclosing painful or highly sensitive experiences.

Neutral cultural, historical, civic, or political reflection may be allowed when it is not targeted persuasion and does not infer private beliefs.

### 15.3 Existing Askora policy checks

Run the repository's applicable question policy and muted-term checks after model output validation.

Do not send reports, moderation metadata, safety fingerprints, blocked-user data, or internal policy records to Gemini.

### 15.4 Blocked output

When provider safety or Askora validation blocks the batch:

- insert nothing;
- show a neutral message that the batch could not be created safely;
- do not reveal hidden policy details or raw provider feedback;
- allow the owner to revise the topic and retry.

---

## 16. API-Key Security

### 16.1 Transport and browser boundary

- accept keys only through authenticated HTTPS requests;
- never instantiate the Gemini client in browser code;
- never return a stored key to the browser;
- never include a key in route data, HTML, logs, analytics, errors, traces, URLs, or client storage;
- mask browser input and clear it after submission.

### 16.2 Encryption

Use Node's built-in `node:crypto` with AES-256-GCM.

For every encryption:

- generate a fresh cryptographically random 12-byte nonce;
- use a 32-byte master key;
- retain the 16-byte authentication tag;
- authenticate stable associated data that binds the ciphertext to the Askora feature, schema version, and owning user;
- store binary values in the repository's established binary-safe representation.

Conceptual associated data:

```text
askora:question-generation-credential:v1:<owner-user-id>
```

Stored credential material:

- ciphertext;
- nonce;
- authentication tag;
- encryption-key version.

Never store plaintext or a reversible masked display value.

### 16.3 Keyring and rotation

Environment configuration:

```text
QUESTION_GENERATION_ENCRYPTION_KEYS
QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION
```

`QUESTION_GENERATION_ENCRYPTION_KEYS` is a validated mapping from numeric version to a base64-encoded 32-byte key. The active version must exist in the mapping.

Rotation process:

1. add the new key to the keyring;
2. make its version active;
3. deploy;
4. lazily re-encrypt an old credential after a successful decrypt during normal use or replacement;
5. retain old keys until no stored credential references them;
6. verify reference counts;
7. remove retired keys in a later deployment.

A missing key version, failed authentication tag, malformed ciphertext, or wrong associated data makes the credential unusable. Do not attempt lossy recovery; require the owner to reconnect.

### 16.4 Deletion

Disconnecting Gemini hard-deletes all encrypted credential fields immediately.

Account deletion must also delete the credential before or as part of the same account-deletion transaction.

Backups follow the platform's existing encrypted-backup and retention policy; the product must not claim immediate erasure from historical infrastructure unless the platform can guarantee it.

### 16.5 Logging protection

Before implementation is accepted, add tests or structured checks that prove credentials cannot enter:

- request logging;
- error logging;
- validation errors;
- analytics properties;
- exception messages;
- SDK error serialization.

---

## 17. Data Model

Use the current Drizzle/PostgreSQL conventions and naming style. Exact generated migration names are repository-owned.

### 17.1 Extend question source

Extend the existing `question_source` enum:

```text
public_profile
ai_generated
```

Do not replace or alias `public_profile`. It remains the correct source for the active public-question flow.

### 17.2 Question-generation settings

One row per owner.

Suggested fields:

```text
owner_user_id                         primary/unique foreign key
gemini_key_ciphertext                 nullable
gemini_key_nonce                      nullable
gemini_key_auth_tag                   nullable
gemini_key_version                    nullable
model_preference                      non-null, default 'auto'
question_interests                    non-null text array, default empty
credential_validated_at               nullable
data_disclosure_version               nullable
data_disclosure_accepted_at           nullable
created_at                            non-null
updated_at                            non-null
```

Database checks must require all credential fields to be either present together or absent together.

No provider column is needed because there is one provider.

### 17.3 Generation batches

Create one row only for a successful batch.

Suggested fields:

```text
id                                    primary key
owner_user_id                         foreign key
profile_id                            foreign key
language                              enum/text constrained to supported values
style                                 enum/text constrained to supported values
requested_count                       constrained to 3, 5, or 10
model_used                            non-null allowlisted model ID
prompt_token_count                    nullable non-negative integer
candidate_token_count                 nullable non-negative integer
total_token_count                     nullable non-negative integer
created_at                            non-null
```

Do not store:

- topic;
- interests snapshot;
- profile snapshot;
- questions or answers as a batch blob;
- prompt;
- raw request;
- raw model response;
- safety feedback body;
- API key;
- provider error text.

### 17.4 Question provenance link

Add a nullable `generation_batch_id` foreign key to `questions`.

Constraint:

```text
source = 'ai_generated'  ⇔  generation_batch_id IS NOT NULL
```

The generated question text continues to live only in the normal question row.

### 17.5 Existing safety metadata

Generated owner-only questions must not receive fabricated public-submission safety fingerprints or retention timestamps.

Adjust existing safety metadata columns and constraints so that:

- `public_profile` questions retain their current required public-submission safety metadata;
- `ai_generated` questions store those fields as `NULL`;
- source-specific database checks enforce both cases.

The migration must preserve all existing public question rows without compatibility code.

### 17.6 Deletion and referential behavior

- deleting a generated question does not delete the batch row;
- a batch cannot be deleted while referenced by a question;
- account deletion removes generated questions, batches, settings, and credentials using the existing account-deletion order/transaction;
- successful batches may remain even when all their questions were later deleted because they contain only minimal non-content metadata;
- no background cleanup job is required.

---

## 18. Server Boundaries

Create a focused feature slice following repository conventions, conceptually:

```text
app/features/question-generation/
  question-generation.schema.ts
  question-generation.repository.server.ts
  question-generation.service.server.ts
  gemini-question-generator.server.ts
  question-generation.crypto.server.ts
  question-generation-context.server.ts
  question-generation-normalize.ts
  question-generation.errors.ts
  components/
```

Use the repository's actual suffix and colocation conventions during implementation.

### 18.1 Responsibilities

**Route/action**
- authentication;
- request parsing;
- CSRF/origin protections already used by the app;
- invoke service;
- map typed domain errors to safe UI responses.

**Service**
- authorization;
- rate limits;
- settings and disclosure checks;
- context assembly;
- credential decryption;
- model resolution and fallback policy;
- SDK invocation;
- output validation;
- safety and duplicate checks;
- final transaction.

**Gemini module**
- create SDK client from the decrypted key;
- one structured generation call;
- classify provider errors;
- return validated provider-level data and usage metadata;
- contain no database or UI behavior.

**Repository module**
- bounded context queries;
- settings persistence;
- duplicate queries;
- transactionally insert batch and questions;
- no SDK behavior.

**Crypto module**
- parse keyring;
- encrypt;
- decrypt;
- validate versions and associated data;
- no database queries.

### 18.2 No generic provider port

Do not introduce types such as:

```text
AIProvider
LLMProvider
QuestionGenerationProviderRegistry
ProviderFactory
```

A small Gemini-specific module is the correct abstraction for one approved provider.

---

## 19. Request Flow

A generation request follows this exact sequence:

1. authenticate the user;
2. resolve and authorize the owned active profile;
3. parse language, style, quantity, and optional topic with Zod;
4. enforce per-user server rate limits;
5. load settings;
6. require current data-use acknowledgement;
7. require a validated stored credential;
8. load bounded personalization context;
9. decrypt the credential;
10. resolve the requested model;
11. make one Gemini structured-output request with a hard timeout;
12. if Auto's primary is specifically unavailable/retired, make one allowed fallback request;
13. parse and validate the structured output;
14. enforce count, language, length, plain-text, content, and safety rules;
15. calculate normalized text/hashes;
16. reject within-batch and existing exact duplicates;
17. begin a database transaction;
18. serialize concurrent generation writes for the owner using the repository's simplest supported row/advisory locking pattern;
19. repeat exact duplicate checks;
20. insert one batch row;
21. insert all question rows through the existing question domain behavior, with `source = ai_generated`;
22. commit;
23. return only the created owner-facing question data.

Any failure before commit saves nothing.

### 19.1 Timeout

Apply one server-side deadline of 30 seconds to the provider operation.

A timeout is a failure. Do not enqueue continuation work.

### 19.2 Fallback call count

Normal request:

```text
1 Gemini call
```

Auto request where the primary model is specifically unavailable or retired:

```text
1 primary call + at most 1 fallback call
```

All other failures:

```text
no fallback
```

---

## 20. Rate Limiting and Abuse Controls

BYOK does not remove the need to protect Askora's database, server functions, and provider-call surface.

Reuse the repository's existing database-backed rate-limit mechanism.

Initial server limits:

- 5 generation attempts per 10 minutes per owner;
- 25 generation attempts per rolling 24 hours per owner;
- only one in-flight client submission per surface;
- successful and failed provider attempts count;
- key-validation attempts use a separate conservative limit.

Return a friendly retry time when the local limiter blocks the request.

Provider quota errors remain provider quota errors. Auto must not switch models to bypass them.

Do not build a complete quota dashboard. When Gemini returns usage metadata on success, store only token counts in the batch record and optionally show aggregate usage later as a separate approved feature.

---

## 21. Error Taxonomy and UX

Use typed internal errors mapped to stable, safe user-facing messages.

| Category | Behavior |
|---|---|
| No saved key | Link to Question generation settings |
| Invalid or revoked key | Ask the owner to reconnect |
| Permission or billing problem | Ask the owner to check the Gemini project |
| Askora rate limit | Show when another attempt is available |
| Gemini quota limit | Explain that the user's Gemini quota was reached; no fallback |
| Selected model unavailable | Explicit model: ask owner to change it; Auto: use only the approved fallback |
| Provider safety block | Save nothing; ask owner to revise the topic |
| Askora policy rejection | Save nothing; use a neutral safe message |
| Invalid structured output | Save nothing; allow manual retry |
| Duplicate/quality validation | Save nothing; suggest changing topic/style |
| Timeout/network failure | Save nothing; allow manual retry |
| Encryption/key-version failure | Require reconnect; never expose crypto details |
| Database failure | Roll back; generic retry message; log non-content diagnostics |

Do not forward provider status text blindly. Map status codes and known SDK error types to internal categories.

---

## 22. Accessibility and Arabic/RTL

The feature must meet the same accessibility baseline as the rest of Askora.

Required behavior:

- accessible dialog title and description;
- keyboard-only operation;
- focus trap while open;
- Escape closes when no irreversible action is running;
- focus returns to the trigger;
- visible labels and error associations;
- generation progress announced through an appropriate live region;
- no progress conveyed through animation alone;
- reduced-motion behavior follows existing app settings;
- touch targets use existing design-system sizing;
- no horizontal overflow at supported mobile widths.

Directionality:

- topic input uses `dir="auto"`;
- generated Egyptian Arabic and Modern Standard Arabic question content renders with `dir="rtl"`;
- English content renders with `dir="ltr"`;
- punctuation and numerals remain natural for the selected language;
- the application chrome keeps its current locale direction; this feature does not implement full UI localization.

---

## 23. Observability and Privacy

Use existing structured logging and analytics facilities.

Allowed event fields:

- event name;
- internal user/profile ID;
- batch ID after success;
- selected language;
- selected style;
- requested count;
- actual model used;
- request duration;
- success/failure category;
- provider status category;
- token counts when supplied;
- timestamp.

Forbidden event fields:

- API key or key fragment;
- topic;
- interests;
- bio;
- question text;
- answer text;
- prompt;
- serialized context;
- raw model response;
- raw provider error body;
- safety feedback content.

Do not create a separate audit-log table unless the repository already requires one for comparable settings/security events.

Credential connect, replace, and delete actions should use the existing security-event logging mechanism, recording only action, actor, time, and outcome.

---

## 24. Implementation Sequence

Each phase is a working vertical increment and must pass the repository checks before the next begins.

### Phase 1 — Domain and migration foundation

- update the product specification to include this approved feature;
- add enums/tables/columns/checks;
- migrate existing rows;
- add Drizzle schema tests and migration tests;
- add settings repository and crypto module;
- add environment validation;
- keep UI routes unavailable until the slice is usable.

**Exit condition:** migration works against a copy of the current schema; existing question behavior remains green; encryption tests pass.

### Phase 2 — Secure settings end to end

- add the settings route section;
- implement connect/validate/encrypt/save;
- implement replace and hard delete;
- implement model preference and interests;
- implement disclosure acknowledgement;
- add rate limits and safe errors.

**Exit condition:** an owner can securely configure and remove Gemini without any generation path or credential leak.

### Phase 3 — Generation service without UI integration

- add bounded context builder;
- add prompt and structured-output schema;
- add Gemini call and model policy;
- add post-validation, safety, language, and exact duplicate checks;
- add atomic batch/question insertion;
- add typed failures;
- test with an injected fake SDK client.

**Exit condition:** service tests prove all-or-nothing insertion and no hidden retries.

### Phase 4 — Inbox flow

- add Generate questions action;
- add responsive dialog/sheet;
- connect route action to service;
- refresh inbox on success;
- preserve form values on failure;
- add RTL and accessibility behavior.

**Exit condition:** a configured owner can generate 3, 5, or 10 questions into the real inbox flow.

### Phase 5 — Provenance across lifecycle

- show owner-only Generated badge in inbox, editor, drafts, and owner profile;
- ensure existing edited-question presentation remains separate;
- add public payload and rendered-HTML leak tests.

**Exit condition:** owner sees provenance everywhere required; no guest or non-owner can detect it through supported public surfaces.

### Phase 6 — Full validation and documentation

- update beta/deployment documentation and environment examples;
- update Privacy Policy and Terms/data disclosure;
- run repository-wide checks;
- perform one real-key staging verification for each allowlisted model and language;
- complete desktop/mobile accessibility checks.

**Exit condition:** every acceptance criterion in Section 27 passes.

---

## 25. Required Repository Documentation Changes

### 25.1 Main product specification

Update `docs/specification.md` so that it no longer lists AI-generated questions as excluded from the current product direction.

Remove or replace any future direction that requires:

- a provider-agnostic wrapper;
- multiple providers;
- cached AI outputs.

Those ideas conflict with the approved one-provider, owner-initiated, no-raw-output-retention design.

Document:

- owner self-generation;
- direct inbox insertion;
- private provenance;
- personalization boundaries;
- BYOK;
- public-data non-disclosure;
- safety and deletion behavior.

### 25.2 Beta/deployment readiness

Update `docs/beta-readiness.md` with:

- required encryption environment variables;
- key generation and rotation procedure;
- migration order;
- deployment rollback considerations;
- real-key staging smoke test;
- credential redaction checks;
- account deletion verification.

### 25.3 Environment example

Add documented placeholders for:

```text
QUESTION_GENERATION_ENCRYPTION_KEYS
QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION
```

Never commit real keys.

### 25.4 Privacy and Terms

Explain:

- which owner data is sent to Gemini;
- that the owner supplies the API key;
- that Google processes the request under the owner's Gemini project/account terms;
- what Askora stores and does not store;
- how credentials are encrypted and deleted;
- that generated provenance is private;
- current retention behavior.

Legal wording must be reviewed as product policy, not improvised inside code comments.

---

## 26. Test Plan

### 26.1 Unit tests

**Schemas**
- valid and invalid quantities;
- language/style allowlists;
- topic and interest limits;
- strict provider output;
- exact requested count.

**Normalization and duplicates**
- Unicode normalization;
- Arabic and English punctuation;
- whitespace and case behavior;
- within-batch duplicates;
- matching existing normalized hashes;
- allowed related-but-not-identical questions.

**Context builder**
- only permitted fields;
- newest-first deterministic selection;
- pinned-item deduplication;
- per-answer and total clipping;
- no inbox, draft, deleted, report, or moderation content;
- prompt-injection text remains quoted data.

**Model policy**
- Auto primary;
- allowed Auto fallback;
- no fallback on auth, quota, billing, safety, timeout, malformed output, or explicit models;
- recorded model is the actual model used.

**Cryptography**
- encrypt/decrypt round trip;
- unique nonce per encryption;
- ciphertext tampering;
- tag tampering;
- wrong key;
- wrong owner-associated data;
- unknown key version;
- lazy rotation;
- malformed keyring;
- redacted error behavior.

### 26.2 Service and repository tests

- unauthenticated and non-owner rejection;
- missing disclosure;
- missing/invalid credential;
- local rate limits;
- bounded context query;
- successful 3/5/10 batches;
- all three languages;
- all styles;
- provider safety block;
- policy rejection;
- wrong language;
- malformed output;
- wrong count;
- overlong question;
- raw markup/link rejection;
- exact duplicate against existing question;
- duplicate within batch;
- transaction rollback after any insert failure;
- concurrent generation for one owner;
- no failed batch row;
- usage metadata optionality;
- disconnect/account deletion behavior.

### 26.3 Route and component tests

- settings connect/replace/delete;
- interests keyboard interaction;
- disclosure acknowledgement;
- model display;
- generation loading state;
- preserved form after failure;
- success closes and refreshes;
- focus behavior;
- live-region announcements;
- responsive dialog/sheet;
- `dir` behavior;
- owner badge in every required owner surface;
- existing Edited question behavior remains separate.

### 26.4 Public privacy tests

As guest and signed-in non-owner:

- no Generated badge;
- no source field;
- no batch ID;
- no model ID;
- no token counts;
- no inference through HTML attributes, metadata, hydration data, route JSON, or public APIs.

### 26.5 End-to-end tests

With the provider mocked:

1. connect a key;
2. save interests and model preference;
3. open inbox generation;
4. generate three questions;
5. verify inbox badges;
6. answer one;
7. save one as draft;
8. publish one;
9. verify owner profile badge;
10. verify guest view has no badge or provenance;
11. delete an inbox item;
12. disconnect Gemini.

### 26.6 Real-provider staging validation

Use a dedicated non-production Gemini project and test key.

For each allowlisted model:

- validate key connection;
- generate 3 questions in English;
- generate 3 in Modern Standard Arabic;
- generate 3 in Egyptian Arabic;
- verify structured output, latency, usage metadata, and explicit safety behavior;
- verify Auto fallback through a controlled fake error, not by depending on a real outage.

Do not place the real key in fixtures, recordings, screenshots, or CI logs.

### 26.7 Repository-wide commands

Run the exact commands defined by the repository's current `AGENTS.md` and `package.json`, including:

- type checking;
- strict linting;
- unit/integration tests;
- production build;
- end-to-end tests where required.

Do not hard-code stale command names in implementation tickets; use the repository's authoritative scripts at implementation time.

---

## 27. Acceptance Criteria

The feature is accepted only when all criteria below pass.

### Product

- owner can configure Gemini from Settings;
- owner can save private interests;
- owner can generate exactly 3, 5, or 10 questions;
- successful questions enter the normal inbox immediately;
- no preview, queue, partial batch, or hidden retry exists;
- all three languages and six styles work;
- owner can continue through draft and publication workflows;
- Generated provenance appears in all required owner surfaces;
- public users cannot see or infer provenance.

### Quality

- every saved item passes the strict schema and existing 500-character limit;
- exact normalized duplicates are blocked;
- semantic duplication is evaluated as a quality metric and is not presented as a deterministic guarantee;
- Balanced batches show meaningful variety;
- language mixing beyond normal borrowed terms is rejected;
- no content or formatting outside the question contract is inserted.

### Security and privacy

- browser never receives a stored API key;
- database never stores plaintext;
- AES-GCM tamper tests pass;
- key rotation path is tested;
- credentials, context, prompts, outputs, and provider bodies are absent from logs and analytics;
- private inbox, draft, deleted, report, and moderation content never enters the personalization query or provider payload;
- disconnect and account deletion remove credentials;
- public data surfaces contain no private provenance metadata.

### Reliability

- each normal request makes one provider call;
- only the defined Auto-unavailable case may make one fallback call;
- no failed request persists a batch or question;
- concurrent requests cannot insert duplicate generated questions;
- provider failures map to stable safe errors;
- local and provider quota errors do not trigger silent fallback.

### Accessibility and RTL

- keyboard and focus behavior pass;
- progress/error announcements pass;
- supported mobile layouts have no overflow;
- Arabic content direction and punctuation pass;
- English content direction passes.

### Repository integrity

- current public-question, inbox, answer, draft, publication, and deletion tests remain green;
- migration succeeds from the current production schema;
- typecheck, lint, tests, build, and required end-to-end checks pass;
- main product, beta readiness, environment, privacy, and Terms documentation are updated.

---

## 28. Rollback Strategy

The migration adds data structures and a new enum value. PostgreSQL enum values are not treated as casually reversible.

Rollback priorities:

1. stop exposing the generation action and settings route through a code deployment;
2. stop accepting generation actions server-side;
3. preserve encrypted credentials and generated question data until a deliberate data decision is made;
4. rollback application code only to a revision that safely tolerates the new schema;
5. do not attempt a destructive enum downgrade during an incident;
6. fix forward for migration defects unless a separately tested reverse migration exists.

No compatibility branch remains in normal code after the corrected deployment.

---

## 29. Validation Status

### Validated from the current Askora repository

The design was checked against the repository's current:

- `AGENTS.md`;
- package dependencies and Node requirement;
- React Router application structure;
- nested Settings and inbox routes;
- Drizzle/PostgreSQL question schema;
- existing self-question lifecycle;
- `question_source` enum;
- normalized question fields and safety metadata;
- main product specification;
- beta-readiness documentation.

The review found one important documentation conflict: the main product specification still describes AI-generated questions as excluded/future work. Section 25 makes its update a required part of implementation.

### Validated against current primary documentation

The design was checked against current official documentation for:

- the `@google/genai` JavaScript/TypeScript SDK;
- Gemini structured JSON output;
- model metadata/listing;
- Gemini 3.6 Flash, Gemini 3.5 Flash, and Gemini 3.5 Flash-Lite;
- safety settings;
- rate-limit behavior;
- API-key guidance and changing authorization-key behavior;
- Gemini thinking controls;
- Zod 4 JSON Schema;
- Node authenticated encryption primitives.

### Requires execution during implementation

The following cannot be honestly declared complete from a design review alone:

- applying the migration to a current database copy;
- running the repository's complete test suite;
- checking real Gemini credentials and quotas;
- measuring actual latency and Egyptian Arabic quality;
- testing deployment environment configuration;
- verifying production logging and public payloads after code exists.

These are explicit implementation acceptance gates, not unresolved architecture decisions.

---

## 30. Final Architecture Statement

Build one focused Askora feature that securely calls Gemini on the server with the owner's encrypted key, validates one structured batch, and inserts it into the existing question lifecycle in one transaction.

Do not build an AI platform around it.

Do not preserve obsolete assumptions.

Do not claim semantic guarantees the first version cannot enforce.

Do not send or retain more user data than the feature needs.

Do not begin the next implementation slice until the current one works end to end and passes its tests.
