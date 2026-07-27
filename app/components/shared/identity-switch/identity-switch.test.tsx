import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IdentitySwitch } from "~/components/shared/identity-switch/identity-switch";

describe("IdentitySwitch", () => {
  it("serializes anonymous when checked and attributed when unchecked", () => {
    const { container } = render(
      <form>
        <IdentitySwitch defaultIdentity="anonymous" />
      </form>,
    );

    const serialized = () =>
      new FormData(getForm(container)).get("identityMode");

    expect(screen.getByRole("switch", { name: "Anonymous" })).toBeChecked();
    expect(serialized()).toBe("anonymous");

    fireEvent.click(screen.getByRole("switch", { name: "Anonymous" }));

    expect(screen.getByRole("switch", { name: "Your profile" })).not.toBeChecked();
    expect(serialized()).toBe("attributed");
  });

  it("starts unchecked when the default identity is attributed", () => {
    const { container } = render(
      <form>
        <IdentitySwitch defaultIdentity="attributed" />
      </form>,
    );

    expect(
      screen.getByRole("switch", { name: "Your profile" }),
    ).not.toBeChecked();
    expect(new FormData(getForm(container)).get("identityMode")).toBe(
      "attributed",
    );
  });

  it("is a focusable native control so keyboard activation works", () => {
    render(<IdentitySwitch defaultIdentity="attributed" />);

    const control = screen.getByRole("switch", { name: "Your profile" });

    control.focus();

    expect(control.tagName).toBe("BUTTON");
    expect(control).toHaveFocus();
    expect(control).not.toBeDisabled();
  });

  it("reports a validation error to assistive technology", () => {
    render(
      <IdentitySwitch
        defaultIdentity="anonymous"
        error="Choose an identity."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Choose an identity.");
    expect(
      screen
        .getByRole("switch", { name: "Anonymous" })
        .getAttribute("aria-describedby"),
    ).toContain(screen.getByRole("alert").id);
  });

  it("keeps the same serialization in the inline variant", () => {
    const { container } = render(
      <form>
        <IdentitySwitch defaultIdentity="anonymous" variant="inline" />
      </form>,
    );

    expect(screen.getByRole("switch", { name: "Anonymous" })).toBeChecked();
    expect(new FormData(getForm(container)).get("identityMode")).toBe(
      "anonymous",
    );
  });
});

function getForm(container: HTMLElement, selector = "form") {
  const form = container.querySelector(selector);

  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`expected a form matching ${selector}`);
  }

  return form;
}
