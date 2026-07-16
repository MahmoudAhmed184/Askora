import { render, screen } from "@testing-library/react";
import { createMemoryRouter, data, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { ErrorBoundary } from "~/root";
import { loadAdminIndexRoute } from "~/features/admin/services/admin-route-handlers.service.server";

describe("admin route forbidden handling", () => {
  it("renders a Forbidden response instead of passing it to the route component", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/admin",
          element: <p>Admin queue</p>,
          errorElement: <ErrorBoundary />,
          loader: () =>
            loadAdminIndexRoute({
              request: new Request("http://localhost/admin"),
              requireAdmin: () => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error -- Exercise React Router's thrown response handling.
                throw data("Forbidden", {
                  status: 403,
                  statusText: "Forbidden",
                });
              },
            }),
        },
      ],
      { initialEntries: ["/admin"] },
    );

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: "403 Forbidden" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
    expect(screen.queryByText("Admin queue")).not.toBeInTheDocument();
  });
});
