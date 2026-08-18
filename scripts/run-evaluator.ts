import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  buildEvaluatorDockerArgs,
  type EvaluatorContainerOptions,
} from "../src/evaluator/container-policy";
import { MATERIAL_MODES, type MaterialMode } from "../src/materials/policy";

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
  const materialMode = (option("--material") ?? "authored") as MaterialMode;
  if (!MATERIAL_MODES.includes(materialMode)) {
    throw new Error("--material must be 'authored' or 'neutral'.");
  }

  const options: EvaluatorContainerOptions = {
    image: requiredOption("--image"),
    inputFile: path.resolve(requiredOption("--input")),
    outputDirectory: path.resolve(requiredOption("--output")),
    materialMode,
  };
  if (!(await stat(options.inputFile)).isFile()) {
    throw new Error("--input must identify one renderable-v0 JSON file.");
  }
  await mkdir(options.outputDirectory, { recursive: true });

  const child = spawn("docker", buildEvaluatorDockerArgs(options), {
    stdio: "inherit",
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${JSON.stringify(
      {
        evaluated: false,
        code: "EVALUATOR_LAUNCH_FAILED",
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
