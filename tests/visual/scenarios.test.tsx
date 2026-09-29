import { describe, expect, test } from "bun:test";
import { flushSync } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { catalog } from "../../src/scenario/catalog.js";
import type { Scenario } from "../../src/scenario/types.js";
import { entryScenarios } from "../../src/scenario/types.js";
import { ThemeProvider } from "../../src/theme/index.js";
import { diffFrames, isUpdateMode, readGolden, writeGolden } from "./golden.js";

/**
 * Visual regression, driven by the same scenarios the Workbench shows.
 *
 * This is the payoff of the scenario abstraction: the fixture names here are
 * the names in the Workbench sidebar, and both read the same render function.
 * A component cannot be green here and stale in the explorer, because there is
 * only one definition of what either of them shows.
 *
 * Nothing in this file waits on wall time. Animated components either pin a
 * frame in their scenario or are driven by a manual clock, so a fixture records
 * an exact state rather than a sampled one.
 */

const DEFAULT_HEIGHT = 40;

/** Render a scenario and return its exact character frame. */
async function capture(scenario: Scenario, widthOverride?: number): Promise<string> {
  const width = widthOverride ?? scenario.width ?? 60;
  const height = scenario.height ?? DEFAULT_HEIGHT;
  const setup = await testRender(
    <ThemeProvider theme={scenario.theme ?? "clack"}>{scenario.render()}</ThemeProvider>,
    { width, height, kittyKeyboard: true },
  );
  await setup.renderOnce();

  // Replay the scenario's declared steps so a fixture can capture a state that
  // is awkward to construct as an initial prop. Each step calls setState, and
  // the test renderer enables React's act environment, so the update lands
  // inside `act`; the flush below is what brings the frame current before the
  // fixture captures it.
  for (const step of scenario.steps ?? []) {
    if ("type" in step) {
      act(() => {
        flushSync(() => {
          for (const ch of step.type) setup.mockInput.pressKey(ch);
        });
      });
    } else {
      act(() => {
        flushSync(() => setup.mockInput.pressKey(step.key as never, step.modifiers ?? {}));
      });
    }
    await setup.flush();
  }

  const frame = setup.captureCharFrame();
  // Unmounting is itself a React update (the root unmounts the tree), so it
  // happens inside `act` as well, and awaited so teardown completes before the
  // next scenario mounts its own renderer.
  await act(async () => {
    await setup.renderer.destroy();
  });
  return frame;
}

const allScenarios = catalog.flatMap((entry) =>
  entryScenarios(entry).map((scenario) => ({ entry, scenario })),
);

describe("visual: golden fixtures", () => {
  for (const { entry, scenario } of allScenarios) {
    test(`${entry.name} / ${scenario.name}`, async () => {
      const frame = await capture(scenario);
      const name = scenario.name;
      const expected = readGolden(name);

      if (isUpdateMode() || expected === null) {
        writeGolden(name, frame);
        // A brand-new fixture is a placeholder until reviewed. Assert only that
        // it rendered something, and let `--update` be a deliberate act.
        expect(frame.trim().length).toBeGreaterThan(0);
        return;
      }

      const actual = frame.endsWith("\n") ? frame : `${frame}\n`;
      expect(diffFrames(expected, actual)).toEqual([]);
    });
  }
});

describe("visual: coverage", () => {
  test("every scenario name is a valid fixture name", () => {
    const names = allScenarios.map(({ scenario }) => scenario.name);
    for (const name of names) {
      expect(name, name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("scenario names are unique across the catalog", () => {
    const names = allScenarios.map(({ scenario }) => scenario.name);
    const seen = new Set<string>();
    for (const name of names) {
      expect(seen.has(name), `duplicate scenario name: ${name}`).toBe(false);
      seen.add(name);
    }
  });

  test("the fixtures named in the specification all exist", () => {
    // These are the states the spec calls out explicitly. If one disappears the
    // suite is quietly covering less than it claims to.
    const required = [
      "select-default",
      "select-focused",
      "select-submitted",
      "select-error",
      "multiselect-default",
      "text-input-empty",
      "text-input-editing",
      "text-input-error",
      "spinner",
      "progress-0",
      "progress-50",
      "progress-100",
      "task-pending",
      "task-running",
      "task-completed",
      "task-failed",
    ];
    const names = new Set(allScenarios.map(({ scenario }) => scenario.name));
    for (const name of required) {
      expect(names.has(name), `missing required scenario: ${name}`).toBe(true);
      expect(readGolden(name), `missing required fixture: ${name}`).not.toBeNull();
    }
  });
});
