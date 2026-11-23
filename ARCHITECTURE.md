# ARCHITECTURE.md: Single Super App (Master Build Spec)

> Put this file in the root of the GitHub repo. The AI coding agent reads it
> FIRST and follows it phase by phase. Do not skip phases. Do not build
> everything in one step.

---

## 0. Mission

Build ONE desktop AI-agent app (my brand, my name) inside THIS repo by:

1. Copying the OpenMausBot codebase as the base (Phase 0).
2. Re-skinning it with a Grok-Bot-style look (own design, no copied assets).
3. Adding automation (scraping + browser control) from free permissive repos.
4. Adding extra AI features (workflows, multi-agent, local model fallback).
5. Integrating the remaining permitted repos.

The same repo must also be able to build smaller apps later (bot-app,
automation-app, workflow-app) from shared packages. The MAIN app uses all
packages.

## 1. Hard rules (the agent MUST obey)

1. **Local only.** No hosted server, no cloud database, no paid service.
   Everything runs on the user's machine.
2. **Models = user's own access only:**
   - OpenRouter: user's own API key (free models first).
   - OpenCode: run the real `opencode` program as a local subprocess (ACP).
     Never call OpenCode's free endpoint directly over HTTP; the server
     rejects it.
   - Kiro: run the user's installed `kiro-cli` (ACP), signed in by the user.
     Kiro is proprietary: never copy or bundle its code.
   - Optional LocalAI for a free local model.
3. **Licenses.** Only copy code whose LICENSE is MIT, Apache-2.0 or BSD.
   Before copying ANY repo, open its LICENSE file and confirm. If the license
   differs from the registry in section 2, STOP and ask the user.
4. **Never copy** folders named `enterprise/`, `ee/`, or anything under a
   non-permissive license, even inside a permissive repo.
5. **Keep notices.** Every copied or vendored component keeps its LICENSE and
   copyright header. Record it in `THIRD_PARTY.md` (name, URL, license,
   commit, what was changed).
6. **Trademarks.** Remove the OpenMausBot / MausBot names and mascot. Do not
   use xAI / Grok logos, icons or fonts. The UI look is inspired, not copied.
7. **Prefer dependency over copy.** If a repo is a library (Playwright,
   LangGraph, Browser Use), install it with npm/pip. Copy its source into
   `third_party/<name>/` only when the code must be modified.
8. **Work in small steps.** One phase at a time. Commit after each task.
   Never write a giant file in one go; build big files in parts, then
   combine, and check that nothing is cut off.

### 1.1 Installer-first rules ("local" means a normal setup app)

The user must be able to double-click `Setup.exe` (or `.dmg` / `.deb`) on a
laptop and use the app. Nothing else to install.

1. **No Docker, no Postgres, no Node, no Python installs for the user.**
   Use local files / SQLite for data. If OpenMausBot needs an external
   service, replace it in Phase 0 (record it in `docs/phase0-audit.md`).
2. **TypeScript/Node first.** Prefer Node libraries so everything ships inside
   the Electron app: Playwright, Stagehand, Crawlee, LangGraph.js.
   Python-only tools (Browser Use, Crawl4AI) are OPTIONAL add-ons, only if
   they can be bundled into the installer as a self-contained sidecar.
3. **Heavy downloads happen on first run** (Playwright browsers, optional
   local models), into the app data folder, with a progress screen.
