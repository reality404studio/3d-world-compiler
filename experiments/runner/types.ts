import type { RenderableScene } from "../../src/observation/renderable";

export type Condition = "C0" | "C1" | "C2" | "C3";

export interface RequestConfig {
  version: "gemini-request-v1";
  model_id: "gemini-3.7-flash";
  temperature: number;
  top_p: number;
  max_output_tokens: number;
  seed: number | null;
  max_transport_retries: number;
}

export interface TrustAnchors {
  version: string;
  environment_commit: string;
  environment_manifest_sha256: string;
  evaluator_image_digest: string;
}

export interface PromptBundle {
  common: string;
  condition: string;
  complete: string;
  commonSha256: string;
  conditionSha256: string;
}

export interface ReferenceInput {
  assetId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  sha256: string;
}

export interface GeminiAttempt {
  attempt_number: number;
  latency_ms: number;
  http_status: number | null;
  outcome: "SUCCESS" | "API_TRANSPORT_RETRY" | "API_FAILURE";
}

export interface GeminiRequestEvidence {
  model_id: string;
  request_config: Record<string, unknown>;
  structured_output: boolean;
  api_attempt_number: number;
}

export interface GeminiGeneration {
  rawResponse: unknown;
  rawResponseText: string;
  text: string;
  latencyMs: number;
  usage: Record<string, unknown> | null;
  transportRetries: number;
  attempts: GeminiAttempt[];
  requestEvidence: GeminiRequestEvidence;
}

export interface GenerationRequest {
  condition: Condition;
  prompt: PromptBundle;
  reference: ReferenceInput;
}

export interface GeminiClient {
  generate(request: GenerationRequest): Promise<GeminiGeneration>;
}

export interface SubjectExecutionResult {
  status:
    | "SUCCESS"
    | "SUBJECT_CODE_SYNTAX_FAILURE"
    | "SUBJECT_CODE_RUNTIME_FAILURE"
    | "SUBJECT_TIMEOUT"
    | "UNSUPPORTED_RENDERABLE_NODE";
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  renderable: RenderableScene | null;
  durationMs: number;
}

export interface SubjectExecutor {
  execute(source: string): Promise<SubjectExecutionResult>;
}

export interface CaptureInvocation {
  material_mode: "neutral" | "authored";
  image: string;
  input_file: string;
  output_directory: string;
  docker_args: string[];
}

export interface EvaluationResult {
  status: "SUCCESS" | "EVALUATOR_FAILURE";
  invocations: CaptureInvocation[];
  stdout: Record<"neutral" | "authored", string>;
  stderr: Record<"neutral" | "authored", string>;
}

export interface Evaluator {
  evaluate(renderableFile: string, capturesDirectory: string): Promise<EvaluationResult>;
}

export interface RunInput {
  runId: string;
  condition: Condition;
  assetId: string;
  referenceFile: string;
  referenceMimeType: string;
  runsDirectory: string;
}

export interface RunManifest {
  run_id: string;
  protocol_version: "experiment-protocol-v1";
  condition: Condition;
  asset_id: string;
  reference_sha256: string;
  common_prompt_sha256: string;
  condition_prompt_sha256: string;
  model_id: "gemini-3.7-flash";
  request_config: Record<string, unknown>;
  started_at: string;
  latency_ms: number;
  usage: Record<string, unknown> | null;
  api_transport_retries: number;
  model_repairs: number;
  subject_exit_status: string;
  validation_status: string;
  evaluator_status: string;
  failure_code?: string | null;
  environment_commit: string;
  environment_manifest_sha256: string;
  evaluator_image_digest: string;
}
