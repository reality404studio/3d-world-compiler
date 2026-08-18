import { writeFile } from "node:fs/promises";
import * as THREE from "three";

const ALLOWED = new Map([
  [THREE.Object3D.prototype, "Object3D"],
  [THREE.Group.prototype, "Group"],
  [THREE.Mesh.prototype, "Mesh"],
]);

class UnsupportedNodeError extends Error {
  constructor(details) {
    super("UNSUPPORTED_RENDERABLE_NODE");
    this.code = "UNSUPPORTED_RENDERABLE_NODE";
    this.details = details;
  }
}

function validate(root) {
  const pending = [{ node: root, path: "$" }];
  const seen = new Set();
  while (pending.length) {
    const { node, path } = pending.pop();
    if (!node || typeof node !== "object" || seen.has(node)) {
      throw new UnsupportedNodeError({ path, reason: "not-an-acyclic-object" });
    }
    seen.add(node);
    const expected = ALLOWED.get(Object.getPrototypeOf(node));
    if (!expected || node.type !== expected) {
      throw new UnsupportedNodeError({
        path,
        nodeType: node.type,
        constructorName: node.constructor?.name,
      });
    }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push({ node: node.children[index], path: `${path}.children[${index}]` });
    }
  }
}

function classify(error) {
  if (error?.code === "UNSUPPORTED_RENDERABLE_NODE") return error.code;
  return error instanceof SyntaxError
    ? "SUBJECT_CODE_SYNTAX_FAILURE"
    : "SUBJECT_CODE_RUNTIME_FAILURE";
}

try {
  const module = await import("file:///input/subject.mjs");
  if (typeof module.default !== "function") {
    throw new TypeError("Subject module must export one default build function.");
  }
  const root = await module.default(THREE);
  validate(root);
  root.updateMatrixWorld(true);
  const renderable = { version: "renderable-v0", object: root.toJSON() };
  await writeFile("/output/renderable.json", `${JSON.stringify(renderable)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(
    "/output/execution-result.json",
    `${JSON.stringify({ status: "SUCCESS" })}\n`,
    { encoding: "utf8", flag: "wx" },
  );
} catch (error) {
  const status = classify(error);
  await writeFile(
    "/output/execution-result.json",
    `${JSON.stringify({
      status,
      message: error instanceof Error ? error.message : String(error),
      ...(error?.details ? { details: error.details } : {}),
    })}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  process.exitCode = 1;
}