4. **All data stays on the laptop** (chats, bots, keys, workflows).
5. **Installers come from GitHub Actions** on Windows, macOS and Linux runners.
   Unsigned builds are fine for personal use (the OS shows an "unknown
   publisher" warning); code signing is optional and can be added later.

## 2. License registry (verify each LICENSE before use)

### 2.1 ALLOWED: copy and modify

| Repo | License | Role | Caveat |
|---|---|---|---|
| OpenMausBot | Apache-2.0 | Base app (Phase 0) | Verified. DELETE `enterprise/`. Rename, remove mascot |
| OpenCode | MIT | Coding agent, driven via ACP | Drive the binary; copy only if modifying |
| Playwright | Apache-2.0 | Browser automation + MCP | |
| Browser Use | MIT | AI browser actions | Verify LICENSE |
| Stagehand | MIT | AI act/extract on Playwright | Verify LICENSE |
| Crawl4AI | Apache-2.0 + attribution | Crawling | Credit it in the About screen |
| Scrapy | BSD-3 | Lightweight crawling | |
| Crawlee | Apache-2.0 | Crawling (Node) | |
| LangGraph | MIT | Workflow tree / graph | |
| LocalAI | MIT | Free local model fallback | |
| Goose | Apache-2.0 | Agent UI/ideas | |
| Hermes Agent | MIT | Agent features | |
| Rakazo | Apache-2.0 | Grok-Bot-style agent ideas | |
| OpenClaw | MIT | Agent features | |
| Cline | Apache-2.0 | Coding agent features | |
| Aider | Apache-2.0 | Code editing agent | |
| CrewAI | MIT | Multi-agent teams | |
| AutoGen | MIT | Multi-agent chat | Code is MIT; verify |
| MetaGPT | MIT | Role-based agents | |
| OpenHands | MIT core | Coding agent | Exclude `enterprise/` folder if present |
| Activepieces | MIT community | Visual workflow canvas (optional) | Exclude `ee/` folders |

### 2.2 FORBIDDEN in the shipped app (never copy, never bundle)

- n8n (fair-code; cannot be resold) -> allowed ONLY as an optional external
  tool the user runs themselves, reached through plain HTTP webhooks.
  No n8n code in this repo.
- Firecrawl, Maxun, Lightpanda (AGPL), Browserless (SSPL),
  Open Interpreter (AGPL), Dify (extra conditions), AutoGPT (Polyform Shield).
- Meta Muse Gadget SDK (non-commercial token).
- Composio and any cloud-hosted connector service.
- Kiro CLI source (proprietary; drive only).
- Grok Bot itself (proprietary; look only, no code or assets).

> Note: licenses above come from a research file and general knowledge, not
> from reading each LICENSE. The agent MUST re-check each one when it first
> touches that repo and log the result in `THIRD_PARTY.md`.

## 3. Target repo layout

The base OpenMausBot structure is discovered in Phase 0 (do not assume
paths). After the build, the repo should look like this:

```
<repo-root>/
├─ ARCHITECTURE.md          this file
├─ THIRD_PARTY.md           every copied/used component + license + changes
├─ LICENSE  NOTICE          kept from OpenMausBot (Apache-2.0)
├─ apps/
│  ├─ main-app/             MAIN app: loads ALL packages (forked OpenMausBot)
│  ├─ bot-app/              later: agent-core + theme + models
│  ├─ automation-app/       later: automation + workflow
│  └─ workflow-app/         later: workflow + connectors
├─ packages/
│  ├─ agent-core/           OpenMausBot engine (bots, tools, approvals)
│  ├─ theme/                Grok-style design tokens + UI components
│  ├─ models/               provider adapters + failover + usage meter
│  ├─ automation/           Playwright, Browser Use, Stagehand, Crawl4AI/Scrapy
│  ├─ workflow/             LangGraph tree + optional webhook bridge
│  ├─ agents/               CrewAI / AutoGen / MetaGPT / Goose features
│  ├─ connectors/           local MCP servers only
│  ├─ compute/              local job runner for heavy tasks
│  └─ licenses/             license manifest + About screen data
├─ third_party/             vendored source we modified (each with LICENSE)
└─ .github/workflows/       build (Win/Mac/Linux) + license audit
```

### Package contract (so any app can load any package)

Every package in `packages/` must have:

- `manifest.json`: `name`, `version`, `tools[]`, `uiPanels[]`, `needs[]`
- an MCP server OR a local HTTP endpoint (loopback only)
- its own README with how to run and test it

The main app scans `packages/*/manifest.json` at start and loads what it finds.
Smaller apps load a chosen subset.

## 4. Build phases

Each phase ends with: build passes, app starts, one test of the new feature,
`THIRD_PARTY.md` updated, a git commit. Stop and report after each phase.

### Phase 0: Copy OpenMausBot (the base)

> **Only OpenMausBot is copied as a whole repo.** No other repo (Rakazo,
> Goose, Hermes, OpenClaw, etc.) is ever copied whole. Everything else is
> added later as a dependency or as ONE small feature at a time.

1. Audit: list the real folders of the OpenMausBot source (desktop shell,
   server, companion apps, skills, third_party). Write the findings to
   `docs/phase0-audit.md`.
2. Copy the source into this repo (keep `LICENSE`, `NOTICE`, `LICENSING.md`).
3. DELETE the `enterprise/` folder and everything that imports it. The app
   must still build and start without it.
4. Rename the product everywhere (package names, window title, installer
   name, bundle id, docs). Remove the mascot and all trademarked images.
5. Remove cloud parts: Composio plugin marketplace, "cloud computer" for bots,
   organisation sign-in, cloud backups, any telemetry. Replace with local
   equivalents or hide the feature.
6. Confirm: app builds, starts, one bot can chat using an API key.

### Phase 1: Grok-style look (`packages/theme`)

1. Create design tokens (colors, spacing, radius, type scale) in one file.
2. Dark-first UI: minimal sidebar, wide chat column, rounded input bar,
   subtle borders, bot cards, status chips.
3. Use only open fonts (for example Inter) and own icons (Lucide, ISC/MIT).
4. Apply tokens to the existing screens. No logic changes.
5. Confirm: all screens use the tokens; no hard-coded colors left.

### Phase 2: Models layer (`packages/models`)

See section 5. Confirm: one chat works through each adapter, and failover
switches when a provider errors.

### Phase 3: Automation (`packages/automation`)

1. Install Playwright (pin the version). Browsers install into the app data
   folder on first run, not into the installer.
2. Register Playwright MCP so bots can drive the browser.
3. Add Browser Use and Stagehand as optional "AI act/extract" tools.
4. Add Crawl4AI (or Scrapy) as a crawl tool. Add the Crawl4AI attribution to
   the About screen.
5. Confirm: a bot opens a page, extracts data, and returns it.

### Phase 4: Workflow tree (`packages/workflow`)

1. Use LangGraph for graph/tree workflows: nodes, conditional branches,
   human-approval steps, retries.
2. Nodes can call: bots, automation tools, connectors, compute jobs.
3. Simple visual editor in the main app (nodes and edges as JSON).
4. Optional: a "Send webhook" node so a user-run n8n can be called.
   No n8n code is included.
5. Confirm: a 3-node workflow runs end to end and survives a restart.

### Phase 5: Other AI features (`packages/agents`)

Add, one at a time, each behind a feature flag:
- Multi-agent teams (CrewAI), agent chat (AutoGen), role agents (MetaGPT).
- Coding agents: Aider, Cline-style edit flow, OpenHands core.
- Goose / Hermes / Rakazo / OpenClaw: copy only specific features that
  OpenMausBot lacks (for example scheduled tasks, memory, skills). First
  write a short note in `docs/feature-gap.md` listing what is missing.
- Rakazo (Apache-2.0), ONE feature per task, each behind a flag and each
  logged in `THIRD_PARTY.md`: (1) persistent bot memory + routines,
  (2) group chats, (3) voice mode (user's own keys), (4) local model
  endpoint (OpenAI-compatible, for example Ollama / LM Studio). Do NOT bring
  Rakazo's Postgres + worker + Docker stack unless the user asks, and do NOT
  use its hosted/metered integrations.
- Connectors: local MCP servers only (files, GitHub, calendar via local OAuth).

### Phase 6: Local compute (`packages/compute`)

A background job runner that uses the user's own PC for heavy work
(crawls, batch jobs, local models via LocalAI). Queue, progress, cancel,
CPU/RAM limits settable by the user.

### Phase 7: Package for release

1. GitHub Actions matrix on Windows, macOS, Ubuntu.
2. Outputs: `.exe`, `.dmg`, `.deb` / `.AppImage`.
3. License audit step (see section 6) must pass or the build fails.
4. In-app "Open Source Licenses" screen generated from `THIRD_PARTY.md`.

### Phase 8: Split into smaller apps (optional)

Create `apps/bot-app`, `apps/automation-app`, `apps/workflow-app` that load
only some packages. Same code, different manifest list.

## 5. Models layer spec (`packages/models`)

One interface, three adapters:

```ts
interface ModelProvider {
  id: string;                      // "openrouter" | "opencode" | "kiro" | "localai"
  status(): Promise<{ signedIn: boolean; note?: string }>;
  listModels(): Promise<ModelInfo[]>;
  chat(req: ChatRequest): AsyncIterable<ChatEvent>;   // streaming
  usage?(): Promise<UsageInfo>;    // credits / free-request counts if available
}
```

| Adapter | Transport | Auth (stored locally only) |
|---|---|---|
| `openrouter` | HTTPS to OpenRouter's OpenAI-compatible API | user's own API key |
| `opencode` | spawn `opencode acp` (JSON-RPC over stdio) | user's own `opencode` login/keys |
| `kiro` | spawn `kiro-cli acp` (JSON-RPC over stdio) | user runs `kiro-cli login` |
| `localai` (optional) | loopback HTTP | none |

ACP client rules: initialize, create session, send prompt, stream updates,
handle permission requests with an in-app approval card, cancel on user stop,
close idle sessions. Read the capabilities the server advertises; do not
assume features from a version number.

**Failover chain** (user can reorder): Kiro -> OpenCode -> OpenRouter free ->
LocalAI. On quota error, rate limit, model removed, or timeout: mark the
provider cooling down, switch to the next, continue the same conversation,
show a small notice in the chat.

**Secrets.** Keys live in the OS keychain or an encrypted local file. Never
in git, logs, or crash reports. Add `.env*` and key files to `.gitignore`.

**Free models change without notice.** Fetch the model list at runtime; never
hard-code model names.

## 6. License audit (CI)

- Run a license checker on every build (for example `license-checker` for npm,
  `pip-licenses` for Python). Allow only: MIT, Apache-2.0, BSD-2/3, ISC.
- Fail the build on: GPL, AGPL, SSPL, Polyform, "fair-code", unknown.
- Fail the build if a folder named `enterprise/` or `ee/` exists.
- Generate `THIRD_PARTY.md` and the in-app licenses screen from the same data.

## 7. Working rules for the AI agent

1. Read this file fully before touching code.
2. Do one phase at a time. At the end of each phase: summarize what changed,
   what was copied (with license), what is left, then STOP and wait.
3. Make small commits with clear messages (`phase0: remove enterprise/`).
4. Never create a huge file in one step. Build in parts (data -> structure ->
   combine), then verify the file is complete and compiles.
5. If a license, folder name or repo layout does not match this document,
   stop and ask. Do not guess.
6. Never commit secrets. Never add a cloud dependency.
7. After every phase, run build + tests and report the result honestly,
   including failures.

## 8. First prompt to give the AI agent

> Read ARCHITECTURE.md in this repo. Start with Phase 0 only. First write
> `docs/phase0-audit.md` describing the real folder structure of the
> OpenMausBot source and your exact plan for steps 2 to 6, then wait for my
> approval before changing any code.

