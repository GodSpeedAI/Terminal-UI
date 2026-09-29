import { describe, expect, test } from "bun:test";
import { Hint, Label } from "../../src/primitives/label.js";
import { Marker, Rail, RailRow, Status } from "../../src/primitives/rail.js";
import { asciiTheme, clackTheme, highContrastTheme } from "../../src/theme/index.js";
import { render } from "../harness.js";

describe("primitives: rail", () => {
  test("Rail draws the vertical bar in the theme glyph set", async () => {
    const h = await render(<Rail />);
    expect(h.frame()).toContain("│");
  });

  test("Rail honours the ASCII theme", async () => {
    const h = await render(<Rail />, { theme: "ascii" });
    expect(h.frame()).toContain("|");
  });

  test("Rail start and end use the theme's block glyphs", async () => {
    const h = await render(
      <box flexDirection="column">
        <Rail variant="start" />
        <Rail variant="bar" />
        <Rail variant="end" />
      </box>,
    );
    const rows = h.rows();
    expect(rows[0]).toBe("┌");
    expect(rows[1]).toBe("│");
    expect(rows[2]).toBe("└");
  });
});

describe("primitives: marker", () => {
  const cases: Array<[Parameters<typeof Marker>[0]["state"], string]> = [
    ["active", "◆"],
    ["complete", "◇"],
    ["error", "■"],
    ["warning", "▲"],
    ["selected", "●"],
    ["unselected", "○"],
    ["checked", "◼"],
    ["unchecked", "◻"],
  ];

  for (const [state, char] of cases) {
    test(`marker state "${state}" renders ${char}`, async () => {
      const h = await render(<Marker state={state} />);
      expect(h.frame().trim()).toBe(char);
    });
  }

  test("ASCII theme gives every state a 7-bit glyph", async () => {
    for (const [state] of cases) {
      const h = await render(<Marker state={state} />, { theme: "ascii" });
      expect(h.frame().trim()).toMatch(/^[\x20-\x7e]*$/);
    }
  });
});

describe("primitives: status", () => {
  test("status carries severity independent of lifecycle", async () => {
    const h = await render(
      <box flexDirection="column">
        <Status state="info" />
        <Status state="success" />
        <Status state="warning" />
        <Status state="error" />
      </box>,
    );
    expect(h.lines()).toEqual(["●", "◆", "▲", "■"]);
  });
});

describe("primitives: RailRow", () => {
  test("indents body content by the theme's bodyIndent", async () => {
    const h = await render(
      <RailRow>
        <Label>hello</Label>
      </RailRow>,
    );
    expect(h.rows()[0]).toBe("│  hello");
  });

  test("ASCII theme indents by the same number of columns", async () => {
    const h = await render(
      <RailRow>
        <Label>hello</Label>
      </RailRow>,
      { theme: "ascii" },
    );
    expect(h.rows()[0]).toBe("|  hello");
  });

  test("gapBefore inserts blank rows", async () => {
    const h = await render(
      <box flexDirection="column">
        <RailRow>
          <Label>first</Label>
        </RailRow>
        <RailRow gapBefore={1}>
          <Label>second</Label>
        </RailRow>
      </box>,
    );
    const rows = h.rows();
    expect(rows[0]).toBe("│  first");
    expect(rows[1]).toBe("");
    expect(rows[2]).toBe("│  second");
  });
});

describe("primitives: hint", () => {
  test("renders key and description joined by the theme separator", async () => {
    const h = await render(
      <RailRow>
        <Hint
          hints={[
            { key: "↑/↓", description: "navigate", format: "space" },
            { key: "Enter", description: "confirm" },
          ]}
        />
      </RailRow>,
    );
    const row = h.rows()[0] ?? "";
    expect(row).toContain("↑/↓ navigate");
    expect(row).toContain("•");
    expect(row).toContain("Enter: confirm");
  });

  test("named keys use a colon, symbol keys use a space", async () => {
    const h = await render(
      <RailRow>
        <Hint
          hints={[
            { key: "Enter", description: "confirm" },
            { key: "↑/↓", description: "navigate", format: "space" },
          ]}
        />
      </RailRow>,
    );
    const row = h.rows()[0] ?? "";
    expect(row).toContain("Enter: confirm");
    expect(row).toContain("↑/↓ navigate");
    expect(row).not.toContain("↑/↓:");
  });

  test("ASCII theme uses ASCII separator and terminator", async () => {
    const h = await render(
      <RailRow>
        <Hint hints={[{ key: "Enter", description: "confirm" }]} />
      </RailRow>,
      { theme: "ascii" },
    );
    const row = h.rows()[0] ?? "";
    expect(row).toMatch(/^[\x20-\x7e]+$/);
    expect(row).toContain("Enter: confirm");
  });

  test("compacts to a single pair when the row is too narrow", async () => {
    const h = await render(
      <RailRow>
        <Hint
          hints={[
            { key: "↑/↓", description: "navigate", format: "space" },
            { key: "Enter", description: "confirm" },
            { key: "Esc", description: "cancel" },
          ]}
          availableWidth={20}
        />
      </RailRow>,
    );
    const row = h.rows()[0] ?? "";
    expect(row).toContain("↑/↓ navigate");
    expect(row).not.toContain("Esc");
  });
});

describe("theme completeness", () => {
  const themes = { clack: clackTheme, ascii: asciiTheme, "high-contrast": highContrastTheme };

  for (const [name, theme] of Object.entries(themes)) {
    test(`${name} theme defines every state`, () => {
      for (const state of Object.keys(theme.markers)) {
        expect(
          theme.markerStyles[state as keyof typeof theme.markerStyles],
          `${name}.markerStyles.${state}`,
        ).toBeDefined();
      }
      for (const state of Object.keys(theme.statuses)) {
        expect(
          theme.statusStyles[state as keyof typeof theme.statusStyles],
          `${name}.statusStyles.${state}`,
        ).toBeDefined();
      }
      expect(theme.spinnerFrames.length).toBeGreaterThan(0);
      expect(theme.spacing.railWidth).toBe(1);
    });

    test(`${name} theme is ${theme.ascii ? "ASCII" : "non-ASCII"} as declared`, () => {
      const all = [
        ...Object.values(theme.markers).map((g) => g.char),
        ...Object.values(theme.statuses).map((g) => g.char),
        theme.rail.bar.char,
        theme.rail.start.char,
        theme.rail.end.char,
        ...theme.spinnerFrames.map((g) => g.char),
        theme.progress.active.char,
        theme.progress.inactive.char,
      ].join("");
      expect(/^[\x20-\x7e]*$/.test(all)).toBe(theme.ascii);
    });
  }
});
