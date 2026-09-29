import { useCallback, useMemo, useRef, useState } from "react";
import { submitHint } from "../../hooks/hints.js";
import { useAvailableWidth } from "../../hooks/use-available-width.js";
import { usePromptKeys } from "../../hooks/use-prompt-keys.js";
import { type KeyHintPair, Muted } from "../../primitives/label.js";
import { RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { PromptPhase } from "../../theme/state.js";
import { paint } from "../../utils/style.js";
import { Prompt } from "../prompt/prompt.js";

export interface TextInputProps {
  message: string;
  /**
   * The value.
   *
   * Supply `onValueChange` alongside it and the field is fully controlled: the
   * component renders exactly what you give it and never mutates it. Supply
   * `value` *without* `onValueChange` and it is treated as the initial value,
   * with the component owning subsequent edits.
   *
   * That distinction matters: a controlled field with no change handler is a
   * field the user cannot type into, which looks like a hung input rather than
   * a mis-wired one. Rendering it as the initial value is the only reading that
   * cannot surprise someone at a terminal.
   */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Shown muted when the value is empty. */
  placeholder?: string;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  validate?: (value: string) => string | null | undefined;
  phase?: PromptPhase;
  error?: string | null;
  availableWidth?: number;
  disabled?: boolean;
  hint?: readonly KeyHintPair[];
  /**
   * Mask every character. Used by `PasswordInput`.
   *
   * The cursor stays visible as a reverse-video block, matching the reference
   * treatment of an empty field.
   */
  mask?: boolean;
  /** Allow a multi-line value with Enter, submitting on Ctrl+Enter. */
  multiline?: boolean;
}

/**
 * A single-line text field.
 *
 * Editing state is the component's own; lifecycle belongs to `Prompt`. The
 * cursor is rendered as a reverse-video block rather than a real terminal
 * cursor, so it is deterministic in tests and does not depend on the terminal
 * honouring a cursor position over a re-rendered frame.
 */
export function TextInput({
  message,
  value: valueProp,
  onValueChange,
  placeholder,
  onSubmit,
  onCancel,
  validate,
  phase: phaseProp,
  error: errorProp,
  availableWidth,
  disabled = false,
  hint: hintProp,
  mask = false,
  multiline = false,
}: TextInputProps) {
  const { theme } = useTheme();
  const width = useAvailableWidth(availableWidth);
  const hint = hintProp ?? submitHint(theme);
  const [internal, setInternal] = useState(valueProp ?? "");
  const [caretState, setCaret] = useState(() => (valueProp ?? "").length);
  // Controlled only when a change handler is supplied alongside the value.
  const controlled = valueProp !== undefined && onValueChange !== undefined;
  const value = controlled ? (valueProp as string) : internal;
  const [internalPhase, setInternalPhase] = useState<PromptPhase>("active");
  const [internalError, setInternalError] = useState<string | null>(null);

  const isControlledPhase = phaseProp !== undefined;
  const phase = isControlledPhase ? phaseProp : internalPhase;
  const error = isControlledPhase ? (errorProp ?? null) : internalError;
  const open = phase === "active" || phase === "validating" || phase === "error";
  const _resolved = phase === "complete" || phase === "cancelled";

  /**
   * The authoritative value, readable synchronously by the key handler.
   *
   * React batches the keystrokes that arrive in one frame, so a handler that
   * reads the value from its render closure sees the *same* stale value for all
   * of them. Typing "demo" then yields "o" — the last character, each keystroke
   * overwriting the previous one from a shared empty base. A ref updated
   * synchronously makes the sequence compose, which is the same reason a DOM
   * input keeps its own value rather than re-deriving it from props mid-edit.
   */
  const valueRef = useRef(valueProp ?? internal);
  valueRef.current = controlled ? (valueProp as string) : valueRef.current;
  const caretRef = useRef(caretState);
  caretRef.current = caretState;

  const setValue = useCallback(
    (next: string, nextCaret = next.length) => {
      valueRef.current = next;
      caretRef.current = nextCaret;
      // The caret is local state even when the value is controlled: it is
      // editing state, not application state, and forcing a parent round-trip
      // for every arrow key is how a controlled field ends up untypable.
      setCaret(nextCaret);
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const attemptSubmit = useCallback(() => {
    if (!isControlledPhase) setInternalPhase("validating");
    const message = validate?.(valueRef.current) ?? null;
    if (!isControlledPhase) {
      if (message) {
        setInternalError(message);
        setInternalPhase("error");
      } else {
        setInternalError(null);
        setInternalPhase("complete");
      }
    }
    if (!message) onSubmit?.(valueRef.current);
  }, [isControlledPhase, onSubmit, validate]);

  const attemptCancel = useCallback(() => {
    if (!isControlledPhase) setInternalPhase("cancelled");
    onCancel?.();
  }, [isControlledPhase, onCancel]);

  usePromptKeys(
    {
      return: () => {
        if (multiline) {
          const current = valueRef.current;
          setValue(`${current}\n`, current.length + 1);
          return;
        }
        attemptSubmit();
      },
      backspace: () => {
        const current = valueRef.current;
        const at = caretRef.current;
        if (at === 0) return;
        setValue(current.slice(0, at - 1) + current.slice(at), at - 1);
      },
      delete: () => {
        const current = valueRef.current;
        const at = caretRef.current;
        if (at >= current.length) return;
        setValue(current.slice(0, at) + current.slice(at + 1), at);
      },
      left: () => setValue(valueRef.current, Math.max(0, caretRef.current - 1)),
      right: () => setValue(valueRef.current, Math.min(valueRef.current.length, caretRef.current + 1)),
      home: () => setValue(valueRef.current, 0),
      end: () => setValue(valueRef.current, valueRef.current.length),
      escape: attemptCancel,
      cancel: attemptCancel,
      print: (key) => {
        const current = valueRef.current;
        const at = caretRef.current;
        setValue(current.slice(0, at) + key.text + current.slice(at), at + key.text.length);
      },
    },
    { active: open && !disabled },
  );

  const budget =
    width === undefined ? undefined : Math.max(0, width - theme.spacing.railWidth - theme.spacing.bodyIndent);

  const field = useMemo(() => {
    if (mask) {
      return { char: theme.passwordMask.char, width: theme.passwordMask.width };
    }
    return { char: " ", width: 1 };
  }, [mask, theme.passwordMask]);

  const shown = mask ? field.char.repeat(value.length) : value;
  const empty = value === "";

  return (
    <Prompt
      message={message}
      phase={phase}
      error={error}
      hint={hint}
      availableWidth={width}
      disabled={disabled}
      summary={
        phase === "complete" ? (
          empty ? (
            <Muted>(empty)</Muted>
          ) : (
            <text
              content={paint(mask ? field.char.repeat(value.length) : value, theme.text.value)}
              wrapMode="none"
              truncate
            />
          )
        ) : phase === "cancelled" ? (
          <Muted>cancelled</Muted>
        ) : undefined
      }
    >
      {open ? (
        <RailRow>
          <box flexDirection="row" width="100%" minWidth={0}>
            <box flexShrink={0} minWidth={0}>
              <text
                content={paint(
                  empty && placeholder ? placeholder : shown,
                  empty && placeholder ? theme.text.muted : theme.text.value,
                )}
                wrapMode="none"
                truncate={budget !== undefined}
              />
            </box>
            {/*
              The cursor is a reverse-video block drawn immediately after the
              text. It is shown even when a placeholder is displayed, so an
              empty-but-focused field is distinguishable from one that is not
              focused — the placeholder alone cannot carry that information.
            */}
            <text
              content={paint(field.char, { color: theme.text.value.color, inverse: true })}
              wrapMode="none"
            />
          </box>
        </RailRow>
      ) : null}
    </Prompt>
  );
}

/**
 * A text field that masks its value.
 *
 * A thin wrapper over `TextInput` rather than a fork, so the two cannot drift
 * apart in keyboard handling or presentation.
 */
export function PasswordInput(props: Omit<TextInputProps, "mask" | "multiline">) {
  return <TextInput {...props} mask />;
}
