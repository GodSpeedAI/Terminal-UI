import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FrameProvider } from "../../src/components/feedback/feedback.js";
import { SimulatedWidthProvider } from "../../src/hooks/use-available-width.js";
import { usePromptKeys } from "../../src/hooks/use-prompt-keys.js";
import { type CatalogEntry, catalog } from "../../src/scenario/catalog.js";
import type { Scenario } from "../../src/scenario/types.js";
import { entryScenarios } from "../../src/scenario/types.js";
import { type ThemeName, ThemeProvider } from "../../src/theme/index.js";
import { stringWidth } from "../../src/utils/text.js";
import { chrome, clip, pad, SINGLE_COLUMN_BELOW, sidebarWidth } from "../chrome.js";
import { faint, strong, txt } from "../format.js";

/**
 * The component explorer.
 *
 * Runs in the same OpenTUI renderer and under the same key handling as a real
 * application, so what the Workbench shows is what a consumer gets. It renders
 * the *production* components straight from their scenarios — there is no
 * preview reimplementation that could drift from the real thing.
 *
 * Two panes when there is room, one when there is not. The single-column mode
 * is a real navigation stack rather than a squeezed two-pane layout: at 40
 * columns two panes are unusable, and pretending otherwise helps nobody.
 *
 * Keyboard ownership is a single explicit target — the component list, the
 * scenario list, or the live component — cycled with Tab. The live component
 * receives *every* other key untouched (nested `usePromptKeys` subscribers all
 * see the event; the Workbench simply declines to act on it), which is what
 * lets a live Select and a live TextInput behave exactly as they would in a
 * consumer's app. Tab is the one key that never reaches the component, because
 * it is how you leave.
 */

/** What currently owns the keyboard. The whole focus model is this one value. */
type Focus = "components" | "scenarios" | "live";

/** Tab's cycle. There is no escape hatch from it, only another press. */
const NEXT_FOCUS: Record<Focus, Focus> = {
  components: "scenarios",
  scenarios: "live",
  live: "components",
};

/** Widths the live pane can be simulated at. */
const WIDTHS = [40, 60, 80, 100, 120, 160] as const;

const THEME_ORDER: ThemeName[] = ["clack", "ascii", "high-contrast"];

export interface WorkbenchProps {
  /**
   * Called when the user quits. Hosts can route this to their own teardown;
   * the default ends the process, because the renderer owns process lifetime
   * and the Workbench never holds a handle an embedder would need back.
   */
  onQuit?: () => void;
}

