# Launch prompt for the primary Gemini CLI agent

Run the Fable-guided Generation 1 Pikachu reconstruction benchmark autonomously.

Read first:

- `experiments/guidance/pikachu-v1/autonomous-benchmark.md`
- `experiments/guidance/pikachu-v1/fable-implementation-spec.md`

The previous candidate under `experiments/models/pikachu-v1/` is read-only evidence. The measured candidate must be created under `experiments/models/pikachu-fable-v1/`.

Use the project-local `pikachu-builder` and `pikachu-reviewer` subagents. You are the orchestrator: subagents cannot recursively invoke one another.

Do not ask me to judge intermediate renders, approve stage transitions, select variants, or suggest parameter changes. Follow the autonomous stage loop and bounded repair rules in `autonomous-benchmark.md`. If infrastructure is missing, stop as `INFRA_FAILURE`. If a stage cannot pass within its repair budget, stop as `BENCHMARK_FAIL`. Otherwise continue through final regression and report `BENCHMARK_PASS`.

Before Stage 0, record the CLI version, selected model(s), current commit, and reference-image hash. Treat the Fable architecture as the representation prior; numeric values may be tuned from render evidence, but do not regress to the previous sphere-stack / pencil-ear / shallow-tail / hoop-stripe representation.

Evaluate the round-tripped object under the fixed evaluator, preserve per-stage reviewer verdicts and captures, and do not modify frozen apparatus paths.