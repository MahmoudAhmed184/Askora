import type { To } from "react-router";

import {
  threadModalPublicIdParam,
  threadModalUsernameParam,
} from "~/features/threads/thread-modal";
import { isBoundedPublicId } from "~/lib/public-id";

export const answerModalQuestionIdParam = "answerQuestionId";

const answerModalSearchParams = [answerModalQuestionIdParam] as const;

export type AnswerModalParams =
  | { questionId: string }
  | { questionPublicId: string };

export interface AnswerModalResolvedParams {
  questionPublicId: string;
}

export interface AnswerModalLocation {
  hash: string;
  pathname: string;
  search: string;
}

export interface AnswerModalLink {
  focusReturnId: string;
  mask: To;
  to: To;
}

export function createAnswerModalLink({
  location,
  ...params
}: AnswerModalParams & { location: AnswerModalLocation }): AnswerModalLink {
  const questionPublicId = getQuestionPublicId(params);
  const searchParams = new URLSearchParams(location.search);

  searchParams.delete(threadModalUsernameParam);
  searchParams.delete(threadModalPublicIdParam);
  searchParams.set(answerModalQuestionIdParam, questionPublicId);

  return {
    focusReturnId: getAnswerModalFocusReturnId({ questionPublicId }),
    mask: createCanonicalAnswerPath({ questionPublicId }),
    to: {
      hash: location.hash,
      pathname: location.pathname,
      search: toSearchString(searchParams),
    },
  };
}

export function createCanonicalAnswerPath({
  ...params
}: AnswerModalParams) {
  const questionPublicId = getQuestionPublicId(params);
  return `/answer/${encodeURIComponent(questionPublicId)}`;
}

export function getAnswerModalFocusReturnId({
  ...params
}: AnswerModalParams) {
  const questionPublicId = getQuestionPublicId(params);
  return `answer-modal-${questionPublicId}`;
}

export function getAnswerModalParams(
  searchParams: URLSearchParams,
): AnswerModalResolvedParams | undefined {
  if (
    searchParams.has(threadModalUsernameParam) ||
    searchParams.has(threadModalPublicIdParam)
  ) {
    return undefined;
  }

  const questionPublicId = searchParams.get(answerModalQuestionIdParam);

  if (questionPublicId === null || !isBoundedPublicId(questionPublicId)) {
    return undefined;
  }

  return { questionPublicId };
}

export function hasAnswerModalSearchParamChange(
  currentUrl: URL,
  nextUrl: URL,
) {
  return answerModalSearchParams.some(
    (param) =>
      currentUrl.searchParams.get(param) !== nextUrl.searchParams.get(param),
  );
}

export function isAnswerModalOnlySearchParamChange(
  currentUrl: URL,
  nextUrl: URL,
) {
  return (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.hash === nextUrl.hash &&
    hasAnswerModalSearchParamChange(currentUrl, nextUrl) &&
    getSearchWithoutAnswerModalParams(currentUrl) ===
      getSearchWithoutAnswerModalParams(nextUrl)
  );
}

export function removeAnswerModalSearchParams(
  location: AnswerModalLocation,
): To {
  const searchParams = new URLSearchParams(location.search);

  for (const param of answerModalSearchParams) {
    searchParams.delete(param);
  }

  return {
    hash: location.hash,
    pathname: location.pathname,
    search: toSearchString(searchParams),
  };
}

function getSearchWithoutAnswerModalParams(url: URL) {
  const searchParams = new URLSearchParams(url.search);

  for (const param of answerModalSearchParams) {
    searchParams.delete(param);
  }

  return serializeSearchParams(searchParams);
}

function serializeSearchParams(searchParams: URLSearchParams) {
  return new URLSearchParams(
    [...searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }

      return leftValue.localeCompare(rightValue);
    }),
  ).toString();
}

function toSearchString(searchParams: URLSearchParams) {
  const value = searchParams.toString();

  return value.length === 0 ? "" : `?${value}`;
}

function getQuestionPublicId(params: AnswerModalParams) {
  return "questionPublicId" in params ? params.questionPublicId : params.questionId;
}
