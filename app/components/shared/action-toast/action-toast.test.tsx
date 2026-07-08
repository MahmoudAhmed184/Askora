import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionToast } from "~/components/shared/action-toast/action-toast";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("ActionToast", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses one deterministic toast id for identical action feedback", async () => {
    render(
      <StrictMode>
        <ActionToast
          message="Profile saved."
          tone="success"
          trigger={{ status: "updated" }}
        />
      </StrictMode>,
    );

    const successToast = vi.mocked(toast.success);

    await waitFor(() => {
      expect(successToast).toHaveBeenCalled();
    });

    const ids = successToast.mock.calls.map(([, options]) => options?.id);

    expect(ids.every((id) => id === ids[0])).toBe(true);
    expect(ids[0]).toBe("action-toast:success:Profile saved.:");
  });

  it("does not emit a toast without a message", () => {
    render(<ActionToast message={undefined} tone="success" />);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
