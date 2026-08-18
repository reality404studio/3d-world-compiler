import { ObjectLoader, type Object3D, type Object3DJSON } from "three";

export const RENDERABLE_VERSION = "renderable-v0" as const;

export interface RenderableScene {
  version: typeof RENDERABLE_VERSION;
  object: Object3DJSON;
}

export function serializeRenderableObject(object: Object3D): RenderableScene {
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
  return new ObjectLoader().parse(renderable.object);
}
