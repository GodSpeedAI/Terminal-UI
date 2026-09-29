import type { KeyHintPair } from "../primitives/label.js";
import type { Theme } from "../theme/types.js";

/**
 * Keyboard hint builders.
 *
 * These are pure functions of the theme rather than hooks. They hold no state
 * and compute nothing but a small array, so making them hooks would add a
 * hook-ordering constraint to every component that renders a hint for nothing —
 * and a hint is exactly the kind of thing that gets built inline in a
 * defaulting expression, which is where a conditional hook call hides.
 *
 * Centralising them means every control advertises the same keys in the same
 * order, and that the ASCII theme's `Up/Dn` substitutions reach every control
 * at once instead of depending on each one remembering to consult the theme.
 */

/** `↑/↓ navigate • Enter: confirm`, optionally with pairs inserted. */
export function navigateConfirmHints(
  theme: Theme,
  extra: readonly KeyHintPair[] = [],
): readonly KeyHintPair[] {
  return [
    { key: `${theme.keys.up}/${theme.keys.down}`, description: "navigate", format: "space" },
    ...extra,
    { key: theme.keys.enter, description: "confirm" },
  ];
}

/**
 * The hint for a control with no vertical axis.
 *
 * `navigateConfirmHints` advertises arrow keys, which a text field does not
 * bind. A hint that lists a key the control ignores is worse than no hint, so
 * text-entry controls use this instead.
 */
export function submitHint(theme: Theme): readonly KeyHintPair[] {
  return [{ key: theme.keys.enter, description: "submit" }];
}

/** The hint for cancelling. */
export function cancelHint(theme: Theme): KeyHintPair {
  return { key: theme.keys.escape, description: "cancel" };
}

/** The hint for toggling the highlighted entry. */
export function toggleHint(theme: Theme): KeyHintPair {
  return { key: theme.keys.space, description: "toggle" };
}

/** `←/→ select • Enter: confirm`, for controls laid out horizontally. */
export function confirmHint(theme: Theme): readonly KeyHintPair[] {
  return [
    { key: `${theme.keys.left}/${theme.keys.right}`, description: "select", format: "space" },
    { key: theme.keys.enter, description: "confirm" },
  ];
}
