import { describe, expect, it } from "vitest";
import { buildCaptureInvocations } from "../adapters/evaluator";

const IMAGE =
  "ghcr.io/reality404studio/3d-world-compiler-evaluator@sha256:e5ec14d963e7e4b84d76af0c64de36e3841354033b92623a27e340d74fd0177f";

describe("frozen evaluator handoff", () => {
  it("constructs neutral and authored capture requests against one immutable image", () => {
    const invocations = buildCaptureInvocations(
      IMAGE,
      "/tmp/renderable.json",
      "/tmp/captures",
    );
    expect(invocations.map((item) => item.material_mode)).toEqual([
      "neutral",
      "authored",
    ]);
    for (const invocation of invocations) {
      expect(invocation.image).toBe(IMAGE);
      expect(invocation.docker_args).toEqual(
        expect.arrayContaining([
          "--network",
          "none",
          "--read-only",
          "--cap-drop",
          "ALL",
          IMAGE,
          "--material",
          invocation.material_mode,
        ]),
      );
    }
    expect(invocations[0]!.input_file).toBe(invocations[1]!.input_file);
    expect(invocations[0]!.output_directory).toMatch(/neutral$/);
    expect(invocations[1]!.output_directory).toMatch(/authored$/);
  });
});
