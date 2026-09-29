import { useCallback, useMemo, useRef, useState } from "react";
import { navigateConfirmHints } from "../../hooks/hints.js";
import { useAvailableWidth } from "../../hooks/use-available-width.js";
import { usePromptKeys } from "../../hooks/use-prompt-keys.js";
import { type KeyHintPair, Label, Muted } from "../../primitives/label.js";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { PromptPhase } from "../../theme/state.js";
import { joinStyled, paint } from "../../utils/style.js";
import { Prompt } from "../prompt/prompt.js";

/** One choice in an `Autocomplete`. */
export interface AutocompleteOption<TValue> {
  value: TValue;
  label: string;
  /** Secondary text, rendered muted after the label in parentheses. */
  hint?: string;
  /**
   * Not selectable. Excluded from the filtered list entirely, so typing can
   * never highlight it and Enter can never accept it.
   */
  disabled?: boolean;
}

export interface AutocompleteProps<TValue> {
  message: string;
  options: readonly AutocompleteOption<TValue>[];
  /**
   * Called with the accepted value when the prompt resolves successfully.
   *
   * The union is the contract: a `TValue` when the accepted submit came from a
   * highlighted match, a `string` when the filter matched nothing and the raw
   * typed text was submitted instead. Callers that only want matched options
   * can narrow with `typeof value === "string"`.
   */
  onSubmit?: (value: TValue | string) => void;
  /** Called when the prompt is cancelled. */
  onCancel?: () => void;
  /** Reject a submit — matched or raw. Return a message to block it. */
  validate?: (value: TValue | string) => string | null | undefined;
  /**
   * Phase override. Supply this to drive the prompt from outside (the Workbench
   * and the scenario tests do); omit it to let `Autocomplete` own its lifecycle.
   */
  phase?: PromptPhase;
  /** Error message override, paired with `phase`. */
  error?: string | null;
  /** How many matches to show before scrolling. Defaults to 8. */
  maxVisible?: number;
  /** Available width in cells. */
  availableWidth?: number;
  /** Render the prompt non-interactive. */
  disabled?: boolean;
  /** Override the keyboard hint. */
  hint?: readonly KeyHintPair[];
}

/**
 * A filtering combobox.
 *
 * The shell, the rail, and the collapse belong to `Prompt`; this control
 * contributes the filter, the match list, and its own collapsed summary — the
 * same division of labour as `Select`, with typed text taking the place of the
 * cursor.
 *
 * Keyboard model: a printable character appends to the filter and the list
 * narrows to the enabled options whose label contains it (case-insensitive
 * substring); Backspace deletes the last character. Editing is append-only —
 * there is no caret and no caret movement to render or test, because a filter
 * is a query, not a document, and every keystroke either narrows the query at
 * its end or deletes from it. ↑/↓ move the highlight over the matches (always
 * wrapping, never skipping — a disabled option is not in the filtered list at
 * all), Home/End jump to the first and last match, Enter accepts the
 * highlighted match — or, when nothing matches, submits the raw typed text —
 * and Escape and Ctrl+C cancel. The prompt only claims keys while it is open,
 * so nested controls do not compete for the same keystroke.
 *
 * The filter is the component's own editing state; lifecycle belongs to
 * `Prompt`. Like `TextInput`, the authoritative query lives in a ref that the
 * key handlers read and mutate synchronously: React batches the keystrokes
 * that arrive in one frame, so a handler reading the filter from its render
 * closure would see the same stale value for all of them and the sequence
 * would not compose.
 */
