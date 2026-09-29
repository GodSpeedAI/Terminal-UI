import { useTerminalDimensions } from "@opentui/react";

/**
 * The width available to a component.
 *
 * A component in a real application is not told how wide it is; it looks. The
 * `availableWidth` prop exists so the Workbench and the visual suite can
 * *simulate* a narrower terminal than the one they are running in, but when it
 * is absent the component falls back to the renderer's real width.
 *
 * Without this fallback a component only truncates when its author remembered
 * to pass a prop, which is exactly the kind of bug that shows up at 40 columns
 * in a customer's terminal and nowhere else.
 */
export function useAvailableWidth(override?: number): number | undefined {
  const { width } = useTerminalDimensions();
  return override ?? width;
}

/**
 * The width available *inside* a component's own rail gutters.
 *
 * `useAvailableWidth` is the budget for a full-width row; this is the budget for
 * content that already sits past a rail, an indent, and a marker.
 */
export function useBodyWidth(availableWidth: number | undefined, gutter: number): number | undefined {
  if (availableWidth === undefined) return undefined;
  return Math.max(0, availableWidth - gutter);
}
