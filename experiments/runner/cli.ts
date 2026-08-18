import path from "node:path";
import { GeminiAdapter } from "../adapters/gemini";
import { FrozenEvaluator } from "../adapters/evaluator";
import { DockerSubjectExecutor } from "../adapters/subject";
import { EXPERIMENTS_ROOT } from "./config";
import { executeExperimentRun } from "./run";
import type { Condition } from "./types";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const condition = required("--condition") as Condition;
  if (!["C0", "C1", "C2", "C3"].includes(condition)) {
    throw new Error("--condition must be C0, C1, C2, or C3.");
  }
  const result = await executeExperimentRun(
    {
      runId: required("--run-id"),
      condition,
      assetId: required("--asset-id"),
      referenceFile: path.resolve(required("--reference")),
      referenceMimeType: required("--reference-mime"),
      runsDirectory: path.join(EXPERIMENTS_ROOT, "runs"),
    },
    {
      gemini: new GeminiAdapter(),
      subject: new DockerSubjectExecutor(),
      evaluator: new FrozenEvaluator(),
    },
  );
  process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
  process.exitCode = result.manifest.failure_code ? 1 : 0;
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
