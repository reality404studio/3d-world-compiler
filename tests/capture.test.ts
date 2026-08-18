import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import smoke from "../fixtures/smoke/assembly.json";
import type { Assembly } from "../src/types";
import { captureFiveViews } from "../src/viewer/capture";
import { FIXED_ENVIRONMENT } from "../src/viewer/environment";

describe("headless five-view capture", () => {
  it("writes all fixed views at non-zero size", async () => {
    const output = await mkdtemp(path.join(tmpdir(), "world-v0-capture-"));
    const result = await captureFiveViews(smoke as Assembly, output);

    expect(result.files).toHaveLength(FIXED_ENVIRONMENT.captureYaws.length);
    expect(result.files.map((file) => path.basename(file))).toEqual([
      "view-000.png",
      "view-045.png",
      "view-090.png",
      "view-135.png",
      "view-180.png",
    ]);
    for (const file of result.files) {
      expect((await stat(file)).size).toBeGreaterThan(1000);
    }
  });
});
