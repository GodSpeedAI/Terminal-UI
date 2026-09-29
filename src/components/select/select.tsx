import { useCallback, useMemo, useState } from "react";
import { navigateConfirmHints } from "../../hooks/hints.js";
import { useAvailableWidth } from "../../hooks/use-available-width.js";
import { usePromptKeys } from "../../hooks/use-prompt-keys.js";
import { type KeyHintPair, Label, Muted } from "../../primitives/label.js";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { PromptPhase } from "../../theme/state.js";
import { joinStyled, paint } from "../../utils/style.js";
import { Prompt } from "../prompt/prompt.js";

/** One choice in a `Select`. */
export interface SelectOption<TValue> {
  value: TValue;
  label: string;
  /** Secondary text, rendered muted after the label in parentheses. */
  hint?: string;
  /** Not selectable. Skipped by keyboard navigation and rendered disabled. */
  disabled?: boolean;
}

export interface SelectProps<TValue> {
  message: string;
  options: readonly SelectOption<TValue>[];
  /** Index highlighted when the prompt opens. Defaults to the first enabled option. */
  initialIndex?: number;
  /** Called with the chosen value when the prompt resolves successfully. */
  onSubmit?: (value: TValue) => void;
  /** Called when the prompt is cancelled. */
  onCancel?: () => void;
  /** Reject a choice. Return a message to block the submit. */
  validate?: (value: TValue) => string | null | undefined;
  /**
   * Phase override. Supply this to drive the prompt from outside (the Workbench
   * and the scenario tests do); omit it to let `Select` own its lifecycle.
   */
  phase?: PromptPhase;
  /** Error message override, paired with `phase`. */
  error?: string | null;
  /** How many options to show before scrolling. Defaults to 8. */
  maxVisible?: number;
  /** Available width in cells. */
  availableWidth?: number;
  /** Render the prompt non-interactive. */
  disabled?: boolean;
  /** Override the keyboard hint. */
  hint?: readonly KeyHintPair[];
}

/**
 * A single-choice list.
 *
 * The reference interactive component. It contributes only the option list, the
 * keyboard model, and its own collapsed summary — the rail, the question, the
 * hint row, error presentation, and the active → submitted collapse all belong
 * to `Prompt`, which is what keeps the visual grammar from being reimplemented
 * per control.
 *
 * Keyboard model: arrows move (skipping disabled, wrapping at both ends),
 * Home/End jump to the first and last enabled option, a printable character
 * type-ahead-jumps to the next matching label, Enter submits, Escape and
 * Ctrl+C cancel. The prompt only claims keys while it is open, so nested
 * controls do not compete for the same keystroke.
 */
