import { GoogleGenAI, type Model } from "@google/genai";

const GEMINI_CREDENTIAL_VALIDATION_TIMEOUT_MILLISECONDS = 8_000;

export type GeminiCredentialValidationFailure =
  | "invalid_credential"
  | "permission_or_billing"
  | "quota"
  | "model_unavailable"
  | "unavailable";

export type GeminiCredentialValidationResult =
  | { status: "validated" }
  | { status: "failed"; reason: GeminiCredentialValidationFailure };

export interface GeminiCredentialValidationClient {
  models: {
    get(params: {
      model: string;
      config: { httpOptions: { timeout: number } };
    }): Promise<Model>;
  };
}

export async function validateGeminiCredential({
  apiKey,
  clientFactory = createGeminiCredentialValidationClient,
  model,
}: {
  apiKey: string;
  model: string;
  clientFactory?: (
    apiKey: string,
  ) => GeminiCredentialValidationClient | undefined;
}): Promise<GeminiCredentialValidationResult> {
  try {
    const client = clientFactory(apiKey);

    if (client === undefined) {
      return { status: "failed", reason: "unavailable" };
    }

    const metadata = await client.models.get({
      model,
      config: {
        httpOptions: {
          timeout: GEMINI_CREDENTIAL_VALIDATION_TIMEOUT_MILLISECONDS,
        },
      },
    });

    return supportsTextGeneration(metadata)
      ? { status: "validated" }
      : { status: "failed", reason: "model_unavailable" };
  } catch (error) {
    return { status: "failed", reason: classifyGeminiValidationError(error) };
  }
}

function createGeminiCredentialValidationClient(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "v1" },
  });
}

function supportsTextGeneration(metadata: Model) {
  return (
    metadata.name !== undefined &&
    (metadata.supportedActions === undefined ||
      metadata.supportedActions.includes("generateContent"))
  );
}

function classifyGeminiValidationError(
  error: unknown,
): GeminiCredentialValidationFailure {
  const status = getProviderStatus(error);

  if (status === 401) {
    return "invalid_credential";
  }

  if (status === 403) {
    return "permission_or_billing";
  }

  if (status === 429) {
    return "quota";
  }

  if (status === 404) {
    return "model_unavailable";
  }

  return "unavailable";
}

function getProviderStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}
