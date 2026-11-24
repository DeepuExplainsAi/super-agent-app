import { describe, expect, it } from "vitest";
import { ProviderError, type ModelProvider } from "../../packages/models/src/index.ts";
import type { RuntimeEvent } from "../../shared/runtime-events.ts";
import { createFailoverDriver } from "./superagent-failover.ts";

const provider = (id: string, run: () => AsyncIterable<{ type: "text"; text: string } | { type: "done"; provider: string }>, signedIn = true): ModelProvider => ({
  id, status: async () => ({ signedIn }), listModels: async () => [], chat: run,
});
const good = (id: string, text: string) => provider(id, async function* () { yield { type: "text", text }; yield { type: "done", provider: id }; });
const quota = (id: string) => provider(id, async function* () { throw new ProviderError(id, "quota", "out of quota"); });

async function turn(providers: ModelProvider[]) {
  const driver = createFailoverDriver({ providers: () => providers });
  const instance = await driver.create({ instanceId: "i", displayName: undefined, environment: {}, enabled: true, config: { ...driver.defaultConfig(), order: providers.map((p) => p.id) } });
  const events: RuntimeEvent[] = [];
  const finished = new Promise<void>((resolve) => instance.adapter.onEvent((e) => { events.push(e); if (e.type === "turn.completed") resolve(); }));
  await instance.adapter.sendTurn({ threadId: "t", text: "hi" });
  await finished;
  return { events, instance };
}

describe("superagent-failover driver", () => {
  it("answers through the first provider", async () => {
    const { events } = await turn([good("a", "hello")]);
    expect(events.map((e) => e.type)).toEqual(["turn.started", "content.delta", "item.completed", "turn.completed"]);
    expect(events.at(-1)).toMatchObject({ ok: true });
  });
  it("continues on the next provider when the first is out of quota", async () => {
    const { events } = await turn([quota("a"), good("b", "from b")]);
    const done = events.find((e) => e.type === "item.completed") as { text: string };
    expect(done.text).toContain("from b");
    expect(done.text).toContain("a is unavailable");
  });
  it("reports a terminal error when nothing is signed in", async () => {
    const { events, instance } = await turn([good("a", "x")].map((p) => ({ ...p, status: async () => ({ signedIn: false }) })));
    expect(events.some((e) => e.type === "runtime.error")).toBe(true);
    expect(events.at(-1)).toMatchObject({ ok: false });
    expect((await instance.snapshot()).state).toBe("unavailable");
  });
});
