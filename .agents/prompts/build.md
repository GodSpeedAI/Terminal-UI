You are building a new reusable UI component library for **OpenTUI React**.

The goal is to reproduce the **visual language, interaction polish, and compositional feel of Clack** (`@clack/prompts`) as native OpenTUI React components, while creating a broader component system suitable for full terminal applications.

This is NOT a port of Clack.

Do not reproduce Clack's architecture or API merely for compatibility. Study Clack as the visual/design reference, identify the primitives responsible for its appearance, and implement those idiomatically using OpenTUI.

The resulting project should feel like:

**Clack's visual design system + OpenTUI's application capabilities + shadcn's source-distribution model.**

## Core goals

The project must provide:

1. A polished library of reusable OpenTUI React components visually inspired by Clack.
2. A native interactive **component Workbench** that serves the purpose Storybook normally would.
3. Deterministic visual and interaction tests using OpenTUI's test renderer.
4. A **shadcn-compatible registry** so components can be copied into another project as source rather than requiring a monolithic UI package.
5. Clean theming and semantic state primitives so applications do not hard-code glyphs/colors.
6. Good terminal behavior across different widths, color capabilities, Unicode support, focus states, and keyboard input.
7. Minimal dependencies and no browser/DOM dependency in the actual component library.

Use **Bun v1.4.0**, TypeScript, React, `@opentui/react`, and `@opentui/core`.

Use current stable compatible versions. Do not blindly pin versions from examples found online.

Before implementation, read the current official OpenTUI documentation, especially:

- React bindings
- components
- layout
- interaction/focus
- testing
- renderer lifecycle
- OpenTUI's example browser

Also inspect the current Clack implementation and demos to establish the visual reference.

Do not assume old APIs.

---

# 1. Design philosophy

Treat Clack as a **visual grammar**, not as a package to wrap.

The recognizable visual model is approximately:

    ◆ Active question
    │
    │  ● Selected option
    │  ○ Other option
    │
    ◇ Completed answer

Other recurring concepts include:

    │ vertical rail
    ┌ start
    └ end
    ├ branch

    ◆ active
    ◇ completed
    ○ pending
    ■ cancelled/failed
    ▲ warning/error

    ● selected
    ○ unselected

    ◾ checked
    ◻ unchecked

Exact symbols and colors should be verified against the current Clack implementation rather than assumed from this prompt.

The rail is fundamental.

Avoid turning every component into a rectangular bordered panel. Clack's visual identity comes substantially from vertical composition, whitespace, markers, typography, indentation, and state transitions.

Full application components may use panels where appropriate, but the default prompt/task visual grammar should remain rail-oriented.

---

# 2. Separate semantics from presentation

Do not scatter literal colors or glyphs throughout components.

Create semantic primitives such as:

    active
    pending
    complete
    selected
    unselected
    checked
    unchecked
    warning
    error
    cancelled
    disabled
    muted

Applications should be able to write things conceptually like:

    <Step state="active" />
    <Step state="complete" />
    <Status state="error" />

rather than:

    <Text color="cyan">◆</Text>

The theme determines representation.

Create a theme system with at least:

- `clackTheme`
- `asciiTheme`
- `highContrastTheme`

Design the API so additional themes can be added without changing components.

The default should be the Clack-inspired theme.

---

# 3. Architecture

Use a structure along these lines, adjusting where the implementation suggests something better:

    src/
      components/
        prompt/
        select/
        multiselect/
        confirm/
        input/
        autocomplete/
        spinner/
        progress/
        task/
        note/
        log/
        group/
      primitives/
        rail/
        marker/
        label/
        hint/
        option-indicator/
        separator/
      theme/
        types.ts
        context.tsx
        clack.ts
        ascii.ts
        high-contrast.ts
      hooks/
      utils/
      index.ts

    workbench/
      app/
      catalog/
      scenarios/

    registry/
      ...

    tests/
      visual/
      interaction/
      accessibility/
      fixtures/

    registry.json

Do not create unnecessary abstraction layers merely to match this structure.

Keep component boundaries coherent.

---

# 4. Initial component set

Implement a strong first release around the following.

