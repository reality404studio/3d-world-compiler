import path from "node:path";
import { assertFrozenEnvironment } from "../../src/integrity/verify";
import { EXPERIMENTS_ROOT, PROJECT_ROOT, loadTrustAnchors } from "./config";
import { ExperimentFailure } from "./failures";

export async function verifyFrozenEnvironment(): Promise<void> {
  const anchors = await loadTrustAnchors();
  try {
    await assertFrozenEnvironment({
      rootDirectory: PROJECT_ROOT,
      manifestPath: path.join(PROJECT_ROOT, "freeze/environment-v0.manifest.json"),
      expectedManifestSha256: anchors.environment_manifest_sha256,
    });
  } catch (error) {
    throw new ExperimentFailure(
      "FROZEN_ENVIRONMENT_MODIFIED",
      "FROZEN_ENVIRONMENT_MODIFIED",
      error,
    );
  }
  if (!path.resolve(EXPERIMENTS_ROOT).startsWith(`${path.resolve(PROJECT_ROOT)}${path.sep}`)) {
    throw new ExperimentFailure(
      "FROZEN_ENVIRONMENT_MODIFIED",
      "Experiment root is outside the expected checkout.",
    );
  }
}
