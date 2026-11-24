# @super-agent/agents

`runTeam({ task, roles, lead, say, rounds })`: roles take turns on one shared transcript, the lead writes the final answer.
Own TypeScript code (the idea follows AutoGen / CrewAI group chats; no code copied, no Python runtime, no extra dependency).
`say` is any model call: in the app it is the failover chain (Kiro -> OpenCode -> OpenRouter -> LocalAI).

Feature flag: off by default. Turn on with `PUT /api/sa/agents { "enabled": true }`. Use: `POST /api/sa/agents/team { task, roles, lead?, rounds? }`,
or the workflow action `team`. Test: `pnpm vitest run packages/agents`.
Not included: CrewAI, MetaGPT, OpenHands, Aider (other runtimes; see docs/feature-gap.md).
