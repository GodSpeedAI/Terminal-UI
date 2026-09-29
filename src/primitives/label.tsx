import type { ReactNode } from "react";
import { useTheme } from "../theme/context.js";
import type { MarkerStyle } from "../theme/types.js";
import { joinStyled, paint, plain } from "../utils/style.js";
import { stringWidth, truncateToWidth } from "../utils/text.js";

/**
 * A text label rendered in the theme's label style.
 *
 * Labels are the dominant text in the grammar. `Label` exists so that message
 * text, note titles, and task names are painted identically without each
 * component restating a color.
 */
export interface LabelProps {
  children?: ReactNode;
  /** Truncate to this many cells. Omit to let the layout decide. */
  maxWidth?: number;
  /** Dim the label. Used for supporting text. */
  muted?: boolean;
  /** Render in the value style, for committed answers. */
  value?: boolean;
  /** Invert the label, used to mark a text cursor in an empty field. */
  inverse?: boolean;
}

function emphasis(style: MarkerStyle, { muted, inverse }: { muted: boolean; inverse: boolean }): MarkerStyle {
  const next: MarkerStyle = { color: style.color };
  if (style.bold) next.bold = true;
  if (style.dim) next.dim = true;
  if (muted) next.dim = true;
  if (inverse) next.inverse = true;
  return next;
}

export function Label({ children, maxWidth, muted = false, value = false, inverse = false }: LabelProps) {
  const { theme } = useTheme();
  const style = emphasis(value ? theme.text.value : theme.text.label, { muted, inverse });
  const isString = typeof children === "string" || typeof children === "number";
  const raw = isString ? String(children) : null;
  const shown = raw !== null && maxWidth !== undefined ? truncateToWidth(raw, maxWidth) : raw;
  return (
    <box flexShrink={0} flexGrow={raw === null ? 1 : 0} minWidth={0}>
      <text
        content={shown !== null ? paint(shown, style) : undefined}
        fg={style.color}
        wrapMode="none"
        truncate={maxWidth !== undefined}
      >
        {shown === null ? children : undefined}
      </text>
    </box>
  );
}

/** De-emphasised supporting text, such as a hint description or a suffix. */
export function Muted({ children, maxWidth }: { children?: ReactNode; maxWidth?: number }) {
  const { theme } = useTheme();
  const style = emphasis(theme.text.muted, { muted: false, inverse: false });
  const isString = typeof children === "string" || typeof children === "number";
  const raw = isString ? String(children) : null;
  const shown = raw !== null && maxWidth !== undefined ? truncateToWidth(raw, maxWidth) : raw;
  return (
    <box flexShrink={0} flexGrow={raw === null ? 1 : 0} minWidth={0}>
      <text
        content={shown !== null ? paint(shown, style) : undefined}
        fg={style.color}
        wrapMode="none"
        truncate={maxWidth !== undefined}
      >
        {shown === null ? children : undefined}
      </text>
    </box>
  );
}

/** An error message, painted in the theme's error style. */
export function ErrorText({ children, maxWidth }: { children?: ReactNode; maxWidth?: number }) {
  const { theme } = useTheme();
  const style = emphasis(theme.text.error, { muted: false, inverse: false });
  const isString = typeof children === "string" || typeof children === "number";
  const raw = isString ? String(children) : null;
  const shown = raw !== null && maxWidth !== undefined ? truncateToWidth(raw, maxWidth) : raw;
  return (
    <box flexShrink={0} flexGrow={raw === null ? 1 : 0} minWidth={0}>
      <text
        content={shown !== null ? paint(shown, style) : undefined}
        fg={style.color}
        wrapMode="none"
        truncate={maxWidth !== undefined}
      >
        {shown === null ? children : undefined}
      </text>
    </box>
  );
}

