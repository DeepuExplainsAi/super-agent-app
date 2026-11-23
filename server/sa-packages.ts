import automation from "../packages/automation/manifest.json" with { type: "json" };
import compute from "../packages/compute/manifest.json" with { type: "json" };
import models from "../packages/models/manifest.json" with { type: "json" };
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
