import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AskComposer } from "~/features/profiles/components/ask-composer";
import { PermissionState } from "~/features/profiles/components/permission-state";
import { PublicAnswerList } from "~/features/profiles/components/public-answer-list";
import { UnavailableProfile } from "~/features/profiles/components/unavailable-profile";
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
        <PublicAnswerList />
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

  render(<RouterProvider router={router} />);
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
