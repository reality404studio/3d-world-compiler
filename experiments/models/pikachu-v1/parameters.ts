/**
 * Centralized parameter block for Generation 1 Pikachu reconstruction.
 * All major proportions, offsets, orientations, and colors are declared here
 * to avoid scattered magic numbers and ensure coherent spatial relationships.
 */

export const PIKACHU_PARAMS = {
  // --- Materials & Colors (Sugimori Gen-1 palette) ---
  colors: {
    furYellow: 0xf6d638,       // Warm Generation-1 golden yellow
    bellyCream: 0xfdf3b0,      // Soft cream highlight on belly/face
    earBlack: 0x181716,        // Charcoal black for ear tips
    cheekRed: 0xdb4437,        // Warm vermilion red cheek pouches
    eyeBlack: 0x111111,        // Deep gloss black eyes
    eyeHighlight: 0xffffff,    // Pure white specular highlight dot
    noseBlack: 0x1a1a1a,       // Dark nose
    mouthBrown: 0x5c3317,      // Soft dark brown mouth line
    stripeBrown: 0x8a4b1e,     // Warm reddish-brown back stripes
    tailBrown: 0x824419,       // Brown base of zigzag tail
    clawWhite: 0xf4f0e6,       // Off-white / cream foot and hand claws
    neutralClay: 0xb8b2a7,     // Shared neutral evaluation clay
  },

  materialProps: {
    roughness: 0.82,
    metalness: 0.0,
    eyeRoughness: 0.15,
    clawRoughness: 0.6,
  },

  // --- Proportions & Transforms ---
  torso: {
    position: [0, 0.72, -0.05] as const,
    scale: [0.74, 0.78, 0.68] as const, // Egg-shaped base torso
    bellyOffset: [0, -0.08, 0.14] as const,
    bellyScale: [0.66, 0.62, 0.52] as const,
    haunchRadius: 0.38,
    haunchPosition: [0.42, 0.32, -0.08] as const, // Mirrored for left/right
  },

  head: {
    position: [0, 1.34, 0.04] as const,
    skullScale: [0.62, 0.56, 0.56] as const,
    cheekRadius: 0.32,
    cheekPosition: [0.44, -0.10, 0.14] as const, // Mirrored for left/right
    snoutOffset: [0, -0.06, 0.32] as const,
    snoutScale: [0.28, 0.22, 0.22] as const,
  },

  ears: {
    left: {
      position: [-0.34, 0.44, -0.04] as const, // relative to head
      rotation: [-0.15, -0.12, 0.58] as const, // [X, Y, Z in radians] ~33° out, tilted slightly back
      length: 0.96,
      baseRadius: 0.13,
      midRadius: 0.14,
      tipRadius: 0.02,
      blackTipRatio: 0.34, // top 34% is black
    },
    right: {
      position: [0.32, 0.45, -0.02] as const, // relative to head
      rotation: [0.08, 0.10, -0.42] as const, // ~24° out, slightly forward
      length: 0.98,
      baseRadius: 0.13,
      midRadius: 0.14,
      tipRadius: 0.02,
      blackTipRatio: 0.34,
    },
  },

  arms: {
    left: {
      position: [-0.38, 0.96, 0.32] as const,
      rotation: [0.45, 0.25, 0.35] as const,
      length: 0.38,
      radius: 0.10,
    },
    right: {
      position: [0.36, 1.00, 0.30] as const,
      rotation: [0.75, -0.35, -0.55] as const, // folded inward across chest
      length: 0.36,
      radius: 0.10,
    },
  },

  feet: {
    left: {
      position: [-0.36, 0.09, 0.22] as const,
      rotation: [0.05, 0.25, 0] as const,
      scale: [0.22, 0.11, 0.42] as const,
    },
    right: {
      position: [0.34, 0.09, 0.20] as const,
      rotation: [0.05, -0.22, 0] as const,
      scale: [0.22, 0.11, 0.42] as const,
    },
  },

  tail: {
    attachmentPosition: [0.02, 0.48, -0.46] as const,
    rotation: [-0.22, 0.20, 0.22] as const,
    thickness: 0.08,
    bevelSize: 0.015,
  },

  face: {
    eyes: {
      leftPos: [-0.26, 0.04, 0.44] as const,  // relative to head
      rightPos: [0.24, 0.05, 0.45] as const,
      radius: 0.088,
      scale: [1.0, 1.25, 0.6] as const,
      rotationY: 0.35,
    },
    cheeks: {
      leftPos: [-0.44, -0.08, 0.34] as const,
      rightPos: [0.42, -0.07, 0.35] as const,
      radius: 0.135,
      thickness: 0.05,
    },
    nose: {
      position: [0, 0.01, 0.52] as const,
      size: 0.026,
    },
    mouth: {
      position: [0, -0.09, 0.48] as const,
      width: 0.18,
    },
  },

  stripes: {
    upperY: 0.88,
    lowerY: 0.64,
    depthOffset: -0.42,
    arcRadius: 0.56,
  },
} as const;
