import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { AskComposer } from "~/features/profiles/components/ask-composer";
import { PermissionState } from "~/features/profiles/components/permission-state";
import { ProfileSideRail } from "~/features/profiles/components/profile-side-rail";
import { PublicAnswerList } from "~/features/profiles/components/public-answer-list";
import { UnavailableProfile } from "~/features/profiles/components/unavailable-profile";
import type { PublicPublishedAnswer } from "~/features/answers/services/answer.service.server";
import type { PublicAskStateAllowed } from "~/features/profiles/services/ask-permissions.service.server";
import type { PublicAskFlash } from "~/features/profiles/services/ask-friction.service.server";
import type { PublicProfileView } from "~/features/profiles/queries/profile.queries.server";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("public profile components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts ask success and the guest account prompt", async () => {
    renderWithRouter(
      <AskComposer
        ask={allowedAsk}
        flash={{
          status: "success",
          message: "Question sent.",
          prompt:
            "Create an account to get notified if a question is answered.",
        }}
        profile={profile}
        timingToken="token"
      />,
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Question sent.", {
        description:
          "Create an account to get notified if a question is answered.",
        id: "action-toast:success:Question sent.:Create an account to get notified if a question is answered.",
      });
    });
    expect(screen.queryByText("Question sent.")).not.toBeInTheDocument();
  });

  it("shows ask field errors and preserves the submitted question", () => {
    renderWithRouter(
      <AskComposer
        ask={allowedAsk}
        flash={
          {
            status: "error",
            values: {
              question: "x".repeat(501),
              identityMode: "anonymous",
            },
            fieldErrors: {
              question: "Questions must be 500 characters or fewer.",
            },
          } satisfies PublicAskFlash
        }
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

  it("fills the public question with a selected prompt suggestion", () => {
    const { container } = renderWithRouter(
      <AskComposer
        ask={allowedAsk}
        flash={undefined}
        profile={profile}
        timingToken="token"
      />,
    );

    const prompts = screen.getAllByRole("button", { name: /use prompt:/i });
    const firstPrompt = prompts[0];

    if (firstPrompt === undefined) {
      throw new Error("expected at least one prompt suggestion");
    }

    const prompt = firstPrompt.textContent;

    expect(prompts).toHaveLength(4);
    expect(prompt).toBeTruthy();
    expect(
      container.querySelector("[data-slot='prompt-suggestion-grid']"),
    ).toHaveClass("grid", "grid-cols-2", "sm:grid-cols-4");

    fireEvent.click(firstPrompt);

    expect(screen.getByRole("textbox", { name: /question/i })).toHaveValue(prompt);
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
        <PublicAnswerList answers={[]} profile={answerListProfile} />
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

  it("renders public answers as escaped plain text with preserved line breaks", async () => {
    const { container, router } = renderWithRouter(
      <PublicAnswerList
        answers={[
          createPublishedAnswer({
            answerText: "First line\n<script>alert('x')</script>",
            questionText: "How do I start?",
          }),
        ]}
        profile={answerListProfile}
      />,
    );

    expect(screen.getByText(/First line/)).toHaveClass(
      "whitespace-pre-wrap",
      "break-words",
    );
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
    const threadLink = screen.getByRole("link", { name: "Thread" });

    expect(threadLink).toHaveAttribute("href", "/person/a/thr_1");
    fireEvent.click(threadLink);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(router.state.location.search).toBe(
      "?threadUsername=person&threadPublicId=thr_1",
    );
    expect(router.state.location.mask?.pathname).toBe("/person/a/thr_1");
    expect(
      screen.queryByRole("link", { name: "View thread" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /like answer \(0\)/i }),
    ).toBeDisabled();
    expect(container.querySelector("script")).toBeNull();
  });

  it("links to the next stable answer page without requiring JavaScript", () => {
    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        nextCursor="opaque-cursor"
        profile={answerListProfile}
      />,
    );

    expect(screen.getByRole("link", { name: "Older answers" })).toHaveAttribute(
      "href",
      "/?answers=opaque-cursor#published-answers",
    );
  });

  it("replaces hidden question text with a non-sensitive blurred placeholder", () => {
    const { container } = renderWithRouter(
      <PublicAnswerList
        answers={[
          createPublishedAnswer({
            answerText: "Answer without the private prompt",
            questionText: null,
            questionTextMode: "hidden",
          }),
        ]}
        profile={answerListProfile}
      />,
    );

    expect(
      screen.getByText("Answer without the private prompt"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("What should I read next?"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Hidden question")).toBeInTheDocument();
    expect(
      container.querySelector("[data-slot='hidden-question-placeholder']"),
    ).toBeInTheDocument();
  });

  it("renders owner controls only when management is allowed", () => {
    const ownerRender = renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        controls={{ canManage: true, disabled: false }}
        profile={answerListProfile}
      />,
    );

    openPublishedAnswerMenu();

    expect(
      screen.getByRole("menuitem", { name: "Edit silently" }),
    ).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Pin" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Unpublish" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeEnabled();

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit silently" }));

    expect(
      screen.getByRole("dialog", { name: "Silent edit" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save answer" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    openPublishedAnswerMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpublish" }));

    expect(
      screen.getByRole("alertdialog", { name: "Unpublish answer?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unpublish answer" }),
    ).toBeEnabled();

    ownerRender.unmount();

    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer({ publicId: "titem_2" })]}
        controls={{ canManage: false, disabled: false }}
        profile={answerListProfile}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /answer actions/i }),
    ).not.toBeInTheDocument();
  });

  it("disables owner controls for suspended owners", () => {
    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        controls={{ canManage: true, disabled: true }}
        profile={answerListProfile}
      />,
    );

    expect(
      screen.getByRole("button", { name: /answer actions/i }),
    ).toBeDisabled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("submits unpublish without changing the intent when the dialog closes", async () => {
    let submittedIntent: FormDataEntryValue | null = null;
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <PublicAnswerList
              answers={[createPublishedAnswer()]}
              controls={{ canManage: true, disabled: false }}
              profile={answerListProfile}
            />
          ),
        },
        {
          path: "/answers/:threadItemPublicId/actions",
          action: async ({ request }) => {
            submittedIntent = (await request.formData()).get("intent");

            return {
              publishedAnswer: {
                status: "unpublished",
                threadItemPublicId: "titem_1",
                redirectTo: "/person#published-answers",
              },
            };
          },
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);
    openPublishedAnswerMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpublish" }));
    fireEvent.click(screen.getByRole("button", { name: "Unpublish answer" }));

    await waitFor(() => {
      expect(submittedIntent).toBe("unpublish");
    });
  });

  it("renders profile side rail pinned threads without ask state", () => {
    renderWithRouter(
      <ProfileSideRail
        answers={[
          createPublishedAnswer({
            like: {
              threadItemPublicId: "titem_1",
              isLiked: false,
              count: 2,
              disabled: false,
            },
            pinPosition: 1,
            questionText: "What changed your mind recently?",
          }),
        ]}
        profile={profile}
      />,
    );

    expect(screen.queryByText("Ask State")).not.toBeInTheDocument();
    expect(screen.getByText("Pinned Threads")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /what changed your mind recently/i }),
    ).toHaveAttribute("href", "/person/a/thr_1");
  });

  it("serializes the anonymity switch and falls back to a hidden input when only one identity is allowed", () => {
    const bothAllowed = renderWithRouter(
      <AskComposer
        ask={{ ...allowedAsk, attributedAllowed: true }}
        flash={undefined}
        profile={profile}
        timingToken="token"
      />,
    );
    const form = () => getForm(bothAllowed.container);

    expect(screen.getByRole("switch", { name: "Anonymous" })).toBeChecked();
    expect(new FormData(form()).get("identityMode")).toBe("anonymous");

    fireEvent.click(screen.getByRole("switch", { name: "Anonymous" }));

    expect(new FormData(form()).get("identityMode")).toBe("attributed");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    bothAllowed.unmount();

    const onlyAnonymous = renderWithRouter(
      <AskComposer
        ask={allowedAsk}
        flash={undefined}
        profile={profile}
        timingToken="token"
      />,
    );

    expect(
      screen.queryByRole("switch", { name: "Anonymous" }),
    ).not.toBeInTheDocument();
    expect(
      new FormData(getForm(onlyAnonymous.container)).get("identityMode"),
    ).toBe("anonymous");
  });

  it("shows the edited-question badge only for edited public wording", () => {
    const edited = renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer({ questionTextMode: "edited" })]}
        profile={answerListProfile}
      />,
    );

    expect(screen.getByText("Edited question")).toBeInTheDocument();

    edited.unmount();

    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer({ questionTextMode: "original" })]}
        profile={answerListProfile}
      />,
    );

    expect(screen.queryByText("Edited question")).not.toBeInTheDocument();
  });

  it("links the answer card identity to the profile", () => {
    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        profile={answerListProfile}
      />,
    );

    expect(screen.getByRole("link", { name: "Person" })).toHaveAttribute(
      "href",
      "/person",
    );
  });

  it("moves reporting into the answer actions menu", async () => {
    renderWithRouter(
      <PublicAnswerList
        answers={[createPublishedAnswer()]}
        canReport
        profile={answerListProfile}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Report answer" }),
    ).not.toBeInTheDocument();

    openPublishedAnswerMenu();

    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Report answer" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Report answer" }),
    ).toBeInTheDocument();
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

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

function openPublishedAnswerMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: /answer actions/i }),
  );
}

const allowedAsk = {
  status: "allowed",
  defaultIdentity: "anonymous",
  anonymousAllowed: true,
  isSelfAsk: false,
  attributedAllowed: false,
  description:
    "Your question is anonymous to the recipient and public viewers.",
} satisfies PublicAskStateAllowed;

const profile = {
  username: "person",
  displayName: "Person",
  avatarUrl: null,
  bio: null,
  askSettings: {
    acceptingQuestions: true,
    anonymousQuestionsEnabled: true,
    permission: "everyone",
  },
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

const answerListProfile = {
  username: "person",
  displayName: "Person",
  avatarUrl: null,
};

function getForm(container: HTMLElement, selector = "form") {
  const form = container.querySelector(selector);

  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`expected a form matching ${selector}`);
  }

  return form;
}
