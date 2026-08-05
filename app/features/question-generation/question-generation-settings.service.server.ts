import type { ZodError } from "zod";

import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  QUESTION_GENERATION_DISCLOSURE_VERSION,
  QUESTION_GENERATION_MODELS,
  resolveQuestionGenerationModel,
  type QuestionGenerationModelPreference,
} from "~/features/question-generation/question-generation.constants";
import {
  decryptAndRotateQuestionGenerationCredential,
  encryptQuestionGenerationCredential,
  type StoredQuestionGenerationCredential,
} from "~/features/question-generation/question-generation.crypto.server";
import {
  validateGeminiCredential,
  type GeminiCredentialValidationResult,
} from "~/features/question-generation/gemini-credential-validation.server";
import {
  createDrizzleQuestionGenerationSettingsRepository,
  type QuestionGenerationSettingsRepository,
  type StoredQuestionGenerationSettings,
} from "~/features/question-generation/question-generation.repository.server";
import {
  isQuestionGenerationModelPreference,
  questionGenerationConnectSchema,
  questionGenerationDisclosureSchema,
  questionGenerationPreferencesSchema,
  questionGenerationSettingsIntentValues,
  type QuestionGenerationPreferences,
} from "~/features/question-generation/question-generation.validations";
import {
  checkRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "~/lib/rate-limit.server";
import { parseFormData } from "~/lib/zod-form";

const CREDENTIAL_VALIDATION_RATE_LIMIT = {
  max: 3,
  windowSeconds: 10 * 60,
} as const;

export interface QuestionGenerationSettingsViewData {
  connected: boolean;
  credentialValidatedAt: string | undefined;
  disclosureAcknowledged: boolean;
  disclosureVersion: number;
  modelPreference: QuestionGenerationModelPreference;
  questionInterests: string[];
}

export interface QuestionGenerationSettingsFormValues {
  intent:
    | "connect"
    | "disconnect"
    | "save_preferences"
    | "acknowledge_disclosure"
    | "unknown";
  modelPreference: QuestionGenerationModelPreference;
  questionInterests: string[];
  acknowledgeDisclosure: boolean;
}

export interface QuestionGenerationSettingsFieldErrors {
  geminiApiKey?: string;
  modelPreference?: string;
  questionInterests?: string;
  acknowledgeDisclosure?: string;
  intent?: string;
}

export type QuestionGenerationSettingsSubmissionResult =
  | {
      status:
        | "credential_connected"
        | "credential_replaced"
        | "credential_disconnected"
        | "preferences_saved"
        | "disclosure_acknowledged";
      values: QuestionGenerationSettingsFormValues;
    }
  | {
      status: "invalid";
      values: QuestionGenerationSettingsFormValues;
      fieldErrors: QuestionGenerationSettingsFieldErrors;
      formError: string;
    }
  | {
      status: "credential_invalid" | "provider_unavailable" | "rate_limited" | "suspended";
      values: QuestionGenerationSettingsFormValues;
      formError: string;
      retryAfterSeconds?: number;
    };

export async function loadQuestionGenerationSettings({
  session,
  repository = createDrizzleQuestionGenerationSettingsRepository(),
}: {
  session: CompletedProfileSessionSummary;
  repository?: QuestionGenerationSettingsRepository;
}): Promise<QuestionGenerationSettingsViewData> {
  const settings = await repository.findSettings(session.user.id);

  return toQuestionGenerationSettingsViewData(settings);
}

export async function submitQuestionGenerationSettings({
  formData,
  encryptCredential = encryptQuestionGenerationCredential,
  now = new Date(),
  rateLimiter = checkRateLimit,
  repository = createDrizzleQuestionGenerationSettingsRepository(),
  session,
  validateCredential = validateGeminiCredential,
}: {
  formData: FormData;
  session: CompletedProfileSessionSummary;
  repository?: QuestionGenerationSettingsRepository;
  encryptCredential?: (input: {
    credential: string;
    ownerUserId: string;
  }) => StoredQuestionGenerationCredential;
  rateLimiter?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
  validateCredential?: (input: {
    apiKey: string;
    model: string;
  }) => Promise<GeminiCredentialValidationResult>;
  now?: Date;
}): Promise<QuestionGenerationSettingsSubmissionResult> {
  const values = getQuestionGenerationSettingsFormValues(formData);

  if (session.suspensionStatus === "active") {
    return safeError(values, "suspended");
  }

  switch (values.intent) {
    case "connect":
      return connectCredential({
        formData,
        encryptCredential,
        now,
        rateLimiter,
        repository,
        session,
        validateCredential,
        values,
      });
    case "disconnect":
      await repository.clearCredential({
        ownerUserId: session.user.id,
        profileId: session.profile.id,
        now,
      });
      return { status: "credential_disconnected", values };
    case "save_preferences":
      return savePreferences({ formData, now, repository, session, values });
    case "acknowledge_disclosure":
      return acknowledgeDisclosure({ formData, now, repository, session, values });
    case "unknown":
      return invalidResult(values, { intent: "Choose a question-generation action." });
  }
}

export async function getQuestionGenerationCredential({
  decryptCredential = decryptAndRotateQuestionGenerationCredential,
  now = new Date(),
  repository = createDrizzleQuestionGenerationSettingsRepository(),
  ownerUserId,
}: {
  ownerUserId: string;
  repository?: QuestionGenerationSettingsRepository;
  decryptCredential?: (input: {
    material: StoredQuestionGenerationCredential;
    ownerUserId: string;
  }) => {
    credential: string;
    rotatedMaterial: StoredQuestionGenerationCredential | undefined;
  };
  now?: Date;
}) {
  const settings = await repository.findSettings(ownerUserId);
  const material = getStoredCredentialMaterial(settings);

  if (material === undefined) {
    return undefined;
  }

  const decrypted = decryptCredential({
    material,
    ownerUserId,
  });

  if (decrypted.rotatedMaterial !== undefined) {
    await repository.replaceCredentialMaterial({
      ownerUserId,
      material: decrypted.rotatedMaterial,
      now,
    });
  }

  return decrypted.credential;
}

function toQuestionGenerationSettingsViewData(
  settings: StoredQuestionGenerationSettings | undefined,
): QuestionGenerationSettingsViewData {
  return {
    connected: getStoredCredentialMaterial(settings) !== undefined,
    credentialValidatedAt:
      settings?.credentialValidatedAt?.toISOString(),
    disclosureAcknowledged:
      settings?.dataDisclosureVersion === QUESTION_GENERATION_DISCLOSURE_VERSION &&
      settings.dataDisclosureAcceptedAt !== null,
    disclosureVersion: QUESTION_GENERATION_DISCLOSURE_VERSION,
    modelPreference:
      settings?.modelPreference ?? QUESTION_GENERATION_MODELS.auto,
    questionInterests: settings?.questionInterests ?? [],
  };
}

async function connectCredential({
  formData,
  encryptCredential,
  now,
  rateLimiter,
  repository,
  session,
  validateCredential,
  values,
}: {
  formData: FormData;
  encryptCredential: (input: {
    credential: string;
    ownerUserId: string;
  }) => StoredQuestionGenerationCredential;
  now: Date;
  rateLimiter: (options: RateLimitOptions) => Promise<RateLimitDecision>;
  repository: QuestionGenerationSettingsRepository;
  session: CompletedProfileSessionSummary;
  validateCredential: (input: {
    apiKey: string;
    model: string;
  }) => Promise<GeminiCredentialValidationResult>;
  values: QuestionGenerationSettingsFormValues;
}): Promise<QuestionGenerationSettingsSubmissionResult> {
  const parsed = parseFormData(questionGenerationConnectSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, getConnectFieldErrors(parsed.error));
  }

  const rateLimit = await rateLimiter({
    key: `question-generation:credential-validation:${session.user.id}`,
    ...CREDENTIAL_VALIDATION_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return safeError(values, "rate_limited", rateLimit.retryAfterSeconds);
  }

  const existing = await repository.findSettings(session.user.id);
  const securityEventAction =
    getStoredCredentialMaterial(existing) === undefined
      ? "credential_connected"
      : "credential_replaced";
  const validation = await validateCredential({
    apiKey: parsed.value.geminiApiKey,
    model: resolveQuestionGenerationModel(parsed.value.modelPreference),
  });

  if (validation.status === "failed") {
    await recordCredentialValidationFailure({
      action: securityEventAction,
      now,
      repository,
      session,
    });
    return validation.reason === "invalid_credential"
      ? safeError(values, "credential_invalid")
      : safeError(values, "provider_unavailable");
  }

  const material = encryptCredential({
    credential: parsed.value.geminiApiKey,
    ownerUserId: session.user.id,
  });

  await repository.saveValidatedCredential({
    ownerUserId: session.user.id,
    profileId: session.profile.id,
    modelPreference: parsed.value.modelPreference,
    material,
    action: securityEventAction,
    now,
  });

  return {
    status: securityEventAction,
    values,
  };
}

async function recordCredentialValidationFailure({
  action,
  now,
  repository,
  session,
}: {
  action: "credential_connected" | "credential_replaced";
  now: Date;
  repository: QuestionGenerationSettingsRepository;
  session: CompletedProfileSessionSummary;
}) {
  try {
    await repository.recordSecurityEvent({
      action,
      now,
      outcome: "failure",
      ownerUserId: session.user.id,
      profileId: session.profile.id,
    });
  } catch {
    // Observability must not turn a safely rejected credential into a misleading error.
  }
}

async function savePreferences({
  formData,
  now,
  repository,
  session,
  values,
}: {
  formData: FormData;
  now: Date;
  repository: QuestionGenerationSettingsRepository;
  session: CompletedProfileSessionSummary;
  values: QuestionGenerationSettingsFormValues;
}): Promise<QuestionGenerationSettingsSubmissionResult> {
  const parsed = parseFormData(questionGenerationPreferencesSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, getPreferenceFieldErrors(parsed.error));
  }

  await repository.savePreferences({
    ownerUserId: session.user.id,
    ...parsed.value,
    now,
  });

  return { status: "preferences_saved", values: toFormValues(values, parsed.value) };
}

