# Feature gap (Phase 5)

Checked against the repo on 2026-11-23 (file/folder presence, not live behaviour).

| Wanted feature | Already in the base | Action |
|---|---|---|
| Persistent bot memory | `server/box-memory.ts`, `bot-memory-cap.ts`, claude-own-memory | none |
| Routines / scheduled tasks | `server/active-routines-context.ts`, scheduler code across `server/` | none |
| Group chats | `server/group-call.ts`, `group-routing.ts` | none |
| Voice mode (own keys) | `server/speech.ts`, `local-voice.ts`, `fish-speech.ts` | none |
| Local model endpoint (Ollama / LM Studio / OpenAI-compatible) | `server/drivers/ollama.ts`, `openai-compat.ts`; also `packages/models/localai.ts` | none |
| Skills | skill support throughout `server/` and `src/` | none |
| Connectors via local MCP | `server/mcp-servers.ts`, MCP routes | none |
| Coding agents | claude, codex, pi, opencode/kiro (ACP) drivers | none |
| Multi-agent teams | `server/drivers/agents-*` (bots call bots), team tools | none |
| Workflows | missing in base | `packages/workflow` (Part 6) |
| Browser automation | partial (embedded browser) | `packages/automation` (Part 5) |
| Heavy local jobs | missing | `packages/compute` (Part 7) |

## Decisions
- CrewAI, AutoGen, MetaGPT, OpenHands, Aider are Python/other-runtime frameworks. Bundling them adds large runtimes for features the base
  already approximates with bot-to-bot calls and its coding drivers. Not added. Revisit only if the user asks, as a separate sidecar.
- Goose / Hermes / OpenClaw / Rakazo: nothing to copy, nothing missing. No Rakazo code was brought in, so no Rakazo THIRD_PARTY entry.
- Feature flags: not needed for items that already ship. New packages stay unwired (library only) until their wiring part.
