# Architecture

The decisions a maintainer needs, and the reasons behind them. Design tokens
live in [visual-language.md](./visual-language.md); distribution lives in
[registry.md](./registry.md); the test strategy lives in [testing.md](./testing.md).

## The dependency rule

Three layers, and imports only ever point downward:

    theme        the semantic state vocabulary and how it is painted
    primitives   rail, marker, label, hint, status, separator
    components   prompts and feedback, composed from the primitives
    scenario     the Workbench + visual-test catalogue, on top of components

- `theme` knows nothing about rendering a prompt.
- `primitives` knows nothing about prompts, options, or lifecycle.
- `components` know nothing about the Workbench or the tests.

This is the load-bearing constraint of the whole library. It is what lets a new
theme restyle everything without touching a component, and what keeps copied
registry source free of hidden internal dependencies: a copied `Select` is
`Prompt` + `RailRow` + `Marker` + `Label`, and every one of those is itself a
registry item.

## Semantic state, not literal styling

A component never names a glyph or a colour. It names a state:

```tsx
<Marker state="active" />
<Status state="error" />
```

The theme is a total function from that vocabulary to presentation. Three ship:

| Theme | Glyphs | Notes |
| --- | --- | --- |
| `clackTheme` (default) | Unicode, restrained colour | reference grammar |
| `asciiTheme` | 7-bit only | first-class, not a degraded mode |
| `highContrastTheme` | Unicode, no `dim` | for terminals where `dim` is a no-op |

`defineTheme` completes a partial theme, so adding a state to the vocabulary
cannot break a third-party theme — a missing entry falls back to a documented
neutral rather than rendering `undefined`.

State is always carried by **glyph shape first**, colour second. That is why
`--color=never`, an 8-colour terminal, and a monochrome pipe all still read
correctly, and it is the reason `highContrastTheme` can change emphasis without
changing meaning.

### Status is a separate axis from lifecycle

`Theme.markers` and `Theme.statuses` are separate maps. `log.success` uses `◆`
while a submitted *step* uses `◇`; a neutral `step` status is `◇` and `muted`
emphasis is `○`. Conflating them would mean losing the ability to show "these
are the steps, and this is how it went" — the two are genuinely different
things, and the reference grammar gives them different glyphs.

## The Prompt shell

`Prompt` owns the rail, the question, the hint row, error presentation, and the
**active → submitted collapse**. Controls contribute only their body and their
collapsed summary:

```tsx
<Prompt message="Choose environment" state={phase} summary={<Label value>Production</Label>}>
  <SelectBody />
</Prompt>
```

That is why `Select` contains no prompt-shell logic of its own. The collapse —
`◇  Choose environment  Production` — is the primary feedback that input was
accepted, and because it lives in the shell, every control gets it identically.

The shell's own marker stays `◆` while it is rejecting input. The rejection is
carried by the error row beneath it, which has its own `■`. Painting the
question red as well claims the prompt *failed* when what happened is that one
answer was refused, and it contradicts the still-visible hint row promising you
can try again.

## The state machine

`src/theme/state.ts` holds the lifecycle as a **transition table**, not a bag of
booleans:

```text
  idle ──focus──▶ active ──submit──▶ validating ──submit──▶ complete
                     │  ▲                 │
                     │  └── change ───────┘
                     ▼
                   error ──submit──▶ validating
                     │
                  cancel
                     ▼
                 cancelled
```

`usePromptState` is a thin wrapper over it. Two consequences:

- An illegal transition is a **no-op**, not a state the component never
  considered rendering.
- The table is data, so `tests/interaction/inputs.test.tsx` can assert the whole
  graph instead of exercising a handful of paths.

The submit path is deliberately split: `submit()` moves to `validating`, then
validation resolves it to `complete` or `error`. That is what makes "validate on
every keystroke" and "validate on submit" the same machinery with a different
trigger.

## Focus ownership is explicit

`usePromptKeys({ active, ... })` unsubscribes entirely when `active` is false.
An inactive prompt cannot consume a keystroke intended for the active one, and
nested interactive components therefore do not fight.

Ctrl+C is routed to an explicit `cancel` channel rather than falling through, so
every prompt decides what cancellation means instead of one control silently
swallowing it. Escape is handled the same way.

