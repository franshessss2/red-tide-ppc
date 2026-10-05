// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReelStage, ReportPreview } from "./ReelStage";
import { REEL_SCENES } from "./reelScenes";
afterEach(cleanup);
describe("product intro illustrations", () => {
  it.each(REEL_SCENES.map((copy, scene) => ({ ...copy, scene })))('presents chapter $chapter with its accessible explanation', ({ scene, title, description }) => {
    render(<ReelStage scene={scene} reduced={false} />);
    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
  });
  it('separates illustrative status, source and hardware meaning from official advice', () => {
    const view = render(<ReelStage scene={5} reduced={false} />);
    expect(screen.getByText(/No recorded alert does not establish safe water/)).toBeTruthy();
    expect(view.container.querySelector('.reel-warning')?.getAttribute('aria-hidden')).toBe('true');
    view.rerender(<ReelStage scene={6} reduced={false} />);
    expect(screen.getByText('Sync describes delivery, not water testing')).toBeTruthy();
    expect(screen.getByText('These are label examples, not a live feed.')).toBeTruthy();
    view.rerender(<ReelStage scene={7} reduced={false} />);
    expect(screen.getByText(/not a red-tide detector/)).toBeTruthy();
    expect(screen.getByText('Manual beep')).toBeTruthy();
    expect(view.container.querySelector('button')).toBeNull();
  });
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
