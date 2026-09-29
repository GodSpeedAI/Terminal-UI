import { Marker, Rail, RailRow, Status } from "../components/../primitives/rail.js";
import { Confirm } from "../components/confirm/confirm.js";
import {
  Cancel,
  Group,
  Intro,
  Log,
  MultiSelect,
  Note,
  Outro,
  PasswordInput,
  Progress,
  PromptGroup,
  Select,
  type SelectOption,
  Spinner,
  Stack,
  TaskList,
  type TaskProps,
  TextInput,
} from "../components/index.js";
import { Blank, Hint, Label, Muted, Separator } from "../primitives/index.js";
import type { CatalogEntry, Scenario, ScenarioGroup } from "./types.js";

/** Option set reused across the Select and MultiSelect scenarios. */
const ENVIRONMENTS: SelectOption<string>[] = [
  { value: "prod", label: "Production", hint: "live traffic" },
  { value: "stag", label: "Staging" },
  { value: "dev", label: "Development" },
  { value: "local", label: "Local only", disabled: true },
];

const FEATURES: SelectOption<string>[] = [
  { value: "ssr", label: "Server rendering" },
  { value: "edge", label: "Edge functions" },
  { value: "cache", label: "Incremental cache" },
  { value: "beta", label: "Beta features", hint: "unstable" },
];

const LONG_OPTIONS: SelectOption<string>[] = [
  { value: "a", label: "A region whose name is far too long to fit on one row" },
  { value: "b", label: "Short" },
];

const TASKS: TaskProps[] = [
  { message: "Resolve dependencies", state: "complete", suffix: "1.2s" },
  { message: "Compile sources", state: "complete", suffix: "4.8s" },
  { message: "Run test suite", state: "running", progress: 0.62 },
  { message: "Publish artifacts", state: "pending" },
];

function scenario(
  name: string,
  render: Scenario["render"],
  extra: Partial<Omit<Scenario, "name" | "render">> = {},
): Scenario {
  return { name, render, ...extra };
}

/* ------------------------------------------------------------------ */
/* Foundations                                                          */
/* ------------------------------------------------------------------ */

