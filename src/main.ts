import type { Group } from "three";
import smokeAssembly from "../fixtures/smoke/assembly.json";
import { compileAssembly } from "./compiler/compile";
import "./style.css";
import type { Assembly } from "./types";
import { validateAssemblyDocument, AssemblyValidationError } from "./validation/semantic";
import {
  createFixedEnvironment,
  positionCameraForYaw,
  type FixedEnvironment,
} from "./viewer/environment";
import { normalizeCompiledObject } from "./viewer/normalize";

declare global {
  interface Window {
    worldCompiler: {
      loadAssembly: (assembly: Assembly) => void;
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

function loadAssembly(assembly: Assembly): void {
  const validation = validateAssemblyDocument(assembly);
  if (!validation.valid) throw new AssemblyValidationError(validation.errors);

  if (currentObject) environment.content.remove(currentObject);
  const compiled = compileAssembly(assembly);
  currentObject = normalizeCompiledObject(compiled).object;
  environment.content.add(currentObject);
  environment.scene.updateMatrixWorld(true);
  renderYaw(0);
}

window.worldCompiler = { loadAssembly, renderYaw };
loadAssembly(smokeAssembly as Assembly);