async function acknowledgeDisclosure({
  formData,
  now,
  repository,
  session,
  values,
}: {
  formData: FormData;
  now: Date;
  repository: QuestionGenerationSettingsRepository;
  session: CompletedProfileSessionSummary;
  values: QuestionGenerationSettingsFormValues;
}): Promise<QuestionGenerationSettingsSubmissionResult> {
  const parsed = parseFormData(questionGenerationDisclosureSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, {
      acknowledgeDisclosure:
        "Acknowledge the data-use disclosure before generating questions.",
    });
  }

  await repository.saveDisclosureAcknowledgement({
    ownerUserId: session.user.id,
    disclosureVersion: QUESTION_GENERATION_DISCLOSURE_VERSION,
    now,
  });

  return { status: "disclosure_acknowledged", values };
}

function getQuestionGenerationSettingsFormValues(
  formData: FormData,
): QuestionGenerationSettingsFormValues {
  const intent = getFormText(formData, "intent");
  const modelPreference = getFormText(formData, "modelPreference");
  return {
    intent: isQuestionGenerationSettingsIntent(intent)
      ? intent
      : "unknown",
    modelPreference: isQuestionGenerationModelPreference(modelPreference)
      ? modelPreference
      : QUESTION_GENERATION_MODELS.auto,
    questionInterests: getQuestionGenerationInterestFormValues(formData),
    acknowledgeDisclosure: getFormText(formData, "acknowledgeDisclosure") === "true",
  };
}

