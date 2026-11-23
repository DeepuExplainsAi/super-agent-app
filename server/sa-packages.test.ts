import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_PROFILES, loadedPackages, PACKAGE_MANIFESTS } from "./sa-packages.ts";

const root = join(import.meta.dirname, "..", "packages");

describe("package manifests", () => {
  it("lists every packages/*/manifest.json", () => {
    const onDisk = readdirSync(root).filter((dir) => existsSync(join(root, dir, "manifest.json")))
      .map((dir) => JSON.parse(readFileSync(join(root, dir, "manifest.json"), "utf8")).name).sort();
    expect(PACKAGE_MANIFESTS.map((m) => m.name).sort()).toEqual(onDisk);
  });
  it("honours the package contract", () => {
    for (const m of PACKAGE_MANIFESTS) {
      expect(m.name).toMatch(/^@super-agent\//);
      for (const key of ["tools", "uiPanels", "needs"] as const) expect(Array.isArray(m[key])).toBe(true);
    }
  });
  it("main-app loads every package; each profile names only real packages", () => {
    expect(loadedPackages({}).map((m) => m.name).sort()).toEqual(PACKAGE_MANIFESTS.map((m) => m.name).sort());
    const known = new Set(PACKAGE_MANIFESTS.map((m) => m.name));
    for (const profile of Object.values(APP_PROFILES)) for (const name of profile.packages) expect(known.has(name)).toBe(true);
    expect(loadedPackages({ SA_APP: "bot-app" }).map((m) => m.name)).not.toContain("@super-agent/workflow");
  });
});
