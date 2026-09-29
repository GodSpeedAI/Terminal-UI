import { parseColor, StyledText, TextAttributes, type TextChunk } from "@opentui/core";
import type { Glyph, MarkerStyle, Theme, ThemeColor } from "../theme/types.js";

/**
 * The bridge between a theme and OpenTUI's styled-text model.
 *
 * Everything in this library paints through `paint`, which is why no component
 * ever names a color or a glyph. Keeping the translation in one function also
 * means a theme author only has to understand `MarkerStyle`.
 */

/** Compose a `TextChunk` from a theme style. */
export function chunk(text: string, style: MarkerStyle): TextChunk {
  let attributes = TextAttributes.NONE;
  if (style.bold) attributes |= TextAttributes.BOLD;
  if (style.dim) attributes |= TextAttributes.DIM;
  if (style.underline) attributes |= TextAttributes.UNDERLINE;
  if (style.inverse) attributes |= TextAttributes.INVERSE;
  return {
    __isChunk: true,
    text,
    fg: parseColor(style.color),
    attributes,
  };
}

/** Build a `StyledText` from already-styled chunks. */
export function styled(chunks: readonly TextChunk[]): StyledText {
  return new StyledText([...chunks]);
}

/** Shorthand for a single styled run. */
export function paint(text: string, style: MarkerStyle): StyledText {
  return styled([chunk(text, style)]);
}

/** Join styled runs into one `StyledText`, dropping empty runs. */
export function joinStyled(parts: readonly StyledText[]): StyledText {
  return styled(parts.flatMap((part) => part.chunks));
}

/** Plain text with no styling, as a `StyledText`. */
export function plain(text: string): StyledText {
  return styled([{ __isChunk: true, text }]);
}

/** The style a theme uses for a marker in a given state. */
export function markerStyle(theme: Theme, state: keyof Theme["markerStyles"]): MarkerStyle {
  return theme.markerStyles[state] ?? theme.text.muted;
}

/** The style a theme uses for a status. */
export function statusStyle(theme: Theme, state: keyof Theme["statusStyles"]): MarkerStyle {
  return theme.statusStyles[state] ?? theme.text.muted;
}

/** The glyph a theme uses for a marker state. */
export function markerGlyph(theme: Theme, state: keyof Theme["markers"]): Glyph {
  return theme.markers[state] ?? theme.markers.muted;
}

/** The glyph a theme uses for a status state. */
export function statusGlyph(theme: Theme, state: keyof Theme["statuses"]): Glyph {
  return theme.statuses[state] ?? theme.statuses.muted;
}

/** Repeat a glyph `count` times. Used for rails, bars, and progress fills. */
export function repeatGlyph(g: Glyph, count: number): StyledText {
  const n = Math.max(0, Math.floor(count));
  return plain(g.char.repeat(n));
}

/**
 * A color for a theme's muted text, resolved to something OpenTUI accepts.
 *
 * Exposed for components that need to pass a color as a prop rather than as a
 * styled chunk — for example a `Box` background.
 */
export function themeColor(color: ThemeColor): string {
  return color;
}
