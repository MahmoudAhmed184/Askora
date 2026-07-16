import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { ReportQueue } from "~/features/admin/components/report-queue/report-queue";
import type { AdminReportQueueViewData } from "~/features/admin/types/admin.types";

describe("ReportQueue", () => {
  it("links to the next cursor while retaining the active status", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/admin",
          element: <ReportQueue queue={createQueue()} />,
        },
      ],
      { initialEntries: ["/admin?status=reviewed"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByRole("link", { name: /older reports/i })).toHaveAttribute(
      "href",
      "/admin?status=reviewed&cursor=cursor_1",
    );
  });
});

function createQueue(): AdminReportQueueViewData {
  return {
    status: "reviewed",
    counts: {
      open: 0,
      reviewed: 21,
      actioned: 0,
      dismissed: 0,
    },
    reports: [
      {
        id: "report_1",
        reason: "harassment",
        status: "reviewed",
        targetType: "question",
        targetLabel: "Private question",
        targetStatus: "inbox",
        contentPreview: "What should I read next?",
        detailsPreview: null,
        metadata: [],
        createdAt: "2026-05-31T12:00:00.000Z",
        updatedAt: "2026-05-31T12:00:00.000Z",
      },
    ],
    nextCursor: "cursor_1",
  };
}
