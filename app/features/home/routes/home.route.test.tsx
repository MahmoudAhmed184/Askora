import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import HomeRoute from "~/features/home/routes/home.route";
import type { AuthProviderStatus } from "~/lib/config.server";

interface HomeRouteProps {
  loaderData: {
    auth: AuthProviderStatus;
  };
}

const HomeRouteForTest = HomeRoute as ComponentType<HomeRouteProps>;

describe("HomeRoute", () => {
  it("renders the foundation homepage", () => {
    renderHomeRoute(
      {
        databaseConfigured: true,
        googleConfigured: true,
        emailMagicLinkConfigured: true,
      },
    );

    expect(
      screen.getByRole("heading", {
        name: /receive questions privately/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /log in or create profile/i }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getByRole("form", { name: /request beta access/i }),
    ).toBeInTheDocument();
  });

  it("shows a disabled waitlist state without database configuration", () => {
    renderHomeRoute({
      databaseConfigured: false,
      googleConfigured: false,
      emailMagicLinkConfigured: false,
    });

    expect(screen.getByRole("textbox", { name: /request access/i })).toBeDisabled();
    expect(screen.getByText(/waitlist storage is disabled/i)).toBeInTheDocument();
  });
});

function renderHomeRoute(auth: AuthProviderStatus) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <HomeRouteForTest loaderData={{ auth }} />,
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  render(<RouterProvider router={router} />);
}
