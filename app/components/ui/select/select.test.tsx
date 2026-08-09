import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Select } from "~/components/ui/select/select";

describe("Select", () => {
  it("renders a native controlled select for server-side form submission", () => {
    const html = renderToStaticMarkup(
      <Select aria-label="Style" name="style" value="reflective">
        <option value="balanced">Balanced</option>
        <option value="reflective">Deep and reflective</option>
      </Select>,
    );

    expect(html).toContain('<select aria-label="Style"');
    expect(html).toContain('name="style"');
    expect(html).toMatch(/<option[^>]*value="reflective"[^>]*selected/iu);
    expect(html).not.toContain("data-slot=\"select-trigger\"");
  });

  it("opens an app-styled listbox and submits the selected value", () => {
    function Harness() {
      const [value, setValue] = useState("balanced");

      return (
        <form aria-label="Preferences">
          <label htmlFor="style">Style</label>
          <Select
            id="style"
            name="style"
            onValueChange={setValue}
            value={value}
          >
            <option value="balanced">Balanced</option>
            <option value="reflective">Deep and reflective</option>
          </Select>
        </form>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole("combobox", { name: "Style" });
    expect(trigger).toHaveClass(
      "motion-reduce:transition-none",
      "motion-reduce:duration-0",
      "pointer-events-auto",
    );
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toHaveClass("z-[80]");
    expect(screen.getByRole("option", { name: "Balanced" })).toHaveClass(
      "cursor-pointer",
      "hover:bg-primary/10",
      "data-[highlighted]:bg-primary/10",
    );
    expect(
      screen.getByRole("listbox").closest('[data-slot="select-content"]'),
    ).toHaveClass("motion-reduce:animate-none", "motion-reduce:duration-0");
    fireEvent.click(screen.getByRole("option", { name: "Deep and reflective" }));

    expect(screen.getByRole("combobox", { name: "Style" })).toHaveTextContent(
      "Deep and reflective",
    );
    expect(screen.getByRole("form", { name: "Preferences" })).toHaveFormValues({
      style: "reflective",
    });
  });

  it("closes the previous menu when another select opens", () => {
    render(
      <form aria-label="Questions">
        <label htmlFor="language">Language</label>
        <Select id="language" name="language" value="english">
          <option value="english">English</option>
          <option value="arabic">Arabic</option>
        </Select>
        <label htmlFor="style">Style</label>
        <Select id="style" name="style" value="balanced">
          <option value="balanced">Balanced</option>
          <option value="personal">Personal</option>
        </Select>
      </form>,
    );

    const language = screen.getByRole("combobox", { name: "Language" });
    const style = screen.getByRole("combobox", { name: "Style" });

    fireEvent.click(language);
    expect(language).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(style);
    expect(language).toHaveAttribute("aria-expanded", "false");
    expect(style).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Personal" })).toBeVisible();
  });

  it("uses an empty disabled option as its placeholder", () => {
    render(
      <Select aria-label="Reason" defaultValue="" name="reason" required>
        <option disabled value="">
          Choose a reason
        </option>
        <option value="spam">Spam</option>
      </Select>,
    );

    expect(screen.getByRole("combobox", { name: "Reason" })).toHaveTextContent(
      "Choose a reason",
    );
  });

  it("keeps hydrated selections as successful native form controls", () => {
    function Harness() {
      const [value, setValue] = useState("");

      return (
        <>
          <form id="preferences" aria-label="Preferences">
            <label htmlFor="reason">Reason</label>
          </form>
          <Select
            aria-label="Reason"
            form="preferences"
            id="reason"
            name="reason"
            onValueChange={setValue}
            required
            value={value}
          >
            <option disabled value="">
              Choose a reason
            </option>
            <option value="spam">Spam</option>
          </Select>
        </>
      );
    }

    render(<Harness />);

    const form = screen.getByRole("form", { name: "Preferences" });
    const trigger = screen.getByRole("combobox", { name: "Reason" });
    expect(trigger).toHaveAttribute("id", "reason");
    expect(trigger).not.toHaveAttribute("name");
    expect(trigger).not.toHaveAttribute("form");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Spam" }));

    const submitted = new FormData(form as HTMLFormElement);
    expect(submitted.get("reason")).toBe("spam");

    const nativeSelect = document.querySelector<HTMLSelectElement>(
      'select[name="reason"]',
    );

    if (nativeSelect === null) {
      throw new Error("expected the hydrated native select");
    }
    expect(nativeSelect).toHaveAttribute("form", "preferences");
    expect(nativeSelect).toBeRequired();
    expect(nativeSelect).toHaveValue("spam");
  });

  it("serializes an empty sentinel back to an empty value", () => {
    render(
      <form aria-label="Preferences">
        <Select aria-label="Reason" name="reason" value="">
          <option disabled value="">
            Choose a reason
          </option>
          <option value="spam">Spam</option>
        </Select>
      </form>,
    );

    const form = screen.getByRole("form", { name: "Preferences" });
    expect(new FormData(form as HTMLFormElement).get("reason")).toBe("");
  });

  it("synchronizes an uncontrolled default value after a Radix selection", () => {
    render(
      <form aria-label="Preferences">
        <Select aria-label="Reason" defaultValue="spam" name="reason">
          <option value="spam">Spam</option>
          <option value="abuse">Abuse</option>
        </Select>
      </form>,
    );

    const form = screen.getByRole("form", { name: "Preferences" });
    fireEvent.click(screen.getByRole("combobox", { name: "Reason" }));
    fireEvent.click(screen.getByRole("option", { name: "Abuse" }));

    expect(new FormData(form as HTMLFormElement).get("reason")).toBe("abuse");
  });
});
