import { describe, expect, test } from "bun:test";
import { Autocomplete, type AutocompleteOption } from "../../src/components/autocomplete/autocomplete.js";
import { render } from "../harness.js";

const OPTIONS: AutocompleteOption<string>[] = [
  { value: "build", label: "Build project" },
  { value: "test", label: "Run tests" },
  { value: "lint", label: "Lint sources", hint: "strict" },
  { value: "deploy", label: "Deploy to production" },
];

const WITH_DISABLED: AutocompleteOption<string>[] = [
  { value: "build", label: "Build project" },
  { value: "preview", label: "Preview build", disabled: true },
  { value: "deploy", label: "Deploy to production" },
];

const MANY: AutocompleteOption<number>[] = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: `Option ${i + 1}`,
}));

describe("Autocomplete: active", () => {
  test("renders the reference rail grammar", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    expect(h.lines()).toEqual([
      "│",
      "◆  Choose a command",
      "│  ● Build project",
      "│  ○ Run tests",
      "│  ○ Lint sources (strict)",
      "│  ○ Deploy to production",
      "│  ↑/↓ navigate • Enter: confirm",
    ]);
  });

  test("typing filters by case-insensitive substring", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    await h.type("PR");
    expect(h.lines()).toEqual([
      "│",
      "◆  Choose a command",
      "│  ● Build project",
      "│  ○ Deploy to production",
      "│  ↑/↓ navigate • Enter: confirm",
    ]);
  });

  test("a new filter restarts the highlight at the first match", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    await h.key("ARROW_DOWN");
    await h.key("ARROW_DOWN");
    expect(h.lines()[4]).toBe("│  ● Lint sources (strict)");
    await h.type("pro");
    // "pro" matches Build project and Deploy to production; the highlight is
    // back on the first match, not carried over from the previous filter.
    expect(h.lines()[2]).toBe("│  ● Build project");
  });

  test("arrows move over the matches and wrap at both ends", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    await h.type("pr");
    await h.key("ARROW_DOWN");
    expect(h.lines()[2]).toBe("│  ○ Build project");
    expect(h.lines()[3]).toBe("│  ● Deploy to production");
    // Two matches: a second down wraps back to the first.
    await h.key("ARROW_DOWN");
    expect(h.lines()[2]).toBe("│  ● Build project");
    // And up from the first wraps to the last.
    await h.key("ARROW_UP");
    expect(h.lines()[3]).toBe("│  ● Deploy to production");
  });

  test("Home and End jump to the first and last match", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    await h.key("END");
    expect(h.lines()[5]).toBe("│  ● Deploy to production");
    await h.key("HOME");
    expect(h.lines()[2]).toBe("│  ● Build project");
  });

  test("backspace deletes the last character of the filter", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    await h.type("projx");
    expect(h.lines()[2]).toBe("│  no matches");
    await h.key("BACKSPACE");
    expect(h.lines()[2]).toBe("│  ● Build project");
  });
});

describe("Autocomplete: submit", () => {
  test("Enter accepts the highlighted match and collapses the prompt", async () => {
    const submitted: Array<string | number> = [];
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        onSubmit={(v) => submitted.push(v as string | number)}
      />,
    );
    await h.type("pr");
    await h.key("ARROW_DOWN");
    await h.key("RETURN");

    // The matched option's value, not the filter text.
    expect(submitted).toEqual(["deploy"]);
    expect(h.lines()).toEqual(["│", "◇  Choose a command  Deploy to production"]);
  });

  test("Enter with no matches submits the raw typed text", async () => {
    const submitted: Array<string | number> = [];
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        onSubmit={(v) => submitted.push(v as string | number)}
      />,
    );
    await h.type("zzz");
    expect(h.lines()[2]).toBe("│  no matches");
    await h.key("RETURN");

    expect(submitted).toEqual(["zzz"]);
    expect(h.lines()).toEqual(["│", "◇  Choose a command  zzz"]);
  });

  test("a rejected submit shows the message inside the rail grammar and stays open", async () => {
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        validate={(v) => (v === "deploy" ? "Production is frozen" : null)}
      />,
    );
    await h.type("pr");
    await h.key("ARROW_DOWN");
    await h.key("RETURN");

    const rows = h.lines();
    expect(rows[rows.length - 2]).toContain("Production is frozen");
    // The error uses the error marker, and the prompt is still open.
    expect(rows.some((r) => r.includes("■"))).toBe(true);
    expect(rows).toContain("│  ● Deploy to production");
  });

  test("a rejected submit does not call onSubmit", async () => {
    const submitted: Array<string | number> = [];
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        onSubmit={(v) => submitted.push(v as string | number)}
        validate={() => "nope"}
      />,
    );
    await h.type("pr");
    await h.key("RETURN");
    expect(submitted).toEqual([]);
  });

  test("correcting the choice after an error submits successfully", async () => {
    const submitted: Array<string | number> = [];
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        onSubmit={(v) => submitted.push(v as string | number)}
        validate={(v) => (v === "deploy" ? "Production is frozen" : null)}
      />,
    );
    await h.type("pr");
    await h.key("ARROW_DOWN");
    await h.key("RETURN");
    expect(submitted).toEqual([]);
    await h.key("ARROW_UP");
    await h.key("RETURN");
    expect(submitted).toEqual(["build"]);
    expect(h.lines()).toContain("◇  Choose a command  Build project");
  });

  test("Escape cancels and collapses", async () => {
    let cancelled = false;
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        onCancel={() => {
          cancelled = true;
        }}
      />,
    );
    await h.escape();
    expect(cancelled).toBe(true);
    // Cancellation collapses to the cancelled marker, not the complete one.
    expect(h.lines()).toEqual(["│", "■  Choose a command  cancelled"]);
  });

  test("Ctrl+C cancels", async () => {
    let cancelled = false;
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        onCancel={() => {
          cancelled = true;
        }}
      />,
    );
    await h.pressWith({ ctrl: true }, "c");
    expect(cancelled).toBe(true);
  });

  test("a resolved prompt ignores further key presses", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />);
    await h.key("RETURN");
    const before = h.frame();
    await h.key("ARROW_DOWN");
    await h.type("x");
    expect(h.frame()).toBe(before);
  });
});

