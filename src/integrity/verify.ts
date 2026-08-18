import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const FROZEN_ENVIRONMENT_MODIFIED = "FROZEN_ENVIRONMENT_MODIFIED" as const;
export const FREEZE_MANIFEST_VERSION = "environment-v0-integrity-v1" as const;

export interface FreezeManifestEntry {
  path: string;
  sha256: string;
  size: number;
}

export interface FreezeManifest {
  version: typeof FREEZE_MANIFEST_VERSION;
  algorithm: "sha256";
  protectedPaths: string[];
  files: FreezeManifestEntry[];
}

export interface FreezeIntegrityIssue {
  code: typeof FROZEN_ENVIRONMENT_MODIFIED;
  path: string;
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export interface FreezeIntegrityResult {
  valid: boolean;
  code: typeof FROZEN_ENVIRONMENT_MODIFIED | null;
  manifestSha256: string;
  errors: FreezeIntegrityIssue[];
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertSafeRelativePath(relativePath: string): void {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").includes("..") ||
    path.posix.normalize(relativePath) !== relativePath
  ) {
    throw new Error(`Unsafe frozen path '${relativePath}'.`);
  }
}

async function collectFiles(
  rootDirectory: string,
  relativePath: string,
  files: string[],
): Promise<void> {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(rootDirectory, ...relativePath.split("/"));
  const stats = await lstat(absolutePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed in frozen paths: ${relativePath}`);
  }
  if (stats.isFile()) {
    files.push(relativePath);
    return;
  }
  if (!stats.isDirectory()) {
    throw new Error(`Unsupported frozen path type: ${relativePath}`);
  }
  const entries = await readdir(absolutePath, { withFileTypes: true });
  entries.sort((left, right) => comparePaths(left.name, right.name));
  for (const entry of entries) {
    await collectFiles(rootDirectory, `${relativePath}/${entry.name}`, files);
  }
}

export async function buildFreezeManifest(
  rootDirectory: string,
  protectedPaths: readonly string[],
): Promise<FreezeManifest> {
  const sortedProtectedPaths = [...protectedPaths].sort(comparePaths);
  const filePaths: string[] = [];
  for (const protectedPath of sortedProtectedPaths) {
    await collectFiles(rootDirectory, protectedPath, filePaths);
  }
  filePaths.sort(comparePaths);
  if (new Set(filePaths).size !== filePaths.length) {
    throw new Error("Frozen path definitions overlap or contain duplicate files.");
  }

  const files: FreezeManifestEntry[] = [];
  for (const relativePath of filePaths) {
    const content = await readFile(
      path.join(rootDirectory, ...relativePath.split("/")),
    );
    files.push({ path: relativePath, sha256: sha256(content), size: content.byteLength });
  }
  return {
    version: FREEZE_MANIFEST_VERSION,
    algorithm: "sha256",
    protectedPaths: sortedProtectedPaths,
    files,
  };
}

export function serializeFreezeManifest(manifest: FreezeManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function manifestSha256(content: Uint8Array | string): string {
  return sha256(typeof content === "string" ? Buffer.from(content) : content);
}

function modified(
  manifestDigest: string,
  errors: FreezeIntegrityIssue[],
): FreezeIntegrityResult {
  return {
    valid: false,
    code: FROZEN_ENVIRONMENT_MODIFIED,
    manifestSha256: manifestDigest,
    errors,
  };
}

export async function verifyFrozenEnvironment(options: {
  rootDirectory: string;
  manifestPath: string;
  expectedManifestSha256: string;
}): Promise<FreezeIntegrityResult> {
  const manifestBytes = await readFile(options.manifestPath);
  const manifestDigest = manifestSha256(manifestBytes);
  if (manifestDigest !== options.expectedManifestSha256) {
    return modified(manifestDigest, [
      {
        code: FROZEN_ENVIRONMENT_MODIFIED,
        path: path.basename(options.manifestPath),
        message: "Freeze manifest does not match the external trust anchor.",
        expected: options.expectedManifestSha256,
        actual: manifestDigest,
      },
    ]);
  }

  let manifest: FreezeManifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8")) as FreezeManifest;
  } catch {
    return modified(manifestDigest, [
      {
        code: FROZEN_ENVIRONMENT_MODIFIED,
        path: path.basename(options.manifestPath),
        message: "Freeze manifest is not valid JSON.",
      },
    ]);
  }
  if (
    manifest.version !== FREEZE_MANIFEST_VERSION ||
    manifest.algorithm !== "sha256" ||
    !Array.isArray(manifest.protectedPaths) ||
    !Array.isArray(manifest.files)
  ) {
    return modified(manifestDigest, [
      {
        code: FROZEN_ENVIRONMENT_MODIFIED,
        path: path.basename(options.manifestPath),
        message: "Freeze manifest has an unsupported or malformed format.",
      },
    ]);
  }

  let actual: FreezeManifest;
  try {
    actual = await buildFreezeManifest(options.rootDirectory, manifest.protectedPaths);
  } catch (error) {
    return modified(manifestDigest, [
      {
        code: FROZEN_ENVIRONMENT_MODIFIED,
        path: "/",
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }

  const errors: FreezeIntegrityIssue[] = [];
  const expectedByPath = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const actualByPath = new Map(actual.files.map((entry) => [entry.path, entry]));
  const allPaths = new Set([...expectedByPath.keys(), ...actualByPath.keys()]);
  for (const filePath of [...allPaths].sort(comparePaths)) {
    const expected = expectedByPath.get(filePath);
    const observed = actualByPath.get(filePath);
    if (!expected || !observed) {
      errors.push({
        code: FROZEN_ENVIRONMENT_MODIFIED,
        path: filePath,
        message: expected ? "Frozen file is missing." : "Unapproved file exists in a frozen path.",
      });
    } else if (
      expected.sha256 !== observed.sha256 ||
      expected.size !== observed.size
    ) {
      errors.push({
        code: FROZEN_ENVIRONMENT_MODIFIED,
        path: filePath,
        message: "Frozen file content changed.",
        expected: expected.sha256,
        actual: observed.sha256,
      });
    }
  }

  return errors.length > 0
    ? modified(manifestDigest, errors)
    : { valid: true, code: null, manifestSha256: manifestDigest, errors: [] };
}

export class FrozenEnvironmentModifiedError extends Error {
  readonly code = FROZEN_ENVIRONMENT_MODIFIED;
  readonly result: FreezeIntegrityResult;

  constructor(result: FreezeIntegrityResult) {
    super(FROZEN_ENVIRONMENT_MODIFIED);
    this.name = "FrozenEnvironmentModifiedError";
    this.result = result;
  }
}

export async function assertFrozenEnvironment(options: {
  rootDirectory: string;
  manifestPath: string;
  expectedManifestSha256: string;
}): Promise<FreezeIntegrityResult> {
  const result = await verifyFrozenEnvironment(options);
  if (!result.valid) throw new FrozenEnvironmentModifiedError(result);
  return result;
}
