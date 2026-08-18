import type {
  Assembly,
  AssemblyPart,
  BasePart,
  PrimitiveName,
  ValidationIssue,
  ValidationResult,
  Vec3,
  WorldSpec,
} from "../types";
import { isMirroredPart } from "../types";
import { WORLD_SPEC } from "../world";
import { validateAssemblySyntax } from "./schema";

function issue(
  code: string,
  path: string,
  message: string,
  details?: Record<string, unknown>,
): ValidationIssue {
  return { code, path, message, ...(details ? { details } : {}) };
}

function validateVector(
  vector: Vec3,
  path: string,
  bounds: { min: number; max: number },
  errors: ValidationIssue[],
): void {
  vector.forEach((value, component) => {
    const componentPath = `${path}/${component}`;
    if (!Number.isFinite(value)) {
      errors.push(
        issue("NON_FINITE_NUMBER", componentPath, "Transform values must be finite."),
      );
      return;
    }
    if (value < bounds.min || value > bounds.max) {
      errors.push(
        issue("OUT_OF_RANGE", componentPath, "Transform value is outside world bounds.", {
          value,
          min: bounds.min,
          max: bounds.max,
        }),
      );
    }
  });
}

function effectiveParent(
  part: AssemblyPart,
  partById: ReadonlyMap<string, AssemblyPart>,
): string | null | undefined {
  if (!isMirroredPart(part)) {
    return part.parent;
  }
  const source = partById.get(part.mirrorOf);
  return source && !isMirroredPart(source) ? source.parent : undefined;
}

function detectParentCycles(
  parts: AssemblyPart[],
  partById: ReadonlyMap<string, AssemblyPart>,
): ValidationIssue[] {
  const state = new Map<string, "visiting" | "done">();
  const cycleIds = new Set<string>();

  const visit = (id: string, stack: string[]): void => {
    const currentState = state.get(id);
    if (currentState === "done") return;
    if (currentState === "visiting") {
      const start = stack.indexOf(id);
      for (const cycleId of stack.slice(start)) cycleIds.add(cycleId);
      return;
    }

    const part = partById.get(id);
    if (!part) return;
    state.set(id, "visiting");
    const parent = effectiveParent(part, partById);
    if (parent && partById.has(parent)) visit(parent, [...stack, id]);
    state.set(id, "done");
  };

  for (const part of parts) visit(part.id, []);

  if (cycleIds.size === 0) return [];
  return [
    issue("PARENT_CYCLE", "/parts", "Parent relationships must form an acyclic forest.", {
      partIds: [...cycleIds].sort(),
    }),
  ];
}

function triangleCost(
  part: AssemblyPart,
  partById: ReadonlyMap<string, AssemblyPart>,
  world: WorldSpec,
): number {
  const source = isMirroredPart(part) ? partById.get(part.mirrorOf) : part;
  if (!source || isMirroredPart(source)) return 0;
  return world.primitiveTriangleCosts[source.primitive as PrimitiveName] ?? 0;
}

