# Fable-derived Generation 1 Pikachu Implementation Spec

This file is the execution-focused handoff from the full Fable reconstruction architecture. It preserves the architecture decisions and hard constraints needed by the coding agent while keeping the default Gemini context compact.

## Goal

Implement a static Generation 1 Pikachu reconstruction that remains coherent under the repository's fixed multi-view evaluator. Do not redesign the representation from scratch; tune within the architecture unless render evidence triggers an explicit representation rollback.

## Coordinate convention

- `H = 1.0` is crown-to-sole character height, ears and tail excluded.
- Character faces `+Z`.
- `+X` is the character's left.
- Sole plane is `y = 0`.
- Root rotation is identity. Do not rotate the whole character to imitate the reference viewpoint.

## Hard renderable boundary

`build(THREE)` returns one static `Object3D` / `Group` / `Mesh` tree. Do not create Scene, camera, lights, renderer, animation, loaders, network access, or filesystem access inside the candidate asset.

Only exact `Object3D`, `Group`, and `Mesh` nodes may appear in the renderable tree.

## Critical serialization rule

The evaluator round-trips the object through `object.toJSON() -> ObjectLoader.parse()`.

Parametric geometries such as Sphere/Cylinder/Cone/Capsule/Lathe/Extrude/Tube serialize through constructor parameters. In-place geometry mutations can therefore disappear after the round trip.

Rules:

1. Do not vertex-edit, `geometry.scale()`, `geometry.translate()`, or `applyMatrix4()` a parametric `*Geometry` and assume that deformation survives serialization.
2. Primitive transforms should use node `scale` / `position` / `rotation` when appropriate.
3. Vertex-level custom work must use a fresh plain `BufferGeometry` with copied attributes/index and no inherited parametric `parameters` object.
4. Every implementation stage must validate the round-tripped object, not only the direct object.

## Selected representation architecture

### Core mass

Use two profile-controlled lathes:

- torso lathe: pear-shaped body;
- head lathe: wide oblate dome shifted slightly forward.

The two lathes overlap. The head exits the torso at the front/sides to create a jaw/chin overhang while approaching tangency at the rear nape. Do not replace this with stacked spheres or one fused bowling-pin surface.

### Surface attachment system

Use the same sampled lathe profiles to define analytic helpers:

- `surfacePoint(part, y, theta)`
- `surfaceNormal(part, y, theta)`
- `placeOnSurface(part, y, theta, lift)`

Anything semantically attached to head/torso derives from this surface system rather than unrelated world-space depth offsets.

### Ears

Custom tapered blade geometry, not cylinders/cones. Elliptical cross-section with thickness approximately `0.45 * width`, tapering to a point, slight root flare, about 10 degrees of outward curvature. Build both ears with the same generator and `side = ±1`. Root them on the upper-rear skull surface and bury the base slightly to eliminate gaps.

### Tail

Volumetric lightning bolt: a thicker brown root wedge plus a yellow blade. Preserve meaningful depth; do not regress to a shallow outline plate. The tail must remain visibly three-dimensional at the least favorable evaluator yaw.

### Arms and feet

Arms are short capsules rooted through the torso surface. Feet are flattened ellipsoid-like masses via node scale, with substantial forward projection to carry the squat Gen-1 posture.

### Face

Eyes, cheeks, and nose are shallow lens/bump meshes placed by the head surface helper. Mouth follows a surface-sampled curve. Do not use unrelated global Z offsets to keep features visible.

### Back stripes

Surface-following ribbon BufferGeometry sampled from the torso surface. No free-standing TubeGeometry hoops or belts.

## Master dimensions

Use these as starting hypotheses, not immutable truth:

- `H = 1.00`
- `headWidth = 0.84`
- `headDepth = 0.68 = 0.81 * headWidth`
- head lathe bottom / crown = `0.50 / 1.00`
- cheek-level widest head ring `y = 0.64`
- `headForward = 0.07`
- `torsoWidth = 0.84`
- `torsoDepth = 0.80 = 0.95 * torsoWidth`
- belly max `y = 0.40`
- torso dome top `y = 0.90`
- `earLength = 0.38`
- `earBaseWidth = 0.19`
- ear thickness ratio `0.45`
- ear roots `(y=0.92, theta=±100°)`, sink `0.06`
- ear tip fraction `0.30`
- arm length/radius `0.16 / 0.035`
- foot size approximately `(0.18, 0.10, 0.26)`
- tail root `(y=0.45, theta=180°)`, sink `0.03`
- tail plane yaw about `35°`, lean-back `10°`
- tail blade/root thickness `0.07 / 0.11`
- eyes `(y=0.77, theta=±40°)`
- cheeks `(y=0.67, theta=±50°)`
- nose `(y=0.68, theta=0°)`
- mouth around `y=0.61`, span `theta ±22°`
- stripe centers `y=0.62` and `0.47`, spanning roughly `180° ±65°`

