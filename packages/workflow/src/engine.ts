import type { Actions, RunRecord, RunStore, WorkflowDef, WorkflowEdge } from "./types.ts";

const MAX_STEPS = 1000;

const valueAt = (state: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), state);

function nextNode(def: WorkflowDef, from: string, state: Record<string, unknown>): string | null {
  const edges = def.edges.filter((edge) => edge.from === from);
  const matched = edges.find((edge: WorkflowEdge) => edge.when && Object.is(valueAt(state, edge.when.path), edge.when.equals)) ?? edges.find((edge) => !edge.when);
  return matched?.to ?? null;
}

export interface Engine {
  start(def: WorkflowDef, runId: string, input?: Record<string, unknown>): Promise<RunRecord>;
  /** Continue a run after a restart, or answer an approval it waits on. */
  resume(def: WorkflowDef, runId: string, approval?: { approved: boolean }): Promise<RunRecord>;
}

export function createEngine(options: { actions: Actions; store: RunStore }): Engine {
  const { actions, store } = options;

  async function drive(def: WorkflowDef, run: RunRecord): Promise<RunRecord> {
    for (let steps = 0; run.status === "running" && steps < MAX_STEPS; steps++) {
      if (!run.current) {
        run.status = "done";
        break;
      }
      const node = def.nodes[run.current];
      if (!node) {
        run.status = "failed";
        run.error = `unknown node ${run.current}`;
        break;
      }
      if (node.type === "approval") {
        run.status = "waiting";
        break;
      }
      const action = actions[node.action];
      if (!action) {
        run.status = "failed";
        run.error = `unknown action ${node.action}`;
        break;
      }
      let failure: string | undefined;
      for (let attempt = 0; attempt <= (node.retries ?? 0); attempt++) {
        try {
          run.state[node.saveAs ?? run.current] = await action(node.input, run.state);
          failure = undefined;
          break;
        } catch (error) {
          failure = error instanceof Error ? error.message : String(error);
        }
      }
      run.history.push({ node: run.current, ok: !failure, ...(failure ? { error: failure } : {}) });
      if (failure) {
        run.status = "failed";
        run.error = failure;
      } else {
        run.current = nextNode(def, run.current, run.state);
      }
      await store.save(run);
    }
    await store.save(run);
    return run;
  }

  return {
    start: (def, runId, input = {}) => drive(def, { runId, workflowId: def.id, status: "running", current: def.start, state: { input }, history: [] }),
    async resume(def, runId, approval) {
      const run = await store.load(runId);
      if (!run) throw new Error(`no run ${runId}`);
      if (run.status === "waiting") {
        if (!approval) return run;
        run.state[run.current!] = { approved: approval.approved };
        run.history.push({ node: run.current!, ok: approval.approved });
        run.current = nextNode(def, run.current!, run.state);
        run.status = "running";
      }
      return drive(def, run);
    },
  };
}
