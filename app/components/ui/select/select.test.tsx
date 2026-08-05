import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Select } from "~/components/ui/select/select";

describe("Select", () => {
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

    fireEvent.click(screen.getByRole("combobox", { name: "Style" }));
    expect(screen.getByRole("listbox")).toHaveClass("z-[80]");
    fireEvent.click(screen.getByRole("option", { name: "Deep and reflective" }));

    expect(screen.getByRole("combobox", { name: "Style" })).toHaveTextContent(
      "Deep and reflective",
    );
    expect(screen.getByRole("form", { name: "Preferences" })).toHaveFormValues({
      style: "reflective",
    });
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
});