## Torso profile control points `(radius, y)`

```text
(0.00, 0.000)
(0.22, 0.005)
(0.32, 0.04)
(0.37, 0.12)
(0.41, 0.28)
(0.42, 0.40)
(0.40, 0.52)
(0.37, 0.62)
(0.33, 0.70)
(0.27, 0.78)
(0.19, 0.85)
(0.10, 0.89)
(0.00, 0.90)
```

Depth scale: `0.95`.

## Head profile control points `(radius, y)`

```text
(0.00, 0.50)
(0.18, 0.51)
(0.30, 0.54)
(0.38, 0.58)
(0.42, 0.64)
(0.415, 0.70)
(0.39, 0.77)
(0.34, 0.85)
(0.25, 0.92)
(0.13, 0.97)
(0.00, 1.00)
```

Depth scale: `0.81`. Head group forward offset: `+0.07 Z`.

## Stage protocol

### Stage 0 — scaffold and round-trip

Implement parameter scaffold, profile/surface helpers, mirrored-part helper, neutral capture path, and explicit serialization round-trip equivalence testing.

Hard gate: direct and round-tripped geometry must match under the fixed environment before later work proceeds.

### Stage 1 — primary masses

Torso + head only. No ears, face, limbs, tail, stripes, or presentation detail.

Target: squat pear body, head approximately as wide as belly, jaw overhang at front/sides, coherent depth, no all-around snowman neck seam.

### Stage 2 — silhouette and depth calibration

Tune profile points, depth scales, and `headForward` only. Do not compensate with appendages.

Target: body width/height about `0.83`; head depth/width about `0.81`; rear nape transition shallow rather than a horizontal neck crease.

### Stage 3 — ears

Add the shared blade-ear generator and surface-rooted attachments. Ears must read as broad tapered wedges from profile and rear views, not pencils or cards.

### Stage 4 — tail, arms, feet

Add volumetric tail and surface-rooted limbs. Tail remains visible in all fixed views; foot mass keeps the Gen-1 squat posture.

### Stage 5 — multi-view structural correction

Run the full fixed-view set under neutral material. Fix structure before face/material detail.

### Stage 6 — facial features

Attach eyes, cheeks, nose, and mouth through the analytic head surface. No per-feature depth hacks.

### Stage 7 — secondary geometry

Add surface ribbon stripes, claws, toes, highlights, and small refinements.

### Stage 8 — authored materials

Color comes after geometry passes. Geometry must still read in one neutral material.

### Stage 9 — final regression

Validate the round-tripped final object under all fixed views, both neutral and authored.

## Rollback rules

Treat a change as a parameter error only when a small numeric adjustment improves the failing view without degrading unrelated views.

Treat it as a representation failure and roll back when any of these occur:

- one structural change causes three or more compensating offsets elsewhere;
- improving the reference-facing view repeatedly damages side/back views;
- rear nape cannot be corrected with torso dome/profile and `headForward`;
- face features require large ad-hoc depth lifts to remain visible;
- ears only work from one yaw;
- tail must be made thin or camera-aligned to resemble the reference;
- head/torso requires vertex deformation of the lathes;
- serialization round-trip changes the rendered geometry.

Do not stack patches on a bad representation.

## Multi-view checks

Fixed views are `0 / 45 / 90 / 180 / 270 / 315` degrees under the repository evaluator.

- 0: true front, symmetry, head/belly width, ear spread.
- 45: closest to the supplied drawing viewpoint; compare landmark ratios.
- 90: left profile; expose head depth, ear thickness, face relief, tail volume.
- 180: rear; expose nape transition, surface stripes, tail/ear roots.
- 270: right profile; should mirror 90 apart from tail asymmetry.
- 315: front-right; tail is near edge-on and must retain visible thickness.

No view is privileged. A fix that helps 45 degrees but breaks 90/180/315 is not an improvement.

## Neutral-material criterion

Before authored color is accepted, a single neutral material should still reveal:

- wide oblate head over a pear body;
- jaw overhang with continuous rear nape;
- broad tapered ears rooted into the skull;
- face relief attached to the head surface;
- surface-following back chevrons;
- thick zigzag tail with substantial root;
- forward feet and short attached arms.

Color may identify yellow fur, black ear tips, red cheeks, brown markings/tail root, dark eyes/nose/mouth, and pale claws/highlights, but color must not conceal structural failure.

## Coding-agent summary

Implement the architecture above without root yaw, sphere-stack regression, pencil ears, shallow tail plates, free-standing stripe tubes, hand-authored facial depth offsets, or non-serializable parametric vertex edits. Tune numeric parameters from render evidence, but keep the representation coherent across all fixed views.