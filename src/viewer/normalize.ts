import { Box3, Group, Vector3, type Object3D } from "three";
import { FIXED_ENVIRONMENT } from "./environment";

export interface NormalizationResult {
  object: Group;
  sourceBounds: Box3;
  uniformScale: number;
}

export function normalizeCompiledObject(
  compiled: Object3D,
  targetMaxExtent = FIXED_ENVIRONMENT.normalization.targetMaxExtent,
): NormalizationResult {
  compiled.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(compiled);
  if (bounds.isEmpty()) throw new Error("Cannot normalize an empty assembly.");

  const size = bounds.getSize(new Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxExtent) || maxExtent <= 0) {
    throw new Error("Assembly bounds are degenerate or non-finite.");
  }

  const center = bounds.getCenter(new Vector3());
  compiled.position.sub(center);
  compiled.updateMatrixWorld(true);

  const wrapper = new Group();
  wrapper.name = "normalization-wrapper";
  const uniformScale = targetMaxExtent / maxExtent;
  wrapper.scale.setScalar(uniformScale);
  wrapper.add(compiled);
  wrapper.updateMatrixWorld(true);

  return { object: wrapper, sourceBounds: bounds, uniformScale };
}
