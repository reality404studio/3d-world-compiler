import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { buildEvaluatorDockerArgs } from "../../src/evaluator/container-policy";
import { loadTrustAnchors } from "../runner/config";
import type {
  CaptureInvocation,
  EvaluationResult,
  Evaluator,
} from "../runner/types";

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function executeDocker(args: string[]): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      env: { PATH: process.env.PATH ?? "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

export function buildCaptureInvocations(
  image: string,
  renderableFile: string,
  capturesDirectory: string,
): CaptureInvocation[] {
  return (["neutral", "authored"] as const).map((materialMode) => {
    const outputDirectory = path.join(capturesDirectory, materialMode);
    return {
      material_mode: materialMode,
      image,
      input_file: path.resolve(renderableFile),
      output_directory: path.resolve(outputDirectory),
      docker_args: buildEvaluatorDockerArgs({
        image,
        inputFile: renderableFile,
        outputDirectory,
        materialMode,
      }),
    };
  });
}

export class FrozenEvaluator implements Evaluator {
  async evaluate(
    renderableFile: string,
    capturesDirectory: string,
  ): Promise<EvaluationResult> {
    const anchors = await loadTrustAnchors();
    const invocations = buildCaptureInvocations(
      anchors.evaluator_image_digest,
      renderableFile,
      capturesDirectory,
    );
    const stdout = { neutral: "", authored: "" };
    const stderr = { neutral: "", authored: "" };

    for (const invocation of invocations) {
      await mkdir(invocation.output_directory, { recursive: true });
      const result = await executeDocker(invocation.docker_args);
      stdout[invocation.material_mode] = result.stdout;
      stderr[invocation.material_mode] = result.stderr;
      if (result.exitCode !== 0) {
        return { status: "EVALUATOR_FAILURE", invocations, stdout, stderr };
      }
    }
    return { status: "SUCCESS", invocations, stdout, stderr };
  }
}
