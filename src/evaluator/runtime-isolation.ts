import { constants } from "node:fs";
import { access } from "node:fs/promises";

export const EVALUATOR_ISOLATION_VIOLATION =
  "EVALUATOR_ISOLATION_VIOLATION" as const;

export class EvaluatorIsolationError extends Error {
  readonly code = EVALUATOR_ISOLATION_VIOLATION;
  readonly path: string;

  constructor(path: string, expectation: "read-only" | "writable") {
    super(`${path} must be ${expectation}.`);
    this.name = "EvaluatorIsolationError";
    this.path = path;
  }
}

async function isWritable(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function assertEvaluatorRuntimeIsolation(options: {
  evaluatorRoot: string;
  inputFile: string;
  outputDirectory: string;
}): Promise<void> {
  if (await isWritable(options.evaluatorRoot)) {
    throw new EvaluatorIsolationError(options.evaluatorRoot, "read-only");
  }
  if (await isWritable(options.inputFile)) {
    throw new EvaluatorIsolationError(options.inputFile, "read-only");
  }
  if (!(await isWritable(options.outputDirectory))) {
    throw new EvaluatorIsolationError(options.outputDirectory, "writable");
  }
}
