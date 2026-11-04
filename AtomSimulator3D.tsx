import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls, setupStandardRenderer, setupSceneEnvironment, isSoftwareGl } from '../utils/three-setup';
import { ElementData } from '../types/chemistry';
import { ELEMENTS, SHELL_NAMES, SHELL_MAX_ELECTRONS, getElement } from '../data/elements';
import { soundFx } from '../utils/audio';
import {
  RotateCcw,
  Play,
  Pause,
  Atom,
  Sparkles,
  Zap,
  Info,
  Maximize2,
  Layers,
  Activity,
  Sliders,
  Plus,
  Minus,
  HelpCircle,
  Eye,
  Compass,
  Scissors,
  BarChart2,
  Box,
  Sun,
  BookOpen,
  Hash,
} from 'lucide-react';

// Pre-allocated vector for animation loop (Three.js zero-GC discipline)
const _tempVec = new THREE.Vector3();

// Aufbau Order & Quantum Subshells
export interface SubshellDef {
  n: number;
  l: number;
  type: 's' | 'p' | 'd' | 'f';
  name: string;
  capacity: number;
}

export const AUFBAU_ORDER: SubshellDef[] = [
  { n: 1, l: 0, type: 's', name: '1s', capacity: 2 },
  { n: 2, l: 0, type: 's', name: '2s', capacity: 2 },
  { n: 2, l: 1, type: 'p', name: '2p', capacity: 6 },
  { n: 3, l: 0, type: 's', name: '3s', capacity: 2 },
  { n: 3, l: 1, type: 'p', name: '3p', capacity: 6 },
  { n: 4, l: 0, type: 's', name: '4s', capacity: 2 },
  { n: 3, l: 2, type: 'd', name: '3d', capacity: 10 },
  { n: 4, l: 1, type: 'p', name: '4p', capacity: 6 },
  { n: 5, l: 0, type: 's', name: '5s', capacity: 2 },
  { n: 4, l: 2, type: 'd', name: '4d', capacity: 10 },
  { n: 5, l: 1, type: 'p', name: '5p', capacity: 6 },
  { n: 6, l: 0, type: 's', name: '6s', capacity: 2 },
  { n: 4, l: 3, type: 'f', name: '4f', capacity: 14 },
  { n: 5, l: 2, type: 'd', name: '5d', capacity: 10 },
  { n: 6, l: 1, type: 'p', name: '6p', capacity: 6 },
  { n: 7, l: 0, type: 's', name: '7s', capacity: 2 },
  { n: 5, l: 3, type: 'f', name: '5f', capacity: 14 },
  { n: 6, l: 2, type: 'd', name: '6d', capacity: 10 },
  { n: 7, l: 1, type: 'p', name: '7p', capacity: 6 },
];

export interface SubshellOccupancy {
  name: string;
  n: number;
  l: number;
  type: 's' | 'p' | 'd' | 'f';
  capacity: number;
  electronCount: number;
  isFull: boolean;
  radialNodes: number;
  angularNodes: number;
  totalNodes: number;
  orbitals: Array<{
    name: string;
    subLabel: string;
    axis?: 'x' | 'y' | 'z';
    dType?: 'xy' | 'yz' | 'xz' | 'x2-y2' | 'z2';
    electrons: number; // 0, 1, or 2
    spinUp: boolean;
    spinDown: boolean;
  }>;
}

export function getAufbauConfiguration(electronCount: number): SubshellOccupancy[] {
  let remaining = Math.max(0, electronCount);
  const result: SubshellOccupancy[] = [];

  for (const sub of AUFBAU_ORDER) {
    if (remaining <= 0) break;
    const count = Math.min(remaining, sub.capacity);
    remaining -= count;

    let subOrbitals: SubshellOccupancy['orbitals'] = [];

    if (sub.type === 's') {
      subOrbitals = [
        {
          name: `${sub.name}`,
          subLabel: 's',
          electrons: count,
          spinUp: count >= 1,
          spinDown: count >= 2,
        },
      ];
    } else if (sub.type === 'p') {
      const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
      subOrbitals = axes.map((axis, i) => {
        const spinUp = count > i;
        const spinDown = count > 3 + i;
        const eCount = (spinUp ? 1 : 0) + (spinDown ? 1 : 0);
        return {
          name: `${sub.name}_${axis}`,
          subLabel: `p_${axis}`,
          axis,
          electrons: eCount,
          spinUp,
          spinDown,
        };
      });
    } else if (sub.type === 'd') {
      const dTypes: ('xy' | 'yz' | 'xz' | 'x2-y2' | 'z2')[] = ['xy', 'yz', 'xz', 'x2-y2', 'z2'];
      subOrbitals = dTypes.map((dType, i) => {
        const spinUp = count > i;
        const spinDown = count > 5 + i;
        const eCount = (spinUp ? 1 : 0) + (spinDown ? 1 : 0);
        return {
          name: `${sub.name}_${dType}`,
          subLabel: `d_${dType}`,
          dType,
          electrons: eCount,
          spinUp,
          spinDown,
        };
      });
    } else {
      // f orbitals
      subOrbitals = Array.from({ length: 7 }, (_, i) => {
        const spinUp = count > i;
        const spinDown = count > 7 + i;
        const eCount = (spinUp ? 1 : 0) + (spinDown ? 1 : 0);
        return {
          name: `${sub.name}_f${i + 1}`,
          subLabel: `f${i + 1}`,
          electrons: eCount,
          spinUp,
          spinDown,
        };
      });
    }

    result.push({
      ...sub,
      electronCount: count,
      isFull: count === sub.capacity,
      radialNodes: Math.max(0, sub.n - sub.l - 1),
      angularNodes: sub.l,
      totalNodes: sub.n - 1,
      orbitals: subOrbitals,
    });
  }

  return result;
}

export const formatElectronConfig = (subshells: SubshellOccupancy[]): string => {
  if (subshells.length === 0) return '0 e⁻ (Ionized Core)';
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return subshells
    .map((s) => `${s.name}${String(s.electronCount).split('').map((c) => superscripts[c] || c).join('')}`)
    .join(' ');
};

// Quantum Orbital Specification for s, p, d, f electron cloud visualization
export interface QuantumOrbitalSpec {
  id: string;
  name: string;
  n: number;
  l: number;
  type: 's' | 'p' | 'd' | 'f';
  subType: string;
  ml: number;
  label: string;
  angularNodes: number;
  radialNodes: number;
  description: string;
  cartesianFormula: string;
}

export const QUANTUM_ORBITAL_LIBRARY: QuantumOrbitalSpec[] = [
  // s orbitals (l = 0)
  {
    id: '1s',
    name: '1s Orbital',
    n: 1,
    l: 0,
    type: 's',
    subType: 's',
    ml: 0,
    label: '1s',
    angularNodes: 0,
    radialNodes: 0,
    description: 'Ground state spherically symmetric electron cloud. Maximum probability density at the nucleus.',
    cartesianFormula: 'Ψ₁₀₀ ∝ e^(-r/a₀)',
  },
  {
    id: '2s',
    name: '2s Orbital',
    n: 2,
    l: 0,
    type: 's',
    subType: 's',
    ml: 0,
    label: '2s',
    angularNodes: 0,
    radialNodes: 1,
    description: 'Spherically symmetric with 1 spherical radial node at r = 2a₀ separating inner and outer clouds.',
    cartesianFormula: 'Ψ₂₀₀ ∝ (2 - r/a₀) e^(-r/2a₀)',
  },
  {
    id: '3s',
    name: '3s Orbital',
    n: 3,
    l: 0,
    type: 's',
    subType: 's',
    ml: 0,
    label: '3s',
    angularNodes: 0,
    radialNodes: 2,
    description: 'Spherically symmetric with 2 concentric spherical radial nodes forming 3 probability shells.',
    cartesianFormula: 'Ψ₃₀₀ ∝ (27 - 18ρ + 2ρ²) e^(-ρ/3)',
  },
  {
    id: '4s',
    name: '4s Orbital',
    n: 4,
    l: 0,
    type: 's',
    subType: 's',
    ml: 0,
    label: '4s',
    angularNodes: 0,
    radialNodes: 3,
    description: 'Diffuse valence spherical cloud with 3 concentric radial nodes.',
    cartesianFormula: 'Ψ₄₀₀ ∝ (192 - 144ρ + 24ρ² - ρ³) e^(-ρ/4)',
  },

  // p orbitals (l = 1)
  {
    id: '2px',
    name: '2pₓ Orbital',
    n: 2,
    l: 1,
    type: 'p',
    subType: 'px',
    ml: 1,
    label: '2pₓ',
    angularNodes: 1,
    radialNodes: 0,
    description: 'Dumbbell-shaped lobes oriented along the x-axis with a planar node at x = 0 (yz plane).',
    cartesianFormula: 'Ψ₂₁₁ ∝ x · e^(-r/2a₀)',
  },
  {
    id: '2py',
    name: '2pᵧ Orbital',
    n: 2,
    l: 1,
    type: 'p',
    subType: 'py',
    ml: -1,
    label: '2pᵧ',
    angularNodes: 1,
    radialNodes: 0,
    description: 'Dumbbell-shaped lobes oriented along the y-axis with a planar node at y = 0 (xz plane).',
    cartesianFormula: 'Ψ₂₁₋₁ ∝ y · e^(-r/2a₀)',
  },
  {
    id: '2pz',
    name: '2p_z Orbital',
    n: 2,
    l: 1,
    type: 'p',
    subType: 'pz',
    ml: 0,
    label: '2p_z',
    angularNodes: 1,
    radialNodes: 0,
    description: 'Dumbbell-shaped lobes oriented along the z-axis with a planar node at z = 0 (xy plane).',
    cartesianFormula: 'Ψ₂₁₀ ∝ z · e^(-r/2a₀)',
  },
  {
    id: '3pz',
    name: '3p_z Orbital',
    n: 3,
    l: 1,
    type: 'p',
    subType: 'pz',
    ml: 0,
    label: '3p_z',
    angularNodes: 1,
    radialNodes: 1,
    description: 'Elongated lobes along z with 1 internal radial node and 1 planar node at z = 0.',
    cartesianFormula: 'Ψ₃₁₀ ∝ z · (4 - ρ) e^(-ρ/3)',
  },
  {
    id: '3px',
    name: '3pₓ Orbital',
    n: 3,
    l: 1,
    type: 'p',
    subType: 'px',
    ml: 1,
    label: '3pₓ',
    angularNodes: 1,
    radialNodes: 1,
    description: 'Elongated lobes along x with 1 internal radial node and 1 planar node at x = 0 (yz plane).',
    cartesianFormula: 'Ψ₃₁₁ ∝ x · (4 - ρ) e^(-ρ/3)',
  },
  {
    id: '3py',
    name: '3pᵧ Orbital',
    n: 3,
    l: 1,
    type: 'p',
    subType: 'py',
    ml: -1,
    label: '3pᵧ',
    angularNodes: 1,
    radialNodes: 1,
    description: 'Elongated lobes along y with 1 internal radial node and 1 planar node at y = 0 (xz plane).',
    cartesianFormula: 'Ψ₃₁₋₁ ∝ y · (4 - ρ) e^(-ρ/3)',
  },

  // d orbitals (l = 2)
  {
    id: '3dz2',
    name: '3d_z² Orbital',
    n: 3,
    l: 2,
    type: 'd',
    subType: 'dz2',
    ml: 0,
    label: '3d_z²',
    angularNodes: 2,
    radialNodes: 0,
    description: 'Two elongated lobes along z with an equatorial doughnut-shaped probability ring in xy plane.',
    cartesianFormula: 'Ψ₃₂₀ ∝ (2z² - x² - y²) e^(-r/3a₀)',
  },
  {
    id: '3dx2-y2',
    name: '3d_x²-y² Orbital',
    n: 3,
    l: 2,
    type: 'd',
    subType: 'dx2-y2',
    ml: 2,
    label: '3d_x²-y²',
    angularNodes: 2,
    radialNodes: 0,
    description: 'Four cloverleaf lobes lying directly along the x and y axes. Two nodal planes at x = ±y.',
    cartesianFormula: 'Ψ₃₂₂ ∝ (x² - y²) e^(-r/3a₀)',
  },
  {
    id: '3dxy',
    name: '3d_xy Orbital',
    n: 3,
    l: 2,
    type: 'd',
    subType: 'dxy',
    ml: -2,
    label: '3d_xy',
    angularNodes: 2,
    radialNodes: 0,
    description: 'Four cloverleaf lobes lying between the x and y axes. Nodal planes at x = 0 and y = 0.',
    cartesianFormula: 'Ψ₃₂₋₂ ∝ xy · e^(-r/3a₀)',
  },
  {
    id: '3dxz',
    name: '3d_xz Orbital',
    n: 3,
    l: 2,
    type: 'd',
    subType: 'dxz',
    ml: 1,
    label: '3d_xz',
    angularNodes: 2,
    radialNodes: 0,
    description: 'Four cloverleaf lobes lying in the xz plane between x and z axes.',
    cartesianFormula: 'Ψ₃₂₁ ∝ xz · e^(-r/3a₀)',
  },
  {
    id: '3dyz',
    name: '3d_yz Orbital',
    n: 3,
    l: 2,
    type: 'd',
    subType: 'dyz',
    ml: -1,
    label: '3d_yz',
    angularNodes: 2,
    radialNodes: 0,
    description: 'Four cloverleaf lobes lying in the yz plane between y and z axes.',
    cartesianFormula: 'Ψ₃₂₋₁ ∝ yz · e^(-r/3a₀)',
  },

  // f orbitals (l = 3)
  {
    id: '4fxyz',
    name: '4f_xyz Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fxyz',
    ml: 2,
    label: '4f_xyz',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Eight distinct lobes pointing toward the 8 vertices of a cube with 3 orthogonal nodal planes.',
    cartesianFormula: 'Ψ₄₃₂ ∝ xyz · e^(-r/4a₀)',
  },
  {
    id: '4fz3',
    name: '4f_z³ Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fz3',
    ml: 0,
    label: '4f_z³',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Two elongated vertical lobes along the z-axis with two conical nodal collars/rings.',
    cartesianFormula: 'Ψ₄₃₀ ∝ z(5z² - 3r²) e^(-r/4a₀)',
  },
  {
    id: '4fz(x2-y2)',
    name: '4f_z(x²-y²) Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fz(x2-y2)',
    ml: -2,
    label: '4f_z(x²-y²)',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Eight lobes separated by nodal planes at z = 0, x = y, and x = -y.',
    cartesianFormula: 'Ψ₄₃₋₂ ∝ z(x² - y²) e^(-r/4a₀)',
  },
  {
    id: '4fxz2',
    name: '4f_xz² Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fxz2',
    ml: 1,
    label: '4f_xz²',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Two primary horizontal lobes along x flanked by two secondary angular rings.',
    cartesianFormula: 'Ψ₄₃₁ ∝ x(5z² - r²) e^(-r/4a₀)',
  },
  {
    id: '4fyz2',
    name: '4f_yz² Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fyz2',
    ml: -1,
    label: '4f_yz²',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Two primary horizontal lobes along y flanked by two secondary angular rings.',
    cartesianFormula: 'Ψ₄₃₋₁ ∝ y(5z² - r²) e^(-r/4a₀)',
  },
  {
    id: '4fx(x2-3y2)',
    name: '4f_x(x²-3y²) Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fx(x2-3y2)',
    ml: 3,
    label: '4f_x(x²-3y²)',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Six planar lobes symmetrically distributed at 60° intervals in the xy plane.',
    cartesianFormula: 'Ψ₄₃₃ ∝ x(x² - 3y²) e^(-r/4a₀)',
  },
  {
    id: '4fy(3x2-y2)',
    name: '4f_y(3x²-y²) Orbital',
    n: 4,
    l: 3,
    type: 'f',
    subType: 'fy(3x2-y2)',
    ml: -3,
    label: '4f_y(3x²-y²)',
    angularNodes: 3,
    radialNodes: 0,
    description: 'Six planar lobes rotated by 30° relative to the x-axis in the xy plane.',
    cartesianFormula: 'Ψ₄₃₋₃ ∝ y(3x² - y²) e^(-r/4a₀)',
  },
];

