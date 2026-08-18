import {
  Group,
  Mesh,
  Object3D,
  ObjectLoader,
  type Object3DJSON,
} from "three";

export const RENDERABLE_VERSION = "renderable-v0" as const;
export const UNSUPPORTED_RENDERABLE_NODE = "UNSUPPORTED_RENDERABLE_NODE" as const;

export interface RenderableScene {
  version: typeof RENDERABLE_VERSION;
  object: Object3DJSON;
}

export interface RenderableNodeIssue {
  code: typeof UNSUPPORTED_RENDERABLE_NODE;
  path: string;
  nodeType: string;
  constructorName: string;
  message: string;
}

export interface RenderableNodeValidationResult {
  valid: boolean;
  code: typeof UNSUPPORTED_RENDERABLE_NODE | null;
  errors: RenderableNodeIssue[];
}

const ALLOWED_NODE_PROTOTYPES = new Map<object, string>([
  [Object3D.prototype, "Object3D"],
  [Group.prototype, "Group"],
  [Mesh.prototype, "Mesh"],
]);
const ALLOWED_SERIALIZED_NODE_TYPES = new Set(ALLOWED_NODE_PROTOTYPES.values());

function describeNode(value: unknown): {
  nodeType: string;
  constructorName: string;
} {
  if (!value || typeof value !== "object") {
    return { nodeType: typeof value, constructorName: "unknown" };
  }
  const candidate = value as { type?: unknown; constructor?: { name?: unknown } };
  return {
    nodeType:
      typeof candidate.type === "string" ? candidate.type : "unknown",
    constructorName:
      typeof candidate.constructor?.name === "string"
        ? candidate.constructor.name
        : "unknown",
  };
}

export function validateRenderableObject(
  root: Object3D,
): RenderableNodeValidationResult {
  const errors: RenderableNodeIssue[] = [];
  const seen = new Set<object>();
  const pending: Array<{ node: unknown; path: string }> = [
    { node: root, path: "$" },
  ];

  while (pending.length > 0) {
    const current = pending.pop()!;
    const description = describeNode(current.node);

    if (!current.node || typeof current.node !== "object") {
      errors.push({
        code: UNSUPPORTED_RENDERABLE_NODE,
        path: current.path,
        ...description,
        message: "Renderable nodes must be Three.js Object3D instances.",
      });
      continue;
    }

    if (seen.has(current.node)) {
      errors.push({
        code: UNSUPPORTED_RENDERABLE_NODE,
        path: current.path,
        ...description,
        message: "Renderable graphs must be acyclic trees without shared nodes.",
      });
      continue;
    }
    seen.add(current.node);

    const expectedType = ALLOWED_NODE_PROTOTYPES.get(
      Object.getPrototypeOf(current.node),
    );
    if (!expectedType || description.nodeType !== expectedType) {
      errors.push({
        code: UNSUPPORTED_RENDERABLE_NODE,
        path: current.path,
        ...description,
        message:
          "renderable-v0 permits only exact Object3D, Group, and Mesh nodes.",
      });
      continue;
    }

    const children = (current.node as Object3D).children;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push({
        node: children[index],
        path: `${current.path}.children[${index}]`,
      });
    }
  }

  return errors.length === 0
    ? { valid: true, code: null, errors: [] }
    : { valid: false, code: UNSUPPORTED_RENDERABLE_NODE, errors };
}

export class UnsupportedRenderableNodeError extends Error {
  readonly code = UNSUPPORTED_RENDERABLE_NODE;
  readonly errors: RenderableNodeIssue[];

  constructor(errors: RenderableNodeIssue[]) {
    super(UNSUPPORTED_RENDERABLE_NODE);
    this.name = "UnsupportedRenderableNodeError";
    this.errors = errors;
  }
}

export function assertRenderableObject(root: Object3D): void {
  const result = validateRenderableObject(root);
  if (!result.valid) throw new UnsupportedRenderableNodeError(result.errors);
}

function assertSerializedNodeTypes(document: Object3DJSON): void {
  const documentRoot = (document as unknown as { object?: unknown }).object;
  const errors: RenderableNodeIssue[] = [];
  const pending: Array<{ node: unknown; path: string }> = [
    { node: documentRoot, path: "$.object" },
  ];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (!current.node || typeof current.node !== "object") {
      errors.push({
        code: UNSUPPORTED_RENDERABLE_NODE,
        path: current.path,
        nodeType: typeof current.node,
        constructorName: "serialized",
        message: "Serialized renderable nodes must be objects.",
      });
      continue;
    }

    const node = current.node as { type?: unknown; children?: unknown };
    const nodeType = typeof node.type === "string" ? node.type : "unknown";
    if (!ALLOWED_SERIALIZED_NODE_TYPES.has(nodeType)) {
      errors.push({
        code: UNSUPPORTED_RENDERABLE_NODE,
        path: current.path,
        nodeType,
        constructorName: "serialized",
        message:
          "renderable-v0 serialized nodes permit only Object3D, Group, and Mesh types.",
      });
      continue;
    }

    if (node.children !== undefined && !Array.isArray(node.children)) {
      errors.push({
        code: UNSUPPORTED_RENDERABLE_NODE,
        path: `${current.path}.children`,
        nodeType,
        constructorName: "serialized",
        message: "Serialized renderable children must be an array.",
      });
      continue;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push({
        node: children[index],
        path: `${current.path}.children[${index}]`,
      });
    }
  }

  if (errors.length > 0) throw new UnsupportedRenderableNodeError(errors);
}

export function serializeRenderableObject(object: Object3D): RenderableScene {
  assertRenderableObject(object);
  object.updateMatrixWorld(true);
  return {
    version: RENDERABLE_VERSION,
    object: object.toJSON(),
  };
}

export function parseRenderableScene(renderable: RenderableScene): Object3D {
  if (
    !renderable ||
    renderable.version !== RENDERABLE_VERSION ||
    !renderable.object ||
    typeof renderable.object !== "object"
  ) {
    throw new Error("Renderable content does not match renderable-v0.");
  }
  assertSerializedNodeTypes(renderable.object);
  const parsed = new ObjectLoader().parse(renderable.object);
  assertRenderableObject(parsed);
  return parsed;
}
