# HANDOFF (read this first, update after every part)

Repo: https://github.com/DeepuExplainsAi/super-agent-app (public)
Spec: `ARCHITECTURE.md`. Task list: `TODO.md`. Licenses: `THIRD_PARTY.md`.

## Working protocol (from the user)
- Do parts in order. After EACH part: commit, push, update this file, push again.
- Do NOT ask the user between parts; continue to the next part automatically.
- Stop and ask only when ARCHITECTURE.md says so (license mismatch, layout mismatch).
- Never commit secrets. No cloud dependency. Local only.
- User writes Hinglish; reply short and flat.

## Environment
- Cloud sandbox, `gh` logged in as DeepuExplainsAi (`gh auth setup-git` done).
- Upstream source clone (read-only reference): `~/src-omb` (may be gone; re-clone `milind-soni/OpenMausBot`).

## Status
| Part | Status |
|---|---|
| Part 1: copy OpenMausBot, delete enterprise/ | DONE, pushed 4f8de7b |
| Part 2a: audit -> `docs/phase0-audit.md` | DONE, pushed |
| Part 2b: baseline build | DONE: CI `verify` workflow green (install, typecheck, build) |
| Part 2c: remove enterprise refs | DONE, verify green (server/enterprise.ts is now a stub; enterprise CI/CLA/tests removed) |
| Part 2d: remove cloud/telemetry/Composio | PARTLY DONE, verify green. Done: PostHog (analytics.ts + launch-analytics.mjs are no-op stubs), updater disabled (UPDATES_DISABLED), Composio broker default URL and control-plane default URL emptied, deleted cloudflare/ relay/ connector/ deploy/ Dockerfile compose.yaml + their workflows. LEFT (env-gated, off unless OMB_CLOUD_*/OMB_BOAT_* set): server/boat*.ts, cloud-home*.ts, phone-relay.ts, hosted-*.ts, electron/cloud-account.mjs CLOUD_ORIGIN, src/lib/app-links.ts. Do these in cleanup after 2e. |
| Part 2e: rename + remove mascot | MOSTLY DONE, verify green. Display name = "Super Agent" (locales, index.html, brand.ts, electron-builder.yml appId app.superagent.desktop, artifactName SuperAgent-*), new star icon (build/, public/), mascot images in src/assets/mausbot-steel replaced by star. LEFT: mascot React components still exist (CursorAvatar, CarvedAvatar, MausBotWelcome...), identifiers/env/protocol `openmausbot://`, `~/.openmausbot`, `OMB_*` intentionally kept (internal; renaming is risky); docs/ and apps/docs still say OpenMausBot; src/assets/bubblav + whop logos (third-party brands) unreviewed. |
| Part 2f: final build + boot smoke | DONE: verify has `build` and `boot` jobs, both green (server boots, /api/edition = oss). NOT DONE: live API-key chat (needs user's key; see below) |
| Part 3: theme (`packages/theme`) | DONE (partial vs spec), verify green. `packages/theme/tokens.css` = new `agent` skin (dark, monochrome, Inter font token, rounded radii), imported in src/styles.css, registered in SKIN_IDS (packages/phone-protocol/src/app-settings.ts), SKINS, electron/skin-overlay.cjs, en.json tagline; it is the default dark skin (THEME_SKINS.dark, PRIOR_INSTALL_SKIN). Contrast check passes. NOT DONE: spec step 5 "no hard-coded hex colors left" (many .tsx files still have hex); no Lucide icon swap; font tokens still Geist (Inter token only in agent skin). Low priority polish. |
| Part 4: `packages/models` | DONE as a library, verify green (typecheck + vitest packages/models). NOT wired into the app yet; NOT tested against real `opencode`/`kiro-cli` binaries (none in CI/sandbox). Upstream already has its own ACP drivers (server/drivers/acp/kiro.ts, opencode-go.ts, core.ts) that the app actually uses; our package is a separate small client + failover. Wiring = Part 4b below. |
| Part 4b: wire failover into server (use packages/models chain behind a flag), real-binary test by user | pending (do after Part 5/6 or when user asks) |
| Part 5: `packages/automation` | DONE as library, verify green (vitest packages/automation). NOT wired into app yet; real Playwright MCP / browser download not run (sandbox too small) |
| Part 5b: wire into app (add `playwrightMcpServer()` to default mcpServers, setup panel using `installBrowsers`, run npx via Electron bundled Node), add Stagehand (MIT, verified) / Crawlee (Apache-2.0, verified) | pending |
| Part 6: Phase 4 `packages/workflow` | DONE as library, verify green. Uses own engine, NOT LangGraph (deviation, see its README). UI editor not built (6b) |
| Part 7: Phase 5 gap note + Phase 6 `packages/compute` | DONE, verify green. No `packages/agents` created: gap note shows base already covers the features; CrewAI/AutoGen/MetaGPT/OpenHands/Aider deliberately not added (see docs/feature-gap.md) |
| Part 8: Phase 7 packaging | PARTLY: `scripts/license-audit.mjs` (+`license-exceptions.json`) runs in verify.yml, green. `package.yml` matrix (win/mac/linux, manual) added; check its latest run with `gh run list -w package`. `scripts/build-licenses-page.mjs` writes `public/licenses.html` (not linked from UI yet) |
| BLOCKER (still on after repo went PUBLIC) | GitHub Actions stopped: "recent account payments have failed or your spending limit needs to be increased" (private repo minutes used up, mostly by the package matrix). No CI verification is possible until the user fixes Settings > Billing, or makes the repo public (free minutes). Last verified-green commit: part8-9 era verify. Unverified since: part8-10 (artifact glob only). |
| Part 9: wiring (4b, 5b, 6b, compute UI), user decision on sharp LGPL, rename/brand cleanup | NEXT |

## Log
### Part 1 (done)
- Upstream: milind-soni/OpenMausBot @ 9066604de2be664c7819403d9d8aed94b827f5eb, Apache-2.0 (LICENSE verified).
- Copied everything except `.git` and `enterprise/` into repo root.
- `enterprise/` NOT copied (proprietary license, ARCHITECTURE rule 4). Code that references it
  (`server/enterprise.ts`, `server/brand.ts`, CI job) is kept for now; upstream tests that the app
  works without the folder. Cleanup of those references is in Part 2.
- Kept LICENSE, NOTICE, LICENSING.md. Added ARCHITECTURE.md, HANDOFF.md, TODO.md, THIRD_PARTY.md.
- Only OpenMausBot is copied whole. Other repos (Goose, Rakazo, ...) are NOT copied whole, per spec.
- Not yet built or run (no `pnpm install` done). Build check is in Part 2.

### Part 2a/2b (done)
- Audit written to `docs/phase0-audit.md` (has the full file lists for 2c-2e).
- Sandbox is tiny (0.5 GB RAM, 2 GB disk): CANNOT `pnpm install`/build locally. Verify with GitHub Actions only:
  push, then `gh run list -w verify`, `gh run watch <id>`, `gh run view <id> --log-failed`. Workflow: `.github/workflows/verify.yml`
  (typecheck + build, NODE_OPTIONS heap 6 GB). Use `export COREPACK_ENABLE_DOWNLOAD_PROMPT=0` if running pnpm.
- Git commit identity: `git -c user.name=DeepuExplainsAi -c user.email=deepu@users.noreply.github.com commit`.
- Upstream CI (`ci.yml`) also runs on push and has failed on part2a (not investigated; upstream-specific jobs). Ignore until Part 2f; `verify` is the gate.

### Part 2c (done)
- `server/enterprise.ts` stub keeps hosted-workspace config helpers (refuses OMB_ADMIN_* config, no adapter), `entitled()` always false.
- Removed: enterprise tests, contributors.yml, docker.yml, CLA.md, ci.yml `foss` job, LICENSING.md rewritten.
- `src/components/LicenseExpiryBanner.tsx` still exists (inert); remove in 2e/cleanup.
- Local vitest NOT run (sandbox too small). Run `pnpm test` subset in a CI job when needed; `verify` only does typecheck+build.

### Part 2d-partial (done)
- Kept `companion/` (electron+server import it); phone-relay is off unless OMB_PHONE_RELAY set.
- Upstream `ci.yml` is now workflow_dispatch only; many upstream tests reference deleted dirs (cloud-home.test.ts, docker-image.test.ts, phone-relay.test.ts etc.) and will fail if run: delete or fix them when enabling a test job (Part 9).
- Lockfile was hand-edited (removed cloudflare/control-plane importer); `verify` with --frozen-lockfile passes.

### Part 2e (done, mostly)
- Bulk regex renamed standalone `OpenMausBot|MausBot|SupaMaus` -> `Super Agent` in src/server/electron/shared/companion/skills/packages/scripts/evals (+ locale values). Lookbehind avoids identifiers, paths, URLs.
- Native helper app renamed `Super Agent Speech.app` in code, builder yml, clean.mjs, plist, release.yml.
- Brand name is a placeholder ("Super Agent"): user can change in one pass (grep "Super Agent").

### Part 2f (done)
- `.github/workflows/verify.yml`: jobs `build` (typecheck+vite build) and `boot` (starts server, checks health + edition=oss).
- Live chat test pending the user's key: run `OMB_OPENROUTER_API_KEY=<key> pnpm omb` on a real PC, open the UI, pick an OpenRouter free model. Not verifiable in sandbox/CI.
- Phase 0 step 6 ("one bot chats") therefore stays OPEN until the user confirms.

### Part 3 (done)
- verify.yml now also runs `node scripts/generate-locale.mjs --check` and `node scripts/check-skin-contrast.mjs`.
- Rename changed English strings, so locale hashes were re-recorded (translations already contained the new name). it.json `agentcard.notice` was corrupt upstream; removed (falls back to English).
- Local verify without install: `node scripts/check-skin-contrast.mjs` and `node scripts/generate-locale.mjs --check` run fine in the sandbox.

### Part 4 (done)
- `packages/models/src`: types.ts (ModelProvider, ProviderError, FAILOVER_KINDS), openai-compat.ts, openrouter.ts, localai.ts (loopback only), acp.ts (JSON-RPC stdio client; permission requests go to `onPermission`, no handler = deny), failover.ts (cooldown 5 min, notice event, no switch after text streamed, skip not-signed-in), tests in packages/models/test.
- tsconfig.server.json includes `packages/models/src`; vite.config.ts test include has `packages/models/**/*.test.ts`; verify.yml runs them.
- ACP wire details (initialize params, session/new, session/set_model) follow the ACP spec from memory and upstream core.ts; unverified against live binaries.
- Also removed stale `enterprise/**` and `connector/**` entries from vite test include.

## Notes for next agent
- `third_party/` already holds vendored code (hermes-agent, opencode, puppeteer, ...): licenses listed in THIRD_PARTY.md.
  `third_party/cloudflared`, `hpke-js`, `scrcpy` have no LICENSE file: verify before shipping.
- Upstream has cloud parts to strip in Part 2: `cloudflare/`, `relay/`, `deploy/`, `Dockerfile`, `compose.yaml`,
  Composio broker (`cloudflare/composio-broker`), analytics, cloud computer.

### Part 5 (done)
- `packages/automation`: `playwrightMcpServer(appData)` (pinned MCP entry), `browsersInstalled/installBrowsers` (first-run download to `<appData>/browsers`), `crawl()` static crawler. Tests in `packages/automation/test`.
- Bug found by CI: crawler text included `<title>`; fixed (strip `<head>`).
- Open: Part 5b wiring (above). `npx` needs Node: use Electron's bundled Node.

### Part 6 (done)
- `packages/workflow`: JSON graph, task/approval nodes, conditional edges, retries, file checkpoint; test proves 3 nodes + restart + approval. `webhookAction` for user-run n8n.
- Open: visual editor, register real actions (bots, automation, connectors).

### Part 7 (done)
- `docs/feature-gap.md`; `packages/compute` (queue, cancel, progress, concurrency + free-RAM gate; no hard CPU/RAM caps, not persistent, not wired).

### Part 8 (partly done)
- License audit found real items, all recorded in `scripts/license-exceptions.json` with reasons: OFL fonts, MPL-2.0 native deps (unmodified), EPL elkjs, khroma (MIT per repo).
- **USER DECISION:** `sharp` ships LGPL-3.0 libvips (dynamic, unmodified). Spec allows only permissive licenses. Accept or replace sharp.
- Package workflow fixes: Windows needs `shell` for pnpm (done), Linux needs `rpm` apt package (done). macOS/Windows packaging results: see latest `package` run.
- Packages are unsigned; signing/notarization needs the user's certificates.

### Part 8 package results (before the billing stop)
- Windows `.exe` and macOS `.dmg` packaging: green. Linux AppImage + deb + rpm all built; only the artifact upload glob failed, fixed in part8-10 (not re-run).
- Root cause of Linux failure: install dir changed from `/opt/OpenMausBot` to `/opt/SuperAgent` (productName "Super Agent" has a space; `package:linux*` scripts pass `-c.productName=SuperAgent`). All scripts, AppArmor profile and docs were updated.
- Do NOT re-run `package.yml` often: it burns macOS/Windows minutes. Run it once per release.
- Unsigned builds. Signing needs user certificates.

### Repo is public (license Apache-2.0)
- Made public by the user's request. License stays Apache-2.0: the base (OpenMausBot) is Apache-2.0 and a derivative must keep it (LICENSE + NOTICE are in the repo). History was scanned for secrets: none (only redaction regexes).
- Actions still fail with 0 steps: "recent account payments have failed or your spending limit needs to be increased". Account-level; the user must fix GitHub Settings > Billing & plans (payment method). After that: run `gh workflow run verify.yml`, then `package.yml` once.
- UPDATE 2026-11-23: CI WORKS AGAIN (repo public, free minutes). verify green on 75549da (run 45229823544). Part 9 is unblocked.
- (obsolete) Until CI works, do NOT start Part 9 wiring (no way to typecheck in the 0.5 GB sandbox). Unverified commits since last green verify: part8-10, handoff commits only (workflow glob + docs).
