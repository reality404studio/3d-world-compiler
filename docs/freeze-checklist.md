# Environment-v0 freeze checklist

Do not merge, tag, or freeze automatically. A human reviewer must complete every item and record the manifest trust anchor outside the subject workspace.

## Review gates

- [ ] Confirm C2/C3 produce an `Object3D` before entering the same condition-independent observation boundary available to future C0/C1.
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
- [ ] Confirm no deferred experiment/model/solver work entered scope.

## Integrity approval procedure

1. Regenerate the candidate only during review: `npm run freeze:manifest`.
2. Rerun all gates because regeneration reflects the current working tree.
3. Print the manifest SHA-256: `npm run freeze:verify -- --print-hash`.
4. Store that digest in a preregistration, CI secret, evaluator configuration, or other location outside the subject-writable checkout.
5. Before and after every later run, execute `npm run freeze:verify -- --expect <approved-sha256>`.
6. Treat any non-zero exit and `FROZEN_ENVIRONMENT_MODIFIED` as a failed/invalid run.
7. Never regenerate the manifest to make a failed experiment pass.

The manifest checks changes, missing files, and added files inside protected directories. It does not itself create a read-only mount or full experiment runner. Those execution controls must consume this verifier later.

## Exact proposed immutable boundary

The machine-readable source of truth is `src/integrity/frozen-paths.ts`, expanded into `freeze/environment-v0.manifest.json`. It protects:

- `.gitignore`
- `README.md`
- `docs/design.md`
- `docs/freeze-checklist.md`
- `fixtures/invalid/`
- `fixtures/smoke/assembly.json`
- `index.html`
- `package.json`
- `package-lock.json`
- `protocol/`
- `scripts/capture.ts`
- `scripts/generate-freeze-manifest.ts`
- `scripts/io.ts`
- `scripts/validate.ts`
- `scripts/verify-freeze.ts`
- `src/compiler/`
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

The manifest file itself is authenticated by the separately stored external digest; it cannot include its own hash. Generated `captures/`, `dist/`, `node_modules/`, coverage, local caches, and OS metadata are outside the boundary and may be written without changing the verified environment.

If any protected file changes after review, invalidate the approval, rerun the full checklist, generate a new manifest, and record a new external digest. Human review—not this PR—decides whether to freeze or tag environment-v0.
