import { writeFile } from "node:fs/promises";

async function expectWriteFailure(filename) {
  try {
    await writeFile(filename, "unexpected-write");
  } catch {
    return;
  }
  throw new Error(`Write unexpectedly succeeded: ${filename}`);
}

export default async function build(THREE) {
  if (typeof process.getuid !== "function" || process.getuid() === 0) {
    throw new Error("Subject container must run as a non-root user.");
  }
  if (process.env.GEMINI_API_KEY || process.env.HOST_SECRET_SENTINEL) {
    throw new Error("A host secret entered the subject container.");
  }
  await expectWriteFailure("/subject-adapter/root-write-probe");
  await expectWriteFailure("/input/input-write-probe");
  await writeFile("/output/subject-write-probe", "writable");
  return new THREE.Group();
}
