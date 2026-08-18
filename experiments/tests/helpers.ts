import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  EvaluationResult,
  Evaluator,
  GeminiClient,
  GeminiGeneration,
  GenerationRequest,
  SubjectExecutor,
} from "../runner/types";

export async function temporaryRunInput() {
  const root = await mkdtemp(path.join(os.tmpdir(), "experiment-test-"));
  const runsDirectory = path.join(root, "runs");
  await mkdir(runsDirectory);
  const referenceFile = path.join(root, "synthetic.png");
  await writeFile(referenceFile, Buffer.from("synthetic-reference"));
  return { root, runsDirectory, referenceFile };
}

export function generation(text: string): GeminiGeneration {
  const rawResponse = {
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  };
  return {
    rawResponse,
    rawResponseText: JSON.stringify(rawResponse),
    text,
    latencyMs: 12,
    usage: { promptTokenCount: 10, candidatesTokenCount: 5 },
    transportRetries: 0,
    attempts: [
      {
        attempt_number: 1,
        latency_ms: 12,
        http_status: 200,
        outcome: "SUCCESS",
      },
    ],
    requestEvidence: {
      model_id: "gemini-3.7-flash",
      request_config: {},
      structured_output: true,
      api_attempt_number: 1,
    },
  };
}

export class MockGemini implements GeminiClient {
  calls: GenerationRequest[] = [];

  constructor(private readonly result: GeminiGeneration) {}

  async generate(request: GenerationRequest): Promise<GeminiGeneration> {
    this.calls.push(request);
    return this.result;
  }
}

export class UnexpectedSubject implements SubjectExecutor {
  async execute(): Promise<never> {
    throw new Error("Subject executor should not be called.");
  }
}

export class RecordingEvaluator implements Evaluator {
  calls: Array<{ renderableFile: string; capturesDirectory: string }> = [];

  async evaluate(
    renderableFile: string,
    capturesDirectory: string,
  ): Promise<EvaluationResult> {
    this.calls.push({ renderableFile, capturesDirectory });
    return {
      status: "SUCCESS",
      invocations: [],
      stdout: { neutral: "neutral-ok", authored: "authored-ok" },
      stderr: { neutral: "", authored: "" },
    };
  }
}

export const VALID_ASSEMBLY = JSON.stringify({
  version: "1.0",
  parts: [
    {
      id: "body",
      primitive: "ellipsoid",
      parent: null,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1.2, 0.8],
      material: "clay",
    },
  ],
});
