import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import { paint } from "../../utils/style.js";

/**
 * An injectable frame source.
 *
 * The spinner and progress bar are the only animated components in the
 * library, and animation is the main way a visual test becomes flaky. Rather
 * than asserting on "roughly frame N after some delay", every animated
 * component reads its frame from a `ClockContext` that tests replace with a
 * manual counter. Production passes the default, which ticks on the renderer.
 */
export interface FrameClock {
  /** Current frame index. */
  readonly frame: number;
  /** Register a listener called once per frame advance. */
  subscribe(listener: () => void): () => void;
}

/** A clock that only advances when someone calls `tick`. */
export function createManualClock(): FrameClock & { tick(): void; setFrame(n: number): void } {
  let frame = 0;
  const listeners = new Set<() => void>();
  return {
    get frame() {
      return frame;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    tick() {
      frame += 1;
      for (const l of listeners) l();
    },
    setFrame(n) {
      frame = n;
      for (const l of listeners) l();
    },
  };
}

/**
 * The default clock: one frame per interval.
 *
 * Interval-based rather than tied to the renderer's own frame callback so that
 * tests can substitute a manual clock without the component knowing the
 * difference.
 */
function createIntervalClock(intervalMs: number): FrameClock {
  let frame = 0;
  const listeners = new Set<() => void>();
  let handle: ReturnType<typeof setInterval> | null = null;
  return {
    get frame() {
      return frame;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (handle === null && listeners.size === 1) {
        handle = setInterval(() => {
          frame += 1;
          for (const l of listeners) l();
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && handle !== null) {
          clearInterval(handle);
          handle = null;
        }
      };
    },
  };
}

const ClockContext = createContext<FrameClock | null>(null);

export interface FrameProviderProps {
  clock?: FrameClock;
  children?: ReactNode;
}

/**
 * Supplies the frame source for every animated component below it.
 *
 * Tests wrap a tree in this with `createManualClock()` to step animation
 * deterministically; production omits it and gets the interval clock.
 */
export function FrameProvider({ clock, children }: FrameProviderProps) {
  const fallback = useMemo(() => createIntervalClock(80), []);
  return <ClockContext.Provider value={clock ?? fallback}>{children}</ClockContext.Provider>;
}

/** Read the active frame clock, or `null` for an unanimated tree. */
export function useFrameClock(): FrameClock | null {
  return useContext(ClockContext);
}

/** Subscribe a component to frame advances. */
export function useFrame(): number {
  const clock = useFrameClock();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!clock) return;
    setFrame(clock.frame);
    return clock.subscribe(() => setFrame(clock.frame));
  }, [clock]);
  return clock ? frame : 0;
}

export interface SpinnerProps {
  /** The work's label. */
  message: string;
  /** Optional rail rendering. Omit to render bare, for inline use. */
  railed?: boolean;
  availableWidth?: number;
  /** Override the animation frames. Defaults to the theme's. */
  frames?: readonly { char: string; width: number }[];
  /** Frames per animation step. Raise to slow the spinner down. */
  intervalFrames?: number;
}

/**
 * An indeterminate activity indicator.
 *
 * The animation is a function of the injected frame clock alone — no wall
 * time, no `setInterval` of its own — so the rendered frame is a pure function
 * of the clock and the visual tests are exact rather than approximate.
 */
export function Spinner({
  message,
  railed = true,
  availableWidth,
  frames,
  intervalFrames = 1,
}: SpinnerProps) {
  const { theme } = useTheme();
  const frame = useFrame();
  const cycle = frames ?? theme.spinnerFrames;
  const index = Math.floor(frame / Math.max(1, intervalFrames)) % cycle.length;
  const glyph = cycle[index] ?? cycle[0] ?? { char: "?", width: 1 };

  const body = (
    <box flexDirection="row" width="100%" minWidth={0}>
      <text content={paint(glyph.char, theme.markerStyles.running)} wrapMode="none" />
      <box flexDirection="row" width="100%" minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
        <text
          content={paint(message, theme.text.label)}
          wrapMode="none"
          truncate={availableWidth !== undefined}
        />
      </box>
    </box>
  );

  if (!railed) return body;
  return <RailRow>{body}</RailRow>;
}

export interface ProgressProps {
  message: string;
  /** Completion in `[0, 1]`. Values outside the range are clamped. */
  value: number;
  /** Bar width in cells. Defaults to 30. */
  width?: number;
  availableWidth?: number;
  railed?: boolean;
  /** Show `NN%` after the bar. Defaults to true. */
  showPercent?: boolean;
  tone?: "active" | "success" | "error";
}

/**
 * A determinate progress bar.
 *
 * Unlike the spinner this is a pure function of `value` — no clock at all —
 * so `progress-0`, `progress-50`, and `progress-100` are exact fixtures rather
 * than sampled ones.
 */
export function Progress({
  message,
  value,
  width = 30,
  availableWidth,
  railed = true,
  showPercent = true,
  tone = "active",
}: ProgressProps) {
  const { theme } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const filled = Math.round(clamped * width);
  const style =
    tone === "success"
      ? theme.statusStyles.success
      : tone === "error"
        ? theme.statusStyles.error
        : theme.markerStyles.running;

  const bar = (
    <box flexDirection="row" width="100%" minWidth={0}>
      <Marker state={tone === "active" ? "running" : tone} />
      <box flexDirection="row" width="100%" minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
        <text
          content={paint(message, theme.text.label)}
          wrapMode="none"
          truncate={availableWidth !== undefined}
        />
        <text content={paint(" ", theme.text.label)} wrapMode="none" />
        <text content={paint(theme.progress.active.char.repeat(filled), style)} wrapMode="none" />
        <text
          content={paint(theme.progress.inactive.char.repeat(Math.max(0, width - filled)), theme.text.muted)}
          wrapMode="none"
        />
        {showPercent ? (
          <text content={paint(` ${Math.round(clamped * 100)}%`, theme.text.muted)} wrapMode="none" />
        ) : null}
      </box>
    </box>
  );

  if (!railed) return bar;
  return <RailRow>{bar}</RailRow>;
}
