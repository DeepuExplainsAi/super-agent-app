import { browsersDir } from "./paths.ts";

export interface McpServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Pinned Playwright MCP, as an entry for the app's `config.json` -> `mcpServers`. Runs isolated (no shared profile). */
export function playwrightMcpServer(appDataDir: string, options: { headless?: boolean } = {}): McpServerEntry {
  return {
    command: "npx",
    args: ["-y", "@playwright/mcp@0.0.86", "--isolated", ...(options.headless ? ["--headless"] : [])],
    env: { PLAYWRIGHT_BROWSERS_PATH: browsersDir(appDataDir) },
  };
}
