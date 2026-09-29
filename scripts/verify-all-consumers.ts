#!/usr/bin/env bun
/**
 * Verify every registry item against a clean consumer.
 *
 * Running the check for one item is only half the claim. This walks the whole
 * manifest, because the failure mode of a copy-and-paste registry is a
 * *specific* component quietly depending on something that was never published
 * with it — and that is invisible until that component is the one someone tries
 * to install.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(resolve(repoRoot, "registry.json"), "utf8")) as {
  items: Array<{ name: string }>;
};

const script = resolve(repoRoot, "scripts/verify-clean-consumer.ts");
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

for (const item of registry.items) {
  process.stdout.write(`\n=== ${item.name} ===\n`);
  try {
    const _out = execFileSync("bun", ["run", script, item.name], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    results.push({ name: item.name, ok: true, detail: "typecheck + render passed" });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    const lines = output
      .split("\n")
      .filter((l) => l.includes("✖") || l.includes("error TS") || l.includes("error:"))
      .slice(0, 4);
    results.push({ name: item.name, ok: false, detail: lines.join(" | ") || "see output above" });
  }
}

console.log("\n\nclean consumer summary");
console.log("=".repeat(72));
for (const r of results) {
  console.log(`  ${r.ok ? "✔" : "✖"} ${r.name.padEnd(14)} ${r.detail}`);
}
const failed = results.filter((r) => !r.ok);
console.log("=".repeat(72));
console.log(`  ${results.length - failed.length}/${results.length} items verified\n`);

if (failed.length > 0) process.exit(1);