/** A single `key: description` pair. */
export interface KeyHintPair {
  /** The key as the user types it, e.g. `Enter`, `Esc`, `↑/↓`. */
  key: string;
  /** What the key does, e.g. `navigate`, `confirm`. */
  description: string;
  /**
   * How the key is joined to its description.
   *
   * `colon` is the default and reads best for a named key (`Enter: confirm`).
   * `space` is right for symbol keys that already read as a unit
   * (`↑/↓ to navigate`), where a colon looks like punctuation noise.
   */
  format?: "colon" | "space";
}

/**
 * The keyboard hint line.
 *
 * Shape is taken from the reference grammar — `key: description` pairs joined
 * by ` • `, the key muted and the description in normal weight. There is no
 * trailing terminator: the hint row is already the last row of the block, and
 * appending a marker to it only competes with the rail.
 *
 * It is a primitive because the Workbench, the visual tests, and the docs all
 * render hints through this one path. Hints are supplementary by contract: no
 * functionality in this library is reachable only through a hint.
 */
export interface HintProps {
  hints: readonly KeyHintPair[];
  /** Append a trailing terminator. Off by default; see above. */
  terminated?: boolean;
  /** Below this many cells, render a compact form instead of the full list. */
  compactBelow?: number;
  /** Available width in cells, used to decide on the compact form. */
  availableWidth?: number;
  /** Override the separator. Defaults to the theme's. */
  separator?: string;
}

/** Width the full hint would occupy, in cells. */
export function hintWidth(hints: readonly KeyHintPair[], separator: string): number {
  if (hints.length === 0) return 0;
  return (
    hints.reduce((sum, h) => sum + stringWidth(h.key) + stringWidth(h.description) + 1, 0) +
    (hints.length - 1) * (stringWidth(separator) + 2)
  );
}

export function Hint({ hints, terminated = false, compactBelow = 28, availableWidth, separator }: HintProps) {
  const { theme } = useTheme();
  const sep = separator ?? theme.hintSeparator.char;
  const shown = hints.filter((h) => h.key !== "" || h.description !== "");

  const pair = (h: KeyHintPair) =>
    joinStyled([
      paint(h.format === "space" ? h.key : `${h.key}:`, theme.text.hintKey),
      paint(` ${h.description}`, theme.text.hint),
    ]);

  const full =
    shown.length === 0
      ? plain("")
      : shown.map(pair).reduce((a, b) => joinStyled([a, paint(` ${sep} `, theme.text.hintKey), b]));

  // The compact form keeps the first pair only, so the row still communicates
  // that more bindings exist without wrapping into an unreadable block.
  const useCompact =
    shown.length > 1 &&
    availableWidth !== undefined &&
    (availableWidth < compactBelow || hintWidth(shown, sep) > availableWidth);

  const body = useCompact ? pair(shown[0] as KeyHintPair) : full;

  return (
    <box flexDirection="row" flexShrink={1} minWidth={0}>
      <text content={body} wrapMode="none" truncate />
      {terminated ? (
        <text content={paint(theme.hintTerminator.char, theme.text.hintKey)} wrapMode="none" />
      ) : null}
    </box>
  );
}

/**
 * A horizontal rule on a rail row.
 *
 * Used to separate groups of log lines without a full box. The rail is kept,
 * because a rule that replaces the rail breaks the spine.
 */
export function Separator({ width, char }: { width?: number; char?: string }) {
  const { theme } = useTheme();
  const fill = char ?? theme.note.horizontal.char;
  return (
    <box flexShrink={0} flexGrow={1} minWidth={0}>
      <text
        content={plain(fill.repeat(Math.max(0, width ?? 20)))}
        fg={theme.text.muted.color}
        wrapMode="none"
        truncate
      />
    </box>
  );
}

/** A blank row, used to space blocks apart. */
export function Blank({ rows = 1 }: { rows?: number }) {
  return (
    <box flexDirection="column">
      {Array.from({ length: Math.max(0, rows) }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical filler rows; position is the identity
        <box key={`blank-${i}`} height={1} />
      ))}
    </box>
  );
}