export function Workbench({ onQuit }: WorkbenchProps) {
  // Dimensions come from the renderer rather than `process.stdout`, so the
  // responsive layout is driven by whatever is hosting it. In production that
  // is the terminal; in the visual suite it is the test renderer, which is the
  // only way a responsive regression can be caught by a fixture.
  const { width, height } = useTerminalDimensions();
  const [themeName, setThemeName] = useState<ThemeName>("clack");
  const [focus, setFocus] = useState<Focus>("components");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [scenarioCursor, setScenarioCursor] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  /**
   * The live pane renders at a *simulated* width, independent of the real
   * terminal. Without this, resizing the terminal changes the component under
   * inspection and you can never compare two states at the same width.
   */
  const [simWidth, setSimWidth] = useState(60);

  const narrow = width < SINGLE_COLUMN_BELOW;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return catalog;
    return catalog.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q) ||
        entryScenarios(entry).some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [query]);

  const entry: CatalogEntry | undefined = filtered[cursor];
  const scenarios = useMemo(() => (entry ? entryScenarios(entry) : []), [entry]);
  const scenario: Scenario | undefined = scenarios[scenarioCursor];

  // Keep the cursors inside their lists whenever the visible set changes.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);
  useEffect(() => {
    setScenarioCursor((c) => Math.min(c, Math.max(0, scenarios.length - 1)));
  }, [scenarios.length]);
  // A scenario declares the width and theme it is designed for; selecting one
  // adopts them, which is what makes "narrow terminal" and "ASCII" scenarios
  // actually show what their name claims.
  useEffect(() => {
    if (scenario) setSimWidth(scenario.width ?? 60);
  }, [scenario]);
  useEffect(() => {
    setThemeName(scenario?.theme ?? "clack");
  }, [scenario]);

  const flash = useCallbackFlash(setBanner);

  const reset = useCallbackReset(scenario, setSimWidth, setThemeName, flash);

  // The default ends the process: `workbench/index.tsx` mounts the Workbench
  // bare, and the renderer owns process lifetime. Embedders can route it.
  const quit = onQuit ?? (() => process.exit(0));

  usePromptKeys(
    {
      // Navigation keys route to whatever focus names. When the live component
      // has focus they do nothing here on purpose: the component underneath
      // subscribes through its own `usePromptKeys`, and a Workbench-level no-op
      // leaves the event free for it — that is how nested controls coexist.
      up: () => {
        if (focus === "live") return;
        if (focus === "scenarios") setScenarioCursor((c) => Math.max(0, c - 1));
        else setCursor((c) => Math.max(0, c - 1));
      },
      down: () => {
        if (focus === "live") return;
        if (focus === "scenarios")
          setScenarioCursor((c) => Math.min(Math.max(0, scenarios.length - 1), c + 1));
        else setCursor((c) => Math.min(Math.max(0, filtered.length - 1), c + 1));
      },
      // Horizontal pane moves only exist where panes sit side by side, and
      // never while the live component owns the keyboard: a caret move inside a
      // live TextInput is not a pane switch.
      left: () => {
        if (focus === "live" || narrow) return;
        setFocus((f) => (f === "scenarios" ? "components" : f));
      },
      right: () => {
        if (focus === "live" || narrow) return;
        setFocus((f) => (f === "components" ? "scenarios" : f));
      },
      // The one key that always works, in any focus: it is the way out of the
      // live component, so it must never be typed into one.
      tab: () => {
        setFocus((f) => NEXT_FOCUS[f]);
      },
      // "Open" the highlighted component. Everything else Enter could mean is
      // the focused thing's own business (a scenario is chosen with ↓; a live
      // prompt submits with Enter itself).
      return: () => {
        if (focus === "components") setFocus("scenarios");
      },
      // Application-level commands, resolved ahead of anything typed into a
      // live component. Return `true` to claim the key.
      command: (key) => {
        // While the live component has focus the command channel passes
        // *everything* through: a `q` typed into a live text field is a
        // character, not a quit. Tab above is the only way to leave.
        if (focus === "live") return false;

        if (searching) {
          if (key.name === "backspace") {
            setQuery((q) => q.slice(0, -1));
            return true;
          }
          if (key.name === "return") {
            setSearching(false);
            return true;
          }
          if (key.name === "escape") {
            setSearching(false);
            setQuery("");
            return true;
          }
          if (key.text) {
            setQuery((q) => q + key.text);
            return true;
          }
          return false;
        }

        switch (key.text) {
          case "/":
            setSearching(true);
            return true;
          case "?":
            setShowHelp((v) => !v);
            return true;
          case "r":
            reset();
            return true;
          case "t":
            setThemeName((t) => {
              const next = THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length] as ThemeName;
              flash(`theme: ${next}`);
              return next;
            });
            return true;
          case "a":
            setThemeName((t) => {
              const next = t === "ascii" ? "clack" : "ascii";
              flash(`theme: ${next}`);
              return next;
            });
            return true;
          case "w":
            setSimWidth((w) => {
              const index = WIDTHS.indexOf(w as (typeof WIDTHS)[number]);
              const next = WIDTHS[(index + 1) % WIDTHS.length] ?? 80;
              flash(`width: ${next}`);
              return next;
            });
            return true;
          case "q":
            quit();
            return true;
          default:
            return false;
        }
      },
    },
    { active: true },
  );

  const paneWidth = narrow ? width : width - sidebarWidth(width) - 1;
  const liveWidth = Math.max(20, Math.min(simWidth, Math.max(20, paneWidth - 2)));

  return (
    <ThemeProvider theme={themeName}>
      <box flexDirection="column" width="100%" height="100%" backgroundColor="#0b0f16">
        <Header
          width={width}
          entry={entry}
          themeName={themeName}
          simWidth={liveWidth}
          terminalWidth={width}
        />

        {narrow ? (
          <box flexDirection="column" flexGrow={1} width="100%">
            {focus === "components" ? (
              <ComponentList
                entries={filtered}
                cursor={cursor}
                focused
                onSelect={(i) => {
                  setCursor(i);
                  setFocus("scenarios");
                }}
                width={width}
                query={query}
              />
            ) : (
              <ScenarioList
                entry={entry}
                scenarios={scenarios}
                cursor={scenarioCursor}
                onSelect={setScenarioCursor}
                width={width}
                focused={focus === "scenarios"}
              />
            )}
            <Live
              scenario={scenario}
              width={width}
              simulatedWidth={liveWidth}
              height={Math.max(6, height - 16)}
              focused={focus === "live"}
            />
          </box>
        ) : (
          <box flexDirection="row" flexGrow={1} width="100%">
            <Sidebar
              entries={filtered}
              cursor={cursor}
              focused={focus === "components"}
              width={sidebarWidth(width)}
              query={query}
              onSelect={setCursor}
            />
            <box flexDirection="column" width={1} height="100%" backgroundColor={chrome.border} />
            <box flexDirection="column" flexGrow={1} minWidth={0} height="100%">
              <ScenarioList
                entry={entry}
                scenarios={scenarios}
                cursor={scenarioCursor}
                onSelect={setScenarioCursor}
                width={paneWidth}
                focused={focus === "scenarios"}
              />
              <Live
                scenario={scenario}
                width={paneWidth}
                simulatedWidth={liveWidth}
                grow
                focused={focus === "live"}
              />
              {entry?.usage ? <UsageStrip usage={entry.usage} width={paneWidth} /> : null}
            </box>
          </box>
        )}

        <Footer
          width={width}
          narrow={narrow}
          themeName={themeName}
          simWidth={liveWidth}
          searching={searching}
          query={query}
          banner={banner}
        />

        {showHelp ? (
          <HelpOverlay width={width} height={height} entry={entry} onClose={() => setShowHelp(false)} />
        ) : null}
      </box>
    </ThemeProvider>
  );
}

