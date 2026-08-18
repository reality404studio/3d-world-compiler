import { readFile } from "node:fs/promises";
import path from "node:path";
import assemblySchema from "../../protocol/assembly.schema.json";
import worldSpec from "../../world/world-v0.json";
import { EXPERIMENTS_ROOT } from "./config";
import { sha256 } from "./hash";
import type { Condition, PromptBundle } from "./types";

const CONDITION_PATHS: Record<Condition, string> = {
  C0: "conditions/c0-free/prompt-v1.txt",
  C1: "conditions/c1-prompt/prompt-v1.txt",
  C2: "conditions/c2-dsl/prompt-v1.txt",
  C3: "conditions/c2-dsl/prompt-v1.txt",
};

export async function composePrompt(condition: Condition): Promise<PromptBundle> {
  const common = await readFile(
    path.join(EXPERIMENTS_ROOT, "protocol/common-task-v1.txt"),
    "utf8",
  );
  let treatment = await readFile(
    path.join(EXPERIMENTS_ROOT, CONDITION_PATHS[condition]),
    "utf8",
  );

  if (condition === "C2" || condition === "C3") {
    treatment += [
      "\nASSEMBLY SCHEMA:\n",
      JSON.stringify(assemblySchema, null, 2),
      "\nWORLD-V0 SPECIFICATION:\n",
      JSON.stringify(worldSpec, null, 2),
      "\n",
    ].join("");
  }

  return {
    common,
    condition: treatment,
    complete: `${common.trimEnd()}\n\n${treatment.trimEnd()}\n`,
    commonSha256: sha256(common),
    conditionSha256: sha256(treatment),
  };
}
