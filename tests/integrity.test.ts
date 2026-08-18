import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  FROZEN_ENVIRONMENT_MODIFIED,
  buildFreezeManifest,
  manifestSha256,
  serializeFreezeManifest,
  verifyFrozenEnvironment,
} from "../src/integrity/verify";

async function createFixture(): Promise<{
  rootDirectory: string;
  manifestPath: string;
  expectedManifestSha256: string;
}> {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "world-v0-integrity-"));
  await mkdir(path.join(rootDirectory, "frozen/nested"), { recursive: true });
  await writeFile(path.join(rootDirectory, "frozen/a.txt"), "alpha\n");
  await writeFile(path.join(rootDirectory, "frozen/nested/b.txt"), "beta\n");
  const manifest = await buildFreezeManifest(rootDirectory, ["frozen"]);
  const serialized = serializeFreezeManifest(manifest);
  const manifestPath = path.join(rootDirectory, "manifest.json");
  await writeFile(manifestPath, serialized);
  return {
    rootDirectory,
    manifestPath,
    expectedManifestSha256: manifestSha256(serialized),
  };
}

describe("frozen environment integrity", () => {
  it("matches the checked-in candidate manifest", async () => {
    const rootDirectory = fileURLToPath(new URL("..", import.meta.url));
    const manifestPath = path.join(rootDirectory, "freeze/environment-v0.manifest.json");
    const expectedManifestSha256 = manifestSha256(await readFile(manifestPath));
    const result = await verifyFrozenEnvironment({
      rootDirectory,
      manifestPath,
      expectedManifestSha256,
    });
    expect(result.valid).toBe(true);
  });

  it("verifies the approved file set deterministically", async () => {
    const fixture = await createFixture();
    const first = await verifyFrozenEnvironment(fixture);
    const second = await verifyFrozenEnvironment(fixture);
    expect(first).toEqual(second);
    expect(first.valid).toBe(true);
  });

  it("reports a machine-readable failure when a frozen file changes", async () => {
    const fixture = await createFixture();
    await writeFile(path.join(fixture.rootDirectory, "frozen/a.txt"), "changed\n");
    const result = await verifyFrozenEnvironment(fixture);
    expect(result.valid).toBe(false);
    expect(result.code).toBe(FROZEN_ENVIRONMENT_MODIFIED);
    expect(result.errors[0]?.path).toBe("frozen/a.txt");
  });

  it("rejects added files inside a protected directory", async () => {
    const fixture = await createFixture();
    await writeFile(path.join(fixture.rootDirectory, "frozen/new.txt"), "new\n");
    const result = await verifyFrozenEnvironment(fixture);
    expect(result.code).toBe(FROZEN_ENVIRONMENT_MODIFIED);
    expect(result.errors.some((error) => error.path === "frozen/new.txt")).toBe(true);
  });

  it("rejects a modified manifest against its external trust anchor", async () => {
    const fixture = await createFixture();
    const content = await readFile(fixture.manifestPath, "utf8");
    await writeFile(fixture.manifestPath, `${content} `);
    const result = await verifyFrozenEnvironment(fixture);
    expect(result.code).toBe(FROZEN_ENVIRONMENT_MODIFIED);
    expect(result.errors[0]?.message).toContain("trust anchor");
  });
});
