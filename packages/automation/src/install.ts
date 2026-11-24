import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { browserEnv, browsersDir } from "./paths.ts";
import { bundledRuntime } from "./runtime.ts";

export interface InstallProgress {
  line: string;
}

/** True when a chromium build is already in the app data folder. */
export function browsersInstalled(appDataDir: string): boolean {
  const dir = browsersDir(appDataDir);
  return existsSync(dir) && readdirSync(dir).some((name) => name.startsWith("chromium"));
}

/** First-run download with a progress callback (feeds the progress screen). Resolves when done, rejects on failure. */
export function installBrowsers(appDataDir: string, onProgress: (p: InstallProgress) => void = () => {}, browser = "chromium", runtimeEnv: NodeJS.ProcessEnv = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    // Same playwright-core as the MCP, so the downloaded build is the one the MCP asks for.
    const bundled = bundledRuntime(runtimeEnv);
    const child = bundled
      ? spawn(process.execPath, [bundled.playwrightCli, "install", browser], { env: { ...browserEnv(appDataDir), ELECTRON_RUN_AS_NODE: "1" }, stdio: ["ignore", "pipe", "pipe"] })
      : spawn("npx", ["-y", "playwright@1.65.1", "install", browser], { env: browserEnv(appDataDir), stdio: ["ignore", "pipe", "pipe"] });
    const forward = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) onProgress({ line: line.trim() });
    };
    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`playwright install exited with ${code}`))));
  });
}
