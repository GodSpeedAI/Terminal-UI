# Testing

Everything renders through OpenTUI's own test renderer
(`@opentui/react/test-utils`). There is no DOM shim, no second renderer, and no
browser.

## Layout

```text
tests/
  harness.tsx                 the shared mount/drive/capture helper
  unit/                       components, primitives, width arithmetic
  interaction/                keyboard, state transitions, the Workbench
  visual/                     golden frames for every scenario
  fixtures/golden/*.txt       committed golden frames
```

Run them:

```bash
bun test                 # unit + interaction
bun run test:visual      # golden frames
bun run test:update      # regenerate goldens
```

## The harness

Every test mounts through `tests/harness.tsx`. One `renderOnce`, no timers, no
animation frames. "Deterministic" has to mean the same thing everywhere or it
does not mean anything.

```tsx
const h = await render(<Select message="Pick" options={OPTIONS} />, { width: 40 });
h.lines();                 // non-blank rows
await h.key("ARROW_DOWN"); // press, then flush
await h.type("de");        // type literal text
await h.escape();          // press Escape
await h.setWidth(20);      // re-render narrower without remounting
```

### Three things that are not optional

**`kittyKeyboard: true`.** Without the kitty protocol a bare `ESC` is swallowed
as a possible escape-sequence prefix and produces *no key event at all*, and a
literal character arrives glued to a stray `ESC` (`"d"` becomes `"\u001bd"`).
Escape and type-ahead simply cannot be asserted without it.

**`flushSync` around key presses.** The key handler runs synchronously and
calls `setState`. Without a flush boundary the frame is captured mid-update and
every interaction assertion reads stale output. The harness wraps each press:

```ts
flushSync(() => setup.mockInput.pressKey(key));
await setup.flush();
```

**`mockInput.pressEscape()`, not `pressKey("ESCAPE")`.** The latter silently
produces nothing, so a test that "passes" proves nothing.

## Why goldens are text

Frames are stored as plain text files, one per scenario. A text diff shows you
a marker that moved one column or a glyph that changed shape — exactly the
regressions this suite exists to catch. A serialized binary or image snapshot
would hide them behind a checksum.

```text
tests/fixtures/golden/select-default.txt
│
◆  Choose environment
│  ● Production (live traffic)
│  ○ Staging
│  ○ Development
│  ◇ Local only
│  ↑/↓ navigate • Enter: confirm
```

A test compares whole **lines**, not substrings, so a test cannot pass because
the expected text happened to appear somewhere unexpected in a wider frame.

## Scenarios are the fixtures

The golden suite iterates the same `Scenario` definitions the Workbench renders.
`tests/visual/scenarios.test.tsx` captures each one at its declared width and
theme, replays its `steps`, and diffs against the golden.

That is the payoff of the scenario abstraction: a component cannot be green here
and stale in the Workbench, because there is only one definition of what either
shows.

The suite also asserts coverage, not just pixels — scenario names are unique,
every name is a valid fixture name, and every fixture the specification calls
for actually exists. A suite that quietly stops covering something is worse than
one that fails.

## Animation is deterministic by construction

Nothing waits on wall time.

- `Progress` is a pure function of `value` — no clock at all.
- `Spinner` reads frames from `FrameClock`. Tests pass `createManualClock()` via
  `FrameProvider` and step it explicitly; a scenario can also pin a single frame.
- The `spinner` golden is captured at a fixed frame, so it is an exact fixture
  rather than a sampled one.

## What each layer asserts

**Primitives** — every marker state renders its theme glyph, in every theme.
Each theme is checked to declare every state, and to be genuinely ASCII when it
claims to be (a regex over the whole glyph set, not a spot check).

**Prompt shell** — the collapse produces exactly one line; an error renders
inside the rail grammar with its own marker; the question keeps its `◆` while
rejecting.

**Keyboard** — arrows move and wrap, disabled options are skipped, Home/End
jump, type-ahead cycles, Enter submits, Escape and Ctrl+C cancel, and a resolved
prompt ignores further input. A hint is checked to advertise only keys the
control actually binds: a text field must not claim arrow keys.

**State machine** — the transition table is asserted directly: an open prompt can
submit, a resolved one cannot, cancellation is reachable from every open phase,
and an error can be corrected without leaving the flow.

**Width** — the whole suite renders at 40, 60, 80, 120, and 160 columns, and
asserts no row exceeds the viewport. `Note` additionally asserts that all three
frame edges land on the same column, because a frame that does not close reads
as broken.

**Width arithmetic** — East Asian wide characters count as two cells,
combining marks and control characters as zero, truncation respects its budget
including the ellipsis, and wrapping never splits a wide character.

**Workbench** — renders without overflow at all five widths, switches to a
single-column layout below the breakpoint, never collides header and status,
and its commands (`/`, `t`, `a`, `w`, `r`, `?`) all work.

**Registry** — the real shadcn CLI, plus the checks it cannot make. See
[registry.md](./registry.md).

**Clean consumer** — every item installed into a throwaway project, typechecked
against only its peer dependencies, and rendered. See
[registry.md](./registry.md).

## Regression tests for bugs actually found

A few tests exist because they encode something that was wrong and is now
load-bearing:

- **`Note` frame closure.** The corners were a cell apart and the right-hand bar
  drifted, because frame columns were negotiated through flex.
- **Per-line note padding.** Only the widest line was padded; shorter lines
  left the right-hand bar ragged. Now `padFor(line)` is per line.
- **TextInput controlled semantics.** `value` with no `onValueChange` was fully
  controlled, so the field could not be typed into at all. It now falls back to
  initial-value semantics.
- **TextInput batched keystrokes.** React batches the keys that arrive in one
  frame, so the handler read the same stale value for all of them and typing
  `demo` produced `o`. Fixed with a synchronously-updated ref.
- **Confirm marker position.** The labels used to swap with the answer, so the
  row appeared to have changed its options. Now the labels hold still and the
  marker moves.
- **Workbench key stealing.** A live `Select` consumed the sidebar's arrow keys.
  Fixed with an explicit `liveFocused` flag.
- **Command keys swallowed.** `/` and `?` were classified as typed text. Fixed
  with a `command` channel checked before printable routing.
- **Spacing leaks.** A `log.step` glyph that did not exist as a distinct status,
  and a text field advertising arrow keys.