function useCallbackFlash(setBanner: (v: string | null) => void) {
  // The clear timer lives in a ref so a rapid re-flash reschedules instead of
  // stacking timers, and the unmount cleanup cancels it — a banner clear
  // firing after the tree is gone is a stray setState (and, under the test
  // renderer, an act() violation) that buys the user nothing.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return (message: string) => {
    setBanner(message);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setBanner(null);
    }, 1500);
  };
}

function useCallbackReset(
  scenario: Scenario | undefined,
  setSimWidth: (w: number) => void,
  setThemeName: (t: ThemeName) => void,
  flash: (m: string) => void,
) {
  return () => {
    if (!scenario) return;
    setSimWidth(scenario.width ?? 60);
    setThemeName(scenario.theme ?? "clack");
    flash(`reset: ${scenario.name}`);
  };
}

/* ------------------------------------------------------------------ */
/* Chrome                                                               */
/* ------------------------------------------------------------------ */

function Header({
  width,
  entry,
  themeName,
  simWidth,
  terminalWidth,
}: {
  width: number;
  entry?: CatalogEntry;
  themeName: ThemeName;
  simWidth: number;
  terminalWidth: number;
}) {
  const trail = entry ? `${entry.category} / ${entry.name}` : "";
  // The right-hand status is dropped in stages as the header runs out of room.
  // Overlapping text is worse than missing information, and a header is the
  // one place a user looks first, so it degrades predictably.
  const full = `${themeName} · ${simWidth}w sim · ${terminalWidth}w term`;
  const short = `${themeName} · ${simWidth}w`;
  const right = width >= 76 ? full : width >= 44 ? short : themeName;
  const brand = width >= 48 ? "▌ terminal-ui  workbench" : width >= 28 ? "▌ terminal-ui" : "▌ tui";

  // The middle column gets an explicit budget rather than relying on flex
  // shrink to cooperate with `truncate`. A one-row header is exactly where a
  // shrink that does not fire is most visible.
  const budget = Math.max(0, width - 2 - stringWidth(brand) - stringWidth(right) - 2);

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      backgroundColor="#111827"
      paddingLeft={1}
      paddingRight={1}
    >
      <text
        content={txt(strong(brand.slice(0, 2), chrome.accent), strong(brand.slice(2), chrome.accent))}
        wrapMode="none"
      />
      {trail && budget > 4 ? (
        <box flexDirection="row" width={budget} minWidth={0} paddingLeft={2}>
          <text
            content={txt({ text: clip(trail, Math.max(0, budget - 2)), color: chrome.muted })}
            wrapMode="none"
            truncate
          />
        </box>
      ) : (
        <box flexGrow={1} />
      )}
      <text content={txt(faint(right))} wrapMode="none" />
    </box>
  );
}

