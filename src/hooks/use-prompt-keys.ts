import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useRef } from "react";

/** The keys this library acts on, named rather than compared as escape codes. */
export type KeyName =
  | "up"
  | "down"
  | "left"
  | "right"
  | "return"
  | "enter"
  | "escape"
  | "tab"
  | "backspace"
  | "delete"
  | "home"
  | "end"
  | "pageup"
  | "pagedown"
  | "space";

/** Normalised view of a `KeyEvent`, plus the raw event for anything richer. */
export interface NormalizedKey {
  name: KeyName | string;
  /** True for the space bar. Distinct from a literal `" "` sequence. */
  space: boolean;
  /** The literal text this key produced, for text-entry controls. */
  text: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  raw: KeyEvent;
}

/** Map an OpenTUI `KeyEvent` onto a comparable, unit-testable shape. */
export function normalizeKey(event: KeyEvent): NormalizedKey {
  const text = event.sequence ?? event.raw ?? "";
  return {
    name: event.name,
    space: event.name === "space" || text === " ",
    text,
    ctrl: Boolean(event.ctrl),
    meta: Boolean(event.meta),
    shift: Boolean(event.shift),
    raw: event,
  };
}

/** True when the key is a printable character the user typed. */
export function isPrintable(key: NormalizedKey): boolean {
  if (key.ctrl || key.meta) return false;
  if (["up", "down", "left", "right", "return", "escape", "tab", "space"].includes(key.name)) {
    return false;
  }
  if (key.name === "backspace" || key.name === "delete") return false;
  // Keep the character; drop control sequences like escape-code fragments.
  // A leading ESC means this is a fragment of an escape sequence, not a
  // character the user typed; the control-character class has to be matched
  // literally for that test to mean anything.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ESC is the point
  return key.text.length > 0 && !/^\x1b/.test(key.text) && key.text.charCodeAt(0) >= 0x20;
}

/** True when the key is the platform's cancel chord. */
export function isCancelChord(key: NormalizedKey): boolean {
  return key.ctrl && (key.name === "c" || key.text === "c" || key.text === "");
}

/** Map a key to a canonical printable action name, for tests and hints. */
export type KeyHandlerMap = Partial<Record<KeyName, () => void>> & {
  print?: (key: NormalizedKey) => void;
  cancel?: () => void;
  any?: (key: NormalizedKey) => void;
  /**
   * Single-key commands, tried *before* printable routing.
   *
   * Without this, a command like `/` or `?` is classified as ordinary typed
   * text and handed to `print`, so an application-level shortcut silently
   * becomes a character in the user's input. Command keys are ambient UI
   * affordances; they have to be recognised ahead of anything the user is
   * typing.
   */
  command?: (key: NormalizedKey) => boolean;
};

export interface PromptKeysOptions {
  /**
   * Whether this component should handle keys right now.
   *
   * Focus ownership must be explicit: a prompt only claims the keyboard while
   * it is the active prompt. Nested controls therefore do not fight — the
   * inactive one simply never sees the event.
   */
  active: boolean;
  /** Called after a handler runs, if the handler called `preventDefault`. */
  onHandled?: (key: NormalizedKey) => void;
}

/**
 * Subscribe to the keyboard for the duration of an active prompt.
 *
 * Wraps OpenTUI's `useKeyboard` in two deliberate restrictions:
 *
 * 1. It unsubscribes entirely when `active` is false, so an inactive prompt
 *    cannot consume a keystroke intended for the active one.
 * 2. It routes Ctrl+C to an explicit `cancel` channel rather than letting it
 *    fall through, so every prompt can decide what cancellation means instead
 *    of one control silently swallowing it.
 */
export function usePromptKeys(handlers: KeyHandlerMap, options: PromptKeysOptions): void {
  const { active, onHandled } = options;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const onHandledRef = useRef(onHandled);
  onHandledRef.current = onHandled;

  useKeyboard(
    (event) => {
      if (!active) return;
      const map = handlersRef.current;
      if (!map) return;
      const key = normalizeKey(event);

      if (isCancelChord(key)) {
        if (map.cancel) {
          map.cancel();
          event.preventDefault();
          onHandledRef.current?.(key);
        }
        return;
      }

      const named = map[key.name as KeyName];
      if (typeof named === "function") {
        named();
        event.preventDefault();
        onHandledRef.current?.(key);
        return;
      }

      // Command keys are checked before text entry so a shortcut is never
      // swallowed as a character.
      if (map.command?.(key)) {
        event.preventDefault();
        onHandledRef.current?.(key);
        return;
      }

      if (map.print && isPrintable(key)) {
        map.print(key);
        event.preventDefault();
        onHandledRef.current?.(key);
        return;
      }

      map.any?.(key);
    },
    { release: false },
  );
}

/** Convenience: run `fn` on every key press while `active`. */
export function useKeyEffect(active: boolean, fn: (key: NormalizedKey) => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const handle = useCallback(
    (key: NormalizedKey) => {
      if (active) fnRef.current(key);
    },
    [active],
  );
  usePromptKeys({ any: handle }, { active: true });
}
