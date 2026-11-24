// Proves Crawlee works inside the esbuild bundle (no node_modules): bundles the crawler like the server does and runs it.
import { build } from "esbuild";
import { createServer } from "node:http";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const out = mkdtempSync(join(tmpdir(), "sa-crawlee-"));
await build({
  entryPoints: [join(root, "packages/automation/src/crawlee.ts")], bundle: true, platform: "node", format: "esm", keepNames: true, logLevel: "error",
  outfile: join(out, "crawlee.mjs"),
  banner: { js: 'import { createRequire as a } from "node:module";import { fileURLToPath as b } from "node:url";import { dirname as c } from "node:path";const require = a(import.meta.url);const __filename = b(import.meta.url);const __dirname = c(__filename);' },
});
const store = join(root, "node_modules", ".pnpm");
cpSync(join(store, readdirSync(store).find((n) => n.startsWith("header-generator@")), "node_modules/header-generator/data_files"), join(out, "data_files"), { recursive: true });
const server = createServer((_, res) => res.writeHead(200, { "content-type": "text/html" }).end("<title>Bundled</title><p>ok</p>"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const run = spawnSync(process.execPath, ["--input-type=module", "-e", `import { crawlWithCrawlee } from ${JSON.stringify(join(out, "crawlee.mjs"))}; console.log(JSON.stringify(await crawlWithCrawlee(${JSON.stringify(url)}, { maxPages: 1 })));`], { encoding: "utf8", cwd: out });
server.close();
const pages = JSON.parse(run.stdout.trim().split("\n").at(-1) ?? "[]");
if (pages[0]?.title !== "Bundled") { console.error(run.stdout, run.stderr); process.exit(1); }
console.log("crawlee bundle ok");