## Foundations

- ThemeProvider
- Rail
- Marker
- Status
- Label
- Hint
- Separator
- KeyHint

## Composition

- Intro
- Outro
- Prompt
- PromptGroup
- Step
- Group
- Note
- Log

## Input

- TextInput
- PasswordInput
- Confirm
- Select
- MultiSelect
- Autocomplete

## Feedback

- Spinner
- Progress
- Task
- TaskList

Components should compose rather than duplicate presentation logic.

For example, `Select` should not independently implement all of the Prompt shell's rail, title, completion and error presentation.

Aim for something conceptually like:

    <Prompt
      message="Choose deployment target"
      state={state}
    >
      <Select ... />
    </Prompt>

Do not force this exact API if a cleaner React/OpenTUI design emerges.

---

# 5. Component state machines

Interactive components must have explicit, predictable states.

Examples:

    idle
      ↓
    focused
      ↓
    editing/selecting
      ↓
    validating
      ├─ error
      └─ submitted

Support cancellation where appropriate.

Do not let visual state emerge accidentally from arbitrary booleans.

Make transitions testable.

A completed prompt should visually collapse or transform in a way consistent with Clack's interaction language rather than merely freezing the active control.

Errors should appear within the same visual grammar instead of creating unrelated alert boxes.

---

# 6. Keyboard behavior

Provide consistent keyboard semantics.

At minimum account for:

- Up / Down
- Left / Right when meaningful
- Enter
- Space
- Tab / Shift+Tab
- Escape
- Ctrl+C
- Home / End where meaningful
- typing
- backspace/delete

Do not globally hijack keys unnecessarily.

Focus ownership must be explicit.

Nested interactive components must not create unpredictable keyboard conflicts.

Expose keyboard hints where appropriate.

---

# 7. Native component Workbench

Do NOT use Storybook as the primary component explorer.

Build a native **OpenTUI Workbench** so components execute in the same renderer and interaction environment they will use in real applications.

Running:

    bun run workbench

should open the explorer.

The Workbench should function like a terminal-native combination of:

- Storybook
- component playground
- interaction tester
- design-system documentation

Suggested layout on sufficiently wide terminals:

    ┌ Components ─────┬──────────────────────────────────────
    │ Foundations     │
    │   Marker        │     LIVE COMPONENT
    │   Rail          │
    │                 │
    │ Inputs          │     ◆ Choose environment
    │   TextInput     │     │
    │ > Select        │     │  ● Production
    │   MultiSelect   │     │  ○ Staging
    │                 │     │  ○ Development
    │ Feedback        │     │
    │   Spinner       │
    │   Progress      │
    │                 │
    └─────────────────┴──────────────────────────────────────
      theme: clack   width: 80   ? help

Do not slavishly reproduce this layout.

Optimize for usefulness.

### Workbench capabilities

The Workbench should allow me to:

- browse components by category
- search/filter components
- choose component scenarios
- interact with live controls
- reset a scenario
- change theme
- toggle Unicode/ASCII representation
- simulate terminal widths
- inspect active/focused/completed/error/disabled states
- see keyboard shortcuts
- view basic component metadata
- see a minimal usage example

Provide useful hotkeys.

Example concepts:

    / search
    ↑↓ navigate
    enter open
    tab focus
    r reset
    t theme
    w width
    ? help
    q quit

Choose final bindings based on conflicts and usability.

### Responsive Workbench

At narrow terminal widths, do not squeeze two panes until they are unusable.

Switch to an appropriate stacked/navigation mode.

Test at representative widths such as:

- 40 columns
- 60 columns
- 80 columns
- 120 columns
- 160 columns

---

# 8. Stories/scenarios without Storybook

Introduce a small typed `Scenario` abstraction.

For example, a component can expose scenarios such as:

    Default
    Focused
    Completed
    Error
    Disabled
    Long label
    Narrow terminal
    Many options
    Keyboard navigation
    ASCII

The same scenario definition should ideally be reusable by:

1. the Workbench,
2. visual regression tests,
3. generated documentation/examples.

Do not create three separate representations of the same state.

