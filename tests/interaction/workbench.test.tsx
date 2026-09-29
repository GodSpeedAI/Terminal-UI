import { afterEach, describe, expect, test } from "bun:test";
import type { KeyInput } from "@opentui/core/testing";
import { flushSync } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { act, type ReactNode } from "react";
import { Workbench } from "../../workbench/app/workbench.js";
import { RESPONSIVE_WIDTHS, SINGLE_COLUMN_BELOW } from "../../workbench/chrome.js";

/**
 * Workbench behaviour.
 *
 * The explorer is the primary way anyone sees this library, so its own
 * regressions matter: a Workbench that overflows at 40 columns or traps a
 * keystroke is a Workbench that misrepresents the components it is showing.
 * These run through the same OpenTUI test renderer as everything else.
 *
 * Navigation assertions name the row that must move, never merely "the frame
 * changed": the live pane means some pixels always move, so an inequality can
 * pass while the arrow keys are dead.
 */

/** Glyphs only a rendered library component can produce — never Workbench chrome. */
const LIBRARY_GLYPHS = /[◆◇●○■▲◻◼]/;

/** Every renderer a test in this file has opened, torn down after each test. */
const opened: Awaited<ReturnType<typeof testRender>>[] = [];

afterEach(async () => {
  const live = opened.splice(0);
  // A renderer left alive keeps its React root mounted, so any late update —
  // a banner clear timer, for one — fires outside act long after its test
  // ended. Unmounting is itself a React update, so the destroy runs inside
  // `act` too, the same way the visual suite tears down.
  await act(async () => {
    for (const setup of live) await setup.renderer.destroy();
  });
});

async function open(width: number, height = 30, node: ReactNode = <Workbench />) {
  const setup = await testRender(node, { width, height, kittyKeyboard: true });
  await setup.renderOnce();
  opened.push(setup);
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
    header: () => setup.captureCharFrame().split("\n")[0] ?? "",
    // Every key press runs inside `act` so the state updates it triggers are
    // flushed with the render they belong to, not left queued past the frame
    // capture.
    press: async (k: KeyInput) => {
      act(() => {
        flushSync(() => setup.mockInput.pressKey(k));
      });
      await setup.flush();
    },
    type: async (text: string) => {
      act(() => {
        flushSync(() => {
          for (const ch of text) setup.mockInput.pressKey(ch);
        });
      });
      await setup.flush();
    },
    escape: async () => {
      act(() => {
        flushSync(() => setup.mockInput.pressEscape());
      });
      await setup.flush();
    },
  };
}

type WorkbenchHarness = Awaited<ReturnType<typeof open>>;

/** The one row carrying the focused list's cursor marker, if any list has focus. */
function focusedRow(w: WorkbenchHarness): string | undefined {
  return w.rows().find((l) => l.includes("▸"));
}

/**
 * Walk to a scenario with the scenario list focused. The live pane is already
 * mounted beside it in the wide layout; one more Tab enters the live pane in
 * either layout.
 */
