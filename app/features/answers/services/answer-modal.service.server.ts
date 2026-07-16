import {
  isSessionSuspended,
  type CurrentSessionSummary,
} from "~/features/auth/services/auth.service.server";
import {
  createCanonicalAnswerPath,
  getAnswerModalFocusReturnId,
  getAnswerModalParams,
  type AnswerModalResolvedParams,
} from "~/features/answers/answer-modal";
import {
  loadAnswerEditor,
  type AnswerEditorViewData,
} from "~/features/answers/services/answer.service.server";

export type AnswerModalData =
  | {
      canonicalPath: string;
      editor: AnswerEditorViewData;
      focusReturnId: string;
      isSuspended: boolean;
      questionPublicId: string;
      status: "found";
    }
  | {
      canonicalPath: string;
      focusReturnId: string;
      questionPublicId: string;
      status: "not_found";
    };

export async function loadAnswerModalData({
  request,
  session,
}: {
  request: Request;
  session: CurrentSessionSummary;
}): Promise<AnswerModalData | undefined> {
  const params = getAnswerModalParams(new URL(request.url).searchParams);

  if (params === undefined) {
    return undefined;
  }

  const baseData = getBaseModalData(params);

  if (
    session.status !== "authenticated" ||
    session.profileStatus !== "complete"
  ) {
    return { ...baseData, status: "not_found" };
  }

  const result = await loadAnswerEditor({
    questionPublicId: params.questionPublicId,
    session,
  });

  if (result.status === "not_found") {
    return { ...baseData, status: "not_found" };
  }

  return {
    ...baseData,
    editor: result.editor,
    isSuspended: isSessionSuspended(session),
    status: "found",
  };
}

function getBaseModalData(params: AnswerModalResolvedParams) {
  return {
    canonicalPath: createCanonicalAnswerPath(params),
    focusReturnId: getAnswerModalFocusReturnId(params),
    questionPublicId: params.questionPublicId,
  };
}
