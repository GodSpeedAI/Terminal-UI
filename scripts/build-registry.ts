/**
 * Build `registry.json` from the source tree.
 *
 * The registry is *derived*, never hand-written. Two reasons, both of which
 * have bitten copy-and-paste registries before:
 *
 *  1. **Dependency drift.** A hand-maintained `registryDependencies` list is a
 *     claim about the import graph, and claims rot. Here it is computed from
 *     the actual `import` statements, so a component can never be published
 *     without something it imports.
 *
 *  2. **Two implementations.** The spec requires one implementation, not a
 *     package build plus a registry build. `files[].path` points at the same
 *     files the package and the Workbench import; there is no copy step and
 *     nothing to fall out of sync.
 *
 * Layout note — see `docs/registry.md` for the full reasoning: every file lands
 * under a single root preserving its repo-relative path, so the relative
 * imports inside the source keep resolving after installation. shadcn does not
 * rewrite relative imports, so a split across `@ui/` and `@lib/` would break
 * them.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_ROOT = "terminal-ui";
/** The public repository, as `owner/repo` — the slug `shadcn add` resolves. */
const GITHUB_SLUG = "GodSpeedAI/Terminal-UI";

/** The version ranges the library publishes as peer dependencies. */
const PEER_DEPENDENCIES = (
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    peerDependencies?: Record<string, string>;
  }
).peerDependencies as Record<string, string>;

type FileType = "registry:ui" | "registry:lib" | "registry:hook" | "registry:component";

interface ItemSpec {
  name: string;
  type: FileType;
  description: string;
  /** Repo-relative source files this item owns. */
  files: string[];
  /** Items that must already be installed. Computed; not authored. */
  registryDependencies?: string[];
  devDependencies?: string[];
  docs?: string;
}

interface BuiltItem {
  name: string;
  type: FileType;
  description: string;
  files: Array<{ path: string; type: FileType; target: string }>;
  registryDependencies: string[];
  /**
   * The bare npm specifiers the item's files import, each carrying the peer
   * version range declared at the registry root as an npm spec
   * (`"@opentui/core@>=0.5.0"`). Computed like `registryDependencies`, and
   * omitted entirely when the item imports nothing from outside the
   * installed tree.
   *
   * An array of specs rather than a `specifier -> range` map because that is
   * the only shape the shadcn item schema defines for this field — the CLI
   * rejects a map with `dependencies: Expected array, received object` — and
   * a spec string is exactly what `shadcn add` hands to the package manager.
   */
  dependencies?: string[];
}

/**
 * Every file that any item may own, mapped to the item that owns it.
 *
 * A file belongs to exactly one item. That is what makes the dependency graph
 * a tree rather than a mesh, and it is why a component's
 * `registryDependencies` is exactly "the items that own the files it imports".
 */
const OWNERSHIP: Record<string, string> = {};

/** Register a set of repo-relative files as belonging to `item`. */
function own(item: string, files: string[]): void {
  for (const file of files) {
    if (OWNERSHIP[file]) {
      throw new Error(
        `"${file}" is claimed by both "${OWNERSHIP[file]}" and "${item}". ` +
          `Every file must belong to exactly one registry item.`,
      );
    }
    OWNERSHIP[file] = item;
  }
}

const THEME_FILES = [
  "src/theme/types.ts",
  "src/theme/state.ts",
  "src/theme/base.ts",
  "src/theme/clack.ts",
  "src/theme/ascii.ts",
  "src/theme/high-contrast.ts",
  "src/theme/context.ts",
  "src/theme/index.ts",
];

const UTILS_FILES = ["src/utils/style.ts", "src/utils/text.ts"];

const PRIMITIVE_FILES = ["src/primitives/rail.tsx", "src/primitives/label.tsx", "src/primitives/index.ts"];

const HOOK_FILES = [
  "src/hooks/use-prompt-keys.ts",
  "src/hooks/use-prompt-state.ts",
  "src/hooks/hints.ts",
  "src/hooks/use-available-width.ts",
];

const COMPONENT_FILES: Record<string, string[]> = {
  prompt: ["src/components/prompt/prompt.tsx"],
  select: ["src/components/select/select.tsx"],
  autocomplete: ["src/components/autocomplete/autocomplete.tsx"],
  multiselect: ["src/components/multiselect/multiselect.tsx"],
  "text-input": ["src/components/input/text-input.tsx"],
  confirm: ["src/components/confirm/confirm.tsx"],
  note: ["src/components/composition/note.tsx"],
  composition: ["src/components/composition/composition.tsx"],
  feedback: ["src/components/feedback/feedback.tsx"],
  task: ["src/components/task/task.tsx"],
};

