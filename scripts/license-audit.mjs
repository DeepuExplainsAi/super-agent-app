#!/usr/bin/env node
// License audit (spec section 6). Fails on a disallowed or unknown license in production dependencies, and on any
// `enterprise/` or `ee/` folder. `--write <file>` saves the package list that the in-app licenses screen reads.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "BlueOak-1.0.0", "CC0-1.0", "Python-2.0", "Unlicense", "CC-BY-4.0", "MIT-0"]);
const BANNED = /GPL|AGPL|SSPL|Polyform|BUSL|Commons-Clause|Elastic|fair-code/i;
// Reviewed exceptions: package -> reason. Add here only after reading the package's license.
const EXCEPTIONS = JSON.parse(readFileSync(new URL("./license-exceptions.json", import.meta.url), "utf8"));

const problems = [];

for (const dir of ["enterprise", "ee"]) {
  const stack = ["."];
  while (stack.length) {
    const here = stack.pop();
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      if (!entry.isDirectory() || ["node_modules", ".git", "dist", "out", "release"].includes(entry.name)) continue;
      if (entry.name === dir) problems.push(`forbidden folder: ${join(here, entry.name)}`);
      else stack.push(join(here, entry.name));
    }
  }
}

const raw = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], { encoding: "utf8", maxBuffer: 1 << 28 });
const byLicense = JSON.parse(raw);
const packages = [];
for (const [license, list] of Object.entries(byLicense)) {
  for (const pkg of list) {
    packages.push({ name: pkg.name, versions: pkg.versions, license, author: pkg.author ?? "", homepage: pkg.homepage ?? "" });
    const parts = license.replace(/[()]/g, "").split(/\s+(?:OR|AND)\s+/i);
    const orAllowed = /\sOR\s/i.test(license) && parts.some((p) => ALLOWED.has(p));
    const ok = parts.every((p) => ALLOWED.has(p)) || orAllowed;
    if (ok || EXCEPTIONS[pkg.name]) continue;
    problems.push(`${pkg.name}@${pkg.versions.join(",")}: ${license}${BANNED.test(license) ? " (BANNED)" : " (not on allow list)"}`);
  }
}

const out = process.argv.indexOf("--write");
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(packages.sort((a, b) => a.name.localeCompare(b.name)), null, 1));

console.log(`${packages.length} production packages checked`);
if (problems.length) {
  console.error(`LICENSE AUDIT FAILED (${problems.length}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("license audit passed");