There is a separate `command` channel, checked **before** printable routing.
Without it, a shortcut like `/` or `?` is classified as ordinary typed text and
handed to `print` — an application-level command silently becomes a character
in the user's input.

This is what the Workbench runs into immediately: a live `Select` in the preview
pane eats `↓` whether or not you are looking at it. The Workbench therefore has
an explicit `liveFocused` flag. Lists own keys until you ask for the component;
only then do arrows mean "move the cursor inside the Select". See
`workbench/app/workbench.tsx`.

## The Scenario abstraction

`src/scenario/` defines one description of "what `Select` looks like when it is
empty", shared by three consumers: the Workbench sidebar, the visual
regression suite, and (by construction) documentation.

```tsx
scenario("select-default", () => <Select message="Choose environment" options={ENVIRONMENTS} />, {
  width: 60,
  description: "The default list.",
});
```

The payoff is that a component cannot be green in the visual suite and stale in
the Workbench, because there is only one definition of what either shows. The
format is deliberately not a Storybook story — it has no runner, no serializer,
and no framework coupling.

`Scenario.steps` lets a fixture reach a state that is awkward as an initial prop
("navigate twice, then submit"), and the Workbench replays the same steps.

## Widths are resolved, not passed

`useAvailableWidth(override?)` returns the renderer's real width unless an
override is given. Components truncate **by default** rather than only when
their author remembered to pass a prop — the alternative is a bug that appears
at 40 columns in a customer's terminal and nowhere else.

The override exists for the Workbench and the visual suite, which need to
simulate a narrower terminal than the one they are running in, so that two
states can be compared at the same width.

Terminal cell-width arithmetic lives in `src/utils/text.ts` (East Asian Width +
combining marks). OpenTUI does not export a helper, and correctness is not
optional: measure a label narrower than the terminal does and every marker
drifts out of alignment, which is the single most visible way a rail-based
layout breaks.

## Animation is injectable

The spinner and progress bar are the only animated components. Both read frames
from `FrameClock`, supplied by `FrameProvider`. Production gets an interval
clock; tests pass `createManualClock()` and step it.

This is the difference between an exact fixture and a sampled one. `Progress` is
a pure function of `value` and needs no clock at all, so `progress-0`,
`progress-50`, and `progress-100` are exact. Nothing in the suite waits on wall
time.

## The Workbench does not use this library

Deliberate. The rail grammar is the subject under inspection; wrapping the
explorer in it would make it impossible to see where a component's output
starts and stops. The Workbench uses plain boxes, one accent colour, and its own
`txt()` helper in `workbench/format.ts`.

It renders the *production* components straight from their scenarios. There is
no preview reimplementation that could drift from the real thing.

It reads dimensions from `useTerminalDimensions()` rather than
`process.stdout`, so the responsive layout is driven by whatever is hosting it.
In production that is the terminal; in the visual suite it is the test renderer,
which is the only way a responsive regression can be caught by a fixture rather
than by someone noticing a squeezed pane.

## Layout approach, and where it is deliberately avoided

Rows are composed from `box` elements with explicit widths. Flex is used for
*distribution* (growing a pane, absorbing slack) and avoided for *composition*,
where the geometry is known in advance.

`Note` is the clearest case. A frame is a fixed-width diagram: every edge has to
land on the same column or it does not close. Deriving those columns through
flex produced corners a cell apart and a right-hand bar that drifted. Composing
each row as one pre-composed text run makes closure arithmetic, and therefore
testable — `tests/unit/note.test.tsx` asserts that all edges agree.

## Extension path

The planned full-application components — Tree, Table, Tabs, SplitPane,
CommandPalette, Inspector, DataList, Timeline, ActivityFeed, Diff, CodeBlock,
Markdown viewer, Form, Wizard — are **not** implemented. What exists is chosen so
they are not awkward to add later:

- A closed state vocabulary and a total theme function, so they inherit the
  grammar rather than re-inventing markers.
- `RailRow` as the horizontal unit, so a tree row and a prompt row align.
- Scenarios as the single description, so each new component gets Workbench
  coverage and visual fixtures for free.
- `usePromptKeys` for keyboard ownership, so a `Tree` with a scrollable body
  does not invent a new focus model.

A component that wants a real box is free to use one; the rail grammar is the
default for prompt and task surfaces, not a straitjacket on the whole library.
