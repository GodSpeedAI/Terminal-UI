/**
 * The semantic state vocabulary.
 *
 * Every interactive component in this library describes itself with these
 * values. Components never name a glyph or a color. The theme decides what a
 * state *looks like*; that separation is what lets a user restyle the library,
 * drop to ASCII, or push contrast without touching component code.
 */

/** Lifecycle of a single step inside a prompt or task list. */
export type LifecycleState = "active" | "pending" | "running" | "complete" | "error" | "cancelled";

/** Selection state of one member of a set (options, checkboxes, radios). */
export type SelectionState = "selected" | "unselected" | "checked" | "unchecked";

/** Severity of a message. */
export type ToneState = "info" | "success" | "warning" | "error";

/**
 * A neutral progress note — a log line or a heading with no outcome attached.
 *
 * Distinct from `muted`: a step is a real, named thing that happened, whereas
 * `muted` is emphasis applied to anything. The reference grammar gives them
 * different glyphs (`◇` for a step, `◆` for a success), and collapsing them
 * loses the ability to show "these are the steps, this is how it went".
 */
export type StepState = "step";

/**
 * The full state a visual primitive can express.
 *
 * `muted` and `disabled` cut across the other axes: they are emphasis states
 * that can apply to any marker rather than a point in a lifecycle.
 */
export type VisualState = LifecycleState | SelectionState | ToneState | StepState | "muted" | "disabled";

/** Every state a `Marker` can render. */
export type MarkerState = VisualState;

/** Every state a `Status` (standalone severity glyph) can render. */
export type StatusState = ToneState | StepState | "cancelled" | "muted";

/**
 * Prompt state as owned by the `Prompt` shell.
 *
 * This is deliberately a closed union rather than a bag of booleans: the
 * allowed transitions are enumerable, which is what makes the shell testable.
 *
 * ```text
 *   idle ──focus──▶ active ──submit──▶ complete
 *                     │  ▲                 │
 *             submit  │  │ validate        │ resubmit
 *                     ▼  │                 ▼
 *                   error ┘              (back to active)
 *                     │
 *                  cancel
 *                     ▼
 *                 cancelled
 * ```
 */
export type PromptPhase = "idle" | "active" | "validating" | "error" | "complete" | "cancelled";

/** Transition events accepted by the prompt state machine. */
export type PromptEvent =
  | { type: "focus" }
  | { type: "blur" }
  | { type: "change" }
  | { type: "validate" }
  | { type: "submit" }
  | { type: "invalid" }
  | { type: "cancel" }
  | { type: "reset" };

/** Result of a prompt's submit transition, for callers that need to branch. */
export type PromptSubmitResult = "submitted" | "invalid" | "cancelled";

/**
 * The legal `PromptPhase` transitions.
 *
 * Kept as data rather than `switch` branches so tests can assert the whole
 * graph, and so a component cannot accidentally widen it.
 */
export const PROMPT_TRANSITIONS: Readonly<
  Record<PromptPhase, Readonly<Partial<Record<PromptEvent["type"], PromptPhase>>>>
> = {
  idle: { focus: "active", cancel: "cancelled" },
  active: {
    change: "active",
    validate: "validating",
    submit: "validating",
    invalid: "error",
    cancel: "cancelled",
    blur: "idle",
  },
  validating: { invalid: "error", submit: "complete", change: "active", cancel: "cancelled" },
  error: {
    change: "active",
    submit: "validating",
    validate: "validating",
    cancel: "cancelled",
    reset: "active",
  },
  complete: { reset: "active" },
  cancelled: { reset: "active" },
};

/** Resolve one transition, or `null` when the event is not legal here. */
export function nextPromptPhase(phase: PromptPhase, event: PromptEvent["type"]): PromptPhase | null {
  return PROMPT_TRANSITIONS[phase][event] ?? null;
}
