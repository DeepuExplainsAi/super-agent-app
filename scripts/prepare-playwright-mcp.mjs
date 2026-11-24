// Stage the pinned Playwright MCP (and its playwright-core) as a plain node_modules tree in
// dist-native/playwright-mcp, shipped as resources/playwright-mcp. The packaged app runs it with its own
// Node (ELECTRON_RUN_AS_NODE), so users need no Node/npx install. Platform independent: no native modules.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const out = join(root, "dist-native", "playwright-mcp");
const VERSION = "0.0.86"; // keep equal to PLAYWRIGHT_MCP_VERSION in packages/automation/src/runtime.ts

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "package.json"), JSON.stringify({ name: "playwright-mcp-stage", private: true }));
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install", `@playwright/mcp@${VERSION}`, "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel=error"], { cwd: out, stdio: "inherit", shell: process.platform === "win32" });
for (const file of ["@playwright/mcp/cli.js", "playwright-core/cli.js"]) {
  if (!existsSync(join(out, "node_modules", file))) throw new Error(`Playwright MCP staging is missing ${file}`);
}
console.log(`staged Playwright MCP ${VERSION} in ${out}`);
