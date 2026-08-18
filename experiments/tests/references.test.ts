import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { requireRegisteredReference } from "../runner/references";
import { executeExperimentRun } from "../runner/run";
import {
  MockGemini,
  RecordingEvaluator,
  UnexpectedSubject,
  VALID_ASSEMBLY,
  generation,
  temporaryRunInput,
} from "./helpers";

const execFileAsync = promisify(execFile);
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("calibration reference registration", () => {
  it("accepts the approved pikachu-v1 registry identity and SHA-256", async () => {
    await expect(
      requireRegisteredReference(
        "pikachu-v1",
        "1d76c4be52db98c47ea7772ae01936194d2622a17a61cf904733fa684a97771d",
      ),
    ).resolves.toMatchObject({
      version: "reference-registration-v1",
      asset_id: "pikachu-v1",
      expected_filename: "reference.png",
      status: "approved",
      purpose: "calibration",
    });
  });

  it("rejects different bytes before Gemini is called", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    await writeFile(fixture.referenceFile, Buffer.from("different-reference"));
    const gemini = new MockGemini(generation(VALID_ASSEMBLY));

    const result = await executeExperimentRun(
      {
        runId: "reference-hash-mismatch",
        condition: "C2",
        assetId: "pikachu-v1",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
      },
      {
        gemini,
        subject: new UnexpectedSubject(),
        evaluator: new RecordingEvaluator(),
      },
    );

    expect(result.manifest.failure_code).toBe("REFERENCE_HASH_MISMATCH");
    expect(gemini.calls).toHaveLength(0);
    expect(
      JSON.parse(
        await readFile(path.join(result.directory, "failure.json"), "utf8"),
      ),
    ).toMatchObject({ code: "REFERENCE_HASH_MISMATCH" });
  });

  it("rejects an unknown asset before Gemini is called", async () => {
    const fixture = await temporaryRunInput();
    cleanup.push(fixture.root);
    const gemini = new MockGemini(generation(VALID_ASSEMBLY));

    const result = await executeExperimentRun(
      {
        runId: "reference-not-registered",
        condition: "C2",
        assetId: "unknown",
        referenceFile: fixture.referenceFile,
        referenceMimeType: "image/png",
        runsDirectory: fixture.runsDirectory,
      },
      {
        gemini,
        subject: new UnexpectedSubject(),
        evaluator: new RecordingEvaluator(),
      },
    );

    expect(result.manifest.failure_code).toBe("REFERENCE_NOT_REGISTERED");
    expect(gemini.calls).toHaveLength(0);
  });

  it("does not track reference image files", async () => {
    const { stdout } = await execFileAsync("git", [
      "ls-files",
      "--",
      "experiments/references",
    ]);
    const trackedImages = stdout
      .split("\n")
      .filter((filename) => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(filename));
    expect(trackedImages).toEqual([]);
  });
});
