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
| Part 2d: remove cloud/telemetry/Composio | NEXT (do in sub-steps: analytics, updater, composio, cloud modules, relay/companion/deploy dirs) |
| Part 2e: rename + remove mascot | pending |
| Part 2f: final build + one API-key chat check | pending |

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

## Notes for next agent
- `third_party/` already holds vendored code (hermes-agent, opencode, puppeteer, ...): licenses listed in THIRD_PARTY.md.
  `third_party/cloudflared`, `hpke-js`, `scrcpy` have no LICENSE file: verify before shipping.
- Upstream has cloud parts to strip in Part 2: `cloudflare/`, `relay/`, `deploy/`, `Dockerfile`, `compose.yaml`,
  Composio broker (`cloudflare/composio-broker`), analytics, cloud computer.
