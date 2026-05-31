import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { InboxList } from "~/features/inbox/components/inbox-list";
import type {
  InboxFolder,
  InboxQuestionView,
} from "~/features/inbox/inbox.loader.server";

describe("InboxList", () => {
  it("renders question cards without safety metadata", () => {
    renderInboxList({
      questions: [
        {
          publicId: "qst_1",
          text: "What should I read next?",
          identity: "anonymous",
          createdAt: "2026-05-31T12:00:00.000Z",
          ipHash: "ip_hash_secret",
          userAgentHash: "user_agent_secret",
          safetyFingerprintHash: "fingerprint_secret",
          country: "EG",
          askerUserId: "user_secret",
          askerProfileId: "profile_secret",
        } as InboxQuestionView & Record<string, string>,
      ],
    });

    expect(screen.getByText("What should I read next?")).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByText("ip_hash_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("user_agent_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("fingerprint_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("EG")).not.toBeInTheDocument();
    expect(screen.queryByText("user_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("profile_secret")).not.toBeInTheDocument();
  });

  it("shows inbox actions without restore", () => {
    renderInboxList();

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /block sender/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Report")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /restore/i }),
    ).not.toBeInTheDocument();
  });

  it("shows filtered restore and report-plus-block default", () => {
    renderInboxList({ folder: "filtered" });

    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Report"));

    expect(
      screen.getByRole("checkbox", { name: /also block sender/i }),
    ).toBeChecked();
  });
});

function renderInboxList({
  disabled = false,
  folder = "inbox",
  questions = [defaultQuestion],
}: {
  disabled?: boolean;
  folder?: InboxFolder;
  questions?: InboxQuestionView[];
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <InboxList disabled={disabled} folder={folder} questions={questions} />
        ),
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  render(<RouterProvider router={router} />);
}

const defaultQuestion = {
  publicId: "qst_1",
  text: "What should I read next?",
  identity: "anonymous",
  createdAt: "2026-05-31T12:00:00.000Z",
} satisfies InboxQuestionView;
