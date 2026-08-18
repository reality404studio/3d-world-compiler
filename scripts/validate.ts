import path from "node:path";
import { readJsonFile, requiredPathArgument } from "./io";
import { validateAssemblyDocument } from "../src/validation/semantic";

const assemblyPath = path.resolve(
  requiredPathArgument("Usage: npm run validate -- <assembly.json>"),
);

try {
  const document = await readJsonFile(assemblyPath);
  const result = validateAssemblyDocument(document);
  process.stdout.write(
    `${JSON.stringify({ file: assemblyPath, ...result }, null, 2)}\n`,
  );
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${JSON.stringify(
      {
        file: assemblyPath,
        valid: false,
        phase: "parse",
        errors: [
          {
            code: "JSON_PARSE_ERROR",
            path: "/",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
