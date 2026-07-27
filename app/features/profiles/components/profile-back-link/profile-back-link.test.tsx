import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { ProfileBackLink } from "~/features/profiles/components/profile-back-link";

describe("ProfileBackLink", () => {
  afterEach(() => {
    window.history.replaceState(null, "");
  });

  it("returns to the previous in-app entry when history is available", async () => {
    window.history.replaceState({ idx: 1 }, "");
    const router = renderBackLink(["/feed", "/person"], 1);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/feed");
    });
  });

  it("uses the fallback link for a direct visit", async () => {
    window.history.replaceState({ idx: 0 }, "");
    const router = renderBackLink(["/person"], 0);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/feed");
    });
  });
});

function renderBackLink(initialEntries: string[], initialIndex: number) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: <ProfileBackLink fallbackHref="/feed" />,
      },
    ],
    { initialEntries, initialIndex },
  );

  render(<RouterProvider router={router} />);

  return router;
}
