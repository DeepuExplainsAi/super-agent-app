import { useCallback, useEffect, useState } from "react";
import { api } from "@/state/store";
import { PRIMARY_BUTTON } from "../../NoticeCard";
import { QUIET_BUTTON } from "../../announcements/ReleaseRow";
import { SettingRow, SettingsGroup, SettingsRows, Switch, SETTINGS_INPUT } from "../../SettingsPrimitives";

// Labels on this page are English only for now; the nav label has a locale key.

interface Models { order: string[]; providers: { id: string; signedIn: boolean; note?: string }[]; cooling: Record<string, number> }
interface Automation { browsersInstalled: boolean; playwrightEnabled: boolean; install: string[] }
interface Job { id: string; name: string; status: string; progress: number; message?: string; error?: string }
interface Run { runId: string; status: string; current: string | null; error?: string; state: Record<string, unknown> }

const send = <T,>(method: string, path: string, body?: unknown) =>
  api<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }), timeoutMs: 130_000 });

const SAMPLE = JSON.stringify({
  id: "demo", start: "ask",
  nodes: { ask: { type: "task", action: "model", input: { prompt: "Say hello in one line." } }, ok: { type: "approval", prompt: "Continue?" }, done: { type: "task", action: "model", input: { prompt: "Say bye." } } },
  edges: [{ from: "ask", to: "ok" }, { from: "ok", to: "done" }],
}, null, 2);

function ModelsGroup() {
  const [models, setModels] = useState<Models | null>(null);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const load = useCallback(() => void api<Models>("/api/sa/models").then(setModels, () => setError("Could not load providers.")), []);
  useEffect(load, [load]);
  const move = (index: number, by: number) => {
    if (!models) return;
    const order = [...models.order];
    const target = index + by;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    void send("PUT", "/api/sa/models/order", { order }).then(load, () => setError("Could not save the order."));
  };
  const ask = () => {
    setAnswer("…"); setError("");
    void send<{ text: string; provider?: string; notices: string[] }>("POST", "/api/sa/models/chat", { messages: [{ role: "user", content: prompt }] })
      .then((reply) => setAnswer(`${reply.notices.join(" ")} ${reply.text}${reply.provider ? ` (${reply.provider})` : ""}`.trim()),
        (failure: Error) => { setAnswer(""); setError(failure.message); });
  };
  return (
    <SettingsGroup label="Models and failover" description="Tried in this order. On a quota, rate limit or timeout the next one continues. Kiro and OpenCode use your own signed-in command-line tools; OpenRouter uses the key under API keys.">
      <SettingsRows>
        {models?.order.map((id, index) => {
          const info = models.providers.find((p) => p.id === id);
          return (
            <SettingRow key={id} title={`${index + 1}. ${id}`} subtitle={info?.signedIn ? "Ready" : info?.note ?? "Not signed in"}>
              <span className="flex gap-1">
                <button type="button" className={QUIET_BUTTON} disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
                <button type="button" className={QUIET_BUTTON} disabled={index === models.order.length - 1} onClick={() => move(index, 1)}>Down</button>
              </span>
            </SettingRow>
          );
        })}
        <div className="flex flex-col gap-2 px-4 py-3">
          <input className={SETTINGS_INPUT} value={prompt} placeholder="Test a message through the chain" onChange={(e) => setPrompt(e.target.value)} />
          <button type="button" className={PRIMARY_BUTTON} disabled={!prompt.trim()} onClick={ask}>Send test</button>
          {answer && <div className="whitespace-pre-wrap text-[13px] text-ink">{answer}</div>}
          {error && <div role="alert" className="text-[12px] text-danger">{error}</div>}
        </div>
      </SettingsRows>
    </SettingsGroup>
  );
}

