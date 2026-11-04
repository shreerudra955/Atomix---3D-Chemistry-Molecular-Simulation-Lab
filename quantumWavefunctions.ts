/**
 * Quantum Wavefunction & Orbital Physics Engine
 * Implements exact hydrogen-like analytical solutions to the Schrödinger equation:
 * Ψ_{n,l,m}(r, θ, φ) = R_{n,l}(r) * Y_{l,m}(θ, φ)
 *
 * Supports s, p, d, and f orbitals with:
 * - Associated Laguerre polynomials for radial component R_{n,l}(r)
 * - Real spherical harmonics for angular component Y_{l,m}(θ, φ)
 * - Monte Carlo rejection sampling for electron cloud probability density |Ψ|²
 * - Parametric isosurface lobe generation for textbook contour boundaries
 * - Radial probability density P(r) = r² |R_{n,l}(r)|² calculation & node detection
 */

import * as THREE from 'three';

export type OrbitalType = 's' | 'p' | 'd' | 'f';

export interface OrbitalDefinition {
  id: string;
  name: string;
  n: number;
  l: number;
  m: number; // Magnetic quantum number (-l to +l)
  type: OrbitalType;
  subLabel: string;
  formula: string;
  radialNodes: number;
  angularNodes: number;
  totalNodes: number;
  description: string;
  colorPositive: number;
  colorNegative: number;
}

// Factorial with cache
const FACTORIAL_CACHE: number[] = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
export function factorial(n: number): number {
  if (n < 0) return 1;
  if (n < FACTORIAL_CACHE.length) return FACTORIAL_CACHE[n];
  let res = FACTORIAL_CACHE[FACTORIAL_CACHE.length - 1];
  for (let i = FACTORIAL_CACHE.length; i <= n; i++) {
    res *= i;
    FACTORIAL_CACHE[i] = res;
  }
  return res;
}

/**
 * Associated Laguerre Polynomial L_k^alpha(x)
 * Uses stable 3-term recurrence relation:
 * L_0^α(x) = 1
 * L_1^α(x) = 1 + α - x
 * (k+1) L_{k+1}^α(x) = (2k + 1 + α - x) L_k^α(x) - (k + α) L_{k-1}^α(x)
 */
export function associatedLaguerre(k: number, alpha: number, x: number): number {
  if (k <= 0) return 1;
  if (k === 1) return 1 + alpha - x;

  let lPrev2 = 1;
  let lPrev1 = 1 + alpha - x;
  let lCurrent = lPrev1;

  for (let i = 1; i < k; i++) {
    lCurrent = ((2 * i + 1 + alpha - x) * lPrev1 - (i + alpha) * lPrev2) / (i + 1);
    lPrev2 = lPrev1;
    lPrev1 = lCurrent;
  }
  return lCurrent;
}

/**
 * Radial Wavefunction R_{n, l}(r) for Hydrogen-like atoms (Z = 1 by default, scaled for simulation)
 * R_{n,l}(r) = - sqrt((2/n)³ * (n - l - 1)! / (2n * (n + l)!)) * exp(-ρ/2) * ρ^l * L_{n-l-1}^{2l+1}(ρ)
 * where ρ = 2r / n
 */
export function radialWavefunction(n: number, l: number, r: number, z = 1): number {
  if (r < 0) return 0;
  const k = n - l - 1;
  if (k < 0) return 0;

  const rho = (2 * z * r) / n;
  const alpha = 2 * l + 1;

  // Normalization constant
  const num = Math.pow((2 * z) / n, 3) * factorial(k);
  const den = 2 * n * factorial(n + l);
  const norm = Math.sqrt(Math.max(0, num / den));

  const laguerre = associatedLaguerre(k, alpha, rho);
  const poly = Math.pow(rho, l) * laguerre;

  return norm * Math.exp(-rho / 2) * poly;
}

