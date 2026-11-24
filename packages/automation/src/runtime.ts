import { existsSync } from "node:fs";
import { join } from "node:path";

/** Pinned versions staged by scripts/prepare-playwright-mcp.mjs. */
export const PLAYWRIGHT_MCP_VERSION = "0.0.86";

export interface BundledRuntime {
  mcpCli: string;
  playwrightCli: string;
}

/** The Playwright MCP shipped inside the app (resources/playwright-mcp), run with the app's own Node. Undefined in dev checkouts: those use npx. */
export function bundledRuntime(env: NodeJS.ProcessEnv = process.env): BundledRuntime | undefined {
  if (!env.OMB_RESOURCES_PATH) return undefined;
  const modules = join(env.OMB_RESOURCES_PATH, "playwright-mcp", "node_modules");
  const runtime = { mcpCli: join(modules, "@playwright", "mcp", "cli.js"), playwrightCli: join(modules, "playwright-core", "cli.js") };
  return existsSync(runtime.mcpCli) && existsSync(runtime.playwrightCli) ? runtime : undefined;
}
