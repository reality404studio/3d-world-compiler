import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { createServer } from "vite";
import * as THREE from "three";
import type { MaterialMode } from "../../src/materials/policy";
import {
  parseRenderableScene,
  serializeRenderableObject,
  validateRenderableObject,
  type RenderableScene,
} from "../../src/observation/renderable";
import { FIXED_ENVIRONMENT } from "../../src/viewer/environment";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export interface RenderOptions {
  materialMode?: MaterialMode;
  captureViews?: boolean;
  turntable?: boolean;
  turntableStepDegrees?: number;
  outputDir: string;
}

export async function renderSubject(
  buildFn: (three: typeof THREE) => Promise<THREE.Object3D> | THREE.Object3D,
  options: RenderOptions,
): Promise<{ outputDir: string; viewFiles: string[]; videoPath?: string }> {
  const materialMode = options.materialMode ?? "authored";
  const outputDirectory = path.resolve(options.outputDir);
  await mkdir(outputDirectory, { recursive: true });

  // 1. Build model
  const root = await buildFn(THREE);
  const validation = validateRenderableObject(root);
  if (!validation.valid) {
    throw new Error(
      `Renderable validation failed: ${JSON.stringify(validation.errors, null, 2)}`,
    );
  }

  const renderable = serializeRenderableObject(root);
  parseRenderableScene(renderable);

  // 2. Start Vite server using project root
  const viteCacheDirectory = path.join(outputDirectory, ".vite-cache");
  const server = await createServer({
    root: PROJECT_ROOT,
    configFile: false,
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
  const viewFiles: string[] = [];
  let videoPath: string | undefined;

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

    // Standard 6 views
    if (options.captureViews !== false) {
      for (const yaw of FIXED_ENVIRONMENT.captureYaws) {
        await page.evaluate((viewYaw) => window.worldCompiler.renderYaw(viewYaw), yaw);
        const filename = `view-${String(yaw).padStart(3, "0")}.png`;
        const outputPath = path.join(outputDirectory, filename);
        await canvas.screenshot({ path: outputPath, type: "png" });
        viewFiles.push(outputPath);
      }
    }

    // Turntable sequence
    if (options.turntable) {
      const step = options.turntableStepDegrees ?? 5; // 72 frames for 360 degrees
      const framesDir = path.join(outputDirectory, "turntable-frames");
      await mkdir(framesDir, { recursive: true });

      let frameIdx = 0;
      for (let yaw = 0; yaw < 360; yaw += step) {
        await page.evaluate((viewYaw) => window.worldCompiler.renderYaw(viewYaw), yaw);
        const frameName = `frame-${String(frameIdx).padStart(4, "0")}.png`;
        const framePath = path.join(framesDir, frameName);
        await canvas.screenshot({ path: framePath, type: "png" });
        frameIdx++;
      }

      // Encode video using ffmpeg
      videoPath = path.join(outputDirectory, "turntable.mp4");
      const gifPath = path.join(outputDirectory, "turntable.gif");
      try {
        await execFileAsync("ffmpeg", [
          "-y",
          "-framerate",
          "24",
          "-i",
          path.join(framesDir, "frame-%04d.png"),
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          videoPath,
        ]);
        await execFileAsync("ffmpeg", [
          "-y",
          "-framerate",
          "15",
          "-i",
          path.join(framesDir, "frame-%04d.png"),
          "-vf",
          "scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
          gifPath,
        ]);
      } catch (err) {
        console.warn("FFmpeg encoding error:", err);
      }
    }
  } finally {
    await browser?.close();
    await server.close();
    await rm(viteCacheDirectory, { recursive: true, force: true });
  }

  return { outputDirectory, viewFiles, videoPath };
}
