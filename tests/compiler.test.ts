import { Matrix4, Mesh } from "three";
import { describe, expect, it } from "vitest";
import smoke from "../fixtures/smoke/assembly.json";
import { compileAssembly } from "../src/compiler/compile";
import {
  countGeometryTriangles,
  createPrimitiveGeometry,
} from "../src/compiler/primitives";
import { PRIMITIVE_NAMES, type Assembly } from "../src/types";
import { FIXED_ENVIRONMENT } from "../src/viewer/environment";
import { normalizeCompiledObject } from "../src/viewer/normalize";
import { WORLD_SPEC } from "../src/world";

describe("deterministic compiler", () => {
  it("keeps declared triangle costs equal to the fixed geometries", () => {
    for (const primitive of PRIMITIVE_NAMES) {
      expect(countGeometryTriangles(createPrimitiveGeometry(primitive))).toBe(
        WORLD_SPEC.primitiveTriangleCosts[primitive],
      );
    }
  });

  it("executes an exact local mirror relation", () => {
    const compiled = compileAssembly({
      version: "1.0",
      parts: [
        {
          id: "left",
          primitive: "wedge",
          parent: null,
          position: [-1, 0.25, 0.5],
          rotation: [15, 30, 45],
          scale: [0.5, 1.25, 0.75],
          material: "teal",
        },
        { id: "right", mirrorOf: "left", axis: "x" },
      ],
    });

    const left = compiled.getObjectByName("left") as Mesh;
    const right = compiled.getObjectByName("right") as Mesh;
    const expected = new Matrix4().makeScale(-1, 1, 1).multiply(left.matrix.clone());

    expect(right.matrix.elements).toEqual(expected.elements);
    expect(Array.from(right.geometry.getAttribute("position").array)).toEqual(
      Array.from(left.geometry.getAttribute("position").array),
    );
    expect(right.userData).toMatchObject({
      derived: true,
      mirrorOf: "left",
      axis: "x",
    });
  });

  it("produces identical matrices for repeated compilation", () => {
    const first = compileAssembly(smoke as Assembly);
    const second = compileAssembly(smoke as Assembly);
    const matrices = (root: typeof first) => {
      const values: Record<string, number[]> = {};
      root.traverse((object) => {
        if (object.name) values[object.name] = [...object.matrix.elements];
      });
      return values;
    };
    expect(matrices(first)).toEqual(matrices(second));
  });

  it("compiles and normalizes smoke without modifying the fixed environment", () => {
    const before = JSON.stringify(FIXED_ENVIRONMENT);
    const compiled = compileAssembly(smoke as Assembly);
    const normalized = normalizeCompiledObject(compiled);

    expect(normalized.uniformScale).toBeGreaterThan(0);
    expect(JSON.stringify(FIXED_ENVIRONMENT)).toBe(before);
  });
});
