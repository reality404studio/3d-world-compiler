import { ExperimentFailure } from "./failures";

export interface VerifierResult {
  accepted: boolean;
  feedback: unknown;
}

export interface FrozenVerifierPolicy<Proposal> {
  version: string;
  frozen: true;
  maxRepairs: number;
  verify(proposal: Proposal, attempt: number): Promise<VerifierResult>;
  repair(
    proposal: Proposal,
    result: VerifierResult,
    repairNumber: number,
  ): Promise<Proposal>;
}

export interface RepairTrace<Proposal> {
  proposal: Proposal;
  verifier: VerifierResult;
  attempt: number;
}

export async function runBoundedRepairLoop<Proposal>(
  initialProposal: Proposal,
  policy: FrozenVerifierPolicy<Proposal> | null,
): Promise<{ accepted: boolean; proposal: Proposal; repairs: number; trace: RepairTrace<Proposal>[] }> {
  if (!policy?.frozen) {
    throw new ExperimentFailure(
      "C3_VERIFIER_NOT_FROZEN",
      "C3_VERIFIER_NOT_FROZEN",
    );
  }
  let proposal = initialProposal;
  const trace: RepairTrace<Proposal>[] = [];
  for (let attempt = 0; attempt <= policy.maxRepairs; attempt += 1) {
    const verifier = await policy.verify(proposal, attempt);
    trace.push({ proposal, verifier, attempt });
    if (verifier.accepted) {
      return { accepted: true, proposal, repairs: attempt, trace };
    }
    if (attempt < policy.maxRepairs) {
      proposal = await policy.repair(proposal, verifier, attempt + 1);
    }
  }
  return { accepted: false, proposal, repairs: policy.maxRepairs, trace };
}
