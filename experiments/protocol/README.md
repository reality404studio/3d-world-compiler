# Representation-constraint experiment protocol v1

## Research question and hypothesis

This infrastructure asks whether progressively narrowing and enforcing a model's representation space changes reference fidelity, output variance, 3D coherence, world consistency, and search/repair efficiency.

The preregistered hypothesis is that representation constraints **may** improve reliability by shrinking the model's effective search space. This repository does not claim that hypothesis is proven. It builds reproducible apparatus and records evidence; it does not score or interpret results.

Gemini is the experimental subject. The runner is fixed infrastructure. Every request uses the exact model ID `gemini-3.7-flash`, and every run records that ID and the complete sampling configuration.

## Treatment ladder

```text
C0 FREE
reference + common task -> Gemini -> free-form Three.js source

C1 PROMPT-CONSTRAINED
reference + common task + natural-language world rules
-> Gemini -> free-form Three.js source

C2 HARD DSL
reference + common task + assembly schema/world-v0
-> Gemini -> assembly JSON -> frozen validator/compiler

C3 HARD DSL + VERIFIER
same C2 representation -> external verifier -> bounded repair loop
```

The primary distinctions are:

- C0 uses an unconstrained authoring representation with only the minimum execution contract.
- C1 adds soft natural-language constraints but does not technically enforce world-v0 in the generation workspace.
- C2 makes those representational constraints hard by accepting assembly JSON only and passing it through the frozen environment-v0 validator and compiler.
- C3 retains the exact C2 representation and adds external feedback. It is not runnable until that verifier policy is independently reviewed and frozen.

The versioned common task is identical in every condition. C0 does not receive world-v0 primitive, material, transform, hierarchy, mirroring, or complexity rules. C1 receives those rules only as prose. C2/C3 receive the exact frozen schema and world specification at prompt-composition time.

## Frozen trust anchors

Every run is bound to:

- environment-v0 commit: `91501a2e90d5d550acff01c3255f72c650ba1c03`
- manifest SHA-256: `315d5a625e53c0cd9f01d63eba6f206ffd349f74ebf824d14634de7d9c2428f9`
- evaluator image: `ghcr.io/reality404studio/3d-world-compiler-evaluator@sha256:e5ec14d963e7e4b84d76af0c64de36e3841354033b92623a27e340d74fd0177f`

The runner verifies the frozen manifest before generation and again after a successful evaluation. The evaluator image separately verifies its baked environment before and after capture. It is invoked with a read-only root filesystem, non-root user, no network, dropped capabilities, no-new-privileges, a read-only renderable input, and one writable capture output.

No environment-v0 protected path is owned by this experimental layer. Everything in this PR is under the new `experiments/` path.

## C0/C1 untrusted-code boundary

Generated free-form code is preserved exactly as `subject-source.js`. It is never executed in the checkout or frozen evaluator workspace. The fixed subject adapter:

- uses Three.js `0.185.1` from its own lockfile;
- runs in an isolated temporary directory and separate Docker container;
- mounts only generated source read-only and an isolated temporary output;
- has no repository/evaluator mount, network, inherited secret environment, or Gemini key;
- uses a read-only root, non-root user, dropped capabilities, CPU/memory/PID limits, and a host timeout;
- accepts only exact `Object3D`, `Group`, and `Mesh` trees;
- emits one static `renderable-v0` document.

Only that serialized artifact crosses into the trusted frozen evaluator. Subject stdout and stderr are captured separately. Build the fixed subject-side image before a future authorized C0/C1 run:

```bash
docker build \
  -f experiments/subjects/Dockerfile \
  -t 3d-world-compiler-subject-v0:three-0.185.1 \
  experiments/subjects
```

## C2 and C3 behavior

C2 uses Gemini structured JSON output mode. The exact candidate text is parsed once with `JSON.parse`. Markdown fences, leading prose, trailing prose, malformed JSON, schema violations, or semantic violations are recorded as failures. The runner performs no cleanup, extraction, coercion, or repair.

C3's bounded state-machine interface separates model repairs from API transport retries, but the checked-in policy is deliberately unfrozen and has a zero repair budget. Attempting C3 returns `C3_VERIFIER_NOT_FROZEN` before any Gemini request. No LLM judge or image-similarity metric has been selected.

## Run evidence

Each run receives a new `experiments/runs/<run_id>/` directory. Creation is exclusive: an existing directory or artifact is never overwritten. Generated runs are ignored by Git except for the directory placeholder.

Evidence includes, as applicable:

- `manifest.json`, `request.json`, and the exact composed `prompt.txt`;
- exact `raw-response.txt`, parsed `raw-response.json`, and per-attempt API evidence;
- `subject-source.js` or parsed `assembly.json`;
- `validation.json`, `execution.json`, and `renderable.json`;
- separate subject/evaluator stdout and stderr logs;
- neutral and authored six-view capture directories.

The manifest records reference and prompt hashes, explicit request settings, latency, returned usage metadata, API transport-retry count, model-repair count, failure-specific statuses, and all frozen trust anchors. `GEMINI_API_KEY` is read only by the API adapter and is never written to a request, response, log, prompt, or manifest. If absent, generation fails with `GEMINI_API_KEY_MISSING`.

## Evaluations

Every successful condition artifact requests both capture modes from the same immutable evaluator image:

1. neutral material six-view captures — primary geometry-only observation;
2. authored material six-view captures — retained for material and world-style analysis.

No score is computed. Transport retries are recorded as `API_TRANSPORT_RETRY` attempts and are not model repairs. Semantic/task failures never trigger an automatic API retry or repair.

## Planned pilot — not authorized to run

The planned matrix contains one model, four future references (Pikachu, Magikarp, Psyduck, and Magnemite), C0/C1/C2, and eventually two independent runs per asset/condition. C3 remains deferred. No target references are checked in and no paid API call is made by tests or setup.

## Known limitations

- Normalized captures do not measure absolute physical scale or cross-asset physical scale.
- Normalization also erases translation and grounding as evaluation dimensions.
- A parent hierarchy does not guarantee physical intersection, contact, containment, support, or attachment.
- The underside is not fully observed by the fixed six-view apparatus.
- C0/C1 and C2 necessarily use different authoring representations.
- C1 compliance can only be analyzed after generation because its rules are intentionally not technically enforced.
- C3 is not runnable until a verifier policy is separately frozen.
- No fidelity metric, LLM judge, image similarity measure, or interpretation policy is included.

## Mock-only verification

Infrastructure checks make no Gemini calls and require no target reference:

```bash
npx tsc -p experiments/tsconfig.json
npx vitest run experiments/tests
npm run freeze:verify -- --expect 315d5a625e53c0cd9f01d63eba6f206ffd349f74ebf824d14634de7d9c2428f9
```

The CLI exists for a separately authorized future run:

```bash
node --import tsx experiments/runner/cli.ts \
  --run-id <new-run-id> \
  --condition C0 \
  --asset-id <approved-asset-id> \
  --reference /absolute/path/reference.png \
  --reference-mime image/png
```

Do not invoke it merely to test connectivity.
