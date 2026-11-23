# TODO (mark [x] when done; details in ARCHITECTURE.md section 4)

- [x] Part 1: Copy OpenMausBot into repo, delete enterprise/, add handoff/todo/third-party docs
- [ ] Part 2 (2a audit DONE, 2b baseline build DONE, 2c-2f pending): Phase 0 - audit (`docs/phase0-audit.md`), remove enterprise refs, rename product + remove mascot, strip cloud/telemetry/Composio, confirm build + one bot chats
- [ ] Part 3: Phase 1 - `packages/theme` Grok-style tokens, apply to screens
- [ ] Part 4: Phase 2 - `packages/models` (openrouter, opencode ACP, kiro ACP, localai, failover)
- [ ] Part 5: Phase 3 - `packages/automation` (Playwright MCP, Stagehand, Browser Use, Crawlee/Crawl4AI)
- [ ] Part 6: Phase 4 - `packages/workflow` (LangGraph.js, JSON editor, webhook node)
- [ ] Part 7: Phase 5 - `packages/agents` (feature-flagged; write docs/feature-gap.md first)
- [ ] Part 8: Phase 6 - `packages/compute` job runner
- [ ] Part 9: Phase 7 - GitHub Actions builds (win/mac/linux) + license audit + licenses screen
- [ ] Part 10: Phase 8 - split apps (bot-app, automation-app, workflow-app)

Rule: after each part -> commit, push, update HANDOFF.md, push. Continue without asking.
