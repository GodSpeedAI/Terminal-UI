import { useCallback, useMemo, useState } from "react";
import { navigateConfirmHints, toggleHint } from "../../hooks/hints.js";
import { useAvailableWidth } from "../../hooks/use-available-width.js";
import { usePromptKeys } from "../../hooks/use-prompt-keys.js";
import { type KeyHintPair, Label, Muted } from "../../primitives/label.js";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { PromptPhase } from "../../theme/state.js";
import { joinStyled, paint } from "../../utils/style.js";
import { Prompt } from "../prompt/prompt.js";

export interface MultiSelectOption<TValue> {
  value: TValue;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface MultiSelectProps<TValue> {
  message: string;
  options: readonly MultiSelectOption<TValue>[];
  /** Values selected when the prompt opens. */
  defaultValues?: readonly TValue[];
  onSubmit?: (values: TValue[]) => void;
  onCancel?: () => void;
  validate?: (values: TValue[]) => string | null | undefined;
  /** Require at least one selection before the prompt will submit. */
  required?: boolean;
  phase?: PromptPhase;
  error?: string | null;
  maxVisible?: number;
  availableWidth?: number;
  disabled?: boolean;
  hint?: readonly KeyHintPair[];
}

/** Join a multi-value summary the way the grammar reads best. */
function joinValues(values: readonly string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0] as string;
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1] as string}`;
}

/**
 * A multiple-choice list.
 *
 * Same shell, same rail, same collapse as `Select`; the difference is that
 * Space toggles membership instead of committing, and Enter commits the whole
 * set. The cursor and the selection are tracked separately on purpose: a user
 * needs to see where they *are* and what they have *picked* at the same time,
 * and collapsing those into one concept is what makes naive multi-selects
 * unreadable.
 */
export function MultiSelect<TValue>({
  message,
  options,
  defaultValues = [],
  onSubmit,
  onCancel,
  validate,
  required = false,
  phase: phaseProp,
  error: errorProp,
  maxVisible = 8,
  availableWidth,
  disabled = false,
  hint: hintProp,
}: MultiSelectProps<TValue>) {
  const { theme } = useTheme();
  const width = useAvailableWidth(availableWidth);
  const hint = hintProp ?? navigateConfirmHints(theme, [toggleHint(theme)]);
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<readonly TValue[]>(defaultValues);
  const [internalPhase, setInternalPhase] = useState<PromptPhase>("active");
  const [internalError, setInternalError] = useState<string | null>(null);

  const controlled = phaseProp !== undefined;
  const phase = controlled ? phaseProp : internalPhase;
  const error = controlled ? (errorProp ?? null) : internalError;
  const open = phase === "active" || phase === "validating" || phase === "error";
  const move = useCallback(
    (delta: number) => {
      if (options.length === 0) return;
      setCursor((c) => (c + delta + options.length) % options.length);
    },
    [options.length],
  );

  const toggle = useCallback(() => {
    const option = options[cursor];
    if (!option || option.disabled) return;
    setChecked((current) =>
      current.includes(option.value) ? current.filter((v) => v !== option.value) : [...current, option.value],
    );
  }, [cursor, options]);

  const attemptSubmit = useCallback(() => {
    if (!controlled) setInternalPhase("validating");
    const message =
      (required && checked.length === 0 ? "Select at least one option" : null) ??
      validate?.([...checked]) ??
      null;
    if (!controlled) {
      if (message) {
        setInternalError(message);
        setInternalPhase("error");
      } else {
        setInternalError(null);
        setInternalPhase("complete");
      }
    }
    if (!message) onSubmit?.([...checked]);
  }, [checked, controlled, onSubmit, required, validate]);

  const attemptCancel = useCallback(() => {
    if (!controlled) setInternalPhase("cancelled");
    onCancel?.();
  }, [controlled, onCancel]);

  usePromptKeys(
    {
      up: () => move(-1),
      down: () => move(1),
      home: () => setCursor(0),
      end: () => setCursor(Math.max(0, options.length - 1)),
      space: toggle,
      return: attemptSubmit,
      enter: attemptSubmit,
      escape: attemptCancel,
      cancel: attemptCancel,
    },
    { active: open && !disabled },
  );

  const selectedLabels = useMemo(
    () =>
      options
        .filter((o) => checked.includes(o.value))
        .map((o) => (o.hint ? `${o.label} (${o.hint})` : o.label)),
    [checked, options],
  );

  const window = useMemo(() => {
    if (options.length <= maxVisible) {
      return { start: 0, end: options.length };
    }
    const start = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), options.length - maxVisible));
    return { start, end: start + maxVisible };
  }, [cursor, maxVisible, options.length]);

  const optionBudget =
    width === undefined
      ? undefined
      : Math.max(
          0,
          width -
            theme.spacing.railWidth -
            theme.spacing.bodyIndent -
            theme.markers[selectedStateFor(checked, options[cursor])].width -
            theme.spacing.optionGap,
        );

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
          selectedLabels.length === 0 ? (
            <Muted>none</Muted>
          ) : (
            <text
              content={joinStyled([paint(joinValues(selectedLabels), theme.text.value)])}
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
        <box flexDirection="column" width="100%">
          {options.slice(window.start, window.end).map((option, i) => {
            const index = window.start + i;
            const active = index === cursor;
            const isChecked = checked.includes(option.value);
            const state = option.disabled
              ? "disabled"
              : active
                ? isChecked
                  ? "checked"
                  : "selected"
                : isChecked
                  ? "checked"
                  : "unchecked";
            return (
              <RailRow key={`${String(option.value)}-${index}`} muted={!active}>
                <box flexDirection="row" width="100%" minWidth={0}>
                  <Marker state={state} />
                  <box flexDirection="row" flexGrow={1} paddingLeft={theme.spacing.optionGap} minWidth={0}>
                    <Label
                      maxWidth={optionBudget}
                      muted={option.disabled === true}
                      value={active && isChecked}
                    >
                      {option.label}
                    </Label>
                    {option.hint ? (
                      <>
                        <text content={paint(" ", theme.text.muted)} wrapMode="none" />
                        <Muted maxWidth={optionBudget}>({option.hint})</Muted>
                      </>
                    ) : null}
                  </box>
                </box>
              </RailRow>
            );
          })}
        </box>
      ) : null}
    </Prompt>
  );
}

/** The marker state for an option, given the selection and cursor position. */
function selectedStateFor<TValue>(
  checked: readonly TValue[],
  option: MultiSelectOption<TValue> | undefined,
): "checked" | "unchecked" {
  if (!option) return "unchecked";
  return checked.includes(option.value) ? "checked" : "unchecked";
}
