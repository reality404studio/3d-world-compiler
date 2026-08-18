import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Assembly } from "../../src/types";
import { compileAssembly } from "../../src/compiler/compile";
import {
  parseRenderableScene,
  serializeRenderableObject,
  type RenderableScene,
} from "../../src/observation/renderable";
import { validateAssemblyDocument } from "../../src/validation/semantic";
import { loadRequestConfig, loadTrustAnchors } from "./config";
import { ExperimentFailure, failureCode, type FailureCode } from "./failures";
import { sha256 } from "./hash";
import { verifyFrozenEnvironment } from "./integrity";
import { composePrompt } from "./prompts";
import { requireRegisteredReference } from "./references";
import { RunStore } from "./run-store";
import type {
  Evaluator,
  GeminiClient,
  ReferenceInput,
  RunInput,
  RunManifest,
  SubjectExecutor,
} from "./types";

export interface RunDependencies {
  gemini: GeminiClient;
  subject: SubjectExecutor;
  evaluator: Evaluator;
  now?: () => Date;
}

interface MutableStatuses {
  subject: string;
  validation: string;
  evaluator: string;
}

async function referenceInput(input: RunInput): Promise<ReferenceInput> {
  const bytes = await readFile(input.referenceFile);
  return {
    assetId: input.assetId,
    filename: path.basename(input.referenceFile),
    mimeType: input.referenceMimeType,
    bytes,
    sha256: sha256(bytes),
  };
}

function validationFailureCode(phase: "schema" | "semantic"): FailureCode {
  return phase === "schema" ? "SCHEMA_INVALID" : "SEMANTIC_INVALID";
}

