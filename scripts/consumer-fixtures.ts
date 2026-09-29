/**
 * Per-item consumer fixtures.
 *
 * Each entry is a *realistic consumer*: the imports a person would actually
 * write after `shadcn add <item>`, and the exact characters the reference
 * grammar says the result should contain. Verifying only `select` would leave
 * every other item's public surface untested — and a registry entry with a
 * wrong export is precisely the kind of break this suite exists to catch.
 */

export interface ConsumerFixture {
  /** Import statements, as the consumer writes them. */
  imports: string[];
  /** JSX body of the consumer's app component. */
  body: string;
  /** Exact non-blank lines the render must produce. */
  expect: string[];
  /** Theme wrapper, if the consumer needs one. Defaults to none. */
  wrap?: "clack" | "ascii" | "high-contrast";
  /** Declarations the consumer needs, emitted above the app component. */
  extra?: string;
}

/** A select option list reused across the choice-based fixtures. */
const OPTIONS = `const options: SelectOption<string>[] = [
  { value: "prod", label: "Production" },
  { value: "stag", label: "Staging" },
];`;

/** The same list, typed for `MultiSelect`, which names its own option type. */
const MULTI_OPTIONS = `const options: MultiSelectOption<string>[] = [
  { value: "prod", label: "Production" },
  { value: "stag", label: "Staging" },
];`;

/** The same list, typed for `Autocomplete`, which names its own option type. */
const AUTOCOMPLETE_OPTIONS = `const options: AutocompleteOption<string>[] = [
  { value: "build", label: "Build project" },
  { value: "stag", label: "Staging" },
];`;

