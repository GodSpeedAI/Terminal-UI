import { defineTheme } from "./base.js";
import type { Theme } from "./types.js";
import { glyph } from "./types.js";

/**
 * `clackTheme` — the default.
 *
 * Glyphs and colors were selected by observing Clack v1.8.1's rendered output
 * and re-specified against our own state vocabulary. See
 * `docs/visual-language.md` for the full derivation and the SGR codes.
 *
 * The important property is that state is carried by glyph *shape* first and
 * color second, so this theme survives `--color=never` and low-color terminals.
 */
export const clackTheme: Theme = defineTheme({
  name: "clack",
  ascii: false,
  spacing: {
    railWidth: 1,
    bodyIndent: 2,
    labelGap: 2,
    optionGap: 1,
    hintGap: 1,
    rowGap: 0,
    blockGap: 1,
  },
  rail: {
    bar: glyph("│", 1),
    start: glyph("┌", 1),
    end: glyph("└", 1),
  },
  railStyles: {
    bar: { color: "brightBlack" },
    start: { color: "brightBlack" },
    end: { color: "cyan" },
  },
  markers: {
    active: glyph("◆", 1),
    pending: glyph("◇", 1),
    running: glyph("◆", 1),
    complete: glyph("◇", 1),
    selected: glyph("●", 1),
    unselected: glyph("○", 1),
    checked: glyph("◼", 1),
    unchecked: glyph("◻", 1),
    error: glyph("■", 1),
    warning: glyph("▲", 1),
    cancelled: glyph("■", 1),
    disabled: glyph("◇", 1),
    info: glyph("●", 1),
    success: glyph("◇", 1),
    step: glyph("◇", 1),
    muted: glyph("○", 1),
  },
  statuses: {
    step: glyph("◇", 1),
    info: glyph("●", 1),
    success: glyph("◆", 1),
    warning: glyph("▲", 1),
    error: glyph("■", 1),
    cancelled: glyph("■", 1),
    muted: glyph("○", 1),
  },
  markerStyles: {
    active: { color: "cyan" },
    pending: { color: "brightBlack" },
    running: { color: "cyan" },
    complete: { color: "green" },
    selected: { color: "cyan" },
    unselected: { color: "brightBlack", dim: true },
    checked: { color: "cyan" },
    unchecked: { color: "brightBlack" },
    error: { color: "red" },
    warning: { color: "yellow" },
    cancelled: { color: "red" },
    disabled: { color: "brightBlack", dim: true },
    info: { color: "blue" },
    success: { color: "green" },
    step: { color: "brightBlack" },
    muted: { color: "brightBlack", dim: true },
  },
  statusStyles: {
    step: { color: "brightBlack" },
    info: { color: "blue" },
    success: { color: "green" },
    warning: { color: "yellow" },
    error: { color: "red" },
    cancelled: { color: "red" },
    muted: { color: "brightBlack", dim: true },
  },
  text: {
    label: { color: "white" },
    value: { color: "white" },
    muted: { color: "brightBlack" },
    hint: { color: "white" },
    hintKey: { color: "brightBlack", dim: true },
    error: { color: "red" },
  },
  progress: {
    active: glyph("█", 1),
    inactive: glyph("░", 1),
  },
  spinnerFrames: [glyph("◒", 1), glyph("◐", 1), glyph("◓", 1), glyph("◑", 1)],
  note: {
    topLeft: glyph("┌", 1),
    topRight: glyph("╮", 1),
    bottomLeft: glyph("├", 1),
    bottomRight: glyph("╯", 1),
    horizontal: glyph("─", 1),
    vertical: glyph("│", 1),
  },
  hintSeparator: glyph("•", 1),
  hintTerminator: glyph("…", 1),
  passwordMask: glyph("▪", 1),
  keys: {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    enter: "Enter",
    escape: "Esc",
    space: "Space",
    tab: "Tab",
  },
});
