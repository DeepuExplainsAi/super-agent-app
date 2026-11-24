import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlWithCrawlee } from "../src/index.ts";

const site: Record<string, string> = {
  "/": '<html><head><title>Home</title></head><body><script>var x=1</script><a href="/two">two</a><a href="http://other.invalid/">out</a></body></html>',
  "/two": "<html><head><title>Two</title></head><body><p>second page</p></body></html>",
};
const server = createServer((req, res) => {
  const body = site[req.url ?? ""];
  res.writeHead(body ? 200 : 404, { "content-type": "text/html" }).end(body ?? "");
});
let base = "";
beforeAll(async () => { await new Promise<void>((r) => server.listen(0, "127.0.0.1", r)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
afterAll(() => { server.close(); });

describe("crawlee crawl", () => {
  it("follows same-origin links and returns titles and text without scripts", async () => {
    const pages = await crawlWithCrawlee(`${base}/`, { maxPages: 5 });
    expect(pages.map((p) => p.title).sort()).toEqual(["Home", "Two"]);
    expect(pages.find((p) => p.title === "Two")?.text).toBe("second page");
    expect(pages.find((p) => p.title === "Home")?.text).not.toContain("var x");
  }, 30_000);
});
