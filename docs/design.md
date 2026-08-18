# Environment-v0 design

## Constraint and observation boundaries

World-v0 is a small symbolic language whose invalid C2/C3 states are rejected before rendering. Natural-language requests are not enforcement. The assembly schema, semantic validator, and compiler define what C2/C3 can represent.

The observation apparatus is condition-independent and begins with static Three.js `Object3D` content:

```text
C2/C3: assembly -> validate -> frozen compile -> Object3D --+
                                                            |
future C0/C1: condition generator -> Object3D --------------+
                                                            v
renderable-v0 -> frozen material policy -> normalization
              -> fixed environment -> six-view capture
```

`src/observation/renderable.ts`, `src/materials/policy.ts`, and `src/viewer/` are the common boundary. `src/main.ts` imports no assembly compiler. Future conditions can enter through `captureRenderableObject` or `captureRenderableScene` without modifying common frozen files. C0/C1 generation is not implemented.

## Coordinate system and transforms

The compiler uses the Three.js right-handed coordinate system: +X is right, +Y is up, and the front camera is on +Z looking at the origin.

Explicit assembly transforms use parent-local position `[−4, 4]`, XYZ Euler rotation `[−180, 180]` in 15-degree increments, and positive scale `[0.1, 3]`. Parts may precede parents in JSON; compilation creates objects before linking the validated graph.

Exactly one effective root is required. A mirror inherits its source parent and therefore contributes an effective root when its source is a root.

Parenthood means transform ownership only. It does not assert physical contact, intersection, containment, support, or attachment. Floating children can validate. Physical attachment and collision/contact rules are explicitly deferred and must not be attributed to world-v0.

## Fixed primitives

Assemblies choose a family but expose no tessellation or constructor parameters. Scale is the only size control.

| Primitive | Unit definition | Triangles |
| --- | --- | ---: |
| `sphere` | radius 0.5, 16x8 segments | 224 |
| `ellipsoid` | sphere internally scaled `[1, 1.3, 0.8]` | 224 |
| `capsule` | radius 0.3, length 0.6, 6x12 segments | 312 |
| `cone` | radius 0.5, height 1, 16 radial segments | 32 |
| `frustum` | radii 0.35/0.5, height 1, 16 radial segments | 64 |
| `box` | unit box | 12 |
| `wedge` | unit triangular prism with duplicated hard-edge face vertices | 8 |
| `tube` | straight capped tube, radius 0.16, height 1, 12 segments | 48 |

The world charges the exact triangle count for explicit and mirrored parts. Assemblies above 5,000 triangles fail before geometry construction. The straight tube and fixed wedge are deliberate small-search-space simplifications.

## Executable mirroring

```json
{ "id": "right-fin", "mirrorOf": "left-fin", "axis": "x" }
```

The source must be explicit. The mirror inherits source primitive, geometry, material, and parent. If `M` is the source parent-local matrix and `Faxis` is the reflection matrix, `Mmirror = Faxis * M`. The negative-determinant matrix is preserved through `renderable-v0`. Mirror chains are disallowed.

## Geometry, material, and lighting layers

Geometry belongs to the condition-produced `Object3D`. The C2/C3 compiler assigns only materials declared by frozen world-v0. Own-property membership is required, so `toString`, `constructor`, and `__proto__` are invalid unless a future reviewed world explicitly declares them.

The material-policy layer provides:

- `authored`: preserve condition materials;
- `neutral`: clone the object hierarchy and replace every mesh material with one frozen neutral material (`#b8b8b8`, roughness `0.8`, metalness `0`) while retaining the same geometry references.

Lighting, camera, background, resolution, and rendering settings remain exclusively in `src/viewer/environment.ts`. Neutral mode makes geometry-only observation possible without editing geometry or environment code.

## Frozen world binding

The public assembly validator and compiler have no `WorldSpec` argument. Both close over the deeply frozen `WORLD_SPEC`. Supplying an extra runtime argument has no effect, and invalid documents still fail. Custom worlds are not an experiment-facing extension point.

## Validation phases

Schema validation checks document shape, version, ids, arrays, and exclusive explicit/mirror records. Semantic validation enforces:

- allowed primitives and own-property material names;
- unique ids and valid parent/mirror references;
- acyclic hierarchy and exactly one effective root;
- finite values, numeric bounds, and rotation quantization;
- maximum 24 parts and 5,000 triangles;
- explicit-only mirror sources, no self-reference, and no mirror chains.

The compiler always calls combined validation before creating geometry.

## Normalization policy

After transforms, Three.js computes the object's world axis-aligned bounding box. The object is translated so that box center is at the origin and uniformly scaled so its largest extent is 2.2 units. Empty, degenerate, or non-finite bounds fail.

This policy is applied identically after every condition enters the common boundary. It intentionally erases:

- absolute world scale;
- cross-asset relative physical scale;
- translation and ground placement.

Those properties are not environment-v0 observation dimensions and must not be claimed as later outcomes. A distant outlier can affect framing, and Three.js's default transformed local bounds can overestimate rotated anisotropic geometry. These are fixed policy limitations, not corrected per condition. Tests characterize deterministic centering and uniform-scale erasure.

## Fixed environment and observation views

The viewer is 512x512 CSS/device pixels at device scale factor 1 with background `#e7e4de`, one ambient light, one directional key light, no shadows, a fixed orthographic camera, and sRGB output.

All six views use radius 5, elevation 20 degrees, orthographic half-extent 1.65, and the same origin target. Yaws are:

| File | Yaw | Coverage |
| --- | ---: | --- |
| `view-000.png` | 0° | front |
| `view-045.png` | 45° | front/right diagonal |
| `view-090.png` | 90° | right |
| `view-180.png` | 180° | back |
| `view-270.png` | 270° | left |
| `view-315.png` | 315° | front/left diagonal |

The set exposes both lateral sides and opposing diagonals while keeping camera type, elevation, framing, lighting, resolution, and normalization identical. Undersides remain a documented blind spot. Pixel identity across OS/GPU stacks is not claimed; all conditions must initially run in one pinned execution image.

## Integrity trust boundary

`freeze/environment-v0.manifest.json` deterministically records raw SHA-256, byte size, protected paths, and the exact file set. Verification re-enumerates protected directories, so modifications, deletion, and unapproved additions produce `FROZEN_ENVIRONMENT_MODIFIED`.

The manifest is protected by an external expected SHA-256 supplied to the verifier. This external digest must be stored outside the subject-writable checkout and used before and after execution. The manifest is not self-listed because self-hashing is impossible; its external digest is the trust anchor. This PR supplies the mechanism only, not a full experiment runner, read-only mount, or container policy.

## Adversarial-review disposition

Fixed in code: shared renderable boundary, integrity verification, prototype-safe materials, frozen-world compiler binding, neutral material policy, exactly one root, wedge hard normals, and six bilateral views.

Converted into explicit limitations: parenthood does not imply contact; per-object normalization removes absolute/cross-asset scale and grounding; transformed AABB and underside/cross-platform raster blind spots remain fixed policies.

Deliberately deferred: physical attachment/contact solver, collision constraints, position/scale quantization, C0/C1 generation, C3 repair, image metrics, model APIs, mesh retrieval, primitive expansion, and target assets.
