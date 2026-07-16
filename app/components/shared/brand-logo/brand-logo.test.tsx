import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "~/components/shared/brand-logo/brand-logo";

describe("BrandLogo", () => {
  it("renders accessible light and dark theme assets", () => {
    const { container } = render(<BrandLogo />);

    expect(screen.getByRole("img", { name: "Askora" })).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll("img"), (image) =>
        image.getAttribute("src"),
      ),
    ).toEqual([
      "/askora-logo-light.png",
      "/askora-logo-dark.png",
    ]);
  });
});
