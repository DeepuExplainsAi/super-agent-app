import automation from "../packages/automation/manifest.json" with { type: "json" };
import compute from "../packages/compute/manifest.json" with { type: "json" };
import models from "../packages/models/manifest.json" with { type: "json" };
import mainApp from "../apps/main-app/app.json" with { type: "json" };
import botApp from "../apps/bot-app/app.json" with { type: "json" };
import automationApp from "../apps/automation-app/app.json" with { type: "json" };
import workflowApp from "../apps/workflow-app/app.json" with { type: "json" };
import theme from "../packages/theme/manifest.json" with { type: "json" };
import workflow from "../packages/workflow/manifest.json" with { type: "json" };

export interface PackageManifest {
  name: string;
  version: string;
  tools: string[];
  uiPanels: string[];
  needs: string[];
}

/** Every `packages/*\/manifest.json`. Imported statically so the bundled server (no packages/ folder) still lists them;
 * `sa-packages.test.ts` fails when this list and the folder disagree. */
export const PACKAGE_MANIFESTS: readonly PackageManifest[] = [automation, compute, models, theme, workflow];

export const APP_PROFILES: Record<string, { name: string; packages: string[] }> = {
  "main-app": mainApp, "bot-app": botApp, "automation-app": automationApp, "workflow-app": workflowApp,
};

/** The packages this run loads: `SA_APP` picks an `apps/<name>/app.json` profile; unset or unknown = main-app (all). */
export function loadedPackages(env: NodeJS.ProcessEnv = process.env): PackageManifest[] {
  const profile = APP_PROFILES[env.SA_APP ?? "main-app"] ?? APP_PROFILES["main-app"]!;
  return PACKAGE_MANIFESTS.filter((m) => profile.packages.includes(m.name));
}
