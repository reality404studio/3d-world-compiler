import path from "node:path";
import type { Assembly } from "../src/types";
import { captureFiveViews } from "../src/viewer/capture";
import { readJsonFile, requiredPathArgument } from "./io";

const input = path.resolve(
  requiredPathArgument("Usage: npm run capture -- <assembly.json> [--output <directory>]"),
);
const outputFlag = process.argv.indexOf("--output");
const defaultName = path.basename(path.dirname(input));
const output = path.resolve(
  outputFlag >= 0 && process.argv[outputFlag + 1]
    ? process.argv[outputFlag + 1]!
    : path.join("captures", defaultName),
);

try {
  const assembly = (await readJsonFile(input)) as Assembly;
  const result = await captureFiveViews(assembly, output);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const details =
    error && typeof error === "object" && "errors" in error
      ? { errors: error.errors }
      : {};
  process.stderr.write(
    `${JSON.stringify(
      {
        input,
        output,
        captured: false,
        code: "CAPTURE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        ...details,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
