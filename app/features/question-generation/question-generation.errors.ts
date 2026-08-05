export type QuestionGenerationErrorCode =
  | "unauthorized"
  | "profile_unavailable"
  | "rate_limited"
  | "disclosure_required"
  | "credential_required"
  | "credential_unavailable"
  | "provider_invalid_credential"
  | "provider_permission"
  | "provider_quota"
  | "provider_model_unavailable"
  | "provider_safety"
  | "provider_unavailable"
  | "provider_timeout"
  | "invalid_output"
  | "policy_rejected"
  | "duplicate"
  | "persistence_failed";

export class QuestionGenerationError extends Error {
  constructor(
    public readonly code: QuestionGenerationErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(getQuestionGenerationErrorMessage(code));
    this.name = "QuestionGenerationError";
  }
}

function getQuestionGenerationErrorMessage(code: QuestionGenerationErrorCode) {
  const messages = {
    unauthorized: "Sign in to generate questions.",
    profile_unavailable: "Question generation is unavailable for this profile.",
    rate_limited: "Too many generation attempts. Try again later.",
    disclosure_required: "Acknowledge the data-use disclosure before generating questions.",
    credential_required: "Connect Gemini in Question generation settings first.",
    credential_unavailable: "Reconnect Gemini in Question generation settings.",
    provider_invalid_credential: "Reconnect Gemini in Question generation settings.",
    provider_permission: "Check the Gemini project permissions and billing.",
    provider_quota: "Your Gemini quota was reached. Try again later.",
    provider_model_unavailable: "The selected Gemini model is unavailable. Choose another model.",
    provider_safety: "This batch could not be created safely. Revise the topic and try again.",
    provider_unavailable: "Gemini is unavailable right now. Try again later.",
    provider_timeout: "Gemini took too long. Try again.",
    invalid_output: "The generated batch could not be validated. Try again.",
    policy_rejected: "This batch could not be created safely. Revise the topic and try again.",
    duplicate: "Try a different topic or style to generate distinct questions.",
    persistence_failed: "The batch could not be saved. Try again.",
  } as const;

  return messages[code];
}
