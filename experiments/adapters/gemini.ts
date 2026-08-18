import assemblySchema from "../../protocol/assembly.schema.json";
import { ExperimentFailure } from "../runner/failures";
import { loadRequestConfig } from "../runner/config";
import type {
  GeminiAttempt,
  GeminiClient,
  GeminiGeneration,
  GenerationRequest,
  RequestConfig,
} from "../runner/types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

interface GeminiAdapterOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  config?: RequestConfig;
}

function responseText(body: unknown): string {
  const candidate = body as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  const parts = candidate.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

function usage(body: unknown): Record<string, unknown> | null {
  const value = (body as { usageMetadata?: unknown })?.usageMetadata;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export class GeminiAdapter implements GeminiClient {
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly configured?: RequestConfig;

  constructor(options: GeminiAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.configured = options.config;
  }

  async generate(request: GenerationRequest): Promise<GeminiGeneration> {
    if (!this.apiKey) {
      throw new ExperimentFailure("API_FAILURE", "GEMINI_API_KEY_MISSING");
    }
    const config = this.configured ?? (await loadRequestConfig());
    if (config.model_id !== "gemini-3.7-flash") {
      throw new ExperimentFailure(
        "API_FAILURE",
        `Configured model must be gemini-3.7-flash, received ${config.model_id}.`,
      );
    }

    const structured = request.condition === "C2" || request.condition === "C3";
    const generationConfig: Record<string, unknown> = {
      temperature: config.temperature,
      topP: config.top_p,
      maxOutputTokens: config.max_output_tokens,
      ...(config.seed === null ? {} : { seed: config.seed }),
      ...(structured
        ? {
            responseMimeType: "application/json",
            responseJsonSchema: assemblySchema,
          }
        : {}),
    };
    const apiBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: request.prompt.complete },
            {
              inlineData: {
                mimeType: request.reference.mimeType,
                data: Buffer.from(request.reference.bytes).toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig,
    };
    const requestConfig = {
      temperature: config.temperature,
      top_p: config.top_p,
      max_output_tokens: config.max_output_tokens,
      seed: config.seed,
      structured_output: structured,
    };

    const attempts: GeminiAttempt[] = [];
    const overallStart = performance.now();
    let lastError: unknown;
    for (let attempt = 1; attempt <= config.max_transport_retries + 1; attempt += 1) {
      const attemptStart = performance.now();
      try {
        const response = await this.fetchImpl(
          `${API_BASE}/models/${encodeURIComponent(config.model_id)}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": this.apiKey,
            },
            body: JSON.stringify(apiBody),
          },
        );
        const rawText = await response.text();
        let body: unknown;
        try {
          body = JSON.parse(rawText);
        } catch {
          body = { unparsed_response: rawText };
        }

        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt <= config.max_transport_retries) {
            attempts.push({
              attempt_number: attempt,
              latency_ms: performance.now() - attemptStart,
              http_status: response.status,
              outcome: "API_TRANSPORT_RETRY",
            });
            await this.sleep(100 * 2 ** (attempt - 1));
            continue;
          }
          attempts.push({
            attempt_number: attempt,
            latency_ms: performance.now() - attemptStart,
            http_status: response.status,
            outcome: "API_FAILURE",
          });
          throw new ExperimentFailure(
            "API_FAILURE",
            `Gemini API returned HTTP ${response.status}.`,
            { attempts, rawResponseText: rawText, response: body },
          );
        }

        attempts.push({
          attempt_number: attempt,
          latency_ms: performance.now() - attemptStart,
          http_status: response.status,
          outcome: "SUCCESS",
        });
        return {
          rawResponse: body,
          rawResponseText: rawText,
          text: responseText(body),
          latencyMs: performance.now() - overallStart,
          usage: usage(body),
          transportRetries: attempts.filter((item) => item.outcome === "API_TRANSPORT_RETRY").length,
          attempts,
          requestEvidence: {
            model_id: config.model_id,
            request_config: requestConfig,
            structured_output: structured,
            api_attempt_number: attempt,
          },
        };
      } catch (error) {
        if (error instanceof ExperimentFailure) throw error;
        lastError = error;
        if (attempt <= config.max_transport_retries) {
          attempts.push({
            attempt_number: attempt,
            latency_ms: performance.now() - attemptStart,
            http_status: null,
            outcome: "API_TRANSPORT_RETRY",
          });
          await this.sleep(100 * 2 ** (attempt - 1));
          continue;
        }
        attempts.push({
          attempt_number: attempt,
          latency_ms: performance.now() - attemptStart,
          http_status: null,
          outcome: "API_FAILURE",
        });
      }
    }
    throw new ExperimentFailure("API_FAILURE", "Gemini transport failed.", {
      attempts,
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
}
