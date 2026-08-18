import { readFile } from "node:fs/promises";

export async function readJsonFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as unknown;
}

export function requiredPathArgument(usage: string): string {
  const value = process.argv[2];
  if (!value || value.startsWith("--")) {
    process.stderr.write(`${usage}\n`);
    process.exit(2);
  }
  return value;
}
