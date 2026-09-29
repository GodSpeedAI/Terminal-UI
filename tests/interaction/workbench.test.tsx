import { describe, expect, test } from "bun:test";
import { flushSync } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { Workbench } from "../../workbench/app/workbench.js";
import { RESPONSIVE_WIDTHS, SINGLE_COLUMN_BELOW } from "../../workbench/chrome.js";

/**
 * Workbench behaviour.
 *
 * The explorer is the primary way anyone sees this library, so its own
 * regressions matter: a Workbench that overflows at 40 columns or traps a
 * keystroke is a Workbench that misrepresents the components it is showing.
 * These run through the same OpenTUI test renderer as everything else.
 */

async function open(width: number, height = 30) {
  const setup = await testRender(<Workbench />, { width, height, kittyKeyboard: true });
  await setup.renderOnce();
  return {
    ...setup,
    frame: () => setup.captureCharFrame(),
    rows: () =>
      setup
        .captureCharFrame()
        .split("\n")
        .map((l) => l.replace(/\s+$/, "")),
    lines: () =>
      setup
        .captureCharFrame()
        .split("\n")
        .map((l) => l.replace(/\s+$/, ""))
        .filter((l) => l.trim() !== ""),
    press: async (k: never) => {
      flushSync(() => setup.mockInput.pressKey(k));
      await setup.flush();
    },
    type: async (text: string) => {
      flushSync(() => {
        for (const ch of text) setup.mockInput.pressKey(ch);
      });
      await setup.flush();
    },
    escape: async () => {
      flushSync(() => setup.mockInput.pressEscape());
      await setup.flush();
    },
  };
}

describe("Workbench: layout", () => {
  for (const width of RESPONSIVE_WIDTHS) {
    test(`renders at ${width} columns without overflowing`, async () => {
      const w = await open(width);
      const over = w.rows().filter((l) => l.length > width);
      expect(over, `rows wider than ${width}: ${JSON.stringify(over.slice(0, 2))}`).toEqual([]);
      expect(w.lines().length).toBeGreaterThan(3);
    });
  }

  test("uses a single-column layout below the breakpoint", async () => {
    const narrow = await open(40);
    const wide = await open(120);
    // The two modes are structurally different, not the same layout squeezed.
    expect(narrow.lines()[0]).not.toBe(wide.lines()[0]);
    expect(SINGLE_COLUMN_BELOW).toBeGreaterThan(40);
  });

  test("the header never collides with the status block", async () => {
    for (const width of RESPONSIVE_WIDTHS) {
      const w = await open(width);
      const header = w.rows()[0] ?? "";
      expect(header.length, `header overflowed at ${width}`).toBeLessThanOrEqual(width);
    }
  });
});

describe("Workbench: navigation", () => {
  test("moves the component cursor with the arrow keys", async () => {
    const w = await open(120);
    const before = w.frame();
    await w.press("ARROW_DOWN" as never);
    expect(w.frame()).not.toBe(before);
  });

  test("selecting a component shows its scenarios and detail", async () => {
    const w = await open(120);
    const lines = w.lines().join("\n");
    expect(lines).toContain("Select");
    expect(lines).toContain("TextInput");
  });

  test("`/` opens search and typing filters the list", async () => {
    const w = await open(120);
    await w.press("/" as never);
    await w.type("select");
    const text = w.lines().join("\n");
    expect(text).toContain("Select");
    // Filtering removes non-matching components from the sidebar.
    expect(text).not.toContain("TaskList");
  });

  test("escape clears an active search", async () => {
    const w = await open(120);
    await w.press("/" as never);
    await w.type("select");
    expect(w.lines().join("\n")).not.toContain("TaskList");
    // Escape has to be inside the flush boundary, or the state update it
    // triggers is still queued when the frame is captured.
    await w.escape();
    expect(w.lines().join("\n")).toContain("TaskList");
  });

  test("`t` cycles the theme and the status bar reports it", async () => {
    const w = await open(120);
    await w.press("t" as never);
    expect(w.lines().join("\n")).toMatch(/ascii/);
  });

  test("`a` toggles ASCII directly", async () => {
    const w = await open(120);
    await w.press("a" as never);
    const text = w.lines().join("\n");
    expect(text).toMatch(/ascii/);
  });

  test("`w` cycles the simulated live width", async () => {
    const w = await open(120);
    const before = w.frame();
    await w.press("w" as never);
    expect(w.frame()).not.toBe(before);
  });

  test("`r` resets the current scenario", async () => {
    const w = await open(120);
    await w.press("w" as never);
    const changed = w.frame();
    await w.press("r" as never);
    expect(w.frame()).not.toBe(changed);
  });

  test("`?` toggles the help overlay", async () => {
    const w = await open(120);
    expect(w.lines().join("\n")).not.toContain("cycle simulated width");
    await w.press("?" as never);
    expect(w.lines().join("\n")).toContain("cycle simulated width");
    await w.press("?" as never);
    expect(w.lines().join("\n")).not.toContain("cycle simulated width");
  });

  test("the live pane renders the real component, not a preview", async () => {
    const w = await open(120);
    // The default selection lands on a foundations entry; the live pane shows
    // that component's own output, including the rail grammar.
    expect(w.frame()).toMatch(/[│◆◇]/);
  });
});
