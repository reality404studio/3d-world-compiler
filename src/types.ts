export const PRIMITIVE_NAMES = [
  "sphere",
  "ellipsoid",
  "capsule",
  "cone",
  "frustum",
  "box",
  "wedge",
  "tube",
] as const;

export type PrimitiveName = (typeof PRIMITIVE_NAMES)[number];
export type Axis = "x" | "y" | "z";
export type Vec3 = [number, number, number];

export interface BasePart {
  id: string;
  primitive: PrimitiveName | string;
  parent: string | null;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  material: string;
}

export interface MirroredPart {
  id: string;
  mirrorOf: string;
  axis: Axis;
}

export type AssemblyPart = BasePart | MirroredPart;

export interface Assembly {
  version: "1.0";
  parts: AssemblyPart[];
}

export interface MaterialSpec {
  color: string;
  roughness: number;
  metalness: number;
}

export interface WorldSpec {
  version: "world-v0";
  allowedPrimitives: PrimitiveName[];
  allowedMaterials: Record<string, MaterialSpec>;
  maxParts: number;
  transformBounds: {
    position: { min: number; max: number };
    rotation: { min: number; max: number };
    scale: { min: number; max: number };
  };
  rotationQuantizationDegrees: number;
  maxTriangles: number;
  primitiveTriangleCosts: Record<PrimitiveName, number>;
  structuralRules: {
    requireAtLeastOneRoot: boolean;
    mirrorSourceMustBeExplicit: boolean;
  };
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  phase: "schema" | "semantic";
  errors: ValidationIssue[];
}

export function isMirroredPart(part: AssemblyPart): part is MirroredPart {
  return "mirrorOf" in part;
}
