import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(here, "..", "fixtures", "golden");

/**
 * Golden-fixture store for the visual suite.
 *
 * Fixtures are stored as plain text frames, one file per scenario, because a
 * text frame is the thing a human can actually read in a diff. A binary or
 * serialized snapshot would hide exactly the regressions this suite exists to
 * catch — a marker that moved one column, a glyph that changed shape.
 *
 * Regenerate with `bun run test:visual -- --update`.
 */
export const GOLDEN_PATH = GOLDEN_DIR;

export function isUpdateMode(): boolean {
  return process.argv.includes("--update") || process.env.UPDATE_GOLDEN === "1";
}

export function goldenPath(name: string): string {
  return join(GOLDEN_DIR, `${name}.txt`);
}

export function readGolden(name: string): string | null {
  const path = goldenPath(name);
  if (!existsSync(path)) return null;
  // Trailing newlines are normalised so a fixture is not sensitive to the
  // editor that last touched it.
  return readFileSync(path, "utf8").replace(/\n+$/, "\n");
}

export function writeGolden(name: string, frame: string): void {
  mkdirSync(GOLDEN_DIR, { recursive: true });
  writeFileSync(goldenPath(name), frame.endsWith("\n") ? frame : `${frame}\n`);
}

/** A line-by-line diff, narrow enough to read in a terminal. */
export function diffFrames(expected: string, actual: string, limit = 12): string[] {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const out: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max && out.length < limit; i++) {
    const left = a[i] ?? "";
    const right = b[i] ?? "";
    if (left === right) continue;
    out.push(`line ${i + 1}:`);
    out.push(`  expected ${JSON.stringify(left)}`);
    out.push(`  actual   ${JSON.stringify(right)}`);
  }
  return out;
}
