import { data } from "react-router";

import type { InboxGenerationActionResult } from "~/features/question-generation/components/inbox-question-generation-dialog";
import { QuestionGenerationError } from "~/features/question-generation/question-generation.errors";
import { generateQuestionBatch } from "~/features/question-generation/question-generation.service.server";
import { questionGenerationRequestSchema } from "~/features/question-generation/question-generation.validations";

interface InboxGenerationRouteActionData {
  generation: InboxGenerationActionResult;
  inbox?: never;
}

export async function handleInboxGenerationAction({
  formData,
  session,
  generate = generateQuestionBatch,
}: {
  formData: FormData;
  session: Parameters<typeof generateQuestionBatch>[0]["session"];
  generate?: typeof generateQuestionBatch;
}) {
  const parsed = questionGenerationRequestSchema.safeParse({
    topic: getFormText(formData, "topic"),
    language: getFormText(formData, "language"),
    style: getFormText(formData, "style"),
    requestedCount: Number(getFormText(formData, "requestedCount")),
  });

  if (!parsed.success) {
    return data<InboxGenerationRouteActionData>(
      {
        generation: {
          status: "invalid",
          formError: "Check the generation fields and try again.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await generate({ input: parsed.data, session });

    return data<InboxGenerationRouteActionData>(
      { generation: { status: "generated", questions: result.questions } },
      { status: 200 },
    );
  } catch (error) {
    return data<InboxGenerationRouteActionData>(
      { generation: toInboxGenerationErrorResult(error) },
      { status: getInboxGenerationErrorResponseStatus(error) },
    );
  }
}

function toInboxGenerationErrorResult(
  error: unknown,
): InboxGenerationActionResult {
  if (error instanceof QuestionGenerationError) {
    return error.retryAfterSeconds === undefined
      ? { status: "failed", formError: error.message }
      : {
          status: "failed",
          formError: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        };
  }

  return {
    status: "failed",
    formError: "The batch could not be created. Try again.",
  };
}

function getInboxGenerationErrorResponseStatus(error: unknown) {
  if (!(error instanceof QuestionGenerationError)) {
    return 500;
  }

  if (error.code === "rate_limited") {
    return 429;
  }

  if (error.code === "unauthorized") {
    return 401;
  }

  if (
    error.code === "provider_unavailable" ||
    error.code === "provider_timeout"
  ) {
    return 503;
  }

  return error.code === "persistence_failed" ? 500 : 422;
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}