function Footer({
  width,
  narrow,
  themeName,
  simWidth,
  searching,
  query,
  banner,
}: {
  width: number;
  narrow: boolean;
  themeName: ThemeName;
  simWidth: number;
  searching: boolean;
  query: string;
  banner: string | null;
}) {
  if (searching) {
    return (
      <box flexDirection="row" width="100%" height={1} backgroundColor={chrome.selectedBg} paddingLeft={1}>
        <text
          content={txt(strong("/", chrome.accent), { text: `${query}▏`, color: chrome.accent })}
          wrapMode="none"
        />
        <text content={txt(faint("  enter apply · esc clear"))} wrapMode="none" />
      </box>
    );
  }
  if (banner) {
    return (
      <box flexDirection="row" width="100%" height={1} backgroundColor={chrome.selectedBg} paddingLeft={1}>
        <text
          content={txt({ text: "▸ ", color: chrome.accent }, { text: banner, color: chrome.accent })}
          wrapMode="none"
        />
      </box>
    );
  }
  const keys = narrow
    ? "↑↓ move  tab cycle focus  r reset  t theme  w width  / search  ? help  q quit"
    : "↑↓ move  tab cycle focus  r reset  t theme  a ascii  w width  / search  ? help  q quit";
  const right = `${themeName} · ${simWidth}w`;
  const keysWidth = Math.max(0, width - stringWidth(right) - 3);
  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      backgroundColor="#111827"
      paddingLeft={1}
      paddingRight={1}
    >
      <text content={txt(faint(clip(keys, keysWidth)))} wrapMode="none" truncate />
      <box flexGrow={1} />
      <text content={txt(faint(clip(right, 24)))} wrapMode="none" />
    </box>
  );
}

function Sidebar({
  entries,
  cursor,
  focused,
  width,
  query,
  onSelect,
}: {
  entries: readonly CatalogEntry[];
  cursor: number;
  focused: boolean;
  width: number;
  query: string;
  onSelect: (i: number) => void;
}) {
  const rows: React.ReactNode[] = [];
  let lastCategory = "";
  entries.forEach((entry, i) => {
    if (entry.category !== lastCategory) {
      lastCategory = entry.category;
      rows.push(
        <box key={`cat-${entry.category}`} flexDirection="row" width="100%" height={1} paddingLeft={1}>
          <text
            content={txt(faint(clip(entry.category.toUpperCase(), width - 1)))}
            wrapMode="none"
            truncate
          />
        </box>,
      );
    }
    const selected = i === cursor && focused;
    rows.push(
      // biome-ignore lint/a11y/noStaticElementInteractions: the mouse is a shortcut onto the arrow-key path, not the only way to select
      <box
        key={entry.name}
        flexDirection="row"
        width="100%"
        height={1}
        backgroundColor={selected ? chrome.selectedBg : undefined}
        onMouseDown={() => onSelect(i)}
      >
        <text content={txt(selected ? strong("▸ ", chrome.accent) : { text: "  " })} wrapMode="none" />
        <text
          content={txt(
            selected
              ? strong(clip(entry.name, width - 4), chrome.accent)
              : { text: clip(entry.name, width - 4) },
          )}
          wrapMode="none"
          truncate
        />
      </box>,
    );
  });

  return (
    <box flexDirection="column" width={width} height="100%" backgroundColor="#0f172a">
      <box flexDirection="row" width="100%" height={1} paddingLeft={1}>
        <text
          content={txt(
            query
              ? { text: clip(`/ ${query}`, width - 2), color: chrome.accent }
              : faint(clip(`components ${entries.length}`, width - 2)),
          )}
          wrapMode="none"
          truncate
        />
      </box>
      <box flexDirection="column" flexGrow={1} width="100%">
        {rows}
      </box>
    </box>
  );
}