export function Select<TValue>({
  message,
  options,
  initialIndex,
  onSubmit,
  onCancel,
  validate,
  phase: phaseProp,
  error: errorProp,
  maxVisible = 8,
  availableWidth,
  disabled = false,
  hint: hintProp,
}: SelectProps<TValue>) {
  const { theme } = useTheme();
  // Falls back to the renderer's real width so truncation is the default
  // behaviour, not something a caller has to opt into.
  const width = useAvailableWidth(availableWidth);
  const hint = hintProp ?? navigateConfirmHints(theme);
  const enabled = useMemo(
    () => options.map((o, i) => ({ option: o, index: i })).filter((e) => !e.option.disabled),
    [options],
  );

  const firstEnabled = enabled[0]?.index ?? 0;
  const [cursor, setCursor] = useState(initialIndex ?? firstEnabled);
  const [internalPhase, setInternalPhase] = useState<PromptPhase>("active");
  const [internalError, setInternalError] = useState<string | null>(null);

  // When the caller drives the phase, mirror the cursor onto the controlled
  // choice so the rendered list and the shell can never disagree.
  const controlled = phaseProp !== undefined;
  const phase = controlled ? phaseProp : internalPhase;
  const error = controlled ? (errorProp ?? null) : internalError;
  const open = phase === "active" || phase === "validating" || phase === "error";
  const resolved = phase === "complete" || phase === "cancelled";

  const move = useCallback(
    (delta: number) => {
      if (enabled.length === 0) return;
      setCursor((current) => {
        const currentPos = enabled.findIndex((e) => e.index === current);
        const from = currentPos === -1 ? 0 : currentPos;
        const next = (from + delta + enabled.length) % enabled.length;
        return (enabled[next] as (typeof enabled)[number]).index;
      });
    },
    [enabled],
  );

  const moveTo = useCallback(
    (edge: "first" | "last") => {
      if (enabled.length === 0) return;
      const entry = edge === "first" ? enabled[0] : enabled[enabled.length - 1];
      if (entry) setCursor(entry.index);
    },
    [enabled],
  );

  /** Type-ahead: jump to the next enabled option whose label starts with `ch`. */
  const jumpToPrefix = useCallback(
    (ch: string) => {
      if (enabled.length === 0) return;
      const lower = ch.toLowerCase();
      const currentPos = enabled.findIndex((e) => e.index === cursor);
      for (let step = 1; step <= enabled.length; step++) {
        const pos = (Math.max(0, currentPos) + step) % enabled.length;
        const entry = enabled[pos] as (typeof enabled)[number];
        if (entry.option.label.toLowerCase().startsWith(lower)) {
          setCursor(entry.index);
          return;
        }
      }
    },
    [cursor, enabled],
  );

  const attemptSubmit = useCallback(() => {
    const chosen = options[cursor];
    if (!chosen || chosen.disabled) return;
    if (!controlled) setInternalPhase("validating");
    const message = validate?.(chosen.value) ?? null;
    if (!controlled) {
      if (message) {
        setInternalError(message);
        setInternalPhase("error");
      } else {
        setInternalError(null);
        setInternalPhase("complete");
      }
    }
    if (!message) onSubmit?.(chosen.value);
  }, [controlled, cursor, onSubmit, options, validate]);

  const attemptCancel = useCallback(() => {
    if (!controlled) setInternalPhase("cancelled");
    onCancel?.();
  }, [controlled, onCancel]);

  usePromptKeys(
    {
      up: () => move(-1),
      down: () => move(1),
      home: () => moveTo("first"),
      end: () => moveTo("last"),
      return: attemptSubmit,
      enter: attemptSubmit,
      escape: attemptCancel,
      cancel: attemptCancel,
      print: (key) => jumpToPrefix(key.text.slice(0, 1)),
    },
    { active: open && !disabled },
  );

  const chosen = options[cursor];
  const summary =
    chosen === undefined
      ? undefined
      : joinStyled([
          paint(chosen.label, theme.text.value),
          ...(chosen.hint ? [paint(` (${chosen.hint})`, theme.text.muted)] : []),
        ]);

  // Scrolling keeps the highlighted option inside the visible window. The
  // window is centred on the cursor rather than pinned, which is what makes a
  // long list feel stable while arrowing through it.
  const window = useMemo(() => {
    if (options.length <= maxVisible) {
      return { start: 0, end: options.length, hiddenAbove: 0, hiddenBelow: 0 };
    }
    const start = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), options.length - maxVisible));
    const end = start + maxVisible;
    return { start, end, hiddenAbove: start, hiddenBelow: options.length - end };
  }, [cursor, maxVisible, options.length]);

  const optionBudget =
    width === undefined
      ? undefined
      : Math.max(0, width - theme.spacing.railWidth - theme.spacing.bodyIndent - 1 - theme.spacing.optionGap);

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
          <text content={summary} wrapMode="none" truncate={optionBudget !== undefined} />
        ) : phase === "cancelled" ? (
          <Muted>cancelled</Muted>
        ) : undefined
      }
    >
      {open ? (
        <box flexDirection="column" width="100%">
          {window.hiddenAbove > 0 ? <ScrollHint direction="up" count={window.hiddenAbove} /> : null}
          {options.slice(window.start, window.end).map((option) => {
            const index = options.indexOf(option);
            const active = index === cursor && !resolved;
            const state = option.disabled ? "disabled" : active ? "selected" : "unselected";
            return (
              <RailRow key={`${String(option.value)}-${index}`} muted={!active}>
                <box flexDirection="row" width="100%" minWidth={0}>
                  <Marker state={state} />
                  <box flexDirection="row" flexGrow={1} paddingLeft={theme.spacing.optionGap} minWidth={0}>
                    <Label maxWidth={optionBudget} muted={option.disabled === true} value={active}>
                      {option.label}
                    </Label>
                    {option.hint ? <text content={paint(" ", theme.text.muted)} wrapMode="none" /> : null}
                    {option.hint ? <Muted maxWidth={optionBudget}>({option.hint})</Muted> : null}
                  </box>
                </box>
              </RailRow>
            );
          })}
          {window.hiddenBelow > 0 ? <ScrollHint direction="down" count={window.hiddenBelow} /> : null}
        </box>
      ) : null}
    </Prompt>
  );
}

/**
 * A rail row announcing that options exist outside the visible window.
 *
 * Without it a long list silently looks complete, which is a correctness
 * problem rather than a cosmetic one.
 */
function ScrollHint({ direction, count }: { direction: "up" | "down"; count: number }) {
  return (
    <RailRow muted>
      <Muted>{direction === "up" ? `↑ ${count} more` : `↓ ${count} more`}</Muted>
    </RailRow>
  );
}
