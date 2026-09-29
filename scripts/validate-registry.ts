#!/usr/bin/env bun
/**
 * Validate `registry.json`.
 *
 * Two layers, in this order:
 *
 *   1. **The real thing.** `shadcn registry validate` from the actual shadcn
 *      CLI. Re-implementing a schema validator when the upstream tool exists
 *      would mean our notion of "valid" could drift from the CLI that has to
 *      consume the file. Skipped only when the CLI is unavailable (offline), in
 *      which case that is reported rather than silently ignored.
 *
 *   2. **The things the CLI cannot check.** The CLI validates the manifest's
 *      shape; it cannot know whether the files exist, whether the declared
 *      dependency graph matches the actual import graph, or whether copied
 *      source would be free of unpublished internal imports. Those are the
 *      failures that produce a registry which validates and does not work, so
 *      they are checked here.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(repoRoot, "registry.json");

const problems: string[] = [];
const notes: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`  ${ok ? "✔" : "✖"} ${message}`);
  if (!ok) problems.push(message);
};

interface RegistryFile {
  path: string;
  type: string;
  target: string;
}
interface RegistryItem {
  name: string;
  type: string;
  description: string;
  files: RegistryFile[];
  registryDependencies: string[];
}
interface Registry {
  $schema?: string;
  name: string;
  homepage?: string;
  items: RegistryItem[];
}

console.log("\nregistry validation\n");

// ---------------------------------------------------- 1. the real shadcn CLI
console.log("  shadcn registry validate");
let cliRan = false;
// The CLI prints its verdict on stderr, not stdout, so both streams are needed.
// Reading only stdout makes a passing run look like a failure, which is worse
// than not checking at all.
const cli = spawnSync("npx", ["--yes", "shadcn@latest", "registry", "validate"], {
  cwd: repoRoot,
  encoding: "utf8",
});
const cliOutput = `${cli.stdout ?? ""}${cli.stderr ?? ""}`;
if (cli.status === 0 && /Registry is valid/.test(cliOutput)) {
  cliRan = true;
  const summary = cliOutput.match(/Checked .*/)?.[0]?.trim() ?? "valid";
  check(true, `shadcn CLI accepted the registry (${summary})`);
} else if (cli.error && /ENOENT|not found/i.test(String(cli.error))) {
  notes.push("shadcn CLI unavailable (offline?); structural checks still ran");
} else if (cli.status === 0) {
  // Exited cleanly but never said "valid" — treat the silence as a failure
  // rather than assuming success, because a silent pass is indistinguishable
  // from the CLI having changed its output.
  cliRan = true;
  check(
    false,
    `shadcn CLI produced no verdict:\n      ${cliOutput
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 10)
      .join("\n      ")}`,
  );
} else {
  cliRan = true;
  check(
    false,
    `shadcn CLI rejected the registry:\n      ${cliOutput
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 10)
      .join("\n      ")}`,
  );
}

if (!cliRan) notes.push("shadcn CLI unavailable (offline?); structural checks still ran");

// ------------------------------------------- 2. structural / semantic checks
const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Registry;

check(Array.isArray(registry.items), "items is an array (the current shadcn shape)");
check(
  registry.$schema === "https://ui.shadcn.com/schema/registry.json",
  "declares the official registry schema",
);
check(typeof registry.name === "string" && registry.name.length > 0, "declares a registry name");

const names = new Set<string>();
for (const item of registry.items) {
  if (names.has(item.name)) check(false, `item name is unique: ${item.name}`);
  names.add(item.name);
}
check(names.size === registry.items.length, `all ${registry.items.length} item names are unique`);

check(
  registry.items.length > 0 && registry.items.every((i) => i.description.trim().length > 0),
  "every item has a description",
);
check(
  registry.items.every((i) => i.type.startsWith("registry:")),
  "every item uses a registry:* type",
);

let missingFiles = 0;
const owners = new Map<string, string>();
const doubleOwned: string[] = [];
for (const item of registry.items) {
  for (const file of item.files) {
    if (!existsSync(join(repoRoot, file.path))) {
      missingFiles++;
      problems.push(`missing source file: ${file.path} (declared by "${item.name}")`);
    }
    const previous = owners.get(file.path);
    if (previous) doubleOwned.push(`${file.path} (${previous}, ${item.name})`);
    owners.set(file.path, item.name);
  }
}
check(missingFiles === 0, "every declared file exists on disk");
check(
  doubleOwned.length === 0,
  `every file belongs to exactly one item${doubleOwned.length ? `: ${doubleOwned.join(", ")}` : ""}`,
);

