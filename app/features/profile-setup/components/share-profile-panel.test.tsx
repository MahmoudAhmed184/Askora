import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShareProfilePanel } from "~/features/profile-setup/components/share-profile-panel";

describe("ShareProfilePanel", () => {
  it("renders the canonical URL and share controls", () => {
    renderShareProfilePanel();

    expect(
      screen.getByRole("textbox", { name: /profile url/i }),
    ).toHaveValue("https://app.example.com/person");
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("copies the canonical URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderShareProfilePanel();
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith("https://app.example.com/person");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});

function renderShareProfilePanel() {
  render(
    <ShareProfilePanel
      canonicalUrl="https://app.example.com/person"
      displayName="Person"
    />,
  );
}
