import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import LoginRoute from "~/features/auth/routes/login.route";
import { getPostAuthRedirectPath } from "~/features/auth/services/post-auth-redirect.service.server";
import { magicLinkRequestSchema } from "~/features/auth/validations/magic-link.validations";
import type { AuthProviderStatus } from "~/lib/config.types";

interface LoginRouteProps {
  loaderData: {
    auth: AuthProviderStatus;
  };
}

const LoginRouteForTest = LoginRoute as ComponentType<LoginRouteProps>;

describe("LoginRoute", () => {
  it("renders auth configuration status without exposing secrets", () => {
    renderLoginRoute({
      databaseConfigured: false,
      googleConfigured: false,
      emailMagicLinkConfigured: false,
    });

    expect(
      screen.getByRole("heading", { name: /sign in to q&a platform/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not configured in this environment/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
  });

  it("renders Google and email provider disabled states", () => {
    renderLoginRoute({
      databaseConfigured: true,
      googleConfigured: false,
      emailMagicLinkConfigured: false,
    });

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /^email$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /email me a magic link/i }),
    ).toBeDisabled();
  });

  it("enables configured providers", () => {
    renderLoginRoute({
      databaseConfigured: true,
      googleConfigured: true,
      emailMagicLinkConfigured: true,
    });

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /^email$/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /email me a magic link/i }),
    ).toBeEnabled();
  });

  it("normalizes magic-link email requests", () => {
    const parsed = magicLinkRequestSchema.parse({
      email: "  PERSON@Example.COM  ",
    });

    expect(parsed.email).toBe("person@example.com");
  });

  it("uses login as the auth callback target before the session exists", () => {
    expect(getPostAuthRedirectPath()).toBe("/login");
  });
});

function renderLoginRoute(auth: AuthProviderStatus) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <LoginRouteForTest loaderData={{ auth }} />,
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  render(<RouterProvider router={router} />);
}
