import { useCallback, useMemo, useState } from "react";
import { ErrorText, Label, Muted } from "../../primitives/label.js";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { LifecycleState, PromptPhase } from "../../theme/state.js";
import { paint, plain } from "../../utils/style.js";
import { stringWidth } from "../../utils/text.js";
import { Prompt } from "../prompt/prompt.js";

/** Lifecycle of one unit of work in a `TaskList`. */
export type TaskState = "pending" | "running" | "complete" | "error" | "cancelled";

export interface TaskProps {
  message: string;
  state: TaskState;
  /** Muted trailing annotation, such as a duration. */
  suffix?: string;
  /** Indent level, for nested tasks. Each level adds one indent step. */
  depth?: number;
  availableWidth?: number;
  /** Optional bar shown while running. */
  progress?: number;
}

/**
 * One unit of work.
 *
 * Built from `RailRow` and `Marker` like everything else, so a task list
 * shares its geometry with the prompts around it. `depth` composes rather than
 * switching to a box-drawing branch, which is what keeps a nested task list
 * readable at the same widths as a flat one.
 */
export function Task({ message, state, suffix, depth = 0, availableWidth, progress }: TaskProps) {
  const { theme } = useTheme();
  const indent = theme.spacing.bodyIndent * Math.max(0, depth);
  const gutter = theme.spacing.railWidth + indent + 1 + (suffix ? stringWidth(suffix) + 2 : 0);
  const budget = availableWidth === undefined ? undefined : Math.max(0, availableWidth - gutter);
  // The bar sits inside the row's own box, which has already consumed the
  // marker and the indent, so it gets the same budget as the label.
  const barWidth = availableWidth === undefined ? undefined : Math.max(1, Math.min(budget ?? 24, 24));

  return (
    <RailRow>
      <box flexDirection="row" width="100%" minWidth={0}>
        <Marker state={state} />
        <box flexDirection="column" flexGrow={1} paddingLeft={theme.spacing.bodyIndent} minWidth={0}>
          <box flexDirection="row" width="100%" minWidth={0}>
            <Label maxWidth={budget} muted={state === "pending" || state === "cancelled"}>
              {message}
            </Label>
            {suffix ? <Muted>{`  ${suffix}`}</Muted> : null}
          </box>
          {state === "running" && progress !== undefined ? (
            <ProgressBarInline value={progress} width={barWidth ?? 24} />
          ) : null}
        </box>
      </box>
    </RailRow>
  );
}

function ProgressBarInline({ value, width }: { value: number; width: number }) {
  const { theme } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const filled = Math.round(clamped * width);
  return (
    <box flexDirection="row" minWidth={0}>
      <text
        content={paint(theme.progress.active.char.repeat(filled), theme.markerStyles.running)}
        wrapMode="none"
      />
      <text
        content={paint(theme.progress.inactive.char.repeat(Math.max(0, width - filled)), theme.text.muted)}
        wrapMode="none"
      />
    </box>
  );
}

export interface TaskListProps {
  tasks: readonly TaskProps[];
  availableWidth?: number;
  /** Render a summary line beneath the list, e.g. `2/5 done`. */
  summary?: string;
}

/**
 * An ordered list of tasks.
 *
 * A pure renderer: it owns no lifecycle. The caller decides what is running,
 * because a task list whose state lives inside the component cannot be
 * driven from outside — which is exactly what the Workbench, the tests, and
 * any real orchestration need.
 */
export function TaskList({ tasks, availableWidth, summary }: TaskListProps) {
  return (
    <box flexDirection="column" width="100%">
      {tasks.map((task, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: task order is the identity and is stable
        <Task key={`${task.message}-${i}`} {...task} availableWidth={availableWidth} />
      ))}
      {summary ? (
        <RailRow muted>
          <Muted maxWidth={availableWidth}>{summary}</Muted>
        </RailRow>
      ) : null}
    </box>
  );
}

/** Build a `n/total` summary line for a task list. */
export function taskSummary(tasks: readonly TaskProps[]): string | undefined {
  if (tasks.length === 0) return undefined;
  const done = tasks.filter((t) => t.state === "complete").length;
  const failed = tasks.filter((t) => t.state === "error").length;
  const parts = [`${done}/${tasks.length} done`];
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(" • ");
}

export interface GroupProps {
  message: string;
  /** Task lines, each optionally nested. */
  tasks: readonly TaskProps[];
  /** A bar shown under the group message while it runs. */
  progress?: number;
  /** Rendered under the group when the group reports a problem. */
  error?: string | null;
  availableWidth?: number;
}

/**
 * A message with nested sub-tasks.
 *
 * Clack's nested-prompt pattern, expressed with the same primitives as
 * everything else. The group message takes the rail marker; each task takes a
 * row beneath it. Depth composes via indent, so a three-level nest still
 * renders on a 40-column terminal.
 */
