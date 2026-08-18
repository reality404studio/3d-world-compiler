import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import type { Assembly } from "../types";
import { validateAssemblyDocument, AssemblyValidationError } from "../validation/semantic";
import { FIXED_ENVIRONMENT } from "./environment";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export interface CaptureResult {
  outputDirectory: string;
  files: string[];
}

export async function captureFiveViews(
  assembly: Assembly,
  outputDirectory: string,
): Promise<CaptureResult> {
  const validation = validateAssemblyDocument(assembly);
  if (!validation.valid) throw new AssemblyValidationError(validation.errors);

  const absoluteOutput = path.resolve(outputDirectory);
  await mkdir(absoluteOutput, { recursive: true });

  const server = await createServer({
    root: PROJECT_ROOT,
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();

  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) {
    await server.close();
    throw new Error("Vite did not expose a local capture URL.");
  }

  const browser = await chromium.launch({ headless: true });
  const files: string[] = [];
  try {
    const page = await browser.newPage({
      viewport: {
        width: FIXED_ENVIRONMENT.width,
        height: FIXED_ENVIRONMENT.height,
      },
      deviceScaleFactor: 1,
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.worldCompiler));
    await page.evaluate((document) => window.worldCompiler.loadAssembly(document), assembly);

    const canvas = page.locator("canvas");
    for (const yaw of FIXED_ENVIRONMENT.captureYaws) {
      await page.evaluate((viewYaw) => window.worldCompiler.renderYaw(viewYaw), yaw);
      const filename = `view-${String(yaw).padStart(3, "0")}.png`;
      const outputPath = path.join(absoluteOutput, filename);
      await canvas.screenshot({ path: outputPath, type: "png" });
      files.push(outputPath);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  return { outputDirectory: absoluteOutput, files };
}
