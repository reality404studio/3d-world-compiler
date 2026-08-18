import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

export const FIXED_ENVIRONMENT = Object.freeze({
  width: 512,
  height: 512,
  background: "#e7e4de",
  camera: Object.freeze({
    halfExtent: 1.65,
    near: 0.1,
    far: 100,
    radius: 5,
    elevationDegrees: 20,
  }),
  lighting: Object.freeze({
    ambientIntensity: 1.5,
    keyIntensity: 2.2,
    keyPosition: Object.freeze([3, 5, 4] as const),
  }),
  normalization: Object.freeze({ targetMaxExtent: 2.2 }),
  captureYaws: Object.freeze([0, 45, 90, 180, 270, 315] as const),
});

export interface FixedEnvironment {
  scene: Scene;
  content: Group;
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
}

export function createFixedEnvironment(container: HTMLElement): FixedEnvironment {
  const scene = new Scene();
  scene.background = new Color(FIXED_ENVIRONMENT.background);

  const half = FIXED_ENVIRONMENT.camera.halfExtent;
  const camera = new OrthographicCamera(
    -half,
    half,
    half,
    -half,
    FIXED_ENVIRONMENT.camera.near,
    FIXED_ENVIRONMENT.camera.far,
  );

  const ambient = new AmbientLight(
    0xffffff,
    FIXED_ENVIRONMENT.lighting.ambientIntensity,
  );
  ambient.name = "fixed-ambient-light";
  scene.add(ambient);

  const key = new DirectionalLight(
    0xffffff,
    FIXED_ENVIRONMENT.lighting.keyIntensity,
  );
  key.name = "fixed-key-light";
  key.position.set(...FIXED_ENVIRONMENT.lighting.keyPosition);
  scene.add(key);

  const content = new Group();
  content.name = "normalized-content";
  scene.add(content);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(FIXED_ENVIRONMENT.width, FIXED_ENVIRONMENT.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  container.replaceChildren(renderer.domElement);

  return { scene, content, camera, renderer };
}

export function positionCameraForYaw(
  camera: OrthographicCamera,
  yawDegrees: number,
): void {
  const yaw = (yawDegrees * Math.PI) / 180;
  const elevation = (FIXED_ENVIRONMENT.camera.elevationDegrees * Math.PI) / 180;
  const horizontalRadius = FIXED_ENVIRONMENT.camera.radius * Math.cos(elevation);
  camera.position.set(
    horizontalRadius * Math.sin(yaw),
    FIXED_ENVIRONMENT.camera.radius * Math.sin(elevation),
    horizontalRadius * Math.cos(yaw),
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
}
