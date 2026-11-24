import { browsersDir } from "./paths.ts";
import { bundledRuntime, PLAYWRIGHT_MCP_VERSION } from "./runtime.ts";

export interface McpServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Pinned Playwright MCP, as an entry for the app's `config.json` -> `mcpServers`. Runs isolated (no shared profile).
 * Packaged app: the bundled copy runs on the app's own Node. Dev checkout: npx.
 */
export function playwrightMcpServer(appDataDir: string, options: { headless?: boolean; runtimeEnv?: NodeJS.ProcessEnv } = {}): McpServerEntry {
  const flags = ["--isolated", ...(options.headless ? ["--headless"] : [])];
  const env = { PLAYWRIGHT_BROWSERS_PATH: browsersDir(appDataDir) };
  const bundled = bundledRuntime(options.runtimeEnv);
  if (bundled) return { command: process.execPath, args: [bundled.mcpCli, ...flags], env: { ...env, ELECTRON_RUN_AS_NODE: "1" } };
  return { command: "npx", args: ["-y", `@playwright/mcp@${PLAYWRIGHT_MCP_VERSION}`, ...flags], env };
}