function getStoredCredentialMaterial(
  settings: StoredQuestionGenerationSettings | undefined,
): StoredQuestionGenerationCredential | undefined {
  if (
    settings?.geminiKeyCiphertext === null ||
    settings?.geminiKeyNonce === null ||
    settings?.geminiKeyAuthTag === null ||
    settings?.geminiKeyVersion === null ||
    settings === undefined
  ) {
    return undefined;
  }

  return {
    ciphertext: settings.geminiKeyCiphertext,
    nonce: settings.geminiKeyNonce,
    authTag: settings.geminiKeyAuthTag,
    keyVersion: settings.geminiKeyVersion,
  };
}

function getConnectFieldErrors(error: ZodError) {
  const fieldErrors: QuestionGenerationSettingsFieldErrors = {};

  for (const issue of error.issues) {
    if (issue.path[0] === "geminiApiKey") {
      fieldErrors.geminiApiKey ??= issue.message;
    }

    if (issue.path[0] === "modelPreference") {
      fieldErrors.modelPreference ??= issue.message;
    }
  }

  return fieldErrors;
}

function getPreferenceFieldErrors(error: ZodError) {
  const fieldErrors: QuestionGenerationSettingsFieldErrors = {};

  for (const issue of error.issues) {
    if (issue.path[0] === "modelPreference") {
      fieldErrors.modelPreference ??= issue.message;
    }

    if (issue.path[0] === "questionInterests") {
      fieldErrors.questionInterests ??= issue.message;
    }
  }

  return fieldErrors;
}

function invalidResult(
  values: QuestionGenerationSettingsFormValues,
  fieldErrors: QuestionGenerationSettingsFieldErrors,
): QuestionGenerationSettingsSubmissionResult {
  return {
    status: "invalid",
    values,
    fieldErrors,
    formError: "Check the question-generation settings and try again.",
  };
}

function safeError(
  values: QuestionGenerationSettingsFormValues,
  status: Extract<
    QuestionGenerationSettingsSubmissionResult["status"],
    "credential_invalid" | "provider_unavailable" | "rate_limited" | "suspended"
  >,
  retryAfterSeconds?: number,
): QuestionGenerationSettingsSubmissionResult {
  const messages = {
    credential_invalid: "Gemini could not validate this key. Check it and try again.",
    provider_unavailable:
      "Gemini could not validate this connection right now. Try again later.",
    rate_limited: "Too many key checks. Try again later.",
    suspended: "Question generation settings are unavailable while this account is suspended.",
  } as const;

  return retryAfterSeconds === undefined
    ? { status, values, formError: messages[status] }
    : { status, values, formError: messages[status], retryAfterSeconds };
}

function toFormValues(
  values: QuestionGenerationSettingsFormValues,
  preferences: QuestionGenerationPreferences,
) {
  return { ...values, ...preferences };
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getQuestionGenerationInterestFormValues(formData: FormData) {
  return getFormText(formData, "questionInterests")
    .split("\n")
    .map((interest) => interest.trim())
    .filter(Boolean);
}

function isQuestionGenerationSettingsIntent(
  value: string,
): value is Exclude<QuestionGenerationSettingsFormValues["intent"], "unknown"> {
  return questionGenerationSettingsIntentValues.includes(
    value as (typeof questionGenerationSettingsIntentValues)[number],
  );
}
