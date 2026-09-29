import type {
  LifecycleState,
  MarkerState,
  SelectionState,
  StatusState,
  ToneState,
  VisualState,
} from "./state.js";

/**
 * A color as OpenTUI accepts it.
 *
 * Kept as a string union plus `(string & {})` so that theme authors get
 * autocomplete for the named ANSI slots we rely on while still being able to
 * pass a hex literal.
 */
export type ThemeColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite"
  | (string & {});

/**
 * How a marker is painted.
 *
 * `dim` is a separate axis rather than a color so that the high-contrast theme
 * can drop it without redefining every token.
 */
export interface MarkerStyle {
  color: ThemeColor;
  dim?: boolean;
  bold?: boolean;
  underline?: boolean;
  /**
   * Reverse video. Used for the text cursor and for the placeholder's leading
   * cell — the two places where a block has to read as a block rather than as
   * text in the terminal's own foreground.
   */
  inverse?: boolean;
}

/** A glyph with an explicit column width, so ASCII fallbacks stay aligned. */
export interface Glyph {
  readonly char: string;
  readonly width: number;
}

/**
 * Spacing rhythm, in rail columns.
 *
 * Themes own spacing so that a theme can loosen the vertical rhythm without any
 * component learning about it.
 */
export interface ThemeSpacing {
  /** Width of the rail column. Must be 1 for the glyphs to line up. */
  railWidth: number;
  /** Body indent past the rail. */
  bodyIndent: number;
  /** Space between a step marker and its label. */
  labelGap: number;
  /** Space between an option marker and its label. */
  optionGap: number;
  /** Space before the trailing hint terminator. */
  hintGap: number;
  /** Blank rows between sections inside one prompt body. */
  rowGap: number;
  /** Blank rows between top-level blocks. */
  blockGap: number;
}

/**
 * The complete visual contract.
 *
 * A theme is a total function from the semantic vocabulary to presentation. If
 * a state is missing from `markers` or `statuses`, the theme is incomplete and
 * `createTheme` will fall back to a documented default rather than rendering
 * `undefined`.
 */
export interface Theme {
  /** Stable identifier, used by the Workbench switcher and in tests. */
  readonly name: string;
  /** True when the theme's glyph set is 7-bit ASCII only. */
  readonly ascii: boolean;
  readonly spacing: ThemeSpacing;

  /**
   * Rail and bar glyphs. `bar` is the vertical spine; `start` and `end`
   * terminate a block.
   */
  readonly rail: {
    readonly bar: Glyph;
    readonly start: Glyph;
    readonly end: Glyph;
  };

  /** Glyphs for the full state vocabulary. */
  readonly markers: Readonly<Record<MarkerState, Glyph>>;

  /** Glyphs for severity/status reporting. */
  readonly statuses: Readonly<Record<StatusState, Glyph>>;

  /** Paint for each state, used by `Marker` and `Status`. */
  readonly markerStyles: Readonly<Record<MarkerState, MarkerStyle>>;

  /** Paint for each status. */
  readonly statusStyles: Readonly<Record<StatusState, MarkerStyle>>;

  /** Paint for rail and bar glyphs. */
  readonly railStyles: {
    readonly bar: MarkerStyle;
    readonly start: MarkerStyle;
    readonly end: MarkerStyle;
  };

  /**
   * Emphasis tokens. `label` is the default body text; `muted` is supporting
   * text; `hint` is keyboard help.
   */
  readonly text: {
    readonly label: MarkerStyle;
    readonly value: MarkerStyle;
    readonly muted: MarkerStyle;
    readonly hint: MarkerStyle;
    readonly hintKey: MarkerStyle;
    readonly error: MarkerStyle;
  };

  /** Progress bar fill. `active` is filled, `inactive` is empty. */
  readonly progress: {
    readonly active: Glyph;
    readonly inactive: Glyph;
  };

  /** Spinner animation frames, in order. Must be non-empty. */
  readonly spinnerFrames: readonly Glyph[];

  /** Characters used to draw the `Note` frame. */
  readonly note: {
    readonly topLeft: Glyph;
    readonly topRight: Glyph;
    readonly bottomLeft: Glyph;
    readonly bottomRight: Glyph;
    readonly horizontal: Glyph;
    readonly vertical: Glyph;
  };

  /** Key-hint separator between hint pairs. */
  readonly hintSeparator: Glyph;

  /** Trailing terminator appended to a hint line. */
  readonly hintTerminator: Glyph;

  /** Mask character for `PasswordInput`. */
  readonly passwordMask: Glyph;

  /**
   * Human-readable key labels.
   *
   * These are presentation, not semantics: the ASCII theme has to be able to
   * spell `Up/Dn` because `↑/↓` would leak a non-ASCII glyph into a theme whose
   * entire purpose is 7-bit output. Components build their default hints from
   * this map rather than hard-coding key names.
   */
  readonly keys: Readonly<{
    up: string;
    down: string;
    left: string;
    right: string;
    enter: string;
    escape: string;
    space: string;
    tab: string;
  }>;
}

/** Every state a theme must define a glyph for. */
export const MARKER_STATES: readonly MarkerState[] = [
  "active",
  "pending",
  "running",
  "complete",
  "selected",
  "unselected",
  "checked",
  "unchecked",
  "error",
  "warning",
  "cancelled",
  "disabled",
  "info",
  "success",
  "step",
  "muted",
] as const;

/** Every state a theme must define a status glyph for. */
export const STATUS_STATES: readonly StatusState[] = [
  "step",
  "info",
  "success",
  "warning",
  "error",
  "cancelled",
  "muted",
] as const;

/** The states that read as a lifecycle step in the rail. */
export const LIFECYCLE_STATES: readonly LifecycleState[] = [
  "active",
  "pending",
  "running",
  "complete",
  "error",
  "cancelled",
] as const;

/** The states that read as membership in a set. */
export const SELECTION_STATES: readonly SelectionState[] = [
  "selected",
  "unselected",
  "checked",
  "unchecked",
] as const;

/** The states that read as severity. */
export const TONE_STATES: readonly ToneState[] = ["info", "success", "warning", "error"] as const;

/** Type guard: does this string name a state the theme vocabulary defines? */
export function isVisualState(value: string): value is VisualState {
  return (MARKER_STATES as readonly string[]).includes(value);
}

/** A single-cell glyph. */
export function glyph(char: string, width = 1): Glyph {
  return { char, width };
}
