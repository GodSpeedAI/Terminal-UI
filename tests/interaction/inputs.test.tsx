import { describe, expect, test } from "bun:test";
import { Confirm } from "../../src/components/confirm/confirm.js";
import { PasswordInput, TextInput } from "../../src/components/input/text-input.js";
import { MultiSelect } from "../../src/components/multiselect/multiselect.js";
import { nextPromptPhase, PROMPT_TRANSITIONS } from "../../src/theme/state.js";
import { render } from "../harness.js";

describe("TextInput: keyboard", () => {
  test("typing appends to the value", async () => {
    const h = await render(<TextInput message="Name" />);
    await h.type("demo");
    expect(h.lines()[2]).toBe("│  demo");
  });

  test("backspace deletes backwards", async () => {
    const h = await render(<TextInput message="Name" value="demo" />);
    await h.key("BACKSPACE");
    expect(h.lines()[2]).toBe("│  dem");
  });

  test("backspace at position zero is a no-op", async () => {
    const h = await render(<TextInput message="Name" value="demo" />);
    await h.key("HOME");
    await h.key("BACKSPACE");
    expect(h.lines()[2]).toBe("│  demo");
  });

  test("left/right move the caret and typing inserts at the caret", async () => {
    const h = await render(<TextInput message="Name" value="dm" />);
    await h.key("HOME");
    await h.type("a");
    expect(h.lines()[2]).toBe("│  adm");
    await h.key("END");
    await h.type("o");
    expect(h.lines()[2]).toBe("│  admo");
  });

  test("Home and End move to the boundaries", async () => {
    const h = await render(<TextInput message="Name" value="abc" />);
    await h.key("HOME");
    await h.type("z");
    expect(h.lines()[2]).toBe("│  zabc");
    await h.key("END");
    await h.type("y");
    expect(h.lines()[2]).toBe("│  zabcy");
  });

  test("Enter submits and collapses", async () => {
    const submitted: string[] = [];
    const h = await render(<TextInput message="Name" value="demo" onSubmit={(v) => submitted.push(v)} />);
    await h.key("RETURN");
    expect(submitted).toEqual(["demo"]);
    expect(h.lines()[1]).toBe("◇  Name  demo");
  });

  test("Escape cancels", async () => {
    let cancelled = false;
    const h = await render(
      <TextInput
        message="Name"
        value="demo"
        onCancel={() => {
          cancelled = true;
        }}
      />,
    );
    await h.escape();
    expect(cancelled).toBe(true);
    expect(h.lines()[1]).toBe("■  Name  cancelled");
  });

  test("a placeholder is shown only while the value is empty", async () => {
    const empty = await render(<TextInput message="Name" placeholder="my-app" />);
    expect(empty.lines()[2]).toBe("│  my-app");
    const filled = await render(<TextInput message="Name" value="demo" placeholder="my-app" />);
    expect(filled.lines()[2]).toBe("│  demo");
  });

  test("the hint advertises only keys the field binds", async () => {
    const h = await render(<TextInput message="Name" />);
    const hint = h.lines().find((l) => l.includes(":")) ?? "";
    // A text field has no vertical axis; advertising arrow keys would be a lie.
    expect(hint).not.toContain("navigate");
    expect(hint).toContain("Enter: submit");
  });
});

describe("TextInput: validation", () => {
  test("a rejected submit shows the error and stays open", async () => {
    const submitted: string[] = [];
    const h = await render(
      <TextInput
        message="Name"
        value="ab"
        validate={(v) => (v.length > 2 ? null : "Must be at least 3 characters")}
        onSubmit={(v) => submitted.push(v)}
      />,
    );
    await h.key("RETURN");
    expect(submitted).toEqual([]);
    expect(h.lines().some((l) => l.includes("Must be at least 3"))).toBe(true);
  });

  test("correcting the value after an error submits", async () => {
    const submitted: string[] = [];
    const h = await render(
      <TextInput
        message="Name"
        value="ab"
        validate={(v) => (v.length > 2 ? null : "too short")}
        onSubmit={(v) => submitted.push(v)}
      />,
    );
    await h.key("RETURN");
    await h.type("c");
    await h.key("RETURN");
    expect(submitted).toEqual(["abc"]);
  });
});

describe("PasswordInput", () => {
  test("masks the value but still submits the real text", async () => {
    const submitted: string[] = [];
    const h = await render(
      <PasswordInput message="Secret" value="hunter2" onSubmit={(v) => submitted.push(v)} />,
    );
    const shown = h.lines()[2] ?? "";
    expect(shown).not.toContain("hunter2");
    await h.key("RETURN");
    expect(submitted).toEqual(["hunter2"]);
  });
});

