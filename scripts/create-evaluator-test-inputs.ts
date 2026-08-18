import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import {
  RENDERABLE_VERSION,
  serializeRenderableObject,
  type RenderableScene,
} from "../src/observation/renderable";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function makeMesh(): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(1, 1.5, 0.75),
    new MeshStandardMaterial({ color: "#d26752", roughness: 0.65 }),
  );
  mesh.name = "ci-static-mesh";
  mesh.rotation.set(0.15, 0.35, 0);
  return mesh;
}

const outputDirectory = path.resolve(option("--output") ?? "evaluator-test-inputs");
await mkdir(outputDirectory, { recursive: true });

const validRoot = new Group();
validRoot.name = "ci-valid-root";
validRoot.add(makeMesh());
const valid = serializeRenderableObject(validRoot);

const injectedRoot = new Group();
injectedRoot.name = "ci-light-injected-root";
injectedRoot.add(makeMesh());
injectedRoot.add(new DirectionalLight("#ffffff", 20));
const lightInjected = {
  version: RENDERABLE_VERSION,
  // Intentionally bypass the public serializer to model a crafted subject file.
  object: injectedRoot.toJSON(),
} as RenderableScene;

const validPath = path.join(outputDirectory, "valid.json");
const injectedPath = path.join(outputDirectory, "light-injected.json");
await Promise.all([
  writeFile(validPath, `${JSON.stringify(valid, null, 2)}\n`, "utf8"),
  writeFile(injectedPath, `${JSON.stringify(lightInjected, null, 2)}\n`, "utf8"),
]);

process.stdout.write(
  `${JSON.stringify({ validPath, lightInjectedPath: injectedPath }, null, 2)}\n`,
);