Avoid coupling the scenario format to Storybook.

If a good existing lightweight abstraction solves this cleanly, use it; otherwise keep the implementation small.

---

# 9. Visual regression testing

Use the current OpenTUI React testing APIs.

Use `@opentui/react/test-utils` and the renderer's framebuffer capture capabilities.

Each important component/scenario should have deterministic tests for:

- rendered characters
- important styling attributes where practical
- cursor/focus behavior
- keyboard interaction
- state transition
- terminal width behavior

Maintain golden fixtures/snapshots where they add real value.

Representative visual fixtures should include:

    prompt-active
    prompt-completed
    prompt-error

    select-default
    select-focused
    select-submitted

    multiselect-default

    text-input-empty
    text-input-editing
    text-input-error

    spinner

    progress-0
    progress-50
    progress-100

    task-pending
    task-running
    task-completed
    task-failed

Do not generate brittle snapshots containing timing noise.

Animations must support deterministic testing.

Provide an injectable clock/frame or equivalent where necessary.

---

# 10. Clack visual reference harness

Create a clear reference process for visual fidelity.

Study current Clack output directly.

Document the findings as design tokens/rules rather than copying Clack's internal implementation.

Capture/reference:

- glyphs
- colors
- indentation
- rail spacing
- label spacing
- option spacing
- focused state
- submitted state
- cancelled state
- validation state
- hint/help formatting
- spinner/progress presentation
- grouping behavior

Create a short document such as:

    docs/visual-language.md

It should describe the visual system in terms our library owns.

Do not make our runtime depend on Clack.

Clack may exist as a development/reference dependency only if useful.

If any actual Clack source code is copied or adapted rather than independently implemented, comply with its MIT license and attribution requirements.

Prefer independent implementation from documented behavior and visual observation.

---

# 11. shadcn-style source distribution

This is a major requirement.

Use the **real current shadcn registry format**.

The repository should contain a root:

    registry.json

configured so individual OpenTUI components can be installed as editable source.

Design registry dependency relationships correctly.

For example, conceptually:

    select
      depends on:
        prompt
        marker
        theme

Adding `select` should pull the files required to make it work.

Users should NOT have to install the entire component library when they want one component.

Keep copied components inspectable and locally editable.

The intended experience should be similar to:

    bunx shadcn@latest add <owner>/<repo>/select

or the current supported equivalent.

Verify this against the current shadcn registry documentation.

Do not invent a custom registry format if shadcn can support the requirement.

### Important source-distribution constraint

Design components so copied source does not depend on some hidden internal package that defeats the purpose of copy-and-paste distribution.

Shared primitives are acceptable, but they must themselves be registry items that are resolved as dependencies.

External runtime dependencies should remain minimal.

---

# 12. Optional package distribution

Structure the library so it CAN also be consumed conventionally:

    import {
      Prompt,
      Select,
      Spinner
    } from "<package-name>"

but source-copy installation is a first-class requirement rather than an afterthought.

Do not publish anything externally during this task.

Just make the repository publish-ready.

---

# 13. Developer experience

Use Bun throughout where sensible.

Expected commands should include equivalents of:

    bun run workbench
    bun test
    bun run test:visual
    bun run typecheck
    bun run lint
    bun run registry:validate

If formatting is configured:

    bun run format

Use the current shadcn registry validation tooling rather than implementing our own schema validator unless necessary.

Keep setup simple.

Avoid a giant build system.

---

# 14. Documentation

Create a concise README that explains:

- what the project is
- why it exists
- OpenTUI requirement
- quick start
- Workbench
- package usage
- source-copy/shadcn usage
- theming
- component list
- testing
- contribution workflow

Also create:

    docs/
      architecture.md
      visual-language.md
      registry.md
      testing.md

Do not fill docs with generic prose.

Document decisions and behavior someone maintaining the library actually needs to know.

---

# 15. Design quality requirements

The UI should feel deliberately designed.

Pay close attention to:

- vertical rhythm
- indentation
- whitespace
- foreground/background contrast
- muted text
- symbol alignment
- option alignment
- cursor placement
- focus indication
- transition from active → submitted
- narrow width wrapping
- long labels
- nested tasks
- terminal color capabilities