const DESCRIPTIONS: Record<string, string> = {
  theme: "Semantic state vocabulary and theme definitions (clack, ascii, high-contrast).",
  utils: "Terminal cell-width arithmetic and the bridge from theme styles to OpenTUI styled text.",
  primitives: "Rail, marker, status, label, hint, and separator — the visual grammar.",
  hooks: "Prompt lifecycle, keyboard ownership, hint construction, and width resolution.",
  prompt: "The prompt shell: rail, question, error presentation, hint row, and active-to-submitted collapse.",
  select: "A single-choice list with keyboard navigation and type-ahead.",
  autocomplete:
    "A filtering combobox: typing narrows the list to substring matches, and Enter accepts the highlighted option or the raw typed text.",
  multiselect: "A multiple-choice list with an independent selection.",
  "text-input": "A single-line text field with an explicit cursor, plus a masked variant.",
  confirm: "A two-way choice with both answers visible.",
  note: "A framed aside for free-form text.",
  composition: "Log lines, block edges, and flow open/close.",
  feedback: "Spinner and progress bar, both driven by an injectable frame clock.",
  task: "Task rows, task lists, and prompt groups.",
};

const ITEMS: ItemSpec[] = [
  { name: "theme", type: "registry:ui", description: DESCRIPTIONS.theme as string, files: THEME_FILES },
  { name: "utils", type: "registry:lib", description: DESCRIPTIONS.utils as string, files: UTILS_FILES },
  {
    name: "primitives",
    type: "registry:ui",
    description: DESCRIPTIONS.primitives as string,
    files: PRIMITIVE_FILES,
  },
  { name: "hooks", type: "registry:hook", description: DESCRIPTIONS.hooks as string, files: HOOK_FILES },
  ...Object.entries(COMPONENT_FILES).map(([name, files]) => ({
    name,
    type: "registry:component" as FileType,
    description: DESCRIPTIONS[name] as string,
    files,
  })),
];

for (const item of ITEMS) own(item.name, item.files);

/** Resolve a relative import specifier to a repo-relative source file. */
function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(root, dirname(from), specifier);
  // The sources use `.js` specifiers, as ESM requires, but the files on disk
  // are `.ts`/`.tsx`. Drop the extension before trying the TypeScript
  // spellings, or every candidate is `something.js.ts` and nothing resolves —
  // which is exactly the failure mode that ships a registry whose declared
  // dependencies are all empty.
  const stem = base.replace(/\.(js|jsx|mjs|cjs)$/, "");
  for (const candidate of [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    join(stem, "index.ts"),
    join(stem, "index.tsx"),
  ]) {
    const rel = relative(root, candidate).split("\\").join("/");
    if (existsSync(join(root, rel))) return rel;
  }
  return null;
}

/** Repo-relative files an item imports from inside this repository. */
function localImports(files: string[]): Set<string> {
  const seen = new Set<string>();
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      const specifier = match[1] as string;
      const resolved = resolveImport(file, specifier);
      if (resolved && resolved !== file) seen.add(resolved);
    }
  }
  return seen;
}

/**
 * Bare (non-relative) specifiers an item's files import, e.g. `react`,
 * `@opentui/core`.
 */
function bareImports(files: string[]): Set<string> {
  const seen = new Set<string>();
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      const specifier = match[1] as string;
      if (!specifier.startsWith(".")) seen.add(specifier);
    }
  }
  return seen;
}

/**
 * Compute an item's `registryDependencies`.
 *
 * Dependencies are emitted as full GitHub addresses (`GodSpeedAI/Terminal-UI/theme`),
 * not bare names. Verified against shadcn 4.21.0: the CLI resolves a bare
 * dependency name against the upstream `ui.shadcn.com` style registry —
 * `styles/<style>/<name>.json` — rather than the GitHub registry the parent
 * item came from, so a bare `theme` 404s upstream and the install dies. A
 * full `owner/repo/item` address is routed back to this repository and
 * resolved from the root `registry.json`, which is the behavior the
 * `shadcn add <owner>/<repo>/<item>` UX depends on.
 *
 * The address has no `#ref`, so dependencies always resolve against the
 * repository's default branch — the distribution branch.
 */
