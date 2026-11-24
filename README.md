# Super Agent

A local desktop app for running a team of AI agents in one chat. It runs on your computer, uses your own API keys and has no hosted backend.

Super Agent is a derivative of [OpenMausBot](https://github.com/milind-soni/OpenMausBot) (Apache-2.0). It is built per [ARCHITECTURE.md](ARCHITECTURE.md). Upstream's original README is kept in [docs/upstream-openmausbot-README.md](docs/upstream-openmausbot-README.md).

## Install

Download the installer for your system from the [Releases page](https://github.com/DeepuExplainsAi/super-agent-app/releases): `.exe` (Windows), `.dmg` (macOS), `.AppImage`, `.deb` or `.rpm` (Linux).

Builds are not code-signed. Windows SmartScreen and macOS Gatekeeper will warn on first launch.

## What is in it

| Package | What it does |
|---|---|
| `packages/theme` | Dark, monochrome `agent` skin and design tokens |
| `packages/models` | Provider adapters (OpenRouter, Kiro, OpenCode, local OpenAI-compatible endpoints), failover order, usage meter |
| `packages/automation` | Playwright MCP (bundled, runs on Electron's Node), Crawlee crawler, Stagehand AI browse/extract |
| `packages/workflow` | JSON workflow graphs: nodes, branches, approvals, retries, restart-safe |
| `packages/compute` | Local job runner with queue, progress, cancel and CPU/RAM limits |

The Settings page "Automation & models" drives these. Smaller apps are profiles in `apps/*/app.json`, selected with `SA_APP`.

## Develop

```sh
pnpm install
pnpm dev:server    # local server
pnpm dev:desktop   # Electron
pnpm typecheck
pnpm test
pnpm build
```

CI (`.github/workflows/verify.yml`) runs typecheck, tests, the license audit, the build and a server boot smoke test. `package.yml` builds the installers.

## Status and hand-off

[HANDOFF.md](HANDOFF.md) lists what is done, what is open and how to continue. [THIRD_PARTY.md](THIRD_PARTY.md) lists every component and its license. The About screen links to the generated open-source licenses page.

## License

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
