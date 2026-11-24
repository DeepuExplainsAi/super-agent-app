import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

function setup(providers: ModelProvider[] = [], withNpx = true) {
  let servers: Record<string, unknown> = {};
  const dataDir = mkdtempSync(join(tmpdir(), "sa-"));
  const bin = mkdtempSync(join(tmpdir(), "sa-bin-"));
  if (withNpx) writeFileSync(join(bin, "npx"), "");
  const sa = createSuperAgent({ dataDir, env: { PATH: bin }, mcpServers: () => servers, persistMcpServers: (next) => { servers = next; }, openrouterKey: () => undefined, providers });
  const call = (method: string, path: string, body?: unknown, auth: RequestAuth = owner) => callRoute(sa.routes, { method, path, body, auth });
  return { call, servers: () => servers };
}

describe("super agent routes", () => {
  it("refuses a non-owner", async () => {
    expect((await setup().call("GET", "/api/sa/packages", undefined, phone)).status).toBe(403);
  });

  it("runs a team only after the flag is turned on", async () => {
    const t = setup([fake("kiro", true, "ok")]);
    const roles = [{ name: "A", instructions: "Help." }];
    expect((await t.call("POST", "/api/sa/agents/team", { task: "x", roles })).status).toBe(400);
    expect((await t.call("PUT", "/api/sa/agents", { enabled: true })).body.enabled).toBe(true);
    const reply = await t.call("POST", "/api/sa/agents/team", { task: "x", roles });
    expect(reply.body).toMatchObject({ answer: "ok", transcript: [{ role: "A", text: "ok" }] });
    expect((await t.call("POST", "/api/sa/agents/team", { task: "x", roles: [] })).status).toBe(400);
  });

  it("lists package manifests", async () => {
    const reply = await setup().call("GET", "/api/sa/packages");
    expect((reply.body.packages as { name: string }[]).map((p) => p.name)).toContain("@super-agent/automation");
  });

  it("refuses to enable Playwright without npx", async () => {
    const t = setup([], false);
    expect((await t.call("PUT", "/api/sa/automation/playwright", { enabled: true })).status).toBe(409);
    expect(t.servers().playwright).toBeUndefined();
    expect((await t.call("GET", "/api/sa/automation")).body.npxAvailable).toBe(false);
  });

  it("enables Playwright without npx when the app ships its own copy", async () => {
    const resources = mkdtempSync(join(tmpdir(), "sa-res-"));
    for (const file of ["@playwright/mcp/cli.js", "playwright-core/cli.js"]) {
      mkdirSync(join(resources, "playwright-mcp", "node_modules", file, ".."), { recursive: true });
      writeFileSync(join(resources, "playwright-mcp", "node_modules", file), "");
    }
    let servers: Record<string, unknown> = {};
    const sa = createSuperAgent({ dataDir: mkdtempSync(join(tmpdir(), "sa-")), env: { PATH: "", OMB_RESOURCES_PATH: resources }, mcpServers: () => servers, persistMcpServers: (next) => { servers = next; }, openrouterKey: () => undefined, providers: [] });
    expect((await callRoute(sa.routes, { method: "PUT", path: "/api/sa/automation/playwright", body: { enabled: true }, auth: owner })).status).toBe(200);
    expect(servers.playwright).toMatchObject({ command: process.execPath, enabled: true });
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

  it("an app profile without a package answers 404 for its routes", async () => {
    const sa = createSuperAgent({ dataDir: mkdtempSync(join(tmpdir(), "sa-")), mcpServers: () => ({}), persistMcpServers: () => {}, openrouterKey: () => undefined, providers: [], env: { SA_APP: "bot-app" } });
    const call = (path: string) => callRoute(sa.routes, { method: "GET", path, auth: owner });
    expect((await call("/api/sa/workflows")).status).toBe(404);
    expect((await call("/api/sa/automation")).status).toBe(404);
    expect((await call("/api/sa/models")).status).toBe(200);
    const names = ((await call("/api/sa/packages")).body.packages as { name: string }[]).map((p) => p.name);
    expect(names).not.toContain("@super-agent/workflow");
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