function ComponentList({
  entries,
  cursor,
  focused,
  onSelect,
  width,
  query,
}: {
  entries: readonly CatalogEntry[];
  cursor: number;
  focused: boolean;
  onSelect: (i: number) => void;
  width: number;
  query: string;
}) {
  return (
    <box
      flexDirection="column"
      width="100%"
      height={Math.max(5, Math.min(entries.length + 2, 12))}
      backgroundColor="#0f172a"
    >
      <box flexDirection="row" width="100%" height={1} paddingLeft={1}>
        <text
          content={txt(
            query
              ? { text: clip(`/ ${query}`, width - 2), color: chrome.accent }
              : faint(clip(`components ${entries.length}`, width - 2)),
          )}
          wrapMode="none"
          truncate
        />
      </box>
      {entries.map((entry, i) => {
        const selected = i === cursor && focused;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: the mouse is a shortcut onto the arrow-key path, not the only way to select
          <box
            key={entry.name}
            flexDirection="row"
            width="100%"
            height={1}
            backgroundColor={selected ? chrome.selectedBg : undefined}
            onMouseDown={() => onSelect(i)}
          >
            <text content={txt(selected ? strong("▸ ", chrome.accent) : { text: "  " })} wrapMode="none" />
            <text
              content={txt(
                selected
                  ? strong(clip(entry.name, width - 4), chrome.accent)
                  : { text: clip(entry.name, width - 4) },
              )}
              wrapMode="none"
              truncate
            />
          </box>
        );
      })}
    </box>
  );
}

function listHeight(count: number): number {
  return Math.max(4, Math.min(count + 3, 16));
}

function ScenarioList({
  entry,
  scenarios,
  cursor,
  onSelect,
  width,
  focused,
}: {
  entry?: CatalogEntry;
  scenarios: readonly Scenario[];
  cursor: number;
  onSelect: (i: number) => void;
  width: number;
  focused: boolean;
}) {
  if (!entry) {
    return (
      <box flexDirection="row" width="100%" height={5} paddingLeft={1}>
        <text content={txt(faint("no components match the filter"))} wrapMode="none" />
      </box>
    );
  }
  const nameWidth = Math.min(28, Math.max(12, width - 34));
  return (
    <box flexDirection="column" width="100%" height={listHeight(scenarios.length)}>
      <box flexDirection="row" width="100%" height={1} paddingLeft={1} paddingRight={1}>
        <text
          content={txt(strong(entry.name, chrome.accent), faint(`  ${entry.category}`))}
          wrapMode="none"
          truncate
        />
      </box>
      <box flexDirection="row" width="100%" height={1} paddingLeft={1} paddingRight={1}>
        <text content={txt(faint(entry.summary))} wrapMode="none" truncate />
      </box>
      {scenarios.map((s, i) => {
        const selected = i === cursor && focused;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: the mouse is a shortcut onto the arrow-key path, not the only way to select
          <box
            key={s.name}
            flexDirection="row"
            width="100%"
            height={1}
            backgroundColor={selected ? chrome.selectedBg : undefined}
            onMouseDown={() => onSelect(i)}
          >
            <text content={txt(selected ? strong("▸ ", chrome.accent) : { text: "  " })} wrapMode="none" />
            <text
              content={txt(
                selected
                  ? strong(pad(clip(s.name, nameWidth), nameWidth), chrome.accent)
                  : { text: pad(clip(s.name, nameWidth), nameWidth) },
                s.description
                  ? faint(`  ${clip(s.description, Math.max(0, width - nameWidth - 5))}`)
                  : { text: "" },
              )}
              wrapMode="none"
              truncate
            />
          </box>
        );
      })}
    </box>
  );
}

/** The one-line usage example that replaced the old detail box. */
function UsageStrip({ usage, width }: { usage: string; width: number }) {
  return (
    <box flexDirection="row" width="100%" height={1} paddingLeft={1}>
      <text content={txt(faint(clip(usage, Math.max(0, width - 2))))} wrapMode="none" truncate />
    </box>
  );
}

/**
 * The live pane.
 *
 * The only place a scenario's component is mounted. The simulated width wraps
 * the render so the Workbench's width knob reaches `useAvailableWidth` inside
 * the component — the renderer's real width stays untouched for everything
 * else. The frame clock is provided here so animated scenarios (a Spinner)
 * actually animate in the explorer.
 */
