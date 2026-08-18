import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROPOSED_FROZEN_PATHS } from "../src/integrity/frozen-paths";
import {
  buildFreezeManifest,
  manifestSha256,
  serializeFreezeManifest,
} from "../src/integrity/verify";

const rootDirectory = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = path.join(rootDirectory, "freeze/environment-v0.manifest.json");
const manifest = await buildFreezeManifest(rootDirectory, PROPOSED_FROZEN_PATHS);
const serialized = serializeFreezeManifest(manifest);

await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, serialized, "utf8");
process.stdout.write(
  `${JSON.stringify(
    {
      manifestPath,
      manifestSha256: manifestSha256(serialized),
      protectedFiles: manifest.files.length,
    },
    null,
    2,
  )}\n`,
);
