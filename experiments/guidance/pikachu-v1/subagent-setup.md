# Gemini CLI Subagent Setup

The benchmark is intended to run without human stage judgments. Use the primary Gemini CLI session as the orchestrator and two project-local subagents:

- `pikachu-builder`: write-capable implementation worker for one delegated stage at a time.
- `pikachu-reviewer`: read-only visual/structural judge that inspects the reference plus fixed-view PNG captures and returns a structured PASS/FAIL verdict.

Gemini CLI discovers project-local subagents from `.gemini/agents/*.md`. Create the two agent definitions in the benchmark checkout before starting the measured run. Treat this as environment setup, not benchmark steering; do not change the definitions after the run begins.

## Builder role

The builder should inherit the selected benchmark model, use a low temperature, and have file-read/search, file-edit, and shell-command tools. It must:

- read `fable-implementation-spec.md` and `autonomous-benchmark.md`;
- modify only `experiments/models/pikachu-fable-v1/` plus strictly necessary experiment-local runner files;
- never modify `experiments/models/pikachu-v1/` or frozen apparatus paths;
- implement exactly the stage requested by the primary orchestrator;
- run applicable build/validation and serialization round-trip checks;
- produce neutral fixed-view captures;
- report evidence and changed parameters but not judge its own benchmark PASS/FAIL.

## Reviewer role

The reviewer should inherit the same benchmark model, use a low temperature, and have read/search tools only. Gemini CLI's `read_file` supports images, so the reviewer can inspect PNG captures directly.

For each review it receives:

- the reference image path;
- the stage number and pass conditions;
- the neutral fixed-view capture paths;
- the relevant implementation/spec files.

It must return:

```text
VERDICT: PASS | FAIL
FAILURE_CLASS: SERIALIZATION_FAILURE | PARAMETER_ERROR | REPRESENTATION_ERROR | ATTACHMENT_ERROR | MULTIVIEW_REGRESSION | INFRA_FAILURE
ROLLBACK_STAGE: <stage number or NONE>
EVIDENCE:
- yaw 0: ...
- yaw 45: ...
- yaw 90: ...
- yaw 180: ...
- yaw 270: ...
- yaw 315: ...
REQUIRED_CHANGE: ...
```

The reviewer must never edit files and must not ask the human for a visual judgment.

## Orchestrator behavior

The primary Gemini session owns stage progression because Gemini CLI subagents cannot recursively invoke other subagents. For each stage, the primary agent delegates to builder, then reviewer, then either advances or sends the review findings back to builder for a bounded repair cycle.

Use at most two repair cycles per stage. After the second failed repair review, terminate with `BENCHMARK_FAIL`; do not ask a human to rescue the run.

## Zero-interaction run

If you want no approval clicks during the measured run, use Gemini CLI's automatic approval mode inside an isolated checkout/worktree. Record that mode in the benchmark report. Tool authorization is not a stage judgment; humans still must not supply modeling decisions while the run is active.

At the beginning of the measured run, record the Gemini CLI version, main model, subagent model(s), branch commit, and reference-image hash. Do not change any of those after the run begins.