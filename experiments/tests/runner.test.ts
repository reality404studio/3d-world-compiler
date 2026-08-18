import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";
import { Group } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { serializeRenderableObject } from "../../src/observation/renderable";
import runManifestSchema from "../schemas/run-manifest.schema.json";
import { executeExperimentRun } from "../runner/run";
import {
  MockGemini,
  RecordingEvaluator,
  UnexpectedSubject,
  VALID_ASSEMBLY,
  generation,
  temporaryRunInput,
} from "./helpers";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("experiment runner", () => {
  it("preserves C0 source exactly and hands only renderable-v0 onward", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    const source = "export default function build(THREE) { return new THREE.Group(); }\n";
    const successfulGeneration = generation(source);
    successfulGeneration.transportRetries = 1;
    successfulGeneration.attempts = [
      {
        attempt_number: 1,
        latency_ms: 4,
        http_status: 503,
        outcome: "API_TRANSPORT_RETRY",
      },
      {
        attempt_number: 2,
        latency_ms: 8,
        http_status: 200,
        outcome: "SUCCESS",
      },
    ];
    successfulGeneration.requestEvidence.api_attempt_number = 2;
    const gemini = new MockGemini(successfulGeneration);
    const evaluator = new RecordingEvaluator();
    const subject = {
      imageDigest:
        "ghcr.io/reality404studio/3d-world-compiler-subject@sha256:0e87afc4d3b63d5fede4117393299bae131a48fcc68416d9d39e437738240bd7",
      calls: [] as string[],
      async execute(value: string) {
        this.calls.push(value);
        return {
          status: "SUCCESS" as const,
          exitCode: 0,
          timedOut: false,
          stdout: "subject output",
          stderr: "",
          renderable: serializeRenderableObject(new Group()),
          durationMs: 3,
        };
      },
    };
    const result = await executeExperimentRun(
      {
        runId: "c0-success",
        condition: "C0",
        assetId: "synthetic",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
        referenceRegistryDirectory: fixture.referenceRegistryDirectory,
      },
      { gemini, subject, evaluator },
    );
    expect(subject.calls).toEqual([source]);
    expect(await readFile(path.join(result.directory, "subject-source.js"), "utf8")).toBe(source);
    expect(result.manifest).toMatchObject({
      subject_exit_status: "SUCCESS",
      validation_status: "RENDERABLE_VALID",
      evaluator_status: "SUCCESS",
      failure_code: null,
      api_transport_retries: 1,
      subject_image_digest:
        "ghcr.io/reality404studio/3d-world-compiler-subject@sha256:0e87afc4d3b63d5fede4117393299bae131a48fcc68416d9d39e437738240bd7",
    });
    const initialRequest = JSON.parse(
      await readFile(path.join(result.directory, "request.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(initialRequest).not.toHaveProperty("api_attempt_number");
    expect(
      JSON.parse(
        await readFile(
          path.join(result.directory, "reference-registration.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({
      version: "reference-registration-v1",
      asset_id: "synthetic",
      expected_sha256: initialRequest.reference_sha256,
    });
    expect(
      JSON.parse(
        await readFile(path.join(result.directory, "request-evidence.json"), "utf8"),
      ),
    ).toEqual(successfulGeneration.requestEvidence);
    expect(evaluator.calls).toHaveLength(1);
  });

  it("persists complete subject failure evidence and process logs", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    const evaluator = new RecordingEvaluator();
    const details = {
      path: "$.children[0]",
      nodeType: "AmbientLight",
      constructorName: "AmbientLight",
    };
    const subject = {
      imageDigest:
        "ghcr.io/reality404studio/3d-world-compiler-subject@sha256:0e87afc4d3b63d5fede4117393299bae131a48fcc68416d9d39e437738240bd7",
      async execute() {
        return {
          status: "UNSUPPORTED_RENDERABLE_NODE" as const,
          message: "UNSUPPORTED_RENDERABLE_NODE",
          details,
          exitCode: 1,
          timedOut: false,
          stdout: "subject stdout",
          stderr: "subject stderr",
          renderable: null,
          durationMs: 7,
        };
      },
    };
    const result = await executeExperimentRun(
      {
        runId: "c0-subject-failure-evidence",
        condition: "C0",
        assetId: "synthetic",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
        referenceRegistryDirectory: fixture.referenceRegistryDirectory,
      },
      {
        gemini: new MockGemini(generation("subject source")),
        subject,
        evaluator,
      },
    );

    expect(
      JSON.parse(
        await readFile(path.join(result.directory, "execution.json"), "utf8"),
      ),
    ).toEqual({
      status: "UNSUPPORTED_RENDERABLE_NODE",
      message: "UNSUPPORTED_RENDERABLE_NODE",
      details,
      exit_code: 1,
      timed_out: false,
      duration_ms: 7,
    });
    expect(
      await readFile(
        path.join(result.directory, "logs/subject.stdout.log"),
        "utf8",
      ),
    ).toBe("subject stdout");
    expect(
      await readFile(
        path.join(result.directory, "logs/subject.stderr.log"),
        "utf8",
      ),
    ).toBe("subject stderr");
    expect(result.manifest.failure_code).toBe("UNSUPPORTED_RENDERABLE_NODE");
    expect(evaluator.calls).toHaveLength(0);
  });

  it("creates a complete C2 manifest and hands one renderable to the evaluator", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    const gemini = new MockGemini(generation(VALID_ASSEMBLY));
    const evaluator = new RecordingEvaluator();
    const result = await executeExperimentRun(
      {
        runId: "c2-success",
        condition: "C2",
        assetId: "synthetic",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
        referenceRegistryDirectory: fixture.referenceRegistryDirectory,
      },
      {
        gemini,
        subject: new UnexpectedSubject(),
        evaluator,
        now: () => new Date("2026-08-18T08:00:00.000Z"),
      },
    );
    expect(result.manifest).toMatchObject({
      run_id: "c2-success",
      condition: "C2",
      model_id: "gemini-3.7-flash",
      subject_exit_status: "NOT_APPLICABLE",
      validation_status: "VALID",
      evaluator_status: "SUCCESS",
      api_transport_retries: 0,
      model_repairs: 0,
      failure_code: null,
      environment_commit: "91501a2e90d5d550acff01c3255f72c650ba1c03",
      subject_image_digest: null,
    });
    const validate = new Ajv({ strict: false }).compile(runManifestSchema);
    expect(validate(result.manifest), validate.errors?.map((error) => error.message).join(", ")).toBe(true);
    expect(evaluator.calls).toHaveLength(1);
    const renderable = JSON.parse(
      await readFile(evaluator.calls[0]!.renderableFile, "utf8"),
    ) as { version: string };
    expect(renderable.version).toBe("renderable-v0");
    expect(await readFile(path.join(result.directory, "prompt.txt"), "utf8")).toContain(
      "ASSEMBLY SCHEMA",
    );
    expect(await readFile(path.join(result.directory, "raw-response.txt"), "utf8")).toBe(
      generation(VALID_ASSEMBLY).rawResponseText,
    );
  });

  it("does not silently repair malformed C2 output", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    const gemini = new MockGemini(generation(`\`\`\`json\n${VALID_ASSEMBLY}\n\`\`\``));
    const evaluator = new RecordingEvaluator();
    const result = await executeExperimentRun(
      {
        runId: "c2-malformed",
        condition: "C2",
        assetId: "synthetic",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
        referenceRegistryDirectory: fixture.referenceRegistryDirectory,
      },
      { gemini, subject: new UnexpectedSubject(), evaluator },
    );
    expect(result.manifest.failure_code).toBe("MODEL_OUTPUT_PARSE_FAILURE");
    expect(result.manifest.model_repairs).toBe(0);
    expect(evaluator.calls).toHaveLength(0);
    await expect(readFile(path.join(result.directory, "assembly.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(gemini.calls).toHaveLength(1);
  });

  it("refuses C3 without spending an API call", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    const gemini = new MockGemini(generation(VALID_ASSEMBLY));
    const evaluator = new RecordingEvaluator();
    const result = await executeExperimentRun(
      {
        runId: "c3-refused",
        condition: "C3",
        assetId: "synthetic",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
        referenceRegistryDirectory: fixture.referenceRegistryDirectory,
      },
      { gemini, subject: new UnexpectedSubject(), evaluator },
    );
    expect(result.manifest.failure_code).toBe("C3_VERIFIER_NOT_FROZEN");
    expect(result.manifest.subject_image_digest).toBeNull();
    expect(result.manifest.validation_status).toBe("C3_VERIFIER_NOT_FROZEN");
    expect(gemini.calls).toHaveLength(0);
    expect(evaluator.calls).toHaveLength(0);
  });
});
