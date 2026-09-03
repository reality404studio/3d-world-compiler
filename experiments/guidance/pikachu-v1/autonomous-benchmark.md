# Autonomous Fable-guided Pikachu Benchmark

## Condition being measured

This condition measures an agentic pipeline, not a single unaided model call:

`Fable architecture specification -> Gemini CLI orchestrator -> Gemini builder subagent -> Gemini reviewer subagent -> fixed evaluator`

The previous Gemini reconstruction under `experiments/models/pikachu-v1/` is read-only failure evidence. The new implementation must live under `experiments/models/pikachu-fable-v1/`.

## No human stage gates

A human may start the benchmark and inspect the final artifacts after termination, but must not decide whether an intermediate stage passes, suggest parameter changes, select between variants, or tell the agent when to continue.

The primary Gemini CLI session is the orchestrator. It delegates implementation work and visual review to separate local subagents. Stage transitions are decided from fixed tests plus the reviewer verdict.

Do not call `ask_user` for modeling, visual, representation, or stage-progression decisions. If required infrastructure or input is missing, terminate as `INFRA_FAILURE` instead of asking the human to solve the benchmark.

## Autonomous stage loop

For each stage in the Fable specification:

1. The orchestrator delegates the requested stage to `pikachu-builder`.
2. The builder changes only the new implementation, runs applicable validation, performs serialization round-trip checks, and produces fixed-view captures.
3. The orchestrator delegates the resulting reference/captures and relevant specification section to `pikachu-reviewer`.
4. The reviewer returns `PASS` or `FAIL`, a failure class, evidence by yaw, and a rollback target when applicable.
5. A stage advances only if hard checks pass and the reviewer returns `PASS`.
6. On `FAIL`, the orchestrator delegates the review findings back to the builder for one bounded repair cycle.
7. Allow at most two repair cycles per stage. If the same stage still fails after the second repair review, terminate as `BENCHMARK_FAIL` and preserve all artifacts. Do not ask a human to rescue the run.

## Failure classes

The reviewer must classify failures as one of:

- `SERIALIZATION_FAILURE`
- `PARAMETER_ERROR`
- `REPRESENTATION_ERROR`
- `ATTACHMENT_ERROR`
- `MULTIVIEW_REGRESSION`
- `INFRA_FAILURE`

A representation failure triggers rollback according to the Fable specification rather than accumulating local patches.

## Authority order

When evidence conflicts, use:

1. actual repository runtime / validator / evaluator behavior;
2. observed fixed-view renders of the round-tripped object;
3. the Fable reconstruction architecture;
4. Fable numeric parameter estimates;
5. model prior knowledge about Pikachu.

The architecture may be tuned numerically, but do not silently replace the two-lathe core, surface-derived attachments, blade ears, volumetric tail, or surface-following stripes with the previous primitive assembly.

## Frozen-environment boundary

Do not modify the frozen apparatus. In particular, do not change root `src/`, `protocol/`, `world/`, `docs/`, root scripts, evaluator files, tests, package files, or freeze manifests to make the candidate pass.

The benchmark candidate and any experiment-local runner/support code belong under `experiments/`.

## Benchmark outputs

Preserve at minimum:

- final source and parameter files;
- per-stage neutral captures;
- final neutral six-view captures;
- final authored six-view captures;
- round-trip evidence;
- reviewer verdicts for each stage;
- repair count per stage;
- deviations from the Fable architecture;
- final status: `BENCHMARK_PASS`, `BENCHMARK_FAIL`, or `INFRA_FAILURE`.

## Zero-interaction execution

For a run intended to have no human tool-approval clicks, launch Gemini CLI in an isolated checkout/worktree with an approval mode that automatically permits the benchmark's local edits and commands. This changes only tool authorization; it must not introduce human modeling judgments into the run.

The benchmark report should record the Gemini CLI version, selected main model, selected subagent models, and the exact branch/commit used.