// Hydrogenic Radial Wavefunction Evaluator R_nl(r)
export function evaluateRadialWavefunction(n: number, l: number, r: number): number {
  const rho = (2 * r) / n;
  if (n === 1 && l === 0) { // 1s
    return 2 * Math.exp(-rho / 2);
  }
  if (n === 2 && l === 0) { // 2s
    return (1 / (2 * Math.SQRT2)) * (2 - rho) * Math.exp(-rho / 2);
  }
  if (n === 2 && l === 1) { // 2p
    return (1 / (2 * Math.sqrt(6))) * rho * Math.exp(-rho / 2);
  }
  if (n === 3 && l === 0) { // 3s
    return (1 / (9 * Math.sqrt(3))) * (6 - 6 * rho + rho * rho) * Math.exp(-rho / 2);
  }
  if (n === 3 && l === 1) { // 3p
    return (1 / (9 * Math.sqrt(6))) * (4 - rho) * rho * Math.exp(-rho / 2);
  }
  if (n === 3 && l === 2) { // 3d
    return (1 / (9 * Math.sqrt(30))) * (rho * rho) * Math.exp(-rho / 2);
  }
  if (n === 4 && l === 0) { // 4s
    return (1 / 96) * (24 - 36 * rho + 12 * rho * rho - rho * rho * rho) * Math.exp(-rho / 2);
  }
  if (n === 4 && l === 1) { // 4p
    return (1 / (32 * Math.sqrt(15))) * (20 - 10 * rho + rho * rho) * rho * Math.exp(-rho / 2);
  }
  if (n === 4 && l === 2) { // 4d
    return (1 / (96 * Math.sqrt(5))) * (6 - rho) * rho * rho * Math.exp(-rho / 2);
  }
  if (n === 4 && l === 3) { // 4f
    return (1 / (96 * Math.sqrt(35))) * Math.pow(rho, 3) * Math.exp(-rho / 2);
  }
  // Generalized fallback
  return Math.pow(rho, Math.max(0, l)) * Math.exp(-rho / 2);
}

export interface OrbitalWavefunctionEval {
  psi: number;
  probDensity: number;
}

// 3D Cartesian Wavefunction Evaluator Psi(x,y,z)
export function evaluateOrbitalWavefunction(
  n: number,
  l: number,
  subType: string,
  x: number,
  y: number,
  z: number
): OrbitalWavefunctionEval {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-5) {
    if (l === 0) {
      const R0 = evaluateRadialWavefunction(n, 0, 0);
      return { psi: R0, probDensity: R0 * R0 };
    }
    return { psi: 0, probDensity: 0 };
  }

  const ux = x / r;
  const uy = y / r;
  const uz = z / r;
  const R = evaluateRadialWavefunction(n, l, r);
  let angular = 1.0;

  if (l === 0) {
    angular = 1.0 / (2 * Math.sqrt(Math.PI));
  } else if (l === 1) {
    const norm = Math.sqrt(3 / (4 * Math.PI));
    if (subType === 'px' || subType === 'p_x') angular = norm * ux;
    else if (subType === 'py' || subType === 'p_y') angular = norm * uy;
    else angular = norm * uz; // pz default
  } else if (l === 2) {
    const normD = Math.sqrt(15 / (4 * Math.PI));
    if (subType === 'dxy' || subType === 'd_xy') angular = normD * (ux * uy);
    else if (subType === 'dyz' || subType === 'd_yz') angular = normD * (uy * uz);
    else if (subType === 'dxz' || subType === 'd_xz') angular = normD * (ux * uz);
    else if (subType === 'dx2-y2' || subType === 'd_x2-y2') angular = (normD / 2) * (ux * ux - uy * uy);
    else if (subType === 'dz2' || subType === 'd_z2') {
      const normDz2 = Math.sqrt(5 / (16 * Math.PI));
      angular = normDz2 * (2 * uz * uz - ux * ux - uy * uy);
    } else {
      angular = normD * (ux * uy);
    }
  } else if (l === 3) {
    if (subType === 'fxyz' || subType === 'f_xyz') {
      const normF = Math.sqrt(105 / (4 * Math.PI));
      angular = normF * (ux * uy * uz);
    } else if (subType === 'fz3' || subType === 'f_z3') {
      const normFz3 = Math.sqrt(7 / (16 * Math.PI));
      angular = normFz3 * uz * (5 * uz * uz - 3);
    } else if (subType === 'fxz2' || subType === 'f_xz2') {
      const normFxz2 = Math.sqrt(42 / (16 * Math.PI));
      angular = normFxz2 * ux * (5 * uz * uz - 1);
    } else if (subType === 'fyz2' || subType === 'f_yz2') {
      const normFyz2 = Math.sqrt(42 / (16 * Math.PI));
      angular = normFyz2 * uy * (5 * uz * uz - 1);
    } else if (subType === 'fz(x2-y2)' || subType === 'f_z(x2-y2)') {
      const normFzxy = Math.sqrt(105 / (16 * Math.PI));
      angular = normFzxy * uz * (ux * ux - uy * uy);
    } else if (subType === 'fx(x2-3y2)' || subType === 'f_x(x2-3y2)') {
      const normFx3y = Math.sqrt(35 / (16 * Math.PI));
      angular = normFx3y * ux * (ux * ux - 3 * uy * uy);
    } else if (subType === 'fy(3x2-y2)' || subType === 'f_y(3x2-y2)') {
      const normFy3x = Math.sqrt(35 / (16 * Math.PI));
      angular = normFy3x * uy * (3 * ux * ux - uy * uy);
    } else {
      const normF = Math.sqrt(105 / (4 * Math.PI));
      angular = normF * (ux * uy * uz);
    }
  }

  const psi = R * angular;
  return {
    psi,
    probDensity: psi * psi,
  };
}

// High-dynamic luminous particle sprite texture for ethereal glowing electron cloud mist
let _cachedCloudTexture: THREE.Texture | null = null;
function getCloudParticleTexture(): THREE.Texture {
  if (_cachedCloudTexture) return _cachedCloudTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');     // White-hot radiant core
  gradient.addColorStop(0.12, 'rgba(255, 255, 255, 0.96)');   // High-luminance core bloom
  gradient.addColorStop(0.26, 'rgba(235, 250, 255, 0.82)');   // Inner electric halo
  gradient.addColorStop(0.46, 'rgba(175, 235, 255, 0.44)');   // Saturated cyan/magenta mid-glow
  gradient.addColorStop(0.72, 'rgba(100, 210, 255, 0.16)');   // Soft diffuse celestial fog
  gradient.addColorStop(1.0, 'rgba(0, 160, 255, 0.0)');       // Seamless transparent falloff
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  _cachedCloudTexture = new THREE.CanvasTexture(canvas);
  return _cachedCloudTexture;
}

