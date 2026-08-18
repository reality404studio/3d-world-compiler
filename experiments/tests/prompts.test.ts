import { describe, expect, it } from "vitest";
import { composePrompt } from "../runner/prompts";

describe("condition prompt composition", () => {
  it("keeps one immutable common task across every condition", async () => {
    const prompts = await Promise.all(
      (["C0", "C1", "C2", "C3"] as const).map(composePrompt),
    );
    expect(new Set(prompts.map((prompt) => prompt.commonSha256)).size).toBe(1);
    expect(prompts[0]!.common).toContain("Construct one static 3D asset");
    expect(prompts[0]!.common).toContain("Do not include animation");
  });

  it("makes C0 and C1 differ only through the explicit soft treatment", async () => {
    const c0 = await composePrompt("C0");
    const c1 = await composePrompt("C1");
    expect(c0.common).toBe(c1.common);
    expect(c0.condition).not.toContain("5,000 triangles");
    expect(c0.condition).not.toContain("ellipsoid, capsule");
    expect(c1.condition).toContain("5,000 triangles");
    expect(c1.condition).toContain("multiple of 15 degrees");
    expect(c0.conditionSha256).not.toBe(c1.conditionSha256);
  });

  it("uses the exact same generation representation for C2 and C3", async () => {
    const c2 = await composePrompt("C2");
    const c3 = await composePrompt("C3");
    expect(c3.condition).toBe(c2.condition);
    expect(c3.conditionSha256).toBe(c2.conditionSha256);
  });
});
