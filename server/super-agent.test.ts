import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ModelProvider } from "../packages/models/src/index.ts";
import type { RequestAuth } from "./request-auth.ts";
import { callRoute } from "./routes/call-route.ts";
import { createSuperAgent } from "./super-agent.ts";

const owner: RequestAuth = { kind: "loopback", scopes: ["admin", "client"] };
const phone: RequestAuth = { kind: "loopback", scopes: ["client"], trust: "service" };

const fake = (id: string, signedIn: boolean, text: string): ModelProvider => ({
  id, status: async () => ({ signedIn }), listModels: async () => [],
  async *chat() { yield { type: "text", text }; yield { type: "done", provider: id }; },
});

function setup(providers: ModelProvider[] = []) {
  let servers: Record<string, unknown> = {};
  const dataDir = mkdtempSync(join(tmpdir(), "sa-"));
  const sa = createSuperAgent({ dataDir, mcpServers: () => servers, persistMcpServers: (next) => { servers = next; }, openrouterKey: () => undefined, providers });
  const call = (method: string, path: string, body?: unknown, auth: RequestAuth = owner) => callRoute(sa.routes, { method, path, body, auth });
  return { call, servers: () => servers };
}

describe("super agent routes", () => {
  it("refuses a non-owner", async () => {
    expect((await setup().call("GET", "/api/sa/packages", undefined, phone)).status).toBe(403);
  });

  it("lists package manifests", async () => {
    const reply = await setup().call("GET", "/api/sa/packages");
    expect((reply.body.packages as { name: string }[]).map((p) => p.name)).toContain("@super-agent/automation");
  });

  it("adds and removes the Playwright MCP server", async () => {
    const { call, servers } = setup();
    await call("PUT", "/api/sa/automation/playwright", { enabled: true });
    expect(servers().playwright).toMatchObject({ command: "npx", enabled: true });
    expect(JSON.stringify(servers().playwright)).toContain("@playwright/mcp@");
    await call("PUT", "/api/sa/automation/playwright", { enabled: false });
    expect(servers().playwright).toBeUndefined();
  });

  it("runs a 3-node workflow with an approval and survives a new instance (restart)", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "sa-"));
    const make = () => createSuperAgent({ dataDir, mcpServers: () => ({}), persistMcpServers: () => {}, openrouterKey: () => undefined, providers: [fake("kiro", true, "hello")] });
    const def = {
      id: "demo", start: "ask",
      nodes: { ask: { type: "task", action: "model", input: { prompt: "hi" } }, ok: { type: "approval" }, done: { type: "task", action: "model", input: { prompt: "bye" }, saveAs: "final" } },
      edges: [{ from: "ask", to: "ok" }, { from: "ok", to: "done" }],
    };
    const first = make();
    const call = (sa: ReturnType<typeof make>, method: string, path: string, body?: unknown) => callRoute(sa.routes, { method, path, body, auth: owner });
    expect((await call(first, "PUT", "/api/sa/workflows/demo", def)).status).toBe(200);
    const started = await call(first, "POST", "/api/sa/workflows/demo/run", {});
    expect(started.body).toMatchObject({ status: "waiting", current: "ok" });
    const second = make();
    const resumed = await call(second, "POST", `/api/sa/runs/${started.body.runId}/resume`, { approved: true });
    expect(resumed.body).toMatchObject({ status: "done" });
    expect((resumed.body.state as { final: { text: string } }).final.text).toBe("hello");
  });

  it("rejects a malformed workflow", async () => {
    expect((await setup().call("PUT", "/api/sa/workflows/x", { id: "x" })).status).toBe(400);
  });

  it("fails over to the next provider and persists the order", async () => {
    const { call } = setup([fake("kiro", false, "no"), fake("opencode", true, "from opencode")]);
    const reply = await call("POST", "/api/sa/models/chat", { messages: [{ role: "user", content: "hi" }] });
    expect(reply.body).toMatchObject({ text: "from opencode", provider: "opencode" });
    expect((await call("PUT", "/api/sa/models/order", { order: ["nope"] })).status).toBe(400);
    expect((await call("PUT", "/api/sa/models/order", { order: ["opencode", "kiro"] })).body).toEqual({ order: ["opencode", "kiro"] });
  });

  it("queues, reports and cancels a crawl job with limits", async () => {
    const { call } = setup();
    expect((await call("POST", "/api/sa/crawl", { url: "file:///etc/passwd" })).status).toBe(400);
    expect((await call("PUT", "/api/sa/jobs/limits", { maxConcurrent: 2 })).status).toBe(200);
    expect((await call("GET", "/api/sa/jobs")).body).toHaveProperty("jobs");
  });
});
