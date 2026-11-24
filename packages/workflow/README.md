# @super-agent/workflow

Workflow tree as plain JSON: `task` nodes (call a registered action: bot, automation tool, connector, compute job, `webhookAction`),
`approval` nodes (pause for a person), conditional edges (`when: { path, equals }` on run state), per-node `retries`.

Runs on LangGraph.js (`@langchain/langgraph`, MIT): each JSON node becomes a graph node, the edge choice is a conditional edge.
Every step is checkpointed by our own `fileRunStore` (one JSON file per run), so a run resumes after a restart:
`engine.resume(def, runId, { approved })`. The JSON shape is the contract; the editor, store and engine share it.

No n8n code; `webhookAction` only POSTs to a user-run URL. Test: `pnpm vitest run packages/workflow`.