function AutomationGroup() {
  const [state, setState] = useState<Automation | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(() => void api<Automation>("/api/sa/automation").then(setState, () => {}), []);
  useEffect(() => { load(); const timer = setInterval(load, 3000); return () => clearInterval(timer); }, [load]);
  if (!state) return null;
  return (
    <SettingsGroup label="Browser automation" description="Playwright drives a browser for your bots. The browser downloads once, into this app's data folder.">
      <SettingsRows>
        <SettingRow title="Browser download" subtitle={state.browsersInstalled ? "Installed" : state.install.at(-1) ?? "Not downloaded yet"}>
          <button type="button" className={QUIET_BUTTON} disabled={state.browsersInstalled} onClick={() => void send("POST", "/api/sa/automation/install-browsers").then(load)}>Download</button>
        </SettingRow>
        <SettingRow title="Playwright tools for bots" subtitle="Adds the pinned Playwright MCP server to your MCP servers.">
          <Switch checked={state.playwrightEnabled} aria-label="Playwright tools for bots" onClick={() => void send("PUT", "/api/sa/automation/playwright", { enabled: !state.playwrightEnabled }).then(load)} />
        </SettingRow>
        <div className="flex flex-col gap-2 px-4 py-3">
          <input className={SETTINGS_INPUT} value={url} placeholder="https://example.com (crawl up to 5 pages)" onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className={PRIMARY_BUTTON} disabled={!/^https?:\/\//i.test(url)} onClick={() => { setNote(""); void send("POST", "/api/sa/crawl", { url, maxPages: 5 }).then(() => setNote("Crawl queued. See Jobs."), (e: Error) => setNote(e.message)); }}>Crawl</button>
          {note && <div className="text-[12px] text-ink-secondary">{note}</div>}
        </div>
      </SettingsRows>
    </SettingsGroup>
  );
}

function JobsGroup() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [limit, setLimit] = useState("1");
  const [ram, setRam] = useState("0");
  const load = useCallback(() => void api<{ jobs: Job[] }>("/api/sa/jobs").then((r) => setJobs(r.jobs), () => {}), []);
  useEffect(() => { load(); const timer = setInterval(load, 2000); return () => clearInterval(timer); }, [load]);
  const saveLimits = () => void send("PUT", "/api/sa/jobs/limits", { maxConcurrent: Number(limit), minFreeMemoryMb: Number(ram) });
  return (
    <SettingsGroup label="Jobs" description="Heavy work runs on this computer. Set how many jobs run at once and how much free memory they need.">
      <SettingsRows>
        <SettingRow title="Jobs at once"><input className={`${SETTINGS_INPUT} w-20`} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} onBlur={saveLimits} /></SettingRow>
        <SettingRow title="Keep free memory (MB)" subtitle="A queued job waits while less than this is free."><input className={`${SETTINGS_INPUT} w-24`} inputMode="numeric" value={ram} onChange={(e) => setRam(e.target.value)} onBlur={saveLimits} /></SettingRow>
        {jobs.length === 0 && <SettingRow title="No jobs yet">{null}</SettingRow>}
        {jobs.map((job) => (
          <SettingRow key={job.id} title={job.name} subtitle={`${job.status}${job.status === "running" ? ` ${Math.round(job.progress * 100)}%` : ""}${job.error ? `: ${job.error}` : job.message ? `: ${job.message}` : ""}`}>
            {(job.status === "queued" || job.status === "running") && <button type="button" className={QUIET_BUTTON} onClick={() => void send("POST", `/api/sa/jobs/${job.id}/cancel`).then(load)}>Cancel</button>}
          </SettingRow>
        ))}
      </SettingsRows>
    </SettingsGroup>
  );
}

function WorkflowsGroup() {
  const [text, setText] = useState(SAMPLE);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const fail = (e: Error) => setError(e.message);
  const parsed = () => { try { return JSON.parse(text) as { id: string }; } catch { setError("That is not valid JSON."); return null; } };
  const start = () => {
    const def = parsed(); if (!def) return;
    setError("");
    void send("PUT", `/api/sa/workflows/${def.id}`, def).then(() => send<Run>("POST", `/api/sa/workflows/${def.id}/run`, {})).then(setRun, fail);
  };
  const answer = (approved: boolean) => run && void send<Run>("POST", `/api/sa/runs/${run.runId}/resume`, { approved }).then(setRun, fail);
  return (
    <SettingsGroup label="Workflows" description="Nodes and edges as JSON. Actions: model, crawl, webhook. An approval node waits for you, and a run survives a restart.">
      <SettingsRows>
        <div className="flex flex-col gap-2 px-4 py-3">
          <textarea className={`${SETTINGS_INPUT} h-56 py-2 font-mono`} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className={PRIMARY_BUTTON} onClick={start}>Save and run</button>
          {error && <div role="alert" className="text-[12px] text-danger">{error}</div>}
          {run && (
            <div className="flex flex-col gap-2 text-[13px] text-ink">
              <div>Run {run.runId}: {run.status}{run.current ? ` at ${run.current}` : ""}{run.error ? ` (${run.error})` : ""}</div>
              {run.status === "waiting" && <span className="flex gap-2"><button type="button" className={PRIMARY_BUTTON} onClick={() => answer(true)}>Approve</button><button type="button" className={QUIET_BUTTON} onClick={() => answer(false)}>Reject</button></span>}
              <pre className="max-h-48 overflow-auto text-[12px] text-ink-secondary">{JSON.stringify(run.state, null, 2)}</pre>
            </div>
          )}
        </div>
      </SettingsRows>
    </SettingsGroup>
  );
}

export function SuperAgentPage() {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => { void api<{ packages: { name: string }[] }>("/api/sa/packages").then((r) => setNames(r.packages.map((p) => p.name)), () => setNames([])); }, []);
  if (!names) return null;
  const has = (name: string) => names.includes(`@super-agent/${name}`);
  return <>{has("models") && <ModelsGroup />}{has("automation") && <AutomationGroup />}{has("compute") && <JobsGroup />}{has("workflow") && <WorkflowsGroup />}</>;
}
