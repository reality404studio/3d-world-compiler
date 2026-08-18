import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RequestConfig, TrustAnchors } from "./types";

export const EXPERIMENTS_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const PROJECT_ROOT = path.resolve(EXPERIMENTS_ROOT, "..");

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(EXPERIMENTS_ROOT, relativePath), "utf8"),
  ) as T;
}

export function loadTrustAnchors(): Promise<TrustAnchors> {
  return readJson<TrustAnchors>("protocol/trust-anchors-v0.json");
}

export function loadRequestConfig(): Promise<RequestConfig> {
  return readJson<RequestConfig>("protocol/request-config-v1.json");
}
