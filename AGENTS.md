# AGENTS.md

Durable operating contract for coding agents working on **terminal-ui**. Keep this file project-specific, behavior-changing, and action-oriented; task state belongs in `.agents/`, detailed domain decisions live in `docs/`, and component scenarios live in `src/scenario/`.

## 1. Project Identity & Purpose

**terminal-ui** is a production OpenTUI React component library combining:
- Clack-inspired visual grammar (vertical rails, semantic markers, restrained color, prompt-to-transcript collapse),
- OpenTUI-native rendering and keyboard interaction (zero browser/DOM runtime dependencies),
- a native OpenTUI component Workbench for live inspection and testing (40–160 column responsive layouts),
- deterministic testing (unit, keyboard interaction, framebuffer visual goldens),
- first-class shadcn-compatible source distribution alongside standard package exports.

This is a component library. It is **not** a Clack port/wrapper, not a browser UI framework, and not an application workflow engine.

## 2. Scope, Precedence & Surface Routing

### Precedence
1. Runtime safety and user constraints.
2. This `AGENTS.md` operating contract.
3. Canonical documentation in `docs/` (`architecture.md`, `visual-language.md`, `registry.md`, `testing.md`).
4. Current implementation and test suites.

### Surface Routing (Repository Map)
- `src/theme/`: Semantic tokens, palettes (`clack`, `ascii`, `highContrast`), and prompt lifecycle state machine (`state.ts`).
- `src/primitives/`: Reusable atomic visual building blocks (`Rail`, `RailRow`, `Marker`, `Label`, `HintRow`, `Status`, `Separator`).
- `src/components/`: Composed interactive controls (`prompt`, `select`, `autocomplete`, `multiselect`, `input`, `confirm`, `task`, `feedback`, `composition`).
- `src/scenario/`: Catalog of component scenarios used by both the native Workbench and the visual test suite.
- `workbench/`: Native OpenTUI explorer application (`app/workbench.tsx`, `index.tsx`).
- `registry.json` & `scripts/`: Source distribution definitions (`scripts/build-registry.ts`, `validate-registry.ts`, `verify-all-consumers.ts`). *Note: `registry.json` is generated; do not edit directly.*
- `tests/`: Deterministic test suites (`unit/`, `interaction/`, `visual/` with golden fixtures in `tests/visual/__snapshots__/`).
- `docs/`: In-depth architecture, visual language tokens, registry distribution trade-offs, and testing guides.
- `.agents/`: Local agent workbench, handoff state (`CURRENT_STATUS.md`), plans, and audit reports.

## 3. Architectural Invariants

- **OpenTUI is the exclusive substrate**: Production components render through `@opentui/react` and `@opentui/core`. Never introduce DOM, browser, or HTML dependencies (`window`, `document`, `div`, etc.).
- **Strict downward dependency layering**:
  `theme` → `primitives` → `components` → `scenario` / `workbench`
  Imports only point downward. Primitives know nothing of components; components know nothing of the Workbench or tests.
- **Semantics before presentation**: Components name semantic states (`active`, `complete`, `error`, `selected`, `disabled`), never literal colors or glyphs. Themes map semantic states to presentation. Glyph shape carries meaning first; color carries emphasis second.
- **Prompt shell owns lifecycle and collapse**: `Prompt` owns rails, questions, hint rows, validation error presentation, and the active → submitted collapse. Controls contribute only their body and summary.
- **Single implementation for package and registry**: Registry-installed components (`@components/terminal-ui/`) and package imports (`@terminal-ui/react`) share the exact same source files. Never create divergent implementations or depend on unpublished internal modules.
- **Native Workbench**: The component explorer runs in native OpenTUI and renders real production components in simulated widths (40–160 cols). Never replace it with browser mocks.
- **Deterministic verification**: Keyboard interactions and visual framebuffer captures must be 100% deterministic. Never introduce timing races or non-deterministic test mocks.

## 4. Change Boundaries

### Always
- Make the smallest effective change that fully satisfies the task.
- Read affected source files and inspect nearby patterns/tests before editing.
- Preserve downward dependency layering.
- Run `bun run typecheck` and relevant tests after any change.
- When adding or modifying components/primitives, rebuild the registry (`bun run registry:build`) and validate (`bun run registry:validate`).
- Preserve unrelated worktree changes and avoid drive-by formatting.
- Update `.agents/CURRENT_STATUS.md` whenever repository state, verification, or next steps change.

