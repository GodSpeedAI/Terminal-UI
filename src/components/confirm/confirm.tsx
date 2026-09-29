import { useCallback, useState } from "react";
import { confirmHint } from "../../hooks/hints.js";
import { usePromptKeys } from "../../hooks/use-prompt-keys.js";
import { type KeyHintPair, Muted } from "../../primitives/label.js";
import { Marker } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { PromptPhase } from "../../theme/state.js";
import { joinStyled, paint } from "../../utils/style.js";
import { Prompt } from "../prompt/prompt.js";

export interface ConfirmProps {
  message: string;
  /** The accepted answer. Defaults to `true`. */
  initialValue?: boolean;
  onSubmit?: (value: boolean) => void;
  onCancel?: () => void;
  validate?: (value: boolean) => string | null | undefined;
  phase?: PromptPhase;
  error?: string | null;
  availableWidth?: number;
  disabled?: boolean;
  /** Custom labels for the two answers. */
  labels?: { yes?: string; no?: string };
  hint?: readonly KeyHintPair[];
}

/**
 * A two-way choice rendered on a single line.
 *
 * The reference grammar is `● Yes / ○ No` — both answers visible at once, the
 * chosen one marked. That matters more than it looks: a hidden alternative is
 * not a shortcut, it is a guess, and confirming a `false` you could not see is
 * the worst outcome this component can produce.
 *
 * Left/right and Tab switch the answer, Y/N jump directly, Enter submits,
 * Escape cancels.
 */
export function Confirm({
  message,
  initialValue = true,
  onSubmit,
  onCancel,
  validate,
  phase: phaseProp,
  error: errorProp,
  availableWidth,
  disabled = false,
  labels,
  hint: hintProp,
}: ConfirmProps) {
  const { theme } = useTheme();
  const [answer, setAnswer] = useState(initialValue);
  const [internalPhase, setInternalPhase] = useState<PromptPhase>("active");
  const [internalError, setInternalError] = useState<string | null>(null);

  const controlled = phaseProp !== undefined;
  const phase = controlled ? phaseProp : internalPhase;
  const error = controlled ? (errorProp ?? null) : internalError;
  const open = phase === "active" || phase === "validating" || phase === "error";
  const hint = hintProp ?? confirmHint(theme);

  const yes = labels?.yes ?? "Yes";
  const no = labels?.no ?? "No";

  const attemptSubmit = useCallback(
    (value: boolean) => {
      if (!controlled) setInternalPhase("validating");
      const message = validate?.(value) ?? null;
      if (!controlled) {
        if (message) {
          setInternalError(message);
          setInternalPhase("error");
        } else {
          setInternalError(null);
          setInternalPhase("complete");
        }
      }
      if (!message) onSubmit?.(value);
    },
    [controlled, onSubmit, validate],
  );

  const attemptCancel = useCallback(() => {
    if (!controlled) setInternalPhase("cancelled");
    onCancel?.();
  }, [controlled, onCancel]);

  usePromptKeys(
    {
      left: () => setAnswer(false),
      right: () => setAnswer(true),
      up: () => setAnswer(false),
      down: () => setAnswer(true),
      tab: () => setAnswer((a) => !a),
      return: () => attemptSubmit(answer),
      enter: () => attemptSubmit(answer),
      escape: attemptCancel,
      cancel: attemptCancel,
      print: (key) => {
        const ch = key.text.toLowerCase();
        if (ch === "y") setAnswer(true);
        else if (ch === "n") setAnswer(false);
      },
    },
    { active: open && !disabled },
  );

  const answerLabel = answer ? yes : no;

  return (
    <Prompt
      message={message}
      phase={phase}
      error={error}
      hint={hint}
      availableWidth={availableWidth}
      disabled={disabled}
      summary={
        phase === "complete" ? (
          <text content={joinStyled([paint(answerLabel, theme.text.value)])} wrapMode="none" truncate />
        ) : phase === "cancelled" ? (
          <Muted>cancelled</Muted>
        ) : undefined
      }
    >
      {/*
        Both answers stay in place and the *marker* moves between them. Letting
        the labels swap instead makes the row read as if the options themselves
        changed, which is disorienting in a terminal where you cannot see a
        transition.
      */}
      {open ? (
        <box flexDirection="row" width="100%" minWidth={0}>
          <Marker state={answer ? "selected" : "unselected"} />
          <box flexDirection="row" minWidth={0} paddingLeft={theme.spacing.optionGap}>
            <text
              content={paint(yes, answer ? theme.text.value : theme.text.hint)}
              wrapMode="none"
              truncate={availableWidth !== undefined}
            />
          </box>
          <text content={paint(" / ", theme.text.hintKey)} wrapMode="none" />
          <Marker state={answer ? "unselected" : "selected"} />
          <box flexDirection="row" minWidth={0} paddingLeft={theme.spacing.optionGap}>
            <text
              content={paint(no, answer ? theme.text.hint : theme.text.value)}
              wrapMode="none"
              truncate={availableWidth !== undefined}
            />
          </box>
        </box>
      ) : null}
    </Prompt>
  );
}
