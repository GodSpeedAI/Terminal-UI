/**
 * `@terminal-ui/react` — a Clack-inspired component library for OpenTUI React.
 *
 * Three layers, and the dependency only ever points downward:
 *
 *   theme      the semantic state vocabulary and how it is painted
 *   primitives rail, marker, label, hint, status — the visual grammar
 *   components prompts and feedback, composed *from* the primitives
 *
 * Nothing in `primitives` knows about a prompt, and nothing in `theme` knows
 * about a component. That is what lets a new theme restyle the library without
 * a single component change, and what keeps copied registry source free of
 * hidden internal dependencies.
 */

export * from "./components/index.js";
export * from "./hooks/hints.js";
export * from "./hooks/use-prompt-keys.js";
export * from "./hooks/use-prompt-state.js";
export * from "./primitives/index.js";
export * from "./scenario/index.js";
export * from "./theme/index.js";
export * from "./utils/style.js";
export * from "./utils/text.js";
