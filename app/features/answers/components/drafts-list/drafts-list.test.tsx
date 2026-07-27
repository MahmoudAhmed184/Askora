import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { DraftsList } from "~/features/answers/components/drafts-list";

describe("DraftsList", () => {
  it("renders a progressively enhanced discard form for each draft", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/drafts",
          element: (
            <DraftsList
              drafts={[
                {
                  questionPublicId: "qst_1",
                  questionText: "What should I read?",
                  answerPreview: "A private draft",
                  updatedAt: "2026-05-31T12:00:00.000Z",
                  questionCreatedAt: "2026-05-30T12:00:00.000Z",
                  sender: {
                    username: "asker",
                    displayName: "Known Asker",
                    avatarUrl: null,
                  },
                },
              ]}
            />
          ),
        },
      ],
      { initialEntries: ["/drafts"] },
    );

    render(<RouterProvider router={router} />);

    const discard = screen.getByRole("button", { name: "Discard" });
    const form = discard.closest("form");

    expect(form).toHaveAttribute("action", "/drafts");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveFormValues({
      intent: "delete",
      questionPublicId: "qst_1",
    });
    expect(screen.getByRole("link", { name: "Known Asker" })).toHaveAttribute(
      "href",
      "/asker",
    );
  });
});
