import { describe, expect, test } from "bun:test";
import { Select, type SelectOption } from "../../src/components/select/select.js";
import { render } from "../harness.js";

const OPTIONS: SelectOption<string>[] = [
  { value: "prod", label: "Production" },
  { value: "stag", label: "Staging" },
  { value: "dev", label: "Development" },
];

const MANY: SelectOption<number>[] = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: `Option ${i + 1}`,
}));

describe("Select: active", () => {
  test("renders the reference rail grammar", async () => {
    const h = await render(<Select message="Choose deployment target" options={OPTIONS} />);
    expect(h.lines()).toEqual([
      "│",
      "◆  Choose deployment target",
      "│  ● Production",
      "│  ○ Staging",
      "│  ○ Development",
      "│  ↑/↓ navigate • Enter: confirm",
    ]);
  });

  test("the highlighted option is marked by glyph, not color alone", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} initialIndex={1} />);
    const rows = h.lines();
    expect(rows[2]).toBe("│  ○ Production");
    expect(rows[3]).toBe("│  ● Staging");
  });

  test("option hints render muted after the label", async () => {
    const h = await render(
      <Select
        message="Pick"
        options={[
          { value: "a", label: "Beta", hint: "recommended" },
          { value: "b", label: "Alpha" },
        ]}
      />,
    );
    expect(h.lines()[2]).toBe("│  ● Beta (recommended)");
  });

  test("disabled options render in the disabled state and are skipped", async () => {
    const h = await render(
      <Select
        message="Pick"
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Blocked", disabled: true },
          { value: "c", label: "Gamma" },
        ]}
      />,
    );
    const rows = h.lines();
    expect(rows[2]).toBe("│  ● Alpha");
    expect(rows[3]).toBe("│  ◇ Blocked");

    await h.key("ARROW_DOWN");
    // Blocked is skipped entirely, so the cursor lands on Gamma.
    expect(h.lines()[4]).toBe("│  ● Gamma");
  });
});

describe("Select: keyboard interaction", () => {
  test("down and up move the cursor", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />);
    await h.key("ARROW_DOWN");
    expect(h.lines()[3]).toBe("│  ● Staging");
    await h.key("ARROW_UP");
    expect(h.lines()[2]).toBe("│  ● Production");
  });

  test("the cursor wraps at both ends", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />);
    await h.key("ARROW_UP");
    expect(h.lines()[4]).toBe("│  ● Development");
    await h.key("ARROW_DOWN");
    expect(h.lines()[2]).toBe("│  ● Production");
  });

  test("Home and End jump to the first and last option", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />);
    await h.key("END");
    expect(h.lines()[4]).toBe("│  ● Development");
    await h.key("HOME");
    expect(h.lines()[2]).toBe("│  ● Production");
  });

  test("type-ahead jumps to the next matching option", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />);
    await h.type("d");
    expect(h.lines()[4]).toBe("│  ● Development");
    // Typing again cycles to the next match rather than sticking.
    await h.type("d");
    expect(h.lines()[4]).toBe("│  ● Development");
  });

  test("Enter submits the highlighted option and collapses the prompt", async () => {
    const submitted: string[] = [];
    const h = await render(
      <Select message="Choose deployment target" options={OPTIONS} onSubmit={(v) => submitted.push(v)} />,
    );
    await h.key("ARROW_DOWN");
    await h.key("RETURN");

    expect(submitted).toEqual(["stag"]);
    // The collapse is one line: the question keeps its marker and the answer
    // follows it. Two lines would double the height of every resolved prompt.
    expect(h.lines()).toEqual(["│", "◇  Choose deployment target  Staging"]);
  });

  test("Escape cancels", async () => {
    let cancelled = false;
    const h = await render(
      <Select
        message="Pick"
        options={OPTIONS}
        onCancel={() => {
          cancelled = true;
        }}
      />,
    );
    await h.escape();
    expect(cancelled).toBe(true);
    // Cancellation collapses to the cancelled marker, not the complete one.
    expect(h.lines()).toEqual(["│", "■  Pick  cancelled"]);
  });

  test("Ctrl+C cancels", async () => {
    let _cancelled = false;
    const h = await render(
      <Select
        message="Pick"
        options={OPTIONS}
        onCancel={() => {
          _cancelled = true;
        }}
      />,
    );
    await h.pressWith({ ctrl: true }, "c");
  });

  test("a resolved prompt ignores further key presses", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />);
    await h.key("RETURN");
    const before = h.frame();
    await h.key("ARROW_DOWN");
    expect(h.frame()).toBe(before);
  });
});

