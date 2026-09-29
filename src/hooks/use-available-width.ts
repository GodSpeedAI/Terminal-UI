import { useTerminalDimensions } from "@opentui/react";
import { createContext, createElement, type ReactNode, useContext } from "react";

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

/**
 * Width injected for everything below a `SimulatedWidthProvider`.
 *
 * `undefined` is a meaningful value here: it means "no simulation running",
 * which is what every plain `render` sees. The context therefore never changes
 * behaviour for existing mounts — components only resimulate when something
 * explicitly asks them to.
 */
const SimulatedWidthContext = createContext<number | undefined>(undefined);

export interface SimulatedWidthProviderProps {
  /** The width components below should treat as their own terminal width. */
  width: number | undefined;
  children?: ReactNode;
}

/**
 * Simulate a terminal width for every `useAvailableWidth` call below it.
 *
 * The Workbench wraps the live pane in this so its width knob re-renders the
 * component under inspection; without it the knob could only restate a number
 * the component was never going to read. It is a context rather than a prop so
 * the component API stays untouched — a scenario's `render()` needs no
 * arguments to be width-simulated.
 */
export function SimulatedWidthProvider({ width, children }: SimulatedWidthProviderProps) {
  return createElement(SimulatedWidthContext.Provider, { value: width }, children);
}

/**
 * Resolve the component's width budget: an explicit prop beats a simulated
 * width, which beats the renderer's real width. A prop is a component-local
 * decision; the context is an environment a host (the Workbench) provides.
 */
export function useAvailableWidth(override?: number): number | undefined {
  const simulated = useContext(SimulatedWidthContext);
  const { width } = useTerminalDimensions();
  return override ?? simulated ?? width;
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
