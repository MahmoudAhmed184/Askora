import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  QUESTION_GENERATION_DISCLOSURE_VERSION,
  type QuestionGenerationModelPreference,
} from "~/features/question-generation/question-generation.constants";
import {
  buildQuestionGenerationContext,
} from "~/features/question-generation/question-generation-context.server";
import { QuestionGenerationError } from "~/features/question-generation/question-generation.errors";
import {
  generateGeminiQuestions,
  type GeminiQuestionGenerationResult,
} from "~/features/question-generation/gemini-question-generator.server";
import {
  normalizeQuestionGenerationText,
} from "~/features/question-generation/question-generation-normalize";
import {
  createDrizzleQuestionGenerationRepository,
  type QuestionGenerationRepository,
} from "~/features/question-generation/question-generation.repository.server";
import { getQuestionGenerationCredential } from "~/features/question-generation/question-generation-settings.service.server";
import {
  questionGenerationRequestSchema,
  type QuestionGenerationRequest,
} from "~/features/question-generation/question-generation.validations";
import { normalizeMutedPhrase } from "~/features/moderation/validations/moderation.validations";
import { hashWithHmacSha256 } from "~/lib/crypto.server";
import { createDatabaseId, createPublicId } from "~/lib/ids.server";
import { checkRateLimit, type RateLimitDecision, type RateLimitOptions } from "~/lib/rate-limit.server";

const GENERATION_RATE_LIMITS = [
  { max: 5, windowSeconds: 10 * 60, suffix: "10-minute" },
  { max: 25, windowSeconds: 24 * 60 * 60, suffix: "24-hour" },
] as const;

export interface GeneratedInboxQuestion {
  id: string;
  publicId: string;
  text: string;
}

export interface QuestionGenerationResult {
  batchId: string;
  questions: GeneratedInboxQuestion[];
}

export async function generateQuestionBatch({
  createId = createDatabaseId,
  createQuestionPublicId = () => createPublicId("qst"),
  generate = generateGeminiQuestions,
  getCredential = getQuestionGenerationCredential,
  input,
  now = new Date(),
  rateLimiter = checkRateLimit,
  repository = createDrizzleQuestionGenerationRepository(),
  session,
}: {
  input: unknown;
  session: CompletedProfileSessionSummary;
  repository?: QuestionGenerationRepository;
  rateLimiter?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
  getCredential?: (input: {
    ownerUserId: string;
    repository: QuestionGenerationRepository;
    now: Date;
  }) => Promise<string | undefined>;
  generate?: (input: {
    apiKey: string;
    context: ReturnType<typeof buildQuestionGenerationContext>;
    preference: QuestionGenerationModelPreference;
    requestedCount: number;
  }) => Promise<GeminiQuestionGenerationResult>;
  createId?: () => string;
  createQuestionPublicId?: () => string;
  now?: Date;
}): Promise<QuestionGenerationResult> {
  const request = parseGenerationRequest(input);
  ensureActiveSession(session);
  await enforceGenerationRateLimits({ now, rateLimiter, userId: session.user.id });

  const profile = await repository.findOwnedActiveProfile({
    ownerUserId: session.user.id,
    profileId: session.profile.id,
  });

  if (profile === undefined) throw new QuestionGenerationError("profile_unavailable");

  const settings = await repository.findSettings(session.user.id);
  if (settings?.dataDisclosureVersion !== QUESTION_GENERATION_DISCLOSURE_VERSION) {
    throw new QuestionGenerationError("disclosure_required");
  }

  if (settings.dataDisclosureAcceptedAt === null) {
    throw new QuestionGenerationError("disclosure_required");
  }

  if (settings.credentialValidatedAt === null) {
    throw new QuestionGenerationError("credential_required");
  }

  const credential = await getGenerationCredential({
    getCredential,
    now,
    repository,
    userId: session.user.id,
  });
  if (credential === undefined) throw new QuestionGenerationError("credential_required");

  const pairs = await repository.findPublishedPairs(profile.id);
  const context = buildQuestionGenerationContext({
    profile,
    interests: settings.questionInterests,
    language: request.language,
    style: request.style,
    pairs,
    topic: request.topic,
  });
  const generated = await generate({
    apiKey: credential,
    context,
    preference: settings.modelPreference,
    requestedCount: request.requestedCount,
  });
  const texts = validateGeneratedQuestions({
    language: request.language,
    mutedPhrases: await repository.findMutedPhrases(profile.id),
    requestedCount: request.requestedCount,
    texts: generated.questions.map((question) => question.text),
  });
  const generatedQuestions = texts.map((text) => ({
    id: createId(),
    publicId: createQuestionPublicId(),
    text,
    normalizedTextHash: hashWithHmacSha256(
      normalizeQuestionGenerationText(text),
      "question-text",
    ),
  }));
  const hashes = generatedQuestions.map((question) => question.normalizedTextHash);
  const existing = await repository.findExistingNormalizedTextHashes({
    hashes,
    profileId: profile.id,
  });
  if (existing.length > 0) throw new QuestionGenerationError("duplicate");

  const batchId = createId();
  await persistGeneratedBatch({
    batchId,
    generated,
    generatedQuestions,
    now,
    profileId: profile.id,
    repository,
    request,
    userId: session.user.id,
  });

  return {
    batchId,
    questions: generatedQuestions.map(({ id, publicId, text }) => ({ id, publicId, text })),
  };
}

