import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DockerSubjectExecutor,
  SUBJECT_IMAGE_DIGEST,
  assertImmutableSubjectImageReference,
  buildSubjectDockerArgs,
  runSubjectContainer,
  subjectProcessEnvironment,
} from "../adapters/subject";

async function withFakeDocker(
  script: string,
  action: () => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fake-docker-"));
  const executable = path.join(root, "docker");
  const previousPath = process.env.PATH;
  await writeFile(executable, `#!/bin/sh\n${script}\n`, "utf8");
  await chmod(executable, 0o755);
  process.env.PATH = root;
  try {
    await action();
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    await rm(root, { recursive: true, force: true });
  }
}

function outputDirectoryFromDockerArgs(args: string[]): string {
  const mount = args.find((argument) => argument.endsWith(",dst=/output"));
  const prefix = "type=bind,src=";
  const suffix = ",dst=/output";
  if (!mount?.startsWith(prefix)) {
    throw new Error("Subject Docker arguments did not include the output mount.");
  }
  return mount.slice(prefix.length, -suffix.length);
}

function subjectRunWithExecutionResult(contents?: string) {
  return async (args: string[]) => {
    if (contents !== undefined) {
      await writeFile(
        path.join(outputDirectoryFromDockerArgs(args), "execution-result.json"),
        contents,
        "utf8",
      );
    }
    return {
      exitCode: 1,
      timedOut: false,
      stdout: "subject stdout",
      stderr: "subject stderr",
      durationMs: 7,
    };
  };
}

describe("untrusted free-form subject boundary", () => {
  it("does not inherit GEMINI_API_KEY or any secret environment variable", async () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "must-not-cross";
    try {
      const environment = subjectProcessEnvironment();
      expect(environment.GEMINI_API_KEY).toBeUndefined();
      expect(Object.keys(environment)).toEqual(["PATH"]);
      expect(buildSubjectDockerArgs("/tmp/input", "/tmp/output")).not.toContain("--env");
      await withFakeDocker("/usr/bin/env", async () => {
        const outcome = await runSubjectContainer([], 1_000);
        expect(outcome.exitCode).toBe(0);
        expect(outcome.stdout).not.toContain("GEMINI_API_KEY");
        expect(outcome.stdout).not.toContain("must-not-cross");
      });
    } finally {
      if (previous === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previous;
    }
  });

  it("uses no network, read-only root, resource bounds, and no evaluator mount", () => {
    const args = buildSubjectDockerArgs("/tmp/input", "/tmp/output");
    expect(args).toEqual(expect.arrayContaining(["--network", "none", "--read-only"]));
    expect(args).toEqual(
      expect.arrayContaining(["--platform", "linux/amd64", SUBJECT_IMAGE_DIGEST]),
    );
    expect(args.join(" ")).toContain("/input,readonly");
    expect(args.join(" ")).not.toContain("freeze/");
    expect(args.join(" ")).not.toContain("src/evaluator");
  });

  it("refuses mutable subject image tags", () => {
    expect(() =>
      assertImmutableSubjectImageReference(
        "3d-world-compiler-subject-v0:three-0.185.1",
      ),
    ).toThrow("immutable registry reference");
    expect(
      () => new DockerSubjectExecutor("3d-world-compiler-subject-v0:latest"),
    ).toThrow("immutable registry reference");
    expect(
      () =>
        new DockerSubjectExecutor(
          `ghcr.io/example/other@sha256:${"a".repeat(64)}`,
        ),
    ).toThrow("approved apparatus digest");
    expect(() =>
      buildSubjectDockerArgs(
        "/tmp/input",
        "/tmp/output",
        `ghcr.io/example/other@sha256:${"a".repeat(64)}`,
      ),
    ).toThrow("approved apparatus digest");
  });

  it("kills and classifies a real timed-out subject-side process", async () => {
    await withFakeDocker('if [ "$1" = "rm" ]; then exit 0; fi\n/bin/sleep 5', async () => {
      const executor = new DockerSubjectExecutor(SUBJECT_IMAGE_DIGEST, 20);
      await expect(executor.execute("export default () => null")).resolves.toMatchObject({
        status: "SUBJECT_TIMEOUT",
        timedOut: true,
        renderable: null,
      });
    });
  });

  it("preserves a runtime failure message from execution-result.json", async () => {
    const executor = new DockerSubjectExecutor(
      SUBJECT_IMAGE_DIGEST,
      1_000,
      subjectRunWithExecutionResult(
        JSON.stringify({
          status: "SUBJECT_CODE_RUNTIME_FAILURE",
          message: "build is not defined",
        }),
      ),
    );

    await expect(executor.execute("ignored")).resolves.toMatchObject({
      status: "SUBJECT_CODE_RUNTIME_FAILURE",
      message: "build is not defined",
      stdout: "subject stdout",
      stderr: "subject stderr",
    });
  });

  it("preserves a syntax failure message from execution-result.json", async () => {
    const executor = new DockerSubjectExecutor(
      SUBJECT_IMAGE_DIGEST,
      1_000,
      subjectRunWithExecutionResult(
        JSON.stringify({
          status: "SUBJECT_CODE_SYNTAX_FAILURE",
          message: "Unexpected token '}'",
        }),
      ),
    );

    await expect(executor.execute("ignored")).resolves.toMatchObject({
      status: "SUBJECT_CODE_SYNTAX_FAILURE",
      message: "Unexpected token '}'",
    });
  });

  it("preserves unsupported-node details from execution-result.json", async () => {
    const details = {
      path: "$.children[0]",
      nodeType: "AmbientLight",
      constructorName: "AmbientLight",
    };
    const executor = new DockerSubjectExecutor(
      SUBJECT_IMAGE_DIGEST,
      1_000,
      subjectRunWithExecutionResult(
        JSON.stringify({
          status: "UNSUPPORTED_RENDERABLE_NODE",
          message: "UNSUPPORTED_RENDERABLE_NODE",
          details,
        }),
      ),
    );

    await expect(executor.execute("ignored")).resolves.toMatchObject({
      status: "UNSUPPORTED_RENDERABLE_NODE",
      message: "UNSUPPORTED_RENDERABLE_NODE",
      details,
    });
  });

  it.each([
    ["missing", undefined],
    ["malformed", "{not-json"],
  ])(
    "preserves an explicit diagnostic for %s execution-result evidence",
    async (_case, contents) => {
      const executor = new DockerSubjectExecutor(
        SUBJECT_IMAGE_DIGEST,
        1_000,
        subjectRunWithExecutionResult(contents),
      );

      await expect(executor.execute("ignored")).resolves.toMatchObject({
        status: "SUBJECT_CODE_RUNTIME_FAILURE",
        message: "Subject execution result file could not be read or parsed.",
        details: {
          diagnostic: "SUBJECT_EXECUTION_RESULT_UNAVAILABLE",
          file: "execution-result.json",
          cause: expect.any(String),
        },
        stdout: "subject stdout",
        stderr: "subject stderr",
      });
    },
  );
});
