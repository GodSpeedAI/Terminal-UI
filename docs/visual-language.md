# Visual language

This document is the design contract for `@terminal-ui/react`. It records the
visual system **we own** — glyphs, colors, spacing, and state transitions — so
that the library can be maintained without the implementation being present.

The reference is Clack (`@clack/prompts`), studied as a *visual grammar only*.
No Clack code is vendored, imported, or required at runtime. Every token below
was established by observing rendered output, then re-specified in our own
vocabulary so components never hard-code a literal glyph or color.

## Method

Tokens were verified by running Clack v1.8.1 (`@clack/core` 1.5.1) under a pty,
intercepting `process.stdout.write`, and decoding the SGR attributes attached to
each emitted glyph. Values below are the observed ANSI SGR codes mapped to names.
Where Clack's behavior is ambiguous we follow the *documented intent* of the
grammar (rail-oriented, marker-driven, restrained color) rather than replicating
an accident of its renderer.

## The rail is the primitive

The vertical rail is the spine of every prompt. It carries structure without
boxes:

    ┌                      <- bar start
    │
    ◆ Choose environment   <- active step, marker + label on the rail line
    │
    │  ● Production        <- indented body, 2 spaces past the rail
    │  ○ Staging
    │
    └                      <- bar end

Rules:

- The rail glyph occupies exactly **column 0**. Everything else is indented.
- Body content is indented **2 spaces** past the rail.
- Rails are **1 column wide**. Any width drift breaks glyph alignment.
- The rail is drawn one row per line. We do not attempt a single tall `│`
  glyph spanning many rows; a per-row rail cell is more robust under wrapping
  and narrow terminals, and it makes each row independently testable.

## State vocabulary

Components express state through a closed vocabulary. Themes map vocabulary to
glyphs and colors. Components never reference a glyph or a color literal.

| State      | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `active`   | currently focused, awaiting user input         |
| `pending`  | queued, not started                            |
| `running`  | in flight, animating                           |
| `complete` | finished successfully                          |
| `selected` | chosen within a set                            |
| `unselected` | not chosen within a set                      |
| `checked`  | checkbox on                                    |
| `unchecked`| checkbox off                                   |
| `error`    | failed validation                              |
| `warning`  | non-fatal problem                              |
| `cancelled`| aborted by user                                |
| `disabled` | not interactive                                |
| `muted`    | de-emphasised supporting text                  |

## Marker glyphs (default Clack-inspired theme)

Observed reference values, in SGR terms:

| Role                | Glyph | SGR | Our color token  |
| ------------------- | ----- | --- | ---------------- |
| bar start           | `┌`   | 90  | `rail`           |
| rail                | `│`   | 90  | `rail`           |
| bar end (active)    | `└`   | 36  | `accent`         |
| bar end (settled)   | `└`   | 90  | `rail`           |
| step active         | `◆`   | 36  | `accent`         |
| step complete       | `◇`   | 32  | `success`        |
| step error          | `■`   | 31  | `danger`         |
| step warning        | `▲`   | 33  | `warning`        |
| log step            | `◇`   | 90  | `muted`          |
| log info            | `●`   | 34  | `info`           |
| log success         | `◆`   | 32  | `success`        |
| option selected     | `●`   | 36  | `accent`         |
| option unselected   | `○`   | 2   | `muted` + dim    |
| checkbox unchecked  | `◻`   | 39  | `muted`          |
| checkbox checked    | `◼`   | 36  | `accent`         |
| cancel              | `■`   | 31  | `danger`         |
| note marker         | `◇`   | 32  | `success`        |
| key separator       | `•`   | 2   | `muted`          |

**Never rely on color alone.** Every state also has a distinct glyph, so the
grammar survives `--color=never`, low-color terminals, and monochrome output.

## ASCII theme

Every glyph above has a 7-bit ASCII counterpart. The ASCII theme is selected
explicitly (`asciiTheme`) or forced via the Workbench toggle. It is never
inferred automatically, because terminals do not reliably advertise Unicode
support and a wrong guess is worse than a deliberate choice.

