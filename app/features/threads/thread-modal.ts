import type { To } from "react-router";

import type { PublicThreadPageData } from "~/features/threads/types/threads.types";
import { USERNAME_PATTERN } from "~/features/profile-setup/username-policy";

export const threadModalUsernameParam = "threadUsername";
export const threadModalPublicIdParam = "threadPublicId";

const threadModalSearchParams = [
  threadModalUsernameParam,
  threadModalPublicIdParam,
] as const;
const THREAD_PUBLIC_ID_PATTERN = /^thr_[A-Za-z0-9_-]{1,64}$/;

export interface ThreadModalParams {
  username: string;
  threadPublicId: string;
}

export interface ThreadModalData {
  canonicalPath: string;
  page: PublicThreadPageData;
}

export interface ThreadModalLocation {
  hash: string;
  pathname: string;
  search: string;
}

export interface ThreadModalLink {
  mask: To;
  to: To;
}

export function createThreadModalLink({
  canonicalHash,
  location,
  threadPublicId,
  username,
}: ThreadModalParams & {
  canonicalHash?: string | undefined;
  location: ThreadModalLocation;
}): ThreadModalLink {
  const searchParams = new URLSearchParams(location.search);

  searchParams.set(threadModalUsernameParam, username);
  searchParams.set(threadModalPublicIdParam, threadPublicId);

  return {
    mask: createCanonicalThreadPath({
      hash: canonicalHash,
      threadPublicId,
      username,
    }),
    to: {
      hash: location.hash,
      pathname: location.pathname,
      search: toSearchString(searchParams),
    },
  };
}

export function createCanonicalThreadPath({
  hash,
  threadPublicId,
  username,
}: ThreadModalParams & {
  hash?: string | undefined;
}) {
  return `/${encodeURIComponent(username)}/a/${encodeURIComponent(
    threadPublicId,
  )}${normalizeHash(hash)}`;
}

export function getThreadModalParams(
  searchParams: URLSearchParams,
): ThreadModalParams | undefined {
  const username = searchParams.get(threadModalUsernameParam);
  const threadPublicId = searchParams.get(threadModalPublicIdParam);

  if (
    username === null ||
    threadPublicId === null ||
    !USERNAME_PATTERN.test(username) ||
    !THREAD_PUBLIC_ID_PATTERN.test(threadPublicId)
  ) {
    return undefined;
  }

  return { username, threadPublicId };
}

export function hasThreadModalSearchParamChange(
  currentUrl: URL,
  nextUrl: URL,
) {
  return threadModalSearchParams.some(
    (param) =>
      currentUrl.searchParams.get(param) !== nextUrl.searchParams.get(param),
  );
}

export function isThreadModalOnlySearchParamChange(
  currentUrl: URL,
  nextUrl: URL,
) {
  return (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.hash === nextUrl.hash &&
    hasThreadModalSearchParamChange(currentUrl, nextUrl) &&
    getSearchWithoutThreadModalParams(currentUrl) ===
      getSearchWithoutThreadModalParams(nextUrl)
  );
}

export function removeThreadModalSearchParams(
  location: ThreadModalLocation,
): To {
  const searchParams = new URLSearchParams(location.search);

  deleteThreadModalSearchParams(searchParams);

  return {
    hash: location.hash,
    pathname: location.pathname,
    search: toSearchString(searchParams),
  };
}

function getSearchWithoutThreadModalParams(url: URL) {
  const searchParams = new URLSearchParams(url.search);

  deleteThreadModalSearchParams(searchParams);

  return serializeSearchParams(searchParams);
}

function deleteThreadModalSearchParams(searchParams: URLSearchParams) {
  for (const param of threadModalSearchParams) {
    searchParams.delete(param);
  }
}

function serializeSearchParams(searchParams: URLSearchParams) {
  const sortedSearchParams = new URLSearchParams(
    [...searchParams.entries()].sort(compareSearchParamEntries),
  );

  return sortedSearchParams.toString();
}

function compareSearchParamEntries(
  [leftKey, leftValue]: [string, string],
  [rightKey, rightValue]: [string, string],
) {
  if (leftKey !== rightKey) {
    return leftKey.localeCompare(rightKey);
  }

  return leftValue.localeCompare(rightValue);
}

function toSearchString(searchParams: URLSearchParams) {
  const value = searchParams.toString();

  return value.length === 0 ? "" : `?${value}`;
}

function normalizeHash(hash: string | undefined) {
  if (hash === undefined || hash.length === 0) {
    return "";
  }

  return hash.startsWith("#") ? hash : `#${hash}`;
}