export async function executeExperimentRun(
  input: RunInput,
  dependencies: RunDependencies,
): Promise<{ directory: string; manifest: RunManifest }> {
  await verifyFrozenEnvironment();
  const prompt = await composePrompt(input.condition);
  const reference = await referenceInput(input);
  const anchors = await loadTrustAnchors();
  const config = await loadRequestConfig();
  if (
    (input.condition === "C0" || input.condition === "C1") &&
    dependencies.subject.imageDigest !== anchors.subject_image_digest
  ) {
    throw new ExperimentFailure(
      "FROZEN_ENVIRONMENT_MODIFIED",
      "Subject executor does not match the approved apparatus digest.",
    );
  }
  const store = await RunStore.create(input.runsDirectory, input.runId);
  const startedAt = (dependencies.now ?? (() => new Date()))();
  const startedClock = performance.now();
  const statuses: MutableStatuses = {
    subject: "NOT_RUN",
    validation: "NOT_RUN",
    evaluator: "NOT_RUN",
  };
  let latencyMs = 0;
  let usage: Record<string, unknown> | null = null;
  let apiTransportRetries = 0;
  let failure: FailureCode | null = null;

  const requestConfig = {
    temperature: config.temperature,
    top_p: config.top_p,
    max_output_tokens: config.max_output_tokens,
    seed: config.seed,
    structured_output: input.condition === "C2" || input.condition === "C3",
  };

  await store.writeText("prompt.txt", prompt.complete);
  await store.writeJson("request.json", {
    condition: input.condition,
    asset_id: reference.assetId,
    reference_filename: reference.filename,
    reference_sha256: reference.sha256,
    common_prompt_sha256: prompt.commonSha256,
    condition_prompt_sha256: prompt.conditionSha256,
    model_id: config.model_id,
    request_config: requestConfig,
  });

  try {
    const registration = await requireRegisteredReference(
      reference.assetId,
      reference.sha256,
      input.referenceRegistryDirectory,
    );
    await store.writeJson("reference-registration.json", registration);

    if (input.condition === "C3") {
      throw new ExperimentFailure(
        "C3_VERIFIER_NOT_FROZEN",
        "C3_VERIFIER_NOT_FROZEN",
      );
    }

    const generation = await dependencies.gemini.generate({
      condition: input.condition,
      prompt,
      reference,
    });
    latencyMs = generation.latencyMs;
    usage = generation.usage;
    apiTransportRetries = generation.transportRetries;
    await store.writeText("raw-response.txt", generation.rawResponseText);
    await store.writeJson("raw-response.json", generation.rawResponse);
    await store.writeJson("logs/api-attempts.json", generation.attempts);
    await store.writeJson("request-evidence.json", generation.requestEvidence);

    let renderable: RenderableScene;
    if (input.condition === "C0" || input.condition === "C1") {
      await store.writeText("subject-source.js", generation.text);
      const subject = await dependencies.subject.execute(generation.text);
      statuses.subject = subject.status;
      await store.writeJson("execution.json", {
        status: subject.status,
        ...(Object.hasOwn(subject, "message")
          ? { message: subject.message }
          : {}),
        ...(Object.hasOwn(subject, "details")
          ? { details: subject.details }
          : {}),
        exit_code: subject.exitCode,
        timed_out: subject.timedOut,
        duration_ms: subject.durationMs,
      });
      await store.writeText("logs/subject.stdout.log", subject.stdout);
      await store.writeText("logs/subject.stderr.log", subject.stderr);
      if (subject.status !== "SUCCESS") {
        throw new ExperimentFailure(subject.status, subject.status);
      }
      if (!subject.renderable) {
        throw new ExperimentFailure(
          "SUBJECT_CODE_RUNTIME_FAILURE",
          "Subject reported success without a renderable artifact.",
        );
      }
      renderable = subject.renderable;
      try {
        parseRenderableScene(renderable);
      } catch (error) {
        throw new ExperimentFailure(
          "UNSUPPORTED_RENDERABLE_NODE",
          "UNSUPPORTED_RENDERABLE_NODE",
          error,
        );
      }
      statuses.validation = "RENDERABLE_VALID";
    } else {
      let assembly: unknown;
      try {
        assembly = JSON.parse(generation.text);
      } catch (error) {
        throw new ExperimentFailure(
          "MODEL_OUTPUT_PARSE_FAILURE",
          "C2 response was not one exact JSON document; no repair was attempted.",
          error,
        );
      }
      await store.writeJson("assembly.json", assembly);
      const validation = validateAssemblyDocument(assembly);
      await store.writeJson("validation.json", validation);
      statuses.validation = validation.valid
        ? "VALID"
        : validation.phase === "schema"
          ? "SCHEMA_INVALID"
          : "SEMANTIC_INVALID";
      if (!validation.valid) {
        throw new ExperimentFailure(
          validationFailureCode(validation.phase),
          statuses.validation,
          validation.errors,
        );
      }
      try {
        renderable = serializeRenderableObject(compileAssembly(assembly as Assembly));
      } catch (error) {
        throw new ExperimentFailure("COMPILE_FAILURE", "COMPILE_FAILURE", error);
      }
      statuses.subject = "NOT_APPLICABLE";
    }

    await store.writeJson("renderable.json", renderable);
    const evaluation = await dependencies.evaluator.evaluate(
      store.path("renderable.json"),
      store.path("captures"),
    );
    statuses.evaluator = evaluation.status;
    await store.writeJson("logs/evaluator-invocations.json", evaluation.invocations);
    await store.writeText("logs/evaluator-neutral.stdout.log", evaluation.stdout.neutral);
    await store.writeText("logs/evaluator-neutral.stderr.log", evaluation.stderr.neutral);
    await store.writeText("logs/evaluator-authored.stdout.log", evaluation.stdout.authored);
    await store.writeText("logs/evaluator-authored.stderr.log", evaluation.stderr.authored);
    if (evaluation.status !== "SUCCESS") {
      throw new ExperimentFailure("EVALUATOR_FAILURE", "EVALUATOR_FAILURE");
    }
    await verifyFrozenEnvironment();
  } catch (error) {
    failure = failureCode(error);
    const failureDetails =
      error instanceof ExperimentFailure &&
      error.details &&
      typeof error.details === "object"
        ? (error.details as { attempts?: unknown; rawResponseText?: unknown })
        : null;
    if (Array.isArray(failureDetails?.attempts)) {
      const attempts = failureDetails.attempts as Array<{ outcome?: unknown }>;
      apiTransportRetries = attempts.filter(
        (attempt) => attempt.outcome === "API_TRANSPORT_RETRY",
      ).length;
      try {
        await store.writeJson("logs/api-attempts.json", attempts);
      } catch {
        // The successful generation path may already have written this evidence.
      }
    }
    if (typeof failureDetails?.rawResponseText === "string") {
      try {
        await store.writeText("raw-response.txt", failureDetails.rawResponseText);
      } catch {
        // The successful generation path may already have written this evidence.
      }
    }
    if (failure === "C3_VERIFIER_NOT_FROZEN") {
      statuses.validation = "C3_VERIFIER_NOT_FROZEN";
    }
    if (failure === "EVALUATOR_FAILURE") statuses.evaluator = "EVALUATOR_FAILURE";
    if (statuses.subject === "NOT_RUN" && failure.startsWith("SUBJECT_")) {
      statuses.subject = failure;
    }
    if (statuses.validation === "NOT_RUN" && failure === "MODEL_OUTPUT_PARSE_FAILURE") {
      statuses.validation = "MODEL_OUTPUT_PARSE_FAILURE";
    }
    try {
      await store.writeJson("failure.json", {
        code: failure,
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof ExperimentFailure ? error.details ?? null : null,
      });
    } catch {
      // A completed evidence file is never overwritten.
    }
  }

  const manifest: RunManifest = {
    run_id: input.runId,
    protocol_version: "experiment-protocol-v1",
    condition: input.condition,
    asset_id: reference.assetId,
    reference_sha256: reference.sha256,
    common_prompt_sha256: prompt.commonSha256,
    condition_prompt_sha256: prompt.conditionSha256,
    model_id: config.model_id,
    request_config: requestConfig,
    started_at: startedAt.toISOString(),
    latency_ms: latencyMs || performance.now() - startedClock,
    usage,
    api_transport_retries: apiTransportRetries,
    model_repairs: 0,
    subject_exit_status: statuses.subject,
    validation_status: statuses.validation,
    evaluator_status: statuses.evaluator,
    failure_code: failure,
    environment_commit: anchors.environment_commit,
    environment_manifest_sha256: anchors.environment_manifest_sha256,
    evaluator_image_digest: anchors.evaluator_image_digest,
    subject_image_digest:
      input.condition === "C0" || input.condition === "C1"
        ? dependencies.subject.imageDigest
        : null,
  };
  await store.writeJson("manifest.json", manifest);
  return { directory: store.directory, manifest };
}