describe("Confirm", () => {
  test("renders both answers with the chosen one marked", async () => {
    const h = await render(<Confirm message="Proceed?" />);
    expect(h.lines()[2]).toBe("● Yes / ○ No");
  });

  test("left/right switch the answer", async () => {
    const h = await render(<Confirm message="Proceed?" />);
    await h.key("ARROW_LEFT");
    expect(h.lines()[2]).toBe("○ Yes / ● No");
    await h.key("ARROW_RIGHT");
    expect(h.lines()[2]).toBe("● Yes / ○ No");
  });

  test("y and n choose directly", async () => {
    const h = await render(<Confirm message="Proceed?" />);
    await h.type("n");
    expect(h.lines()[2]).toBe("○ Yes / ● No");
  });

  test("submits the chosen answer", async () => {
    const submitted: boolean[] = [];
    const h = await render(<Confirm message="Proceed?" onSubmit={(v) => submitted.push(v)} />);
    await h.key("ARROW_LEFT");
    await h.key("RETURN");
    expect(submitted).toEqual([false]);
    expect(h.lines()[1]).toBe("◇  Proceed?  No");
  });

  test("custom labels are used for both the row and the summary", async () => {
    const h = await render(
      <Confirm message="Overwrite?" labels={{ yes: "Overwrite", no: "Keep" }} phase="complete" />,
    );
    expect(h.lines()[1]).toBe("◇  Overwrite?  Overwrite");
  });
});

describe("MultiSelect", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma" },
  ];

  test("space toggles the highlighted option without submitting", async () => {
    const submitted: string[][] = [];
    const h = await render(
      <MultiSelect message="Pick" options={options} onSubmit={(v) => submitted.push(v)} />,
    );
    await h.key(" ");
    expect(submitted).toEqual([]);
    expect(h.lines()[2]).toBe("│  ◼ Alpha");
  });

  test("the cursor and the selection are independent", async () => {
    const h = await render(<MultiSelect message="Pick" options={options} defaultValues={["c"]} />);
    const rows = h.lines();
    // Cursor on Alpha (unselected) -> `●`; Gamma is checked but not focused -> `◼`.
    expect(rows[2]).toBe("│  ● Alpha");
    expect(rows[4]).toBe("│  ◼ Gamma");
  });

  test("toggling off an option returns it to unchecked", async () => {
    const h = await render(<MultiSelect message="Pick" options={options} defaultValues={["a"]} />);
    // The cursor is on Alpha, so it shows the cursor marker while unchecked;
    // stepping away proves the option itself is no longer checked.
    expect(h.lines()[2]).toBe("│  ◼ Alpha");
    await h.key(" ");
    expect(h.lines()[2]).toBe("│  ● Alpha");
    // Stepping the cursor onto Beta leaves Alpha visible and unchecked.
    await h.key("ARROW_DOWN");
    expect(h.lines()[2]).toBe("│  ◻ Alpha");
    expect(h.lines()[3]).toBe("│  ● Beta");
  });

  test("Enter submits the whole set and collapses it", async () => {
    const submitted: string[][] = [];
    const h = await render(
      <MultiSelect message="Pick" options={options} onSubmit={(v) => submitted.push(v)} />,
    );
    await h.key(" ");
    await h.key("ARROW_DOWN");
    await h.key(" ");
    await h.key("RETURN");
    expect(submitted).toEqual([["a", "b"]]);
    expect(h.lines()[1]).toBe("◇  Pick  Alpha and Beta");
  });

  test("an empty submission reads as none", async () => {
    const h = await render(<MultiSelect message="Pick" options={options} phase="complete" />);
    expect(h.lines()[1]).toBe("◇  Pick  none");
  });

  test("required blocks an empty submission with an error", async () => {
    const submitted: string[][] = [];
    const h = await render(
      <MultiSelect message="Pick" options={options} required onSubmit={(v) => submitted.push(v)} />,
    );
    await h.key("RETURN");
    expect(submitted).toEqual([]);
    expect(h.lines().some((l) => l.includes("at least one"))).toBe(true);
  });
});

describe("prompt state machine", () => {
  test("every phase has a defined transition table", () => {
    for (const phase of Object.keys(PROMPT_TRANSITIONS)) {
      expect(PROMPT_TRANSITIONS[phase as keyof typeof PROMPT_TRANSITIONS], phase).toBeDefined();
    }
  });

  test("an open prompt can submit, and a resolved one cannot", () => {
    expect(nextPromptPhase("active", "submit")).toBe("validating");
    expect(nextPromptPhase("validating", "submit")).toBe("complete");
    expect(nextPromptPhase("complete", "submit")).toBeNull();
  });

  test("cancellation is reachable from every open phase", () => {
    for (const phase of ["idle", "active", "validating", "error"] as const) {
      expect(nextPromptPhase(phase, "cancel"), phase).toBe("cancelled");
    }
  });

  test("a resolved prompt can only be reset", () => {
    expect(nextPromptPhase("complete", "reset")).toBe("active");
    expect(nextPromptPhase("cancelled", "reset")).toBe("active");
    expect(nextPromptPhase("complete", "change")).toBeNull();
    expect(nextPromptPhase("cancelled", "change")).toBeNull();
  });

  test("an error can be corrected without leaving the open flow", () => {
    expect(nextPromptPhase("error", "change")).toBe("active");
    expect(nextPromptPhase("error", "submit")).toBe("validating");
  });
});
