# Environment-v0 freeze checklist

Do not merge, tag, or freeze automatically. A human reviewer must complete every item and record the manifest trust anchor outside the subject workspace.

## Review gates

- [ ] Confirm C2/C3 produce an `Object3D` before entering the same condition-independent observation boundary available to future C0/C1.
- [ ] Confirm `renderable-v0` accepts only exact `Object3D`, `Group`, and `Mesh` nodes while allowing arbitrary triangle geometry inside `Mesh`.
- [ ] Confirm direct and crafted serialized `Scene`, light, camera, sprite, points, line, LOD, audio, and custom-subclass nodes fail with `UNSUPPORTED_RENDERABLE_NODE`.
- [ ] Confirm `src/main.ts` and `src/viewer/` do not import or compile assembly documents.
- [ ] Confirm authored and neutral material modes keep geometry, material policy, and environment settings separate.
- [ ] Confirm the DSL cannot express camera, light, renderer, background, texture, shader, or arbitrary geometry controls.
- [ ] Confirm all eight geometries, triangle costs, and wedge hard-edge normals.
- [ ] Confirm world-v0 owns all C2/C3 material names and public compile/validation APIs cannot accept another `WorldSpec`.
- [ ] Confirm prototype names (`toString`, `constructor`, `__proto__`) fail material validation.
- [ ] Confirm exactly one effective root and document that hierarchy does not guarantee physical contact.
- [ ] Confirm bounds, 15-degree rotations, 24-part limit, and 5,000-triangle budget.
- [ ] Confirm normalization erases absolute scale, cross-asset scale, translation, and grounding, and that none are claimed evaluation dimensions.
- [ ] Confirm six yaws `0/45/90/180/270/315` with unchanged camera, elevation, framing, lighting, background, and resolution.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and both authored and neutral smoke captures.
- [ ] Inspect all six authored and all six neutral images; confirm the fixture is abstract/non-character.
- [ ] Review dependencies and lockfile.
- [ ] Confirm the evaluator image bakes source, lockfile dependencies, Chromium, and the approved manifest digest.
- [ ] Confirm the trusted invocation uses an immutable image digest, read-only root, non-root user, no network, dropped capabilities, no-new-privileges, read-only input, and only one writable output bind.
- [ ] Confirm the evaluator verifies the manifest before and after capture and rejects writable evaluator/input or non-writable output paths.
- [ ] Confirm the `Evaluator Docker Isolation` GitHub Actions check passed on the exact PR head under review.
- [ ] Confirm no deferred experiment/model/solver work entered scope.

## Integrity approval procedure

1. Regenerate the candidate only during review: `npm run freeze:manifest`.
2. Rerun all gates because regeneration reflects the current working tree.
3. Print the manifest SHA-256: `npm run freeze:verify -- --print-hash`.
4. Store that digest in a preregistration, CI secret, evaluator configuration, or other location outside the subject-writable checkout.
5. Build the evaluator image from that exact reviewed commit, supplying the approved manifest SHA-256 as `EXPECTED_MANIFEST_SHA256`.
6. Push the image and record its immutable registry digest outside the subject-writable workspace.
7. Have a trusted external experiment runner invoke only that digest with the fixed container policy from `src/evaluator/container-policy.ts`.
8. Treat any non-zero exit, `FROZEN_ENVIRONMENT_MODIFIED`, `UNSUPPORTED_RENDERABLE_NODE`, or `EVALUATOR_ISOLATION_VIOLATION` as a failed/invalid evaluation.
9. Never regenerate the manifest to make a failed experiment pass.

The manifest checks changes, missing files, and added files inside protected directories. It is integrity evidence, not write prevention. The evaluator container separately enforces immutable execution; it is not a full experiment runner.

## Evaluator image/runtime review

Build from the exact candidate commit and approved candidate manifest digest:

```bash
docker build \
  --build-arg EXPECTED_MANIFEST_SHA256=<approved-manifest-sha256> \
  -f evaluator/Dockerfile \
  -t registry.example/environment-v0:review .
```

Before freeze, publish to a controlled registry and record the resulting `name@sha256:...` reference externally. Exercise the reference launcher with a valid renderable and a crafted light-injected renderable:

```bash
npm run evaluator:run -- \
  --image registry.example/environment-v0@sha256:<approved-image-digest> \
  --input /absolute/path/renderable.json \
  --output /absolute/path/captures \
  --material neutral
```

- [ ] Valid permitted `Group`/`Mesh` artifact captures six views.
- [ ] Light-injected artifact exits non-zero with `UNSUPPORTED_RENDERABLE_NODE`.
- [ ] Evaluator root/source/`node_modules` are not writable.
- [ ] Input file is not writable.
- [ ] Output directory is writable and is the only writable host bind.
- [ ] Container networking is `none`; loopback-only viewer capture still succeeds.
- [ ] Authored and neutral modes both invoke the same common capture implementation.

Local Docker is not required. `.github/workflows/evaluator-isolation.yml` builds and runs the actual evaluator image on every pull request and may also be invoked manually. Its successful PR check supplies candidate runtime evidence for the checkboxes above. Human freeze review must still confirm that the check belongs to the exact approved commit and must separately build/publish/record the final immutable registry digest. Do not declare environment-v0 frozen from a mutable tag or an earlier workflow run.

## Exact proposed immutable boundary

The machine-readable source of truth is `src/integrity/frozen-paths.ts`, expanded into `freeze/environment-v0.manifest.json`. It protects:

- `.gitignore`
- `.dockerignore`
- `.github/workflows/evaluator-isolation.yml`
- `README.md`
- `docs/design.md`
- `docs/freeze-checklist.md`
- `evaluator/Dockerfile`
- `fixtures/invalid/`
- `fixtures/smoke/assembly.json`
- `index.html`
- `package.json`
- `package-lock.json`
- `protocol/`
- `scripts/capture.ts`
- `scripts/create-evaluator-test-inputs.ts`
- `scripts/evaluate-renderable.ts`
- `scripts/generate-freeze-manifest.ts`
- `scripts/io.ts`
- `scripts/run-evaluator.ts`
- `scripts/validate.ts`
- `scripts/verify-freeze.ts`
- `src/compiler/`
- `src/evaluator/`
- `src/integrity/`
- `src/main.ts`
- `src/materials/`
- `src/observation/`
- `src/style.css`
- `src/types.ts`
- `src/validation/`
- `src/viewer/`
- `src/world.ts`
- `tests/`
- `tsconfig.json`
- `vite.config.ts`
- `world/world-v0.json`

The manifest file itself is authenticated by the separately stored external digest; it cannot include its own hash. Generated `captures/`, `dist/`, local-workspace `node_modules/`, coverage, local caches, and OS metadata are outside the checkout manifest. The evaluator's own baked `node_modules` is separately non-writable inside the approved container image.

If any protected file changes after review, invalidate the approval, rerun the full checklist, generate a new manifest, and record a new external digest. Human review—not this PR—decides whether to freeze or tag environment-v0.