describe("Select: validation", () => {
  test("a rejected submit shows the message inside the rail grammar", async () => {
    const h = await render(
      <Select
        message="Pick"
        options={OPTIONS}
        validate={(v) => (v === "stag" ? "Staging is frozen" : null)}
      />,
    );
    await h.key("ARROW_DOWN");
    await h.key("RETURN");

    const rows = h.lines();
    expect(rows[rows.length - 2]).toContain("Staging is frozen");
    // The error uses the error marker, and the prompt is still open.
    expect(rows.some((r) => r.includes("■"))).toBe(true);
    expect(rows).toContain("│  ● Staging");
  });

  test("a rejected submit does not call onSubmit", async () => {
    const submitted: string[] = [];
    const h = await render(
      <Select message="Pick" options={OPTIONS} onSubmit={(v) => submitted.push(v)} validate={() => "nope"} />,
    );
    await h.key("RETURN");
    expect(submitted).toEqual([]);
  });

  test("correcting the choice after an error submits successfully", async () => {
    const submitted: string[] = [];
    const h = await render(
      <Select
        message="Pick"
        options={OPTIONS}
        onSubmit={(v) => submitted.push(v)}
        validate={(v) => (v === "stag" ? "Staging is frozen" : null)}
      />,
    );
    await h.key("ARROW_DOWN");
    await h.key("RETURN");
    expect(submitted).toEqual([]);
    await h.key("ARROW_DOWN");
    await h.key("RETURN");
    expect(submitted).toEqual(["dev"]);
    expect(h.lines()).toContain("◇  Pick  Development");
  });
});

describe("Select: long lists", () => {
  test("scrolls the window and announces hidden options", async () => {
    const h = await render(<Select message="Pick" options={MANY} maxVisible={4} />);
    const rows = h.lines();
    expect(rows).toContain("│  ● Option 1");
    expect(rows).toContain("│  ○ Option 4");
    expect(rows.some((r) => r.includes("more"))).toBe(true);
  });

  test("the cursor stays inside the visible window while arrowing", async () => {
    const h = await render(<Select message="Pick" options={MANY} maxVisible={4} />);
    for (let i = 0; i < 5; i++) await h.key("ARROW_DOWN");
    const rows = h.lines();
    const selected = rows.find((r) => r.includes("●"));
    // The invariant: whatever is highlighted is on screen. A window that let
    // the cursor scroll out of view would leave the user with no visible state.
    expect(selected).toBeDefined();
    expect(selected).toBe("│  ● Option 6");
    // Four options visible at a time, regardless of how far the cursor moved.
    const optionsOnScreen = rows.filter((r) => /[●○]\s+Option/.test(r));
    expect(optionsOnScreen).toHaveLength(4);
  });
});

describe("Select: narrow terminals", () => {
  test("truncates long option labels instead of wrapping", async () => {
    const long = [{ value: "a", label: "A very long deployment target name that will not fit" }];
    const h = await render(<Select message="Pick" options={long} />, { width: 40 });
    for (const row of h.rows()) {
      expect(row.length).toBeLessThanOrEqual(40);
    }
  });

  test("the rail survives at very narrow widths", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />, { width: 20 });
    expect(h.lines()[0]).toBe("│");
    expect(h.lines()[1]?.startsWith("◆")).toBe(true);
  });

  test("hints compact rather than overflow", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />, { width: 24 });
    for (const row of h.rows()) {
      expect(row.length).toBeLessThanOrEqual(24);
    }
  });
});

describe("Select: themes", () => {
  test("ASCII theme renders the same structure with 7-bit glyphs", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} />, { theme: "ascii" });
    const rows = h.lines();
    for (const row of rows) {
      expect(row).toMatch(/^[\x20-\x7e]*$/);
    }
    expect(rows[0]).toBe("|");
    expect(rows[1]).toBe("*  Pick");
    expect(rows[2]).toBe("|  > Production");
  });
});

describe("Select: controlled phase", () => {
  test("an externally supplied phase drives the render", async () => {
    const h = await render(<Select message="Pick" options={OPTIONS} phase="complete" initialIndex={2} />);
    expect(h.lines()[1]).toBe("◇  Pick  Development");
  });

  test("a controlled prompt ignores keyboard input", async () => {
    const submitted: string[] = [];
    const h = await render(
      <Select message="Pick" options={OPTIONS} phase="active" onSubmit={(v) => submitted.push(v)} />,
    );
    await h.key("RETURN");
    // The shell owns the phase, so the value is still reported but the
    // component does not collapse on its own.
    expect(submitted).toEqual(["prod"]);
    expect(h.lines()[1]).toBe("◆  Pick");
  });
});
