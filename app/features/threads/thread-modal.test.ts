import { describe, expect, it } from "vitest";

import {
  createThreadModalLink,
  getThreadModalParams,
  isThreadModalOnlySearchParamChange,
  removeThreadModalSearchParams,
} from "~/features/threads/thread-modal";

describe("thread modal routing helpers", () => {
  it("builds a canonical mask and contextual modal destination", () => {
    const link = createThreadModalLink({
      location: {
        hash: "#published-answers",
        pathname: "/person",
        search: "?tab=answers",
      },
      threadPublicId: "thr_1",
      username: "person",
    });

    expect(link).toEqual({
      mask: "/person/a/thr_1",
      to: {
        hash: "#published-answers",
        pathname: "/person",
        search: "?tab=answers&threadUsername=person&threadPublicId=thr_1",
      },
    });
  });

  it("removes only modal params and preserves the underlying location", () => {
    expect(
      removeThreadModalSearchParams({
        hash: "#saved-scroll",
        pathname: "/feed",
        search:
          "?cursor=abc&threadUsername=person&threadPublicId=thr_1&filter=latest",
      }),
    ).toEqual({
      hash: "#saved-scroll",
      pathname: "/feed",
      search: "?cursor=abc&filter=latest",
    });
  });

  it("detects modal-only search param changes", () => {
    expect(
      isThreadModalOnlySearchParamChange(
        url("/person?tab=answers"),
        url("/person?tab=answers&threadUsername=person&threadPublicId=thr_1"),
      ),
    ).toBe(true);
  });

  it("does not suppress meaningful route or filter changes", () => {
    expect(
      isThreadModalOnlySearchParamChange(
        url("/feed?cursor=one"),
        url("/feed?cursor=two&threadUsername=person&threadPublicId=thr_1"),
      ),
    ).toBe(false);
    expect(
      isThreadModalOnlySearchParamChange(
        url("/person?threadUsername=person&threadPublicId=thr_1"),
        url("/feed?threadUsername=person&threadPublicId=thr_1"),
      ),
    ).toBe(false);
  });

  it("rejects malformed and oversized modal query parameters", () => {
    expect(
      getThreadModalParams(
        new URLSearchParams(
          "threadUsername=person&threadPublicId=not-a-thread-id",
        ),
      ),
    ).toBeUndefined();
    expect(
      getThreadModalParams(
        new URLSearchParams(
          `threadUsername=${"a".repeat(31)}&threadPublicId=thr_1`,
        ),
      ),
    ).toBeUndefined();
    expect(
      getThreadModalParams(
        new URLSearchParams(
          `threadUsername=person&threadPublicId=thr_${"a".repeat(65)}`,
        ),
      ),
    ).toBeUndefined();
  });
});

function url(path: string) {
  return new URL(path, "https://qna.local");
}
