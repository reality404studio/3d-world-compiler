import { describe, expect, it } from "vitest";
import smoke from "../fixtures/smoke/assembly.json";
import malformedMirror from "../fixtures/invalid/malformed-mirror.json";
import type { Assembly, BasePart } from "../src/types";
import { validateAssemblyDocument } from "../src/validation/semantic";
import { validateWorldSyntax } from "../src/validation/schema";
import world from "../world/world-v0.json";

function basePart(id = "part"): BasePart {
  return {
    id,
    primitive: "box",
    parent: null,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: "clay",
  };
}

function assembly(parts: Assembly["parts"]): Assembly {
  return { version: "1.0", parts };
}

function codes(document: unknown): string[] {
  return validateAssemblyDocument(document).errors.map((error) => error.code);
}

describe("assembly validation", () => {
  it("accepts the bundled world specification", () => {
    expect(validateWorldSyntax(world).valid).toBe(true);
  });

  it("accepts the legal smoke fixture", () => {
    expect(validateAssemblyDocument(smoke).valid).toBe(true);
  });

  it("rejects unknown primitives", () => {
    const part = basePart();
    part.primitive = "pyramid";
    expect(codes(assembly([part]))).toContain("INVALID_PRIMITIVE");
  });

  it("rejects unknown materials", () => {
    const part = basePart();
    part.material = "invented";
    expect(codes(assembly([part]))).toContain("UNKNOWN_MATERIAL");
  });

  it.each(["toString", "constructor", "__proto__"])(
    "rejects inherited prototype material name %s",
    (material) => {
      const part = basePart();
      part.material = material;
      expect(codes(assembly([part]))).toContain("UNKNOWN_MATERIAL");
    },
  );

  it("rejects broken parent references", () => {
    const part = basePart();
    part.parent = "missing";
    expect(codes(assembly([part]))).toContain("UNKNOWN_PARENT");
  });

  it("rejects parent cycles", () => {
    const first = basePart("first");
    const second = basePart("second");
    first.parent = "second";
    second.parent = "first";
    expect(codes(assembly([first, second]))).toContain("PARENT_CYCLE");
  });

  it("rejects multiple effective roots", () => {
    expect(codes(assembly([basePart("first"), basePart("second")]))).toContain(
      "ROOT_COUNT_INVALID",
    );
  });

  it("allows a floating child because parenthood is hierarchy, not contact", () => {
    const child = basePart("child");
    child.parent = "root";
    child.position = [4, 4, 4];
    expect(validateAssemblyDocument(assembly([basePart("root"), child])).valid).toBe(
      true,
    );
  });

  it("rejects transform bounds violations", () => {
    const part = basePart();
    part.position = [4.1, 0, 0];
    expect(codes(assembly([part]))).toContain("OUT_OF_RANGE");
  });

  it("rejects non-finite transform values", () => {
    const part = basePart();
    part.scale = [Number.POSITIVE_INFINITY, 1, 1];
    expect(codes(assembly([part]))).toContain("NON_FINITE_NUMBER");
  });

  it("rejects rotations outside the 15-degree quantum", () => {
    const part = basePart();
    part.rotation = [0, 7, 0];
    expect(codes(assembly([part]))).toContain("ROTATION_NOT_QUANTIZED");
  });

  it("rejects excessive part counts", () => {
    const parts = Array.from({ length: 25 }, (_, index) => basePart(`part-${index}`));
    expect(codes(assembly(parts))).toContain("PART_LIMIT_EXCEEDED");
  });

  it("rejects assemblies over the fixed triangle budget", () => {
    const parts = Array.from({ length: 17 }, (_, index) => {
      const part = basePart(`capsule-${index}`);
      part.primitive = "capsule";
      part.parent = index === 0 ? null : "capsule-0";
      return part;
    });
    expect(codes(assembly(parts))).toContain("TRIANGLE_BUDGET_EXCEEDED");
  });

  it("rejects duplicate ids", () => {
    expect(codes(assembly([basePart("same"), basePart("same")]))).toContain(
      "DUPLICATE_PART_ID",
    );
  });

  it("rejects malformed mirror records during schema validation", () => {
    const result = validateAssemblyDocument(malformedMirror);
    expect(result.valid).toBe(false);
    expect(result.phase).toBe("schema");
    expect(result.errors.every((error) => error.code === "SCHEMA_INVALID")).toBe(true);
  });

  it("rejects mirror chains", () => {
    const document = assembly([
      basePart("left"),
      { id: "right", mirrorOf: "left", axis: "x" },
      { id: "third", mirrorOf: "right", axis: "x" },
    ]);
    expect(codes(document)).toContain("MIRROR_SOURCE_NOT_EXPLICIT");
  });
});
