import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { existsSync } from "node:fs";
import { runTeam, type Role } from "../packages/agents/src/index.ts";
import { browsersInstalled, bundledRuntime, crawlWithCrawlee as crawl, installBrowsers, playwrightMcpServer } from "../packages/automation/src/index.ts";
import { createJobQueue, type JobQueue } from "../packages/compute/src/index.ts";
import {
  createFailoverChain, createKiro, createLocalAi, createOpenCode, createOpenRouter, DEFAULT_ORDER, ProviderError,
  type ChatMessage, type ModelProvider,
} from "../packages/models/src/index.ts";
import { createEngine, fileRunStore, webhookAction, type Actions, type WorkflowDef } from "../packages/workflow/src/index.ts";
import { ownerOrAdmin } from "./request-auth.ts";
import { loadedPackages } from "./sa-packages.ts";
import { PASS, type RouteHandler } from "./routes/table.ts";

export interface SuperAgentDeps {
  dataDir: string;
  mcpServers(): Record<string, unknown>;
  persistMcpServers(next: Record<string, unknown>): void;
  openrouterKey(): string | undefined;
  /** Test seam: replaces the real providers. */
  providers?: ModelProvider[];
  /** Test seam: the environment that holds SA_APP. */
  env?: NodeJS.ProcessEnv;
}

const ID = /^[\w-]{1,64}$/;

/** The Playwright MCP runs from the bundled copy (packaged app); a dev checkout falls back to npx and needs Node on PATH. */
const npxOnPath = (env: NodeJS.ProcessEnv) =>
  Boolean(bundledRuntime(env)) || (env.PATH ?? "").split(delimiter).some((dir) => dir && ["npx", "npx.cmd"].some((name) => existsSync(join(dir, name))));
const SETTINGS_FILE = "super-agent.json";

interface Settings { order: string[]; localaiUrl?: string; agentsEnabled?: boolean }