/**
 * Radial Probability Density P(r) = r² |R_{n,l}(r)|²
 * Represents the probability of finding the electron at distance r regardless of direction.
 */
export function radialProbabilityDensity(n: number, l: number, r: number, z = 1): number {
  const R = radialWavefunction(n, l, r, z);
  return r * r * R * R;
}

/**
 * Real Spherical Harmonics Y_{l, m}(x, y, z)
 * Normalized on the unit sphere x² + y² + z² = 1 (r = 1).
 * Returns real wavefunction value with positive or negative phase.
 */
export function realSphericalHarmonic(l: number, m: number, x: number, y: number, z: number): number {
  const r2 = x * x + y * y + z * z;
  if (r2 < 1e-12) return 0;
  const r = Math.sqrt(r2);
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;

  // l = 0: s orbital
  if (l === 0) {
    return 1 / (2 * Math.sqrt(Math.PI));
  }

  // l = 1: p orbitals (m = -1: py, m = 0: pz, m = +1: px)
  if (l === 1) {
    const factor = Math.sqrt(3 / (4 * Math.PI));
    if (m === 0) return factor * nz; // p_z
    if (m === 1) return factor * nx; // p_x
    if (m === -1) return factor * ny; // p_y
  }

  // l = 2: d orbitals
  if (l === 2) {
    const factor5 = Math.sqrt(5 / (16 * Math.PI));
    const factor15 = Math.sqrt(15 / (4 * Math.PI));
    if (m === 0) return factor5 * (2 * nz * nz - nx * nx - ny * ny); // d_z²
    if (m === 1) return factor15 * nx * nz; // d_xz
    if (m === -1) return factor15 * ny * nz; // d_yz
    if (m === 2) return Math.sqrt(15 / (16 * Math.PI)) * (nx * nx - ny * ny); // d_x²-y²
    if (m === -2) return factor15 * nx * ny; // d_xy
  }

  // l = 3: f orbitals
  if (l === 3) {
    if (m === 0) {
      // f_z³ (or f_{z(5z² - 3r²)})
      return Math.sqrt(7 / (16 * Math.PI)) * nz * (5 * nz * nz - 3);
    }
    if (m === 1) {
      // f_{xz²} = f_{x(5z² - 1)}
      return Math.sqrt(21 / (32 * Math.PI)) * nx * (5 * nz * nz - 1);
    }
    if (m === -1) {
      // f_{yz²} = f_{y(5z² - 1)}
      return Math.sqrt(21 / (32 * Math.PI)) * ny * (5 * nz * nz - 1);
    }
    if (m === 2) {
      // f_{z(x²-y²)}
      return Math.sqrt(105 / (16 * Math.PI)) * nz * (nx * nx - ny * ny);
    }
    if (m === -2) {
      // f_{xyz} (8-lobed octant orbital)
      return Math.sqrt(105 / (4 * Math.PI)) * nx * ny * nz;
    }
    if (m === 3) {
      // f_{x(x²-3y²)}
      return Math.sqrt(35 / (32 * Math.PI)) * nx * (nx * nx - 3 * ny * ny);
    }
    if (m === -3) {
      // f_{y(3x²-y²)}
      return Math.sqrt(35 / (32 * Math.PI)) * ny * (3 * nx * nx - ny * ny);
    }
  }

  return 0;
}

/**
 * Complete Full 3D Hydrogenic Wavefunction Ψ_{n,l,m}(x, y, z)
 * Returns the signed real amplitude.
 * Sign determines wave phase (+ or -).
 * Square |Ψ|² gives probability density.
 */
export function fullWavefunction(n: number, l: number, m: number, x: number, y: number, z: number, rScale = 1.0): number {
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2) * rScale;
  if (r < 1e-12) {
    return l === 0 ? radialWavefunction(n, 0, 0) * (1 / (2 * Math.sqrt(Math.PI))) : 0;
  }
  const R = radialWavefunction(n, l, r);
  const Y = realSphericalHarmonic(l, m, x, y, z);
  return R * Y;
}

