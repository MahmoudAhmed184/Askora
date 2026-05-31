import { describe, expect, it } from "vitest";

import routes from "~/routes";

describe("route config", () => {
  it("registers dashboard routes before the public username route", () => {
    const paths = routes.map((route) => ("path" in route ? route.path : "index"));
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf("dashboard")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/feed")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/inbox")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/drafts")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/notifications")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/likes")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/follows")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/answer/:questionId")).toBeLessThan(
      usernameIndex,
    );
    expect(
      paths.indexOf("dashboard/answers/:threadItemPublicId/actions"),
    ).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/filtered")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/settings/profile")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/settings/privacy")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/settings/safety")).toBeLessThan(usernameIndex);
  });

  it("registers admin routes before the public username route", () => {
    const paths = routes.map((route) => ("path" in route ? route.path : "index"));
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf("admin")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("admin/reports/:reportId")).toBeLessThan(usernameIndex);
  });

  it("registers public thread permalinks before the public username route", () => {
    const paths = routes.map((route) => ("path" in route ? route.path : "index"));
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf(":username/a/:threadPublicId/follow-ups")).toBeLessThan(
      usernameIndex,
    );
    expect(paths.indexOf(":username/a/:threadPublicId")).toBeLessThan(
      usernameIndex,
    );
  });

  it("registers follow-up routes before the public thread permalink", () => {
    const paths = routes.map((route) => ("path" in route ? route.path : "index"));

    expect(paths.indexOf(":username/a/:threadPublicId/follow-ups")).toBeLessThan(
      paths.indexOf(":username/a/:threadPublicId"),
    );
  });
});
