import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { ShareProfilePanel } from "~/features/profile-setup/components/share-profile-panel";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ShareProfilePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile URL copied.", {
        id: "profile-url-copied",
      });
    });
    expect(screen.queryByText(/profile url copied/i)).not.toBeInTheDocument();
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