// Master catalogue of all standard orbitals from 1s to 5f
export const QUANTUM_ORBITALS: OrbitalDefinition[] = [
  // n = 1
  {
    id: '1s',
    name: '1s',
    n: 1,
    l: 0,
    m: 0,
    type: 's',
    subLabel: '1s',
    formula: 'Ψ₁₀₀ ∝ e^{-r}',
    radialNodes: 0,
    angularNodes: 0,
    totalNodes: 0,
    description: 'Ground state spherical electron cloud. Maximum density at the nucleus, decaying exponentially outward with no nodes.',
    colorPositive: 0x06b6d4, // Cyan
    colorNegative: 0xf43f5e, // Rose
  },

  // n = 2
  {
    id: '2s',
    name: '2s',
    n: 2,
    l: 0,
    m: 0,
    type: 's',
    subLabel: '2s',
    formula: 'Ψ₂₀₀ ∝ (2 - r) e^{-r/2}',
    radialNodes: 1,
    angularNodes: 0,
    totalNodes: 1,
    description: 'Spherical orbital with 1 internal spherical radial node at r = 2 a₀ where Ψ changes phase from positive to negative.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '2pz',
    name: '2p_z',
    n: 2,
    l: 1,
    m: 0,
    type: 'p',
    subLabel: '2p_z',
    formula: 'Ψ₂₁₀ ∝ z e^{-r/2}',
    radialNodes: 0,
    angularNodes: 1,
    totalNodes: 1,
    description: 'Dumbbell-shaped orbital aligned along the Z-axis with 1 angular nodal plane (XY plane at z = 0) separating positive and negative lobes.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '2px',
    name: '2p_x',
    n: 2,
    l: 1,
    m: 1,
    type: 'p',
    subLabel: '2p_x',
    formula: 'Ψ₂₁₁ ∝ x e^{-r/2}',
    radialNodes: 0,
    angularNodes: 1,
    totalNodes: 1,
    description: 'Dumbbell orbital oriented along the X-axis with an angular nodal plane (YZ plane at x = 0).',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '2py',
    name: '2p_y',
    n: 2,
    l: 1,
    m: -1,
    type: 'p',
    subLabel: '2p_y',
    formula: 'Ψ₂₁₋₁ ∝ y e^{-r/2}',
    radialNodes: 0,
    angularNodes: 1,
    totalNodes: 1,
    description: 'Dumbbell orbital oriented along the Y-axis with an angular nodal plane (XZ plane at y = 0).',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },

  // n = 3
  {
    id: '3s',
    name: '3s',
    n: 3,
    l: 0,
    m: 0,
    type: 's',
    subLabel: '3s',
    formula: 'Ψ₃₀₀ ∝ (27 - 18r + 2r²) e^{-r/3}',
    radialNodes: 2,
    angularNodes: 0,
    totalNodes: 2,
    description: 'Spherical orbital with 2 concentric spherical radial nodes creating 3 alternating phase shells.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3pz',
    name: '3p_z',
    n: 3,
    l: 1,
    m: 0,
    type: 'p',
    subLabel: '3p_z',
    formula: 'Ψ₃₁₀ ∝ z (6 - r) e^{-r/3}',
    radialNodes: 1,
    angularNodes: 1,
    totalNodes: 2,
    description: '2-lobed Z orbital with 1 angular nodal plane (XY) plus 1 internal spherical radial node at r = 6 a₀.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3px',
    name: '3p_x',
    n: 3,
    l: 1,
    m: 1,
    type: 'p',
    subLabel: '3p_x',
    formula: 'Ψ₃₁₁ ∝ x (6 - r) e^{-r/3}',
    radialNodes: 1,
    angularNodes: 1,
    totalNodes: 2,
    description: 'X-oriented p orbital with 1 angular nodal plane and 1 radial node.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3py',
    name: '3p_y',
    n: 3,
    l: 1,
    m: -1,
    type: 'p',
    subLabel: '3p_y',
    formula: 'Ψ₃₁₋₁ ∝ y (6 - r) e^{-r/3}',
    radialNodes: 1,
    angularNodes: 1,
    totalNodes: 2,
    description: 'Y-oriented p orbital with 1 angular nodal plane and 1 radial node.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3dz2',
    name: '3d_z²',
    n: 3,
    l: 2,
    m: 0,
    type: 'd',
    subLabel: '3d_z²',
    formula: 'Ψ₃₂₀ ∝ (2z² - x² - y²) e^{-r/3}',
    radialNodes: 0,
    angularNodes: 2,
    totalNodes: 2,
    description: 'Iconic shape: two main lobes along the Z-axis surrounded by a toroidal doughnut ring in the XY plane with 2 conical nodal surfaces.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf59e0b, // Amber
  },
  {
    id: '3dxz',
    name: '3d_xz',
    n: 3,
    l: 2,
    m: 1,
    type: 'd',
    subLabel: '3d_xz',
    formula: 'Ψ₃₂₁ ∝ xz e^{-r/3}',
    radialNodes: 0,
    angularNodes: 2,
    totalNodes: 2,
    description: 'Four-lobed cloverleaf lying in the XZ plane between axes, with nodal planes at x = 0 and z = 0.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3dyz',
    name: '3d_yz',
    n: 3,
    l: 2,
    m: -1,
    type: 'd',
    subLabel: '3d_yz',
    formula: 'Ψ₃₂₋₁ ∝ yz e^{-r/3}',
    radialNodes: 0,
    angularNodes: 2,
    totalNodes: 2,
    description: 'Four-lobed cloverleaf lying in the YZ plane between axes, with nodal planes at y = 0 and z = 0.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3dx2y2',
    name: '3d_x²-y²',
    n: 3,
    l: 2,
    m: 2,
    type: 'd',
    subLabel: '3d_x²-y²',
    formula: 'Ψ₃₂₂ ∝ (x² - y²) e^{-r/3}',
    radialNodes: 0,
    angularNodes: 2,
    totalNodes: 2,
    description: 'Four-lobed cloverleaf directly pointing along the X and Y axes, with diagonal nodal planes at y = ±x.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '3dxy',
    name: '3d_xy',
    n: 3,
    l: 2,
    m: -2,
    type: 'd',
    subLabel: '3d_xy',
    formula: 'Ψ₃₂₋₂ ∝ xy e^{-r/3}',
    radialNodes: 0,
    angularNodes: 2,
    totalNodes: 2,
    description: 'Four-lobed cloverleaf lying in the XY plane at 45° between the X and Y axes.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },

  // n = 4
  {
    id: '4s',
    name: '4s',
    n: 4,
    l: 0,
    m: 0,
    type: 's',
    subLabel: '4s',
    formula: 'Ψ₄₀₀ ∝ L₃¹(r/2) e^{-r/4}',
    radialNodes: 3,
    angularNodes: 0,
    totalNodes: 3,
    description: 'Higher energy spherical orbital with 3 concentric spherical radial nodes. Penetrates close to nucleus.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4dz2',
    name: '4d_z²',
    n: 4,
    l: 2,
    m: 0,
    type: 'd',
    subLabel: '4d_z²',
    formula: 'Ψ₄₂₀ ∝ (2z² - x² - y²) (12 - r) e^{-r/4}',
    radialNodes: 1,
    angularNodes: 2,
    totalNodes: 3,
    description: '4d dumbbell + doughnut orbital with 2 conical angular nodes plus 1 internal radial node.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf59e0b,
  },

  // f Orbitals (n = 4, l = 3)
  {
    id: '4fz3',
    name: '4f_z³',
    n: 4,
    l: 3,
    m: 0,
    type: 'f',
    subLabel: '4f_z(5z²-3r²)',
    formula: 'Ψ₄₃₀ ∝ z (5z² - 3r²) e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Two main lobes along the Z-axis surrounded by two circular conical ring collars above and below the XY plane.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4fxz2',
    name: '4f_xz²',
    n: 4,
    l: 3,
    m: 1,
    type: 'f',
    subLabel: '4f_x(5z²-r²)',
    formula: 'Ψ₄₃₁ ∝ x (5z² - r²) e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Four-lobed structure with conical nodal surfaces, prominent in transition lanthanide bonding.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4fyz2',
    name: '4f_yz²',
    n: 4,
    l: 3,
    m: -1,
    type: 'f',
    subLabel: '4f_y(5z²-r²)',
    formula: 'Ψ₄₃₋₁ ∝ y (5z² - r²) e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Four-lobed structure oriented along Y with conical nodal surfaces.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4fxyz',
    name: '4f_xyz',
    n: 4,
    l: 3,
    m: -2,
    type: 'f',
    subLabel: '4f_xyz',
    formula: 'Ψ₄₃₋₂ ∝ xyz e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Eight-lobed orbital with one lobe in each of the 8 octants of 3D space, alternating phase signs with 3 mutually perpendicular nodal planes (XY, XZ, YZ).',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4fzx2y2',
    name: '4f_z(x²-y²)',
    n: 4,
    l: 3,
    m: 2,
    type: 'f',
    subLabel: '4f_z(x²-y²)',
    formula: 'Ψ₄₃₂ ∝ z (x² - y²) e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Eight-lobed double cloverleaf with 3 planar nodes: z = 0 and the two diagonals y = ±x.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4fxx23y2',
    name: '4f_x(x²-3y²)',
    n: 4,
    l: 3,
    m: 3,
    type: 'f',
    subLabel: '4f_x(x²-3y²)',
    formula: 'Ψ₄₃₃ ∝ x (x² - 3y²) e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Six-lobed planar daisy orbital in the XY plane with 3 vertical nodal planes at 60° angles.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
  {
    id: '4fy3x2y2',
    name: '4f_y(3x²-y²)',
    n: 4,
    l: 3,
    m: -3,
    type: 'f',
    subLabel: '4f_y(3x²-y²)',
    formula: 'Ψ₄₃₋₃ ∝ y (3x² - y²) e^{-r/4}',
    radialNodes: 0,
    angularNodes: 3,
    totalNodes: 3,
    description: 'Six-lobed planar daisy orbital rotated 30° relative to the x(x²-3y²) state.',
    colorPositive: 0x06b6d4,
    colorNegative: 0xf43f5e,
  },
];

export function getOrbitalById(id: string): OrbitalDefinition {
  return QUANTUM_ORBITALS.find((o) => o.id === id) || QUANTUM_ORBITALS[0];
}

/**
 * Monte Carlo Quantum Electron Cloud Generator
 * Generates an array of 3D points sampled in proportion to |Ψ(r, θ, φ)|².
 * Employs rejection sampling with an optimized radial envelope.
 */
export function generateOrbitalPointCloud(
  orbital: OrbitalDefinition,
  numPoints = 15000,
  maxRScale = 1.0,
  slicePlane: 'none' | 'xy' | 'xz' | 'yz' = 'none',
  sliceOffset = 0,
  sliceInvert = false
): {
  positions: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
  densities: Float32Array;
  actualCount: number;
} {
  const { n, l, m } = orbital;

  // Domain bounding radius in simulation units
  const maxRadius = Math.max(7.0, (n * n + 2 * n) * 1.35 * maxRScale);
  const rPhysScale = 1.0 / (n * 0.95);

  const positions = new Float32Array(numPoints * 3);
  const colors = new Float32Array(numPoints * 3);
  const phases = new Float32Array(numPoints);
  const densities = new Float32Array(numPoints);

  const posColor = new THREE.Color(orbital.colorPositive);
  const negColor = new THREE.Color(orbital.colorNegative);

  // Approximate peak probability density |Ψ|² for rejection threshold
  // Sample a few points along the characteristic lobes to estimate maxDensity
  let maxDensityEstimate = 1e-4;
  const testRadii = [n * 0.8, n * 1.5, n * 2.2, n * 3.0];
  const testDirs: [number, number, number][] = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
    [0.7, 0.7, 0],
    [0.57, 0.57, 0.57],
  ];

  for (const tr of testRadii) {
    for (const [dx, dy, dz] of testDirs) {
      const psi = fullWavefunction(n, l, m, dx * tr, dy * tr, dz * tr, rPhysScale);
      const d = psi * psi;
      if (d > maxDensityEstimate) maxDensityEstimate = d;
    }
  }
  const thresholdFactor = maxDensityEstimate * 1.05;

  let count = 0;
  let attempts = 0;
  const maxAttempts = numPoints * 45;

  while (count < numPoints && attempts < maxAttempts) {
    attempts++;

    // Random point in sphere
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    // Importance-biased radial distribution towards characteristic peak
    const rSample = maxRadius * Math.pow(Math.random(), 0.65);

    const x = rSample * Math.sin(phi) * Math.cos(theta);
    const y = rSample * Math.sin(phi) * Math.sin(theta);
    const z = rSample * Math.cos(phi);

    // Apply slice plane filter if enabled
    if (slicePlane !== 'none') {
      let val = 0;
      if (slicePlane === 'xy') val = z;
      else if (slicePlane === 'xz') val = y;
      else if (slicePlane === 'yz') val = x;

      if (!sliceInvert && val < sliceOffset) continue;
      if (sliceInvert && val > sliceOffset) continue;
    }

    const psi = fullWavefunction(n, l, m, x, y, z, rPhysScale);
    const prob = psi * psi;

    // Monte Carlo rejection test
    if (Math.random() * thresholdFactor < prob) {
      const idx = count * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      const isPos = psi >= 0;
      phases[count] = isPos ? 1 : -1;
      densities[count] = Math.min(1, prob / thresholdFactor);

      // Color with slight radial warmth / core intensity
      const baseColor = isPos ? posColor : negColor;
      const intensity = 0.55 + 0.45 * (prob / thresholdFactor);
      colors[idx] = baseColor.r * intensity;
      colors[idx + 1] = baseColor.g * intensity;
      colors[idx + 2] = baseColor.b * intensity;

      count++;
    }
  }

  return {
    positions: positions.subarray(0, count * 3),
    colors: colors.subarray(0, count * 3),
    phases: phases.subarray(0, count),
    densities: densities.subarray(0, count),
    actualCount: count,
  };
}

/**
 * Generates continuous parametric 3D isosurface meshes for orbital lobes.
 * Accurately models the angular lobes r(θ, φ) ∝ |Y_{l,m}(θ,φ)| with positive and negative phase surfaces.
 */
export function createOrbitalIsosurfaceGroup(
  orbital: OrbitalDefinition,
  isoThreshold = 0.65,
  scale = 3.6
): THREE.Group {
  const { n, l, m } = orbital;
  const group = new THREE.Group();

  const posMaterial = new THREE.MeshStandardMaterial({
    color: orbital.colorPositive,
    emissive: orbital.colorPositive,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.72,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const negMaterial = new THREE.MeshStandardMaterial({
    color: orbital.colorNegative,
    emissive: orbital.colorNegative,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.72,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // 1. s orbitals: concentric spherical shells with radial nodes
  if (l === 0) {
    const rOuter = (n * 1.45) * (scale / 3.0);
    const outerGeo = new THREE.SphereGeometry(rOuter, 32, 32);
    group.add(new THREE.Mesh(outerGeo, posMaterial));

    if (n >= 2) {
      // 1st radial node inner shell
      const rInner = (n * 0.65) * (scale / 3.0);
      const innerGeo = new THREE.SphereGeometry(rInner, 24, 24);
      group.add(new THREE.Mesh(innerGeo, negMaterial));
    }
    if (n >= 3) {
      // 2nd inner shell
      const rCore = (n * 0.32) * (scale / 3.0);
      const coreGeo = new THREE.SphereGeometry(rCore, 20, 20);
      group.add(new THREE.Mesh(coreGeo, posMaterial));
    }
    return group;
  }

  // 2. High-fidelity parametric angular mesh sampling
  // We sample (theta, phi) over the sphere and compute r = R_base * |Y_{l,m}(theta, phi)|^(2/3)
  const uSegments = 48;
  const vSegments = 48;

  // Separate geometries for positive phase and negative phase lobes
  const posVertices: number[] = [];
  const posNormals: number[] = [];
  const posIndices: number[] = [];

  const negVertices: number[] = [];
  const negNormals: number[] = [];
  const negIndices: number[] = [];

  // Build regular sphere parameter grid
  const gridPoints: Array<{
    r: number;
    pos: THREE.Vector3;
    normal: THREE.Vector3;
    phase: number;
  }> = [];

  const baseRadius = (2.2 + n * 0.55) * (scale / 3.2);

  for (let j = 0; j <= vSegments; j++) {
    const v = j / vSegments;
    const phi = v * Math.PI; // 0 to PI
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let i = 0; i <= uSegments; i++) {
      const u = i / uSegments;
      const theta = u * 2 * Math.PI; // 0 to 2PI
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      // Direction on unit sphere
      const dx = sinPhi * cosTheta;
      const dy = sinPhi * sinTheta;
      const dz = cosPhi;

      const Y = realSphericalHarmonic(l, m, dx, dy, dz);
      const absY = Math.abs(Y);

      // Thresholded radial deformation for lobe boundary
      // Using power scaling to create textbook crisp lobes with smooth zero-transition
      let rLobe = 0;
      if (absY > 0.005) {
        rLobe = baseRadius * Math.pow(absY, 0.75);
      }

      const p = new THREE.Vector3(dx * rLobe, dy * rLobe, dz * rLobe);
      const norm = new THREE.Vector3(dx, dy, dz).normalize();

      gridPoints.push({
        r: rLobe,
        pos: p,
        normal: norm,
        phase: Y >= 0 ? 1 : -1,
      });
    }
  }

  // Triangulate grid into positive and negative index buffers
  for (let j = 0; j < vSegments; j++) {
    for (let i = 0; i < uSegments; i++) {
      const p1 = j * (uSegments + 1) + i;
      const p2 = p1 + 1;
      const p3 = (j + 1) * (uSegments + 1) + i;
      const p4 = p3 + 1;

      const pt1 = gridPoints[p1];
      const pt2 = gridPoints[p2];
      const pt3 = gridPoints[p3];
      const pt4 = gridPoints[p4];

      // Add to positive mesh if dominant phase is positive and has noticeable radius
      const avgR = (pt1.r + pt2.r + pt3.r + pt4.r) / 4;
      if (avgR > 0.08) {
        const positiveCount = (pt1.phase > 0 ? 1 : 0) + (pt2.phase > 0 ? 1 : 0) + (pt3.phase > 0 ? 1 : 0) + (pt4.phase > 0 ? 1 : 0);
        const isPos = positiveCount >= 2;

        const targetVerts = isPos ? posVertices : negVertices;
        const targetNorms = isPos ? posNormals : negNormals;
        const targetIndices = isPos ? posIndices : negIndices;

        const baseIdx = targetVerts.length / 3;

        // Add 4 vertices
        [pt1, pt2, pt3, pt4].forEach((pt) => {
          targetVerts.push(pt.pos.x, pt.pos.y, pt.pos.z);
          targetNorms.push(pt.normal.x, pt.normal.y, pt.normal.z);
        });

        // Two triangles
        targetIndices.push(baseIdx, baseIdx + 2, baseIdx + 1);
        targetIndices.push(baseIdx + 1, baseIdx + 2, baseIdx + 3);
      }
    }
  }

  // Create positive mesh
  if (posVertices.length > 0) {
    const posGeo = new THREE.BufferGeometry();
    posGeo.setAttribute('position', new THREE.Float32BufferAttribute(posVertices, 3));
    posGeo.setAttribute('normal', new THREE.Float32BufferAttribute(posNormals, 3));
    posGeo.setIndex(posIndices);
    posGeo.computeVertexNormals();
    group.add(new THREE.Mesh(posGeo, posMaterial));
  }

  // Create negative mesh
  if (negVertices.length > 0) {
    const negGeo = new THREE.BufferGeometry();
    negGeo.setAttribute('position', new THREE.Float32BufferAttribute(negVertices, 3));
    negGeo.setAttribute('normal', new THREE.Float32BufferAttribute(negNormals, 3));
    negGeo.setIndex(negIndices);
    negGeo.computeVertexNormals();
    group.add(new THREE.Mesh(negGeo, negMaterial));
  }

  // If d_z² or f_z³, add the characteristic equatorial donut/torus ring for enhanced textbook visual fidelity
  if (l === 2 && m === 0) {
    // d_z² central torus
    const torusGeo = new THREE.TorusGeometry(baseRadius * 0.44, baseRadius * 0.12, 16, 32);
    const torusMesh = new THREE.Mesh(torusGeo, negMaterial);
    torusMesh.rotation.x = Math.PI / 2;
    group.add(torusMesh);
  } else if (l === 3 && m === 0) {
    // f_z³ two conical collars
    const collarTop = new THREE.TorusGeometry(baseRadius * 0.48, baseRadius * 0.09, 14, 28);
    const collarBottom = new THREE.TorusGeometry(baseRadius * 0.48, baseRadius * 0.09, 14, 28);
    const topMesh = new THREE.Mesh(collarTop, negMaterial);
    const btmMesh = new THREE.Mesh(collarBottom, posMaterial);
    topMesh.rotation.x = Math.PI / 2;
    topMesh.position.z = baseRadius * 0.32;
    btmMesh.rotation.x = Math.PI / 2;
    btmMesh.position.z = -baseRadius * 0.32;
    group.add(topMesh, btmMesh);
  }

  return group;
}

/**
 * Calculates sampled data points for 2D Radial Distribution Graph P(r) = 4π r² |R_{n,l}(r)|²
 */
export function getRadialDistributionCurve(n: number, l: number, sampleCount = 120): {
  rValues: number[];
  pValues: number[];
  maxP: number;
  rPeak: number;
  radialNodes: number[];
} {
  const maxR = Math.max(12, n * n * 2.2);
  const dr = maxR / sampleCount;

  const rValues: number[] = [];
  const pValues: number[] = [];
  let maxP = 0;
  let rPeak = 0;

  for (let i = 0; i <= sampleCount; i++) {
    const r = i * dr;
    const p = 4 * Math.PI * radialProbabilityDensity(n, l, r);
    rValues.push(r);
    pValues.push(p);

    if (p > maxP) {
      maxP = p;
      rPeak = r;
    }
  }

  // Detect radial node positions where R_{n,l}(r) = 0
  const radialNodes: number[] = [];
  let prevVal = radialWavefunction(n, l, 0.01);

  for (let i = 1; i <= sampleCount * 2; i++) {
    const r = (i * maxR) / (sampleCount * 2);
    const currVal = radialWavefunction(n, l, r);
    if ((prevVal > 0 && currVal < 0) || (prevVal < 0 && currVal > 0)) {
      radialNodes.push(Number(r.toFixed(2)));
    }
    prevVal = currVal;
  }

  return { rValues, pValues, maxP, rPeak, radialNodes };
}
