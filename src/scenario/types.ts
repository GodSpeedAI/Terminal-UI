import type { ReactNode } from "react";
import type { ThemeName } from "../theme/context.js";

/**
 * A named, reproducible state of a component.
 *
 * The point of this abstraction is that there is exactly **one** description of
 * "what Select looks like when it is empty", shared by the Workbench, the
 * visual regression suite, and the documentation. Three parallel
 * representations of the same state drift, and the drift is invisible until a
 * screenshot no longer matches the component.
 *
 * A scenario is deliberately not a Storybook story. It carries no runner, no
 * serializer, and no framework coupling — just a name, a render function, and
 * enough metadata for a consumer to decide what to do with it.
 */
export interface Scenario {
  /** Stable identifier, used in tests and in the Workbench's selection state. */
  readonly name: string;
  /** One-line description shown in the Workbench sidebar. */
  readonly description?: string;
  /**
   * Terminal width the scenario is designed for.
   *
   * The Workbench pre-selects this when the scenario is chosen; the visual
   * suite renders at exactly this width. It is recorded rather than read from
   * the ambient terminal so that a fixture never depends on the machine.
   */
  readonly width?: number;
  /** Terminal height, where a scenario needs a tall viewport. */
  readonly height?: number;
  /** Theme overrides, so a scenario can demonstrate an alternate theme. */
  readonly theme?: ThemeName;
  /** The scenario's rendered output. */
  readonly render: () => ReactNode;
  /**
   * Keys the visual suite presses before capturing.
   *
   * Lets a scenario reach a state that is awkward to construct as an initial
   * prop — for example "navigate down twice, then submit" for the submitted
   * Select fixture. Keeping it here rather than in the test file means the
   * Workbench can replay the same steps.
   */
  readonly steps?: readonly ScenarioStep[];
  /** Tags, used by the Workbench's filter. */
  readonly tags?: readonly string[];
}

/** One key press in a scenario's replay script. */
export type ScenarioStep =
  | { readonly key: string; readonly modifiers?: { readonly ctrl?: boolean; readonly shift?: boolean } }
  | { readonly type: string };

/** A group of related scenarios, as listed in the Workbench sidebar. */
export interface ScenarioGroup {
  readonly name: string;
  /** Lower sorts earlier. */
  readonly order?: number;
  readonly scenarios: readonly Scenario[];
}

/** A component's full Workbench entry. */
export interface CatalogEntry {
  /** The component's exported name, shown in the sidebar. */
  readonly name: string;
  /** Category heading in the sidebar. */
  readonly category: string;
  /** One-line summary, shown under the name. */
  readonly summary: string;
  /** A minimal usage example, shown in the detail pane. */
  readonly usage?: string;
  /** Keyboard bindings this component responds to, for the help pane. */
  readonly keys?: ReadonlyArray<{ readonly keys: string; readonly action: string }>;
  readonly groups: readonly ScenarioGroup[];
}

/** Flatten a catalog entry into its scenarios, preserving group order. */
export function entryScenarios(entry: CatalogEntry): Scenario[] {
  return entry.groups
    .slice()
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .flatMap((g) => [...g.scenarios]);
}

/** Find a scenario by name within an entry. */
export function findScenario(entry: CatalogEntry, name: string): Scenario | undefined {
  return entryScenarios(entry).find((s) => s.name === name);
}

/**
 * Scenario names are the join key between the visual suite and the Workbench,
 * so this predicate is what keeps a fixture name and a sidebar entry honest.
 */
export function isScenarioName(value: string): value is string {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
