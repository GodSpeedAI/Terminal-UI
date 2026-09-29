import type { ReactNode } from "react";
import { useTheme } from "../theme/context.js";
import type { MarkerState, StatusState } from "../theme/state.js";
import type { Glyph } from "../theme/types.js";
import { markerGlyph, markerStyle, paint, statusGlyph, statusStyle } from "../utils/style.js";

/**
 * A single rail cell.
 *
 * The rail is the spine of the grammar, so it is a primitive rather than a
 * string template. Every prompt row renders exactly one `RailCell` at column 0;
 * because the cell owns its own width, alignment survives narrow terminals and
 * ASCII fallbacks whose glyphs are not all one cell wide.
 */
export interface RailProps {
  /** Which rail glyph to draw. Defaults to the vertical bar. */
  variant?: "bar" | "start" | "end";
  /** Paint the rail muted, as a block that has already resolved. */
  muted?: boolean;
}

export function Rail({ variant = "bar", muted = false }: RailProps) {
  const { theme } = useTheme();
  const g: Glyph = theme.rail[variant];
  const base = theme.railStyles[variant];
  const style = muted ? { color: base.color, dim: true } : base;
  return (
    <box flexShrink={0} width={g.width}>
      <text content={paint(g.char, style)} />
    </box>
  );
}

/**
 * A state marker.
 *
 * `<Marker state="active" />` is the only way a component expresses a state
 * glyph. The mapping from state to glyph and color lives in the theme, so
 * adding a theme never requires touching a component.
 */
export interface MarkerProps {
  state: MarkerState;
  /** Override the theme glyph. For one-off annotations, not state. */
  glyph?: Glyph;
  /** Render muted regardless of the state's own paint. */
  muted?: boolean;
}

export function Marker({ state, glyph: override, muted = false }: MarkerProps) {
  const { theme } = useTheme();
  const g = override ?? markerGlyph(theme, state);
  const base = markerStyle(theme, state);
  const style = muted ? { color: base.color, dim: true } : base;
  return (
    <box flexShrink={0} width={g.width}>
      <text content={paint(g.char, style)} />
    </box>
  );
}

/**
 * A severity indicator, rendered standalone on a rail line.
 *
 * Separate from `Marker` because severity is a different axis from lifecycle: a
 * task can be failed *and* still be the currently running step, and conflating
 * the two forces one of them to lose information.
 */
export interface StatusProps {
  state: StatusState;
  glyph?: Glyph;
}

export function Status({ state, glyph: override }: StatusProps) {
  const { theme } = useTheme();
  const g = override ?? statusGlyph(theme, state);
  return (
    <box flexShrink={0} width={g.width}>
      <text content={paint(g.char, statusStyle(theme, state))} />
    </box>
  );
}

/**
 * A rail row: one rail cell followed by body content.
 *
 * This is the single horizontal composition unit. Prompts, notes, logs, and
 * task lists are all stacks of `RailRow`, which is what keeps their alignment
 * identical without any of them reimplementing the geometry.
 */
export interface RailRowProps {
  children?: ReactNode;
  /** Which rail glyph leads the row. */
  variant?: "bar" | "start" | "end";
  /** Hide the rail glyph but keep the column, preserving alignment. */
  rail?: boolean;
  /** Indent the body past the rail. Defaults to the theme's `bodyIndent`. */
  indent?: number;
  /** Extra blank rows above this row. */
  gapBefore?: number;
  /** Muted rail, for content that has already resolved. */
  muted?: boolean;
}

export function RailRow({
  children,
  variant = "bar",
  rail = true,
  indent,
  gapBefore = 0,
  muted = false,
}: RailRowProps) {
  const { theme } = useTheme();
  const bodyIndent = indent ?? theme.spacing.bodyIndent;
  return (
    <box flexDirection="column" width="100%">
      {Array.from({ length: Math.max(0, gapBefore) }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical filler rows; position is the identity
        <box key={`gap-${i}`} height={1} />
      ))}
      <box flexDirection="row" width="100%">
        {rail ? <Rail variant={variant} muted={muted} /> : <box width={theme.spacing.railWidth} />}
        <box flexDirection="column" flexGrow={1} paddingLeft={bodyIndent} minWidth={0}>
          {children}
        </box>
      </box>
    </box>
  );
}
