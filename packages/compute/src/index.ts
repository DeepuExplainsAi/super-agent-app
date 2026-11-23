import { freemem } from "node:os";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface JobContext {
  signal: AbortSignal;
  /** Report 0..1 progress and an optional message. */
  progress(fraction: number, message?: string): void;
}

export interface JobInfo {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: unknown;
  error?: string;
}

export interface Limits {
  /** Jobs running at once (CPU limit; default 1). */
  maxConcurrent: number;
  /** A queued job waits while less than this much RAM is free (MB; 0 = no check). */
  minFreeMemoryMb: number;
}

export interface JobQueue {
  add(name: string, run: (ctx: JobContext) => Promise<unknown>): string;
  get(id: string): JobInfo | undefined;
  list(): JobInfo[];
  cancel(id: string): boolean;
  setLimits(limits: Partial<Limits>): void;
  /** Resolves when nothing is queued or running. */
  idle(): Promise<void>;
}

interface Entry {
  info: JobInfo;
  run: (ctx: JobContext) => Promise<unknown>;
  abort: AbortController;
}

/** In-process job runner for the user's own PC. Limits are user-settable at any time. */
export function createJobQueue(initial: Partial<Limits> = {}, freeMemoryMb: () => number = () => freemem() / 1048576): JobQueue {
  const limits: Limits = { maxConcurrent: 1, minFreeMemoryMb: 0, ...initial };
  const jobs = new Map<string, Entry>();
  let running = 0;
  let counter = 0;
  let waiters: (() => void)[] = [];

  const settle = (entry: Entry, status: JobStatus, extra: Partial<JobInfo> = {}) => {
    if (entry.info.status === "cancelled") return;
    Object.assign(entry.info, { status }, extra);
  };

  async function execute(entry: Entry) {
    running++;
    entry.info.status = "running";
    try {
      const result = await entry.run({
        signal: entry.abort.signal,
        progress: (fraction, message) => Object.assign(entry.info, { progress: Math.min(1, Math.max(0, fraction)), ...(message ? { message } : {}) }),
      });
      settle(entry, "done", { progress: 1, result });
    } catch (error) {
      settle(entry, "failed", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      running--;
      pump();
    }
  }

  function pump() {
    for (const entry of jobs.values()) {
      if (running >= limits.maxConcurrent) break;
      if (entry.info.status !== "queued") continue;
      if (limits.minFreeMemoryMb > 0 && freeMemoryMb() < limits.minFreeMemoryMb) {
        // Only start a job into low RAM when nothing else runs, so the queue cannot stall forever on a busy PC.
        if (running > 0) break;
      }
      void execute(entry);
    }
    if (running === 0 && ![...jobs.values()].some((e) => e.info.status === "queued")) {
      waiters.forEach((resolve) => resolve());
      waiters = [];
    }
  }

  return {
    add(name, run) {
      const id = `job-${++counter}`;
      jobs.set(id, { info: { id, name, status: "queued", progress: 0 }, run, abort: new AbortController() });
      queueMicrotask(pump);
      return id;
    },
    get: (id) => jobs.get(id)?.info,
    list: () => [...jobs.values()].map((e) => e.info),
    cancel(id) {
      const entry = jobs.get(id);
      if (!entry || !["queued", "running"].includes(entry.info.status)) return false;
      entry.info.status = "cancelled";
      entry.abort.abort();
      return true;
    },
    setLimits(next) {
      Object.assign(limits, next);
      pump();
    },
    idle: () => (running === 0 && ![...jobs.values()].some((e) => e.info.status === "queued") ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve))),
  };
}
