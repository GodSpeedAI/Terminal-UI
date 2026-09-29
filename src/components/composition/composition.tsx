import { Muted } from "../../primitives/label.js";
import { Marker, Rail, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { StatusState } from "../../theme/state.js";
import { paint } from "../../utils/style.js";
import { stringWidth } from "../../utils/text.js";

export interface LogProps {
  /** The log line's text. */
  message: string;
  /** Severity, which selects the status glyph and color. */
  level: "step" | "info" | "success" | "warn" | "error";
  availableWidth?: number;
  /** A muted trailing annotation, such as a duration. */
  suffix?: string;
}

/** Map a log level onto the status vocabulary. */
const LEVEL_TO_STATUS: Record<LogProps["level"], StatusState> = {
  step: "step",
  info: "info",
  success: "success",
  warn: "warning",
  error: "error",
};

/**
 * A single log line.
 *
 * A log line is a step with no body, so it is built from the same `RailRow` and
 * `Marker` primitives as everything else. That is what keeps a transcript of
 * mixed output aligned without a special "log mode".
 */
export function Log({ message, level, availableWidth, suffix }: LogProps) {
  const { theme } = useTheme();
  const budget =
    availableWidth === undefined
      ? undefined
      : Math.max(
          0,
          availableWidth -
            theme.spacing.railWidth -
            theme.spacing.bodyIndent -
            1 -
            (suffix ? stringWidth(suffix) + 1 : 0),
        );
  return (
    <RailRow>
      <box flexDirection="row" width="100%" minWidth={0}>
        <Marker state={LEVEL_TO_STATUS[level]} />
        <box flexDirection="row" width="100%" minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
          <text content={paint(message, theme.text.label)} wrapMode="none" truncate={budget !== undefined} />
          {suffix ? <Muted maxWidth={undefined}>{`  ${suffix}`}</Muted> : null}
        </box>
      </box>
    </RailRow>
  );
}

/** Opens a flow. */
export function Intro({ title, availableWidth }: { title?: string; availableWidth?: number }) {
  const { theme } = useTheme();
  return (
    <box flexDirection="row" width="100%" minWidth={0}>
      <Rail variant="start" />
      <box flexDirection="row" width="100%" minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
        <text
          content={paint(title ?? "", theme.text.label)}
          wrapMode="none"
          truncate={availableWidth !== undefined}
        />
      </box>
    </box>
  );
}

/** Closes a flow, and closes the rail block. */
export function Outro({ title, availableWidth }: { title?: string; availableWidth?: number }) {
  const { theme } = useTheme();
  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" width="100%" minWidth={0}>
        <Rail variant="end" />
        <box flexDirection="row" width="100%" minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
          <text
            content={paint(title ?? "", theme.text.label)}
            wrapMode="none"
            truncate={availableWidth !== undefined}
          />
        </box>
      </box>
    </box>
  );
}

/** Marks a flow as cancelled rather than finished. */
export function Cancel({ title, availableWidth }: { title?: string; availableWidth?: number }) {
  const { theme } = useTheme();
  return (
    <box flexDirection="row" width="100%" minWidth={0}>
      <Rail variant="end" />
      <box flexDirection="row" width="100%" minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
        <text
          content={paint(title ?? "", theme.text.error)}
          wrapMode="none"
          truncate={availableWidth !== undefined}
        />
      </box>
    </box>
  );
}
