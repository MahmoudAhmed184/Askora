import { describe, expect, it } from "vitest";

import {
  createAnswerModalLink,
  getAnswerModalParams,
  isAnswerModalOnlySearchParamChange,
  removeAnswerModalSearchParams,
} from "~/features/answers/answer-modal";

describe("answer modal routing helpers", () => {
  it("keeps the current page in the destination and masks the canonical editor", () => {
    expect(
      createAnswerModalLink({
        location: {
          hash: "#drafts",
          pathname: "/inbox",
          search: "?folder=all",
        },
        questionId: "qst_1",
      }),
    ).toMatchObject({
      focusReturnId: "answer-modal-qst_1",
      mask: "/answer/qst_1",
      to: {
        hash: "#drafts",
        pathname: "/inbox",
        search: "?folder=all&answerQuestionId=qst_1",
      },
    });
  });

  it("removes only the contextual answer parameter", () => {
    expect(
      removeAnswerModalSearchParams({
        hash: "#drafts",
        pathname: "/inbox",
        search: "?answerQuestionId=qst_1&folder=all",
      }),
    ).toEqual({ hash: "#drafts", pathname: "/inbox", search: "?folder=all" });
  });

  it("accepts bounded IDs and rejects malformed or competing modal params", () => {
    expect(
      getAnswerModalParams(new URLSearchParams("answerQuestionId=demo_question")),
    ).toEqual({ questionPublicId: "demo_question" });
    expect(
      getAnswerModalParams(
        new URLSearchParams(`answerQuestionId=${"a".repeat(69)}`),
      ),
    ).toBeUndefined();
    expect(
      getAnswerModalParams(
        new URLSearchParams(
          "answerQuestionId=qst_1&threadUsername=person&threadPublicId=thr_1",
        ),
      ),
    ).toBeUndefined();
  });

  it("detects a contextual-only URL change", () => {
    expect(
      isAnswerModalOnlySearchParamChange(
        new URL("https://qna.local/inbox?folder=all"),
        new URL("https://qna.local/inbox?folder=all&answerQuestionId=qst_1"),
      ),
    ).toBe(true);
  });
});