Avoid unnecessary borders.

Avoid excessive color.

Avoid decorative UI that conflicts with Clack's restrained presentation.

The terminal should remain readable in both dark and light environments.

Never rely solely on color to communicate semantic state.

---

# 16. Accessibility and compatibility

Provide:

- ASCII fallback
- high-contrast theme
- semantic indicators in addition to color
- predictable keyboard navigation
- safe truncation/wrapping
- graceful behavior when Unicode width handling differs
- graceful behavior when the terminal has limited color capability

Do not assume Nerd Fonts.

Do not use private-use glyphs as required UI symbols.

---

# 17. Extensibility

Although this first release is centered on Clack-like interaction components, architect the visual language so we can later add full application components such as:

- Tree
- Table
- Tabs
- SplitPane
- CommandPalette
- Inspector
- DataList
- Timeline
- ActivityFeed
- Diff
- CodeBlock
- Markdown viewer
- Form
- Wizard
- Dashboard/status views

These should eventually be able to use the same themes, state vocabulary, rail system, keyboard hints, and Workbench.

Do NOT implement all of these now.

Simply avoid architecture that makes them awkward later.

---

# 18. No browser dependency

The library itself and the primary Workbench must be genuinely terminal-native.

Do not create HTML/CSS replicas of the components and call those the component explorer.

If we later want a website, it should preferably consume deterministic captures/artifacts produced by the real OpenTUI renderer rather than implementing a second UI system.

Storybook can be reconsidered later for documentation presentation if there is a concrete benefit, but it is not required for this implementation.

---

# 19. Implementation sequence

Work in dependency order.

First inspect the repository and current OpenTUI APIs.

Then create a concrete implementation plan.

Recommended dependency sequence:

1. project/tooling setup
2. theme/state model
3. primitive visual grammar
4. Prompt composition shell
5. Select as the first fully interactive reference component
6. Workbench skeleton
7. scenario abstraction
8. TextInput / Confirm / MultiSelect
9. feedback components
10. tasks/grouping
11. visual regression suite
12. ASCII/high-contrast behavior
13. shadcn registry
14. package exports
15. documentation
16. final integration/verification

Use `Select` as an early vertical slice.

Before building every component, prove this entire chain works:

    component
       ↓
    native OpenTUI rendering
       ↓
    Workbench scenario
       ↓
    keyboard interaction
       ↓
    visual test
       ↓
    shadcn registry installation
       ↓
    copied component works in a clean consumer fixture

Do not mass-produce components until this vertical slice succeeds.

---

# 20. Clean consumer fixture

Create a small fixture/test project representing a user installing components into a fresh OpenTUI React application.

Automate validation that a registry-installed component:

- installs the expected source
- resolves registry dependencies
- typechecks
- runs
- renders correctly
- does not depend on unpublished internal paths

This is important.

The shadcn-style distribution is not complete merely because `registry.json` validates.

Prove the copied source works.

---

# 21. Definition of done

The task is complete when all of the following are true:

- `bun run workbench` launches a polished native component explorer.
- I can browse and interact with the implemented components.
- The default theme clearly resembles Clack's visual grammar.
- Components share semantic state/theme primitives instead of duplicated styling.
- Important states and interactions have deterministic OpenTUI tests.
- Narrow and wide terminal layouts behave appropriately.
- Unicode and ASCII modes work.
- A valid shadcn registry exposes individual components.
- At least one component has been installed from the registry into a clean fixture and verified.
- Normal package imports also work.
- Typecheck passes.
- Tests pass.
- Registry validation passes.
- Documentation reflects the actual implementation.
- There are no hidden browser dependencies.
- There are no unnecessary framework abstractions.
- There are no placeholder components pretending to be complete.

At the end, show me:

1. the final repository structure,
2. the component inventory,
3. how to launch the Workbench,
4. how to install one component via the shadcn registry,
5. how to consume it as a normal package,
6. the test/validation results,
7. any meaningful deviations from this specification and why they were necessary.

Do not stop after scaffolding.

Build and verify the usable first version.