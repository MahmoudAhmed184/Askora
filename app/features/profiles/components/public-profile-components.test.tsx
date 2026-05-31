import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AskComposer } from "~/features/profiles/components/ask-composer";
import { PermissionState } from "~/features/profiles/components/permission-state";
import { PublicAnswerList } from "~/features/profiles/components/public-answer-list";
import { UnavailableProfile } from "~/features/profiles/components/unavailable-profile";
import type { PublicPublishedAnswer } from "~/features/answers/answer.server";
import type { PublicAskStateAllowed } from "~/features/profiles/ask-permissions.server";
import type { PublicAskFlash } from "~/features/profiles/ask-friction.server";
import type { PublicProfileView } from "~/features/profiles/profile.loader.server";

describe("public profile components", () => {
  it("shows ask success and the guest account prompt", () => {
    renderWithRouter(
      <AskComposer
        ask={allowedAsk}
        flash={{
          status: "success",
          message: "Question sent.",
          prompt: "Create an account to get notified if a question is answered.",
        }}
        profile={profile}
        timingToken="token"
      />,
    );

    expect(screen.getByText("Question sent.")).toBeInTheDocument();
    expect(
      screen.getByText(/create an account to get notified/i),
    ).toBeInTheDocument();
  });

  it("shows ask field errors and preserves the submitted question", () => {
    renderWithRouter(
      <AskComposer
        ask={allowedAsk}
        flash={{
          status: "error",
          values: {
            question: "x".repeat(501),
            identityMode: "anonymous",
          },
          fieldErrors: {
            question: "Questions must be 500 characters or fewer.",
          },
        } satisfies PublicAskFlash}
        profile={profile}
        timingToken="token"
      />,
    );

    expect(
      screen.getByText("Questions must be 500 characters or fewer."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /question/i })).toHaveValue(
      "x".repeat(501),
    );
  });

  it("shows permission and unavailable states", () => {
    renderWithRouter(
      <>
        <PermissionState
          ask={{
            status: "denied",
            reason: "login_required",
            message: "Log in to ask this profile a question.",
            action: {
              href: "/login",
              label: "Log in",
            },
          }}
        />
        <PublicAnswerList answers={[]} profileUsername="person" />
      </>,
    );

    expect(screen.getByText("Questions unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText("No public answers yet")).toBeInTheDocument();

    renderWithRouter(<UnavailableProfile username="reserved" />);

    expect(screen.getByText("@reserved")).toBeInTheDocument();
    expect(screen.getByText("This profile is unavailable")).toBeInTheDocument();
  });

  it("renders public answers as escaped plain text with preserved line breaks", () => {
    const { container } = renderWithRouter(
      <PublicAnswerList
        answers={[
          createPublishedAnswer({
            answerText: "First line\n<script>alert('x')</script>",
            questionText: "How do I start?",
          }),
        ]}
        profileUsername="person"
      />,
    );

    expect(screen.getByText(/First line/)).toHaveClass(
      "whitespace-pre-wrap",
      "break-words",
    );
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View thread" })).toHaveAttribute(
      "href",
      "/person/a/thr_1#item-titem_1",
    );
    expect(
      screen.getByRole("button", { name: /like answer \(0\)/i }),
    ).toBeDisabled();
    expect(container.querySelector("script")).toBeNull();
  });

  it("omits question text entirely for hidden public answers", () => {
    renderWithRouter(
      <PublicAnswerList
        answers={[
          createPublishedAnswer({
            answerText: "Answer without the private prompt",
            questionText: null,
            questionTextMode: "hidden",
          }),
        ]}
        profileUsername="person"
      />,
    );

    expect(screen.getByText("Answer without the private prompt")).toBeInTheDocument();
    expect(screen.queryByText("What should I read next?")).not.toBeInTheDocument();
  });

  it("renders owner controls only when management is allowed", () => {
    const ownerRender = renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        controls={{ canManage: true, disabled: false }}
        profileUsername="person"
      />,
    );

    fireEvent.click(screen.getByText("Manage"));

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pin" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();

    ownerRender.unmount();

    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer({ publicId: "titem_2" })]}
        controls={{ canManage: false, disabled: false }}
        profileUsername="person"
      />,
    );

    expect(screen.queryByText("Manage")).not.toBeInTheDocument();
  });

  it("disables owner controls for suspended owners", () => {
    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        controls={{ canManage: true, disabled: true }}
        profileUsername="person"
      />,
    );

    fireEvent.click(screen.getByText("Manage"));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pin" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

function renderWithRouter(element: React.ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element,
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  return render(<RouterProvider router={router} />);
}

const allowedAsk = {
  status: "allowed",
  defaultIdentity: "anonymous",
  anonymousAllowed: true,
  attributedAllowed: false,
  description: "Your question is anonymous to the recipient and public viewers.",
} satisfies PublicAskStateAllowed;

const profile = {
  username: "person",
  displayName: "Person",
  avatarUrl: null,
  bio: null,
  counts: {
    answers: 0,
    followers: 0,
    following: 0,
    reactions: 0,
  },
} satisfies PublicProfileView;

function createPublishedAnswer(
  overrides: Partial<PublicPublishedAnswer> = {},
): PublicPublishedAnswer {
  return {
    publicId: "titem_1",
    threadPublicId: "thr_1",
    answerText: "Answer text",
    publishedAt: "2026-05-31T12:00:00.000Z",
    pinPosition: null,
    questionTextMode: "original",
    questionText: "What should I read next?",
    like: {
      threadItemPublicId: "titem_1",
      isLiked: false,
      count: 0,
      disabled: true,
    },
    asker: undefined,
    ...overrides,
  };
}
