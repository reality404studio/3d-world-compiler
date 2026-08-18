import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  type BufferGeometry as ThreeBufferGeometry,
} from "three";
import type { PrimitiveName } from "../types";

function createWedgeGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -0.5, -0.5, 0.5,
        0.5, -0.5, 0.5,
        -0.5, 0.5, 0.5,
        -0.5, -0.5, -0.5,
        0.5, -0.5, -0.5,
        -0.5, 0.5, -0.5,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0, 1, 2,
    5, 4, 3,
    0, 3, 4, 0, 4, 1,
    0, 2, 5, 0, 5, 3,
    1, 4, 5, 1, 5, 2,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

export function createPrimitiveGeometry(
  primitive: PrimitiveName,
): ThreeBufferGeometry {
  let geometry: ThreeBufferGeometry;
  switch (primitive) {
    case "sphere":
      geometry = new SphereGeometry(0.5, 16, 8);
      break;
    case "ellipsoid":
      geometry = new SphereGeometry(0.5, 16, 8);
      geometry.scale(1, 1.3, 0.8);
      break;
    case "capsule":
      geometry = new CapsuleGeometry(0.3, 0.6, 6, 12);
      break;
    case "cone":
      geometry = new ConeGeometry(0.5, 1, 16, 1, false);
      break;
    case "frustum":
      geometry = new CylinderGeometry(0.35, 0.5, 1, 16, 1, false);
      break;
    case "box":
      geometry = new BoxGeometry(1, 1, 1);
      break;
    case "wedge":
      geometry = createWedgeGeometry();
      break;
    case "tube":
      geometry = new CylinderGeometry(0.16, 0.16, 1, 12, 1, false);
      break;
  }
  geometry.name = `world-v0:${primitive}`;
  return geometry;
}

export function countGeometryTriangles(geometry: ThreeBufferGeometry): number {
  if (geometry.index) return geometry.index.count / 3;
  return geometry.getAttribute("position").count / 3;
}
