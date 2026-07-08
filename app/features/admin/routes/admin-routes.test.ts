import { describe, expect, it } from "vitest";

import {
  handleAdminReportActionRoute,
  loadAdminIndexRoute,
} from "~/features/admin/services/admin-route-handlers.service.server";

describe("admin route guards", () => {
  it("returns 403 from the /admin loader for non-admin sessions", async () => {
    const result = await loadAdminIndexRoute({
      request: new Request("http://localhost/admin"),
      requireAdmin: () =>
        Promise.resolve(new Response("Forbidden", { status: 403 })),
      store: {
        countReportsByStatus: failIfCalled,
        findReportById: failIfCalled,
        findReportsByStatus: failIfCalled,
        findRelatedActivity: failIfCalled,
      },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("returns 403 from the report action for non-admin sessions", async () => {
    const formData = new FormData();

    formData.set("actionType", "dismiss");

    const result = await handleAdminReportActionRoute({
      reportId: "report_1",
      request: new Request("http://localhost/admin/reports/report_1", {
        method: "POST",
        body: formData,
      }),
      requireAdmin: () =>
        Promise.resolve(new Response("Forbidden", { status: 403 })),
      store: {
        findReportById: failIfCalled,
        applyAdminAction: failIfCalled,
      },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });
});

function failIfCalled(): never {
  throw new Error("store should not be called");
}
