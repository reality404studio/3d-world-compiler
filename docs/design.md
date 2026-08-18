# Environment-v0 design

## Constraint boundary

World-v0 is a small symbolic language whose invalid states are rejected before rendering. Natural-language requests are not enforcement. The assembly schema, semantic validator, and compiler collectively define what can be represented and executed.

The assembly is never allowed to supply Three.js code or environment values. The renderer consumes compiler output only after both validation phases succeed.

## Coordinate system and transforms

The compiler uses the Three.js right-handed coordinate system: +X is right, +Y is up, and the default front view camera is on +Z looking toward the origin.

Explicit part transforms use:

- `position`: parent-local `[x, y, z]`, each component in `[-4, 4]`.
- `rotation`: parent-local XYZ Euler degrees in `[-180, 180]`, each divisible by 15.
- `scale`: parent-local positive `[x, y, z]`, each component in `[0.1, 3]`.

Parts may appear before or after their parents in JSON. Compilation first creates every object, then links the validated parent graph. Multiple roots are legal and enter one compiler-owned root group. At least one effective root is required.

## Fixed primitive definitions

Assemblies choose a family but expose no tessellation or constructor parameters. Scale is the only size control.

| Primitive | Unit definition | Triangles |
| --- | --- | ---: |
| `sphere` | radius 0.5, 16x8 segments | 224 |
| `ellipsoid` | the sphere scaled internally by `[1, 1.3, 0.8]` | 224 |
| `capsule` | radius 0.3, straight length 0.6, 6x12 segments | 312 |
| `cone` | radius 0.5, height 1, 16 radial segments | 32 |
| `frustum` | radii 0.35/0.5, height 1, 16 radial segments | 64 |
| `box` | unit box | 12 |
| `wedge` | unit triangular prism | 8 |
| `tube` | straight capped tube, radius 0.16, height 1, 12 radial segments | 48 |

The tube is deliberately a straight fixed cylinder rather than an arbitrary path tube. The wedge is a fixed triangular prism. These simplifications keep the search space small and deterministic.

The world charges the exact fixed triangle count for every explicit or derived part. An assembly above 5,000 triangles is rejected before geometry is constructed.

## Executable mirroring

A mirror record has exactly three fields:

```json
{ "id": "right-fin", "mirrorOf": "left-fin", "axis": "x" }
```

The source must be an explicit base part. The mirror inherits its source primitive, geometry, material, and parent. If `M` is the source parent-local matrix and `Faxis` is the exact axis reflection matrix, the derived local matrix is:

```text
Mmirror = Faxis * M
```

The reflection is performed about the source parent's local origin. It is stored as a fixed matrix, including its negative determinant, rather than approximated through independently editable Euler values. This guarantees that the relation executes exactly. Chained mirrors are disallowed to avoid ambiguous dependency semantics in v0.

## Material lookup

Assemblies store a material name only. The name must resolve in `world/world-v0.json`. That file fixes color, roughness, and metalness for `clay`, `slate`, `sand`, `teal`, and `coral`. There are no per-part material parameters, textures, shaders, transparency, or arbitrary colors.

## Validation phases

Schema validation checks document shape, version, ids, arrays, and the exclusive explicit/mirror part forms. Semantic validation then enforces the active world:

- allowed primitives and materials;
- unique ids and valid parent/mirror references;
- acyclic effective parent relationships and at least one root;
- finite transform numbers, numeric bounds, and rotation quantization;
- maximum 24 parts and maximum 5,000 triangles;
- explicit-only mirror sources and no self-reference or mirror chains.

The compiler calls the combined validator itself. A caller cannot accidentally bypass validation by calling the normal compile entry point.

## Normalization

The compiler output's world-space axis-aligned bounding box is calculated after all parent transforms. The object is translated so the box center is at the origin, then uniformly scaled so its largest dimension is 2.2 world units. The fixed environment is not modified. Empty, degenerate, or non-finite bounds fail normalization.

This center-and-uniform-scale rule means assemblies are compared at a consistent extent without permitting them to control framing. Ground contact is not preserved; centering was chosen because the fixtures may have arbitrary orientation and multiple roots.

## Fixed environment and camera views

The viewer is 512x512 CSS/device pixels with device scale factor 1 for capture. It uses a `#e7e4de` background, one ambient light, one directional key light, no shadows, a fixed orthographic camera, sRGB output, and no random effects.

All views use radius 5, elevation 20 degrees, orthographic half-extent 1.65, and look at the origin. Only yaw changes: `0`, `45`, `90`, `135`, and `180` degrees. Output names are `view-000.png` through `view-180.png` in the requested directory.

The Playwright package and lockfile pin the browser-driver version. Cross-platform GPU rasterization may still cause small pixel differences, so tests assert successful output rather than brittle pixel equality.

## Deliberate limitations

- No primitive-specific numeric options beyond transform scale.
- No arbitrary paths, topology, mesh import, boolean operations, or custom geometry.
- No constraint solver, repair loop, or external model call.
- Mirror relations must source explicit parts and share their parent's coordinate frame.
- Viewer output is intended for controlled comparison, not photorealism.
- Pixel-identical output across different operating systems/GPU stacks is not claimed; scene and capture parameters are deterministic.
