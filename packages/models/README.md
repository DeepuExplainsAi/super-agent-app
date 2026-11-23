# @super-agent/models

One `ModelProvider` interface (`status`, `listModels`, `chat` streaming, optional `usage`), four adapters, and a failover chain.

| Adapter | Transport | Auth (never stored here) |
|---|---|---|
| `createOpenRouter` | HTTPS, OpenAI-compatible | user's own key via `apiKey()` callback |
| `createOpenCode` | spawns the user's `opencode acp` (JSON-RPC stdio) | user's own `opencode` login |
| `createKiro` | spawns the user's `kiro-cli acp` | user runs `kiro-cli login` (Kiro is proprietary: driven, never bundled) |
| `createLocalAi` | loopback HTTP (LocalAI / Ollama / LM Studio) | none |

`createFailoverChain(providers, { order })`: default order kiro -> opencode -> openrouter -> localai. On quota / rate limit /
removed model / timeout the provider cools down (5 min), the chat gets a `notice` event, and the next provider continues.
No switch after text has streamed, and none on a user stop or a bad request. Providers that are not signed in are skipped.

ACP rules implemented: initialize (capabilities read from the server), session/new, session/prompt, streamed `session/update`,
`session/request_permission` -> `onPermission` approval card (no handler = deny, never auto-approve), `session/cancel` on abort, idle close.
Model lists are fetched at runtime; no model names are hard-coded.

Test: `pnpm exec vitest run packages/models`. Keys: keep in the OS keychain / the app's encrypted store and pass via `apiKey()`; never in git or logs.
