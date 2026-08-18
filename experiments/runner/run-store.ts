import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExperimentFailure } from "./failures";

const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export class RunStore {
  readonly directory: string;

  private constructor(directory: string) {
    this.directory = directory;
  }

  static async create(runsDirectory: string, runId: string): Promise<RunStore> {
    if (!RUN_ID_PATTERN.test(runId)) {
      throw new Error("run_id contains unsupported characters.");
    }
    const directory = path.join(path.resolve(runsDirectory), runId);
    try {
      await mkdir(directory, { recursive: false });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`Run directory already exists and will not be overwritten: ${runId}`);
      }
      throw error;
    }
    await mkdir(path.join(directory, "captures"));
    await mkdir(path.join(directory, "logs"));
    return new RunStore(directory);
  }

  path(relativePath: string): string {
    const resolved = path.resolve(this.directory, relativePath);
    if (!resolved.startsWith(`${this.directory}${path.sep}`)) {
      throw new Error("Run artifact path escapes the run directory.");
    }
    return resolved;
  }

  async writeText(relativePath: string, value: string): Promise<void> {
    const target = this.path(relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value, { encoding: "utf8", flag: "wx" });
  }

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  async readJson<T>(relativePath: string): Promise<T> {
    return JSON.parse(await readFile(this.path(relativePath), "utf8")) as T;
  }
}

export async function recordFailure(
  store: RunStore,
  code: string,
  details: unknown,
): Promise<void> {
  try {
    await store.writeJson("execution.json", { status: "FAILED", code, details });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw new ExperimentFailure("API_FAILURE", "Failure evidence could not be recorded.");
  }
}
