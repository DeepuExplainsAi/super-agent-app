import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
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

  /** Runs one node and returns the next node name (null = the graph ends here). Every step is checkpointed. */
  async function step(def: WorkflowDef, run: RunRecord, name: string): Promise<string | null> {
    const node = def.nodes[name]!;
    if (node.type === "approval") {
      run.status = "waiting";
      await store.save(run);
      return null;
    }
    const action = actions[node.action];
    if (!action) return fail(run, `unknown action ${node.action}`);
    let failure: string | undefined;
    for (let attempt = 0; attempt <= (node.retries ?? 0); attempt++) {
      try {
        run.state[node.saveAs ?? name] = await action(node.input, run.state);
        failure = undefined;
        break;
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }
    }
    run.history.push({ node: name, ok: !failure, ...(failure ? { error: failure } : {}) });
    if (failure) return fail(run, failure);
    const next = nextNode(def, name, run.state);
    if (next && !def.nodes[next]) return fail(run, `unknown node ${next}`);
    run.current = next;
    if (!next) run.status = "done";
    await store.save(run);
    return next;
  }

  async function fail(run: RunRecord, error: string): Promise<null> {
    run.status = "failed";
    run.error = error;
    await store.save(run);
    return null;
  }

  /** LangGraph walks the graph; the run record in `store` is the checkpoint, so a restart re-enters at `run.current`. */
  async function drive(def: WorkflowDef, run: RunRecord): Promise<RunRecord> {
    if (run.status !== "running") return run;
    if (!run.current) {
      run.status = "done";
    } else if (!def.nodes[run.current]) {
      await fail(run, `unknown node ${run.current}`);
    } else {
      // Node names are user data, so the graph is built with loose types; the state channel name cannot clash with them.
      const Flow = Annotation.Root({ _saNext: Annotation<string | null> });
      const graph = new StateGraph(Flow) as any;
      const route = (state: typeof Flow.State) => state._saNext ?? END;
      for (const name of Object.keys(def.nodes)) {
        graph.addNode(name, async () => ({ _saNext: await step(def, run, name) }));
        graph.addConditionalEdges(name, route);
      }
      graph.addConditionalEdges(START, route);
      await graph.compile().invoke({ _saNext: run.current }, { recursionLimit: MAX_STEPS });
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
