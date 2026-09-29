import { defineTheme } from "./base.js";
import { clackTheme } from "./clack.js";
import type { Theme } from "./types.js";

/**
 * `highContrastTheme` — Clack glyphs, maximum emphasis.
 *
 * The reference theme leans on `dim` to create hierarchy. Some terminals
 * render `dim` identically to normal weight, which silently flattens the
 * grammar. This theme drops every `dim` and promotes the active marker to
 * bold, so hierarchy is carried by the terminal's own weight model instead.
 *
 * State is still carried by glyph shape, so this theme changes *emphasis*, not
 * *meaning* — it is a safe swap for the default.
 */
export const highContrastTheme: Theme = defineTheme({
  ...clackTheme,
  name: "high-contrast",
  ascii: false,
  railStyles: {
    bar: { color: "white" },
    start: { color: "white" },
    end: { color: "brightCyan", bold: true },
  },
  markerStyles: {
    active: { color: "brightCyan", bold: true },
    pending: { color: "white" },
    running: { color: "brightCyan", bold: true },
    complete: { color: "brightGreen", bold: true },
    selected: { color: "brightCyan", bold: true },
    unselected: { color: "white" },
    checked: { color: "brightCyan", bold: true },
    unchecked: { color: "white" },
    error: { color: "brightRed", bold: true },
    warning: { color: "brightYellow", bold: true },
    cancelled: { color: "brightRed", bold: true },
    disabled: { color: "white" },
    info: { color: "brightBlue", bold: true },
    success: { color: "brightGreen", bold: true },
    step: { color: "white" },
    muted: { color: "white" },
  },
  statusStyles: {
    step: { color: "white" },
    info: { color: "brightBlue", bold: true },
    success: { color: "brightGreen", bold: true },
    warning: { color: "brightYellow", bold: true },
    error: { color: "brightRed", bold: true },
    cancelled: { color: "brightRed", bold: true },
    muted: { color: "white" },
  },
  text: {
    label: { color: "white" },
    value: { color: "white", bold: true },
    muted: { color: "white" },
    hint: { color: "white" },
    hintKey: { color: "brightWhite", bold: true },
    error: { color: "brightRed", bold: true },
  },
  progress: {
    active: { char: "█", width: 1 },
    inactive: { char: "░", width: 1 },
  },
});
