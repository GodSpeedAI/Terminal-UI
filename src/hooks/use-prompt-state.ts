import { useCallback, useMemo, useRef, useState } from "react";
import {
  nextPromptPhase,
  type PromptEvent,
  type PromptPhase,
  type PromptSubmitResult,
} from "../theme/state.js";

/** Options for {@link usePromptState}. */
export interface PromptStateOptions {
  /** Start phase. Defaults to `idle`. */
  initial?: PromptPhase;
  /**
   * Called when a submit attempt passes. Return a string to reject the submit
   * with that message, or `null`/`undefined` to accept it.
   */
  validate?: (value: unknown) => string | null | undefined;
  /** Called once, on the transition into `complete`. */
  onSubmit?: (value: unknown) => void;
  /** Called once, on the transition into `cancelled`. */
  onCancel?: () => void;
}

/** The surface returned by {@link usePromptState}. */
export interface PromptState {
  phase: PromptPhase;
  error: string | null;
  /** True while the prompt should receive keyboard input. */
  interactive: boolean;
  /** Drive one transition. Illegal transitions are ignored, not thrown. */
  dispatch: (event: PromptEvent) => void;
  /** Attempt to submit `value`. Returns which outcome occurred. */
  submit: (value: unknown) => PromptSubmitResult;
  /** Abort the prompt. */
  cancel: () => void;
  /** Return to an editable state, clearing any error. */
  reset: () => void;
  /** True when the phase is one in which the prompt has collapsed. */
  resolved: boolean;
}

/**
 * The prompt lifecycle.
 *
 * Backed by the transition table in `theme/state.ts` rather than ad-hoc
 * booleans, which is what makes the shell predictable: an illegal transition is
 * a no-op instead of a state the component has never considered rendering.
 *
 * The submit path is deliberately split — `dispatch({type:"submit"})` moves to
 * `validating`, then validation resolves it to `complete` or `error`. Tests
 * assert the table, so a regression in the shell shows up as a failing
 * transition test rather than a surprising render.
 */
export function usePromptState(options: PromptStateOptions = {}): PromptState {
  const { initial = "idle", validate, onSubmit, onCancel } = options;
  const [phase, setPhase] = useState<PromptPhase>(initial);
  const [error, setError] = useState<string | null>(null);
  // Kept in refs so `submit` stays referentially stable across renders, which
  // matters because it is passed down into effect dependency arrays.
  const validateRef = useRef(validate);
  const onSubmitRef = useRef(onSubmit);
  const onCancelRef = useRef(onCancel);
  validateRef.current = validate;
  onSubmitRef.current = onSubmit;
  onCancelRef.current = onCancel;

  const dispatch = useCallback((event: PromptEvent) => {
    setPhase((current) => {
      const next = nextPromptPhase(current, event.type);
      if (next === null) return current;
      if (next !== "error" && event.type !== "invalid") setError(null);
      return next;
    });
  }, []);

  const submit = useCallback((value: unknown): PromptSubmitResult => {
    let result: PromptSubmitResult = "invalid";
    setPhase((current) => {
      const next = nextPromptPhase(current, "submit");
      if (next === null) {
        result = current === "complete" ? "submitted" : "invalid";
        return current;
      }
      const message = validateRef.current?.(value) ?? null;
      if (message) {
        result = "invalid";
        setError(message);
        return "error";
      }
      result = "submitted";
      setError(null);
      onSubmitRef.current?.(value);
      return "complete";
    });
    return result;
  }, []);

  const cancel = useCallback(() => {
    setPhase((current) => {
      const next = nextPromptPhase(current, "cancel");
      if (next === null) return current;
      onCancelRef.current?.();
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setPhase((current) => nextPromptPhase(current, "reset") ?? "active");
  }, []);

  return useMemo(
    () => ({
      phase,
      error,
      interactive: phase === "active" || phase === "validating" || phase === "error",
      resolved: phase === "complete" || phase === "cancelled",
      dispatch,
      submit,
      cancel,
      reset,
    }),
    [phase, error, dispatch, submit, cancel, reset],
  );
}
