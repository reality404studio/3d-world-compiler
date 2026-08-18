import rawWorld from "../world/world-v0.json";
import type { WorldSpec } from "./types";
import { validateWorldSyntax } from "./validation/schema";

const validation = validateWorldSyntax(rawWorld);

if (!validation.valid) {
  throw new Error(
    `Bundled world-v0.json is invalid: ${JSON.stringify(validation.errors)}`,
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

export const WORLD_SPEC = deepFreeze(rawWorld) as unknown as WorldSpec;
