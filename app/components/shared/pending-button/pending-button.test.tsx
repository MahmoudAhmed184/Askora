import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  current: {
    state: "idle",
    formData: undefined as FormData | undefined,
  },
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");

  return {
    ...(actual as object),
    useNavigation: () => navigation.current,
  };
});

import { PendingButton } from "~/components/shared/pending-button/pending-button";

describe("PendingButton", () => {
  it("does not spin or disable during route loading", () => {
    navigation.current = {
      state: "loading",
      formData: undefined,
    };

    render(<PendingButton pendingText="Saving">Save</PendingButton>);

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("spins for matching submitted button intent only", () => {
    const formData = new FormData();

    formData.set("intent", "publish");
    navigation.current = {
      state: "submitting",
      formData,
    };

    render(
      <>
        <PendingButton name="intent" pendingText="Saving" value="save_draft">
          Save draft
        </PendingButton>
        <PendingButton name="intent" pendingText="Publishing" value="publish">
          Publish answer
        </PendingButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Publishing" }),
    ).toBeDisabled();
  });
});
