# Build verification report — `.agents/prompts/build.md`

**Date:** 2026-09-29
**Auditor:** independent verification pass (ZCode)
**Scope:** full audit of the repository against the build specification, with every claim re-executed rather than trusted.

---

## Verdict

**The library core is built to spec and genuinely verified. The Workbench — the project's flagship deliverable — has a ship-blocking defect: at normal terminal widths (≥72 columns) it never renders the live component, and the `Tab` key breaks arrow navigation in both layouts.** The component library, theming, test suites, registry, and documentation are in unusually good shape; the Workbench is the one area where the implementation does not meet the spec or its own documentation, and where the existing test suite passes for the wrong reasons.

| Area | Status |
| --- | --- |
| Component library (primitives, prompts, inputs, feedback, tasks) | ✅ Meets spec |
| Semantic state model + theming (clack / ascii / high-contrast) | ✅ Meets spec |
| Deterministic tests (unit, interaction, visual goldens) | ✅ Meets spec |
| shadcn registry + clean-consumer verification | ✅ Meets spec (see P3-1) |
| Documentation | ✅ Substantially accurate (Workbench claims overstated — P1-1) |
| **Native Workbench** | ❌ **Defective at ≥72 columns (P0)** |

---

## 1. Verification evidence (re-executed, not trusted)

| Check | Command | Result |
| --- | --- | --- |
| Full gate | `bun run verify` | **exit 0** — typecheck, biome lint, 173 unit+interaction tests, registry validation, clean-consumer `select` |
| Visual regression | `bun run test:visual` | **68 pass / 0 fail**, 65 golden text fixtures |
| All registry items | `bun run consumer:verify:all` | **13/13** install → typecheck → render in throwaway projects |
| Registry schema | inside `registry:validate` | real `shadcn` CLI accepted 13 items + 10 structural checks the CLI can't make |
| Workbench launch | `bun run workbench` in a real pty at 100×30 | launches, renders, exits cleanly on `q` |
| Package import | `import { Prompt, Select, Spinner, ThemeProvider } from "@terminal-ui/react"` | resolves (self-reference via `exports`) |
| **Live-pane probe** | render `Workbench` via test renderer at 40/60/80/120/160, grep frame for library-only glyphs `[◆◇●○■▲◻◼]` | **present at 40 and 60; absent at 80, 120, 160** |
| **Navigation probe (wide)** | at 120 cols: `TAB`, then `ARROW_DOWN` ×2 | cursor row frozen (3 → 3); recovers only after a second `TAB` (→ 5) |
| **Navigation probe (narrow)** | at 60 cols: `TAB` then `ARROW_DOWN` ×3 | **frame unchanged — arrows completely dead after one `Tab`**; `RETURN` flips the pane but arrows stay dead; only a second `TAB` re-arms them |

Everything the spec's §21 "Definition of done" lists passes *as a command*. The two probes are the behaviors those commands were supposed to guarantee — and they fail. Details below.

---

## 2. Findings

### P0-1 — The Workbench renders no live component at ≥72 columns

`workbench/app/workbench.tsx`:

- `Live` (the only component that calls `scenario.render()`, line 720) is mounted **exclusively in the narrow branch** (lines 223–252).
- The wide branch (lines 253–280) renders `Sidebar` + `ScenarioList` + `Detail`. `Detail` (lines 641–684) shows metadata only — name, summary, usage line, key table. It never renders the scenario.

Consequences, all reproduced:

1. At 80/120/160 columns — the desktop case and exactly the layout the spec sketches in §7 ("LIVE COMPONENT" pane) — **you cannot see or interact with any component**. The explorer that exists to showcase components shows none of them. *(Independently confirmed by the user: "doesn't actually show the components.")*
2. `w` (cycle simulated width) and `r` (reset) still fire, but at wide widths they only change the header/footer status text — the knobs are wired to a pane that isn't mounted.
3. Spec §7 "interact with live controls" and §21 "I can browse and interact with the implemented components" are unmet at the widths where most users will run it.

