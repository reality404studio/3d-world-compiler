import {
  AmbientLight,
  Audio,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Camera,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  LOD,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import {
  RENDERABLE_VERSION,
  UNSUPPORTED_RENDERABLE_NODE,
  UnsupportedRenderableNodeError,
  parseRenderableScene,
  serializeRenderableObject,
  validateRenderableObject,
  type RenderableScene,
} from "../src/observation/renderable";

function expectUnsupported(action: () => unknown): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(UnsupportedRenderableNodeError);
  expect((thrown as UnsupportedRenderableNodeError).code).toBe(
    UNSUPPORTED_RENDERABLE_NODE,
  );
  expect((thrown as UnsupportedRenderableNodeError).errors.length).toBeGreaterThan(0);
}

describe("renderable-v0 node policy", () => {
  it("accepts exact Object3D, Group, and Mesh nodes with arbitrary triangle geometry", () => {
    const root = new Object3D();
    const group = new Group();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        3,
      ),
    );
    group.add(new Mesh(geometry, new MeshStandardMaterial()));
    root.add(group);

    expect(validateRenderableObject(root)).toEqual({
      valid: true,
      code: null,
      errors: [],
    });
    expect(parseRenderableScene(serializeRenderableObject(root))).toBeInstanceOf(
      Object3D,
    );
  });

  it.each([
    ["DirectionalLight", () => new DirectionalLight()],
    ["AmbientLight", () => new AmbientLight()],
    ["Camera", () => new Camera()],
    ["Scene", () => new Scene()],
    ["Sprite", () => new Sprite(new SpriteMaterial())],
    ["Points", () => new Points(new BufferGeometry(), new PointsMaterial())],
    ["Line", () => new Line(new BufferGeometry(), new LineBasicMaterial())],
    [
      "LineSegments",
      () => new LineSegments(new BufferGeometry(), new LineBasicMaterial()),
    ],
    ["LOD", () => new LOD()],
  ])("rejects a direct %s before serialization", (_name, createNode) => {
    expectUnsupported(() => serializeRenderableObject(createNode()));
  });

  it("rejects audio-related and unknown Object3D subclasses", () => {
    class SubjectDefinedNode extends Object3D {}
    const audioWithoutRuntimeContext = Object.create(Audio.prototype) as Object3D;

    expectUnsupported(() => serializeRenderableObject(audioWithoutRuntimeContext));
    expectUnsupported(() => serializeRenderableObject(new SubjectDefinedNode()));
  });

  it("rejects an unsupported node nested under an otherwise valid Group", () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    root.add(new DirectionalLight());

    const result = validateRenderableObject(root);
    expect(result.code).toBe(UNSUPPORTED_RENDERABLE_NODE);
    expect(result.errors[0]).toMatchObject({
      path: "$.children[1]",
      nodeType: "DirectionalLight",
    });
  });

  it.each([
    ["Scene", () => new Scene()],
    ["Camera", () => new Camera()],
    ["AmbientLight", () => new AmbientLight()],
    ["DirectionalLight nested in Group", () => {
      const root = new Group();
      root.add(new DirectionalLight());
      return root;
    }],
  ])("rejects a crafted serialized %s after parsing", (_name, createNode) => {
    const crafted = {
      version: RENDERABLE_VERSION,
      object: createNode().toJSON(),
    } as RenderableScene;

    expectUnsupported(() => parseRenderableScene(crafted));
  });

  it("rejects a spoofed type on an exact allowed constructor", () => {
    const spoofed = new Object3D();
    Object.defineProperty(spoofed, "type", { value: "Scene" });
    expectUnsupported(() => serializeRenderableObject(spoofed));
  });
});
