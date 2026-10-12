import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Upload</Button>);
    expect(screen.getByRole("button", { name: "Upload" })).toHaveProperty(
      "type",
      "button",
    );
  });

  it("keeps caller classes alongside the variant classes", () => {
    render(
      <Button variant="secondary" className="w-full">
        Cancel
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.className).toContain("w-full");
    expect(button.className).toContain("border-ink");
  });
});
