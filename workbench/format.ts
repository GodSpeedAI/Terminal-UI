import { parseColor, StyledText, TextAttributes, type TextChunk } from "@opentui/core";

/**
 * A small styling helper for the Workbench's own chrome.
 *
 * The Workbench deliberately does **not** use this library's theme or rail
 * primitives. The rail grammar is the subject under inspection, so the explorer
 * has to be able to render a frame around a component without its own chrome
 * looking like part of that component. This helper is the only styling
 * vocabulary the Workbench needs, and it is scoped to the Workbench.
 */
export interface Span {
  text: string;
  color?: string;
  dim?: boolean;
  bold?: boolean;
  underline?: boolean;
}

function toChunk(span: Span): TextChunk {
  let attributes = TextAttributes.NONE;
  if (span.bold) attributes |= TextAttributes.BOLD;
  if (span.dim) attributes |= TextAttributes.DIM;
  if (span.underline) attributes |= TextAttributes.UNDERLINE;
  const chunk: TextChunk = { __isChunk: true, text: span.text };
  if (span.color !== undefined) chunk.fg = parseColor(span.color);
  if (attributes !== TextAttributes.NONE) chunk.attributes = attributes;
  return chunk;
}

/** Compose a `StyledText` from spans. */
export function txt(...spans: Span[]): StyledText {
  return new StyledText(spans.map(toChunk));
}

/** A dimmed run. */
export function faint(text: string): Span {
  return { text, dim: true };
}

/** A bold accent run. */
export function strong(text: string, color: string): Span {
  return { text, color, bold: true };
}
