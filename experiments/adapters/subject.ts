import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  SubjectExecutionResult,
  SubjectExecutor,
} from "../runner/types";

export const SUBJECT_IMAGE = "3d-world-compiler-subject-v0:three-0.185.1";
export const SUBJECT_TIMEOUT_MS = 10_000;

interface ProcessOutcome {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export function subjectProcessEnvironment(): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? "" };
}

export function runSubjectContainer(
  args: string[],
  timeoutMs: number,
  containerName?: string,
): Promise<ProcessOutcome> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn("docker", args, {
      env: subjectProcessEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forcedRemoval: Promise<void> | null = null;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      if (containerName) {
        forcedRemoval = new Promise((cleanupResolve) => {
          const cleanup = spawn("docker", ["rm", "-f", containerName], {
            env: subjectProcessEnvironment(),
            stdio: "ignore",
          });
          cleanup.once("error", () => cleanupResolve());
          cleanup.once("exit", () => cleanupResolve());
        });
      }
      child.kill("SIGKILL");
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", async (code) => {
      clearTimeout(timer);
      await forcedRemoval;
      resolve({
        exitCode: code,
        timedOut,
        stdout,
        stderr,
        durationMs: performance.now() - started,
      });
    });
  });
}

export function buildSubjectDockerArgs(
  inputDirectory: string,
  outputDirectory: string,
  image = SUBJECT_IMAGE,
  containerName?: string,
): string[] {
  return [
    "run",
    "--rm",
    ...(containerName ? ["--name", containerName] : []),
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "64",
    "--memory",
    "512m",
    "--cpus",
    "1",
    "--user",
    "1000:1000",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=32m",
    "--mount",
    `type=bind,src=${path.resolve(inputDirectory)},dst=/input,readonly`,
    "--mount",
    `type=bind,src=${path.resolve(outputDirectory)},dst=/output`,
    image,
  ];
}

export class DockerSubjectExecutor implements SubjectExecutor {
  constructor(
    private readonly image = SUBJECT_IMAGE,
    private readonly timeoutMs = SUBJECT_TIMEOUT_MS,
    private readonly run: (
      args: string[],
      timeoutMs: number,
      containerName?: string,
    ) => Promise<ProcessOutcome> = runSubjectContainer,
  ) {}

  async execute(source: string): Promise<SubjectExecutionResult> {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "3d-subject-v0-"));
    const inputDirectory = path.join(temporaryRoot, "input");
    const outputDirectory = path.join(temporaryRoot, "output");
    await mkdir(inputDirectory);
    await mkdir(outputDirectory);
    await chmod(outputDirectory, 0o777);
    await writeFile(path.join(inputDirectory, "subject.mjs"), source, {
      encoding: "utf8",
      flag: "wx",
    });

    try {
      const containerName = `three-subject-v0-${randomUUID()}`;
      const outcome = await this.run(
        buildSubjectDockerArgs(
          inputDirectory,
          outputDirectory,
          this.image,
          containerName,
        ),
        this.timeoutMs,
        containerName,
      );
      if (outcome.timedOut) {
        return {
          status: "SUBJECT_TIMEOUT",
          ...outcome,
          renderable: null,
        };
      }

      let execution: { status?: SubjectExecutionResult["status"] } = {};
      try {
        execution = JSON.parse(
          await readFile(path.join(outputDirectory, "execution-result.json"), "utf8"),
        ) as { status?: SubjectExecutionResult["status"] };
      } catch {
        execution = { status: "SUBJECT_CODE_RUNTIME_FAILURE" };
      }
      let renderable = null;
      if (execution.status === "SUCCESS") {
        renderable = JSON.parse(
          await readFile(path.join(outputDirectory, "renderable.json"), "utf8"),
        );
      }
      return {
        status: execution.status ?? "SUBJECT_CODE_RUNTIME_FAILURE",
        ...outcome,
        renderable,
      };
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