function Live({
  scenario,
  width,
  simulatedWidth,
  height,
  grow = false,
  focused,
}: {
  scenario?: Scenario;
  width: number;
  simulatedWidth: number;
  height?: number;
  grow?: boolean;
  focused: boolean;
}) {
  return (
    <box
      flexDirection="column"
      width="100%"
      height={height}
      flexGrow={grow ? 1 : undefined}
      border
      borderStyle="single"
      borderColor={focused ? chrome.accent : chrome.border}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" width="100%" height={1}>
        <text
          content={txt(
            focused
              ? strong(clip(scenario?.name ?? "no scenario", width - 4), chrome.accent)
              : { text: clip(scenario?.name ?? "no scenario", width - 4), color: chrome.faint },
          )}
          wrapMode="none"
          truncate
        />
      </box>
      <box flexDirection="column" flexGrow={1} width="100%">
        {scenario ? (
          <FrameProvider>
            {/* Keyed by scenario so a switch remounts instead of reusing the
            previous scenario's component instance: the pane must show the
            selected scenario's declared state, not cursor positions carried
            over from whatever was arrowed through before it. */}
            <SimulatedWidthProvider key={scenario.name} width={simulatedWidth}>
              {scenario.render()}
            </SimulatedWidthProvider>
          </FrameProvider>
        ) : null}
      </box>
    </box>
  );
}

function HelpOverlay({
  width,
  height,
  entry,
  onClose,
}: {
  width: number;
  height: number;
  entry?: CatalogEntry;
  onClose: () => void;
}) {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["↑ ↓", "move in the focused list"],
    ["Tab", "cycle focus: lists → live"],
    ["← →", "move focus (wide, lists only)"],
    ["Enter", "open the selected component"],
    ["/", "search components"],
    ["r", "reset the scenario"],
    ["t", "cycle theme"],
    ["a", "toggle ASCII"],
    ["w", "cycle simulated width"],
    ["?", "toggle this help"],
    ["q", "quit"],
  ];
  // The focused component's own keys get a second section, so the help overlay
  // is also where a component documents itself.
  const componentKeys = entry?.keys ?? [];
  const rowCount = rows.length + (componentKeys.length > 0 ? componentKeys.length + 2 : 0);
  const boxWidth = Math.min(44, Math.max(22, width - 4));
  return (
    <box
      flexDirection="column"
      position="absolute"
      left={Math.max(0, Math.floor(width / 2) - Math.floor(boxWidth / 2))}
      top={Math.max(0, Math.floor(height / 2) - Math.floor(rowCount / 2) - 1)}
      width={boxWidth}
      backgroundColor="#0f172a"
      border
      borderStyle="single"
      borderColor={chrome.accent}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" width="100%" height={1}>
        <text content={txt(strong("keys", chrome.accent))} wrapMode="none" />
      </box>
      {rows.map(([k, d]) => (
        <box key={k} flexDirection="row" width="100%" height={1}>
          <text
            content={txt({ text: ` ${pad(k, 8)}`, color: chrome.muted }, faint(d))}
            wrapMode="none"
            truncate
          />
        </box>
      ))}
      {componentKeys.length > 0 ? (
        <>
          <box flexDirection="row" width="100%" height={1}>
            <text content={txt(strong(entry?.name ?? "", chrome.accent))} wrapMode="none" />
          </box>
          {componentKeys.map((k) => (
            <box key={k.keys} flexDirection="row" width="100%" height={1}>
              <text
                content={txt({ text: ` ${pad(k.keys, 8)}`, color: chrome.muted }, faint(k.action))}
                wrapMode="none"
                truncate
              />
            </box>
          ))}
        </>
      ) : null}
      <box flexDirection="row" width="100%" height={1}>
        <text
          content={txt(faint(clip(" press Tab until a list is focused to use commands", boxWidth - 2)))}
          wrapMode="none"
          truncate
        />
      </box>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: `?` is the documented key path; this is its click equivalent */}
      <box flexDirection="row" width="100%" height={1} onMouseDown={onClose}>
        <text content={txt(faint(" press ? to close"))} wrapMode="none" />
      </box>
    </box>
  );
}
