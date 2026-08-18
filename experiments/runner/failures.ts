export const FAILURE_CODES = [
  "REFERENCE_NOT_REGISTERED",
  "REFERENCE_HASH_MISMATCH",
  "API_FAILURE",
  "API_TRANSPORT_RETRY",
  "MODEL_OUTPUT_PARSE_FAILURE",
  "SUBJECT_CODE_SYNTAX_FAILURE",
  "SUBJECT_CODE_RUNTIME_FAILURE",
  "SUBJECT_TIMEOUT",
  "UNSUPPORTED_RENDERABLE_NODE",
  "SCHEMA_INVALID",
  "SEMANTIC_INVALID",
  "COMPILE_FAILURE",
  "EVALUATOR_FAILURE",
  "FROZEN_ENVIRONMENT_MODIFIED",
  "C3_VERIFIER_NOT_FROZEN",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

export class ExperimentFailure extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ExperimentFailure";
  }
}

export function failureCode(error: unknown): FailureCode {
  if (error instanceof ExperimentFailure) return error.code;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    FAILURE_CODES.includes(error.code as FailureCode)
  ) {
    return error.code as FailureCode;
  }
  return "API_FAILURE";
}
