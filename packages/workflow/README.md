# @super-agent/workflow

Workflow tree as plain JSON: `task` nodes (call a registered action: bot, automation tool, connector, compute job, `webhookAction`),
`approval` nodes (pause for a person), conditional edges (`when: { path, equals }` on run state), per-node `retries`.
Every step is checkpointed (`fileRunStore`), so a run resumes after a restart: `engine.resume(def, runId, { approved })`.

Deviation from spec: no LangGraph. Same concepts in ~100 lines with no dependency (lockfile edits cannot be done in the small
sandbox). Can be swapped later: the JSON shape is the contract. No n8n code; `webhookAction` only POSTs to a user-run URL.
Open: visual editor in the UI (Part 6b), registering real actions from bots/tools.
