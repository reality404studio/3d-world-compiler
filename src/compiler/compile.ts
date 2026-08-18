import {
  Euler,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import type {
  Assembly,
  Axis,
  BasePart,
  MirroredPart,
  PrimitiveName,
} from "../types";
import { isMirroredPart } from "../types";
import { AssemblyValidationError, validateAssemblyDocument } from "../validation/semantic";
import { WORLD_SPEC } from "../world";
import { createPrimitiveGeometry } from "./primitives";

function createMaterial(name: string): MeshStandardMaterial {
  if (!Object.hasOwn(WORLD_SPEC.allowedMaterials, name)) {
    throw new Error(`Unknown material '${name}' after validation.`);
  }
  const spec = WORLD_SPEC.allowedMaterials[name];
  if (!spec) throw new Error(`Unknown material '${name}' after validation.`);
  const material = new MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
  });
  material.name = `world-v0:${name}`;
  return material;
}

function basePartMatrix(part: BasePart): Matrix4 {
  const euler = new Euler(
    MathUtils.degToRad(part.rotation[0]),
    MathUtils.degToRad(part.rotation[1]),
    MathUtils.degToRad(part.rotation[2]),
    "XYZ",
  );
  return new Matrix4().compose(
    new Vector3(...part.position),
    new Quaternion().setFromEuler(euler),
    new Vector3(...part.scale),
  );
}

function reflectionMatrix(axis: Axis): Matrix4 {
  return new Matrix4().makeScale(
    axis === "x" ? -1 : 1,
    axis === "y" ? -1 : 1,
    axis === "z" ? -1 : 1,
  );
}

function applyFixedMatrix(object: Object3D, matrix: Matrix4): void {
  object.matrixAutoUpdate = false;
  object.matrix.copy(matrix);
}

function createBaseMesh(part: BasePart): Mesh {
  const geometry = createPrimitiveGeometry(part.primitive as PrimitiveName);
  const mesh = new Mesh(geometry, createMaterial(part.material));
  mesh.name = part.id;
  mesh.userData = {
    partId: part.id,
    primitive: part.primitive,
    material: part.material,
    derived: false,
  };
  applyFixedMatrix(mesh, basePartMatrix(part));
  return mesh;
}

function createMirroredMesh(
  part: MirroredPart,
  sourcePart: BasePart,
  sourceMesh: Mesh,
): Mesh {
  const sourceMaterial = sourceMesh.material;
  if (Array.isArray(sourceMaterial)) {
    throw new Error("world-v0 primitives never use material arrays.");
  }
  const mesh = new Mesh(sourceMesh.geometry.clone(), sourceMaterial.clone());
  mesh.name = part.id;
  mesh.userData = {
    partId: part.id,
    primitive: sourcePart.primitive,
    material: sourcePart.material,
    derived: true,
    mirrorOf: part.mirrorOf,
    axis: part.axis,
  };
  applyFixedMatrix(
    mesh,
    reflectionMatrix(part.axis).multiply(sourceMesh.matrix.clone()),
  );
  return mesh;
}

export function compileAssembly(
  assembly: Assembly,
): Group {
  const validation = validateAssemblyDocument(assembly);
  if (!validation.valid) throw new AssemblyValidationError(validation.errors);

  const root = new Group();
  root.name = "compiled-assembly";
  const partById = new Map(assembly.parts.map((part) => [part.id, part]));
  const objectById = new Map<string, Mesh>();

  for (const part of assembly.parts) {
    if (!isMirroredPart(part)) objectById.set(part.id, createBaseMesh(part));
  }

  for (const part of assembly.parts) {
    if (!isMirroredPart(part)) continue;
    const sourcePart = partById.get(part.mirrorOf);
    const sourceMesh = objectById.get(part.mirrorOf);
    if (!sourcePart || isMirroredPart(sourcePart) || !sourceMesh) {
      throw new Error("Validated mirror source was not available during compilation.");
    }
    objectById.set(part.id, createMirroredMesh(part, sourcePart, sourceMesh));
  }

  for (const part of assembly.parts) {
    const object = objectById.get(part.id);
    if (!object) throw new Error(`Compiler did not create part '${part.id}'.`);
    const source = isMirroredPart(part) ? partById.get(part.mirrorOf) : part;
    const parentId = source && !isMirroredPart(source) ? source.parent : null;
    const parent = parentId ? objectById.get(parentId) : root;
    if (!parent) throw new Error(`Validated parent '${parentId}' was not compiled.`);
    parent.add(object);
  }

  root.updateMatrixWorld(true);
  return root;
}