export function Autocomplete<TValue>({
  message,
  options,
  onSubmit,
  onCancel,
  validate,
  phase: phaseProp,
  error: errorProp,
  maxVisible = 8,
  availableWidth,
  disabled = false,
  hint: hintProp,
}: AutocompleteProps<TValue>) {
  const { theme } = useTheme();
  // Falls back to the renderer's real width so truncation is the default
  // behaviour, not something a caller has to opt into.
  const width = useAvailableWidth(availableWidth);
  const hint = hintProp ?? navigateConfirmHints(theme);

  const [internalPhase, setInternalPhase] = useState<PromptPhase>("active");
  const [internalError, setInternalError] = useState<string | null>(null);

  // When the caller drives the phase, the component keeps its own filter and
  // highlight — only the lifecycle is owned from outside, exactly as in
  // `Select` and `TextInput`.
  const controlled = phaseProp !== undefined;
  const phase = controlled ? phaseProp : internalPhase;
  const error = controlled ? (errorProp ?? null) : internalError;
  const open = phase === "active" || phase === "validating" || phase === "error";
  const resolved = phase === "complete" || phase === "cancelled";

  const [query, setQueryState] = useState("");
  const [cursor, setCursorState] = useState(0);

  // The synchronous truths behind `query` and `cursor`, for the same batching
  // reason `TextInput` keeps a `valueRef`. Updated directly by the key
  // handlers, so a typed character followed by Enter in one batch sees the
  // filter the character produced, not the one the render closure captured.
  const queryRef = useRef("");
  const cursorRef = useRef(0);

  /** Enabled options whose label contains `q`, case-insensitively. */
  const matchesFor = useCallback(
    (q: string) => {
      const lower = q.toLowerCase();
      return options.filter((option) => !option.disabled && option.label.toLowerCase().includes(lower));
    },
    [options],
  );

  const setQuery = useCallback((next: string) => {
    queryRef.current = next;
    setQueryState(next);
    // A new filter restarts the highlight at the first match; a highlight
    // carried over from the previous filter would point at an option the
    // user is no longer looking at.
    cursorRef.current = 0;
    setCursorState(0);
  }, []);

  const move = useCallback(
    (delta: number) => {
      const count = matchesFor(queryRef.current).length;
      if (count === 0) return;
      const next = (cursorRef.current + delta + count) % count;
      cursorRef.current = next;
      setCursorState(next);
    },
    [matchesFor],
  );

  const moveTo = useCallback(
    (edge: "first" | "last") => {
      const count = matchesFor(queryRef.current).length;
      if (count === 0) return;
      const next = edge === "first" ? 0 : count - 1;
      cursorRef.current = next;
      setCursorState(next);
    },
    [matchesFor],
  );

  const attemptSubmit = useCallback(() => {
    const matches = matchesFor(queryRef.current);
    const chosen = matches[cursorRef.current];
    // A highlighted match submits the matched option's value; a filter with
    // no matches submits the raw typed text. The union is the component's
    // contract, documented on `onSubmit`.
    const value: TValue | string = chosen ? chosen.value : queryRef.current;
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
  }, [controlled, matchesFor, onSubmit, validate]);

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
      backspace: () => {
        const current = queryRef.current;
        if (current === "") return;
        setQuery(current.slice(0, -1));
      },
      return: attemptSubmit,
      enter: attemptSubmit,
      escape: attemptCancel,
      cancel: attemptCancel,
      print: (key) => setQuery(queryRef.current + key.text),
    },
    { active: open && !disabled },
  );

  const matches = useMemo(() => matchesFor(query), [matchesFor, query]);

  // A highlighted match summarizes as its label; a raw submit as the typed
  // text, which is the answer the user actually gave.
  const chosen = matches[cursor];
  const chosenSummary =
    chosen === undefined
      ? undefined
      : joinStyled([
          paint(chosen.label, theme.text.value),
          ...(chosen.hint ? [paint(` (${chosen.hint})`, theme.text.muted)] : []),
        ]);

  // Scrolling keeps the highlighted match inside the visible window. The
  // window is centred on the cursor rather than pinned, which is what makes a
  // long list feel stable while arrowing through it.
  const window = useMemo(() => {
    if (matches.length <= maxVisible) {
      return { start: 0, end: matches.length, hiddenAbove: 0, hiddenBelow: 0 };
    }
    const start = Math.max(0, Math.min(cursor - Math.floor(maxVisible / 2), matches.length - maxVisible));
    const end = start + maxVisible;
    return { start, end, hiddenAbove: start, hiddenBelow: matches.length - end };
  }, [cursor, maxVisible, matches.length]);

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
          chosenSummary !== undefined ? (
            <text content={chosenSummary} wrapMode="none" truncate={optionBudget !== undefined} />
          ) : query === "" ? (
            <Muted>(empty)</Muted>
          ) : (
            <text content={paint(query, theme.text.value)} wrapMode="none" truncate />
          )
        ) : phase === "cancelled" ? (
          <Muted>cancelled</Muted>
        ) : undefined
      }
    >
      {open ? (
        <box flexDirection="column" width="100%">
          {matches.length === 0 ? (
            <RailRow muted>
              <Muted>no matches</Muted>
            </RailRow>
          ) : (
            <>
              {window.hiddenAbove > 0 ? <ScrollHint direction="up" count={window.hiddenAbove} /> : null}
              {matches.slice(window.start, window.end).map((option) => {
                const index = matches.indexOf(option);
                const active = index === cursor && !resolved;
                const state = option.disabled ? "disabled" : active ? "selected" : "unselected";
                return (
                  <RailRow key={`${String(option.value)}-${index}`} muted={!active}>
                    <box flexDirection="row" width="100%" minWidth={0}>
                      <Marker state={state} />
                      <box
                        flexDirection="row"
                        flexGrow={1}
                        paddingLeft={theme.spacing.optionGap}
                        minWidth={0}
                      >
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
            </>
          )}
        </box>
      ) : null}
    </Prompt>
  );
}

/**
 * A rail row announcing that matches exist outside the visible window.
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
