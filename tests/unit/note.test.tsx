import { describe, expect, test } from "bun:test";
import { Note } from "../../src/components/composition/note.js";
import { sliceToWidth, stringWidth, truncateToWidth, wrapToWidth } from "../../src/utils/text.js";
import { render } from "../harness.js";

/** Column of the last frame-drawing character on a row. */
function rightEdge(row: string): number {
  // Includes the ASCII frame glyphs and `|`, which is the rail in the ASCII
  // theme; taking the maximum is what identifies the frame's right-hand bar.
  const matches = [...row].map((ch, i) => ("│├╮╯└|+".includes(ch) ? i : -1)).filter((i) => i >= 0);
  return matches.length === 0 ? -1 : Math.max(...matches);
}

describe("Note", () => {
  test("the frame closes: every edge lands on the same column", async () => {
    const h = await render(<Note title="Migration notes">A short body.</Note>);
    const rows = h.lines();
    const edges = rows.map(rightEdge).filter((c) => c >= 0);
    // A frame whose corners disagree by even one cell reads as broken.
    expect(new Set(edges).size).toBe(1);
  });

  test("the frame closes for a multi-line body", async () => {
    const h = await render(
      <Note title="A considerably longer title">
        This body is long enough that it has to wrap onto several rows, which is the behaviour the frame
        exists to contain.
      </Note>,
    );
    const rows = h.lines();
    const edges = rows.map(rightEdge).filter((c) => c >= 0);
    expect(new Set(edges).size).toBe(1);
  });

  test("the frame closes without a title", async () => {
    const h = await render(<Note>Just a body, no title.</Note>);
    const edges = h
      .lines()
      .map(rightEdge)
      .filter((c) => c >= 0);
    expect(new Set(edges).size).toBe(1);
  });

  test("the frame closes in the ASCII theme", async () => {
    const h = await render(<Note title="Note">body</Note>, { theme: "ascii" });
    const edges = h
      .lines()
      .map(rightEdge)
      .filter((c) => c >= 0);
    expect(new Set(edges).size).toBe(1);
  });

  test("wraps rather than overflowing at a narrow width", async () => {
    const h = await render(
      <Note title="T">a body long enough that it must wrap onto more than one row</Note>,
      { width: 40 },
    );
    for (const row of h.rows()) {
      expect(row.length).toBeLessThanOrEqual(40);
    }
    // More than one body row means it wrapped rather than truncated away.
    expect(h.lines().length).toBeGreaterThan(3);
  });
});

describe("text width arithmetic", () => {
  test("counts wide characters as two cells", () => {
    expect(stringWidth("abc")).toBe(3);
    expect(stringWidth("日本語")).toBe(6);
    expect(stringWidth("a日b")).toBe(4);
  });

  test("ignores combining marks and control characters", () => {
    expect(stringWidth("é")).toBe(1);
    expect(stringWidth("a\u0007b")).toBe(2);
  });

  test("truncateToWidth respects the budget including the ellipsis", () => {
    expect(truncateToWidth("abcdefghij", 5)).toBe("abcd…");
    expect(stringWidth(truncateToWidth("日本語です", 5))).toBeLessThanOrEqual(5);
    // A budget too small for content plus an ellipsis hard-cuts instead.
    expect(stringWidth(truncateToWidth("abcdef", 1))).toBeLessThanOrEqual(1);
  });

  test("sliceToWidth never splits a wide character", () => {
    expect(sliceToWidth("日本語", 3)).toBe("日");
    expect(stringWidth(sliceToWidth("日本語", 3))).toBeLessThanOrEqual(3);
  });

  test("wrapToWidth breaks on words and hard-splits long ones", () => {
    expect(wrapToWidth("one two three", 7)).toEqual(["one two", "three"]);
    const hard = wrapToWidth("supercalifragilistic", 6);
    for (const line of hard) {
      expect(stringWidth(line)).toBeLessThanOrEqual(6);
    }
    expect(hard.join("")).toBe("supercalifragilistic");
  });
});
