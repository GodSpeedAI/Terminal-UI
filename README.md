# terminal-ui

A Clack-inspired component library for **OpenTUI React**, with a native
component Workbench, deterministic visual tests, and shadcn-compatible source
distribution.

The visual grammar is Clack's: a vertical rail, semantic markers, restrained
colour, and prompts that collapse into their own transcript. The implementation
is original, and every glyph and colour was re-specified in terms this library
owns — see [docs/visual-language.md](docs/visual-language.md).

```text
│
◆  Choose environment
│  ● Production
│  ○ Staging
│  ○ Development
│
◇  Choose environment  Production
```

Clack is a **visual reference, not a dependency**. Nothing here imports it.

## Requirements

- [Bun](https://bun.sh) 1.4+
- `@opentui/react` and `@opentui/core` 0.5+
- React 19.2+

The components render through OpenTUI. There is no DOM or browser dependency
anywhere in the library or the Workbench.

## Quick start

```bash
bun install
bun run workbench
```

## The Workbench

`bun run workbench` opens a native OpenTUI explorer. It runs in the same
renderer and under the same key handling as a real application, and it renders
the **production components** straight from their scenario definitions — there
is no preview reimplementation that could drift from the real thing.

| Key | Action |
| --- | --- |
| `↑` `↓` | move in the focused list |
| `Tab` | cycle focus: component list → scenario list → live component |
| `←` `→` | step focus (wide terminals, lists only) |
| `Enter` | open the selected component |
| `/` | search components |
| `r` | restore the scenario's width and theme |
| `t` | cycle theme |
| `a` | toggle ASCII |
| `w` | cycle the simulated live width |
| `?` | help |
| `q` | quit |

It is responsive: two panes at 72 columns and up, a single-column navigation
stack below. The live pane is mounted in **both** layouts, and the component
under inspection renders at a *simulated* width — `w` cycles 40 through 160,
`r` puts back the scenario's own width and theme — so two states can be
compared at the same width regardless of the real terminal. `Tab` is the one
key that always belongs to the Workbench: while the live component has focus it
receives every other key untouched, so a typed `q` is a character and not a
quit. Hosts can intercept quitting with the `onQuit` prop; the default ends the
process.

## Package usage

```tsx
import { Prompt, Select, Spinner, ThemeProvider, type SelectOption } from "@terminal-ui/react";

const environments: SelectOption<string>[] = [
  { value: "prod", label: "Production", hint: "live traffic" },
  { value: "stag", label: "Staging" },
];

function App() {
  return (
    <ThemeProvider theme="clack">
      <Select message="Choose environment" options={environments} />
    </ThemeProvider>
  );
}
```

`Select` contributes only the list and the keyboard model. The rail, the
question, the hint row, error presentation, and the collapse all belong to
`Prompt`, which is why every control in the library looks and behaves the same
way around its edges.

## Source-copy usage

The registry is a first-class channel: you own the code.

```bash
bunx shadcn@latest add terminal-ui/terminal-ui/select
```

`select` pulls `prompt`, `hooks`, `primitives`, `utils`, and `theme`
transitively, and everything lands under `components/terminal-ui/` as editable
TypeScript. You never install this package to use one component.

```tsx
import { Select, type SelectOption } from "@/terminal-ui/components/select/select.js";
import { ThemeProvider } from "@/terminal-ui/theme/index.js";
```

There is **one implementation**. `registry.json` is generated from the source
tree by `bun run registry:build`, and `files[].path` points at the same files the
package and the Workbench import — so editing a source file changes all three
at once.

Details, including why every file shares one install root, are in
[docs/registry.md](docs/registry.md).

## Theming

Components express **state**, never styling:

```tsx
<Marker state="active" />
<Status state="error" />
```

The theme decides what a state looks like. Three ship:

| Theme | Glyphs | Notes |
| --- | --- | --- |
| `clackTheme` (default) | Unicode | the reference grammar |
| `asciiTheme` | 7-bit only | first-class, not a degraded mode |
| `highContrastTheme` | Unicode, no `dim` | for terminals where `dim` renders as normal |

State is carried by **glyph shape first**, colour second, so the grammar survives
`--color=never`, 8-colour terminals, and monochrome pipes.

```tsx
import { ThemeProvider, defineTheme, glyph } from "@terminal-ui/react";

const brandTheme = defineTheme({
  name: "brand",
  ...clackTheme,
  rail: { bar: glyph("┃", 1), start: glyph("┏", 1), end: glyph("┗", 1) },
  markerStyles: { ...clackTheme.markerStyles, active: { color: "magenta" } },
});
```

`defineTheme` completes a partial theme, so adding a state to the vocabulary
cannot break a third-party theme.

## Components

**Foundations** — `ThemeProvider`, `Rail`, `RailRow`, `Marker`, `Status`,
`Label`, `Muted`, `Hint`, `Separator`

**Composition** — `Prompt`, `StepLine`, `Note`, `Log`, `Intro`, `Outro`,
`Cancel`, `PromptGroup`, `Group`

**Input** — `TextInput`, `PasswordInput`, `Confirm`, `Select`, `MultiSelect`,
`Autocomplete`

**Feedback** — `Spinner`, `Progress`, `Task`, `TaskList`

**Hooks** — `usePromptState`, `usePromptKeys`, `navigateConfirmHints`,
`submitHint`, `toggleHint`, `useFrame`, `createManualClock`. The
width-resolution hooks (`useAvailableWidth`, `useBodyWidth`,
`SimulatedWidthProvider`) ship in the `hooks` registry item rather than the
package root: components take an `availableWidth` prop, and a host that needs
to simulate a terminal width — the Workbench does — provides the provider
itself.

## Keyboard semantics

Consistent across the library, and never globally hijacked:

| Key | Meaning |
| --- | --- |
| `↑` `↓` | move the cursor; wraps at both ends; skips disabled options |
| `←` `→` | move the caret, or switch a horizontal choice |
| `Home` `End` | jump to the first / last option |
| printable | type-ahead to a matching option, filter an `Autocomplete`, or text entry |
| `Space` | toggle the highlighted entry in a multi-select |
| `Enter` | confirm |
| `Esc` | cancel |
| `Ctrl+C` | cancel, routed explicitly so every control decides what it means |

Focus ownership is explicit: a prompt only claims keys while it is open, so
nested interactive components do not compete. A prompt advertises only the keys
it actually binds.

## Testing

```bash
bun test              # everything bun discovers: unit, interaction, the visual
                      # suite, and the generated clean-consumer fixture (208 tests)
bun run test          # unit + interaction only (134 tests)
bun run test:visual   # golden frames for every scenario (73 tests)
bun run typecheck
bun run lint
```

Everything renders through OpenTUI's test renderer. Nothing waits on wall time:
animation is driven by an injectable `FrameClock`, and tests pass a manual one.
Golden fixtures are committed as plain text, so a regression shows up as a diff
you can read.

Details in [docs/testing.md](docs/testing.md).

## Registry verification

```bash
bun run registry:validate    # real shadcn CLI + structural checks it cannot make
bun run consumer:verify:all  # install every item into a clean project and prove it works
```

The clean-consumer check creates a throwaway project with no dependency on this
repository, installs the item's transitive dependencies, rejects any file that
imports outside the installed tree, typechecks, and renders. Current status:
**14/14 items**.

A valid registry is not a working registry, so both are checked.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/visual-language.md](docs/visual-language.md) | glyphs, colors, spacing, state transitions — the design contract |
| [docs/architecture.md](docs/architecture.md) | the dependency rule, the state machine, focus ownership, extension path |
| [docs/registry.md](docs/registry.md) | source distribution, the generated manifest, clean-consumer verification |
| [docs/testing.md](docs/testing.md) | the harness, determinism, what each layer asserts |

## Contributing

1. Run the vertical slice before adding breadth: component → primitives → OpenTUI
   rendering → keyboard → Workbench scenario → visual test → registry install →
   clean consumer.
2. Never name a glyph or a colour in a component. Add a state to the theme.
3. Any new animation must read from `FrameClock`.
4. Any new registry item needs a scenario *and* a consumer fixture.
5. `bun run verify` runs typecheck, lint, tests, registry validation, and a
   clean-consumer install.

## License

MIT. Clack (MIT) was used as an observed visual reference only; no Clack source
was copied or adapted. See [docs/visual-language.md](docs/visual-language.md#attribution).
