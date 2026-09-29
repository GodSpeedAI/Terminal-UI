import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";
import { asciiTheme } from "./ascii.js";
import { clackTheme } from "./clack.js";
import { highContrastTheme } from "./high-contrast.js";
import type { Theme } from "./types.js";

/** Every theme shipped with the library, keyed by name. */
export const themes = {
  clack: clackTheme,
  ascii: asciiTheme,
  "high-contrast": highContrastTheme,
} as const satisfies Record<string, Theme>;

/** The name of any built-in theme. */
export type ThemeName = keyof typeof themes;

/** The default theme. Clack-inspired, Unicode, restrained color. */
export const defaultTheme: Theme = clackTheme;

export interface ThemeContextValue {
  theme: Theme;
  /** Name of the active theme, for status lines and test assertions. */
  themeName: ThemeName;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  /**
   * A theme object, or the name of a built-in theme.
   *
   * Accepting both keeps the common case (`theme="ascii"`) a one-liner while
   * leaving the door open for a fully custom `Theme`.
   */
  theme?: ThemeName | Theme;
  children?: ReactNode;
}

/**
 * Provides the active theme to every primitive below it.
 *
 * The resolved value is memoised on the theme identity so that switching themes
 * re-renders the tree exactly once rather than once per consumer.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const value = useMemo<ThemeContextValue>(() => {
    const resolved = typeof theme === "string" ? themes[theme] : (theme ?? defaultTheme);
    const name = (typeof theme === "string" ? theme : theme?.name) ?? defaultTheme.name;
    return { theme: resolved, themeName: name as ThemeName };
  }, [theme]);

  return createElement(ThemeContext.Provider, { value }, children);
}

/**
 * Read the active theme.
 *
 * Falls back to the default theme when no provider is mounted, so a primitive
 * rendered on its own — in a test, or as a one-off log line — still works. The
 * fallback is what keeps every primitive independently mountable.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  return ctx ?? { theme: defaultTheme, themeName: defaultTheme.name as ThemeName };
}
