import { afterEach, describe, expect, it } from "vitest";
import { GeminiAdapter } from "../adapters/gemini";
import { ExperimentFailure } from "../runner/failures";
import { composePrompt } from "../runner/prompts";
import type { ReferenceInput, RequestConfig } from "../runner/types";

const config: RequestConfig = {
  version: "gemini-request-v1",
  model_id: "gemini-3.7-flash",
  temperature: 0.7,
  top_p: 0.95,
  max_output_tokens: 8192,
  seed: null,
  max_transport_retries: 1,
};

const reference: ReferenceInput = {
  assetId: "synthetic",
  filename: "synthetic.png",
  mimeType: "image/png",
  bytes: Buffer.from("fixture"),
  sha256: "0".repeat(64),
};

const previousKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousKey;
});

describe("Gemini adapter", () => {
  it("fails exactly with GEMINI_API_KEY_MISSING without leaking a credential", async () => {
    delete process.env.GEMINI_API_KEY;
    const adapter = new GeminiAdapter({ apiKey: undefined, config });
    const prompt = await composePrompt("C0");
    await expect(
      adapter.generate({ condition: "C0", prompt, reference }),
    ).rejects.toMatchObject({
      code: "API_FAILURE",
      message: "GEMINI_API_KEY_MISSING",
    });
    try {
      await adapter.generate({ condition: "C0", prompt, reference });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("fixture-secret");
      expect(error).toBeInstanceOf(ExperimentFailure);
    }
  });

  it("uses structured assembly output for C2 and records the exact model", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const adapter = new GeminiAdapter({
      apiKey: "fixture-secret",
      config,
      fetchImpl: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"version":"1.0","parts":[]}' }] } }],
            usageMetadata: { totalTokenCount: 9 },
          }),
          { status: 200 },
        );
      },
    });
    const result = await adapter.generate({
      condition: "C2",
      prompt: await composePrompt("C2"),
      reference,
    });
    const generationConfig = requestBody?.generationConfig as Record<string, unknown>;
    expect(generationConfig.responseMimeType).toBe("application/json");
    expect(generationConfig.responseJsonSchema).toBeTypeOf("object");
    expect(result.requestEvidence.model_id).toBe("gemini-3.7-flash");
    expect(result.requestEvidence.api_attempt_number).toBe(1);
  });

  it("accounts for transport retries separately", async () => {
    let calls = 0;
    const adapter = new GeminiAdapter({
      apiKey: "fixture-secret",
      config,
      sleep: async () => undefined,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 503 });
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "source" }] } }] }),
          { status: 200 },
        );
      },
    });
    const result = await adapter.generate({
      condition: "C0",
      prompt: await composePrompt("C0"),
      reference,
    });
    expect(result.transportRetries).toBe(1);
    expect(result.attempts.map((attempt) => attempt.outcome)).toEqual([
      "API_TRANSPORT_RETRY",
      "SUCCESS",
    ]);
    expect(result.requestEvidence.api_attempt_number).toBe(2);
  });
});
