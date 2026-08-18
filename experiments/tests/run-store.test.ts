import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FAILURE_CODES } from "../runner/failures";
import { RunStore } from "../runner/run-store";
import taxonomy from "../protocol/failure-taxonomy-v1.json";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("run evidence storage", () => {
  it("creates files exclusively and never reuses a run directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "run-store-test-"));
    cleanup.push(root);
    const first = await RunStore.create(root, "run-001");
    await first.writeText("prompt.txt", "one");
    await expect(first.writeText("prompt.txt", "two")).rejects.toMatchObject({
      code: "EEXIST",
    });
    await expect(RunStore.create(root, "run-001")).rejects.toThrow(
      "will not be overwritten",
    );
    expect(await readFile(first.path("prompt.txt"), "utf8")).toBe("one");
  });

  it("keeps the machine-readable failure taxonomy synchronized", () => {
    expect(taxonomy.codes).toEqual([...FAILURE_CODES]);
  });
});