| Role               | Unicode | ASCII    |
| ------------------ | ------- | -------- |
| bar start / end    | `┌` `└` | `+` `-`  |
| rail               | `│`     | `|`      |
| step active        | `◆`     | `*`      |
| step complete      | `◇`     | `o`      |
| step error/cancel  | `■`     | `x`      |
| step warning       | `▲`     | `!`      |
| log info           | `●`     | `i`      |
| option selected    | `●`     | `>`      |
| option unselected  | `○`     | ` `      |
| checkbox unchecked | `◻`     | `[ ]`    |
| checkbox checked   | `◼`     | `[x]`    |
| hint terminator    | `…`     | `~`      |
| key separator      | `•`     | `-`      |
| progress filled    | `█`     | `#`      |
| progress empty     | `░`     | `.`      |
| spinner frames     | `◒◐◓◑` | `|/-\`   |

## High-contrast theme

`highContrastTheme` reuses the Clack glyphs but replaces dim/muted text with
fully-saturated foreground colors and promotes bold on the active marker. It
exists for low-contrast environments and for terminals that render `dim`
identically to normal weight. State is still carried by glyph shape, so the
high-contrast theme changes *emphasis*, not *meaning*.

## Spacing and rhythm

Spacing is measured in rail columns, not pixels, and is a theme-level concern so
that a theme can loosen or tighten the rhythm without touching components.

| Token                | Default | Meaning                                        |
| -------------------- | ------- | ---------------------------------------------- |
| `railWidth`          | 1       | width of the rail column                       |
| `bodyIndent`         | 2       | body indent past the rail                      |
| `labelGap`           | 2       | space between a step marker and its label      |
| `optionGap`          | 1       | space between option marker and option label   |
| `rowGap`             | 0       | blank rows between prompt body sections        |
| `blockGap`           | 1       | blank rows between top-level blocks            |

Vertical rhythm comes mostly from these numbers plus intentional blank rows.
Prompts do not add decorative leading or trailing blank lines.

## Hints and key hints

The keyboard hint is the last rail row of a block. Its verified shape is:

    │  ↑/↓ to navigate • Enter: confirm

Rules:

- Pairs are `key: description`, joined by ` • ` (spaces on both sides).
- A **named** key uses a colon (`Enter: confirm`). A **symbol** key already
  reads as a unit, so it uses a space instead (`↑/↓ to navigate`); a colon
  after `↑/↓` reads as punctuation noise.
- There is **no trailing terminator.** The hint row is already last in the
  block; adding an ellipsis to it only competes with the rail.
- When the row cannot fit, the hint collapses to its **first pair only**
  rather than wrapping or truncating mid-word. Hints are supplementary, so
  they degrade before body content does.

Key labels are theme data (`theme.keys`), not literals in components. That is
what lets the ASCII theme spell `Up/Down` instead of leaking `↑/↓` into a
theme whose whole purpose is 7-bit output.

Hints are supplementary. No functionality is reachable only through a hint.

## Notes and logs

A `Note` is the one place the grammar uses a frame, because free-form
multi-line text has no natural rail representation:

    │
    ◇  Note Title ─╮
    │              │
    │  body line   │
    │              │
    ├──────────────╯

The `◇` is the success marker, the frame is drawn in the muted color, and the
body keeps the standard 2-column indent. A note is a *blockquote*, not a
panel — it still hangs off the rail.

Log lines are a single rail row each, using the `status` glyph set:

    │
    ◇  step
    ●  info
    ◆  success
    ▲  warning
    ■  error

`log.success` uses `◆` while a submitted *step* uses `◇`. That is deliberate:
severity and lifecycle are different axes, which is why the theme exposes
separate `markers` and `statuses` maps.

## Active → submitted transition

A completed prompt does not freeze in its active shape. It collapses:

    ◆ Choose environment          ◇ Choose environment  Production
    │
    │  ● Production        ->     (rail continues below)
    │  ○ Staging
    │
    └

The collapse is the primary feedback that input was accepted. It is what makes
a transcript of prompts readable. Components implement it by rendering the
submitted summary through the same `Prompt` shell in `complete` state, so no
component reimplements collapse.

## Error presentation

Validation errors stay inside the rail grammar. They render as an extra rail
line in `error` state with the `■` marker and the message, directly beneath the
prompt body:

    ◆ Project name
    │  demo
    │  ■ must be at least 3 characters
    │

No alert boxes, no color-only signaling, no detached modals.

## Narrow terminals

At narrow widths the rail grammar is preserved and the *body* truncates or
wraps — the rail never does. Rules:

- The rail column is never dropped.
- Long option labels truncate from the right with an ellipsis when the
  available width cannot fit the label.
- Hints are dropped before body content is truncated, because a hint is
  supplementary and an option is not.
- `Hint` degrades to a compact form below a theme-defined width rather than
  wrapping into an unreadable block.

The full application components planned later (Table, Tree, SplitPane) are
expected to be usable in the same widths, which is why the rail is expressed as
a width-1 primitive rather than baked into string templates.

## Accessibility commitments

1. Every state has a distinct glyph. Color is redundant, never load-bearing.
2. An ASCII theme exists and is a first-class theme, not a degraded mode.
3. A high-contrast theme exists for environments where `dim` is unsupported.
4. Keyboard navigation is predictable and never requires a mouse.
5. No Nerd Font, no private-use codepoint, and no glyph outside Latin-1 +
   common geometry blocks is required for correct meaning.
6. Unselected options use a *shape* difference (`○` vs `●`), not a color
   difference, so they remain distinguishable at any color depth.

## Attribution

Clack is MIT licensed and was used here purely as an observed visual reference
for glyph and color selection. No Clack source was copied or adapted. If that
ever changes, this library must carry Clack's MIT notice and attribution in
`THIRD_PARTY_NOTICES.md`.
