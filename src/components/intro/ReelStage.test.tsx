// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReelStage, ReportPreview } from "./ReelStage";
afterEach(cleanup);
describe("product intro illustrations", () => {
  it("keeps observation feedback in the card and the cursor on the text itself", () => {
    const view = render(<ReportPreview />);
    const field = view.container.querySelector(".reel-report__field")!;
    expect(field.children.length).toBe(1);
    expect(field.textContent).toBe("Unusual water colour");
    expect(view.container.querySelector(".reel-report__caret")).toBeNull();
    expect(screen.getByText("ILLUSTRATION")).toBeTruthy();
    expect(screen.getByText("Awaiting admin review")).toBeTruthy();
    expect(screen.getByText(/It does not confirm red tide/)).toBeTruthy();
  });
  it("keeps feature illustrations decorative and the heading readable", () => {
    const view = render(<ReelStage scene={3} reduced={false} />);
    expect(
      screen.getByRole("heading", { name: "Report observations." }),
    ).toBeTruthy();
    expect(
      view.container.querySelector(".reel-report")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
  it("shows the closing product message without a typing field under reduced motion", () => {
    const view = render(<ReelStage scene={3} reduced />);
    expect(screen.getByRole("heading", { name: "RED TIDE" })).toBeTruthy();
    expect(view.container.querySelector(".reel-report")).toBeNull();
    expect(screen.getByText(/Reports are reviewed by an admin/)).toBeTruthy();
  });
});