### Ask First
- Adding, replacing, or upgrading dependencies in `package.json`.
- Modifying public exports (`src/index.ts`), theme interfaces, or semantic token sets.
- Changing registry schema, install target paths, or breaking shadcn compatibility.
- Updating visual goldens (`UPDATE_GOLDEN=1 bun test tests/visual`) without inspecting and confirming the rendered visual diff.
- Deleting files or expanding scope into new architectural subsystems.

### Never
- Introduce DOM/browser/HTML elements into the library or Workbench.
- Hardcode glyphs, colors, ANSI escape sequences, or box-drawing characters in components (use Theme/primitives).
- Hand-edit `registry.json` (always generate via `bun run registry:build`).
- Fork or maintain separate implementations for package vs. registry distribution.
- Weaken test assertions, skip failing tests, or claim verification without running commands.

## 5. Component Extension & Maintenance Playbook

The core library and Workbench are fully built and verified (14 registry items, 208+ tests). When extending the library with new components (e.g. `Table`, `Tree`, `Tabs`, `CommandPalette`, `Form`):

1. **Composition**: Build on `Prompt` and `primitives` inside `src/components/<name>/`. Do not reimplement rails or markers.
2. **State & Input**: Use explicit state transitions (`src/theme/state.ts` / `usePromptState`) and handle OpenTUI keyboard events cleanly.
3. **Scenario Catalog**: Define scenarios under `src/scenario/catalog/<name>.ts` with multiple states (active, submitted, error, disabled, long lists).
4. **Unit & Interaction Tests**: Add deterministic specs under `tests/unit/<name>.test.tsx` verifying render, key navigation, validation, and narrow-width truncation.
5. **Visual Golden**: Add a visual test case in `tests/visual/` and capture deterministic golden frames.
6. **Registry Registration**: Add entry in `scripts/build-registry.ts`, run `bun run registry:build`, and add consumer fixture in `scripts/consumer-fixtures.ts`.
7. **Verification**: Run `bun run verify` to confirm typecheck, lint, tests, registry validation, and clean-consumer install.

## 6. Commands & Verification Ladder

Run commands using **Bun 1.4+**:

| Command | Purpose |
| --- | --- |
| `bun run workbench` | Launch native OpenTUI component explorer |
| `bun run typecheck` | Typecheck entire repository (`tsc --noEmit`) |
| `bun run lint` | Lint with Biome (`biome check .`) |
| `bun run format` | Format with Biome (`biome format --write .`) |
| `bun test` | Run complete test suite (unit, interaction, visual, fixture) |
| `bun run test:visual` | Run visual regression suite against golden snapshots |
| `bun run test:update` | Update visual golden snapshots (`UPDATE_GOLDEN=1`) |
| `bun run registry:build` | Rebuild `registry.json` from component tree |
| `bun run registry:validate` | Validate `registry.json` with official shadcn CLI checks |
| `bun run consumer:verify:all` | Verify all registry items install & render in isolated consumers |
| `bun run verify` | **Authoritative CI gate** (`typecheck` + `lint` + `test` + `registry:validate` + `consumer:verify:all`) |

### Verification Ladder by Change Scale
- **Localized bugfix / logic tweak**: `bun run typecheck` + focused `bun test <file>`.
- **Component / primitive change**: `bun run typecheck` + `bun test` + `bun run registry:build` + `bun run registry:validate`.
- **New component / registry / public export**: `bun run verify`.
- **Before handoff / commit**: `bun run verify` must exit 0.

## 7. State, Handoff & Definition of Done

### Agent Working Memory (`.agents/`)
- Maintain `.agents/CURRENT_STATUS.md` as the canonical handoff file.
- When completing or pausing work, record: current state, verification command results, changed files, and immediate next steps.
- Do not dump conversational transcripts or raw logs into memory files.

### Definition of Done
A task is done only when:
1. Behavior is implemented according to architectural invariants.
2. Downward layering and semantic token discipline are preserved.
3. Relevant unit, interaction, and visual tests pass.
4. If component files changed: `bun run registry:build` and `bun run registry:validate` pass.
5. `bun run verify` passes cleanly with zero errors or uninspected visual regressions.
6. `.agents/CURRENT_STATUS.md` accurately reflects the new state and verification evidence.

## 8. Anchor

**Build semantic, Clack-inspired OpenTUI components that developers can render natively, inspect, copy, own, compose, test, and extend.**