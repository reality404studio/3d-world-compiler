import { describe, expect, it, vi } from "vitest";
import { runBoundedRepairLoop } from "../runner/c3-state-machine";

describe("C3 bounded repair state machine", () => {
  it("refuses to run before a verifier policy is frozen", async () => {
    await expect(runBoundedRepairLoop({ value: 1 }, null)).rejects.toMatchObject({
      code: "C3_VERIFIER_NOT_FROZEN",
      message: "C3_VERIFIER_NOT_FROZEN",
    });
  });

  it("bounds policy-approved repair calls independently from transport retries", async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce({ accepted: false, feedback: "repair" })
      .mockResolvedValueOnce({ accepted: true, feedback: null });
    const repair = vi.fn(async (proposal: number) => proposal + 1);
    const result = await runBoundedRepairLoop(1, {
      version: "fixture-verifier-v1",
      frozen: true,
      maxRepairs: 1,
      verify,
      repair,
    });
    expect(result).toMatchObject({ accepted: true, proposal: 2, repairs: 1 });
    expect(verify).toHaveBeenCalledTimes(2);
    expect(repair).toHaveBeenCalledTimes(1);
  });
});