// Interactive Radial Probability Distribution Chart P(r) = 4*pi*r^2*|R_nl(r)|^2
const RadialProbabilityChart: React.FC<{
  n: number;
  l: number;
  orbitalName: string;
}> = ({ n, l, orbitalName }) => {
  const points = useMemo(() => {
    const maxR = Math.max(9, n * 3.0);
    const step = maxR / 60;
    const pts: { r: number; p: number }[] = [];
    let pMax = 1e-6;

    for (let r = 0; r <= maxR; r += step) {
      const Rnl = evaluateRadialWavefunction(n, l, r);
      const prob = 4 * Math.PI * r * r * Rnl * Rnl;
      if (prob > pMax) pMax = prob;
      pts.push({ r, p: prob });
    }

    return { pts, pMax, maxR };
  }, [n, l]);

  const width = 230;
  const height = 65;
  const padding = 5;

  const pathD = useMemo(() => {
    if (points.pts.length === 0) return '';
    const { pts, pMax, maxR } = points;
    const toX = (r: number) => padding + (r / maxR) * (width - 2 * padding);
    const toY = (p: number) => height - padding - (p / pMax) * (height - 2 * padding);

    let d = `M ${toX(pts[0].r)} ${toY(pts[0].p)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${toX(pts[i].r)} ${toY(pts[i].p)}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (!pathD) return '';
    const { maxR } = points;
    const toX = (r: number) => padding + (r / maxR) * (width - 2 * padding);
    return `${pathD} L ${toX(maxR)} ${height - padding} L ${padding} ${height - padding} Z`;
  }, [pathD, points]);

  return (
    <div className="flex flex-col gap-1 bg-slate-950/85 p-2 rounded-xl border border-slate-800 text-[10px]">
      <div className="flex items-center justify-between text-slate-300">
        <span className="font-semibold text-cyan-300 font-mono flex items-center gap-1">
          <Activity className="w-3 h-3 text-cyan-400" />
          {"P(r) = 4πr²|R_nl(r)|²"}
        </span>
        <span className="text-slate-400 font-mono text-[9px]">{orbitalName}</span>
      </div>

      <svg width={width} height={height} className="overflow-visible w-full h-[65px]">
        <defs>
          <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#475569"
          strokeWidth="1"
        />
        <path d={areaD} fill="url(#probGrad)" />
        <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="1.8" />
      </svg>

      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
        <span>r = 0 (Nucleus)</span>
        <span>Distance r (a₀) ➔</span>
      </div>
    </div>
  );
};

interface AtomSimulator3DProps {
  initialElement?: ElementData;
  theme?: 'dark' | 'light';
  onSelectElementForMolecule?: (symbol: string) => void;
}

export const AtomSimulator3D: React.FC<AtomSimulator3DProps> = ({
  initialElement = ELEMENTS[5], // Default Carbon (C)
  theme = 'dark',
  onSelectElementForMolecule,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Core state
  const [selectedElement, setSelectedElement] = useState<ElementData>(initialElement);
  const [protons, setProtons] = useState<number>(initialElement.atomicNumber);
  const [neutrons, setNeutrons] = useState<number>(
    Math.round(initialElement.atomicMass) - initialElement.atomicNumber
  );
  const [electrons, setElectrons] = useState<number>(initialElement.atomicNumber);

  // Visualization mode
  const [modelMode, setModelMode] = useState<'bohr' | 'orbitals'>('bohr');
  const [orbitalViewType, setOrbitalViewType] = useState<'cloud' | 'surface' | 'hybrid'>('cloud');
  const [selectedOrbitalFamily, setSelectedOrbitalFamily] = useState<'atom' | 's' | 'p' | 'd' | 'f'>('atom');
  const [selectedOrbital, setSelectedOrbital] = useState<string>('all');
  const [sliceCrossSection, setSliceCrossSection] = useState<boolean>(false);
  const [cloudDensity, setCloudDensity] = useState<number>(6000);
  const [glowLevel, setGlowLevel] = useState<'normal' | 'vibrant' | 'hyper'>('vibrant');
  const [showVirtualOrbitals, setShowVirtualOrbitals] = useState<boolean>(false);
  const [showRadialGraph, setShowRadialGraph] = useState<boolean>(true);
  const [showQuantumRules, setShowQuantumRules] = useState<boolean>(false);
  const [orbitalScope, setOrbitalScope] = useState<'valence' | 'all'>('valence');
  const [showCloudDots, setShowCloudDots] = useState<boolean>(true);
  const [showNodalPlanes, setShowNodalPlanes] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [showRings, setShowRings] = useState<boolean>(true);
  const [showNucleonLabels, setShowNucleonLabels] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [activeTab, setActiveTab] = useState<'builder' | 'quantum' | 'properties' | 'isotopes'>('builder');

  // Mutable refs to solve React closure stale state in Three.js animate() loop
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const simSpeedRef = useRef<number>(simSpeed);
  simSpeedRef.current = simSpeed;
  const modelModeRef = useRef<'bohr' | 'orbitals'>(modelMode);
  modelModeRef.current = modelMode;

  // Quantum transition state
  const [lastEmittedPhoton, setLastEmittedPhoton] = useState<{
    from: number;
    to: number;
    wavelengthNm: number;
    color: string;
    name: string;
  } | null>(null);

  // Synchronize when initialElement prop changes
  useEffect(() => {
    setSelectedElement(initialElement);
    setProtons(initialElement.atomicNumber);
    setNeutrons(Math.round(initialElement.atomicMass) - initialElement.atomicNumber);
    setElectrons(initialElement.atomicNumber);
  }, [initialElement]);

  // Derived properties
  const netCharge = protons - electrons;
  const massNumber = protons + neutrons;
  const matchedElement = useMemo(() => getElement(protons) || selectedElement, [protons, selectedElement]);

  // Calculate electron shells distribution
  const currentShells = useMemo(() => {
    const res: number[] = [];
    let remaining = electrons;
    for (let i = 0; i < SHELL_MAX_ELECTRONS.length; i++) {
      if (remaining <= 0) break;
      const capacity = SHELL_MAX_ELECTRONS[i];
      const count = Math.min(remaining, capacity);
      res.push(count);
      remaining -= count;
    }
    return res.length > 0 ? res : [0];
  }, [electrons]);

  // Aufbau quantum subshell occupancy and formatted electron configuration
  const aufbauConfig = useMemo(() => getAufbauConfiguration(electrons), [electrons]);
  const formattedConfig = useMemo(() => formatElectronConfig(aufbauConfig), [aufbauConfig]);

  // Analyze electronic configuration to extract occupied subshell types, principal shells (n), and electron tallies
  const electronConfigAnalysis = useMemo(() => {
    const counts: Record<'s' | 'p' | 'd' | 'f', number> = { s: 0, p: 0, d: 0, f: 0 };
    const occupiedSubshellsByType: Record<'s' | 'p' | 'd' | 'f', SubshellOccupancy[]> = {
      s: [],
      p: [],
      d: [],
      f: [],
    };
    const nLevelsMap = new Map<
      number,
      {
        n: number;
        electronCount: number;
        isValence: boolean;
        subshells: string[];
        capacity: number;
        shellLetter: string;
      }
    >();

    aufbauConfig.forEach((sub) => {
      if (sub.electronCount > 0) {
        counts[sub.type] += sub.electronCount;
        occupiedSubshellsByType[sub.type].push(sub);

        const existing = nLevelsMap.get(sub.n) || {
          n: sub.n,
          electronCount: 0,
          isValence: false,
          subshells: [] as string[],
          capacity: 2 * sub.n * sub.n,
          shellLetter: SHELL_NAMES[sub.n - 1] || `n=${sub.n}`,
        };
        existing.electronCount += sub.electronCount;
        if (!existing.subshells.includes(sub.name)) {
          existing.subshells.push(sub.name);
        }
        nLevelsMap.set(sub.n, existing);
      }
    });

    const occupiedNLevels = Array.from(nLevelsMap.values()).sort((a, b) => a.n - b.n);
    const maxOccupiedN = occupiedNLevels.length > 0 ? Math.max(...occupiedNLevels.map((l) => l.n)) : 1;

    occupiedNLevels.forEach((l) => {
      l.isValence = l.n === maxOccupiedN;
    });

    const occupiedTypes: Array<'s' | 'p' | 'd' | 'f'> = (['s', 'p', 'd', 'f'] as const).filter(
      (type) => counts[type] > 0
    );

    return {
      counts,
      occupiedSubshellsByType,
      occupiedTypes,
      occupiedNLevels,
      maxOccupiedN,
    };
  }, [aufbauConfig]);

  // Available principal n shells (strictly occupied by atom, or extended if virtual orbitals enabled)
  const availableNLevels = useMemo(() => {
    const list = [...electronConfigAnalysis.occupiedNLevels];
    if (list.length === 0) {
      list.push({
        n: 1,
        electronCount: 0,
        isValence: true,
        subshells: ['1s'],
        capacity: 2,
        shellLetter: 'K',
      });
    }

    if (showVirtualOrbitals) {
      const highestN = Math.max(...list.map((l) => l.n));
      const targetMax = Math.min(7, Math.max(highestN + 2, 4));
      for (let n = highestN + 1; n <= targetMax; n++) {
        list.push({
          n,
          electronCount: 0,
          isValence: false,
          subshells: [],
          capacity: 2 * n * n,
          shellLetter: SHELL_NAMES[n - 1] || `n=${n}`,
        });
      }
    }
    return list;
  }, [electronConfigAnalysis.occupiedNLevels, showVirtualOrbitals]);

  // Active selected orbital spec for s, p, d, f probability density visualization
  const activeOrbitalSpec = useMemo(() => {
    if (selectedOrbitalFamily === 'atom') {
      const topSub = aufbauConfig.length > 0 ? aufbauConfig[aufbauConfig.length - 1] : null;
      return {
        id: 'atom_all',
        name: `${matchedElement.name} Total Electron Cloud`,
        n: topSub ? topSub.n : 1,
        l: topSub ? topSub.l : 0,
        type: topSub ? topSub.type : ('s' as const),
        subType: topSub ? topSub.type : 's',
        ml: 0,
        label: `${electrons} e⁻ Total Cloud`,
        angularNodes: topSub ? topSub.angularNodes : 0,
        radialNodes: topSub ? topSub.radialNodes : 0,
        description: `Complete superposition electron cloud probability density for all ${electrons} electrons of ${matchedElement.name} (${formattedConfig}).`,
        cartesianFormula: 'Ψ_atom = Σ Cᵢ · Ψᵢ(r,θ,φ)',
      };
    }

    // Check if selecting an entire subshell (e.g. '2p', '3d', '1s', etc.)
    const matchingSub = aufbauConfig.find((s) => s.name === selectedOrbital);
    if (matchingSub && matchingSub.type === selectedOrbitalFamily) {
      return {
        id: matchingSub.name,
        name: `${matchingSub.name} Subshell Electron Cloud`,
        n: matchingSub.n,
        l: matchingSub.l,
        type: matchingSub.type,
        subType: matchingSub.type,
        ml: 0,
        label: `${matchingSub.name} (${matchingSub.electronCount}/${matchingSub.capacity} e⁻)`,
        angularNodes: matchingSub.angularNodes,
        radialNodes: matchingSub.radialNodes,
        description: `${matchingSub.name} subshell containing ${matchingSub.electronCount} electrons in ${matchedElement.name}.`,
        cartesianFormula: `ρ_${matchingSub.name} = Σ |Ψ_${matchingSub.name},m|²`,
      };
    }

    const found = QUANTUM_ORBITAL_LIBRARY.find((o) => o.id === selectedOrbital);
    if (found) return found;
    return QUANTUM_ORBITAL_LIBRARY.find((o) => o.type === selectedOrbitalFamily) || QUANTUM_ORBITAL_LIBRARY[0];
  }, [selectedOrbitalFamily, selectedOrbital, aufbauConfig, matchedElement, electrons, formattedConfig]);

  // Information about active principal shell (n) within current atom
  const activeNLevelInfo = useMemo(() => {
    return electronConfigAnalysis.occupiedNLevels.find((lvl) => lvl.n === activeOrbitalSpec.n);
  }, [electronConfigAnalysis.occupiedNLevels, activeOrbitalSpec.n]);

  // Auto-synchronize subshell family and principal n according to atom's electronic configuration
  useEffect(() => {
    if (showVirtualOrbitals) return;

    if (selectedOrbitalFamily !== 'atom') {
      // 1. If family is unoccupied in current atom, switch to 'atom' total cloud
      if (!electronConfigAnalysis.occupiedTypes.includes(selectedOrbitalFamily)) {
        setSelectedOrbitalFamily('atom');
        setSelectedOrbital('all');
        return;
      }

      // 2. If current activeOrbitalSpec.n exceeds maxOccupiedN for this atom, clamp to highest occupied subshell
      if (activeOrbitalSpec.n > electronConfigAnalysis.maxOccupiedN) {
        const matchingOccupied = electronConfigAnalysis.occupiedSubshellsByType[selectedOrbitalFamily];
        if (matchingOccupied.length > 0) {
          const highestSub = matchingOccupied[matchingOccupied.length - 1];
          setSelectedOrbital(highestSub.name);
        } else {
          setSelectedOrbitalFamily('atom');
          setSelectedOrbital('all');
        }
      }
    }
  }, [electronConfigAnalysis, selectedOrbitalFamily, showVirtualOrbitals, activeOrbitalSpec.n]);

  // Active electron spin state and Pauli/Hund occupancy for the currently selected subshell/orbital
  const currentOrbitalSpin = useMemo(() => {
    if (selectedOrbitalFamily === 'atom') {
      return {
        spin: `${electrons} e⁻ Superposition`,
        symbol: electrons > 0 ? '↑↓' : '○',
        ms: electrons % 2 === 0 ? '±½ (Net 0)' : '±½ (Net ½)',
        count: electrons,
      };
    }

    const parentSub = aufbauConfig.find((s) => s.n === activeOrbitalSpec.n && s.type === activeOrbitalSpec.type);
    if (!parentSub) return { spin: '0 e⁻ (Unoccupied Virtual)', symbol: '○', ms: 'None', count: 0 };

    if (activeOrbitalSpec.subType === activeOrbitalSpec.type) {
      return {
        spin: `${parentSub.electronCount}/${parentSub.capacity} e⁻ in Subshell`,
        symbol: parentSub.electronCount === parentSub.capacity ? '↑↓ Full' : parentSub.electronCount > 0 ? '↑ Partial' : '○ Empty',
        ms: `±½ (${parentSub.orbitals.filter((o) => o.electrons > 0).length} active)`,
        count: parentSub.electronCount,
      };
    }

    const orbMatch = parentSub.orbitals.find(
      (o) => o.subLabel.toLowerCase() === activeOrbitalSpec.subType.toLowerCase() || activeOrbitalSpec.id.includes(o.subLabel)
    );
    if (!orbMatch || orbMatch.electrons === 0) {
      return { spin: '0 e⁻ (Unoccupied State)', symbol: '○', ms: 'None', count: 0 };
    }
    if (orbMatch.electrons === 2) {
      return { spin: '2 e⁻ (Paired Diamagnetic)', symbol: '↑↓', ms: '±½', count: 2 };
    }
    return { spin: '1 e⁻ (Unpaired Paramagnetic)', symbol: '↑', ms: '+½', count: 1 };
  }, [aufbauConfig, activeOrbitalSpec, selectedOrbitalFamily, electrons]);

  // Allowed magnetic quantum states m_l for active (n, l) subshell
  const allowedMlList = useMemo(() => {
    const l = activeOrbitalSpec.l;
    const n = activeOrbitalSpec.n;
    const list: Array<{ ml: number; label: string; orbitalId?: string; isSelected: boolean }> = [];

    for (let m = -l; m <= l; m++) {
      const match = QUANTUM_ORBITAL_LIBRARY.find(
        (o) => o.n === n && o.l === l && o.ml === m
      );
      list.push({
        ml: m,
        label: match ? match.label : `m=${m}`,
        orbitalId: match ? match.id : undefined,
        isSelected: activeOrbitalSpec.ml === m && (selectedOrbital === match?.id || (!match && selectedOrbital === `${n}${activeOrbitalSpec.type}`)),
      });
    }
    return list;
  }, [activeOrbitalSpec, selectedOrbital]);

  // Interactive Quantum Numbers HUD action handlers
  const handleSelectN = (targetN: number) => {
    const occupiedInTargetN = aufbauConfig.filter((sub) => sub.n === targetN && sub.electronCount > 0);

    let targetType: 's' | 'p' | 'd' | 'f' = activeOrbitalSpec.type;
    let targetL = activeOrbitalSpec.l;

    // Angular momentum must satisfy 0 <= l < n
    if (targetL >= targetN) {
      targetL = targetN - 1;
      targetType = targetL === 0 ? 's' : targetL === 1 ? 'p' : targetL === 2 ? 'd' : 'f';
    }

    // If virtual orbitals are hidden, prefer an occupied subshell in targetN if one exists
    if (!showVirtualOrbitals && occupiedInTargetN.length > 0) {
      const hasCurrentTypeOccupied = occupiedInTargetN.some((sub) => sub.type === targetType);
      if (!hasCurrentTypeOccupied) {
        // Default to the highest occupied subshell in targetN
        const defaultSub = occupiedInTargetN[occupiedInTargetN.length - 1];
        targetType = defaultSub.type;
        targetL = defaultSub.l;
      }
    }

    setSelectedOrbitalFamily(targetType);
    const targetOrbital = QUANTUM_ORBITAL_LIBRARY.find((o) => o.n === targetN && o.l === targetL);
    if (targetOrbital) {
      setSelectedOrbital(targetOrbital.id);
    } else {
      setSelectedOrbital(`${targetN}${targetType}`);
    }
    soundFx.playReactionStep();
  };

  const handleSelectL = (targetL: number) => {
    const newFam: 's' | 'p' | 'd' | 'f' = targetL === 0 ? 's' : targetL === 1 ? 'p' : targetL === 2 ? 'd' : 'f';
    setSelectedOrbitalFamily(newFam);
    const targetOrbital = QUANTUM_ORBITAL_LIBRARY.find((o) => o.n === activeOrbitalSpec.n && o.l === targetL);
    if (targetOrbital) {
      setSelectedOrbital(targetOrbital.id);
    } else {
      setSelectedOrbital(`${activeOrbitalSpec.n}${newFam}`);
    }
    soundFx.playReactionStep();
  };

  const handleSelectMl = (targetMl: number) => {
    const targetOrbital = QUANTUM_ORBITAL_LIBRARY.find(
      (o) => o.n === activeOrbitalSpec.n && o.l === activeOrbitalSpec.l && o.ml === targetMl
    );
    if (targetOrbital) {
      setSelectedOrbital(targetOrbital.id);
    }
    soundFx.playReactionStep();
  };

  // Nuclear stability check
  const nuclearStability = useMemo(() => {
    if (protons === 0) return { stable: false, status: 'No Protons', color: 'text-amber-400' };
    if (protons === 1 && neutrons === 0) return { stable: true, status: 'Stable (Protium)', color: 'text-emerald-400' };
    if (protons === 1 && neutrons === 1) return { stable: true, status: 'Stable (Deuterium)', color: 'text-emerald-400' };
    if (protons === 1 && neutrons === 2) return { stable: false, status: 'Beta- emitter (Tritium)', color: 'text-rose-400' };

    const ratio = neutrons / protons;
    if (protons <= 20) {
      if (ratio >= 0.95 && ratio <= 1.25) return { stable: true, status: 'Stable Nucleus', color: 'text-emerald-400' };
      if (ratio < 0.95) return { stable: false, status: 'Unstable (Proton excess / Positron emission)', color: 'text-rose-400' };
      return { stable: false, status: 'Unstable (Neutron excess / Beta- decay)', color: 'text-amber-400' };
    } else if (protons <= 82) {
      if (ratio >= 1.2 && ratio <= 1.55) return { stable: true, status: 'Stable Nucleus (Belt of Stability)', color: 'text-emerald-400' };
      return { stable: false, status: 'Unstable Isotope (Radioactive decay)', color: 'text-rose-400' };
    } else {
      return { stable: false, status: 'Radioactive (Alpha decay / Spontaneous fission)', color: 'text-red-500' };
    }
  }, [protons, neutrons]);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nucleusGroupRef = useRef<THREE.Group | null>(null);
  const shellsGroupRef = useRef<THREE.Group | null>(null);
  const orbitalsGroupRef = useRef<THREE.Group | null>(null);
  const photonsGroupRef = useRef<THREE.Group | null>(null);
  const electronMeshesRef = useRef<Array<{ mesh: THREE.Mesh; shellIndex: number; angle: number; speed: number; radius: number; tiltMatrix: THREE.Matrix4 }>>([]);
  const activePhotonsRef = useRef<Array<{ mesh: THREE.Group; life: number; velocity: THREE.Vector3 }>>([]);

  // Setup Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8, 22);
    cameraRef.current = camera;

    const renderer = setupStandardRenderer(canvas);
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 60;
    controls.minDistance = 3;
    controlsRef.current = controls;

    const disposeEnv = setupSceneEnvironment(renderer, scene);

    // Lighting setup
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(10, 15, 10);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.4);
    rimLight.position.set(-10, -8, -10);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
    scene.add(hemiLight);

    // Groups
    const nucleusGroup = new THREE.Group();
    scene.add(nucleusGroup);
    nucleusGroupRef.current = nucleusGroup;

    const shellsGroup = new THREE.Group();
    scene.add(shellsGroup);
    shellsGroupRef.current = shellsGroup;

    const orbitalsGroup = new THREE.Group();
    scene.add(orbitalsGroup);
    orbitalsGroupRef.current = orbitalsGroup;

    const photonsGroup = new THREE.Group();
    scene.add(photonsGroup);
    photonsGroupRef.current = photonsGroup;

    // Contact ground shadow disc
    const shadowGeo = new THREE.PlaneGeometry(30, 30);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x000000 : 0x94a3b8,
      transparent: true,
      opacity: theme === 'dark' ? 0.35 : 0.15,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -8;
    scene.add(shadowMesh);

    // Animation loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      const playing = isPlayingRef.current;
      const speed = simSpeedRef.current;
      const currentMode = modelModeRef.current;

      // Only advance physics & rotations when playing is true
      if (playing) {
        // Rotate nucleus gently
        if (nucleusGroupRef.current) {
          nucleusGroupRef.current.rotation.y += delta * 0.4 * speed;
          nucleusGroupRef.current.rotation.x += delta * 0.2 * speed;
        }

        // Animate electrons along orbital shells in Bohr mode
        if (currentMode === 'bohr') {
          electronMeshesRef.current.forEach((el) => {
            el.angle += el.speed * delta * speed;
            const x = Math.cos(el.angle) * el.radius;
            const z = Math.sin(el.angle) * el.radius;
            _tempVec.set(x, 0, z).applyMatrix4(el.tiltMatrix);
            el.mesh.position.copy(_tempVec);
          });
        }

        // Animate orbital rotation in Quantum mode
        if (currentMode === 'orbitals' && orbitalsGroupRef.current) {
          orbitalsGroupRef.current.rotation.y += delta * 0.25 * speed;
        }

        // Animate active emitted photons
        if (photonsGroupRef.current) {
          for (let i = activePhotonsRef.current.length - 1; i >= 0; i--) {
            const photon = activePhotonsRef.current[i];
            photon.mesh.position.addScaledVector(photon.velocity, delta * 8 * speed);
            photon.life -= delta * 0.8 * speed;
            photon.mesh.scale.multiplyScalar(1 + 0.02 * speed);
            if (photon.life <= 0) {
              photonsGroupRef.current.remove(photon.mesh);
              activePhotonsRef.current.splice(i, 1);
            }
          }
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Resize observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      disposeEnv();
      renderer.dispose();
    };
  }, [theme]);

  // Rebuild Nucleus (Optimized with THREE.InstancedMesh: collapses 200+ draw calls to 2)
  useEffect(() => {
    const group = nucleusGroupRef.current;
    if (!group) return;

    // Clear old nucleons
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Object3D;
      if ('geometry' in child && (child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
      group.remove(child);
    }

    const totalNucleons = protons + neutrons;
    if (totalNucleons <= 0) return;

    const nucleonRadius = 0.28;
    const geo = new THREE.SphereGeometry(nucleonRadius, 12, 12);

    const protonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Red
      emissive: 0x991b1b,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.1,
    });

    const neutronMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Sky cyan
      emissive: 0x0369a1,
      emissiveIntensity: 0.15,
      roughness: 0.35,
      metalness: 0.1,
    });

    // Golden spiral sphere packing algorithm for realistic tight nuclear cluster
    const phi = (1 + Math.sqrt(5)) / 2;
    const clusterScale = Math.pow(Math.max(totalNucleons, 1), 0.34) * 0.42;

    const dummy = new THREE.Object3D();
    const pTotal = Math.max(1, protons);
    const nTotal = Math.max(1, neutrons);
    const protonMesh = new THREE.InstancedMesh(geo, protonMat, pTotal);
    const neutronMesh = new THREE.InstancedMesh(geo, neutronMat, nTotal);

    let pIdx = 0;
    let nIdx = 0;
    let pCount = 0;
    let nCount = 0;

    for (let i = 0; i < totalNucleons; i++) {
      const y = totalNucleons === 1 ? 0 : 1 - (i / (totalNucleons - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = 2 * Math.PI * i * (1 - 1 / phi);

      const x = Math.cos(theta) * radiusAtY * clusterScale + (Math.random() - 0.5) * 0.05;
      const yPos = y * clusterScale + (Math.random() - 0.5) * 0.05;
      const z = Math.sin(theta) * radiusAtY * clusterScale + (Math.random() - 0.5) * 0.05;

      dummy.position.set(x, yPos, z);
      dummy.updateMatrix();

      const isProton = (pCount / pTotal < nCount / nTotal || nCount >= neutrons) && pCount < protons;
      if (isProton && pIdx < pTotal) {
        protonMesh.setMatrixAt(pIdx++, dummy.matrix);
        pCount++;
      } else if (nIdx < nTotal) {
        neutronMesh.setMatrixAt(nIdx++, dummy.matrix);
        nCount++;
      }
    }

    protonMesh.instanceMatrix.needsUpdate = true;
    neutronMesh.instanceMatrix.needsUpdate = true;
    group.add(protonMesh);
    group.add(neutronMesh);

    // Add glowing nuclear halo
    const glowGeo = new THREE.SphereGeometry(clusterScale * 1.4 + 0.3, 14, 14);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));
  }, [protons, neutrons]);

  // Rebuild Bohr Shells & Orbiting Electrons
  useEffect(() => {
    const group = shellsGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      group.remove(child);
    }
    electronMeshesRef.current = [];

    if (modelMode !== 'bohr') {
      group.visible = false;
      return;
    }
    group.visible = true;

    const baseRadius = 2.4;
    const radiusStep = 1.35;
    const electronGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const electronMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8, // Electric blue
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 1.0,
    });

    currentShells.forEach((count, shellIdx) => {
      const shellRadius = baseRadius + shellIdx * radiusStep;

      // Unique tilt matrix for each shell so orbitals look dynamic in 3D
      const tiltMatrix = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(
          (shellIdx * 0.18 - 0.25) * Math.PI,
          (shellIdx * 0.12) * Math.PI,
          (shellIdx * 0.15) * Math.PI
        )
      );

      // Render orbital ring track
      if (showRings) {
        const ringGeo = new THREE.TorusGeometry(shellRadius, 0.022, 8, 80);
        const ringMat = new THREE.MeshBasicMaterial({
          color: shellIdx === currentShells.length - 1 ? 0xf59e0b : 0x475569, // Highlight valence shell in gold
          transparent: true,
          opacity: shellIdx === currentShells.length - 1 ? 0.6 : 0.25,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.applyMatrix4(tiltMatrix);
        group.add(ringMesh);
      }

      // Add electrons on this shell
      const shellSpeed = (1.8 / Math.sqrt(shellIdx + 1)) * 0.8;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const eMesh = new THREE.Mesh(electronGeo, electronMat);

        // Add soft halo glow around electron
        const haloGeo = new THREE.SphereGeometry(0.28, 8, 8);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          wireframe: true,
        });
        eMesh.add(new THREE.Mesh(haloGeo, haloMat));

        group.add(eMesh);
        electronMeshesRef.current.push({
          mesh: eMesh,
          shellIndex: shellIdx,
          angle,
          speed: shellSpeed,
          radius: shellRadius,
          tiltMatrix,
        });
      }
    });
  }, [currentShells, modelMode, showRings]);

  // Rebuild Quantum Orbitals & Electron Cloud Probability Densities (|Ψ|²)
  // Optimized for 60 FPS across all 118 elements and s, p, d, f quantum states
  useEffect(() => {
    const group = orbitalsGroupRef.current;
    if (!group) return;

    // Deep recursive disposal of all previous geometries and meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      child.traverse((node) => {
        if ('geometry' in node && (node as THREE.Mesh).geometry) {
          (node as THREE.Mesh).geometry.dispose();
        }
      });
      group.remove(child);
    }

    if (modelMode !== 'orbitals') {
      group.visible = false;
      return;
    }
    group.visible = true;

    // Single-pass standard materials with phase colors (+Ψ Cyan / -Ψ Rose)
    const posLobeMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: orbitalViewType === 'hybrid' ? 0.35 : 0.65,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const negLobeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: orbitalViewType === 'hybrid' ? 0.35 : 0.65,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const outerShellMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: orbitalViewType === 'hybrid' ? 0.18 : 0.28,
      roughness: 0.25,
      metalness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const innerNodalMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: orbitalViewType === 'hybrid' ? 0.22 : 0.35,
      roughness: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const coreInertMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.22,
      roughness: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Reusable shared geometries
    const sharedLobeGeo = new THREE.SphereGeometry(0.85, 14, 14);
    sharedLobeGeo.scale(1, 1.85, 1);

    const createLobe = (direction: 'x' | 'y' | 'z', sign: 1 | -1, scale = 3.2, customMat?: THREE.Material) => {
      const lobeGroup = new THREE.Group();
      const mesh = new THREE.Mesh(sharedLobeGeo, customMat || (sign > 0 ? posLobeMat : negLobeMat));
      mesh.position.y = 1.05;

      lobeGroup.add(mesh);
      lobeGroup.scale.set(scale * 0.45, scale * 0.45, scale * 0.45);

      if (direction === 'x') {
        lobeGroup.rotation.z = (sign > 0 ? -1 : 1) * (Math.PI / 2);
      } else if (direction === 'y') {
        lobeGroup.rotation.x = sign > 0 ? 0 : Math.PI;
      } else if (direction === 'z') {
        lobeGroup.rotation.x = (sign > 0 ? 1 : -1) * (Math.PI / 2);
      }
      return lobeGroup;
    };

    const addSOrbital = (n: number, isMultiShell: boolean) => {
      if (n === 1) {
        const sGeo = new THREE.SphereGeometry(2.0, 18, 18);
        group.add(new THREE.Mesh(sGeo, posLobeMat));
      } else if (n === 2) {
        const outerGeo = new THREE.SphereGeometry(3.6, 18, 18);
        group.add(new THREE.Mesh(outerGeo, isMultiShell ? outerShellMat : posLobeMat));

        const innerGeo = new THREE.SphereGeometry(1.4, 14, 14);
        group.add(new THREE.Mesh(innerGeo, innerNodalMat));
      } else if (n === 3) {
        const outerGeo = new THREE.SphereGeometry(5.0, 18, 18);
        group.add(new THREE.Mesh(outerGeo, outerShellMat));

        const midGeo = new THREE.SphereGeometry(2.8, 14, 14);
        group.add(new THREE.Mesh(midGeo, innerNodalMat));
      } else {
        const r = 4.8 + Math.min(n - 3, 4) * 1.2;
        const outerGeo = new THREE.SphereGeometry(r, 18, 18);
        group.add(new THREE.Mesh(outerGeo, outerShellMat));
      }
    };

    const addDOrbital = (dType: string, scale = 3.6) => {
      const dGroup = new THREE.Group();
      if (dType === 'xy' || dType === 'dxy') {
        const rot = Math.PI / 4;
        const l1 = createLobe('x', 1, scale, posLobeMat);
        const l2 = createLobe('x', -1, scale, posLobeMat);
        const l3 = createLobe('y', 1, scale, negLobeMat);
        const l4 = createLobe('y', -1, scale, negLobeMat);
        l1.rotation.z += rot;
        l2.rotation.z += rot;
        l3.rotation.z += rot;
        l4.rotation.z += rot;
        dGroup.add(l1, l2, l3, l4);
      } else if (dType === 'yz' || dType === 'dyz') {
        const rot = Math.PI / 4;
        const l1 = createLobe('y', 1, scale, posLobeMat);
        const l2 = createLobe('y', -1, scale, posLobeMat);
        const l3 = createLobe('z', 1, scale, negLobeMat);
        const l4 = createLobe('z', -1, scale, negLobeMat);
        l1.rotation.x += rot;
        l2.rotation.x += rot;
        l3.rotation.x += rot;
        l4.rotation.x += rot;
        dGroup.add(l1, l2, l3, l4);
      } else if (dType === 'xz' || dType === 'dxz') {
        const rot = Math.PI / 4;
        const l1 = createLobe('x', 1, scale, posLobeMat);
        const l2 = createLobe('x', -1, scale, posLobeMat);
        const l3 = createLobe('z', 1, scale, negLobeMat);
        const l4 = createLobe('z', -1, scale, negLobeMat);
        l1.rotation.y += rot;
        l2.rotation.y += rot;
        l3.rotation.y += rot;
        l4.rotation.y += rot;
        dGroup.add(l1, l2, l3, l4);
      } else if (dType === 'x2-y2' || dType === 'dx2-y2') {
        dGroup.add(createLobe('x', 1, scale, posLobeMat));
        dGroup.add(createLobe('x', -1, scale, posLobeMat));
        dGroup.add(createLobe('y', 1, scale, negLobeMat));
        dGroup.add(createLobe('y', -1, scale, negLobeMat));
      } else if (dType === 'z2' || dType === 'dz2') {
        dGroup.add(createLobe('z', 1, scale * 1.05, posLobeMat));
        dGroup.add(createLobe('z', -1, scale * 1.05, posLobeMat));
        const torusGeo = new THREE.TorusGeometry(scale * 0.42, scale * 0.12, 12, 28);
        const torusMesh = new THREE.Mesh(torusGeo, negLobeMat);
        torusMesh.rotation.x = Math.PI / 2;
        dGroup.add(torusMesh);
      }
      group.add(dGroup);
    };

    const addFOrbital = (fType: string, scale = 4.2) => {
      const fGroup = new THREE.Group();
      if (fType === 'fxyz') {
        // 8 distinct lobes directed towards 8 octant vertices (+-1, +-1, +-1)
        const signs = [1, -1] as const;
        signs.forEach((sx) => {
          signs.forEach((sy) => {
            signs.forEach((sz) => {
              const isPos = sx * sy * sz > 0;
              const lobe = createLobe('z', 1, scale * 0.82, isPos ? posLobeMat : negLobeMat);
              const dir = new THREE.Vector3(sx, sy, sz).normalize();
              const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
              lobe.quaternion.copy(quat);
              fGroup.add(lobe);
            });
          });
        });
      } else if (fType === 'fz3') {
        // 2 elongated lobes along z + 2 horizontal toroidal collars
        fGroup.add(createLobe('z', 1, scale * 1.15, posLobeMat));
        fGroup.add(createLobe('z', -1, scale * 1.15, negLobeMat));

        const ringGeo1 = new THREE.TorusGeometry(scale * 0.38, scale * 0.09, 12, 28);
        const ringMesh1 = new THREE.Mesh(ringGeo1, negLobeMat);
        ringMesh1.rotation.x = Math.PI / 2;
        ringMesh1.position.z = scale * 0.32;
        fGroup.add(ringMesh1);

        const ringGeo2 = new THREE.TorusGeometry(scale * 0.38, scale * 0.09, 12, 28);
        const ringMesh2 = new THREE.Mesh(ringGeo2, posLobeMat);
        ringMesh2.rotation.x = Math.PI / 2;
        ringMesh2.position.z = -scale * 0.32;
        fGroup.add(ringMesh2);
      } else if (fType === 'fz(x2-y2)') {
        // 8 lobes: 4 in upper hemisphere, 4 in lower hemisphere rotated 45 deg
        for (let k = 0; k < 4; k++) {
          const angle = (k * Math.PI) / 2;
          const isPos = k % 2 === 0;
          const lobeUp = createLobe('y', 1, scale * 0.85, isPos ? posLobeMat : negLobeMat);
          lobeUp.rotation.z = Math.PI / 5;
          lobeUp.rotation.y = angle;
          fGroup.add(lobeUp);

          const lobeDown = createLobe('y', -1, scale * 0.85, !isPos ? posLobeMat : negLobeMat);
          lobeDown.rotation.z = -Math.PI / 5;
          lobeDown.rotation.y = angle;
          fGroup.add(lobeDown);
        }
      } else {
        // Default general 8-lobed f-orbital
        const signs = [1, -1] as const;
        signs.forEach((sx) => {
          signs.forEach((sy) => {
            signs.forEach((sz) => {
              const isPos = sx * sy * sz > 0;
              const lobe = createLobe('z', 1, scale * 0.78, isPos ? posLobeMat : negLobeMat);
              const dir = new THREE.Vector3(sx, sy, sz).normalize();
              const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
              lobe.quaternion.copy(quat);
              fGroup.add(lobe);
            });
          });
        });
      }
      group.add(fGroup);
    };

    // SECTION 1: Boundary Isosurface Meshes (when in 'surface' or 'hybrid' view)
    if (orbitalViewType === 'surface' || orbitalViewType === 'hybrid') {
      if (selectedOrbitalFamily === 'atom') {
        if (electrons > 0) {
          let subshellsToRender = aufbauConfig;
          if (electrons > 18 && orbitalScope === 'valence') {
            subshellsToRender = aufbauConfig.slice(-3);
            const coreRadius = 2.4;
            const coreGeo = new THREE.SphereGeometry(coreRadius, 18, 18);
            const coreMesh = new THREE.Mesh(coreGeo, coreInertMat);
            group.add(coreMesh);
          }
          const hasMultiple = subshellsToRender.length > 1;
          subshellsToRender.forEach((sub) => {
            if (sub.type === 's') {
              addSOrbital(sub.n, hasMultiple);
            } else if (sub.type === 'p') {
              const pScale = sub.n === 2 ? 3.3 : sub.n === 3 ? 4.7 : 5.8;
              sub.orbitals.forEach((orb) => {
                if (orb.electrons > 0 && orb.axis) {
                  group.add(createLobe(orb.axis, 1, pScale));
                  group.add(createLobe(orb.axis, -1, pScale));
                }
              });
            } else if (sub.type === 'd') {
              const dScale = sub.n === 3 ? 3.6 : 4.8;
              sub.orbitals.forEach((orb) => {
                if (orb.electrons > 0 && orb.dType) {
                  addDOrbital(orb.dType, dScale);
                }
              });
            } else if (sub.type === 'f') {
              addFOrbital('fxyz', 4.4);
            }
          });
        }
      } else {
        // Individual s, p, d, f specific orbital or whole subshell boundary surface
        const spec = activeOrbitalSpec;
        if (spec.type === 's') {
          addSOrbital(spec.n, false);
        } else if (spec.type === 'p') {
          const pScale = spec.n === 2 ? 3.4 : spec.n === 3 ? 4.8 : 5.8;
          if (spec.subType === 'px') {
            group.add(createLobe('x', 1, pScale, posLobeMat));
            group.add(createLobe('x', -1, pScale, negLobeMat));
          } else if (spec.subType === 'py') {
            group.add(createLobe('y', 1, pScale, posLobeMat));
            group.add(createLobe('y', -1, pScale, negLobeMat));
          } else if (spec.subType === 'pz') {
            group.add(createLobe('z', 1, pScale, posLobeMat));
            group.add(createLobe('z', -1, pScale, negLobeMat));
          } else {
            // Whole p-subshell: render all 3 orthogonal dumbbell pairs
            group.add(createLobe('x', 1, pScale, posLobeMat));
            group.add(createLobe('x', -1, pScale, negLobeMat));
            group.add(createLobe('y', 1, pScale, posLobeMat));
            group.add(createLobe('y', -1, pScale, negLobeMat));
            group.add(createLobe('z', 1, pScale, posLobeMat));
            group.add(createLobe('z', -1, pScale, negLobeMat));
          }
        } else if (spec.type === 'd') {
          addDOrbital(spec.subType === 'd' ? 'dz2' : spec.subType, 3.6);
        } else if (spec.type === 'f') {
          addFOrbital(spec.subType === 'f' ? 'fxyz' : spec.subType, 4.2);
        }
      }
    }

    // SECTION 2: Quantum Probability Cloud (|Ψ|² point mist) (when in 'cloud' or 'hybrid' view)
    if (orbitalViewType === 'cloud' || orbitalViewType === 'hybrid') {
      const targetCount = cloudDensity;
      const positions = new Float32Array(targetCount * 3);
      const colors = new Float32Array(targetCount * 3);

      const isAtomMode = selectedOrbitalFamily === 'atom';
      const spec = activeOrbitalSpec;

      // Exact quantum spherical sampling function for a subshell / orbital
      // Factorizes |Ψ(r, θ, φ)|² into P(r) = 4*pi*r²*|R_nl(r)|² and angular |Y_lm(θ, φ)|²
      const generateOrbitalPoint = (
        n: number,
        l: number,
        subType: string
      ): { x: number; y: number; z: number; psi: number } => {
        const Rmax = Math.max(7.0, n * 3.4 + 2.0);

        // Pre-calibrate radial peak prMax = max(4*pi*r^2*|R_nl|^2)
        let prMax = 1e-4;
        for (let s = 1; s <= 30; s++) {
          const testR = (s / 30) * Rmax;
          const Rnl = evaluateRadialWavefunction(n, l, testR);
          const pr = 4 * Math.PI * testR * testR * Rnl * Rnl;
          if (pr > prMax) prMax = pr;
        }
        prMax *= 1.05;

        // Loop until a valid (x, y, z) sample is accepted
        while (true) {
          // 1. Radial acceptance sampling P(r) dr
          let r = 0;
          for (let iterR = 0; iterR < 25; iterR++) {
            const candR = Math.random() * Rmax;
            const Rnl = evaluateRadialWavefunction(n, l, candR);
            const pr = 4 * Math.PI * candR * candR * Rnl * Rnl;
            if (Math.random() * prMax < pr) {
              r = candR;
              break;
            }
          }
          if (r === 0) r = Math.random() * Rmax * 0.5;

          // 2. Uniform random point on unit sphere
          const uz = Math.random() * 2 - 1;
          const phi = Math.random() * 2 * Math.PI;
          const rho = Math.sqrt(Math.max(0, 1 - uz * uz));
          const ux = rho * Math.cos(phi);
          const uy = rho * Math.sin(phi);

          // 3. Angular factor acceptance
          let angAccepted = false;
          if (l === 0) {
            // s orbital is purely spherical
            angAccepted = true;
          } else if (l === 1) {
            if (subType === 'px') angAccepted = Math.random() < ux * ux;
            else if (subType === 'py') angAccepted = Math.random() < uy * uy;
            else if (subType === 'pz') angAccepted = Math.random() < uz * uz;
            else angAccepted = true; // full p subshell (Unsöld's theorem)
          } else if (l === 2) {
            if (subType === 'dxy') angAccepted = Math.random() < 4 * ux * ux * uy * uy;
            else if (subType === 'dyz') angAccepted = Math.random() < 4 * uy * uy * uz * uz;
            else if (subType === 'dxz') angAccepted = Math.random() < 4 * ux * ux * uz * uz;
            else if (subType === 'dx2-y2') angAccepted = Math.random() < Math.pow(ux * ux - uy * uy, 2);
            else if (subType === 'dz2') angAccepted = Math.random() < Math.pow(2 * uz * uz - ux * ux - uy * uy, 2) / 4;
            else angAccepted = true; // full d subshell (Unsöld's theorem)
          } else {
            angAccepted = true; // f orbital
          }

          if (!angAccepted) continue;

          const px = r * ux;
          const py = r * uy;
          const pz = r * uz;

          // Cross-section slice option: cut z > 0
          if (sliceCrossSection && pz > 0.0) continue;

          // Evaluate exact wavefunction value for phase color (+Ψ cyan / -Ψ magenta)
          const ev = evaluateOrbitalWavefunction(
            n,
            l,
            subType === 'p' ? 'pz' : subType === 'd' ? 'dz2' : subType === 'f' ? 'fxyz' : subType,
            px,
            py,
            pz
          );

          return { x: px, y: py, z: pz, psi: ev.psi };
        }
      };

      let accepted = 0;

      if (isAtomMode && aufbauConfig.length > 0 && electrons > 0) {
        // Distribute targetCount among occupied subshells proportional to electron count
        const totalE = electrons;
        let pointsAssigned = 0;

        aufbauConfig.forEach((sub, sIdx) => {
          if (sub.electronCount <= 0) return;
          const isLast = sIdx === aufbauConfig.length - 1;
          const subCount = isLast
            ? targetCount - pointsAssigned
            : Math.round((sub.electronCount / totalE) * targetCount);
          pointsAssigned += subCount;

          for (let p = 0; p < subCount && accepted < targetCount; p++) {
            let choiceType: string = sub.type;
            if (sub.type === 'p') {
              const pChoices = ['px', 'py', 'pz'];
              choiceType = pChoices[Math.floor(Math.random() * pChoices.length)];
            } else if (sub.type === 'd') {
              const dChoices = ['dxy', 'dyz', 'dxz', 'dx2-y2', 'dz2'];
              choiceType = dChoices[Math.floor(Math.random() * dChoices.length)];
            } else if (sub.type === 'f') {
              const fChoices = ['fxyz', 'fz3', 'fxz2', 'fyz2', 'fz(x2-y2)', 'fx(x2-3y2)', 'fy(3x2-y2)'];
              choiceType = fChoices[Math.floor(Math.random() * fChoices.length)];
            }

            const pt = generateOrbitalPoint(sub.n, sub.l, choiceType);
            positions[accepted * 3] = pt.x;
            positions[accepted * 3 + 1] = pt.y;
            positions[accepted * 3 + 2] = pt.z;

            if (pt.psi >= 0) {
              colors[accepted * 3] = 0.0;     // Radiant Neon Cyan
              colors[accepted * 3 + 1] = 0.96;
              colors[accepted * 3 + 2] = 1.0;
            } else {
              colors[accepted * 3] = 1.0;     // Glowing Neon Magenta / Rose
              colors[accepted * 3 + 1] = 0.04;
              colors[accepted * 3 + 2] = 0.54;
            }
            accepted++;
          }
        });
      } else {
        // Single subshell or specific orbital selected
        while (accepted < targetCount) {
          let choiceType: string = spec.subType;
          if (spec.subType === 'p') {
            const pChoices = ['px', 'py', 'pz'];
            choiceType = pChoices[Math.floor(Math.random() * pChoices.length)];
          } else if (spec.subType === 'd') {
            const dChoices = ['dxy', 'dyz', 'dxz', 'dx2-y2', 'dz2'];
            choiceType = dChoices[Math.floor(Math.random() * dChoices.length)];
          } else if (spec.subType === 'f') {
            const fChoices = ['fxyz', 'fz3', 'fxz2', 'fyz2', 'fz(x2-y2)', 'fx(x2-3y2)', 'fy(3x2-y2)'];
            choiceType = fChoices[Math.floor(Math.random() * fChoices.length)];
          }

          const pt = generateOrbitalPoint(spec.n, spec.l, choiceType);
          positions[accepted * 3] = pt.x;
          positions[accepted * 3 + 1] = pt.y;
          positions[accepted * 3 + 2] = pt.z;

          if (pt.psi >= 0) {
            colors[accepted * 3] = 0.0;     // Radiant Neon Cyan
            colors[accepted * 3 + 1] = 0.96;
            colors[accepted * 3 + 2] = 1.0;
          } else {
            colors[accepted * 3] = 1.0;     // Glowing Neon Magenta / Rose
            colors[accepted * 3 + 1] = 0.04;
            colors[accepted * 3 + 2] = 0.54;
          }
          accepted++;
        }
      }

      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      dotGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Scaling particle size based on density for optimal visual volumetric radiance
      const densityScale = Math.sqrt(6000 / Math.max(1000, targetCount));
      const baseSize = (orbitalViewType === 'hybrid' ? 0.16 : 0.23) * densityScale;

      const pointSize =
        glowLevel === 'hyper'
          ? baseSize * 1.35
          : glowLevel === 'vibrant'
          ? baseSize * 1.08
          : baseSize * 0.88;

      const pointOpacity =
        glowLevel === 'hyper' ? 0.98 : glowLevel === 'vibrant' ? 0.94 : 0.86;

      const dotMat = new THREE.PointsMaterial({
        size: pointSize,
        map: getCloudParticleTexture(),
        vertexColors: true,
        transparent: true,
        opacity: pointOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const points = new THREE.Points(dotGeo, dotMat);
      group.add(points);
    }

    // SECTION 3: Reference Spatial Axes & Nodal Planes
    const axes = new THREE.AxesHelper(6.0);
    axes.renderOrder = 1;
    group.add(axes);

    if (showNodalPlanes) {
      const planeGeo = new THREE.PlaneGeometry(12, 12);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const xyPlane = new THREE.Mesh(planeGeo, planeMat);
      group.add(xyPlane);
      const xzPlane = new THREE.Mesh(planeGeo, planeMat);
      xzPlane.rotation.x = Math.PI / 2;
      group.add(xzPlane);
      const yzPlane = new THREE.Mesh(planeGeo, planeMat);
      yzPlane.rotation.y = Math.PI / 2;
      group.add(yzPlane);
    }
  }, [
    modelMode,
    orbitalViewType,
    selectedOrbitalFamily,
    selectedOrbital,
    sliceCrossSection,
    cloudDensity,
    glowLevel,
    showNodalPlanes,
    orbitalScope,
    electrons,
    aufbauConfig,
    activeOrbitalSpec,
  ]);

  // Photon emission trigger
  const emitPhotonTransition = (fromShell: number, toShell: number) => {
    soundFx.playPhotonEmission(600 + (fromShell - toShell) * 150);

    // Calculate Rydberg Balmer series transition wavelength
    // 1/λ = R_H * (1/n1² - 1/n2²)
    const R_H = 1.097373e7; // m^-1
    const n1 = Math.min(fromShell, toShell);
    const n2 = Math.max(fromShell, toShell);
    const invLambda = R_H * (1 / (n1 * n1) - 1 / (n2 * n2));
    const wavelengthMeters = 1 / invLambda;
    const wavelengthNm = Math.round(wavelengthMeters * 1e9);

    let photonColor = '#38bdf8';
    let photonName = 'Visible Cyan (H-beta)';
    if (wavelengthNm > 620 && wavelengthNm < 750) {
      photonColor = '#ef4444';
      photonName = 'Balmer H-alpha (Red 656 nm)';
    } else if (wavelengthNm > 470 && wavelengthNm <= 500) {
      photonColor = '#06b6d4';
      photonName = 'Balmer H-beta (Cyan 486 nm)';
    } else if (wavelengthNm > 420 && wavelengthNm <= 450) {
      photonColor = '#3b82f6';
      photonName = 'Balmer H-gamma (Blue 434 nm)';
    } else if (wavelengthNm < 400) {
      photonColor = '#a855f7';
      photonName = 'Lyman UV Series';
    } else {
      photonColor = '#fbbf24';
      photonName = 'Paschen Infrared Series';
    }

    setLastEmittedPhoton({
      from: fromShell,
      to: toShell,
      wavelengthNm,
      color: photonColor,
      name: photonName,
    });

    // Spawn 3D photon wave packet particle in scene
    if (photonsGroupRef.current) {
      const pGroup = new THREE.Group();
      const pGeo = new THREE.SphereGeometry(0.22, 12, 12);
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(photonColor) });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pGroup.add(pMesh);

      // Trailing rings
      for (let r = 0; r < 3; r++) {
        const waveGeo = new THREE.RingGeometry(0.15 + r * 0.12, 0.2 + r * 0.12, 16);
        const waveMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(photonColor),
          transparent: true,
          opacity: 0.6 - r * 0.18,
          side: THREE.DoubleSide,
        });
        const waveMesh = new THREE.Mesh(waveGeo, waveMat);
        waveMesh.position.z = -r * 0.3;
        pGroup.add(waveMesh);
      }

      // Random exit direction vector
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      pGroup.position.copy(dir.clone().multiplyScalar(2.0));
      pGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

      photonsGroupRef.current.add(pGroup);
      activePhotonsRef.current.push({
        mesh: pGroup,
        life: 1.0,
        velocity: dir,
      });
    }
  };

  const handleSelectPreloadElement = (el: ElementData) => {
    setSelectedElement(el);
    setProtons(el.atomicNumber);
    setNeutrons(Math.round(el.atomicMass) - el.atomicNumber);
    setElectrons(el.atomicNumber);
    soundFx.playReactionStep();
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 8, 22);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-slate-950 text-slate-100">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="relative flex-1 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing outline-none" />

        {/* Minimal Spec Badge (Top-Left) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm pointer-events-auto">
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-3 shadow-xl flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold text-white shadow-md border"
              style={{
                backgroundColor: matchedElement.cpkColor === '#FFFFFF' ? '#475569' : matchedElement.cpkColor,
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <span className="text-[10px] leading-none opacity-80">{matchedElement.atomicNumber}</span>
              <span className="text-xl leading-none font-black">{matchedElement.symbol}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white truncate">{matchedElement.name}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                    netCharge === 0
                      ? 'bg-slate-800 text-slate-300'
                      : netCharge > 0
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {netCharge === 0 ? 'Neutral Atom' : `${Math.abs(netCharge)}${netCharge > 0 ? '+' : '−'} Ion`}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Mass: {massNumber} u • {matchedElement.electronConfiguration}
              </p>
            </div>
          </div>

          {/* Quick-try element chips & full 118-element selector */}
          <div className="flex flex-wrap items-center gap-1.5 backdrop-blur-md bg-slate-900/70 border border-slate-800/80 rounded-xl p-1.5 shadow-md">
            {[1, 2, 6, 7, 8, 11, 17, 26, 79, 92, 118].map((z) => {
              const el = getElement(z);
              if (!el) return null;
              const isSelected = protons === el.atomicNumber;
              return (
                <button
                  key={el.symbol}
                  onClick={() => handleSelectPreloadElement(el)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-sky-500 text-white font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`${el.name} (Z=${el.atomicNumber})`}
                >
                  {el.symbol}
                </button>
              );
            })}
            <select
              value={protons}
              onChange={(e) => {
                const el = getElement(Number(e.target.value));
                if (el) handleSelectPreloadElement(el);
              }}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 max-w-[130px] cursor-pointer"
              title="Select any of the 118 elements"
            >
              {ELEMENTS.map((el) => (
                <option key={el.atomicNumber} value={el.atomicNumber}>
                  {el.atomicNumber}. {el.symbol} - {el.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Floating Top-Center Quantum State HUD Pill */}
        {modelMode === 'orbitals' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
            <div className="backdrop-blur-xl bg-slate-900/90 border border-cyan-500/40 rounded-full px-3.5 py-1.5 shadow-xl flex items-center gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-300">{activeOrbitalSpec.label}</span>
              </div>
              <div className="h-3 w-px bg-slate-700" />
              <div className="flex items-center gap-2.5 text-slate-300">
                <span className="flex items-center gap-1" title={`Principal Quantum Number n = ${activeOrbitalSpec.n} (${activeNLevelInfo ? `${activeNLevelInfo.electronCount}e⁻ in ${matchedElement.symbol}` : 'Virtual unoccupied'})`}>
                  <span className="text-slate-400 text-[10px]">n:</span>
                  <span className="text-cyan-300 font-bold">{activeOrbitalSpec.n}</span>
                  <span className="text-[10px] text-cyan-400/90 font-mono">
                    ({activeNLevelInfo ? `${activeNLevelInfo.electronCount}e⁻` : '0e⁻'})
                  </span>
                </span>
                <span className="flex items-center gap-1" title={`Azimuthal Quantum Number l = ${activeOrbitalSpec.l} (${activeOrbitalSpec.type}-subshell)`}>
                  <span className="text-slate-400 text-[10px]">l:</span>
                  <span className="text-sky-300 font-bold">{activeOrbitalSpec.l} ({activeOrbitalSpec.type})</span>
                </span>
                <span className="flex items-center gap-1" title={`Magnetic Quantum Number ml = ${activeOrbitalSpec.ml}`}>
                  <span className="text-slate-400 text-[10px]">mₗ:</span>
                  <span className="text-amber-300 font-bold">{activeOrbitalSpec.ml > 0 ? `+${activeOrbitalSpec.ml}` : activeOrbitalSpec.ml}</span>
                </span>
                <span className="hidden md:flex items-center gap-1" title={`Spin Projection ms = ${currentOrbitalSpin.ms}`}>
                  <span className="text-slate-400 text-[10px]">mₛ:</span>
                  <span className="text-emerald-300 font-bold">{currentOrbitalSpin.ms} ({currentOrbitalSpin.symbol})</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Model Mode Switcher & Quantum Orbital HUD */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2.5 pointer-events-auto">
          {/* Main Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-xl">
            <button
              onClick={() => {
                setModelMode('bohr');
                soundFx.playReactionStep();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                modelMode === 'bohr'
                  ? 'bg-sky-500 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Atom className="w-3.5 h-3.5" />
              Bohr Model
            </button>
            <button
              onClick={() => {
                setModelMode('orbitals');
                soundFx.playReactionStep();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                modelMode === 'orbitals'
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold shadow-md ring-1 ring-sky-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              Quantum Orbital Mode
            </button>
          </div>

          {/* If Bohr mode: Photon Emission Quick Trigger */}
          {modelMode === 'bohr' && (
            <div className="flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl text-right max-w-xs shadow-md">
              <span className="text-[11px] font-medium text-slate-400 flex items-center justify-end gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Quantum Energy Transitions:
              </span>
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => emitPhotonTransition(3, 2)}
                  className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-[11px] font-mono transition-all"
                  title="n=3 to n=2: Balmer H-alpha (656 nm Red)"
                >
                  n=3 ⟶ n=2 (656nm)
                </button>
                <button
                  onClick={() => emitPhotonTransition(4, 2)}
                  className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 text-[11px] font-mono transition-all"
                  title="n=4 to n=2: Balmer H-beta (486 nm Cyan)"
                >
                  n=4 ⟶ n=2 (486nm)
                </button>
                <button
                  onClick={() => emitPhotonTransition(5, 2)}
                  className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 text-[11px] font-mono transition-all"
                  title="n=5 to n=2: Balmer H-gamma (434 nm Blue)"
                >
                  n=5 ⟶ n=2
                </button>
              </div>

              {lastEmittedPhoton && (
                <div className="text-[11px] font-mono text-slate-300 flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lastEmittedPhoton.color }} />
                  <span>Emitted: {lastEmittedPhoton.name} ({lastEmittedPhoton.wavelengthNm} nm)</span>
                </div>
              )}
            </div>
          )}

          {/* Quantum Orbital & Electron Cloud Density HUD */}
          {modelMode === 'orbitals' && (
            <div className="flex flex-col gap-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 p-3.5 rounded-2xl w-84 sm:w-96 shadow-2xl text-left max-h-[calc(100vh-140px)] overflow-y-auto">
              {/* Header with orbital name and cartesian formula */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    {activeOrbitalSpec.name}
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono mt-0.5">
                    {activeOrbitalSpec.cartesianFormula}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                  {selectedOrbitalFamily === 'atom' ? `${electrons} e⁻` : activeOrbitalSpec.label}
                </span>
              </div>

              {/* View Style Toolbar: Cloud vs Surface vs Hybrid */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-medium">Visualization Style:</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => {
                      setOrbitalViewType('cloud');
                      soundFx.playReactionStep();
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[11px] font-medium transition-all text-center ${
                      orbitalViewType === 'cloud'
                        ? 'bg-cyan-500 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Render electron probability density cloud as particle probability mist (|Ψ|²)"
                  >
                    Cloud (|Ψ|²)
                  </button>
                  <button
                    onClick={() => {
                      setOrbitalViewType('surface');
                      soundFx.playReactionStep();
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[11px] font-medium transition-all text-center ${
                      orbitalViewType === 'surface'
                        ? 'bg-cyan-500 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Render 90% probability boundary isosurface lobes"
                  >
                    Boundary Lobes
                  </button>
                  <button
                    onClick={() => {
                      setOrbitalViewType('hybrid');
                      soundFx.playReactionStep();
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[11px] font-medium transition-all text-center ${
                      orbitalViewType === 'hybrid'
                        ? 'bg-cyan-500 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Render probability cloud glowing inside translucent boundary envelope"
                  >
                    Hybrid View
                  </button>
                </div>
              </div>

              {/* Cloud Density & Glow Radiance Controls */}
              <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px]">
                {/* Cloud Density Selector */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      Density:
                    </span>
                    <span className="text-[10px] font-mono font-bold text-cyan-300">
                      {cloudDensity.toLocaleString()} pts
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { val: 3000, label: '3k' },
                      { val: 6000, label: '6k' },
                      { val: 9000, label: '9k' },
                      { val: 12000, label: '12k' },
                    ].map((d) => (
                      <button
                        key={d.val}
                        onClick={() => {
                          setCloudDensity(d.val);
                          if (orbitalViewType === 'surface') setOrbitalViewType('cloud');
                          soundFx.playReactionStep();
                        }}
                        className={`py-1 px-1 rounded-lg text-[10px] font-mono transition-all text-center ${
                          cloudDensity === d.val
                            ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={`Sample exactly ${d.val.toLocaleString()} probability density points`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {/* Density slider for fine adjustments */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <input
                      type="range"
                      min={2000}
                      max={15000}
                      step={1000}
                      value={cloudDensity}
                      onChange={(e) => {
                        setCloudDensity(Number(e.target.value));
                        if (orbitalViewType === 'surface') setOrbitalViewType('cloud');
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                      title="Adjust electron cloud density from 2,000 to 15,000 points"
                    />
                  </div>
                </div>

                {/* Glow Intensity Selector */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    Glow Radiance:
                  </span>
                  <div className="flex flex-col gap-1">
                    {[
                      { id: 'normal', label: 'Soft Glow' },
                      { id: 'vibrant', label: 'Vibrant Neon' },
                      { id: 'hyper', label: 'Hyper-Luminous' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setGlowLevel(g.id as any);
                          soundFx.playReactionStep();
                        }}
                        className={`py-0.5 px-2 rounded-lg text-[10px] font-medium transition-all text-left ${
                          glowLevel === g.id
                            ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Quantum Subshell Type Tabs according to Aufbau Electronic Configuration */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                    <Atom className="w-3 h-3 text-cyan-400" />
                    Subshell Family ({formattedConfig}):
                  </span>
                  <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={showVirtualOrbitals}
                      onChange={(e) => setShowVirtualOrbitals(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 w-2.5 h-2.5"
                    />
                    <span>Virtual Orbitals</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-mono font-medium">
                  {/* Tab 1: Atom Total Cloud */}
                  <button
                    onClick={() => {
                      setSelectedOrbitalFamily('atom');
                      setSelectedOrbital('all');
                      soundFx.playReactionStep();
                    }}
                    className={`px-2 py-1 rounded-lg transition-all text-xs ${
                      selectedOrbitalFamily === 'atom'
                        ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    Atom Total ({electrons} e⁻)
                  </button>

                  {/* Dynamic subshell type tabs matching atom's occupied configuration */}
                  {(showVirtualOrbitals
                    ? (['s', 'p', 'd', 'f'] as const)
                    : electronConfigAnalysis.occupiedTypes
                  ).map((fam) => {
                    const eCount = electronConfigAnalysis.counts[fam];
                    const isOccupied = eCount > 0;
                    const isSel = selectedOrbitalFamily === fam;

                    return (
                      <button
                        key={fam}
                        onClick={() => {
                          setSelectedOrbitalFamily(fam);
                          // Select first occupied subshell or orbital of this family
                          const occSub = electronConfigAnalysis.occupiedSubshellsByType[fam][0];
                          if (occSub) {
                            setSelectedOrbital(occSub.name);
                          } else {
                            const firstInLib = QUANTUM_ORBITAL_LIBRARY.find((o) => o.type === fam);
                            if (firstInLib) setSelectedOrbital(firstInLib.id);
                          }
                          soundFx.playReactionStep();
                        }}
                        className={`px-2 py-1 rounded-lg transition-all text-xs flex items-center gap-1 ${
                          isSel
                            ? 'bg-sky-500 text-white font-bold shadow-sm ring-1 ring-sky-300'
                            : isOccupied
                            ? 'text-slate-300 hover:text-white hover:bg-slate-900'
                            : 'text-slate-500 hover:text-slate-300 opacity-60'
                        }`}
                      >
                        <span>{fam}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded ${isSel ? 'bg-sky-600 text-white' : 'bg-slate-800 text-sky-300'}`}>
                          {isOccupied ? `${eCount}e⁻` : '0e⁻ (v)'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subshell Wavefunction & Individual Orbital Selection Pills */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-medium">
                  {selectedOrbitalFamily === 'atom'
                    ? 'Occupied Subshells & Superposition:'
                    : `Active ${selectedOrbitalFamily.toUpperCase()}-State Orbitals:`}
                </span>

                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                  {selectedOrbitalFamily === 'atom' ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedOrbital('all');
                          soundFx.playReactionStep();
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                          selectedOrbital === 'all'
                            ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        All Occupied Superposition ({electrons} e⁻)
                      </button>
                      {aufbauConfig.map((sub) => {
                        const isSel = selectedOrbital === sub.name;
                        return (
                          <button
                            key={sub.name}
                            onClick={() => {
                              setSelectedOrbital(sub.name);
                              soundFx.playReactionStep();
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                              isSel
                                ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                            title={`${sub.name} subshell: ${sub.electronCount}/${sub.capacity} electrons`}
                          >
                            {sub.name}
                            <sup className="text-[9px] font-bold text-sky-300 ml-0.5">{sub.electronCount}</sup>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {/* Subshell Cloud pill if occupied subshell exists */}
                      {electronConfigAnalysis.occupiedSubshellsByType[selectedOrbitalFamily].map((sub) => {
                        const isSel = selectedOrbital === sub.name;
                        return (
                          <button
                            key={sub.name}
                            onClick={() => {
                              setSelectedOrbital(sub.name);
                              soundFx.playReactionStep();
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                              isSel
                                ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                            title={`Full ${sub.name} subshell cloud with ${sub.electronCount} electrons`}
                          >
                            {sub.name} Cloud
                            <sup className="text-[9px] font-bold text-sky-300 ml-0.5">{sub.electronCount}e⁻</sup>
                          </button>
                        );
                      })}

                      {/* Individual orbitals with Hund's rule spin state */}
                      {QUANTUM_ORBITAL_LIBRARY.filter((o) => o.type === selectedOrbitalFamily)
                        .filter((spec) => {
                          if (showVirtualOrbitals) return true;
                          // If virtual orbitals are hidden, only show orbitals whose subshell is occupied
                          return electronConfigAnalysis.occupiedSubshellsByType[selectedOrbitalFamily].some(
                            (s) => s.n === spec.n
                          );
                        })
                        .map((spec) => {
                          const isSel = selectedOrbital === spec.id;
                          // Check Hund's rule occupancy for this orbital in current atom
                          const parentSub = aufbauConfig.find((s) => s.n === spec.n && s.type === spec.type);
                          let spinBadge = '';
                          if (parentSub) {
                            const orbMatch = parentSub.orbitals.find(
                              (o) => o.subLabel.toLowerCase() === spec.subType.toLowerCase() || spec.id.includes(o.subLabel)
                            );
                            if (orbMatch) {
                              spinBadge = orbMatch.spinUp && orbMatch.spinDown ? '↑↓ 2e⁻' : orbMatch.spinUp ? '↑ 1e⁻' : 'empty';
                            }
                          }

                          return (
                            <button
                              key={spec.id}
                              onClick={() => {
                                setSelectedOrbital(spec.id);
                                soundFx.playReactionStep();
                              }}
                              className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 ${
                                isSel
                                  ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                              title={spec.description}
                            >
                              <span>{spec.label}</span>
                              {spinBadge && (
                                <span className={`text-[9px] px-1 py-0.2 rounded ${isSel ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-amber-300'}`}>
                                  {spinBadge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </>
                  )}
                </div>
              </div>

              {/* Exploration Controls: Slice Cross-section, Nodal Planes, Radial Graph */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800 text-[11px] text-slate-300">
                <button
                  onClick={() => {
                    setSliceCrossSection(!sliceCrossSection);
                    soundFx.playReactionStep();
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1 transition-all ${
                    sliceCrossSection
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Cuts open z > 0 to look directly into the internal concentric radial nodal shells"
                >
                  <Scissors className="w-3 h-3 text-amber-400" />
                  <span>Cross-Section Slice</span>
                </button>

                <button
                  onClick={() => {
                    setShowNodalPlanes(!showNodalPlanes);
                    soundFx.playReactionStep();
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1 transition-all ${
                    showNodalPlanes
                      ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Shows coordinate planes where wavefunction Psi = 0"
                >
                  <Box className="w-3 h-3 text-sky-400" />
                  <span>Nodal Planes</span>
                </button>

                <button
                  onClick={() => {
                    setShowRadialGraph(!showRadialGraph);
                    soundFx.playReactionStep();
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1 transition-all ${
                    showRadialGraph
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Toggle Radial Probability Density Chart P(r)"
                >
                  <BarChart2 className="w-3 h-3 text-cyan-400" />
                  <span>Radial Curve</span>
                </button>
              </div>

              {/* Radial Probability Curve P(r) = 4*pi*r^2*|R_nl|^2 */}
              {showRadialGraph && (
                <RadialProbabilityChart
                  n={activeOrbitalSpec.n}
                  l={activeOrbitalSpec.l}
                  orbitalName={activeOrbitalSpec.label}
                />
              )}

              {/* Comprehensive Interactive Quantum Numbers (n, l, m) HUD */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-950/85 rounded-2xl border border-slate-800/90 text-slate-200">
                {/* Header with Active State Formula & Quantum Rules Toggle */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Hash className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Quantum Numbers HUD</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Ψ_{'{'}{activeOrbitalSpec.n},{activeOrbitalSpec.l},{activeOrbitalSpec.ml}{'}'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowQuantumRules(!showQuantumRules)}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
                    title="Toggle quantum mechanics rules & definitions"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>{showQuantumRules ? 'Hide Rules' : 'Quantum Rules'}</span>
                  </button>
                </div>

                {/* 4 Interactive Quantum Number Cards Grid: n, l, m_l, m_s */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Card 1: Principal Quantum Number n */}
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Principal (n)</span>
                        <span className="text-[9px] text-cyan-400 font-mono font-medium">
                          {SHELL_NAMES[Math.min(activeOrbitalSpec.n - 1, SHELL_NAMES.length - 1)]}-Shell (P{matchedElement.period})
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black font-mono text-cyan-300">n = {activeOrbitalSpec.n}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({(-13.6 / (activeOrbitalSpec.n * activeOrbitalSpec.n)).toFixed(2)} eV)
                        </span>
                        {activeNLevelInfo && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ml-auto ${
                              activeNLevelInfo.isValence
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {activeNLevelInfo.isValence ? 'Valence' : 'Core'}
                          </span>
                        )}
                      </div>

                      {/* Atom-specific occupancy & capacity */}
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">
                          {matchedElement.symbol} Occupancy:
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          {activeNLevelInfo ? activeNLevelInfo.electronCount : 0} / {2 * activeOrbitalSpec.n * activeOrbitalSpec.n} e⁻
                        </span>
                      </div>

                      {/* Subshells in this shell */}
                      {activeNLevelInfo && activeNLevelInfo.subshells.length > 0 && (
                        <div className="text-[9px] text-slate-400 mt-0.5 truncate font-mono">
                          Subshells: {activeNLevelInfo.subshells.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Interactive n Selector according to atom */}
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-slate-400 font-medium">Atom Shells:</span>
                        <span className="text-[8px] text-slate-500 font-mono">Max n = {electronConfigAnalysis.maxOccupiedN}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {availableNLevels.map((lvl) => {
                          const isSel = activeOrbitalSpec.n === lvl.n;
                          const isOccupied = lvl.electronCount > 0;
                          return (
                            <button
                              key={lvl.n}
                              onClick={() => handleSelectN(lvl.n)}
                              className={`flex-1 min-w-[28px] py-1 px-1 rounded flex flex-col items-center justify-center transition-all ${
                                isSel
                                  ? 'bg-cyan-500 text-white shadow-sm ring-1 ring-cyan-300 font-bold'
                                  : isOccupied
                                  ? 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                                  : 'bg-slate-900/60 text-slate-500 hover:text-slate-400 border border-dashed border-slate-800'
                              }`}
                              title={`Shell n=${lvl.n} (${lvl.shellLetter}): ${lvl.electronCount}/${lvl.capacity} e⁻ ${lvl.isValence ? '[Valence Shell]' : lvl.electronCount > 0 ? '[Core Shell]' : '[Virtual Shell]'}`}
                            >
                              <span className="text-[10px] font-mono leading-none">n={lvl.n}</span>
                              <span
                                className={`text-[8px] font-mono leading-none mt-0.5 ${
                                  isSel
                                    ? 'text-cyan-100 font-semibold'
                                    : lvl.isValence
                                    ? 'text-amber-400 font-semibold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {isOccupied ? `${lvl.electronCount}e⁻` : '0e⁻(v)'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Azimuthal Quantum Number l */}
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Azimuthal (l)</span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          0 ≤ l ≤ {activeOrbitalSpec.n - 1}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black font-mono text-sky-300">
                          l = {activeOrbitalSpec.l}
                        </span>
                        <span className="text-xs font-bold text-sky-400 uppercase">
                          ({activeOrbitalSpec.type})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Shape • |L| = {activeOrbitalSpec.l === 0 ? '0' : activeOrbitalSpec.l === 1 ? '√2ħ' : activeOrbitalSpec.l === 2 ? '√6ħ' : '√12ħ'}
                      </p>
                    </div>

                    {/* Interactive l Selector */}
                    <div className="flex items-center gap-1 mt-2 pt-1 border-t border-slate-800/80">
                      <span className="text-[9px] text-slate-500">Type:</span>
                      {(['s', 'p', 'd', 'f'] as const).slice(0, Math.min(4, activeOrbitalSpec.n)).map((fam, famL) => (
                        <button
                          key={fam}
                          onClick={() => handleSelectL(famL)}
                          className={`flex-1 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                            activeOrbitalSpec.l === famL
                              ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-300'
                              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {fam}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card 3: Magnetic Quantum Number m_l */}
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Magnetic (mₗ)</span>
                        <span className="text-[9px] text-amber-400 font-mono">
                          {2 * activeOrbitalSpec.l + 1} states
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black font-mono text-amber-300">
                          mₗ = {activeOrbitalSpec.ml > 0 ? `+${activeOrbitalSpec.ml}` : activeOrbitalSpec.ml}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({activeOrbitalSpec.subType})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Spatial orientation (L_z = {activeOrbitalSpec.ml}ħ)
                      </p>
                    </div>

                    {/* Interactive m_l Pills */}
                    <div className="flex flex-wrap items-center gap-1 mt-2 pt-1 border-t border-slate-800/80">
                      {allowedMlList.map((mItem) => (
                        <button
                          key={mItem.ml}
                          onClick={() => handleSelectMl(mItem.ml)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                            activeOrbitalSpec.ml === mItem.ml
                              ? 'bg-amber-500 text-slate-950 shadow-sm ring-1 ring-amber-300'
                              : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                          title={`Select mₗ = ${mItem.ml > 0 ? `+${mItem.ml}` : mItem.ml} orientation`}
                        >
                          {mItem.ml > 0 ? `+${mItem.ml}` : mItem.ml}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card 4: Spin Quantum Number m_s & Hund's Rule Occupancy */}
                  <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Spin (mₛ)</span>
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {matchedElement.symbol}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black font-mono text-emerald-300">
                          mₛ = {currentOrbitalSpin.ms}
                        </span>
                        <span className="text-sm font-bold text-amber-300 ml-1">
                          {currentOrbitalSpin.symbol}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {currentOrbitalSpin.spin}
                      </p>
                    </div>

                    {/* Spin Projection indicator */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-800/80 font-mono">
                      <span>S_z = ±½ħ</span>
                      <span className="text-emerald-300 font-bold">{currentOrbitalSpin.count} / 2 e⁻</span>
                    </div>
                  </div>
                </div>

                {/* Wavefunction Nodal & Quantization Info Footer */}
                <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-900/60 rounded-xl border border-slate-800/60 text-[10px] font-mono text-center">
                  <div>
                    <span className="text-slate-400 block text-[9px]">Radial Nodes:</span>
                    <span className="text-amber-300 font-bold">
                      {activeOrbitalSpec.radialNodes} <span className="text-[9px] text-slate-500 font-normal">(n-l-1)</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">Angular Nodes:</span>
                    <span className="text-sky-300 font-bold">
                      {activeOrbitalSpec.angularNodes} <span className="text-[9px] text-slate-500 font-normal">(l)</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">Total Nodes:</span>
                    <span className="text-cyan-300 font-bold">
                      {activeOrbitalSpec.n - 1} <span className="text-[9px] text-slate-500 font-normal">(n-1)</span>
                    </span>
                  </div>
                </div>

                {/* Collapsible Quantum Mechanics Cheat-Sheet */}
                {showQuantumRules && (
                  <div className="flex flex-col gap-1.5 p-2.5 bg-slate-900/90 rounded-xl border border-sky-500/30 text-[11px] text-slate-300 font-sans animate-in fade-in duration-200">
                    <span className="font-bold text-white flex items-center gap-1.5 text-xs text-sky-300">
                      <BookOpen className="w-3.5 h-3.5" />
                      Fundamental Quantum Mechanical Postulates:
                    </span>
                    <ul className="flex flex-col gap-1 text-[10px] text-slate-300 leading-normal">
                      <li>
                        <strong className="text-cyan-300">1. Principal (n ≥ 1):</strong> Dictates radial distance from nucleus and energy eigenvalue E_n = -13.6/n² eV.
                      </li>
                      <li>
                        <strong className="text-sky-300">2. Azimuthal (0 ≤ l &lt; n):</strong> Dictates angular momentum magnitude |L| = √(l(l+1))ħ and 3D nodal boundary geometry.
                      </li>
                      <li>
                        <strong className="text-amber-300">3. Magnetic (-l ≤ mₗ ≤ +l):</strong> Quantizes spatial orientation and z-axis angular momentum projection L_z = mₗħ (2l+1 degenerate states).
                      </li>
                      <li>
                        <strong className="text-emerald-300">4. Spin (mₛ = ±½):</strong> Intrinsic spin projection. Pauli exclusion enforces a maximum of 2 electrons per orbital with opposite spins (↑↓).
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Wave Phase legend */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block shadow-sm" />
                  +Ψ Positive Phase
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block shadow-sm" />
                  -Ψ Negative Phase
                </span>
                <span className="text-slate-400">Node: Ψ = 0</span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Viewport Controls (Right Middle) */}
        <div className="absolute right-2 sm:right-4 bottom-14 sm:bottom-24 z-10 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              soundFx.playReactionStep();
            }}
            className={`p-2.5 rounded-xl border shadow-lg transition-all flex items-center justify-center ${
              isPlaying
                ? 'bg-slate-900/85 hover:bg-slate-800 border-slate-800 text-sky-400'
                : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              const speeds = [0.25, 0.5, 1, 2, 4];
              const nextIdx = (speeds.indexOf(simSpeed) + 1) % speeds.length;
              setSimSpeed(speeds[nextIdx]);
              soundFx.playReactionStep();
            }}
            className="px-2 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all text-xs font-mono font-bold"
            title="Cycle Simulation Speed"
          >
            {simSpeed}x
          </button>
          <button
            onClick={resetCamera}
            className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all"
            title="Reset Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unified Bottom Control Dock (Follows Three.js Guidelines: zero mid-screen occlusion, collapsible) */}
      <div
        className={`absolute bottom-2 sm:bottom-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl transition-all duration-300 pointer-events-auto max-h-[calc(100dvh-4.5rem)] flex flex-col ${
          dockCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
        }`}
      >
        <div className="backdrop-blur-xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-4.5rem)]">
          {/* Collapse Bar */}
          <div
            onClick={() => setDockCollapsed(!dockCollapsed)}
            className="w-full shrink-0 py-1.5 px-3 sm:px-4 bg-slate-800/80 hover:bg-slate-800 border-b border-slate-800/80 flex items-center justify-between cursor-pointer text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">Atomic Workbench & Particle Synthesizer</span>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                [Z={protons} p⁺, N={neutrons} n⁰, {electrons} e⁻]
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-medium text-sky-300">
              <span>{dockCollapsed ? '▴ Expand Controls' : '▾ Collapse Controls'}</span>
            </div>
          </div>

          {/* Main Controls Area */}
          <div className="p-2.5 sm:p-3.5 flex flex-col gap-3 overflow-y-auto max-h-[calc(100dvh-7.5rem)] sm:max-h-[55dvh] scrollbar-thin scrollbar-thumb-slate-700">
            {/* Tab navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                <button
                  onClick={() => setActiveTab('builder')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'builder'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  Subatomic Particle Adjuster
                </button>
                <button
                  onClick={() => setActiveTab('quantum')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'quantum'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  Electron Shells & Orbitals
                </button>
                <button
                  onClick={() => setActiveTab('isotopes')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'isotopes'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  Nuclear Isotopes & Stability
                </button>
                <button
                  onClick={() => setActiveTab('properties')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'properties'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  Element Applications
                </button>
              </div>

              {/* Simulation speed multiplier & Play/Pause */}
              <div className="flex items-center gap-2.5 text-xs text-slate-400">
                <button
                  onClick={() => {
                    setIsPlaying(!isPlaying);
                    soundFx.playReactionStep();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium border transition-all ${
                    isPlaying
                      ? 'bg-slate-800 border-slate-700 text-sky-300 hover:bg-slate-700'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  }`}
                  title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
                >
                  {isPlaying ? <Pause className="w-3 h-3 text-sky-400" /> : <Play className="w-3 h-3 text-amber-400" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <span className="text-[11px]">Speed:</span>
                  {[0.25, 0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        setSimSpeed(spd);
                        soundFx.playReactionStep();
                      }}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                        simSpeed === spd
                          ? 'bg-sky-500/30 text-sky-200 border border-sky-500/40 font-bold'
                          : 'text-slate-400 hover:text-white bg-slate-800/60'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab 1: Particle Builder */}
            {activeTab === 'builder' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Protons Control */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm" />
                      Protons (p⁺)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{protons}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Defines Atomic Number (Z) & element identity</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newP = Math.max(1, protons - 1);
                        setProtons(newP);
                        soundFx.playReactionStep();
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min={1}
                      max={92}
                      value={protons}
                      onChange={(e) => setProtons(Number(e.target.value))}
                      className="flex-1 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        const newP = Math.min(92, protons + 1);
                        setProtons(newP);
                        soundFx.playReactionStep();
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Neutrons Control */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block shadow-sm" />
                      Neutrons (n⁰)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{neutrons}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Determines Isotope Mass Number (A = Z + N)</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setNeutrons(Math.max(0, neutrons - 1));
                        soundFx.playReactionStep();
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={146}
                      value={neutrons}
                      onChange={(e) => setNeutrons(Number(e.target.value))}
                      className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        setNeutrons(neutrons + 1);
                        soundFx.playReactionStep();
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Electrons Control */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm" />
                      Electrons (e⁻)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{electrons}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Sets Net Electric Charge & Chemical Reactivity</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setElectrons(Math.max(0, electrons - 1));
                        soundFx.playReactionStep();
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={92}
                      value={electrons}
                      onChange={(e) => setElectrons(Number(e.target.value))}
                      className="flex-1 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={() => {
                        setElectrons(electrons + 1);
                        soundFx.playReactionStep();
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Quantum Shells & Aufbau Orbital Diagram */}
            {activeTab === 'quantum' && (
              <div className="flex flex-col gap-2.5 text-xs">
                {/* Bohr Shell Distribution */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400">Bohr Shells:</span>
                  {currentShells.map((count, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1 text-xs font-mono"
                    >
                      <span className="text-slate-400">{SHELL_NAMES[idx]}:</span>
                      <span className="text-sky-300 font-bold">{count} e⁻</span>
                      {idx === currentShells.length - 1 && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded ml-0.5">Valence</span>
                      )}
                    </div>
                  ))}
                  <span className="ml-auto text-[11px] font-mono text-slate-400">
                    Configuration: <span className="text-sky-300 font-bold">{formattedConfig}</span>
                  </span>
                </div>

                {/* Aufbau Subshell Energy Filling & Hund's Rule Orbital Boxes */}
                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      Aufbau Energy Sequence & Hund's Rule Orbital Boxes:
                    </span>
                    <span className="text-slate-500 text-[10px]">Click any subshell to view 3D wavefunction</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-1">
                    {aufbauConfig.map((sub) => {
                      const isSelected = selectedOrbital === sub.name;
                      return (
                        <div
                          key={sub.name}
                          onClick={() => {
                            setModelMode('orbitals');
                            setSelectedOrbital(sub.name);
                            soundFx.playReactionStep();
                          }}
                          className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            isSelected && modelMode === 'orbitals'
                              ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow-sm'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                          title={`Click to view ${sub.name} orbital in 3D`}
                        >
                          <div className="flex items-center gap-1 text-[11px] font-mono font-bold">
                            <span>{sub.name}</span>
                            <span className="text-[10px] text-cyan-300 font-normal">
                              ({sub.electronCount}/{sub.capacity})
                            </span>
                          </div>

                          {/* Degenerate orbital boxes with spin arrows */}
                          <div className="flex gap-0.5">
                            {sub.orbitals.map((orb, i) => (
                              <div
                                key={i}
                                className={`w-5 h-6 rounded flex items-center justify-center font-mono text-xs border ${
                                  orb.electrons === 2
                                    ? 'bg-sky-950/70 border-sky-500/50 text-sky-300'
                                    : orb.electrons === 1
                                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                                    : 'bg-slate-950 border-slate-800 text-slate-600'
                                }`}
                                title={`${orb.name}: ${orb.electrons} electron(s)`}
                              >
                                {orb.electrons === 2 ? '⇅' : orb.electrons === 1 ? '↑' : '·'}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quantum Numbers & Wavefunction Nodal Breakdown */}
                {aufbauConfig.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-950/50 p-2 rounded-xl border border-slate-800/60 font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Valence Subshell:</span>
                      <span className="text-sky-300 font-bold">{aufbauConfig[aufbauConfig.length - 1].name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Quantum Numbers:</span>
                      <span className="text-slate-200">
                        n={aufbauConfig[aufbauConfig.length - 1].n}, l={aufbauConfig[aufbauConfig.length - 1].l}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Wavefunction Nodes:</span>
                      <span className="text-slate-200">
                        Radial: {aufbauConfig[aufbauConfig.length - 1].radialNodes} • Angular: {aufbauConfig[aufbauConfig.length - 1].angularNodes}
                      </span>
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => {
                          setModelMode('orbitals');
                          setSelectedOrbitalFamily('atom');
                          setSelectedOrbital('all');
                          setOrbitalViewType('cloud');
                          soundFx.playReactionStep();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 font-sans text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Launch 3D Probability Cloud</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* s, p, d, f Probability Cloud Quick-Launch Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    {
                      type: 's' as const,
                      title: 's-Orbitals (l=0)',
                      sub: 'Spherical Cloud • Radial Nodes',
                      color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300',
                      firstId: '1s',
                    },
                    {
                      type: 'p' as const,
                      title: 'p-Orbitals (l=1)',
                      sub: 'Dumbbell Lobes • 1 Planar Node',
                      color: 'border-sky-500/30 bg-sky-950/20 text-sky-300',
                      firstId: '2pz',
                    },
                    {
                      type: 'd' as const,
                      title: 'd-Orbitals (l=2)',
                      sub: 'Cloverleaf & Donut • 2 Nodal Planes',
                      color: 'border-indigo-500/30 bg-indigo-950/20 text-indigo-300',
                      firstId: '3dz2',
                    },
                    {
                      type: 'f' as const,
                      title: 'f-Orbitals (l=3)',
                      sub: '8-Lobe Octocube • 3 Nodal Planes',
                      color: 'border-purple-500/30 bg-purple-950/20 text-purple-300',
                      firstId: '4fxyz',
                    },
                  ].map((card) => {
                    const eCount = electronConfigAnalysis.counts[card.type];
                    const isOccupied = eCount > 0;

                    return (
                      <button
                        key={card.type}
                        onClick={() => {
                          setModelMode('orbitals');
                          setSelectedOrbitalFamily(card.type);
                          if (!isOccupied) setShowVirtualOrbitals(true);
                          const occSub = electronConfigAnalysis.occupiedSubshellsByType[card.type][0];
                          setSelectedOrbital(occSub ? occSub.name : card.firstId);
                          setOrbitalViewType('cloud');
                          soundFx.playReactionStep();
                        }}
                        className={`p-2 rounded-xl border flex flex-col text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          isOccupied ? card.color : 'border-slate-800 bg-slate-950/40 text-slate-400 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs font-mono">{card.title}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isOccupied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {isOccupied ? `${eCount} e⁻` : 'Unoccupied'}
                          </span>
                        </div>
                        <span className="text-[10px] opacity-80 mt-1">{card.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: Isotopes */}
            {activeTab === 'isotopes' && (
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">Current Isotope:</span>
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                      {matchedElement.symbol}-{massNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span className={nuclearStability.color}>{nuclearStability.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px] mb-1">Naturally Occurring Isotopes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedElement.stableIsotopes?.map((iso, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setNeutrons(iso.massNumber - matchedElement.atomicNumber);
                            soundFx.playReactionStep();
                          }}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
                        >
                          {matchedElement.symbol}-{iso.massNumber} ({iso.abundancePercent}%)
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300 block mb-0.5">Nuclear Physics Summary:</span>
                    Proton-to-Neutron ratio is {(neutrons / Math.max(protons, 1)).toFixed(2)}. The strong nuclear force between nucleons overcomes proton electrostatic repulsion.
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Real World Applications */}
            {activeTab === 'properties' && (
              <div className="flex flex-col gap-2 text-xs">
                <p className="text-slate-300 text-[12px] leading-relaxed">{matchedElement.summary}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-slate-400 text-[11px] font-medium mr-1">Everyday Uses:</span>
                  {matchedElement.realWorldUses.map((use, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-800/90 text-slate-200 text-[11px]">
                      • {use}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
