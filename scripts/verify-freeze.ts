import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FROZEN_ENVIRONMENT_MODIFIED,
  manifestSha256,
  verifyFrozenEnvironment,
} from "../src/integrity/verify";

const rootDirectory = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = path.join(rootDirectory, "freeze/environment-v0.manifest.json");
const expectedFlag = process.argv.indexOf("--expect");

if (process.argv.includes("--print-hash")) {
  const digest = manifestSha256(await readFile(manifestPath));
  process.stdout.write(`${JSON.stringify({ manifestPath, manifestSha256: digest }, null, 2)}\n`);
} else {
  const expectedManifestSha256 =
    expectedFlag >= 0 ? process.argv[expectedFlag + 1] : undefined;
  if (!expectedManifestSha256) {
    process.stderr.write(
      `${JSON.stringify({
        valid: false,
        code: FROZEN_ENVIRONMENT_MODIFIED,
        message: "Usage: npm run freeze:verify -- --expect <approved-manifest-sha256>",
      })}\n`,
    );
    process.exitCode = 2;
  } else {
    const result = await verifyFrozenEnvironment({
      rootDirectory,
      manifestPath,
      expectedManifestSha256,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid) process.exitCode = 1;
  }
}