const foundations: CatalogEntry = {
  name: "Marker",
  category: "Foundations",
  summary: "A state glyph. The only way a component expresses state.",
  usage: `<Marker state="active" />`,
  groups: [
    {
      name: "Marker",
      scenarios: [
        scenario("marker-states", () => (
          <Stack>
            {(["active", "pending", "running", "complete", "error", "warning", "cancelled"] as const).map(
              (state) => (
                <RailRow key={state}>
                  <box flexDirection="row" width="100%" minWidth={0}>
                    <Marker state={state} />
                    <box flexDirection="column" flexGrow={1} minWidth={0} paddingLeft={2}>
                      <Label>{state}</Label>
                    </box>
                  </box>
                </RailRow>
              ),
            )}
          </Stack>
        )),
        scenario(
          "marker-selection",
          () => (
            <Stack>
              {(["selected", "unselected", "checked", "unchecked", "disabled"] as const).map((state) => (
                <RailRow key={state}>
                  <box flexDirection="row" width="100%" minWidth={0}>
                    <Marker state={state} />
                    <box flexDirection="column" flexGrow={1} minWidth={0} paddingLeft={2}>
                      <Label>{state}</Label>
                    </box>
                  </box>
                </RailRow>
              ))}
            </Stack>
          ),
          { tags: ["selection"] },
        ),
      ],
    },
    {
      name: "Status",
      scenarios: [
        scenario("status-severity", () => (
          <Stack>
            {(["info", "success", "warning", "error", "cancelled", "muted"] as const).map((state) => (
              <RailRow key={state}>
                <Status state={state} />
                <Muted maxWidth={0}>{""}</Muted>
                <Label>{state}</Label>
              </RailRow>
            ))}
          </Stack>
        )),
      ],
    },
    {
      name: "Rail",
      scenarios: [
        scenario("rail-block", () => (
          <box flexDirection="column">
            <Rail variant="start" />
            <RailRow>
              <Label>content on the rail</Label>
            </RailRow>
            <RailRow>
              <Label>more content</Label>
            </RailRow>
            <Rail variant="end" />
          </box>
        )),
      ],
    },
    {
      name: "Hint",
      scenarios: [
        scenario("hint-full", () => (
          <RailRow>
            <Hint
              hints={[
                { key: "↑/↓", description: "navigate", format: "space" },
                { key: "Enter", description: "confirm" },
                { key: "Esc", description: "cancel" },
              ]}
            />
          </RailRow>
        )),
        scenario("hint-compact", () => (
          <RailRow>
            <Hint
              availableWidth={20}
              hints={[
                { key: "↑/↓", description: "navigate", format: "space" },
                { key: "Enter", description: "confirm" },
                { key: "Esc", description: "cancel" },
              ]}
            />
          </RailRow>
        )),
      ],
    },
    {
      name: "Separator",
      scenarios: [
        scenario("separator-rule", () => (
          <Stack>
            <RailRow>
              <Label>before</Label>
            </RailRow>
            <RailRow>
              <Separator width={30} />
            </RailRow>
            <RailRow>
              <Label>after</Label>
            </RailRow>
          </Stack>
        )),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Composition                                                          */
/* ------------------------------------------------------------------ */

const composition: CatalogEntry = {
  name: "Note",
  category: "Composition",
  summary: "A framed aside for free-form text.",
  usage: `<Note title="Heads up">Body text.</Note>`,
  groups: [
    {
      name: "Note",
      scenarios: [
        scenario("note-basic", () => (
          <Note title="Migration notes">Two lines of body text inside a frame.</Note>
        )),
        scenario("note-long", () => (
          <Note title="A considerably longer title for a note">
            This body is long enough that it must wrap onto several rows inside the frame, which is the
            behaviour the frame exists to contain.
          </Note>
        )),
      ],
    },
    {
      name: "Log",
      scenarios: [
        scenario("log-levels", () => (
          <Stack>
            <Log level="step" message="Checked out main" />
            <Log level="info" message="Listening on :3000" />
            <Log level="success" message="Build complete in 4.8s" />
            <Log level="warn" message="2 vulnerabilities found" />
            <Log level="error" message="Failed to write cache" />
          </Stack>
        )),
        scenario("log-duration", () => (
          <Stack>
            <Log level="info" message="Compiled" suffix="4.8s" />
            <Log level="success" message="Published" suffix="1.1s" />
          </Stack>
        )),
      ],
    },
    {
      name: "Intro / Outro",
      scenarios: [
        scenario("intro-outro", () => (
          <box flexDirection="column">
            <Intro title="create-app" />
            <Blank />
            <RailRow>
              <Label>doing work</Label>
            </RailRow>
            <Blank />
            <Outro title="done" />
          </box>
        )),
        scenario("cancelled-flow", () => (
          <box flexDirection="column">
            <Intro title="create-app" />
            <Blank />
            <RailRow>
              <Label>doing work</Label>
            </RailRow>
            <Blank />
            <Cancel title="cancelled" />
          </box>
        )),
      ],
    },
    {
      name: "PromptGroup",
      scenarios: [
        scenario("prompt-group", () => (
          <PromptGroup
            prompts={[
              { message: "Project name", answer: "demo-app" },
              { message: "Package manager", answer: "bun" },
              { message: "Use TypeScript?", answer: "Yes" },
            ]}
          />
        )),
        scenario("prompt-group-with-error", () => (
          <PromptGroup
            prompts={[
              { message: "Project name", answer: "ab" },
              { message: "Project name", answer: "demo-app", phase: "complete" },
            ]}
          />
        )),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */

const select: CatalogEntry = {
  name: "Select",
  category: "Input",
  summary: "A single-choice list with keyboard navigation.",
  usage: `<Select message="Choose environment" options={options} />`,
  keys: [
    { keys: "↑ ↓", action: "Move the cursor" },
    { keys: "Home End", action: "Jump to first / last" },
    { keys: "a-z", action: "Type-ahead to a matching option" },
    { keys: "Enter", action: "Confirm" },
    { keys: "Esc", action: "Cancel" },
  ],
  groups: [
    {
      name: "Select",
      scenarios: [
        scenario("select-default", () => <Select message="Choose environment" options={ENVIRONMENTS} />, {
          width: 60,
          tags: ["default"],
        }),
        scenario(
          "select-focused",
          () => <Select message="Choose environment" options={ENVIRONMENTS} initialIndex={1} />,
          { description: "Cursor on the second option." },
        ),
        scenario(
          "select-navigated",
          () => <Select message="Choose environment" options={ENVIRONMENTS} initialIndex={2} />,
          { description: "Cursor after two presses of ↓." },
        ),
        scenario(
          "select-submitted",
          () => (
            <Select message="Choose environment" options={ENVIRONMENTS} phase="complete" initialIndex={0} />
          ),
          { description: "Collapsed after confirming." },
        ),
        scenario(
          "select-error",
          () => (
            <Select
              message="Choose environment"
              options={ENVIRONMENTS}
              phase="error"
              error="Staging is frozen until the release finishes"
              initialIndex={0}
            />
          ),
          { description: "Validation error inside the rail grammar." },
        ),
        scenario("select-cancelled", () => (
          <Select message="Choose environment" options={ENVIRONMENTS} phase="cancelled" />
        )),
        scenario("select-disabled", () => (
          <Select message="Choose environment" options={ENVIRONMENTS} initialIndex={0} disabled />
        )),
        scenario("select-long-label", () => <Select message="Choose environment" options={LONG_OPTIONS} />, {
          width: 40,
        }),
        scenario(
          "select-many",
          () => (
            <Select
              message="Choose a region"
              maxVisible={5}
              options={Array.from({ length: 14 }, (_, i) => ({
                value: `r${i}`,
                label: `Region ${String(i + 1).padStart(2, "0")}`,
              }))}
              initialIndex={7}
            />
          ),
          { description: "Scrolling window with options above and below." },
        ),
        scenario(
          "select-narrow",
          () => (
            <Select message="Choose a deployment target for this release candidate" options={LONG_OPTIONS} />
          ),
          { width: 40, description: "Labels truncate and the hint compacts." },
        ),
        scenario("select-ascii", () => <Select message="Choose environment" options={ENVIRONMENTS} />, {
          theme: "ascii",
          description: "7-bit glyph set.",
        }),
        scenario(
          "select-high-contrast",
          () => <Select message="Choose environment" options={ENVIRONMENTS} />,
          { theme: "high-contrast", description: "No dim; bold active marker." },
        ),
      ],
    },
  ],
};

const textInput: CatalogEntry = {
  name: "TextInput",
  category: "Input",
  summary: "A single-line text field with an explicit cursor.",
  usage: `<TextInput message="Project name" placeholder="my-app" />`,
  keys: [
    { keys: "any", action: "Type" },
    { keys: "← →", action: "Move the caret" },
    { keys: "Home End", action: "Move to start / end" },
    { keys: "Backspace", action: "Delete backwards" },
    { keys: "Enter", action: "Submit" },
    { keys: "Esc", action: "Cancel" },
  ],
  groups: [
    {
      name: "TextInput",
      scenarios: [
        scenario("text-input-empty", () => <TextInput message="Project name" placeholder="my-app" />, {
          width: 60,
          tags: ["default"],
        }),
        scenario("text-input-editing", () => <TextInput message="Project name" value="demo-app" />, {
          description: "A committed value with the caret block after it.",
        }),
        scenario("text-input-no-placeholder", () => <TextInput message="Project name" />, {
          description: "Empty with no placeholder: only the caret block.",
        }),
        scenario("text-input-error", () => (
          <TextInput message="Project name" value="ab" phase="error" error="Must be at least 3 characters" />
        )),
        scenario("text-input-submitted", () => (
          <TextInput message="Project name" value="demo-app" phase="complete" />
        )),
        scenario("text-input-password", () => <PasswordInput message="Passphrase" value="hunter2hunter" />),
        scenario(
          "text-input-narrow",
          () => <TextInput message="Project name" value="a-very-long-project-name-here" />,
          { width: 40 },
        ),
        scenario("text-input-ascii", () => <TextInput message="Project name" value="demo" />, {
          theme: "ascii",
        }),
      ],
    },
  ],
};

const confirm: CatalogEntry = {
  name: "Confirm",
  category: "Input",
  summary: "A two-way choice with both answers visible.",
  usage: `<Confirm message="Proceed?" onSubmit={...} />`,
  keys: [
    { keys: "← →", action: "Choose yes / no" },
    { keys: "y n", action: "Choose directly" },
    { keys: "Enter", action: "Submit" },
    { keys: "Esc", action: "Cancel" },
  ],
  groups: [
    {
      name: "Confirm",
      scenarios: [
        scenario("confirm-yes", () => <Confirm message="Proceed with the migration?" />, {
          width: 60,
          tags: ["default"],
        }),
        scenario("confirm-no", () => <Confirm message="Proceed with the migration?" initialValue={false} />),
        scenario("confirm-labels", () => (
          <Confirm message="Overwrite?" labels={{ yes: "Overwrite", no: "Keep existing" }} />
        )),
        scenario("confirm-submitted", () => (
          <Confirm message="Proceed with the migration?" phase="complete" />
        )),
        scenario("confirm-cancelled", () => (
          <Confirm message="Proceed with the migration?" phase="cancelled" />
        )),
        scenario("confirm-ascii", () => <Confirm message="Proceed?" />, { theme: "ascii" }),
      ],
    },
  ],
};

const multiSelect: CatalogEntry = {
  name: "MultiSelect",
  category: "Input",
  summary: "A multiple-choice list with an independent selection.",
  usage: `<MultiSelect message="Select features" options={features} />`,
  keys: [
    { keys: "↑ ↓", action: "Move the cursor" },
    { keys: "Space", action: "Toggle the highlighted option" },
    { keys: "Enter", action: "Submit the set" },
    { keys: "Esc", action: "Cancel" },
  ],
  groups: [
    {
      name: "MultiSelect",
      scenarios: [
        scenario("multiselect-default", () => <MultiSelect message="Select features" options={FEATURES} />, {
          width: 60,
          tags: ["default"],
        }),
        scenario(
          "multiselect-partial",
          () => <MultiSelect message="Select features" options={FEATURES} defaultValues={["ssr", "edge"]} />,
          { description: "Two options checked, cursor on a third." },
        ),
        scenario(
          "multiselect-cursor-on-checked",
          () => <MultiSelect message="Select features" options={FEATURES} defaultValues={["ssr"]} />,
          { description: "Cursor and selection on the same row." },
        ),
        scenario("multiselect-required-error", () => (
          <MultiSelect
            message="Select features"
            options={FEATURES}
            required
            phase="error"
            error="Select at least one option"
          />
        )),
        scenario("multiselect-submitted", () => (
          <MultiSelect
            message="Select features"
            options={FEATURES}
            defaultValues={["ssr", "beta"]}
            phase="complete"
          />
        )),
        scenario("multiselect-ascii", () => <MultiSelect message="Select features" options={FEATURES} />, {
          theme: "ascii",
        }),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Feedback                                                             */
/* ------------------------------------------------------------------ */

const feedback: CatalogEntry = {
  name: "Spinner",
  category: "Feedback",
  summary: "Indeterminate activity. Animation reads from an injectable clock.",
  usage: `<Spinner message="Resolving dependencies" />`,
  groups: [
    {
      name: "Spinner",
      scenarios: [
        scenario("spinner", () => <Spinner message="Resolving dependencies" />, {
          width: 60,
          tags: ["default"],
        }),
        scenario(
          "spinner-frame-1",
          () => <Spinner message="Resolving dependencies" frames={[{ char: "◐", width: 1 }]} />,
          {
            description: "A single pinned frame, for deterministic captures.",
          },
        ),
        scenario("spinner-ascii", () => <Spinner message="Resolving dependencies" />, { theme: "ascii" }),
      ],
    },
  ],
};

const progress: CatalogEntry = {
  name: "Progress",
  category: "Feedback",
  summary: "A determinate bar. A pure function of its value.",
  usage: `<Progress message="Building" value={0.5} />`,
  groups: [
    {
      name: "Progress",
      scenarios: [
        scenario("progress-0", () => <Progress message="Building" value={0} />, {
          width: 60,
          tags: ["default"],
        }),
        scenario("progress-50", () => <Progress message="Building" value={0.5} />),
        scenario("progress-100", () => <Progress message="Building" value={1} tone="success" />),
        scenario("progress-error", () => <Progress message="Building" value={0.42} tone="error" />),
        scenario("progress-narrow", () => <Progress message="Building" value={0.5} width={16} />, {
          width: 40,
        }),
        scenario("progress-ascii", () => <Progress message="Building" value={0.5} />, { theme: "ascii" }),
      ],
    },
  ],
};

const tasks: CatalogEntry = {
  name: "TaskList",
  category: "Feedback",
  summary: "A pure list of task rows. Owns no lifecycle.",
  usage: `<TaskList tasks={tasks} summary="2/4 done" />`,
  groups: [
    {
      name: "TaskList",
      scenarios: [
        scenario(
          "task-pending",
          () => <TaskList tasks={[{ message: "Resolve dependencies", state: "pending" }]} />,
          { width: 60, tags: ["default"] },
        ),
        scenario("task-running", () => (
          <TaskList tasks={[{ message: "Resolve dependencies", state: "running", progress: 0.4 }]} />
        )),
        scenario("task-completed", () => (
          <TaskList tasks={[{ message: "Resolve dependencies", state: "complete", suffix: "1.2s" }]} />
        )),
        scenario("task-failed", () => (
          <TaskList tasks={[{ message: "Resolve dependencies", state: "error", suffix: "exit 1" }]} />
        )),
        scenario("task-list-mixed", () => <TaskList tasks={TASKS} summary="2/4 done" />, {
          description: "Pending, running, and completed rows together.",
        }),
        scenario("task-list-nested", () => (
          <TaskList
            tasks={[
              { message: "Build", state: "complete" },
              { message: "Compile", state: "complete", depth: 1 },
              { message: "sources/a.ts", state: "complete", depth: 2 },
              { message: "sources/b.ts", state: "error", depth: 2, suffix: "exit 1" },
            ]}
          />
        )),
        scenario("task-group", () => <Group message="Building" tasks={TASKS} progress={0.62} />),
        scenario("task-group-error", () => (
          <Group
            message="Building"
            tasks={TASKS.map((t) => (t.state === "running" ? { ...t, state: "error" as const } : t))}
            error="Compilation failed"
          />
        )),
        scenario("task-ascii", () => <TaskList tasks={TASKS} />, { theme: "ascii" }),
      ],
    },
  ],
};

/** Every component the Workbench can browse, in sidebar order. */
export const catalog: readonly CatalogEntry[] = [
  foundations,
  composition,
  select,
  textInput,
  confirm,
  multiSelect,
  feedback,
  progress,
  tasks,
];

/** Every category name, in display order. */
export const categories: readonly string[] = (() => {
  const seen: string[] = [];
  for (const entry of catalog) {
    if (!seen.includes(entry.category)) seen.push(entry.category);
  }
  return seen;
})();

/** Flat list of every component across every category. */
export function allComponents(): CatalogEntry[] {
  return categories.flatMap((category) => catalog.filter((e) => e.category === category));
}

export type { CatalogEntry, Scenario, ScenarioGroup };
