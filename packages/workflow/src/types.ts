/** A workflow is plain JSON, so the editor, the store and the engine share one shape. */
export type WorkflowNode =
  /** Calls a registered action (a bot, an automation tool, a connector, a compute job, a webhook). */
  | { type: "task"; action: string; input?: unknown; retries?: number; saveAs?: string }
  /** Pauses the run until a person approves or rejects. */
  | { type: "approval"; prompt?: string };

/** `when` picks the edge by a value in the run state; an edge without `when` is the default. */
export interface WorkflowEdge {
  from: string;
  to: string;
  when?: { path: string; equals: unknown };
}

export interface WorkflowDef {
  id: string;
  start: string;
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
}

export type RunStatus = "running" | "waiting" | "done" | "failed";

export interface RunRecord {
  runId: string;
  workflowId: string;
  status: RunStatus;
  /** The node to run next (or the approval node being waited on). */
  current: string | null;
  state: Record<string, unknown>;
  history: { node: string; ok: boolean; error?: string }[];
  error?: string;
}

export type Action = (input: unknown, state: Record<string, unknown>) => unknown | Promise<unknown>;
export type Actions = Record<string, Action>;

export interface RunStore {
  load(runId: string): Promise<RunRecord | undefined>;
  save(run: RunRecord): Promise<void>;
}
