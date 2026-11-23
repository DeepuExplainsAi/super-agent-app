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
| Part 1: copy OpenMausBot, delete enterprise/ | DONE (see log) |
| Part 2: Phase 0 steps 1,4,5,6 (audit, rename, remove cloud, build) | NEXT |

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

## Notes for next agent
- `third_party/` already holds vendored code (hermes-agent, opencode, puppeteer, ...): licenses listed in THIRD_PARTY.md.
  `third_party/cloudflared`, `hpke-js`, `scrcpy` have no LICENSE file: verify before shipping.
- Upstream has cloud parts to strip in Part 2: `cloudflare/`, `relay/`, `deploy/`, `Dockerfile`, `compose.yaml`,
  Composio broker (`cloudflare/composio-broker`), analytics, cloud computer.
