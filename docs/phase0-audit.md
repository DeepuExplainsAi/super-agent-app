# Phase 0 audit (base: OpenMausBot @ 9066604)

Stack: Electron shell (`electron/`), Node server (`server/`), React+Vite UI (`src/`), shared TS (`shared/`).
Node >= 24, pnpm 10.33.0. No Postgres/Docker needed by core (Docker only for optional container computers).

## Folders
| Folder | Role | Phase 0 action |
|---|---|---|
| electron/ | desktop shell, updater, analytics, cloud account, managed Composio | rename, remove cloud/analytics/updater-to-upstream |
| server/ | harness (index.ts, drivers, brand, enterprise, boat, cloud-home, phone-relay, composio) | remove enterprise + cloud modules |
| src/ | UI, mascot components/assets, analytics | rename, remove mascot, remove posthog |
| shared/ | wire types, settings | keep, rename strings |
| companion/ | phone companion client | remove (needs relay) |
| connector/, relay/, cloudflare/, deploy/, Dockerfile, compose.yaml | hosted infra | delete |
| packages/phone-protocol | phone protocol | remove with companion if unused |
| apps/docs | docs site | rename or delete |
| skills/ | agent skills | rename openmausbot-docs, drop cloud ones |
| third_party/ | vendored code | keep, see THIRD_PARTY.md |

## enterprise/ references (folder not copied)
- Core: `server/enterprise.ts` (+ importers: brand.ts, spend.ts, index.ts, cli.ts, cloud-home.ts, hosted-models.ts,
  hosted-slack.ts, routes/threads.ts, routes/status.ts, routes/mcp-servers.ts, drivers/acp/opencode-go.ts, drivers/codex.ts).
- Plan: make `entitled()` return false / edition "oss", then remove branches, `enterprise` tier in `server/burst/limits.ts`.
- Build/CI: tsconfig.server.json, scripts/bundle-server.mjs, build-npm-package.mjs, smoke-packaged-server.mjs, control-omb.ts, ci-scope.mjs,
  workflows ci.yml (OSS job), docker.yml, npm-package.yml, contributors.yml, CODEOWNERS.
- Docs: LICENSING.md, CLA.md, CONTRIBUTING.md, docs/verification/enterprise-license.md, locales en/it.

## Cloud / telemetry to remove
| What | Where |
|---|---|
| Composio managed broker | electron/managed-composio.mjs, server/composio*.ts, cloudflare/composio-broker |
| PostHog | src/lib/analytics*.ts, electron/launch-analytics.mjs, dep posthog-js |
| Auto-update to upstream | electron-builder.yml `publish`, electron/updater*.mjs |
| Account/control plane | electron/companion-account-service.mjs, control-plane-client.mjs, server/account-signin.ts |
| Cloud app/feedback | electron/cloud-account.mjs, server/devs-report-send.ts, src/lib/whats-new.ts, app-links.ts, onboarding.ts |
| Boat cloud computer | server/boat*.ts, included-services.ts |
| Cloud home | server/cloud-home*.ts |
| Phone relay | server/phone-relay.ts, relay/, companion/ |
| Hosted models/Slack | server/hosted-models.ts, hosted-slack.ts |
| Remote catalogs/announcements | env kill switches OMB_DISABLE_MODEL_MANIFEST_FETCH, _MODEL_CATALOG_FETCH, _ANNOUNCEMENTS |
| Cloud backups | unverified; check backup routes in server/index.ts (~11939) |

## Naming
package.json name `openmausbot`; electron-builder.yml appId/productName/artifactName/protocol/shortcut/executable;
index.html title; server/brand.ts (DEFAULT_BRAND, PRODUCT_NAME). Mascot: src/assets/mausbot-steel, bubblav, CursorAvatar,
CarvedAvatar, MausBotWelcome, MausBotCustomize, StackedMauses, MascotFaceColorPicker, mascot-motion/clock, mascot-preview, gen-*-bodies scripts, root *-preview.html.
Env prefix `OMB_*` is everywhere (~1000 refs): keep internally, document it.

## Build / test / API-key chat
`pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm dev`, `pnpm dev:server`, `pnpm dev:desktop`, `pnpm package:linux:dir`.
API key: `.env.example` (`OMB_OPENROUTER_API_KEY`, `OMB_OPENAI_API_KEY`, ...); drivers in `server/drivers/openai-compat.ts`; fleets in `server/instance-fleets.ts`.

## Plan (Part 2 sub-steps, each committed)
2a audit (this file) -> 2b install + baseline build -> 2c enterprise removal -> 2d cloud/telemetry removal
-> 2e rename + mascot removal -> 2f final build + one API-key chat check.