let unknownDeps = 0;
for (const item of registry.items) {
  for (const dep of item.registryDependencies) {
    if (!names.has(dep)) {
      unknownDeps++;
      problems.push(`"${item.name}" depends on unknown item "${dep}"`);
    }
    if (dep === item.name) problems.push(`"${item.name}" depends on itself`);
  }
}
check(unknownDeps === 0, "every registryDependency names a real item");

// The graph must be acyclic; a cycle would make `shadcn add` recurse forever.
const edges = new Map(registry.items.map((i) => [i.name, i.registryDependencies] as const));
const state = new Map<string, 0 | 1 | 2>();
let cycle: string[] | null = null;
const cycleText = (): string => (cycle === null ? "" : `: ${cycle.join(" -> ")}`);
const visit = (name: string, stack: string[]): void => {
  if (cycle) return;
  const current = state.get(name) ?? 0;
  if (current === 1) {
    cycle = [...stack.slice(stack.indexOf(name)), name];
    return;
  }
  if (current === 2) return;
  state.set(name, 1);
  for (const dep of edges.get(name) ?? []) visit(dep, [...stack, name]);
  state.set(name, 2);
};
for (const name of names) visit(name, []);
const cycleDetail = cycleText();
check(cycle === null, `dependency graph is acyclic${cycleDetail}`);

// Declared dependencies must match the real import graph, or installing an
// item will produce source that cannot resolve its own imports.
const resolveImport = (from: string, specifier: string): string | null => {
  const base = resolve(repoRoot, dirname(from), specifier);
  const stem = base.replace(/\.(js|jsx|mjs|cjs)$/, "");
  for (const candidate of [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    join(stem, "index.ts"),
    join(stem, "index.tsx"),
  ]) {
    const rel = relative(repoRoot, candidate).split("\\").join("/");
    if (existsSync(join(repoRoot, rel))) return rel;
  }
  return null;
};

let drift = 0;
for (const item of registry.items) {
  const imported = new Set<string>();
  for (const file of item.files) {
    const source = readFileSync(join(repoRoot, file.path), "utf8");
    for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      const resolved = resolveImport(file.path, match[1] as string);
      if (resolved && resolved !== file.path) imported.add(resolved);
    }
  }
  const actual = new Set<string>();
  for (const file of imported) {
    const owner = owners.get(file);
    if (owner && owner !== item.name) actual.add(owner);
  }
  const declared = new Set(item.registryDependencies);
  const missingDeps = [...actual].filter((d) => !declared.has(d));
  const extraDeps = [...declared].filter((d) => !actual.has(d) && d !== "theme");
  if (missingDeps.length > 0) {
    drift++;
    problems.push(`"${item.name}" imports from undeclared item(s): ${missingDeps.join(", ")}`);
  }
  if (extraDeps.length > 0) {
    drift++;
    problems.push(`"${item.name}" declares unneeded dependency(ies): ${extraDeps.join(", ")}`);
  }
}
check(drift === 0, "declared dependencies match the real import graph");

// No item may import from outside the published set, or from a path the
// registry never installs. This is the check that keeps copy-and-paste honest.
function _walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) _walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const published = new Set(owners.keys());
const escapees: string[] = [];
for (const file of published) {
  const source = readFileSync(join(repoRoot, file), "utf8");
  for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    const specifier = match[1] as string;
    if (!specifier.startsWith(".")) continue;
    const resolved = resolveImport(file, specifier);
    if (resolved && !published.has(resolved)) {
      escapees.push(`${file} -> ${specifier}`);
    }
  }
}
check(
  escapees.length === 0,
  `no published file imports unpublished source${escapees.length ? `: ${escapees.join(", ")}` : ""}`,
);

// Every target must sit under the single install root, so that relative
// imports between installed files keep resolving.
const roots = new Set<string>();
for (const item of registry.items) {
  for (const file of item.files) {
    const cleaned = file.target.replace(/^@(components|ui|lib|hooks)\//, "");
    roots.add(cleaned.split("/")[0] as string);
  }
}
check(roots.size === 1, `all targets share one install root (${[...roots].join(", ")})`);

// ---------------------------------------------------------------- summary
for (const note of notes) console.log(`  ! ${note}`);
if (problems.length > 0) {
  console.error(`\nregistry validation FAILED\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`\nregistry valid: ${registry.items.length} items, ${owners.size} files\n`);
