import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import type { Object3D } from "three";
import type { MaterialMode } from "../materials/policy";
import {
  parseRenderableScene,
  serializeRenderableObject,
  type RenderableScene,
} from "../observation/renderable";
import { FIXED_ENVIRONMENT } from "./environment";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export interface CaptureResult {
  outputDirectory: string;
  files: string[];
  materialMode: MaterialMode;
}

export interface CaptureOptions {
  materialMode?: MaterialMode;
}

export async function captureRenderableObject(
  object: Object3D,
  outputDirectory: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  return captureRenderableScene(
    serializeRenderableObject(object),
    outputDirectory,
    options,
  );
}

export async function captureRenderableScene(
  renderable: RenderableScene,
  outputDirectory: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const materialMode = options.materialMode ?? "authored";

  // Parse and validate once in the trusted Node process before any browser or
  // output side effects. The browser repeats this check when it loads the same
  // document, so a serialized document cannot bypass renderable-v0 policy.
  parseRenderableScene(renderable);

  const absoluteOutput = path.resolve(outputDirectory);
  const viteCacheDirectory = path.join(absoluteOutput, ".vite-cache");
  await mkdir(absoluteOutput, { recursive: true });

  const server = await createServer({
    root: PROJECT_ROOT,
    cacheDir: viteCacheDirectory,
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();

  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) {
    await server.close();
    throw new Error("Vite did not expose a local capture URL.");
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const files: string[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
    const page = await browser.newPage({
      viewport: {
        width: FIXED_ENVIRONMENT.width,
        height: FIXED_ENVIRONMENT.height,
      },
      deviceScaleFactor: 1,
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.worldCompiler));
    await page.evaluate(
      ({ document, mode }) => window.worldCompiler.loadRenderable(document, mode),
      { document: renderable, mode: materialMode },
    );

    const canvas = page.locator("canvas");
    for (const yaw of FIXED_ENVIRONMENT.captureYaws) {
      await page.evaluate((viewYaw) => window.worldCompiler.renderYaw(viewYaw), yaw);
      const filename = `view-${String(yaw).padStart(3, "0")}.png`;
      const outputPath = path.join(absoluteOutput, filename);
      await canvas.screenshot({ path: outputPath, type: "png" });
      files.push(outputPath);
    }
  } finally {
    await browser?.close();
    await server.close();
    await rm(viteCacheDirectory, { recursive: true, force: true });
  }

  return { outputDirectory: absoluteOutput, files, materialMode };
}
