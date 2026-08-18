# 3D World Compiler

3D World Compiler is the frozen-environment candidate for a research prototype about **representation constraints** in symbolic 3D generation. This repository implements the deterministic C2/C3 symbolic compiler and a condition-independent observation boundary. It does not generate target assets or run model experiments.

A prompt constraint asks a model to obey a rule. This compiler makes the C2/C3 legal design space executable: an assembly that names an unavailable primitive, invents a material, exceeds a bound, or encodes an invalid structure is rejected before rendering.

## Install and run

Node.js 22 or newer is recommended.

```bash
npm install
npx playwright install chromium
npm test
npm run build
npm run dev
```

Validate an assembly with machine-readable output:

```bash
npm run validate -- fixtures/smoke/assembly.json
npm run validate -- fixtures/invalid/unknown-primitive.json
```

Capture the six fixed views with authored or shared-neutral materials:

```bash
npm run capture -- fixtures/smoke/assembly.json
npm run capture -- fixtures/smoke/assembly.json --material neutral --output captures/smoke-neutral
```

The default outputs are `view-000.png`, `view-045.png`, `view-090.png`, `view-180.png`, `view-270.png`, and `view-315.png`. Captures are reproducible outputs and are gitignored.

## Shared observation boundary

C2/C3 use this path:

```text
assembly -> schema/semantic validation -> frozen world-v0 compiler -> Object3D
         -> COMMON renderable serialization/material policy/normalization/viewer/capture
```

The common path starts at condition-independent Three.js `Object3D` content. `captureRenderableObject` serializes that content into the minimal `renderable-v0` transport, and the browser applies the same material policy, normalization, environment, cameras, resolution, and capture code.

Future C0/C1 implementations may construct an `Object3D` and call the same frozen entry point. They do not need to modify viewer or capture files, and they are not forced through the assembly DSL. C0/C1 generation is deliberately not implemented here.

## Assembly DSL

An assembly contains a version and a bounded list of parts. Explicit parts select one primitive and one fixed-palette material, then supply a parent-local transform. A valid assembly has exactly one effective root.

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
    }
  ]
}
```

`mirrorOf` is executable, not descriptive. A derived mirror cannot override primitive, material, parent, or transform. The compiler copies source geometry/material and applies an exact reflection to its parent-local matrix. Mirror chains are disallowed.

The legal world in `world/world-v0.json` allows eight fixed-tessellation primitive families, five own-property palette names, at most 24 parts, bounded transforms, 15-degree rotations, and 5,000 triangles. The experiment-facing validator and compiler are bound to this deeply frozen world; callers cannot substitute a custom `WorldSpec`.

Parenthood provides a transform hierarchy only. It does **not** guarantee intersection, surface contact, containment, support, or physical attachment. A physical contact solver is outside environment-v0.

## Separate evaluation axes

- Geometry is supplied by the condition's renderable object.
- Material policy is selected by the frozen material layer.
- Lighting, camera, background, resolution, and framing are supplied by the frozen environment.

`authored` preserves the renderable object's materials. `neutral` clones the object hierarchy and replaces mesh materials with one frozen neutral `MeshStandardMaterial` while retaining geometry objects unchanged. This supports geometry-only observation under a shared BRDF without changing condition geometry.

## Validation

`protocol/assembly.schema.json` handles JSON shape. `src/validation/semantic.ts` then enforces world membership, own-property material lookup, finite bounds, quantization, unique ids, parent/mirror references, acyclic structure, exactly one root, part limits, and triangle limits.

Errors include `SCHEMA_INVALID`, `INVALID_PRIMITIVE`, `UNKNOWN_MATERIAL`, `UNKNOWN_PARENT`, `PARENT_CYCLE`, `ROOT_COUNT_INVALID`, `OUT_OF_RANGE`, `ROTATION_NOT_QUANTIZED`, `PART_LIMIT_EXCEEDED`, and `TRIANGLE_BUDGET_EXCEEDED`.

## Freeze integrity

`freeze/environment-v0.manifest.json` contains the deterministic SHA-256 and byte size of every proposed frozen file plus the protected path policy. The verifier detects content changes, missing files, and additional files inside protected directories.

The manifest cannot safely self-authenticate. After human approval, record its SHA-256 outside the subject-writable workspace. Use that external digest both before and after every later experiment run:

```bash
npm run freeze:verify -- --print-hash
npm run freeze:verify -- --expect <approved-manifest-sha256>
# run a future experiment
npm run freeze:verify -- --expect <approved-manifest-sha256>
```

Any mismatch exits non-zero and returns `FROZEN_ENVIRONMENT_MODIFIED`. Do not run `freeze:manifest` during an experiment; it is a review-time candidate regeneration command only.

## Normalization policy

Every condition uses the same center-and-uniform-scale normalization. Consequently normalized captures do **not** evaluate absolute world scale, cross-asset relative physical scale, or ground placement. Translation and uniform scale are intentionally erased. Those properties must not be claimed as later evaluation dimensions.

See `docs/design.md` for exact semantics and `docs/freeze-checklist.md` for the human-review and trust-anchor procedure.

## Out of scope

No reference images, target assets, model APIs, C0/C1 generation, C3 repair, image scoring, mesh retrieval, collision/contact solver, position quantization, scale quantization, or primitive-library expansion is included.
