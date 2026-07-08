import { describe, expect, it } from "vitest";

import routes from "~/routes";

describe("route config", () => {
  it("registers signed-in app routes before the public username route", () => {
    const paths = getRoutePaths();
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf("feed")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("inbox")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("prompts")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("drafts")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("notifications")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("likes")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("follows")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("answer/:questionId")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("answers/:threadItemPublicId/actions")).toBeLessThan(
      usernameIndex,
    );
    expect(paths.indexOf("filtered")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("settings/profile")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("settings/privacy")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("settings/safety")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("settings/account")).toBeLessThan(usernameIndex);
  });

  it("registers admin routes before the public username route", () => {
    const paths = getRoutePaths();
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf("admin")).toBeLessThan(usernameIndex);
    expect(paths.indexOf("admin/reports/:reportId")).toBeLessThan(usernameIndex);
  });

  it("registers public thread permalinks before the public username route", () => {
    const paths = getRoutePaths();
    const usernameIndex = paths.indexOf(":username");

    expect(paths.indexOf(":username/a/:threadPublicId/follow-ups")).toBeLessThan(
      usernameIndex,
    );
    expect(paths.indexOf(":username/a/:threadPublicId")).toBeLessThan(
      usernameIndex,
    );
  });

  it("registers follow-up routes before the public thread permalink", () => {
    const paths = getRoutePaths();

    expect(paths.indexOf(":username/a/:threadPublicId/follow-ups")).toBeLessThan(
      paths.indexOf(":username/a/:threadPublicId"),
    );
  });

  it("does not register a sitemap route during beta", () => {
    const paths = getRoutePaths();

    expect(paths).not.toContain("sitemap.xml");
  });
});

function getRoutePaths() {
  return flattenRoutePaths(routes);
}

interface TestRouteEntry {
  path?: string;
  index?: boolean;
  children?: readonly TestRouteEntry[];
}

function flattenRoutePaths(
  routeEntries: readonly TestRouteEntry[],
  parentPath = "",
): string[] {
  return routeEntries.flatMap((routeEntry) => {
    const path = routeEntry.path;

    if (path === undefined) {
      const childPaths =
        routeEntry.children === undefined
          ? []
          : flattenRoutePaths(routeEntry.children, parentPath);

      return routeEntry.index === true
        ? [parentPath === "" ? "index" : parentPath, ...childPaths]
        : childPaths;
    }

    const fullPath = parentPath === "" ? path : `${parentPath}/${path}`;
    const childPaths =
      routeEntry.children === undefined
        ? []
        : flattenRoutePaths(routeEntry.children, fullPath);

    return [fullPath, ...childPaths];
  });
}