**Fix:** mount the live pane in the wide branch. The right column should stack `ScenarioList` (compact) → `Live` (flexGrow, rendered at `liveWidth`) → optionally a one-line metadata strip (usage example). `Detail`'s key table can move into the help overlay or below the live pane. The scenario abstraction already gives you everything — `Live` is 30 lines and takes `width`/`height` props.

### P0-2 — `Tab` breaks arrow navigation in both layouts

`workbench/app/workbench.tsx:129-132`:

```ts
tab: () => {
  if (narrow) setPane((p) => (p === "components" ? "scenarios" : "components"));
  setLiveFocused((f) => !f);
},
```

`Tab` always toggles `liveFocused`, and every navigation handler starts with `if (liveFocused) return` (lines 108–118). Reproduced behavior:

- **Wide (120 cols):** after `Tab`, arrows do nothing while *no live component is visible* — the explorer appears frozen until `Tab` is pressed again.
- **Narrow (60 cols):** `Tab` is advertised (README, help overlay) as "switch pane". It switches the pane **and** silently arms live-focus, so arrows die immediately after switching to the scenario list. `Return` — the other pane-switch key — flips the pane but leaves arrows dead. Only a second `Tab` restores navigation, and it flips your view back as a side effect. There is no state in which the user can see "arrows work in the scenario list" after pressing the documented pane-switch key. *(Independently confirmed by the user: "hard to navigate.")*

**Fix:** replace the two entangled booleans (`pane`, `liveFocused`) with one explicit focus model — `focus: "components" | "scenarios" | "live"` — where:

