import type { MarkerState, StatusState } from "./state.js";
import {
  type Glyph,
  glyph,
  MARKER_STATES,
  type MarkerStyle,
  STATUS_STATES,
  type Theme,
  type ThemeColor,
  type ThemeSpacing,
} from "./types.js";

/**
 * The spacing rhythm shared by every theme.
 *
 * Values are rail columns. Keeping them in one place is what makes the vertical
 * rhythm consistent across the library — the numbers in
 * `docs/visual-language.md` are these values.
 */
export const baseSpacing: ThemeSpacing = {
  railWidth: 1,
  bodyIndent: 2,
  labelGap: 1,
  optionGap: 1,
  hintGap: 1,
  rowGap: 0,
  blockGap: 1,
};

/**
 * A complete theme with safe fallbacks.
 *
 * Themes are authored as partials and completed here, so adding a state to the
 * vocabulary cannot break an existing third-party theme: the missing entry
 * falls back to the documented neutral rather than rendering `undefined`.
 */
export function defineTheme(theme: Partial<Theme> & Pick<Theme, "name">): Theme {
  const fallbackGlyph = glyph("?", 1);
  const fallbackStyle: MarkerStyle = { color: "white" };

  const markers = {} as Record<MarkerState, Glyph>;
  for (const state of MARKER_STATES) {
    markers[state] = theme.markers?.[state] ?? fallbackGlyph;
  }
  const statuses = {} as Record<StatusState, Glyph>;
  for (const state of STATUS_STATES) {
    statuses[state] = theme.statuses?.[state] ?? markers[state] ?? fallbackGlyph;
  }
  const markerStyles = {} as Record<MarkerState, MarkerStyle>;
  for (const state of MARKER_STATES) {
    markerStyles[state] = theme.markerStyles?.[state] ?? fallbackStyle;
  }
  const statusStyles = {} as Record<StatusState, MarkerStyle>;
  for (const state of STATUS_STATES) {
    statusStyles[state] = theme.statusStyles?.[state] ?? markerStyles[state] ?? fallbackStyle;
  }

  return {
    name: theme.name,
    ascii: theme.ascii ?? false,
    spacing: { ...baseSpacing, ...theme.spacing },
    rail: {
      bar: theme.rail?.bar ?? glyph("|", 1),
      start: theme.rail?.start ?? glyph("+", 1),
      end: theme.rail?.end ?? glyph("+", 1),
    },
    markers,
    statuses,
    markerStyles,
    statusStyles,
    railStyles: {
      bar: theme.railStyles?.bar ?? { color: "brightBlack" },
      start: theme.railStyles?.start ?? { color: "brightBlack" },
      end: theme.railStyles?.end ?? { color: "brightBlack" },
    },
    text: {
      label: theme.text?.label ?? { color: "white" },
      value: theme.text?.value ?? { color: "white" },
      muted: theme.text?.muted ?? { color: "brightBlack" },
      hint: theme.text?.hint ?? { color: "white" },
      hintKey: theme.text?.hintKey ?? { color: "brightBlack", dim: true },
      error: theme.text?.error ?? { color: "red" },
    },
    progress: {
      active: theme.progress?.active ?? glyph("#", 1),
      inactive: theme.progress?.inactive ?? glyph(".", 1),
    },
    spinnerFrames: theme.spinnerFrames?.length ? theme.spinnerFrames : [glyph("|", 1)],
    note: {
      topLeft: theme.note?.topLeft ?? glyph("+", 1),
      topRight: theme.note?.topRight ?? glyph("+", 1),
      bottomLeft: theme.note?.bottomLeft ?? glyph("+", 1),
      bottomRight: theme.note?.bottomRight ?? glyph("+", 1),
      horizontal: theme.note?.horizontal ?? glyph("-", 1),
      vertical: theme.note?.vertical ?? glyph("|", 1),
    },
    hintSeparator: theme.hintSeparator ?? glyph("-", 1),
    hintTerminator: theme.hintTerminator ?? glyph("~", 1),
    passwordMask: theme.passwordMask ?? glyph("*", 1),
    keys: {
      up: theme.keys?.up ?? "Up",
      down: theme.keys?.down ?? "Down",
      left: theme.keys?.left ?? "Left",
      right: theme.keys?.right ?? "Right",
      enter: theme.keys?.enter ?? "Enter",
      escape: theme.keys?.escape ?? "Esc",
      space: theme.keys?.space ?? "Space",
      tab: theme.keys?.tab ?? "Tab",
    },
  };
}

/** Reuse one color across every state a theme paints identically. */
export function uniform(color: ThemeColor, dim = false): MarkerStyle {
  return dim ? { color, dim: true } : { color };
}