describe("Autocomplete: options", () => {
  test("disabled options are excluded from the filtered list entirely", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={WITH_DISABLED} />);
    // Not rendered even in the unfiltered list.
    expect(h.lines()).toEqual([
      "│",
      "◆  Choose a command",
      "│  ● Build project",
      "│  ○ Deploy to production",
      "│  ↑/↓ navigate • Enter: confirm",
    ]);
    // Navigation moves straight from the first to the second enabled option.
    await h.key("ARROW_DOWN");
    expect(h.lines()[3]).toBe("│  ● Deploy to production");
    // A filter only the disabled option would match produces no matches.
    await h.type("prev");
    expect(h.lines().slice(0, 3)).toEqual(["│", "◆  Choose a command", "│  no matches"]);
  });

  test("a disabled option's value can never be accepted", async () => {
    const submitted: string[] = [];
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={WITH_DISABLED}
        onSubmit={(v) => submitted.push(v as string)}
      />,
    );
    await h.type("prev");
    await h.key("RETURN");
    // With no enabled match, the raw text is submitted — never the disabled
    // option's value.
    expect(submitted).toEqual(["prev"]);
  });
});

describe("Autocomplete: scrolling", () => {
  test("scrolls the window and announces hidden matches", async () => {
    const h = await render(<Autocomplete message="Pick" options={MANY} maxVisible={4} />);
    const rows = h.lines();
    expect(rows).toContain("│  ● Option 1");
    expect(rows).toContain("│  ○ Option 4");
    expect(rows.some((r) => r.includes("↓ 8 more"))).toBe(true);
  });

  test("filtering shrinks the window", async () => {
    const h = await render(<Autocomplete message="Pick" options={MANY} maxVisible={4} />);
    await h.type("1");
    const rows = h.lines();
    // Option 1, 10, 11, 12 match; the window fits them all and the scroll
    // hint disappears.
    expect(rows).toContain("│  ● Option 1");
    expect(rows).toContain("│  ○ Option 12");
    expect(rows.some((r) => r.includes("more"))).toBe(false);
  });
});

describe("Autocomplete: narrow terminals", () => {
  test("truncates long labels instead of wrapping", async () => {
    const h = await render(<Autocomplete message="Choose a command" options={OPTIONS} />, { width: 24 });
    for (const row of h.rows()) {
      expect(row.length).toBeLessThanOrEqual(24);
    }
    expect(h.rows().some((r) => r.includes("Deploy to producti…"))).toBe(true);
  });

  test("the rail survives at very narrow widths", async () => {
    const h = await render(<Autocomplete message="Pick" options={OPTIONS} />, { width: 20 });
    expect(h.lines()[0]).toBe("│");
    expect(h.lines()[1]?.startsWith("◆")).toBe(true);
  });
});

describe("Autocomplete: controlled phase", () => {
  test("an externally supplied phase drives the collapse", async () => {
    const complete = await render(
      <Autocomplete message="Choose a command" options={OPTIONS} phase="complete" />,
    );
    expect(complete.lines()[1]).toBe("◇  Choose a command  Build project");
    const cancelled = await render(
      <Autocomplete message="Choose a command" options={OPTIONS} phase="cancelled" />,
    );
    expect(cancelled.lines()[1]).toBe("■  Choose a command  cancelled");
  });

  test("a controlled prompt ignores keyboard input", async () => {
    const submitted: string[] = [];
    const h = await render(
      <Autocomplete
        message="Choose a command"
        options={OPTIONS}
        phase="active"
        onSubmit={(v) => submitted.push(v as string)}
      />,
    );
    await h.key("RETURN");
    // The shell owns the phase, so the value is still reported but the
    // component does not collapse on its own.
    expect(submitted).toEqual(["build"]);
    expect(h.lines()[1]).toBe("◆  Choose a command");
  });
});