- `Tab`/`Shift+Tab` cycle focus; arrows always route to the focused target;
- the focused target is always visibly rendered (which P0-1's fix guarantees for `"live"`);
- the focused list shows its `▸` marker and the live pane shows an accent border (the current `inList` styling already does this).

That is a ~30-line change to `workbench.tsx` and it eliminates both P0-2 reproductions by construction.

### P0-3 — The Workbench tests pass for the wrong reasons

- `tests/interaction/workbench.test.tsx:150-155` — "the live pane renders the real component, not a preview" asserts the frame matches `/[│◆◇]/`. At 120 columns the frame contains **no** library glyphs; the test passes because `│` matches the `Detail` pane's own chrome border. This is the test that should have caught P0-1.
- `tests/interaction/workbench.test.tsx:126-139` — the `w` and `r` tests assert only `frame !== before`. At wide widths the only change is the status-bar flash, so these pass without the knob doing anything real. Same for the `t`/`a` theme tests at wide widths when the selected scenario renders no glyphs.

**Fix after P0-1/P0-2:**

- assert a **library-only** glyph class (`[◆◇●○■▲◻◼]`) or a rail row (`│  ●`) at *every* responsive width, not a class that includes chrome borders;
- add a navigation invariant test: after pressing each documented key, `ARROW_DOWN` must either move the visible cursor or route visibly to the live component — never silently do nothing;
- make the `w` test assert the live pane's rendered width changed (e.g. a truncation boundary moves), not merely that some pixels changed.

### P1-1 — Documentation overstates the Workbench

- `README.md:50` — "`Tab` | move focus into / out of the live component" — false at ≥72 cols (no live component), misleading below (breaks arrows).
- `README.md:60-62` — "two panes at 80 columns and up … and the live pane renders at a *simulated* width" — the live pane does not exist at 80+.
- `.agents/CURRENT_STATUS.md` — "Workbench … launches and renders at 40–160 columns" is technically true and materially incomplete: what renders at 80–160 is chrome plus metadata, not components.

**Fix:** correct the README/CURRENT_STATUS after the P0 fix lands. AGENTS.md's verification standard ("for visual changes, inspect the rendered result") was arguably met — a pty capture exists — but the capture was evidently taken in narrow mode or not inspected for live content. The lesson for the report: the gate should include the glyph-presence probe from §1 as a permanent test.

### P1-2 — `Autocomplete` is not implemented (accepted deviation, keep tracked)

Spec §4 lists `Autocomplete` in the initial input set. It is absent, honestly documented (README, CURRENT_STATUS), and the spec itself forbids placeholder components — deferring is the right call. It remains an **open spec requirement**: track it as the next component (the project's own "Next" list already does). The `Select` type-ahead plus a filtered overlay sharing the `Prompt` shell is the natural shape.

### P2-1 — `bun run verify` does not run the visual suite

`package.json:31` — `verify` = typecheck + lint + `bun test` (unit+interaction only) + `registry:validate` + `consumer:verify` (one item). The 68 visual tests and the 13-item `consumer:verify:all` are outside the gate. A visual regression or a broken non-`select` registry item can land while `verify` is green.

**Fix:** `verify` should include `bun run test:visual`; promote `consumer:verify` → `consumer:verify:all` (it costs ~1–2 min; if that hurts, keep `verify` fast but add a `verify:full` and document which is the release gate).

### P2-2 — React `act()` warnings pollute the visual suite

Every golden test emits "An update to Root inside a test was not wrapped in act(...)". Tests pass; the noise erodes trust and hides real warnings. **Fix:** wrap the step-replay presses in `act()` (or set the React act environment flag appropriately for the OpenTUI renderer) in `tests/visual/scenarios.test.tsx` / `tests/harness.tsx`.

### P2-3 — Weak assertions in Workbench tests

Covered under P0-3, but it generalizes: prefer assertions on *meaningful frame content* (glyph classes, cursor position, pane width) over `frame !== before`. The library-level tests (inputs, select, note) already do this well — the Workbench tests are the outlier.

### P3-1 — The real `shadcn add` path has never been executed

`registry:validate` runs the genuine `shadcn registry validate`, but installation is *simulated* by `scripts/verify-clean-consumer.ts` (it resolves the closure and copies files itself, faithfully honoring `files[].target`). The documented `bunx shadcn@latest add terminal-ui/terminal-ui/select` (README:93) has never run — it can't until the repo is hosted, and the spec forbids publishing. Residual risks: the placeholder homepage (`scripts/build-registry.ts:237` → `github.com/terminal-ui/terminal-ui`), and any CLI-side behavior the simulator doesn't model.

**Fix:** once the repository is public, run the documented command once in a scratch project and record the transcript; consider a `consumer:verify:shadcn` script that points the CLI at a locally served registry file.

### P3-2 — Registry items declare no per-item `peerDependencies`

The shadcn registry format supports per-item dependency metadata; the built items carry none (peer deps live only in `package.json`, which a source-copy consumer never reads). A real `shadcn add` won't validate/prompt for `react`, `@opentui/react`, `@opentui/core` versions. **Fix:** emit `peerDependencies` in `scripts/build-registry.ts`.

### P3-3 — Inconsistent error presentation in `Group`

`src/components/task/task.tsx:167-171` renders a group error as `<Muted>` text on a rail row, while `Prompt` (`src/components/prompt/prompt.tsx:141-150`) uses `ErrorText` with an `error` marker. Same semantic state, two presentations. **Fix:** reuse the shell's error row (extract it into a shared primitive if it stays a pattern).

### P3-4 — `Log` suffix is not width-budgeted

`src/components/composition/composition.tsx:53` renders the suffix with `maxWidth={undefined}` even though a budget was computed for it at line 36–46 — a long suffix can overflow a narrow row. **Fix:** pass the budget.

### P3-5 — Cosmetic warts

- `src/scenario/catalog.tsx:1` — import path `"../components/../primitives/rail.js"` (works; bypasses the primitives index; clearly a generation artifact).
- `Muted`/`ErrorText` in `src/primitives/label.tsx` duplicate `Label`'s body — compose instead of copy-paste.
- `workbench.tsx:199` — `q` calls `process.exit(0)` inside a React component; hostile to embedding the Workbench in a host app. Accept an `onQuit` prop with a default.
- Everything is **uncommitted**: the single "first commit" contains only the README; the entire library is untracked working-tree files. No history, no review checkpoint. **Commit the work** (and put the pty-capture probe into CI).

### P3-6 — Naming/organization deviations from the spec's sketches (acceptable)

- `Step` → `StepLine`; `KeyHint` → `Hint` + `KeyHintPair`; `tests/accessibility/` folded into unit/visual suites; scenario catalog groups 16 exported components into 9 Workbench entries. The spec explicitly permits API adjustments ("Do not force this exact API"); these are coherent. Recorded for completeness.
- Spec §9's `prompt-active` / `prompt-completed` / `prompt-error` fixtures exist only as component-level equivalents (`select-*`, `text-input-*`, `confirm-*`), enforced by the coverage test at `tests/visual/scenarios.test.tsx:95-121` under component names. Coverage is equivalent; the exact fixture names do not exist.

---

## 3. Spec compliance matrix (§21 Definition of Done)

| Requirement | Status | Evidence |
| --- | --- | --- |
| `bun run workbench` launches a polished native explorer | ⚠️ | Launches (pty-verified); not polished at ≥72 cols — no live component (P0-1), Tab breaks navigation (P0-2) |
| Browse and interact with implemented components | ❌ at ≥72 cols / ⚠️ below | Probes in §1; user-confirmed |
| Default theme resembles Clack's grammar | ✅ | `clackTheme` + goldens match `docs/visual-language.md` (SGR-verified reference) |
| Components share semantic state/theme primitives | ✅ | All controls compose `Prompt`/`RailRow`/`Marker`; zero glyph/color literals in components (source-audited) |
| Deterministic OpenTUI tests for important states/interactions | ✅ | 173 + 68 tests; manual clock; no wall-time waits |
| Narrow and wide terminal layouts behave appropriately | ⚠️ | Components: yes (40–160 no-overflow tests). Workbench wide layout: defective (P0-1) |
| Unicode and ASCII modes work | ✅ | Per-state 7-bit ASCII test in `tests/unit/primitives.test.tsx`; ascii goldens |
| Valid shadcn registry exposes individual components | ✅ | Real CLI accepted 13 items; import-graph checks pass |
| ≥1 component installed from registry into clean fixture, verified | ✅ | All 13: install → typecheck → render with exact expected output |
| Normal package imports work | ✅ | Self-import smoke test; publish-ready (unpublished, per spec) |
| Typecheck / tests / registry validation pass | ✅ | `bun run verify` exit 0 |
| Documentation reflects the implementation | ⚠️ | Excellent docs; Workbench sections overstate (P1-1) |
| No hidden browser dependencies | ✅ | Library imports only `react`, `@opentui/core`, `@opentui/react` |
| No unnecessary framework abstractions | ✅ | Three-layer architecture is minimal and load-bearing |
| No placeholder components | ✅ | `Autocomplete` honestly absent rather than stubbed |

---

## 4. Strengths worth preserving

- **The state model is the best part of the library.** A closed semantic vocabulary, a data-driven transition table (`src/theme/state.ts`), and `defineTheme` fallbacks make illegal states unrepresentable and third-party themes safe. Tests assert the whole transition graph.
- **The Prompt shell composition actually holds.** Every control audited (`Select`, `MultiSelect`, `TextInput`, `Confirm`) delegates rail/question/hint/error/collapse to `Prompt` — the spec's central architectural demand is genuinely met, not just claimed.
- **The registry is derived, not hand-written**, and validated both by the real shadcn CLI and by import-graph diffing; the clean-consumer harness is the strongest part of the toolchain (it caught exactly the class of failure registries usually hide).
- **The scenario abstraction delivers its one-definition promise**: the golden suite iterates the same catalog the Workbench renders.
- **Determinism is real**: injectable `FrameClock`, pure-`value` progress, `kittyKeyboard` + `flushSync` discipline documented with reasons in `docs/testing.md`.

---

## 5. Recommended remediation order

1. **Fix the Workbench wide layout** (P0-1): mount `Live` in the wide branch; right column = scenario strip + live pane (flexGrow) + one-line usage. ~Half a day.
2. **Replace `pane`/`liveFocused` with a single `focus` model** (P0-2): `Tab` cycles `components → scenarios → live`, arrows always route to the visible focused target. ~Half a day.
3. **Harden the Workbench tests** (P0-3, P2-3): library-only glyph assertions at all five widths; navigation invariant after every documented key; `w` asserts rendered-width change.
4. **Correct README/CURRENT_STATUS** workbench sections (P1-1); commit the tree (P3-5).
5. **Widen the gate** (P2-1): visual suite into `verify`; `consumer:verify:all` into the release gate.
6. **Silence the `act()` warnings** (P2-2).
7. Then, in any order: per-item `peerDependencies` in the registry builder (P3-2), `Group` error presentation (P3-3), `Log` suffix budget (P3-4), cosmetic warts (P3-5), and — as the next feature, not debt — `Autocomplete` (P1-2).
8. When the repository is public: execute the documented `bunx shadcn@latest add` command once and record it (P3-1).

---

## Appendix — reproduction one-liners

Live pane missing at wide widths (after fixing, this must print `true` at every width):

```tsx
const setup = await testRender(<Workbench />, { width: 120, height: 30, kittyKeyboard: true });
await setup.renderOnce();
console.log(/[◆◇●○■▲◻◼]/.test(setup.captureCharFrame())); // today: false at 80/120/160
```

Tab kills arrows (after fixing, arrows must always do something visible):

```tsx
// wide: press TAB then ARROW_DOWN twice — cursor row must move (today: frozen)
// narrow: press TAB then ARROW_DOWN — frame must change (today: unchanged)
```

---

## Addendum — remediation outcome (2026-09-29, same day)

All findings were remediated on a branch (`remediation/audit-2026-09-29`) using builder subagents with an independent verifier pass per wave. Verification was re-executed after every wave, not trusted from builder reports.

### Erratum

**P2-1 was partly wrong in the original report.** It claimed `bun run verify` "does not run the visual suite." In fact `verify`'s plain `bun test` already ran all test files, including the 68 visual tests — the "173 tests" in §1 already included them (105 unit/interaction/fixture + 68 visual across 7 files). The real gap was only that `verify` ran `consumer:verify` (one item) instead of `consumer:verify:all`. Fixed accordingly.

### What was applied

| Item | Resolution |
| --- | --- |
| P0-1 live pane missing at ≥72 cols | `Live` now mounted in both layouts; old metadata box replaced by a one-line usage strip (keys moved into HelpOverlay). Probe: library glyphs present at 40/60/80/120/160, and in a real pty at 120 columns. |
| P0-2 Tab breaks navigation | `pane` + `liveFocused` replaced by one `focus: "components" \| "scenarios" \| "live"` model; Tab cycles; arrows always route to the focused target and fall through to the live component. Reproduced failures no longer reproduce. |
| P0-3 tests pass for wrong reasons | Workbench tests now assert a library-only glyph class at every responsive width, an arrow-routing invariant (including through to the live Select), and that `w` re-renders the component at the simulated width. |
| Bonus defect found during remediation | `w` was **cosmetic** — `scenario.render()` never received the simulated width. Fixed with `SimulatedWidthProvider` in `src/hooks/use-available-width.ts` (prop > context > renderer); the Workbench wraps the live pane in it. |
| P1-1 docs overstate | README, CURRENT_STATUS, architecture/testing/registry docs rewritten to match; the docs pass also removed two phantom exports (`useNavigateConfirmHints`, `KeyHint`) and corrected the 72-column breakpoint description. |
| P1-2 Autocomplete | Implemented as a full vertical slice: component on the Prompt shell, 22 unit tests, 5 scenarios + goldens, 14th registry item, clean-consumer fixture. 14/14 consumers install, typecheck, render. |
| P2-1 gate | `verify` now runs `consumer:verify:all`. (Visual suite was already covered by plain `bun test` — see erratum.) |
| P2-2 act() warnings | Eliminated: harness and suite presses wrapped in `act`, renderer teardown act-scoped, `exitOnCtrlC: false` in the test harness (OpenTUI's default Ctrl+C destroy ran outside act; component behavior unchanged). `bun test` warning count: 0. |
| P3-1 real `shadcn add` | Still pending — requires a public repository. Unchanged. |
| P3-2 per-item dependencies | `dependencies` emitted per item as npm spec strings derived from each item's real bare imports (`react@>=19.2.0`, `@opentui/core@>=0.5.0`, …). A map form was rejected by the real `shadcn registry validate` (schema: `dependencies` is `Array<string>`); spec strings are the schema's shape. |
| P3-3 Group error | Now the Prompt shell's error row (error marker + ErrorText inside the rail grammar); golden `task-group-error` updated. |
| P3-4 Log suffix | Width budget now applied (reserve matches the rendered `  suffix`); truncation verified at narrow widths. |
| P3-5 warts | Label/Muted/ErrorText composed (output byte-identical); catalog import path fixed; `q` → `onQuit` prop; work committed; CI added (`.github/workflows/ci.yml` runs `bun run verify`, node for the shadcn CLI + bun 1.4). |

### Final verified state

`bun run verify` exit 0 — typecheck, lint, **208 tests / 0 fail** (includes 73 visual goldens, 0 act warnings), registry valid (**14 items / 27 files**, real shadcn CLI), **14/14** clean-consumer installs. Workbench: live component glyphs at all five spec widths in the test renderer and in a real pty; focus cycling and arrow routing verified by probe.

### Residual notes

1. **Registry dependency derivation is blind to the compiler-injected `jsx-runtime` import** — it parses source `import` statements only, so `.tsx` items understate `@opentui/react` in their `dependencies`. Harmless for any real OpenTUI consumer (which necessarily has `@opentui/react`), and `registry:validate`'s import-graph check is consistent with the same rule, but a future builder improvement could count `.tsx` files as `@opentui/react` importers.
2. **P3-1** (`bunx shadcn add <owner>/<repo>/select` executed against the hosted registry) remains open until the repository is public.
3. `Autocomplete`'s option-row `"disabled"` marker branch is unreachable by construction (disabled options are filtered out before rendering) — defensive, kept for symmetry with `Select`.

### Residuals resolved (2026-09-29, repository now public)

1. **jsx-runtime blind spot — fixed.** The registry builder now credits any
   item containing a `.tsx` file with an `@opentui/react` dependency (the root
   tsconfig compiles JSX against `@opentui/react`'s runtime, and no source
   `import` names the injected `jsx-runtime`). Rebuilt, re-validated by the
   real CLI, 14/14 clean consumers still pass. `docs/registry.md`'s blind-spot
   paragraph is replaced by the rule.
2. **Real hosted-registry install — verified.** The repository is
   `GodSpeedAI/Terminal-UI`; the remediation branch was fast-forward-merged to
   `main` so the default branch carries the registry (the CLI resolves
   dependency addresses against the default branch). In a throwaway consumer:
   `bunx shadcn@latest add GodSpeedAI/Terminal-UI/select` resolved `select`
   plus its five dependencies from the hosted registry, created 19 files under
   `src/components/terminal-ui/`, installed the item-declared npm dependencies,
   and the copied source typechecked and rendered the exact reference grammar.

Additional fix surfaced by (2): shadcn 4.21.0 resolves a *bare*
`registryDependencies` name against its upstream style registry, not the
originating GitHub repository — so the manifest now emits dependencies as full
`owner/repo/item` addresses. That routing is what makes the documented
`add <owner>/<repo>/<select>` command work; see `docs/registry.md`
("Dependency addresses, not bare names"). The placeholder homepage is also
gone: `registry.json`'s `homepage` is derived from the real `GITHUB_SLUG`.
