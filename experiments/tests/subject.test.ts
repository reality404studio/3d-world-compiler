import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DockerSubjectExecutor,
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
    expect(args.join(" ")).toContain("/input,readonly");
    expect(args.join(" ")).not.toContain("freeze/");
    expect(args.join(" ")).not.toContain("src/evaluator");
  });

  it("kills and classifies a real timed-out subject-side process", async () => {
    await withFakeDocker('if [ "$1" = "rm" ]; then exit 0; fi\n/bin/sleep 5', async () => {
      const executor = new DockerSubjectExecutor("fixture-image", 20);
      await expect(executor.execute("export default () => null")).resolves.toMatchObject({
        status: "SUBJECT_TIMEOUT",
        timedOut: true,
        renderable: null,
      });
    });
  });
});
