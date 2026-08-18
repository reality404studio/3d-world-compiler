# 3D World Compiler

3D World Compiler is the frozen-environment candidate for a research prototype about **representation constraints** in symbolic 3D generation. This repository implements only the deterministic environment needed by future C2/C3 conditions. It does not generate target assets and does not run any model experiment.

A prompt constraint asks a model to obey a rule. This compiler instead makes the legal design space executable: an assembly that names an unavailable primitive, invents a material, exceeds a bound, or encodes an invalid structure is rejected before Three.js rendering. Experiment subjects write assembly JSON only; they never write Three.js, viewer, camera, lighting, or normalization code.

## Install and run

Node.js 22 or newer is recommended.

```bash
npm install
npx playwright install chromium
npm test
npm run build
npm run dev
```

The Playwright browser installation is needed once per machine for headless capture.

Validate any assembly with machine-readable output:

```bash
npm run validate -- fixtures/smoke/assembly.json
npm run validate -- fixtures/invalid/unknown-primitive.json
```

Capture the five fixed views:

```bash
npm run capture -- fixtures/smoke/assembly.json
npm run capture -- fixtures/smoke/assembly.json --output captures/custom-name
```

The default smoke output is `captures/smoke/view-000.png`, `view-045.png`, `view-090.png`, `view-135.png`, and `view-180.png`. Captures are reproducible outputs and are intentionally gitignored.

## Assembly DSL

An assembly contains only a version and a bounded list of parts. Explicit parts select one primitive and one fixed-palette material, then supply a parent-local transform:

```json
{
  "version": "1.0",
  "parts": [
    {
      "id": "body",
      "primitive": "ellipsoid",
      "parent": null,
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1.2, 0.8],
      "material": "clay"
    },
    {
      "id": "right",
      "mirrorOf": "left",
      "axis": "x"
    }
  ]
}
```

`mirrorOf` is an executable relation, not a descriptive hint. A derived mirror cannot override primitive, material, parent, or transform. The compiler copies the source geometry/material and applies an exact reflection to its parent-local matrix. Mirror chains are disallowed in world-v0.

The legal world is defined by [world/world-v0.json](world/world-v0.json). It allows eight fixed-tessellation primitive families, five materials, at most 24 parts, bounded transforms, 15-degree rotation increments, and a 5,000-triangle budget. Assembly JSON cannot specify geometry constructors, colors, shaders, textures, camera, lighting, background, renderer, or normalization.

## Validation and compilation

Validation is deliberately split into two phases:

1. `protocol/assembly.schema.json` checks JSON shape and types.
2. `src/validation/semantic.ts` enforces world membership, finite bounds, quantization, unique ids, valid parents, acyclic structure, legal mirrors, roots, part limits, and triangle limits.

Errors include stable codes such as `SCHEMA_INVALID`, `INVALID_PRIMITIVE`, `UNKNOWN_MATERIAL`, `UNKNOWN_PARENT`, `PARENT_CYCLE`, `OUT_OF_RANGE`, `ROTATION_NOT_QUANTIZED`, `PART_LIMIT_EXCEEDED`, and `TRIANGLE_BUDGET_EXCEEDED`.

The deterministic pipeline is:

```text
assembly JSON -> schema validation -> semantic validation
              -> fixed primitive compiler -> normalization
              -> fixed Three.js environment -> five-view capture
```

`src/compiler/compile.ts` validates on every public compilation call, so an invalid symbolic program never reaches rendering.

## Repository boundaries

- `world/`: legal design-space data.
- `protocol/`: JSON schemas for the world and assembly documents.
- `src/validation/`: syntax and semantic gates.
- `src/compiler/`: fixed primitive construction and assembly compilation.
- `src/viewer/`: immutable environment parameters, normalization, and capture.
- `fixtures/smoke/`: abstract end-to-end fixture.
- `fixtures/invalid/`: examples that must fail.
- `tests/`: validator, compiler, mirror, environment, and headless capture checks.

See [docs/design.md](docs/design.md) for exact semantics and [docs/freeze-checklist.md](docs/freeze-checklist.md) for the proposed human-review freeze boundary.

## Out of scope

This environment intentionally contains no reference images, character assets, image ingestion, image generation, image-to-3D, vision or similarity scoring, LLM APIs, repair loops, mesh retrieval, C0/C1 implementations, model comparisons, or experiment runs.
