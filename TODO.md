# TODO (mark [x] when done; details in ARCHITECTURE.md section 4)

- [x] Part 1: Copy OpenMausBot into repo, delete enterprise/, add handoff/todo/third-party docs
- [x] Part 2: Phase 0 done in CI (audit, enterprise removed, telemetry/updater/hosted infra removed, renamed to Super Agent, build+boot green). Open: live API-key chat check by user; leftover env-gated cloud modules (server/boat*, cloud-home*, phone-relay, hosted-*)
- [x] Part 3: Phase 1 - packages/theme Agent skin (hex cleanup + Lucide swap left as polish)
- [x] Part 4: Phase 2 - packages/models library done (wiring into server = Part 4b, pending)
- [x] Part 5: Phase 3 - `packages/automation` done as a library (Playwright MCP entry, browser first-run install, static crawler). Wiring + Stagehand/Crawlee/Browser Use pending (Part 5b)
- [x] Part 6: Phase 4 `packages/workflow` on LangGraph.js (done)
- [x] Part 7: Phase 5 `packages/agents` team runner (flagged) + gap note
- [ ] Part 8: Phase 6 - `packages/compute` job runner
- [ ] Part 9: Phase 7 - GitHub Actions builds (win/mac/linux) + license audit + licenses screen
- [ ] Part 10: Phase 8 - split apps (bot-app, automation-app, workflow-app)

Rule: after each part -> commit, push, update HANDOFF.md, push. Continue without asking.

- [x] Part 6: Phase 4 `packages/workflow` library (engine, approval, retries, restart-safe). UI editor + real actions pending (6b)
- [x] Part 7: Phase 5 gap note (`docs/feature-gap.md`: base already has memory/routines/groups/voice/local models) + Phase 6 `packages/compute` library
- [~] (BLOCKED: GitHub billing) Part 8: Phase 7: license audit (done, green), package matrix workflow `package.yml` (running; see HANDOFF), licenses page generator (done)
- [~] Part 5b: Crawlee DONE, Stagehand library DONE (not live-tested), Playwright MCP bundled DONE