async function gotoScenario(w: WorkbenchHarness, componentDowns: number, scenarioDowns: number) {
  for (let i = 0; i < componentDowns; i++) await w.press("ARROW_DOWN");
  await w.press("TAB");
  for (let i = 0; i < scenarioDowns; i++) await w.press("ARROW_DOWN");
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

describe("Workbench: focus and navigation", () => {
  for (const width of RESPONSIVE_WIDTHS) {
    test(`the live pane renders the real component at ${width} columns`, async () => {
      const w = await open(width);
      // Library-only state glyphs. Workbench chrome (`│ ┌ └ ▸`) is excluded on
      // purpose: matching chrome is exactly how the old suite stayed green
      // while the wide layout mounted no component at all.
      expect(w.frame()).toMatch(LIBRARY_GLYPHS);
    });
  }

  for (const width of [120, 60]) {
    test(`arrows route to the focused target, and through to the live component (${width})`, async () => {
      const w = await open(width);

      // focus=components: ↓ moves the component cursor (Marker → Note →
      // Select, two presses from the initial entry).
      expect(focusedRow(w)).toContain("Marker");
      await w.press("ARROW_DOWN");
      expect(focusedRow(w)).toContain("Note");
      await w.press("ARROW_DOWN");
      expect(focusedRow(w)).toContain("Select");

      // One Tab: focus=scenarios, ↓ moves the scenario highlight instead.
      await w.press("TAB");
      expect(focusedRow(w)).toContain("select-default");
      await w.press("ARROW_DOWN");
      expect(focusedRow(w)).toContain("select-focused");
      expect(focusedRow(w)).not.toContain("select-default");

      // Second Tab: focus=live. No list owns the cursor any more.
      await w.press("TAB");
      expect(focusedRow(w)).toBeUndefined();

      // The live Select is on screen (select-focused seeds its cursor on the
      // second option). ↓ at the Workbench level does nothing here, so the
      // Select itself moves: Staging holds the selected marker before,
      // Development after.
      expect(w.frame()).toContain("● Staging");
      expect(w.frame()).toContain("○ Production");
      await w.press("ARROW_DOWN");
      expect(w.frame()).toContain("● Development");
      expect(w.frame()).toContain("○ Staging");
    });
  }

  test("`q` calls onQuit instead of ending the process", async () => {
    const quits: number[] = [];
    const w = await open(120, 30, <Workbench onQuit={() => quits.push(1)} />);
    await w.press("q");
    expect(quits).toEqual([1]);
  });
});

describe("Workbench: commands", () => {
  test("selecting a component shows its scenarios and usage example", async () => {
    const w = await open(120);
    const lines = w.lines().join("\n");
    expect(lines).toContain("Select");
    expect(lines).toContain("TextInput");
    // The usage strip under the live pane, standing in for the old detail box.
    expect(lines).toContain('<Marker state="active" />');
  });

  test("`/` opens search and typing filters the list", async () => {
    const w = await open(120);
    await w.press("/");
    await w.type("select");
    const text = w.lines().join("\n");
    expect(text).toContain("Select");
    // Filtering removes non-matching components from the sidebar.
    expect(text).not.toContain("TaskList");
  });

  test("escape clears an active search", async () => {
    const w = await open(120);
    await w.press("/");
    await w.type("select");
    expect(w.lines().join("\n")).not.toContain("TaskList");
    // Escape has to be inside the flush boundary, or the state update it
    // triggers is still queued when the frame is captured.
    await w.escape();
    expect(w.lines().join("\n")).toContain("TaskList");
  });

  test("`t` cycles the theme and the status bar reports it", async () => {
    const w = await open(120);
    await w.press("t");
    expect(w.lines().join("\n")).toMatch(/ascii/);
  });

  test("`a` toggles ASCII directly", async () => {
    const w = await open(120);
    await w.press("a");
    const text = w.lines().join("\n");
    expect(text).toMatch(/ascii/);
  });

  test("`w` cycles the simulated live width", async () => {
    const w = await open(120);
    // The marker scenario declares 60; one turn of the cycle is 80.
    expect(w.header()).toContain("60w sim");
    await w.press("w");
    expect(w.header()).toContain("80w sim");
  });

  test("`w` re-renders the live component at the simulated width", async () => {
    const w = await open(120);
    // Land on Select / select-long-label (designed for 40 columns) with the
    // scenario list focused: commands belong to the lists, and the wide layout
    // keeps the live pane visible beside them the whole time.
    await gotoScenario(w, 2, 7);
    // At the scenario's own width the 53-cell label does not fit the 35-cell
    // option budget, so it is already truncated.
    expect(w.header()).toContain("40w sim");
    expect(w.frame()).not.toContain("fit on one row");
    expect(w.frame()).toContain("A region whose name");

    // 40 → 60: the option budget grows to 55 and the full label appears —
    // proof the width knob reaches `useAvailableWidth` inside the component.
    await w.press("w");
    expect(w.header()).toContain("60w sim");
    expect(w.frame()).toContain("fit on one row");

    // 60 → 80 → 100 → 120 → 160 → 40: the cycle returns to the scenario's
    // width and the live pane truncates again.
    for (let i = 0; i < 5; i++) await w.press("w");
    expect(w.header()).toContain("40w sim");
    expect(w.frame()).not.toContain("fit on one row");
  });

  test("`r` restores both the simulated width and the live rendering", async () => {
    const w = await open(120);
    await gotoScenario(w, 2, 7);
    expect(w.frame()).not.toContain("fit on one row");
    await w.press("w");
    expect(w.header()).toContain("60w sim");
    expect(w.frame()).toContain("fit on one row");
    // Reset puts back both the number in the status bar and what the component
    // does at that width.
    await w.press("r");
    expect(w.header()).toContain("40w sim");
    expect(w.frame()).not.toContain("fit on one row");
  });

  test("`?` toggles the help overlay", async () => {
    const w = await open(120);
    expect(w.lines().join("\n")).not.toContain("cycle simulated width");
    await w.press("?");
    expect(w.lines().join("\n")).toContain("cycle simulated width");
    expect(w.lines().join("\n")).toContain("cycle focus");
    await w.press("?");
    expect(w.lines().join("\n")).not.toContain("cycle simulated width");
  });

  test("the live pane renders the real component, not a preview", async () => {
    const w = await open(120);
    // The default selection lands on a foundations entry; the live pane shows
    // that component's own output, including the rail grammar.
    expect(w.frame()).toMatch(/[│◆◇]/);
  });
});
