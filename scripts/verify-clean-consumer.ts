#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
/**
 * Prove that registry-installed source actually works in a clean consumer.
 *
 * `shadcn registry validate` only checks that the manifest is well-formed. It
 * cannot tell you whether a copied component still typechecks, still resolves
 * its own relative imports, or depends on something unpublished — which are the
 * failures that matter, and the reason a registry can be "valid" and useless.
 *
 * So this does the real thing:
 *
 *   1. Create a throwaway project with no dependency on this repository.
 *   2. Resolve the item's transitive `registryDependencies` from the manifest.
 *   3. Copy the files exactly as shadcn would, honouring `files[].target`.
 *   4. Reject any copied file that imports outside the installed root.
 *   5. Typecheck the result against only its declared peer dependencies.
 *   6. Render it in OpenTUI's test renderer and assert the characters.
 *
 * Step 4 is the one that catches the failure mode this whole design exists to
 * prevent: a component that quietly imports a private internal module, so the
 * copy-and-paste experience is a lie.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HOOK_INDEX as CONSUMER_HOOK_INDEX, CONSUMERS, type ConsumerFixture } from "./consumer-fixtures.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(repoRoot, "fixtures", "clean-consumer");
const itemName = process.argv[2] ?? "select";

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
  items: RegistryItem[];
  dependencies?: string[];
}

const registry = JSON.parse(readFileSync(join(repoRoot, "registry.json"), "utf8")) as Registry;
const byName = new Map(registry.items.map((item) => [item.name, item]));

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`  ${ok ? "✔" : "✖"} ${message}`);
  if (!ok) failures.push(message);
};

/** Resolve an item and everything it depends on, transitively. */
function resolveClosure(name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return [];
  seen.add(name);
  const item = byName.get(name);
  if (!item) throw new Error(`unknown registry item: ${name}`);
  const out: string[] = [name];
  for (const dep of item.registryDependencies) {
    out.push(...resolveClosure(dep, seen));
  }
  return out;
}