export const CONSUMERS: Record<string, ConsumerFixture> = {
  select: {
    imports: [
      `import { Select, type SelectOption } from "@/terminal-ui/components/select/select.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<Select message="Choose environment" options={options} />`,
    expect: [
      "│",
      "◆  Choose environment",
      "│  ● Production",
      "│  ○ Staging",
      "│  ↑/↓ navigate • Enter: confirm",
    ],
    extra: OPTIONS,
  },

  autocomplete: {
    imports: [
      `import { Autocomplete, type AutocompleteOption } from "@/terminal-ui/components/autocomplete/autocomplete.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<Autocomplete message="Choose a command" options={options} />`,
    extra: AUTOCOMPLETE_OPTIONS,
    expect: [
      "│",
      "◆  Choose a command",
      "│  ● Build project",
      "│  ○ Staging",
      "│  ↑/↓ navigate • Enter: confirm",
    ],
  },

  multiselect: {
    imports: [
      `import { MultiSelect, type MultiSelectOption } from "@/terminal-ui/components/multiselect/multiselect.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<MultiSelect message="Select features" options={options} />`,
    extra: MULTI_OPTIONS,
    expect: [
      "│",
      "◆  Select features",
      "│  ● Production",
      "│  ◻ Staging",
      "│  ↑/↓ navigate • Space: toggle • Enter: confirm",
    ],
  },

  "text-input": {
    imports: [
      `import { TextInput } from "@/terminal-ui/components/input/text-input.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<TextInput message="Project name" placeholder="my-app" />`,
    expect: ["│", "◆  Project name", "│  my-app", "│  Enter: submit"],
  },

  confirm: {
    imports: [
      `import { Confirm } from "@/terminal-ui/components/confirm/confirm.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<Confirm message="Proceed?" />`,
    expect: ["│", "◆  Proceed?", "● Yes / ○ No", "│  ←/→ select • Enter: confirm"],
  },

  prompt: {
    imports: [
      `import { Prompt } from "@/terminal-ui/components/prompt/prompt.js"`,
      `import { Label } from "@/terminal-ui/primitives/label.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<Prompt message="A bare shell" phase="complete" summary={<Label value>done</Label>} />`,
    expect: ["│", "◇  A bare shell  done"],
  },

  note: {
    imports: [
      `import { Note } from "@/terminal-ui/components/composition/note.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<Note title="Notes">body</Note>`,
    expect: ["◇  Notes ──╮", "│  │ body  │", "├  ────────╯"],
  },

  composition: {
    imports: [
      `import { Log, Intro, Outro } from "@/terminal-ui/components/composition/composition.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<box flexDirection="column"><Intro title="start" /><Log level="info" message="hello" /><Outro title="done" /></box>`,
    expect: ["┌  start", "│  ●  hello", "└  done"],
  },

  feedback: {
    imports: [
      `import { Spinner, Progress } from "@/terminal-ui/components/feedback/feedback.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<box flexDirection="column"><Progress message="Building" value={0.5} width={10} /><Spinner message="Working" frames={[{ char: "◒", width: 1 }]} /></box>`,
    expect: ["│  ◆  Building █████░░░░░ 50%", "│  ◒  Working"],
  },

  task: {
    imports: [
      `import { TaskList } from "@/terminal-ui/components/task/task.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<TaskList tasks={[{ message: "Compile", state: "complete" }, { message: "Test", state: "pending" }]} />`,
    expect: ["│  ◇  Compile", "│  ◇  Test"],
  },

  theme: {
    imports: [
      `import { ThemeProvider, clackTheme, asciiTheme, highContrastTheme, nextPromptPhase } from "@/terminal-ui/theme/index.js"`,
    ],
    body: `null`,
    expect: [],
    // Theme has no visual surface of its own; it is verified by the component
    // fixtures above, which is where a theme actually has to be right.
    extra: `export const probes = {
  names: [clackTheme.name, asciiTheme.name, highContrastTheme.name],
  rail: clackTheme.rail.bar.char,
  complete: clackTheme.markers.complete.char,
  transition: nextPromptPhase("active", "submit"),
};`,
  },

  utils: {
    imports: [
      `import { stringWidth, truncateToWidth, wrapToWidth } from "@/terminal-ui/utils/text.js"`,
      `import { chunk, paint } from "@/terminal-ui/utils/style.js"`,
    ],
    body: `null`,
    expect: [],
    extra: `export const probes = {
  width: stringWidth("日本"),
  truncated: truncateToWidth("abcdefgh", 5),
  wrapped: wrapToWidth("one two three", 7),
  painted: paint("x", { color: "cyan" }).chunks.length,
};`,
  },

  primitives: {
    imports: [
      `import { Marker, Rail, RailRow, Status } from "@/terminal-ui/primitives/rail.js"`,
      `import { Hint, Label } from "@/terminal-ui/primitives/label.js"`,
      `import { ThemeProvider } from "@/terminal-ui/theme/index.js"`,
    ],
    wrap: "clack",
    body: `<RailRow><Marker state="active" /></RailRow>`,
    expect: ["│  ◆"],
  },

  hooks: {
    imports: [
      `import { usePromptState } from "./hooks.js"`,
      `import { nextPromptPhase } from "@/terminal-ui/theme/state.js"`,
      `import { isPrintable, normalizeKey } from "@/terminal-ui/hooks/use-prompt-keys.js"`,
      `import { submitHint } from "@/terminal-ui/hooks/hints.js"`,
    ],
    body: `null`,
    expect: [],
    extra: `export function useHarness() {
  return usePromptState();
}

export const probes = {
  transition: nextPromptPhase("active", "submit"),
  illegal: nextPromptPhase("complete", "submit"),
  printable: isPrintable(normalizeKey({ name: "d", sequence: "d", ctrl: false, meta: false, shift: false } as never)),
  hint: submitHint({ keys: { enter: "Enter" } } as never),
};`,
  },
};

/** Hooks are not an index-backed item; add one so the fixture can import them. */
export const HOOK_INDEX = `export * from "./use-prompt-keys.js";
export * from "./use-prompt-state.js";
export * from "./hints.js";
export * from "./use-available-width.js";
`;

export { OPTIONS };
