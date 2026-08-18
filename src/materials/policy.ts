import { Mesh, MeshStandardMaterial, type Object3D } from "three";

export const MATERIAL_MODES = ["authored", "neutral"] as const;
export type MaterialMode = (typeof MATERIAL_MODES)[number];

export const NEUTRAL_MATERIAL_SPEC = Object.freeze({
  color: "#b8b8b8",
  roughness: 0.8,
  metalness: 0,
});

function createNeutralMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial(NEUTRAL_MATERIAL_SPEC);
  material.name = "environment-v0:neutral-evaluation";
  return material;
}

export function applyMaterialPolicy(
  source: Object3D,
  mode: MaterialMode,
): Object3D {
  const result = source.clone(true);
  if (mode === "authored") return result;
  if (mode !== "neutral") throw new Error(`Unknown material mode '${String(mode)}'.`);

  const neutral = createNeutralMaterial();
  result.traverse((object) => {
    if (object instanceof Mesh) object.material = neutral;
  });
  return result;
}
