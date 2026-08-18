import path from "node:path";
import type { MaterialMode } from "../materials/policy";

const IMMUTABLE_IMAGE_REFERENCE = /.+@sha256:[a-f0-9]{64}$/;

export interface EvaluatorContainerOptions {
  image: string;
  inputFile: string;
  outputDirectory: string;
  materialMode: MaterialMode;
}

function assertMountPath(value: string, label: string): string {
  const absolute = path.resolve(value);
  if (absolute.includes(",") || absolute.includes("\n") || absolute.includes("\r")) {
    throw new Error(`${label} contains characters unsupported by Docker --mount.`);
  }
  return absolute;
}

export function assertImmutableImageReference(image: string): void {
  if (!IMMUTABLE_IMAGE_REFERENCE.test(image)) {
    throw new Error(
      "Evaluator image must be an immutable registry reference ending in @sha256:<64 lowercase hex characters>.",
    );
  }
}

export function buildEvaluatorDockerArgs(
  options: EvaluatorContainerOptions,
): string[] {
  assertImmutableImageReference(options.image);
  const inputFile = assertMountPath(options.inputFile, "Input file");
  const outputDirectory = assertMountPath(
    options.outputDirectory,
    "Output directory",
  );

  return [
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "256",
    "--memory",
    "2g",
    "--cpus",
    "2",
    "--user",
    "1000:1000",
    "--workdir",
    "/evaluator",
    "--mount",
    `type=bind,src=${inputFile},dst=/input/renderable.json,readonly`,
    "--mount",
    `type=bind,src=${outputDirectory},dst=/output`,
    "--env",
    "HOME=/output/.home",
    "--env",
    "TMPDIR=/output/.tmp",
    "--env",
    "XDG_CACHE_HOME=/output/.cache",
    options.image,
    "--input",
    "/input/renderable.json",
    "--output",
    "/output",
    "--material",
    options.materialMode,
  ];
}
