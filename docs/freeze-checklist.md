# Environment-v0 freeze checklist

Do not tag or freeze automatically. A human reviewer must complete every item before declaring environment-v0 immutable.

## Review gates

- [ ] Confirm the DSL cannot express camera, light, renderer, background, texture, shader, or arbitrary geometry controls.
- [ ] Confirm all eight fixed geometries and their triangle costs match.
- [ ] Confirm the five material records are neutral and not tuned to a target reference.
- [ ] Confirm transform bounds, 15-degree rotation quantum, 24-part limit, and 5,000-triangle budget.
- [ ] Confirm schema validation remains separate from semantic validation.
- [ ] Confirm every public compile path rejects invalid input before constructing a renderable scene.
- [ ] Confirm `mirrorOf` executes the documented local reflection and cannot be overridden.
- [ ] Confirm normalization, camera, light, background, resolution, and five yaw values are fixed.
- [ ] Run `npm test`, `npm run build`, and the documented smoke capture command on the review machine.
- [ ] Inspect all five smoke images and confirm the fixture is abstract/non-character.
- [ ] Review every dependency and the committed lockfile.
- [ ] Confirm no reference assets, model APIs, scoring, repair, or experiment condition implementations are present.

## Exact proposed immutable boundary

After all review gates pass, freeze these paths at the reviewed commit:

- `world/world-v0.json`
- `protocol/world.schema.json`
- `protocol/assembly.schema.json`
- `src/types.ts`
- `src/world.ts`
- `src/compiler/`
- `src/validation/`
- `src/viewer/environment.ts`
- `src/viewer/normalize.ts`
- `src/viewer/capture.ts`
- `src/main.ts`
- `src/style.css`
- `scripts/io.ts`
- `scripts/validate.ts`
- `scripts/capture.ts`
- `fixtures/smoke/assembly.json`
- `fixtures/invalid/`
- `tests/`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `README.md`
- `docs/design.md`
- `docs/freeze-checklist.md`

Generated `captures/`, `dist/`, dependencies in `node_modules/`, coverage output, local caches, and operating-system metadata are not part of the immutable boundary.

If any immutable path changes after review, invalidate the freeze decision, rerun the complete checklist, and record a new reviewed commit. Human review—not this PR—decides whether to tag that commit as environment-v0.
