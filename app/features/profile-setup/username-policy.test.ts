import { describe, expect, it } from "vitest";

import {
  getUsernamePolicyIssue,
  isAllowedUsername,
} from "~/features/profile-setup/username-policy";

describe("username policy", () => {
  it("accepts lowercase letters, numbers, and underscores", () => {
    expect(isAllowedUsername("creator_123")).toBe(true);
  });

  it("rejects uppercase usernames without normalizing them", () => {
    expect(getUsernamePolicyIssue("Creator")).toMatch(/lowercase/i);
  });

  it("rejects invalid characters", () => {
    expect(getUsernamePolicyIssue("creator-name")).toMatch(/underscores/i);
  });

  it("rejects usernames outside the length limits", () => {
    expect(getUsernamePolicyIssue("ab")).toMatch(/3 to 30/i);
    expect(getUsernamePolicyIssue("a".repeat(31))).toMatch(/3 to 30/i);
  });

  it("rejects reserved route names", () => {
    expect(getUsernamePolicyIssue("login")).toMatch(/reserved/i);
  });
});