export function Group({ message, tasks, progress, error, availableWidth }: GroupProps) {
  const { theme } = useTheme();
  const groupBarWidth =
    availableWidth === undefined
      ? 24
      : Math.max(1, Math.min(24, availableWidth - theme.spacing.railWidth - theme.spacing.labelGap));
  // The error row is the Prompt shell's error row, so a failed group reads like
  // a rejected prompt. Its budget spends the rail, the indent, the error
  // marker's cells, and the gap — measured from the theme, never assumed.
  const errorGutter =
    theme.spacing.railWidth + theme.spacing.bodyIndent + theme.markers.error.width + theme.spacing.labelGap;
  const errorBudget = availableWidth === undefined ? undefined : Math.max(0, availableWidth - errorGutter);
  const state: LifecycleState = error
    ? "error"
    : tasks.every((t) => t.state === "complete")
      ? "complete"
      : tasks.some((t) => t.state === "running")
        ? "running"
        : "pending";

  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" width="100%" minWidth={0}>
        <Marker state={state} />
        <box flexDirection="column" flexGrow={1} paddingLeft={theme.spacing.labelGap} minWidth={0}>
          <Label>{message}</Label>
          {progress !== undefined ? <ProgressBarInline value={progress} width={groupBarWidth} /> : null}
        </box>
      </box>
      {tasks.map((task, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: task order is the identity and is stable
        <Task key={`${task.message}-${i}`} {...task} depth={1} availableWidth={availableWidth} />
      ))}
      {error ? (
        <RailRow>
          <box flexDirection="row" width="100%" minWidth={0}>
            <Marker state="error" />
            <box flexDirection="column" flexGrow={1} paddingLeft={theme.spacing.labelGap} minWidth={0}>
              <ErrorText maxWidth={errorBudget}>{error}</ErrorText>
            </box>
          </box>
        </RailRow>
      ) : null}
    </box>
  );
}

/** One resolved step inside a `PromptGroup`. */
export interface GroupPrompt {
  /** The question that was asked. */
  message: string;
  /** The answer that was given, already collapsed to a string. */
  answer: string;
  /** The phase the prompt ended in. Defaults to `complete`. */
  phase?: PromptPhase;
}

export interface PromptGroupProps {
  /**
   * The resolved prompts, in the order they were asked.
   *
   * `PromptGroup` is deliberately a *renderer* over already-resolved answers,
   * not an orchestrator. A component library that also owns the sequencing has
   * to own cancellation, error recovery, and re-entry, and every application
   * that disagrees with those choices is stuck with them. Callers keep the
   * control flow; this renders the transcript.
   */
  prompts: readonly GroupPrompt[];
  /**
   * Render an open rail cell above the block. Defaults to false, because each
   * `Prompt` already opens its own; turning it on stacks two blank rails.
   */
  open?: boolean;
  availableWidth?: number;
}

/**
 * A run of prompts sharing one rail block.
 *
 * The rail is opened once and every prompt collapses in place, which is what
 * makes a multi-step flow read as one continuous conversation rather than
 * several disconnected ones. The collapse is inherited from `Prompt`, so this
 * component adds geometry only.
 */
export function PromptGroup({ prompts, open = false, availableWidth }: PromptGroupProps) {
  const { theme } = useTheme();
  return (
    <box flexDirection="column" width="100%">
      {open ? (
        <RailRow>
          <box height={0} />
        </RailRow>
      ) : null}
      {prompts.map((prompt, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: prompts are positional within a flow
        <box key={`${prompt.message}-${i}`} flexDirection="column" width="100%">
          <Prompt
            message={prompt.message}
            phase={prompt.phase ?? "complete"}
            availableWidth={availableWidth}
            summary={<Label value>{prompt.answer}</Label>}
          />
        </box>
      ))}
      <box flexDirection="row" width="100%" minWidth={0}>
        <text content={plain(theme.rail.end.char)} fg={theme.railStyles.end.color} wrapMode="none" />
      </box>
    </box>
  );
}

/** A plain vertical stack with the theme's block spacing. */
export function Stack({ children, gap }: { children?: React.ReactNode; gap?: number }) {
  const { theme } = useTheme();
  const rows = Array.isArray(children) ? children : [children];
  return (
    <box flexDirection="column" width="100%">
      {rows.map((child, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a stack's children are identified by position
        <box key={`stack-${i}`} flexDirection="column" width="100%">
          {i > 0 ? <box height={gap ?? theme.spacing.blockGap} /> : null}
          {child}
        </box>
      ))}
    </box>
  );
}

/** Interactive wrapper that advances a `TaskList` through its states. */
export function useTaskRunner(initial: readonly TaskProps[]) {
  const [tasks, setTasks] = useState<readonly TaskProps[]>(initial);
  const start = useCallback((_message: string) => {
    setTasks((current) => {
      const index = current.findIndex((t) => t.state === "pending");
      if (index === -1) return current;
      return current.map((t, i) => (i === index ? { ...t, state: "running" as TaskState } : t));
    });
  }, []);
  const finish = useCallback((_message: string, state: "complete" | "error" = "complete") => {
    setTasks((current) => {
      const index = current.findIndex((t) => t.state === "running");
      if (index === -1) return current;
      return current.map((t, i) => (i === index ? { ...t, state } : t));
    });
  }, []);
  return useMemo(() => ({ tasks, setTasks, start, finish }), [tasks, start, finish]);
}
