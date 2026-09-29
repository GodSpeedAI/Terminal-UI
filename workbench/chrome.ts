import { useTheme } from "../src/theme/index.js";
import { stringWidth, truncateToWidth } from "../src/utils/text.js";

/**
 * The Workbench's own chrome.
 *
 * The explorer deliberately does **not** use this library's rail grammar. The
 * rail is the subject of the thing being explored, so wrapping it in itself
 * would make it impossible to see where a component's output ends. The
 * Workbench uses plain boxes, a single accent colour, and the terminal's own
 * default foreground, so the live component pane contains nothing but the
 * component.
 */
export interface WorkbenchChrome {
  accent: string;
  muted: string;
  faint: string;
  selectedBg: string;
  border: string;
  danger: string;
}

export const chrome: WorkbenchChrome = {
  accent: "#7dd3fc",
  muted: "#94a3b8",
  faint: "#475569",
  selectedBg: "#1e293b",
  border: "#334155",
  danger: "#f87171",
};

/** Theme name shown in the status bar. */
export function themeLabel(name: string): string {
  return name;
}

/** Truncate with a single-character ellipsis, for a fixed-width column. */
export function clip(text: string, width: number): string {
  if (width <= 0) return "";
  return truncateToWidth(text, width, "…");
}

/** Pad to exactly `width` cells. */
export function pad(text: string, width: number): string {
  const w = stringWidth(text);
  return w >= width ? clip(text, width) : text + " ".repeat(width - w);
}

/** A visible width for a component name in the sidebar. */
export function sidebarWidth(total: number): number {
  if (total >= 100) return 26;
  if (total >= 80) return 24;
  return 20;
}

/**
 * Widths to test the responsive layout at.
 *
 * These are the widths the visual suite renders the Workbench at, so a
 * responsive regression is caught by a fixture rather than by someone noticing
 * a squeezed pane in a real terminal.
 */
export const RESPONSIVE_WIDTHS = [40, 60, 80, 120, 160] as const;

/** Below this width the Workbench drops to a single-column navigation mode. */
export const SINGLE_COLUMN_BELOW = 72;

/** Re-exported so the Workbench can build key hints without importing React. */
export function useChromeTheme() {
  const { theme } = useTheme();
  return { theme, chrome };
}