function computeDependencies(item: ItemSpec): string[] {
  const deps = new Set<string>();
  for (const imported of localImports(item.files)) {
    const owner = OWNERSHIP[imported];
    if (owner && owner !== item.name) deps.add(`${GITHUB_SLUG}/${owner}`);
  }
  // Always installable: an item that renders needs a theme to render with.
  if (item.name !== "theme" && item.name !== "utils") deps.add(`${GITHUB_SLUG}/theme`);
  return [...deps].sort();
}

/**
 * Compute an item's `dependencies` metadata from its real import statements.
 *
 * Every bare specifier the item's files import is emitted as an npm spec
 * carrying the version range declared in the root `package.json`
 * `peerDependencies` — the same ranges a package install would enforce,
 * derived rather than authored so the manifest cannot drift from the import
 * graph. A specifier with no peer entry is a build failure, not a silent
 * omission: an undeclared import is exactly the "valid registry, broken
 * consumer" failure this builder exists to prevent.
 *
 * The field is an array of spec strings (`"@opentui/core@>=0.5.0"`) rather
 * than a map — the shadcn item schema defines `dependencies` as
 * `Array<string>`, and the real CLI rejects a map. Returns `undefined` when
 * the item imports nothing from npm, so the field is omitted rather than
 * emitted empty.
 */
function computeExternalDependencies(item: ItemSpec): string[] | undefined {
  const specifiers = bareImports(item.files);
  // Source parsing cannot see the jsx runtime: the compiler injects
  // `@opentui/react/jsx-runtime` into every `.tsx` file per the root
  // tsconfig's `jsxImportSource`, and no `import` statement ever names it. An
  // item with a `.tsx` file therefore depends on `@opentui/react` whether or
  // not a source line says so, and omitting it would advertise a registry
  // item that cannot compile in a consumer lacking the package.
  if (item.files.some((file) => file.endsWith(".tsx"))) {
    specifiers.add("@opentui/react");
  }
  const deps: string[] = [];
  for (const specifier of [...specifiers].sort()) {
    const range = PEER_DEPENDENCIES[specifier];
    if (!range) {
      throw new Error(
        `"${item.name}" imports "${specifier}", which has no entry in the root package.json ` +
          `peerDependencies. Declare it there so the registry can advertise a version range.`,
      );
    }
    deps.push(`${specifier}@${range}`);
  }
  return deps.length > 0 ? deps : undefined;
}

/** Classify a file for shadcn's own `files[].type` bookkeeping. */
function fileType(item: ItemSpec, file: string): FileType {
  if (item.type === "registry:lib") return "registry:lib";
  if (item.type === "registry:hook") return "registry:hook";
  if (file.startsWith("src/hooks/")) return "registry:hook";
  if (file.startsWith("src/utils/")) return "registry:lib";
  if (file.startsWith("src/theme/")) return "registry:ui";
  return "registry:component";
}

function targetFor(file: string): string {
  // Mirror the repo-relative path under one root, so relative imports between
  // installed files keep resolving. `@components/` is shadcn's placeholder for
  // the consumer's components directory, so this lands at
  // `<components>/terminal-ui/<path-without-src->`.
  return `@components/${REGISTRY_ROOT}/${file.replace(/^src\//, "")}`;
}

const built: BuiltItem[] = ITEMS.map((item) => {
  const dependencies = computeExternalDependencies(item);
  return {
    name: item.name,
    type: item.type,
    description: item.description,
    files: item.files.map((file) => ({
      path: file,
      type: fileType(item, file),
      target: targetFor(file),
    })),
    registryDependencies: computeDependencies(item),
    ...(dependencies ? { dependencies } : {}),
  };
});

const byName = new Map(built.map((item) => [item.name, item]));

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "terminal-ui",
  homepage: `https://github.com/${GITHUB_SLUG}`,
  // `items` is an array, not a keyed object. The keyed form is the legacy
  // shape; `shadcn registry validate` rejects it.
  items: built,
};

const out = join(root, "registry.json");
writeFileSync(out, `${JSON.stringify(registry, null, 2)}\n`);

const fileCount = built.reduce((n, item) => n + item.files.length, 0);
console.log(
  `registry.json: ${built.length} items, ${fileCount} files\n` +
    `  theme        ${byName.get("theme")?.files.length ?? 0} files\n` +
    `  utils        ${byName.get("utils")?.files.length ?? 0} files\n` +
    `  primitives   ${byName.get("primitives")?.files.length ?? 0} files\n` +
    `  hooks        ${byName.get("hooks")?.files.length ?? 0} files\n` +
    `  components   ${Object.keys(COMPONENT_FILES).length} items`,
);
