# HANDOFF (read this first, update after every part)

Repo: https://github.com/DeepuExplainsAi/super-agent-app (private)
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
| Part 2f: final build + boot smoke + API-key chat check | NEXT: add CI job that boots server (node --experimental-strip-types server/index.ts), curl /api/health; then document how user tests a chat with OMB_OPENROUTER_API_KEY. Then go to Part 3 (theme). |

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

## Notes for next agent
- `third_party/` already holds vendored code (hermes-agent, opencode, puppeteer, ...): licenses listed in THIRD_PARTY.md.
  `third_party/cloudflared`, `hpke-js`, `scrcpy` have no LICENSE file: verify before shipping.
- Upstream has cloud parts to strip in Part 2: `cloudflare/`, `relay/`, `deploy/`, `Dockerfile`, `compose.yaml`,
  Composio broker (`cloudflare/composio-broker`), analytics, cloud computer.
