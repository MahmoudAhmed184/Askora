import { describe, expect, it } from "vitest";

import routes from "~/routes";

describe("route config", () => {
  it("registers dashboard routes before the public username route", () => {
    const paths = routes.map((route) => ("path" in route ? route.path : "index"));
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf("dashboard")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/inbox")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/drafts")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("dashboard/answer/:questionId")).toBeLessThan(
      usernameIndex,
    );
    expect(paths.indexOf("dashboard/filtered")).toBeLessThan(usernameIndex);
  });
});
