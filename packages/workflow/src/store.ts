import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunRecord, RunStore } from "./types.ts";

/** One JSON file per run. Written after every step, so a restart resumes where it stopped. */
export function fileRunStore(dir: string): RunStore {
  const file = (runId: string) => join(dir, `${runId.replace(/[^\w.-]/g, "_")}.json`);
  return {
    async load(runId) {
      try {
        return JSON.parse(await readFile(file(runId), "utf8")) as RunRecord;
      } catch {
        return undefined;
      }
    },
    async save(run) {
      await mkdir(dir, { recursive: true });
      const target = file(run.runId);
      await writeFile(`${target}.tmp`, JSON.stringify(run));
      await rename(`${target}.tmp`, target);
    },
  };
}

export function memoryRunStore(): RunStore {
  const runs = new Map<string, RunRecord>();
  return { load: async (id) => runs.get(id) && structuredClone(runs.get(id)!), save: async (run) => void runs.set(run.runId, structuredClone(run)) };
}