async function getGenerationCredential({
  getCredential,
  now,
  repository,
  userId,
}: {
  getCredential: (input: {
    ownerUserId: string;
    repository: QuestionGenerationRepository;
    now: Date;
  }) => Promise<string | undefined>;
  now: Date;
  repository: QuestionGenerationRepository;
  userId: string;
}) {
  try {
    return await getCredential({ ownerUserId: userId, repository, now });
  } catch {
    throw new QuestionGenerationError("credential_unavailable");
  }
}

async function persistGeneratedBatch({
  batchId,
  generated,
  generatedQuestions,
  now,
  profileId,
  repository,
  request,
  userId,
}: {
  batchId: string;
  generated: GeminiQuestionGenerationResult;
  generatedQuestions: {
    id: string;
    publicId: string;
    text: string;
    normalizedTextHash: string;
  }[];
  now: Date;
  profileId: string;
  repository: QuestionGenerationRepository;
  request: QuestionGenerationRequest;
  userId: string;
}) {
  try {
    await repository.persistGeneratedBatch({
      ownerUserId: userId,
      profileId,
      language: request.language,
      style: request.style,
      requestedCount: request.requestedCount,
      modelUsed: generated.modelUsed,
      usage: generated.usage,
      questions: generatedQuestions,
      batchId,
      now,
    });
  } catch (error) {
    if (error instanceof QuestionGenerationError) throw error;
    throw new QuestionGenerationError("persistence_failed");
  }
}

function parseGenerationRequest(input: unknown) {
  const parsed = questionGenerationRequestSchema.safeParse(input);
  if (!parsed.success) throw new QuestionGenerationError("invalid_output");

  return parsed.data;
}

function ensureActiveSession(session: CompletedProfileSessionSummary) {
  if (session.suspensionStatus === "active" || session.profileActive === false || session.deletionPending) {
    throw new QuestionGenerationError("profile_unavailable");
  }
}

async function enforceGenerationRateLimits({
  now,
  rateLimiter,
  userId,
}: {
  now: Date;
  rateLimiter: (options: RateLimitOptions) => Promise<RateLimitDecision>;
  userId: string;
}) {
  for (const limit of GENERATION_RATE_LIMITS) {
    const decision = await rateLimiter({
      key: `question-generation:attempt:${limit.suffix}:${userId}`,
      max: limit.max,
      windowSeconds: limit.windowSeconds,
      now: () => now.getTime(),
    });
    if (!decision.allowed) throw new QuestionGenerationError("rate_limited", decision.retryAfterSeconds);
  }
}

export function validateGeneratedQuestions({
  language,
  mutedPhrases,
  requestedCount,
  texts,
}: {
  language: QuestionGenerationRequest["language"];
  mutedPhrases: string[];
  requestedCount: number;
  texts: string[];
}) {
  if (texts.length !== requestedCount) throw new QuestionGenerationError("invalid_output");

  const seen = new Set<string>();
  return texts.map((text) => {
    const question = normalizeQuestionText(text);
    const normalized = normalizeQuestionGenerationText(question);

    if (
      !isQuestionContractValid(question) ||
      !matchesSelectedLanguage(question, language) ||
      isUnsafeQuestion(question) ||
      mutedPhrases.some((phrase) => normalizeMutedPhrase(question).includes(phrase)) ||
      seen.has(normalized)
    ) {
      throw new QuestionGenerationError(
        seen.has(normalized) ? "duplicate" : "policy_rejected",
      );
    }

    seen.add(normalized);
    return question;
  });
}

function normalizeQuestionText(text: string) {
  const trimmed = text.trim();
  const question = /[?؟]$/.test(trimmed) ? trimmed : `${trimmed}?`;
  return question.length <= 500 ? question : trimmed;
}

function isQuestionContractValid(text: string) {
  return text.length <= 500 && text.length > 0 &&
    (text.match(/[?؟]/g) ?? []).length === 1 &&
    !["<", ">", "`", "[", "]", "{", "}", "_", "*"].some((marker) => text.includes(marker)) &&
    !/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co)\b|\b\S+@\S+\.[a-z]+\b|\+?\d[\d\s()-]{6,}\d|[#@])/iu.test(text) &&
    !/^\s*(?:\d+[.)]|[٠-٩]+[.)]|question\s*:|سؤال\s*:|السؤال\s*:)/iu.test(text);
}

function matchesSelectedLanguage(text: string, language: QuestionGenerationRequest["language"]) {
  const arabic = (text.match(/[\u0600-\u06ff]/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const letters = arabic + latin;
  if (letters === 0) return false;
  if (language === "english") return latin / letters >= 0.8 && arabic / letters <= 0.1;
  return arabic / letters >= 0.6 && latin / letters <= 0.4;
}

function isUnsafeQuestion(text: string) {
  return /\b(?:password|api key|authentication code|credit card|bank account|phone number|email address|exact address|exact location|suicide|self-harm|weapon|bomb|medical diagnosis|legal advice|financial advice|explicit sex|nude|hate|racial|religion|ethnicity|sexuality|disability|trauma|abuse|political persuasion|vote for|illegal|crime|violence|kill|exploit|evasion)\b|(?:كلمة المرور|مفتاح api|انتحار|إيذاء النفس|عنوانك|موقعك|رقم هاتف|بريدك|جنس|عرق|دين|إعاقة|صدمة|سياسة|انتخب|عنف|قتل|جريمة)/iu.test(text);
}
