import { describe, expect, it } from "vitest";

import { formatMediumDateTime } from "~/lib/date-format";

describe("date formatting", () => {
  it("uses UTC so server and client markup stay identical", () => {
    expect(formatMediumDateTime("2026-05-31T12:00:00.000Z")).toBe(
      "May 31, 2026, 12:00 PM",
    );
  });
});
