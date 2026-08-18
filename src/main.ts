import type { Group } from "three";
import "./style.css";
import { applyMaterialPolicy, type MaterialMode } from "./materials/policy";
import { parseRenderableScene, type RenderableScene } from "./observation/renderable";
import {
  createFixedEnvironment,
  positionCameraForYaw,
  type FixedEnvironment,
} from "./viewer/environment";
import { normalizeCompiledObject } from "./viewer/normalize";

declare global {
  interface Window {
    worldCompiler: {
      loadRenderable: (renderable: RenderableScene, materialMode: MaterialMode) => void;
      renderYaw: (yawDegrees: number) => void;
    };
  }
}

const mount = document.querySelector<HTMLElement>("#viewer");
if (!mount) throw new Error("Viewer mount element is missing.");

const environment: FixedEnvironment = createFixedEnvironment(mount);
let currentObject: Group | null = null;

function renderYaw(yawDegrees: number): void {
  positionCameraForYaw(environment.camera, yawDegrees);
  environment.renderer.render(environment.scene, environment.camera);
}

function loadRenderable(renderable: RenderableScene, materialMode: MaterialMode): void {
  if (currentObject) environment.content.remove(currentObject);
  const conditionObject = parseRenderableScene(renderable);
  const materialized = applyMaterialPolicy(conditionObject, materialMode);
  currentObject = normalizeCompiledObject(materialized).object;
  environment.content.add(currentObject);
  environment.scene.updateMatrixWorld(true);
  renderYaw(0);
}

window.worldCompiler = { loadRenderable, renderYaw };
