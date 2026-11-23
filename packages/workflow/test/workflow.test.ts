import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine, fileRunStore, type WorkflowDef } from "../src/index.ts";

const threeNodes: WorkflowDef = {
  id: "three",
  start: "fetch",
  nodes: {
    fetch: { type: "task", action: "fetch" },
    approve: { type: "approval", prompt: "Send it?" },
    send: { type: "task", action: "send", input: "mail" },
  },
  edges: [{ from: "fetch", to: "approve" }, { from: "approve", to: "send", when: { path: "approve.approved", equals: true } }],
};

describe("workflow engine", () => {
  it("runs 3 nodes end to end and survives a restart while waiting for approval", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-"));
    const sent: unknown[] = [];
    const actions = { fetch: () => "data", send: (input: unknown, state: Record<string, unknown>) => (sent.push([input, state.fetch]), "sent") };

    const first = await createEngine({ actions, store: fileRunStore(dir) }).start(threeNodes, "r1");
    expect(first.status).toBe("waiting");
    expect(sent).toEqual([]);

    // "restart": a brand new engine and store over the same folder
    const second = createEngine({ actions, store: fileRunStore(dir) });
    const done = await second.resume(threeNodes, "r1", { approved: true });
    expect(done.status).toBe("done");
    expect(sent).toEqual([["mail", "data"]]);
    expect(done.history.map((h) => h.node)).toEqual(["fetch", "approve", "send"]);
  });

  it("ends when approval is rejected (no matching edge)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-"));
    const engine = createEngine({ actions: { fetch: () => 1, send: () => { throw new Error("must not run"); } }, store: fileRunStore(dir) });
    await engine.start(threeNodes, "r2");
    expect((await engine.resume(threeNodes, "r2", { approved: false })).status).toBe("done");
  });

  it("retries a failing task, then fails the run with the error", async () => {
    let calls = 0;
    const def: WorkflowDef = { id: "r", start: "a", nodes: { a: { type: "task", action: "flaky", retries: 2 } }, edges: [] };
    const store = fileRunStore(mkdtempSync(join(tmpdir(), "wf-")));
    const ok = await createEngine({ actions: { flaky: () => { if (++calls < 3) throw new Error("boom"); return "ok"; } }, store }).start(def, "r3");
    expect(ok.status).toBe("done");
    expect(calls).toBe(3);
    const bad = await createEngine({ actions: { flaky: () => { throw new Error("boom"); } }, store }).start(def, "r4");
    expect(bad).toMatchObject({ status: "failed", error: "boom" });
  });

  it("branches on a value in the state", async () => {
    const def: WorkflowDef = {
      id: "b", start: "check",
      nodes: { check: { type: "task", action: "check" }, big: { type: "task", action: "big" }, small: { type: "task", action: "small" } },
      edges: [{ from: "check", to: "big", when: { path: "check.size", equals: "big" } }, { from: "check", to: "small" }],
    };
    const ran: string[] = [];
    const actions = { check: () => ({ size: "big" }), big: () => ran.push("big"), small: () => ran.push("small") };
    await createEngine({ actions, store: fileRunStore(mkdtempSync(join(tmpdir(), "wf-"))) }).start(def, "r5");
    expect(ran).toEqual(["big"]);
  });
});
