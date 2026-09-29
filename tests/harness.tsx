import type { KeyInput, TestRendererSetup } from "@opentui/core/testing";
import { flushSync } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { createElement, type ReactNode } from "react";
import { type ThemeName, ThemeProvider } from "../src/theme/index.js";

/** A mounted component under test, with helpers for driving and reading it. */
export interface Harness extends TestRendererSetup {
  /** The captured character frame. */
  frame(): string;
  /** The captured frame split into trimmed, non-empty lines. */
  lines(): string[];
  /** The frame with trailing whitespace stripped from each line. */
  rows(): string[];
  /** Press keys, then flush the render queue. */
  press(keys: KeyInput[]): Promise<void>;
  /** Press a single key and flush. */
  key(k: KeyInput): Promise<void>;
  /** Type literal text and flush. */
  type(text: string): Promise<void>;
  /** Press a key with modifiers and flush. */
  pressWith(
    modifiers: { shift?: boolean; ctrl?: boolean; meta?: boolean; super?: boolean },
    k: KeyInput,
  ): Promise<void>;
  /**
   * Press Escape and flush.
   *
   * Uses the renderer's dedicated helper because a bare ESC byte is swallowed
   * as a possible escape-sequence prefix and produces no key event.
   */
  escape(): Promise<void>;
  /** Re-render at a new width without remounting. */
  setWidth(width: number, height?: number): Promise<void>;
}

/** Options for {@link render}. */
export interface RenderOptions {
  width?: number;
  height?: number;
  theme?: ThemeName;
}

const DEFAULT_WIDTH = 60;
const DEFAULT_HEIGHT = 24;

/**
 * Mount a node into OpenTUI's test renderer and wait for it to settle.
 *
 * Every test in this suite goes through here so that "deterministic" means the
 * same thing everywhere: one `renderOnce`, no timers, no animation frames. Tests
 * that need a ticking clock pass a `ManualClock` explicitly rather than waiting
 * on wall time.
 */
export async function render(node: ReactNode, options: RenderOptions = {}): Promise<Harness> {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, theme } = options;
  const wrapped = theme === undefined ? node : createElement(ThemeProvider, { theme }, node);
  // The kitty keyboard protocol disambiguates key events. Without it a bare ESC
  // is swallowed as a possible escape-sequence prefix and a literal character
  // arrives glued to a stray ESC, so Escape and type-ahead cannot be asserted
  // deterministically at all. Enabling it here is what makes the interaction
  // tests reproducible rather than timing-dependent.
  const setup = await testRender(wrapped, { width, height, kittyKeyboard: true });
  await setup.renderOnce();

  const rows = (): string[] =>
    setup
      .captureCharFrame()
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""));

  const harness: Harness = {
    ...setup,
    frame: () => setup.captureCharFrame(),
    rows,
    lines: () => rows().filter((line) => line.trim() !== ""),
    async press(keys: KeyInput[]) {
      // The key handler runs synchronously and calls setState, so the update has
      // to be flushed inside `flushSync` before the renderer is asked for a
      // frame. Without this the frame is captured mid-update and every
      // interaction assertion reads stale output.
      flushSync(() => {
        for (const k of keys) setup.mockInput.pressKey(k);
      });
      await setup.flush();
    },
    async key(k) {
      flushSync(() => setup.mockInput.pressKey(k));
      await setup.flush();
    },
    async type(text) {
      // Driven through `pressKey` rather than `typeText` so the whole run lands
      // inside one flush boundary. `typeText` awaits between characters, which
      // schedules the resulting state update outside `flushSync` and leaves the
      // captured frame stale.
      flushSync(() => {
        for (const ch of text) setup.mockInput.pressKey(ch);
      });
      await setup.flush();
    },
    async pressWith(modifiers, k) {
      flushSync(() => setup.mockInput.pressKey(k, modifiers));
      await setup.flush();
    },
    async escape() {
      // A bare ESC byte is ambiguous with the start of an escape sequence, so
      // the renderer's dedicated helper is the only reliable way to assert on
      // it. `pressKey("ESCAPE")` silently produces no event at all.
      flushSync(() => setup.mockInput.pressEscape());
      await setup.flush();
    },
    async setWidth(nextWidth, nextHeight = height) {
      setup.resize(nextWidth, nextHeight);
      await setup.flush();
    },
  };
  return harness;
}

/**
 * Assert that `frame` contains `needle` on a single line.
 *
 * Compares whole lines rather than substrings so that a test cannot pass
 * because the expected text appears somewhere unexpected in a wider frame.
 */
export function expectLine(frame: string, needle: string): boolean {
  return frame.split("\n").some((line) => line.replace(/\s+$/, "") === needle.replace(/\s+$/, ""));
}

/** Rows of `frame` that contain `needle`. */
export function linesWith(frame: string, needle: string): string[] {
  return frame
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.includes(needle));
}
