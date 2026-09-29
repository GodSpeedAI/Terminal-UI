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

type FileType = "registry:ui" | "registry:lib" | "registry:hook" | "registry:component";

interface ItemSpec {
  name: string;
  type: FileType;
  description: string;
  /** Repo-relative source files this item owns. */
  files: string[];
  /** npm packages the item needs beyond the OpenTUI peer dependency. */
  dependencies?: string[];
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
 * Compute an item's `registryDependencies`.
 *
 * Only dependencies on *other items* are listed. Bare specifiers (`react`,
 * `@opentui/core`, `@opentui/react`) are peer dependencies of the whole
 * library and are declared once at the registry root, so they are not repeated
 * on every item.
 */
function computeDependencies(item: ItemSpec): string[] {
  const deps = new Set<string>();
  for (const imported of localImports(item.files)) {
    const owner = OWNERSHIP[imported];
    if (owner && owner !== item.name) deps.add(owner);
  }
  // Always installable: an item that renders needs a theme to render with.
  if (item.name !== "theme" && item.name !== "utils") deps.add("theme");
  return [...deps].sort();
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

const built: BuiltItem[] = ITEMS.map((item) => ({
  name: item.name,
  type: item.type,
  description: item.description,
  files: item.files.map((file) => ({
    path: file,
    type: fileType(item, file),
    target: targetFor(file),
  })),
  registryDependencies: computeDependencies(item),
}));

const byName = new Map(built.map((item) => [item.name, item]));

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "terminal-ui",
  homepage: "https://github.com/terminal-ui/terminal-ui",
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
