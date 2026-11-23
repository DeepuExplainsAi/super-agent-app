# @super-agent/automation

Browser control and crawling for bots.

- **Playwright MCP** (Apache-2.0, pinned `@playwright/mcp@0.0.86`): `playwrightMcpServer(appDataDir)` returns the entry to put in
  `config.json` -> `mcpServers`. Bots then open pages, click, and read data through MCP tools.
- **Browsers** download on first run into `<appData>/browsers` (never in the installer): `browsersInstalled()`, `installBrowsers(appData, onProgress)`
  (feeds the progress screen).
- **crawl(url, { maxPages, sameOrigin })**: small built-in static-page crawler (no JS). JS-heavy sites: use the Playwright tool.
- Optional, not installed yet: Stagehand (MIT), Browser Use (MIT, Python), Crawl4AI (Apache-2.0, needs About-screen credit), Crawlee (Apache-2.0). See `manifest.json` `optional`.

Test: `pnpm exec vitest run packages/automation`.
Note: `npx` needs Node at run time. The Electron app must run it with its own bundled Node (ELECTRON_RUN_AS_NODE); wiring is open.