export function validateAssemblySemantics(
  assembly: Assembly,
  world: WorldSpec = WORLD_SPEC,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const partById = new Map<string, AssemblyPart>();
  const duplicateIds = new Set<string>();

  if (assembly.parts.length > world.maxParts) {
    errors.push(
      issue("PART_LIMIT_EXCEEDED", "/parts", "Assembly exceeds the world part limit.", {
        actual: assembly.parts.length,
        maximum: world.maxParts,
      }),
    );
  }

  for (const part of assembly.parts) {
    if (partById.has(part.id)) duplicateIds.add(part.id);
    else partById.set(part.id, part);
  }

  for (const id of duplicateIds) {
    errors.push(
      issue("DUPLICATE_PART_ID", "/parts", `Part id '${id}' is duplicated.`, { id }),
    );
  }

  assembly.parts.forEach((part, index) => {
    const path = `/parts/${index}`;
    if (isMirroredPart(part)) {
      if (part.mirrorOf === part.id) {
        errors.push(
          issue("MIRROR_SELF_REFERENCE", `${path}/mirrorOf`, "A part cannot mirror itself."),
        );
        return;
      }
      const source = partById.get(part.mirrorOf);
      if (!source) {
        errors.push(
          issue("UNKNOWN_MIRROR_SOURCE", `${path}/mirrorOf`, "Mirror source does not exist.", {
            mirrorOf: part.mirrorOf,
          }),
        );
      } else if (isMirroredPart(source)) {
        errors.push(
          issue(
            "MIRROR_SOURCE_NOT_EXPLICIT",
            `${path}/mirrorOf`,
            "Mirror sources must be explicit base parts; mirror chains are not allowed.",
          ),
        );
      }
      return;
    }

    if (!world.allowedPrimitives.includes(part.primitive as PrimitiveName)) {
      errors.push(
        issue("INVALID_PRIMITIVE", `${path}/primitive`, "Primitive is not allowed by world-v0.", {
          primitive: part.primitive,
        }),
      );
    }
    if (!(part.material in world.allowedMaterials)) {
      errors.push(
        issue("UNKNOWN_MATERIAL", `${path}/material`, "Material is not in the fixed palette.", {
          material: part.material,
        }),
      );
    }
    if (part.parent !== null && !partById.has(part.parent)) {
      errors.push(
        issue("UNKNOWN_PARENT", `${path}/parent`, "Parent part does not exist.", {
          parent: part.parent,
        }),
      );
    }

    validateVector(
      part.position,
      `${path}/position`,
      world.transformBounds.position,
      errors,
    );
    validateVector(
      part.rotation,
      `${path}/rotation`,
      world.transformBounds.rotation,
      errors,
    );
    validateVector(part.scale, `${path}/scale`, world.transformBounds.scale, errors);

    part.rotation.forEach((value, component) => {
      if (!Number.isFinite(value)) return;
      const units = value / world.rotationQuantizationDegrees;
      if (Math.abs(units - Math.round(units)) > 1e-9) {
        errors.push(
          issue(
            "ROTATION_NOT_QUANTIZED",
            `${path}/rotation/${component}`,
            `Rotation must be a multiple of ${world.rotationQuantizationDegrees} degrees.`,
            { value, quantum: world.rotationQuantizationDegrees },
          ),
        );
      }
    });
  });

  if (duplicateIds.size === 0) {
    errors.push(...detectParentCycles(assembly.parts, partById));
  }

  if (world.structuralRules.requireAtLeastOneRoot) {
    const hasRoot = assembly.parts.some(
      (part) => effectiveParent(part, partById) === null,
    );
    if (!hasRoot) {
      errors.push(
        issue("ROOT_REQUIRED", "/parts", "At least one part must resolve to a root."),
      );
    }
  }

  const triangles = assembly.parts.reduce(
    (sum, part) => sum + triangleCost(part, partById, world),
    0,
  );
  if (triangles > world.maxTriangles) {
    errors.push(
      issue(
        "TRIANGLE_BUDGET_EXCEEDED",
        "/parts",
        "Assembly exceeds the fixed geometry budget.",
        { actual: triangles, maximum: world.maxTriangles },
      ),
    );
  }

  return { valid: errors.length === 0, phase: "semantic", errors };
}

export function validateAssemblyDocument(
  data: unknown,
  world: WorldSpec = WORLD_SPEC,
): ValidationResult {
  const syntax = validateAssemblySyntax(data);
  if (!syntax.valid) return syntax;
  return validateAssemblySemantics(data as Assembly, world);
}

export class AssemblyValidationError extends Error {
  readonly errors: ValidationIssue[];

  constructor(errors: ValidationIssue[]) {
    super("Assembly validation failed.");
    this.name = "AssemblyValidationError";
    this.errors = errors;
  }
}
