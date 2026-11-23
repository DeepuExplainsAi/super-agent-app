#!/usr/bin/env node
// Builds public/licenses.html (the in-app "Open Source Licenses" page, served at /licenses.html)
// from licenses.json (scripts/license-audit.mjs --write) and THIRD_PARTY.md.
import { readFileSync, writeFileSync } from "node:fs";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const packages = JSON.parse(readFileSync(process.argv[2] ?? "licenses.json", "utf8"));
const thirdParty = readFileSync("THIRD_PARTY.md", "utf8");

const rows = packages.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.versions.join(", "))}</td><td>${esc(p.license)}</td></tr>`).join("\n");
writeFileSync(
  "public/licenses.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Source Licenses</title>
<style>body{font:14px system-ui;margin:2rem auto;max-width:56rem;padding:0 1rem;background:#0b0b0c;color:#e8e8ea}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #34343a;padding:.3rem .5rem;text-align:left}pre{white-space:pre-wrap}a{color:#9ab}</style>
<h1>Open Source Licenses</h1>
<h2>Bundled projects</h2><pre>${esc(thirdParty)}</pre>
<h2>npm packages (${packages.length})</h2>
<table><tr><th>Package</th><th>Version</th><th>License</th></tr>
${rows}</table></html>
`,
);
console.log(`wrote public/licenses.html (${packages.length} packages)`);
