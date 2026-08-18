import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import {
  RENDERABLE_VERSION,
  UNSUPPORTED_RENDERABLE_NODE,
  type RenderableScene,
} from "../src/observation/renderable";
import {
  captureRenderableObject,
  captureRenderableScene,
} from "../src/viewer/capture";
import { FIXED_ENVIRONMENT } from "../src/viewer/environment";

describe("headless six-view capture", () => {
  it("captures a condition-independent Object3D in neutral mode", async () => {
    const output = await mkdtemp(path.join(tmpdir(), "world-v0-capture-"));
    const renderable = new Group();
    renderable.add(
      new Mesh(
        new BoxGeometry(1, 1.5, 0.75),
        new MeshStandardMaterial({ color: "#ff0000" }),
      ),
    );
    const result = await captureRenderableObject(renderable, output, {
      materialMode: "neutral",
    });

    expect(result.files).toHaveLength(FIXED_ENVIRONMENT.captureYaws.length);
    expect(result.materialMode).toBe("neutral");
    expect(result.files.map((file) => path.basename(file))).toEqual([
      "view-000.png",
      "view-045.png",
      "view-090.png",
      "view-180.png",
      "view-270.png",
      "view-315.png",
    ]);
    for (const file of result.files) {
      expect((await stat(file)).size).toBeGreaterThan(1000);
    }
  });

  it("rejects a direct light before the observation apparatus starts", async () => {
    await expect(
      captureRenderableObject(new DirectionalLight(), "/not-created"),
    ).rejects.toMatchObject({ code: UNSUPPORTED_RENDERABLE_NODE });
  });

  it("rejects a crafted serialized light before the observation apparatus starts", async () => {
    const crafted = {
      version: RENDERABLE_VERSION,
      object: new AmbientLight().toJSON(),
    } as RenderableScene;
    await expect(captureRenderableScene(crafted, "/not-created")).rejects.toMatchObject(
      { code: UNSUPPORTED_RENDERABLE_NODE },
    );
  });
});
