import { z } from "zod/v4";

export interface AiBrowserOptions {
  /** e.g. "openai/gpt-5.4-mini" or "anthropic/claude-sonnet-4-5": the user's own model and key. */
  modelName: `${"openai" | "anthropic" | "google" | "groq" | "cerebras"}/${string}`;
  apiKey: string;
  /** Chromium/Chrome path; default is the one Stagehand finds. */
  executablePath?: string;
  headless?: boolean;
  userDataDir?: string;
}

/** Stagehand act/extract on a local browser. Loaded lazily so the server starts without it. */
export async function aiBrowseExtract<T extends z.ZodType>(url: string, instruction: string, schema: T, options: AiBrowserOptions, act?: string[]): Promise<z.infer<T>> {
  const { Stagehand, localBrowser } = await import("@browserbasehq/stagehand");
  const browser = await localBrowser.launch({ headless: options.headless ?? true, ...(options.executablePath ? { executablePath: options.executablePath } : {}), ...(options.userDataDir ? { userDataDir: options.userDataDir } : {}) });
  const stagehand = await Stagehand.create({ browser, model: { modelName: options.modelName, apiKey: options.apiKey } });
  try {
    const [page] = await browser.context.pages();
    await page!.goto(url);
    for (const step of act ?? []) await stagehand.act(step);
    return (await stagehand.extract(instruction, schema)).data as z.infer<T>;
  } finally {
    await stagehand.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
