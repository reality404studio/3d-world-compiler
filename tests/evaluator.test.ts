import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertImmutableImageReference,
  buildEvaluatorDockerArgs,
} from "../src/evaluator/container-policy";
import {
  EVALUATOR_ISOLATION_VIOLATION,
  assertEvaluatorRuntimeIsolation,
} from "../src/evaluator/runtime-isolation";

const IMAGE = `registry.example/environment-v0@sha256:${"a".repeat(64)}`;

describe("trusted evaluator container policy", () => {
  it("requires an immutable OCI image digest", () => {
    expect(() => assertImmutableImageReference("environment-v0:latest")).toThrow(
      /immutable registry reference/,
    );
    expect(() => assertImmutableImageReference(IMAGE)).not.toThrow();
  });

  it("builds a no-network, read-only-root invocation with only output writable", () => {
    const args = buildEvaluatorDockerArgs({
      image: IMAGE,
      inputFile: "/trusted/input.json",
      outputDirectory: "/trusted/output",
      materialMode: "neutral",
    });

    expect(args).toContain("--read-only");
    expect(args.slice(args.indexOf("--network"), args.indexOf("--network") + 2)).toEqual([
      "--network",
      "none",
    ]);
    expect(args.slice(args.indexOf("--user"), args.indexOf("--user") + 2)).toEqual([
      "--user",
      "1000:1000",
    ]);
    expect(args).toContain("no-new-privileges");
    expect(args).toContain("ALL");

    const mounts = args.filter((value) => value.startsWith("type=bind"));
    expect(mounts).toEqual([
      `type=bind,src=${path.resolve("/trusted/input.json")},dst=/input/renderable.json,readonly`,
      `type=bind,src=${path.resolve("/trusted/output")},dst=/output`,
    ]);
    expect(mounts.filter((mount) => !mount.endsWith(",readonly"))).toHaveLength(1);
    expect(args).toContain("HOME=/output/.home");
    expect(args).toContain("TMPDIR=/output/.tmp");
    expect(args).toContain("XDG_CACHE_HOME=/output/.cache");
    expect(args).toContain(IMAGE);
  });

  it("checks evaluator/input read-only and output writable at process start", async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "evaluator-isolation-"));
    const evaluatorRoot = path.join(fixture, "evaluator");
    const inputFile = path.join(fixture, "renderable.json");
    const outputDirectory = path.join(fixture, "output");
    await mkdir(evaluatorRoot);
    await mkdir(outputDirectory);
    await writeFile(inputFile, "{}\n");
    await chmod(evaluatorRoot, 0o555);
    await chmod(inputFile, 0o444);
    await chmod(outputDirectory, 0o755);

    await expect(
      assertEvaluatorRuntimeIsolation({
        evaluatorRoot,
        inputFile,
        outputDirectory,
      }),
    ).resolves.toBeUndefined();

    await chmod(inputFile, 0o644);
    await expect(
      assertEvaluatorRuntimeIsolation({
        evaluatorRoot,
        inputFile,
        outputDirectory,
      }),
    ).rejects.toMatchObject({ code: EVALUATOR_ISOLATION_VIOLATION });
  });

  it("pins evaluator construction and in-image integrity checks in Dockerfile", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const dockerfile = await readFile(path.join(root, "evaluator/Dockerfile"), "utf8");

    expect(dockerfile).toContain("FROM node:22.18.0-bookworm-slim");
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain("playwright install --with-deps chromium");
    expect(dockerfile).toContain("ARG EXPECTED_MANIFEST_SHA256");
    expect(dockerfile).toContain("scripts/verify-freeze.ts --expect");
    expect(dockerfile).toContain("RUN mkdir -p /input /output");
    expect(dockerfile).toContain("RUN chmod -R a-w /evaluator /ms-playwright");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("scripts/evaluate-renderable.ts");
  });

  it("defines a PR Docker build/run workflow with isolation probes", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const workflow = await readFile(
      path.join(root, ".github/workflows/evaluator-isolation.yml"),
      "utf8",
    );

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("docker build");
    expect(workflow).toContain("EXPECTED_MANIFEST_SHA256");
    expect(workflow).toContain("--network none");
    expect(workflow).toContain("--read-only");
    expect(workflow).toContain("--cap-drop ALL");
    expect(workflow).toContain("--security-opt no-new-privileges");
    expect(workflow).toContain("dst=/input/renderable.json,readonly");
    expect(workflow).toContain("dst=/output");
    expect(workflow).toContain("UNSUPPORTED_RENDERABLE_NODE");
    expect(workflow).toContain("ReadonlyRootfs == true");
    expect(workflow).toContain("NetworkMode == \"none\"");
    expect(workflow).toContain("writeFileSync(\"/evaluator/.write-probe\"");
    expect(workflow).toContain("writeFileSync(\"/input/renderable.json\"");
    expect(workflow).toContain("fetch(\"https://example.com\"");
  });
});
