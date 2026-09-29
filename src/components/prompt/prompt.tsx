import type { ReactNode } from "react";
import { ErrorText, Hint, type KeyHintPair, Label, Muted } from "../../primitives/label.js";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { MarkerState, PromptPhase } from "../../theme/state.js";
import type { Theme } from "../../theme/types.js";
import { paint } from "../../utils/style.js";

/**
 * The rail marker a prompt's *question* shows in a given phase.
 *
 * An open prompt keeps `active` even while it is rejecting input. The rejection
 * is carried by the error row below it, which has its own `error` marker —
 * painting the question red as well would claim the prompt had failed when all
 * that happened is that one answer was refused, and it would contradict the
 * still-visible hint row promising the user they can try again.
 */
export function markerForPhase(phase: PromptPhase): MarkerState {
  switch (phase) {
    case "complete":
      return "complete";
    case "cancelled":
      return "cancelled";
    default:
      return "active";
  }
}

/** Cells a phase's marker occupies, so the label budget stays honest. */
function markerWidth(theme: Theme, state: MarkerState): number {
  return theme.markers[state]?.width ?? 1;
}

export interface PromptProps {
  /**
   * The question. Stays visible in every phase, which is what makes a
   * transcript of prompts readable after they have collapsed.
   */
  message: string;
  /** Lifecycle phase, normally from `usePromptState`. */
  phase: PromptPhase;
  /**
   * The control's body. Rendered only while the prompt is still open, because a
   * resolved prompt collapses to a single line.
   */
  children?: ReactNode;
  /**
   * The collapsed representation, shown once the prompt resolves.
   *
   * Each control supplies this so no control reimplements the shell's collapse
   * behaviour — it only has to describe its own answer.
   */
  summary?: ReactNode;
  /** Validation message, shown inside the rail grammar. Never an alert box. */
  error?: string | null;
  /** Keyboard help for this prompt. */
  hint?: readonly KeyHintPair[];
  /** Available width in cells, used to decide truncation and hint compaction. */
  availableWidth?: number;
  /** Disable the prompt and render it in the disabled state. */
  disabled?: boolean;
}

/**
 * The prompt shell.
 *
 * Owns the rail, the marker, the message, the hint line, error presentation,
 * and the active → submitted collapse. Controls supply only their body and
 * their summary, which is why `Select` does not reimplement any of this.
 *
 * The collapse is the point of the whole component: a completed prompt becomes
 * one rail line, `◇ message answer`, rather than freezing an interactive list
 * into the transcript.
 */
export function Prompt({
  message,
  phase,
  children,
  summary,
  error = null,
  hint = [],
  availableWidth,
  disabled = false,
}: PromptProps) {
  const { theme } = useTheme();
  const resolved = phase === "complete" || phase === "cancelled";
  const markerState: MarkerState = disabled ? "disabled" : markerForPhase(phase);

  // Budgets are computed from the rail geometry rather than passed in ad hoc,
  // so a label can never be given more columns than the row actually has. The
  // message row spends no rail column — its marker occupies column 0.
  const gutter = markerWidth(theme, markerState) + theme.spacing.labelGap;
  const messageBudget = availableWidth === undefined ? undefined : Math.max(0, availableWidth - gutter);
  const bodyGutter = theme.spacing.railWidth + theme.spacing.bodyIndent + 1 + theme.spacing.labelGap;
  const bodyBudget = availableWidth === undefined ? undefined : Math.max(0, availableWidth - bodyGutter);

  return (
    <box flexDirection="column" width="100%">
      {/*
        A bare rail row above the question. It is what gives the block a left
        edge to hang from, and it keeps the message row free to spend column 0
        on the marker.
      */}
      <RailRow>
        <box height={0} />
      </RailRow>

      {/*
        The message row is the one row where the marker *replaces* the rail
        rather than sitting inside it — the question is the block's headline,
        not a row of its body.
      */}
      <box flexDirection="row" width="100%" minWidth={0}>
        <Marker state={markerState} />
        <box flexDirection="column" flexGrow={1} paddingLeft={theme.spacing.labelGap} minWidth={0}>
          {/*
            A resolved prompt collapses onto ONE line: `◇ message  answer`.
            Letting the answer fall to a second line doubles the height of every
            resolved prompt, which is what makes a transcript of a flow
            unreadable — and the collapse is the whole reason a submitted prompt
            reads as submitted.
          */}
          <box flexDirection="row" width="100%" minWidth={0}>
            <Label maxWidth={messageBudget} muted={disabled}>
              {message}
            </Label>
            {resolved && summary !== undefined ? (
              <box flexDirection="row" minWidth={0} paddingLeft={1}>
                <text content={paint(" ", theme.text.value)} wrapMode="none" />
                <box flexDirection="row" minWidth={0}>
                  {summary}
                </box>
              </box>
            ) : null}
          </box>
        </box>
      </box>

      {!resolved ? children : null}

      {!resolved && error ? (
        <RailRow>
          <box flexDirection="row" width="100%" minWidth={0}>
            <Marker state="error" />
            <box flexDirection="column" flexGrow={1} paddingLeft={theme.spacing.labelGap} minWidth={0}>
              <ErrorText maxWidth={bodyBudget}>{error}</ErrorText>
            </box>
          </box>
        </RailRow>
      ) : null}

      {!resolved && hint.length > 0 ? (
        <RailRow>
          <box flexDirection="row" width="100%" minWidth={0}>
            <Hint
              hints={hint}
              availableWidth={
                availableWidth === undefined
                  ? undefined
                  : availableWidth - theme.spacing.railWidth - theme.spacing.bodyIndent
              }
            />
          </box>
        </RailRow>
      ) : null}
    </box>
  );
}

export interface StepLineProps {
  state: MarkerState;
  message: string;
  availableWidth?: number;
  /** Trailing muted annotation, such as a value or a duration. */
  suffix?: string;
}

/** A one-line rail message with no interactive body, e.g. a section heading. */
export function StepLine({ state, message, availableWidth, suffix }: StepLineProps) {
  const { theme } = useTheme();
  const budget =
    availableWidth === undefined
      ? undefined
      : Math.max(
          0,
          availableWidth - theme.spacing.railWidth - markerWidth(theme, state) - theme.spacing.labelGap,
        );
  return (
    <RailRow>
      <box flexDirection="row" width="100%" minWidth={0}>
        <Marker state={state} />
        <box flexDirection="column" flexGrow={1} paddingLeft={theme.spacing.labelGap} minWidth={0}>
          <Label maxWidth={budget} muted={state === "disabled" || state === "pending"}>
            {message}
          </Label>
          {suffix ? <Muted maxWidth={budget}>{suffix}</Muted> : null}
        </box>
      </box>
    </RailRow>
  );
}
