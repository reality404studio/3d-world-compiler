import {
  Box3,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import smoke from "../fixtures/smoke/assembly.json";
import { compileAssembly } from "../src/compiler/compile";
import {
  countGeometryTriangles,
  createPrimitiveGeometry,
} from "../src/compiler/primitives";
import { PRIMITIVE_NAMES, type Assembly } from "../src/types";
import type { WorldSpec } from "../src/types";
import { applyMaterialPolicy, NEUTRAL_MATERIAL_SPEC } from "../src/materials/policy";
import {
  parseRenderableScene,
  serializeRenderableObject,
} from "../src/observation/renderable";
import { AssemblyValidationError } from "../src/validation/semantic";
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

  it("gives wedge faces hard-edge normals", () => {
    const wedge = createPrimitiveGeometry("wedge");
    const positions = wedge.getAttribute("position");
    const normals = wedge.getAttribute("normal");

    expect(wedge.index).toBeNull();
    expect(positions.count).toBe(24);
    expect(normals.count).toBe(24);

    const cornerNormals = new Set<string>();
    for (let index = 0; index < positions.count; index += 1) {
      if (
        positions.getX(index) === -0.5 &&
        positions.getY(index) === -0.5 &&
        positions.getZ(index) === 0.5
      ) {
        cornerNormals.add(
          [normals.getX(index), normals.getY(index), normals.getZ(index)]
            .map((value) => value.toFixed(6))
            .join(","),
        );
      }
    }
    expect(cornerNormals.size).toBe(3);
  });

  it("executes an exact local mirror relation", () => {
    const compiled = compileAssembly({
      version: "1.0",
      parts: [
        {
          id: "root",
          primitive: "box",
          parent: null,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [0.1, 0.1, 0.1],
          material: "clay",
        },
        {
          id: "left",
          primitive: "wedge",
          parent: "root",
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

  it("round-trips compiled content through the condition-independent renderable", () => {
    const compiled = compileAssembly(smoke as Assembly);
    const parsed = parseRenderableScene(serializeRenderableObject(compiled));
    const originalMirror = compiled.getObjectByName("right-fin");
    const parsedMirror = parsed.getObjectByName("right-fin");

    expect(parsedMirror?.matrix.elements).toEqual(originalMirror?.matrix.elements);
    expect(parsedMirror?.matrix.determinant()).toBeLessThan(0);
  });

  it("applies a shared neutral material without modifying geometry or source materials", () => {
    const source = new Group();
    const sourceMaterial = new MeshStandardMaterial({ color: "#ff0000" });
    const sourceMesh = new Mesh(new BoxGeometry(1, 1, 1), sourceMaterial);
    source.add(sourceMesh);

    const evaluated = applyMaterialPolicy(source, "neutral");
    const evaluatedMesh = evaluated.children[0] as Mesh<
      BoxGeometry,
      MeshStandardMaterial
    >;

    expect(evaluatedMesh.geometry).toBe(sourceMesh.geometry);
    expect(sourceMesh.material).toBe(sourceMaterial);
    expect(evaluatedMesh.material).not.toBe(sourceMaterial);
    expect(`#${evaluatedMesh.material.color.getHexString()}`).toBe(
      NEUTRAL_MATERIAL_SPEC.color,
    );
    expect(evaluatedMesh.material.roughness).toBe(NEUTRAL_MATERIAL_SPEC.roughness);
    expect(evaluatedMesh.material.metalness).toBe(NEUTRAL_MATERIAL_SPEC.metalness);
  });

  it("cannot expand the frozen world through a custom WorldSpec argument", () => {
    const document: Assembly = {
      version: "1.0",
      parts: [
        {
          id: "escape",
          primitive: "box",
          parent: null,
          position: [999, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          material: "custom",
        },
      ],
    };
    const customWorld = structuredClone(WORLD_SPEC) as WorldSpec;
    customWorld.transformBounds.position.max = 1000;
    customWorld.allowedMaterials.custom = {
      color: "#ffffff",
      roughness: 0,
      metalness: 1,
    };
    const attemptedBypass = compileAssembly as unknown as (
      assembly: Assembly,
      world: WorldSpec,
    ) => Group;

    expect(() => attemptedBypass(document, customWorld)).toThrow(
      AssemblyValidationError,
    );
  });

  it("compiles and normalizes smoke without modifying the fixed environment", () => {
    const before = JSON.stringify(FIXED_ENVIRONMENT);
    const compiled = compileAssembly(smoke as Assembly);
    const normalized = normalizeCompiledObject(compiled);

    expect(normalized.uniformScale).toBeGreaterThan(0);
    expect(JSON.stringify(FIXED_ENVIRONMENT)).toBe(before);
  });

  it("normalizes translation and absolute scale to the same deterministic bounds", () => {
    const makeObject = (position: Vector3, scale: number): Group => {
      const root = new Group();
      const mesh = new Mesh(
        new BoxGeometry(1, 2, 0.5),
        new MeshStandardMaterial(),
      );
      mesh.position.copy(position);
      mesh.scale.setScalar(scale);
      root.add(mesh);
      return root;
    };
    const boundsOf = (object: Group): { min: number[]; max: number[] } => {
      const normalized = normalizeCompiledObject(object).object;
      const bounds = new Box3().setFromObject(normalized);
      const values = (vector: Vector3) => vector.toArray().map((value) => Number(value.toFixed(9)));
      return { min: values(bounds.min), max: values(bounds.max) };
    };

    expect(boundsOf(makeObject(new Vector3(0, 0, 0), 1))).toEqual(
      boundsOf(makeObject(new Vector3(4, 3, -2), 2)),
    );
    expect(boundsOf(makeObject(new Vector3(4, 3, -2), 2))).toEqual({
      min: [-0.55, -1.1, -0.275],
      max: [0.55, 1.1, 0.275],
    });
  });
});
