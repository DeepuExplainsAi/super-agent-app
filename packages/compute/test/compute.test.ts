import { describe, expect, it } from "vitest";
import { createJobQueue } from "../src/index.ts";

const gate = () => { let open!: () => void; const wait = new Promise<void>((r) => (open = r)); return { wait, open }; };

describe("job queue", () => {
  it("runs jobs one at a time by default and reports progress and result", async () => {
    const queue = createJobQueue();
    const order: string[] = [];
    const a = queue.add("a", async (ctx) => { order.push("a+"); ctx.progress(0.5, "half"); await Promise.resolve(); order.push("a-"); return 1; });
    const b = queue.add("b", async () => { order.push("b+"); order.push("b-"); return 2; });
    await queue.idle();
    expect(order).toEqual(["a+", "a-", "b+", "b-"]);
    expect(queue.get(a)).toMatchObject({ status: "done", progress: 1, result: 1, message: "half" });
    expect(queue.get(b)).toMatchObject({ status: "done", result: 2 });
  });

  it("respects maxConcurrent, and raising it starts waiting jobs", async () => {
    const queue = createJobQueue({ maxConcurrent: 1 });
    const g = gate();
    queue.add("slow", () => g.wait);
    const second = queue.add("second", async () => "x");
    await new Promise((r) => setTimeout(r, 5));
    expect(queue.get(second)?.status).toBe("queued");
    queue.setLimits({ maxConcurrent: 2 });
    await new Promise((r) => setTimeout(r, 5));
    expect(queue.get(second)?.status).toBe("done");
    g.open();
    await queue.idle();
  });

  it("cancels a running job through its signal and a queued job before it starts", async () => {
    const queue = createJobQueue();
    const running = queue.add("long", (ctx) => new Promise((_, reject) => ctx.signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const queued = queue.add("never", async () => { throw new Error("must not run"); });
    await new Promise((r) => setTimeout(r, 5));
    expect(queue.cancel(running)).toBe(true);
    expect(queue.cancel(queued)).toBe(true);
    await queue.idle();
    expect(queue.get(running)?.status).toBe("cancelled");
    expect(queue.get(queued)?.status).toBe("cancelled");
    expect(queue.cancel(running)).toBe(false);
  });

  it("records a failure without stopping the queue", async () => {
    const queue = createJobQueue();
    const bad = queue.add("bad", async () => { throw new Error("nope"); });
    const good = queue.add("good", async () => "ok");
    await queue.idle();
    expect(queue.get(bad)).toMatchObject({ status: "failed", error: "nope" });
    expect(queue.get(good)?.status).toBe("done");
  });

  it("holds a job while free RAM is below the limit and another job runs", async () => {
    let free = 100;
    const queue = createJobQueue({ maxConcurrent: 2, minFreeMemoryMb: 500 }, () => free);
    const g = gate();
    queue.add("first", () => g.wait); // starts: nothing else running
    const second = queue.add("second", async () => "x");
    await new Promise((r) => setTimeout(r, 5));
    expect(queue.get(second)?.status).toBe("queued");
    free = 1000;
    g.open();
    await queue.idle();
    expect(queue.get(second)?.status).toBe("done");
  });
});
