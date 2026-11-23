import { describe, expect, it } from "vitest";
import { createFailoverChain, createLocalAi, createOpenRouter, ProviderError, type ChatEvent, type ModelProvider } from "../src/index.ts";
import { kindForAcpError, updateToEvents } from "../src/acp.ts";
import { kindForStatus } from "../src/openai-compat.ts";

const sse = (...lines: string[]) => new Response(new Blob([lines.map((l) => `data: ${l}\n\n`).join("")]).stream(), { status: 200 });
const collect = async (it: AsyncIterable<ChatEvent>) => { const out: ChatEvent[] = []; for await (const e of it) out.push(e); return out; };

function fake(id: string, behaviour: () => AsyncGenerator<ChatEvent>, signedIn = true): ModelProvider {
  return { id, status: async () => ({ signedIn }), listModels: async () => [], chat: behaviour };
}
const ok = (id: string, text: string) => fake(id, async function* () { yield { type: "text", text }; yield { type: "done", provider: id }; });
const failing = (id: string, kind: ProviderError["kind"]) => fake(id, async function* () { throw new ProviderError(id, kind, "boom"); });

describe("openrouter adapter", () => {
  it("streams text and sends the user's key", async () => {
    let seen: Request | undefined;
    const provider = createOpenRouter({
      apiKey: () => "sk-test", defaultModel: "m/free",
      fetch: (async (url: string, init: RequestInit) => { seen = new Request(url, init); return sse('{"choices":[{"delta":{"content":"Hel"}}]}', '{"choices":[{"delta":{"content":"lo"}}]}', "[DONE]"); }) as typeof fetch,
    });
    const events = await collect(provider.chat({ messages: [{ role: "user", content: "hi" }] }));
    expect(events.filter((e) => e.type === "text").map((e) => (e as any).text).join("")).toBe("Hello");
    expect(events.at(-1)).toMatchObject({ type: "done", provider: "openrouter" });
    expect(seen?.headers.get("authorization")).toBe("Bearer sk-test");
    expect(seen?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("lists models from the live endpoint and flags free ones", async () => {
    const provider = createOpenRouter({
      apiKey: () => "k",
      fetch: (async () => Response.json({ data: [{ id: "a", pricing: { prompt: "0", completion: "0" } }, { id: "b", pricing: { prompt: "0.1", completion: "0.1" } }] })) as unknown as typeof fetch,
    });
    expect(await provider.listModels()).toEqual([{ id: "a", name: "a", free: true }, { id: "b", name: "b", free: false }]);
  });

  it("reports not signed in without a key", async () => {
    expect((await createOpenRouter({ apiKey: () => undefined }).status()).signedIn).toBe(false);
  });

  it("maps HTTP failures to failover kinds", async () => {
    expect(kindForStatus(429, "")).toBe("rate_limit");
    expect(kindForStatus(402, "")).toBe("quota");
    expect(kindForStatus(404, "")).toBe("model_removed");
    expect(kindForStatus(503, "")).toBe("unavailable");
    expect(kindForStatus(400, "bad")).toBe("other");
    const provider = createOpenRouter({ apiKey: () => "k", defaultModel: "m", fetch: (async () => new Response("slow down", { status: 429 })) as unknown as typeof fetch });
    await expect(collect(provider.chat({ messages: [] }))).rejects.toMatchObject({ kind: "rate_limit" });
  });
});

describe("localai adapter", () => {
  it("refuses a non-loopback endpoint", () => {
    expect(() => createLocalAi({ baseUrl: "https://example.com/v1" })).toThrow(/loopback/);
    expect(() => createLocalAi({ baseUrl: "http://localhost:11434/v1" })).not.toThrow();
  });
});

describe("acp mapping", () => {
  it("turns agent message chunks into text", () => {
    expect(updateToEvents({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "x" } })).toEqual([{ type: "text", text: "x" }]);
    expect(updateToEvents({ sessionUpdate: "tool_call" })).toEqual([]);
  });
  it("classifies errors", () => {
    expect(kindForAcpError({ message: "usage limit reached" })).toBe("quota");
    expect(kindForAcpError({ message: "Not signed in" })).toBe("auth");
    expect(kindForAcpError({ message: "weird" })).toBe("other");
  });
});

describe("failover chain", () => {
  it("switches on quota, tells the chat, and continues", async () => {
    const chain = createFailoverChain([failing("kiro", "quota"), ok("opencode", "hi")]);
    const events = await collect(chain.chat({ messages: [] }));
    expect(events.map((e) => e.type)).toEqual(["notice", "text", "done"]);
    expect((events[0] as any).text).toContain("kiro");
    expect((events[0] as any).text).toContain("opencode");
  });

  it("puts the failed provider in cooldown and skips it next time", async () => {
    let t = 0, calls = 0;
    const kiro = fake("kiro", async function* () { calls++; throw new ProviderError("kiro", "rate_limit", "x"); });
    const chain = createFailoverChain([kiro, ok("opencode", "a")], { cooldownMs: 1000, now: () => t });
    await collect(chain.chat({ messages: [] }));
    await collect(chain.chat({ messages: [] }));
    expect(calls).toBe(1);
    expect(Object.keys(chain.cooling())).toEqual(["kiro"]);
    t = 2000;
    await collect(chain.chat({ messages: [] }));
    expect(calls).toBe(2);
  });

  it("skips providers that are not signed in", async () => {
    const chain = createFailoverChain([fake("kiro", async function* () { throw new Error("must not run"); }, false), ok("opencode", "ok")]);
    expect((await collect(chain.chat({ messages: [] }))).map((e) => e.type)).toEqual(["text", "done"]);
  });

  it("does not fail over on a user stop or a bad request", async () => {
    for (const kind of ["aborted", "other"] as const) {
      const chain = createFailoverChain([failing("kiro", kind), ok("opencode", "no")]);
      await expect(collect(chain.chat({ messages: [] }))).rejects.toMatchObject({ kind });
    }
  });

  it("does not switch after text was already streamed", async () => {
    const partial = fake("kiro", async function* () { yield { type: "text", text: "half" }; throw new ProviderError("kiro", "timeout", "t"); });
    const chain = createFailoverChain([partial, ok("opencode", "dup")]);
    await expect(collect(chain.chat({ messages: [] }))).rejects.toMatchObject({ kind: "timeout" });
  });

  it("follows a user-set order and explains when nothing is available", async () => {
    const chain = createFailoverChain([ok("kiro", "k"), ok("opencode", "o")]);
    chain.setOrder(["opencode", "kiro"]);
    expect((await collect(chain.chat({ messages: [] })))[0]).toMatchObject({ text: "o" });
    const none = createFailoverChain([fake("kiro", async function* () {}, false)]);
    await expect(collect(none.chat({ messages: [] }))).rejects.toThrow(/No provider is signed in/);
  });
});