/** Everything under /api/sa: package list, browser setup, jobs, workflows, model failover. Owner/admin only. */
export function createSuperAgent(deps: SuperAgentDeps) {
  const jobs: JobQueue = createJobQueue();
  const dir = (name: string) => join(deps.dataDir, "super-agent", name);
  const runs = fileRunStore(dir("runs"));
  const progress = new Map<string, string[]>();
  let settings: Settings = { order: [...DEFAULT_ORDER] };
  const loaded = readFile(dir(SETTINGS_FILE), "utf8").then((text) => { settings = { ...settings, ...JSON.parse(text) }; }, () => {});
  const saveSettings = async () => { await mkdir(dir(""), { recursive: true }); await writeFile(dir(SETTINGS_FILE), JSON.stringify(settings)); };

  const providers = (): ModelProvider[] => deps.providers ?? [
    createKiro(), createOpenCode(), createOpenRouter({ apiKey: deps.openrouterKey }),
    createLocalAi(settings.localaiUrl ? { baseUrl: settings.localaiUrl } : {}),
  ];
  const chain = () => createFailoverChain(providers(), { order: settings.order });

  async function chat(messages: ChatMessage[], model?: string): Promise<{ text: string; provider?: string; notices: string[] }> {
    let text = "", provider: string | undefined; const notices: string[] = [];
    for await (const event of chain().chat({ messages, ...(model ? { model } : {}), timeoutMs: 120_000 })) {
      if (event.type === "text") text += event.text;
      else if (event.type === "notice") notices.push(event.text);
      else provider = event.provider;
    }
    return { text, ...(provider ? { provider } : {}), notices };
  }

  const team = (input: { task?: unknown; roles?: unknown; lead?: unknown; rounds?: unknown }) => {
    if (!settings.agentsEnabled) throw new Error("Multi-agent teams are off. Turn them on in Settings > Automation & models.");
    const isRole = (value: unknown): value is Role => Boolean(value) && typeof (value as Role).name === "string" && typeof (value as Role).instructions === "string";
    if (typeof input.task !== "string" || !input.task.trim()) throw new Error("task required.");
    if (!Array.isArray(input.roles) || !input.roles.length || input.roles.length > 8 || !input.roles.every(isRole)) throw new Error("roles: 1 to 8 items of { name, instructions }.");
    const lead = isRole(input.lead) ? input.lead : { name: "Lead", instructions: "Combine the team's work into one clear answer." };
    const say = async (system: string, transcript: string) => (await chat([{ role: "system", content: system }, { role: "user", content: transcript }])).text;
    return runTeam({ task: input.task, roles: input.roles, lead, say, ...(typeof input.rounds === "number" ? { rounds: input.rounds } : {}) });
  };

  const actions: Actions = {
    team: async (input) => team((input ?? {}) as Parameters<typeof team>[0]),
    webhook: webhookAction,
    crawl: async (input) => { const { url, maxPages } = input as { url: string; maxPages?: number }; return crawl(url, { maxPages: maxPages ?? 5 }); },
    model: async (input) => chat([{ role: "user", content: String((input as { prompt?: unknown })?.prompt ?? "") }]),
  };
  const engine = createEngine({ actions, store: runs });

  const readDef = async (id: string): Promise<WorkflowDef | undefined> => {
    try { return JSON.parse(await readFile(join(dir("workflows"), `${id}.json`), "utf8")) as WorkflowDef; } catch { return undefined; }
  };
  const validDef = (value: unknown): value is WorkflowDef => {
    const def = value as WorkflowDef | null;
    return Boolean(def && typeof def.id === "string" && ID.test(def.id) && typeof def.start === "string" && def.nodes && typeof def.nodes === "object" && def.nodes[def.start] && Array.isArray(def.edges));
  };

  const routes: RouteHandler = async ({ res, path, method, auth, json, readBody, req }) => {
    if (!path.startsWith("/api/sa/")) return PASS;
    if (!ownerOrAdmin(auth)) return json(res, 403, { error: "Owner only." });
    await loaded;
    const loadedNames = new Set(loadedPackages(deps.env).map((m) => m.name));
    const needs = (name: string) => loadedNames.has(`@super-agent/${name}`);
    const group = /^\/api\/sa\/(automation|crawl|jobs|workflows|runs|models|agents)/.exec(path)?.[1];
    const owner = group && { automation: "automation", crawl: "automation", jobs: "compute", workflows: "workflow", runs: "workflow", models: "models", agents: "agents" }[group]!;
    if (owner && !needs(owner)) return json(res, 404, { error: "This app does not include that package." });
    const body = async () => (await readBody(req)) ?? {};

    if (path === "/api/sa/packages" && method === "GET") return json(res, 200, { packages: loadedPackages(deps.env) });

    if (path === "/api/sa/automation" && method === "GET") {
      return json(res, 200, { browsersInstalled: browsersInstalled(deps.dataDir), playwrightEnabled: "playwright" in deps.mcpServers(), npxAvailable: npxOnPath(deps.env ?? process.env), install: progress.get("install") ?? [] });
    }
    if (path === "/api/sa/automation/install-browsers" && method === "POST") {
      const lines: string[] = []; progress.set("install", lines);
      const id = jobs.add("Install browsers", async (ctx) => { await installBrowsers(deps.dataDir, ({ line }) => { lines.push(line); ctx.progress(0.5, line); }, "chromium", deps.env ?? process.env); });
      return json(res, 202, { job: id });
    }
    if (path === "/api/sa/automation/playwright" && method === "PUT") {
      const { enabled } = await body() as { enabled?: unknown };
      const next = { ...deps.mcpServers() };
      if (enabled === true && !npxOnPath(deps.env ?? process.env)) return json(res, 409, { error: "Playwright tools start through npx. Install Node.js (nodejs.org), then try again." });
      if (enabled === true) next.playwright = { ...playwrightMcpServer(deps.dataDir, { headless: false, runtimeEnv: deps.env ?? process.env }), enabled: true };
      else delete next.playwright;
      deps.persistMcpServers(next);
      return json(res, 200, { playwrightEnabled: enabled === true });
    }
    if (path === "/api/sa/crawl" && method === "POST") {
      const { url, maxPages } = await body() as { url?: unknown; maxPages?: unknown };
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return json(res, 400, { error: "url must start with http:// or https://" });
      const id = jobs.add(`Crawl ${url}`, (ctx) => crawl(url, { maxPages: Math.min(Number(maxPages) || 5, 50) }).then((pages) => { ctx.progress(1); return pages; }));
      return json(res, 202, { job: id });
    }

    if (path === "/api/sa/jobs" && method === "GET") return json(res, 200, { jobs: jobs.list() });
    const job = /^\/api\/sa\/jobs\/([\w-]+)(\/cancel)?$/.exec(path);
    if (job && method === "GET" && !job[2]) { const info = jobs.get(job[1]!); return info ? json(res, 200, info) : json(res, 404, { error: "No such job." }); }
    if (job && method === "POST" && job[2]) return jobs.cancel(job[1]!) ? json(res, 200, { ok: true }) : json(res, 404, { error: "No such running job." });
    if (path === "/api/sa/jobs/limits" && method === "PUT") {
      const { maxConcurrent, minFreeMemoryMb } = await body() as Record<string, unknown>;
      jobs.setLimits({
        ...(Number.isInteger(maxConcurrent) && (maxConcurrent as number) >= 1 && (maxConcurrent as number) <= 16 ? { maxConcurrent: maxConcurrent as number } : {}),
        ...(typeof minFreeMemoryMb === "number" && minFreeMemoryMb >= 0 ? { minFreeMemoryMb } : {}),
      });
      return json(res, 200, { ok: true });
    }

    if (path === "/api/sa/workflows" && method === "GET") {
      const files = await readdir(dir("workflows")).catch(() => [] as string[]);
      const defs = await Promise.all(files.filter((f) => f.endsWith(".json")).map((f) => readDef(f.slice(0, -5))));
      return json(res, 200, { workflows: defs.filter(Boolean), actions: Object.keys(actions) });
    }
    const flow = /^\/api\/sa\/workflows\/([\w-]+)(\/run)?$/.exec(path);
    if (flow && method === "PUT" && !flow[2]) {
      const def = await body();
      if (!validDef(def) || def.id !== flow[1]) return json(res, 400, { error: "Invalid workflow: need id (matching the path), start, nodes and edges." });
      await mkdir(dir("workflows"), { recursive: true });
      await writeFile(join(dir("workflows"), `${def.id}.json`), JSON.stringify(def));
      return json(res, 200, def);
    }
    if (flow && method === "POST" && flow[2]) {
      const def = await readDef(flow[1]!);
      if (!def) return json(res, 404, { error: "No such workflow." });
      const runId = `${def.id}-${Date.now().toString(36)}`;
      return json(res, 200, await engine.start(def, runId, ((await body()) as { input?: Record<string, unknown> }).input ?? {}));
    }
    const run = /^\/api\/sa\/runs\/([\w-]+)(\/resume)?$/.exec(path);
    if (run && method === "GET" && !run[2]) { const record = await runs.load(run[1]!); return record ? json(res, 200, record) : json(res, 404, { error: "No such run." }); }
    if (run && method === "POST" && run[2]) {
      const record = await runs.load(run[1]!);
      const def = record && await readDef(record.workflowId);
      if (!record || !def) return json(res, 404, { error: "No such run." });
      const { approved } = await body() as { approved?: unknown };
      return json(res, 200, await engine.resume(def, record.runId, typeof approved === "boolean" ? { approved } : undefined));
    }

    if (path === "/api/sa/agents" && method === "GET") return json(res, 200, { enabled: Boolean(settings.agentsEnabled) });
    if (path === "/api/sa/agents" && method === "PUT") {
      const { enabled } = await body() as { enabled?: unknown };
      if (typeof enabled !== "boolean") return json(res, 400, { error: "enabled must be true or false." });
      settings.agentsEnabled = enabled; await saveSettings();
      return json(res, 200, { enabled });
    }
    if (path === "/api/sa/agents/team" && method === "POST") {
      try { return json(res, 200, await team(await body() as Parameters<typeof team>[0])); }
      catch (error) { return json(res, error instanceof ProviderError ? 503 : 400, { error: error instanceof Error ? error.message : "Team run failed." }); }
    }
    if (path === "/api/sa/models" && method === "GET") {
      const all = providers();
      const status = await Promise.all(all.map(async (p) => ({ id: p.id, ...(await p.status().catch(() => ({ signedIn: false, note: "Not reachable." }))) })));
      return json(res, 200, { order: settings.order, providers: status, cooling: chain().cooling() });
    }
    if (path === "/api/sa/models/order" && method === "PUT") {
      const { order } = await body() as { order?: unknown };
      const known = new Set(providers().map((p) => p.id));
      if (!Array.isArray(order) || order.some((id) => !known.has(id))) return json(res, 400, { error: `order must list provider ids from: ${[...known].join(", ")}` });
      settings.order = order as string[]; await saveSettings();
      return json(res, 200, { order: settings.order });
    }
    if (path === "/api/sa/models/chat" && method === "POST") {
      const { messages, model } = await body() as { messages?: ChatMessage[]; model?: string };
      if (!Array.isArray(messages) || !messages.length) return json(res, 400, { error: "messages required." });
      try { return json(res, 200, await chat(messages, model)); }
      catch (error) { return json(res, error instanceof ProviderError ? 503 : 500, { error: error instanceof Error ? error.message : "Chat failed." }); }
    }
    return json(res, 404, { error: "No such route." });
  };

  return { routes, jobs };
}
