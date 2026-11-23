import { join } from "node:path";

/** Heavy browser downloads live in the app data folder, never in the installer. */
export function browsersDir(appDataDir: string): string {
  return join(appDataDir, "browsers");
}

export function browserEnv(appDataDir: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, PLAYWRIGHT_BROWSERS_PATH: browsersDir(appDataDir) };
}