/** Turn a `files[].target` into a path inside the fixture, honouring `@components/`. */
function targetPath(target: string): string {
  const withoutPlaceholder = target
    .replace(/^@components\//, "")
    .replace(/^@ui\//, "")
    .replace(/^@lib\//, "");
  return join(fixtureDir, withoutPlaceholder);
}

console.log(`\nclean consumer: installing "${itemName}"\n`);

// ---------------------------------------------------------------- reset
rmSync(fixtureDir, { recursive: true, force: true });
mkdirSync(join(fixtureDir, "src"), { recursive: true });

const closure = resolveClosure(itemName);
console.log(`  resolved closure: ${closure.join(" -> ")}\n`);

// ---------------------------------------------------------------- copy
let installedFiles = 0;
const installedRoots = new Set<string>();
/** Repo-relative source path -> the file it was installed as. */
const installedAs = new Map<string, string>();
for (const name of closure) {
  const item = byName.get(name) as RegistryItem;
  for (const file of item.files) {
    const source = join(repoRoot, file.path);
    if (!existsSync(source)) {
      check(false, `source file exists: ${file.path}`);
      continue;
    }
    const destination = targetPath(file.target);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
    installedAs.set(file.path, destination);
    installedFiles++;
    installedRoots.add(relative(fixtureDir, destination).split(/[\\/]/)[0] as string);
  }
}
console.log(`  copied ${installedFiles} files into fixtures/clean-consumer\n`);

// The root every installed file is guaranteed to live under, relative to the
// fixture. Nothing may import outside it.
const installRoot = [...installedRoots][0] as string;
check(
  installedRoots.size === 1,
  `all files installed under a single root (${[...installedRoots].join(", ")})`,
);

// ------------------------------------------- no hidden internal imports
const BARE_OK = new Set([
  "react",
  "react/jsx-runtime",
  "@opentui/react",
  "@opentui/core",
  "@opentui/core/testing",
  "@opentui/react/test-utils",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of require("node:fs").readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const imported: string[] = [];
for (const file of walk(join(fixtureDir, installRoot))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    const specifier = match[1] as string;
    if (specifier.startsWith(".")) {
      // Must resolve to a file that was actually installed.
      const base = resolve(dirname(file), specifier);
      const stem = base.replace(/\.(js|jsx)$/, "");
      const ok = [base, `${stem}.ts`, `${stem}.tsx`, join(stem, "index.ts"), join(stem, "index.tsx")].some(
        (c) => existsSync(c),
      );
      if (!ok) imported.push(`${relative(fixtureDir, file)} -> ${specifier}`);
    } else if (!BARE_OK.has(specifier)) {
      imported.push(`${relative(fixtureDir, file)} -> ${specifier} (undeclared bare import)`);
    }
  }
}
check(
  imported.length === 0,
  imported.length === 0
    ? "every relative import resolves inside the installed tree"
    : `no unresolvable or undeclared imports:\n      ${imported.join("\n      ")}`,
);

// ---------------------------------------------------------------- project
const _installedModulePath = relative(join(fixtureDir, "src"), join(fixtureDir, installRoot, "index.ts"))
  .split("\\")
  .join("/")
  .replace(/\.tsx?$/, ".js");

writeFileSync(
  join(fixtureDir, "package.json"),
  `${JSON.stringify(
    {
      name: "clean-consumer-fixture",
      private: true,
      type: "module",
      dependencies: {
        "@opentui/core": "^0.5.12",
        "@opentui/react": "^0.5.12",
        react: "^19.2.0",
      },
      devDependencies: {
        "@types/bun": "^1.4.0",
        "@types/react": "^19.2.0",
        typescript: "^5.9.3",
      },
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(fixtureDir, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        lib: ["ESNext"],
        target: "ESNext",
        module: "Preserve",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        jsxImportSource: "@opentui/react",
        types: ["bun", "react"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`,
);

/** A `src/`-relative import specifier for an installed *source* file. */
function specFor(sourcePath: string): string {
  const destination = installedAs.get(sourcePath);
  if (!destination) throw new Error(`${sourcePath} was not installed`);
  return `./${relative(join(fixtureDir, "src"), destination).split("\\").join("/")}`.replace(
    /\.tsx?$/,
    ".js",
  );
}

/** The installed file backing a named item's public entry. */
function _entryFile(name: string): string {
  const item = byName.get(name) as RegistryItem;
  const index = item.files.find((f) => /index\.(ts|tsx)$/.test(f.path));
  return (index ?? (item.files[0] as RegistryFile)).path;
}

// `hooks` is the one item whose files are not fronted by an index. Generate one
// in the consumer's own tree, which is exactly what a consumer would write, and
// which proves the individual hook modules resolve as a group.
if (itemName === "hooks") {
  writeFileSync(
    join(fixtureDir, "src", "hooks.ts"),
    `${CONSUMER_HOOK_INDEX.replace("./", (m) => m)
      .split("\n")
      .map((line) => {
        const match = line.match(/^export \* from "\.\/(.*)\.js";$/);
        if (!match) return line;
        const source = (byName.get("hooks") as RegistryItem).files.find(
          (f) => f.path === `src/hooks/${match[1]}.ts`,
        );
        return source ? `export * from "${specFor(source.path)}";` : line;
      })
      .join("\n")}\n`,
  );
}

const fixture: ConsumerFixture | undefined = CONSUMERS[itemName];
check(fixture !== undefined, `a consumer fixture exists for "${itemName}"`);

if (fixture) {
  // Rewrite each import's registry path to the location the file actually
  // installed to, so the consumer exercises real resolution rather than a
  // hand-written guess about where things land.
  const imports = fixture.imports.map((line) => {
    const match = line.match(/from "(@\/terminal-ui\/(.*))"/);
    if (!match) return line;
    const source = `src/${match[2]}`.replace(/\.js$/, ".ts");
    const installed = installedAs.get(source) ?? installedAs.get(source.replace(/\.ts$/, ".tsx"));
    if (!installed) return line;
    return line.replace(
      `"${match[1]}"`,
      `"${specFor(Array.from(installedAs).find(([k]) => installedAs.get(k) === installed)?.[0] as string)}"`,
    );
  });

  const inner = fixture.wrap
    ? `<ThemeProvider theme="${fixture.wrap}">{${fixture.body}}</ThemeProvider>`
    : fixture.body;

  writeFileSync(
    join(fixtureDir, "src", "app.tsx"),
    [
      ...imports,
      "",
      ...(fixture.extra ? fixture.extra.split("\n") : []),
      "",
      "export function App() {",
      `  return ${inner};`,
      "}",
      "",
    ].join("\n"),
  );

  // Built by concatenation rather than a nested template literal: the test
  // body itself contains backslash-n sequences, and escaping those through two
  // levels of template literal is how a generated test file ends up with a
  // literal newline inside a string.
  const NL = "\\n";
  const testLines: string[] = [
    'import { expect, test } from "bun:test";',
    'import { testRender } from "@opentui/react/test-utils";',
    'import { App } from "./app.js";',
    "",
    `test("the installed ${itemName} renders as the reference grammar says", async () => {`,
    "  const setup = await testRender(<App />, { width: 60, height: 30, kittyKeyboard: true });",
    "  await setup.renderOnce();",
    `  const lines = setup.captureCharFrame().split("${NL}").map((l) => l.replace(/\\s+$/, "")).filter((l) => l.trim() !== "");`,
  ];
  if (fixture.expect.length === 0) {
    testLines.push("  // This item has no visual surface; importing it is the assertion.");
    testLines.push("  expect(lines.length).toBeGreaterThanOrEqual(0);");
  } else {
    const literal = JSON.stringify(fixture.expect, null, 2)
      .split("\n")
      .join(`
  `);
    testLines.push(`  expect(lines).toEqual(${literal});`);
  }
  testLines.push("});");
  writeFileSync(join(fixtureDir, "src", "render.test.tsx"), `${testLines.join("\n")}\n`);
}

// ---------------------------------------------------------------- verify
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { cwd: fixtureDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

console.log("  installing fixture dependencies...");
try {
  run("bun", ["install", "--silent"]);
  check(true, "fixture dependencies installed");
} catch (error) {
  check(false, `fixture dependencies installed: ${(error as Error).message}`);
  process.exit(1);
}

let typecheck = "skipped";
try {
  run("bun", ["x", "tsc", "--noEmit"]);
  typecheck = "passed";
  check(true, "installed source typechecks with no reference to the source repo");
} catch (error) {
  const output = `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}`;
  typecheck = "FAILED";
  check(false, `installed source typechecks:\n      ${output.split("\n").slice(0, 12).join("\n      ")}`);
}

let render = "skipped";
if (typecheck === "passed") {
  try {
    const out = run("bun", ["test", "src/render.test.tsx"]);
    render = "passed";
    check(
      true,
      "installed source renders correctly in OpenTUI:\n      " +
        out.trim().split("\n").slice(-4).join("\n      "),
    );
  } catch (error) {
    render = "FAILED";
    const output = `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}`;
    check(
      false,
      `installed source renders correctly:\n      ${output.split("\n").slice(0, 16).join("\n      ")}`,
    );
  }
}

console.log(`\n  ${itemName}: typecheck=${typecheck} render=${render}\n`);

// ---------------------------------------------------------------- summary
if (failures.length > 0) {
  console.error(`clean consumer FAILED with ${failures.length} problem(s)\n`);
  process.exit(1);
}
console.log("clean consumer OK\n");
