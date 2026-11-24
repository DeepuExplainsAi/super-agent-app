import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { browsersInstalled, bundledRuntime, crawl, extractPage, playwrightMcpServer } from "../src/index.ts";

const html = (title: string, body: string) => new Response(`<html><head><title>${title}</title></head><body>${body}</body></html>`, { headers: { "content-type": "text/html" } });

describe("playwright mcp entry", () => {
  it("is pinned, isolated, and keeps browsers in the app data folder", () => {
    const entry = playwrightMcpServer("/data", { headless: true });
    expect(entry.command).toBe("npx");
    expect(entry.args).toEqual(["-y", "@playwright/mcp@0.0.86", "--isolated", "--headless"]);
    expect(entry.env.PLAYWRIGHT_BROWSERS_PATH).toBe(join("/data", "browsers"));
  });
});

describe("bundled playwright mcp", () => {
  const stage = (files: string[]) => {
    const resources = mkdtempSync(join(tmpdir(), "sa-res-"));
    for (const file of files) { mkdirSync(join(resources, "playwright-mcp", "node_modules", file, ".."), { recursive: true }); writeFileSync(join(resources, "playwright-mcp", "node_modules", file), ""); }
    return { OMB_RESOURCES_PATH: resources };
  };
  it("is absent without staged files, so dev checkouts keep using npx", () => {
    expect(bundledRuntime({})).toBeUndefined();
    expect(bundledRuntime(stage(["@playwright/mcp/cli.js"]))).toBeUndefined();
    expect(playwrightMcpServer("/data", { runtimeEnv: {} }).command).toBe("npx");
  });
  it("runs the staged copy on the app's own Node when both files exist", () => {
    const env = stage(["@playwright/mcp/cli.js", "playwright-core/cli.js"]);
    const entry = playwrightMcpServer("/data", { headless: true, runtimeEnv: env });
    expect(entry.command).toBe(process.execPath);
    expect(entry.args).toEqual([join(env.OMB_RESOURCES_PATH!, "playwright-mcp", "node_modules", "@playwright", "mcp", "cli.js"), "--isolated", "--headless"]);
    expect(entry.env).toMatchObject({ ELECTRON_RUN_AS_NODE: "1", PLAYWRIGHT_BROWSERS_PATH: join("/data", "browsers") });
  });
});

describe("browser install state", () => {
  it("detects a chromium build in the app data folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "sa-"));
    expect(browsersInstalled(dir)).toBe(false);
    mkdirSync(join(dir, "browsers", "chromium-1234"), { recursive: true });
    expect(browsersInstalled(dir)).toBe(true);
  });
});

describe("crawl", () => {
  it("extracts title, text and absolute http links, dropping scripts", () => {
    const page = extractPage("https://a.test/x/", '<title> Hi </title><script>var a=1</script><p>Hello <b>you</b></p><a href="/y">y</a><a href="mailto:z@z">m</a><a href="https://b.test/">b</a>');
    expect(page.title).toBe("Hi");
    expect(page.text).toContain("Hello you");
    expect(page.text).not.toContain("var a");
    expect(page.links).toEqual(["https://a.test/y", "https://b.test/"]);
  });

  it("opens a page, follows same-origin links, and returns the data", async () => {
    const site: Record<string, () => Response> = {
      "https://a.test/": () => html("Home", '<a href="/two">two</a><a href="https://other.test/">out</a>'),
      "https://a.test/two": () => html("Two", "second page"),
      "https://other.test/": () => html("Other", "must not be visited"),
    };
    const visited: string[] = [];
    const pages = await crawl("https://a.test/", {
      fetch: (async (url: string) => { visited.push(url); return site[url]?.() ?? new Response("", { status: 404 }); }) as unknown as typeof fetch,
    });
    expect(pages.map((p) => p.title)).toEqual(["Home", "Two"]);
    expect(pages[1]?.text).toBe("second page");
    expect(visited).not.toContain("https://other.test/");
  });

  it("stops at maxPages", async () => {
    const fetchAll = (async (url: string) => html("p", `<a href="${url}n">n</a>`)) as unknown as typeof fetch;
    expect(await crawl("https://a.test/", { maxPages: 3, fetch: fetchAll })).toHaveLength(3);
  });
});
