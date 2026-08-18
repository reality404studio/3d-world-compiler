import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertEvaluatorRuntimeIsolation } from "../src/evaluator/runtime-isolation";
import { assertFrozenEnvironment } from "../src/integrity/verify";
import { MATERIAL_MODES, type MaterialMode } from "../src/materials/policy";
import type { RenderableScene } from "../src/observation/renderable";
import { captureRenderableScene } from "../src/viewer/capture";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "freeze/environment-v0.manifest.json",
);

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const inputFile = path.resolve(requiredOption("--input"));
  const outputDirectory = path.resolve(requiredOption("--output"));
  const materialMode = (option("--material") ?? "authored") as MaterialMode;
  if (!MATERIAL_MODES.includes(materialMode)) {
    throw new Error("--material must be 'authored' or 'neutral'.");
  }

  const expectedManifestSha256 = process.env.EXPECTED_MANIFEST_SHA256;
  if (!expectedManifestSha256) {
    throw new Error("EXPECTED_MANIFEST_SHA256 is not baked into this evaluator.");
  }

  await mkdir(outputDirectory, { recursive: true });
  await assertEvaluatorRuntimeIsolation({
    evaluatorRoot: PROJECT_ROOT,
    inputFile,
    outputDirectory,
  });

  const integrityOptions = {
    rootDirectory: PROJECT_ROOT,
    manifestPath: MANIFEST_PATH,
    expectedManifestSha256,
  };
  await assertFrozenEnvironment(integrityOptions);

  let result: Awaited<ReturnType<typeof captureRenderableScene>> | undefined;
  try {
    const renderable = JSON.parse(
      await readFile(inputFile, "utf8"),
    ) as RenderableScene;
    result = await captureRenderableScene(renderable, outputDirectory, {
      materialMode,
    });
  } finally {
    await assertFrozenEnvironment(integrityOptions);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        evaluated: true,
        integrityVerifiedBeforeAndAfter: true,
        inputFile,
        ...result,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  await main();
} catch (error) {
  const record = error && typeof error === "object" ? error : {};
  process.stderr.write(
    `${JSON.stringify(
      {
        evaluated: false,
        code:
          "code" in record && typeof record.code === "string"
            ? record.code
            : "EVALUATION_FAILED",
        message: error instanceof Error ? error.message : String(error),
        ...(record && "errors" in record ? { errors: record.errors } : {}),
        ...(record && "result" in record ? { integrity: record.result } : {}),
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
