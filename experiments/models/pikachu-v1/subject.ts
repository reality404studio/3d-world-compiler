import * as THREE from "three";
import { PIKACHU_PARAMS } from "./parameters";

/**
 * Builds the Generation 1 Pikachu 3D model.
 * Adheres strictly to the renderable-v0 node allowlist:
 * only exact instances of THREE.Object3D, THREE.Group, and THREE.Mesh.
 */
export default function build(three: typeof THREE): THREE.Group {
  const p = PIKACHU_PARAMS;
  const root = new three.Group();
  root.name = "pikachu-gen1";

  // Base rotation of the character so front view (view-000) reproduces
  // the iconic Generation 1 3/4 reference silhouette
  const characterGroup = new three.Group();
  characterGroup.name = "character-root";
  characterGroup.rotation.y = -0.32; // ~-18.5 degrees, matches reference angle
  root.add(characterGroup);

  // --- Materials ---
  const materials = {
    yellow: new three.MeshStandardMaterial({
      color: p.colors.furYellow,
      roughness: 0.82,
      metalness: 0.0,
    }),
    bellyCream: new three.MeshStandardMaterial({
      color: 0xfdf3b5, // Soft warm watercolor highlight
      roughness: 0.85,
      metalness: 0.0,
    }),
    earBlack: new three.MeshStandardMaterial({
      color: p.colors.earBlack,
      roughness: 0.85,
      metalness: 0.0,
    }),
    cheekRed: new three.MeshStandardMaterial({
      color: p.colors.cheekRed,
      roughness: 0.72,
      metalness: 0.0,
    }),
    eyeBlack: new three.MeshStandardMaterial({
      color: p.colors.eyeBlack,
      roughness: 0.12,
      metalness: 0.08,
    }),
    eyeHighlight: new three.MeshStandardMaterial({
      color: p.colors.eyeHighlight,
      roughness: 0.08,
      metalness: 0.0,
    }),
    noseBlack: new three.MeshStandardMaterial({
      color: p.colors.noseBlack,
      roughness: 0.65,
      metalness: 0.0,
    }),
    mouthBrown: new three.MeshStandardMaterial({
      color: p.colors.mouthBrown,
      roughness: 0.88,
      metalness: 0.0,
    }),
    stripeBrown: new three.MeshStandardMaterial({
      color: p.colors.stripeBrown,
      roughness: 0.82,
      metalness: 0.0,
    }),
    tailBrown: new three.MeshStandardMaterial({
      color: p.colors.tailBrown,
      roughness: 0.82,
      metalness: 0.0,
    }),
    clawWhite: new three.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.0,
    }),
  };

  // ==========================================
  // 1. TORSO & BODY MASS (Pass A, B, C)
  // ==========================================
  const torsoGroup = new three.Group();
  torsoGroup.name = "torso-region";
  characterGroup.add(torsoGroup);

  // Main pear-shaped chubby torso
  const torsoGeo = new three.SphereGeometry(1, 44, 40);
  const posAttr = torsoGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    // Expand lower half, slightly taper upper half to create the classic pear shape
    const taper = 1.0 - y * 0.18;
    posAttr.setX(i, posAttr.getX(i) * taper);
    posAttr.setZ(i, posAttr.getZ(i) * taper);
  }
  torsoGeo.computeVertexNormals();

  const torsoMesh = new three.Mesh(torsoGeo, materials.yellow);
  torsoMesh.name = "torso-base";
  torsoMesh.position.set(0, 0.74, -0.04);
  torsoMesh.scale.set(0.76, 0.80, 0.70);
  torsoGroup.add(torsoMesh);

  // Chubby belly volume protruding forward-downward
  const bellyGeo = new three.SphereGeometry(1, 36, 32);
  const bellyMesh = new three.Mesh(bellyGeo, materials.yellow);
  bellyMesh.name = "belly-volume";
  bellyMesh.position.set(0, 0.62, 0.15);
  bellyMesh.scale.set(0.68, 0.58, 0.52);
  torsoGroup.add(bellyMesh);

  // Rear haunches / thighs (left & right)
  const haunchGeo = new three.SphereGeometry(0.38, 28, 28);
  const leftHaunch = new three.Mesh(haunchGeo, materials.yellow);
  leftHaunch.name = "haunch-left";
  leftHaunch.position.set(-0.44, 0.34, -0.08);
  leftHaunch.scale.set(0.92, 1.05, 1.18);
  torsoGroup.add(leftHaunch);

  const rightHaunch = new three.Mesh(haunchGeo, materials.yellow);
  rightHaunch.name = "haunch-right";
  rightHaunch.position.set(0.44, 0.34, -0.08);
  rightHaunch.scale.set(0.92, 1.05, 1.18);
  torsoGroup.add(rightHaunch);

  // Back Stripes: Two curved horizontal brown bands wrapping around rear and right flank
  const makeBackStripe = (name: string, yPos: number, zOffset: number, arcAngle: number, rotZ: number) => {
    const curvePoints: three.Vector3[] = [];
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * arcAngle - (arcAngle * 0.44);
      const rX = 0.76;
      const rZ = 0.70;
      const x = Math.sin(t) * rX;
      const z = -Math.cos(t) * rZ + zOffset;
      const y = yPos + Math.sin(t * 1.5) * 0.03;
      curvePoints.push(new three.Vector3(x, y, z));
    }
    const path = new three.CatmullRomCurve3(curvePoints);
    const stripeGeo = new three.TubeGeometry(path, 28, 0.048, 8, false);
    const stripeMesh = new three.Mesh(stripeGeo, materials.stripeBrown);
    stripeMesh.name = name;
    stripeMesh.rotation.z = rotZ;
    return stripeMesh;
  };
  torsoGroup.add(makeBackStripe("back-stripe-upper", 0.94, -0.04, Math.PI * 0.68, -0.05));
  torsoGroup.add(makeBackStripe("back-stripe-lower", 0.72, -0.04, Math.PI * 0.72, -0.05));

  // ==========================================
  // 2. HEAD & CHEEKS (Pass A, B, C)
  // ==========================================
  const headGroup = new three.Group();
  headGroup.name = "head-region";
  headGroup.position.set(0, 1.34, 0.06);
  // Slight counter-rotation so face looks directly forward
  headGroup.rotation.y = 0.06;
  characterGroup.add(headGroup);

  // Skull dome - wide and rounded at bottom, merging with cheeks
  const skullGeo = new three.SphereGeometry(1, 44, 40);
  const skullPosAttr = skullGeo.attributes.position;
  for (let i = 0; i < skullPosAttr.count; i++) {
    const y = skullPosAttr.getY(i);
    const cheekFlare = 1.0 + Math.max(0, -y * 0.24);
    skullPosAttr.setX(i, skullPosAttr.getX(i) * cheekFlare);
  }
  skullGeo.computeVertexNormals();

  const skullMesh = new three.Mesh(skullGeo, materials.yellow);
  skullMesh.name = "skull";
  skullMesh.scale.set(0.60, 0.54, 0.54);
  headGroup.add(skullMesh);

  // Full chubby cheek pouches (flare outward and slightly forward)
  const cheekGeo = new three.SphereGeometry(0.30, 28, 28);
  const leftCheek = new three.Mesh(cheekGeo, materials.yellow);
  leftCheek.name = "cheek-volume-left";
  leftCheek.position.set(-0.35, -0.10, 0.14);
  leftCheek.scale.set(1.22, 0.95, 1.08);
  headGroup.add(leftCheek);

  const rightCheek = new three.Mesh(cheekGeo, materials.yellow);
  rightCheek.name = "cheek-volume-right";
  rightCheek.position.set(0.35, -0.10, 0.14);
  rightCheek.scale.set(1.22, 0.95, 1.08);
  headGroup.add(rightCheek);

  // Snout/Muzzle volume between cheeks
  const snoutGeo = new three.SphereGeometry(0.24, 24, 20);
  const snoutMesh = new three.Mesh(snoutGeo, materials.yellow);
  snoutMesh.name = "snout-volume";
  snoutMesh.position.set(0, -0.06, 0.34);
  snoutMesh.scale.set(1.05, 0.72, 0.82);
  headGroup.add(snoutMesh);

  // ==========================================
  // 3. EARS (Pass B & C)
  // ==========================================
  const makeEar = (
    name: string,
    position: readonly [number, number, number],
    rotation: readonly [number, number, number],
    length: number,
    blackRatio: number,
  ): three.Group => {
    const earGroup = new three.Group();
    earGroup.name = name;
    earGroup.position.set(...position);
    earGroup.rotation.set(...rotation);

    const baseLen = length * (1 - blackRatio);
    const tipLen = length * blackRatio;
    const baseR = 0.125;
    const midR = 0.135;

    // Lower yellow base of ear
    const baseGeo = new three.CylinderGeometry(midR, baseR, baseLen, 24, 4);
    baseGeo.scale(0.85, 1.0, 1.12);
    const baseMesh = new three.Mesh(baseGeo, materials.yellow);
    baseMesh.name = `${name}-base`;
    baseMesh.position.set(0, baseLen / 2, 0);
    earGroup.add(baseMesh);

    // Upper black tip of ear (sharp pointed tip)
    const tipGeo = new three.ConeGeometry(midR, tipLen, 24, 4);
    tipGeo.scale(0.85, 1.0, 1.12);
    const tipMesh = new three.Mesh(tipGeo, materials.earBlack);
    tipMesh.name = `${name}-tip`;
    tipMesh.position.set(0, baseLen + tipLen / 2, 0);
    earGroup.add(tipMesh);

    return earGroup;
  };

  // Left ear: angled up-left (~38°), slightly back
  headGroup.add(
    makeEar("ear-left", [-0.30, 0.44, -0.04], [-0.12, -0.10, 0.66], 0.98, 0.35),
  );
  // Right ear: angled up-right (~20°), more vertical, slightly forward
  headGroup.add(
    makeEar("ear-right", [0.28, 0.45, -0.02], [0.08, 0.08, -0.35], 1.00, 0.35),
  );

  // ==========================================
  // 4. ARMS & HANDS (Pass C & D)
  // ==========================================
  // In Generation 1, arms are short, chubby limbs resting against the belly/chest
  // Left arm: emerges from shoulder and reaches forward-downward onto the belly
  const leftArmGroup = new three.Group();
  leftArmGroup.name = "arm-left";
  leftArmGroup.position.set(-0.46, 0.88, 0.52);

  const leftArmCurve = new three.CatmullRomCurve3([
    new three.Vector3(0, 0, 0),
    new three.Vector3(0.06, -0.12, 0.08),
    new three.Vector3(0.14, -0.24, 0.16),
  ]);
  const leftArmTubeGeo = new three.TubeGeometry(leftArmCurve, 16, 0.09, 14, false);
  const leftArmMesh = new three.Mesh(leftArmTubeGeo, materials.yellow);
  leftArmMesh.name = "arm-left-limb";
  leftArmGroup.add(leftArmMesh);

  // Left paw resting on lower-left belly
  const leftPawGeo = new three.SphereGeometry(0.082, 16, 16);
  leftPawGeo.scale(1.1, 0.85, 1.0);
  const leftPawMesh = new three.Mesh(leftPawGeo, materials.yellow);
  leftPawMesh.name = "arm-left-paw";
  leftPawMesh.position.set(0.14, -0.24, 0.16);
  leftArmGroup.add(leftPawMesh);

  // 5 tiny claws on left paw
  const clawGeo = new three.ConeGeometry(0.013, 0.040, 8);
  clawGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const claw = new three.Mesh(clawGeo, materials.clawWhite);
    claw.name = `arm-left-claw-${i}`;
    const angle = (i - 2) * 0.28;
    claw.position.set(
      0.14 + Math.sin(angle) * 0.045,
      -0.26 - Math.cos(angle) * 0.02,
      0.22,
    );
    claw.rotation.set(0.35, angle * 0.6, 0);
    leftArmGroup.add(claw);
  }
  torsoGroup.add(leftArmGroup);

  // Right arm: emerges from shoulder and reaches across upper chest
  const rightArmGroup = new three.Group();
  rightArmGroup.name = "arm-right";
  rightArmGroup.position.set(0.40, 0.90, 0.48);

  const rightArmCurve = new three.CatmullRomCurve3([
    new three.Vector3(0, 0, 0),
    new three.Vector3(-0.12, -0.06, 0.10),
    new three.Vector3(-0.25, -0.12, 0.18),
  ]);
  const rightArmTubeGeo = new three.TubeGeometry(rightArmCurve, 16, 0.09, 14, false);
  const rightArmMesh = new three.Mesh(rightArmTubeGeo, materials.yellow);
  rightArmMesh.name = "arm-right-limb";
  rightArmGroup.add(rightArmMesh);

  const rightPawMesh = new three.Mesh(leftPawGeo, materials.yellow);
  rightPawMesh.name = "arm-right-paw";
  rightPawMesh.position.set(-0.25, -0.12, 0.18);
  rightArmGroup.add(rightPawMesh);

  for (let i = 0; i < 5; i++) {
    const claw = new three.Mesh(clawGeo, materials.clawWhite);
    claw.name = `arm-right-claw-${i}`;
    const angle = (i - 2) * 0.28;
    claw.position.set(
      -0.25 - Math.cos(angle) * 0.02,
      -0.14 - Math.sin(angle) * 0.04,
      0.24,
    );
    claw.rotation.set(0.35, -angle * 0.6, 0);
    rightArmGroup.add(claw);
  }
  torsoGroup.add(rightArmGroup);

  // ==========================================
  // 5. LEGS & FEET (Pass C)
  // ==========================================
  const makeFoot = (
    name: string,
    position: readonly [number, number, number],
    rotationY: number,
  ): three.Group => {
    const footGroup = new three.Group();
    footGroup.name = name;
    footGroup.position.set(...position);
    footGroup.rotation.set(0.04, rotationY, 0);

    // Foot base (elongated oval)
    const footGeo = new three.SphereGeometry(1, 24, 20);
    footGeo.scale(0.20, 0.10, 0.40);
    const footMesh = new three.Mesh(footGeo, materials.yellow);
    footMesh.name = `${name}-base`;
    footGroup.add(footMesh);

    // 3 sharp claws at the front of foot
    const footClawGeo = new three.ConeGeometry(0.022, 0.065, 10);
    footClawGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const claw = new three.Mesh(footClawGeo, materials.clawWhite);
      claw.name = `${name}-claw-${i}`;
      claw.position.set((i - 1) * 0.052, -0.02, 0.41);
      claw.rotation.set(0.15, (i - 1) * -0.15, 0);
      footGroup.add(claw);
    }

    return footGroup;
  };

  characterGroup.add(makeFoot("foot-left", [-0.34, 0.08, 0.22], 0.28));
  characterGroup.add(makeFoot("foot-right", [0.32, 0.08, 0.18], -0.22));

  // ==========================================
  // 6. TAIL (Pass C & D)
  // ==========================================
  // Gen-1 Lightning Bolt Tail:
  // Fanning broadly out to the right (+X) and held upright
  const tailGroup = new three.Group();
  tailGroup.name = "tail-region";
  // Attached at lower rear-right of torso
  tailGroup.position.set(0.24, 0.48, -0.30);
  // Rotated so it fans prominently to the right (+X) and slightly back (-Z)
  tailGroup.rotation.set(-0.14, 0.08, 0.42);
  characterGroup.add(tailGroup);

  const extrudeSettings = {
    depth: 0.075,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  };

  // (A) Tail base section (brown)
  const baseShape = new three.Shape();
  baseShape.moveTo(0, 0);
  baseShape.lineTo(0.16, 0.06);
  baseShape.lineTo(0.32, 0.32);
  baseShape.lineTo(0.14, 0.34);
  baseShape.lineTo(0.02, 0.14);
  baseShape.closePath();

  const baseGeo = new three.ExtrudeGeometry(baseShape, extrudeSettings);
  baseGeo.translate(0, 0, -0.075 / 2);
  const baseMesh = new three.Mesh(baseGeo, materials.tailBrown);
  baseMesh.name = "tail-base";
  tailGroup.add(baseMesh);

  // (B) Main lightning zigzag blade (yellow)
  // Large dramatic zigzags matching Gen 1 artwork
  const bladeShape = new three.Shape();
  bladeShape.moveTo(0.14, 0.34);
  bladeShape.lineTo(0.32, 0.32);
  bladeShape.lineTo(0.58, 0.64);
  bladeShape.lineTo(0.36, 0.68);
  bladeShape.lineTo(0.78, 1.18);
  bladeShape.lineTo(0.48, 1.22);
  // Wide tip blade
  bladeShape.lineTo(1.22, 1.96);
  bladeShape.lineTo(0.76, 2.02);
  bladeShape.lineTo(0.14, 1.30);
  bladeShape.lineTo(0.40, 1.26);
  bladeShape.lineTo(-0.02, 0.76);
  bladeShape.lineTo(0.22, 0.72);
  bladeShape.closePath();

  const bladeGeo = new three.ExtrudeGeometry(bladeShape, extrudeSettings);
  bladeGeo.translate(0, 0, -0.075 / 2);
  const bladeMesh = new three.Mesh(bladeGeo, materials.yellow);
  bladeMesh.name = "tail-blade";
  tailGroup.add(bladeMesh);

  // ==========================================
  // 7. FACIAL FEATURES (Pass E & F)
  // ==========================================
  const faceGroup = new three.Group();
  faceGroup.name = "face-region";
  headGroup.add(faceGroup);

  // Eyes placed properly ON the surface of the skull
  const makeEye = (
    name: string,
    pos: readonly [number, number, number],
    rotY: number,
  ): three.Group => {
    const eyeGroup = new three.Group();
    eyeGroup.name = name;
    eyeGroup.position.set(...pos);
    eyeGroup.rotation.set(-0.06, rotY, -0.04);

    // Eye pupil (black oval convex disc)
    const eyeGeo = new three.SphereGeometry(0.092, 24, 24);
    eyeGeo.scale(0.95, 1.25, 0.35);
    const pupil = new three.Mesh(eyeGeo, materials.eyeBlack);
    pupil.name = `${name}-pupil`;
    eyeGroup.add(pupil);

    // White highlight dot (upper-right of pupil)
    const highlightGeo = new three.SphereGeometry(0.034, 16, 16);
    highlightGeo.scale(1.0, 1.0, 0.4);
    const highlight = new three.Mesh(highlightGeo, materials.eyeHighlight);
    highlight.name = `${name}-highlight`;
    highlight.position.set(0.028, 0.038, 0.028);
    eyeGroup.add(highlight);

    return eyeGroup;
  };

  faceGroup.add(makeEye("eye-left", [-0.20, 0.05, 0.54], -0.28));
  faceGroup.add(makeEye("eye-right", [0.22, 0.05, 0.53], 0.28));

  // Red Cheek Pouches:
  // Circular raised caps sitting cleanly on the cheek surface!
  const makeCheekPouch = (
    name: string,
    pos: readonly [number, number, number],
    rot: readonly [number, number, number],
  ): three.Mesh => {
    // Slightly convex curved disc
    const pouchGeo = new three.SphereGeometry(0.145, 24, 20);
    pouchGeo.scale(1.0, 1.0, 0.35);
    const pouch = new three.Mesh(pouchGeo, materials.cheekRed);
    pouch.name = name;
    pouch.position.set(...pos);
    pouch.rotation.set(...rot);
    return pouch;
  };

  // Left cheek pouch: positioned so it is a prominent round red spot on the front view contour
  faceGroup.add(
    makeCheekPouch("cheek-patch-left", [-0.60, -0.10, 0.32], [0.08, -0.90, -0.08]),
  );
  // Right cheek pouch: positioned on front-right cheek
  faceGroup.add(
    makeCheekPouch("cheek-patch-right", [0.48, -0.10, 0.40], [0.08, 0.72, 0.08]),
  );

  // Nose (tiny dark triangle centered between eyes)
  const noseGeo = new three.ConeGeometry(0.022, 0.035, 10);
  noseGeo.rotateX(Math.PI / 2);
  const noseMesh = new three.Mesh(noseGeo, materials.noseBlack);
  noseMesh.name = "nose";
  noseMesh.position.set(0, 0.03, 0.58);
  faceGroup.add(noseMesh);

  // Mouth (subtle cat-mouth 'ω' shape below nose)
  const mouthCurve = new three.CatmullRomCurve3([
    new three.Vector3(-0.085, 0.008, 0),
    new three.Vector3(-0.042, -0.018, 0.008),
    new three.Vector3(0, 0.002, 0.01),
    new three.Vector3(0.042, -0.018, 0.008),
    new three.Vector3(0.085, 0.008, 0),
  ]);
  const mouthGeo = new three.TubeGeometry(mouthCurve, 24, 0.012, 8, false);
  const mouthMesh = new three.Mesh(mouthGeo, materials.mouthBrown);
  mouthMesh.name = "mouth";
  mouthMesh.position.set(0, -0.07, 0.56);
  mouthMesh.rotation.set(0.16, 0, 0);
  faceGroup.add(mouthMesh);

  return root;
}
