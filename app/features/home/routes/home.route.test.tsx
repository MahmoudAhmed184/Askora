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
        name: /one public link for questions worth answering/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request or sign in/i }),
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

    expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled();
    expect(
      screen.queryByText(/waitlist storage is disabled/i),
    ).not.toBeInTheDocument();
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
