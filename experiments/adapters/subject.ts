import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import trustAnchors from "../protocol/trust-anchors-v0.json";
import type {
  SubjectExecutionResult,
  SubjectExecutor,
} from "../runner/types";

export const SUBJECT_IMAGE_DIGEST =
  trustAnchors.subject_image_digest;
export const SUBJECT_TIMEOUT_MS = 10_000;
const IMMUTABLE_IMAGE_REFERENCE = /.+@sha256:[a-f0-9]{64}$/;
const SUBJECT_EXECUTION_STATUSES = new Set<SubjectExecutionResult["status"]>([
  "SUCCESS",
  "SUBJECT_CODE_SYNTAX_FAILURE",
  "SUBJECT_CODE_RUNTIME_FAILURE",
  "SUBJECT_TIMEOUT",
  "UNSUPPORTED_RENDERABLE_NODE",
]);

type SubjectExecutionEvidence = Pick<
  SubjectExecutionResult,
  "status" | "message" | "details"
>;

function parseSubjectExecutionEvidence(text: string): SubjectExecutionEvidence {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Subject execution result must be one JSON object.");
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.status !== "string" ||
    !SUBJECT_EXECUTION_STATUSES.has(
      record.status as SubjectExecutionResult["status"],
    )
  ) {
    throw new Error("Subject execution result has an invalid status.");
  }
  if ("message" in record && typeof record.message !== "string") {
    throw new Error("Subject execution result has a non-string message.");
  }
  return {
    status: record.status as SubjectExecutionResult["status"],
    ...("message" in record ? { message: record.message as string } : {}),
    ...(Object.hasOwn(record, "details") ? { details: record.details } : {}),
  };
}

function unavailableExecutionEvidence(error: unknown): SubjectExecutionEvidence {
  return {
    status: "SUBJECT_CODE_RUNTIME_FAILURE",
    message: "Subject execution result file could not be read or parsed.",
    details: {
      diagnostic: "SUBJECT_EXECUTION_RESULT_UNAVAILABLE",
      file: "execution-result.json",
      cause: error instanceof Error ? error.message : String(error),
    },
  };
}

export function assertImmutableSubjectImageReference(image: string): void {
  if (!IMMUTABLE_IMAGE_REFERENCE.test(image)) {
    throw new Error(
      "Subject image must be an immutable registry reference ending in @sha256:<64 lowercase hex characters>.",
    );
  }
}

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
  image = SUBJECT_IMAGE_DIGEST,
  containerName?: string,
): string[] {
  assertImmutableSubjectImageReference(image);
  if (image !== SUBJECT_IMAGE_DIGEST) {
    throw new Error("Subject image does not match the approved apparatus digest.");
  }
  return [
    "run",
    "--rm",
    ...(containerName ? ["--name", containerName] : []),
    "--platform",
    "linux/amd64",
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
    readonly imageDigest = SUBJECT_IMAGE_DIGEST,
    private readonly timeoutMs = SUBJECT_TIMEOUT_MS,
    private readonly run: (
      args: string[],
      timeoutMs: number,
      containerName?: string,
    ) => Promise<ProcessOutcome> = runSubjectContainer,
  ) {
    assertImmutableSubjectImageReference(imageDigest);
    if (imageDigest !== SUBJECT_IMAGE_DIGEST) {
      throw new Error("Subject image does not match the approved apparatus digest.");
    }
  }

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
          this.imageDigest,
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

      let execution: SubjectExecutionEvidence;
      try {
        execution = parseSubjectExecutionEvidence(
          await readFile(path.join(outputDirectory, "execution-result.json"), "utf8"),
        );
      } catch (error) {
        execution = unavailableExecutionEvidence(error);
      }
      let renderable = null;
      if (execution.status === "SUCCESS") {
        renderable = JSON.parse(
          await readFile(path.join(outputDirectory, "renderable.json"), "utf8"),
        );
      }
      return {
        ...execution,
        ...outcome,
        renderable,
      };
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
