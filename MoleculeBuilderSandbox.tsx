import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls, setupStandardRenderer, setupSceneEnvironment, isSoftwareGl } from '../utils/three-setup';
import { MolecularAtom, MolecularBond } from '../types/chemistry';
import { getElement } from '../data/elements';
import { soundFx } from '../utils/audio';
import {
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Link,
  Sliders,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Wand2,
  Unlink,
  Layers,
  ArrowRight,
  Info,
  Zap,
  Compass,
  BookOpen,
} from 'lucide-react';
import { determineMoleculeIdentity, MoleculeIdentity } from '../utils/iupacNaming';

interface MoleculeBuilderSandboxProps {
  theme?: 'dark' | 'light';
}

// Helper to format element symbol with superscript +/- charge
export function formatAtomWithCharge(element: string, formalCharge: number = 0): string {
  if (formalCharge === 0) return element;
  if (formalCharge === 1) return `${element}⁺`;
  if (formalCharge === -1) return `${element}⁻`;
  if (formalCharge > 1) return `${element}${formalCharge}⁺`;
  return `${element}${Math.abs(formalCharge)}⁻`;
}

// Compute outermost electrons and maximum covalent bonds based on electron gain/loss
export function getMaxBondsForAtom(elementSymbol: string, formalCharge: number = 0): {
  maxBonds: number;
  valenceElectrons: number;
  baseValence: number;
  octetTarget: number;
  explanation: string;
} {
  const el = getElement(elementSymbol);
  const baseValence = el ? el.valenceElectrons : 4;
  // Losing e⁻ (charge > 0) reduces outermost electrons
  // Gaining e⁻ (charge < 0) increases outermost electrons
  const currentValence = Math.max(0, Math.min(18, baseValence - formalCharge));

  let maxBonds = 1;
  let octetTarget = 8;
  let explanation = '';

  if (elementSymbol === 'H') {
    octetTarget = 2; // Duet
    if (currentValence === 1) {
      maxBonds = 1;
      explanation = 'Neutral H has 1 valence e⁻ and forms 1 bond to fill its duet.';
    } else if (currentValence === 0) {
      maxBonds = 0;
      explanation = 'H⁺ has lost its electron (0 e⁻) and cannot form covalent shared pairs.';
    } else {
      maxBonds = 0;
      explanation = 'H⁻ has 2 electrons (duet filled) and behaves as a non-bonding hydride.';
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Boron group (Group 13)
  if (elementSymbol === 'B') {
    if (currentValence === 4) {
      maxBonds = 4; // B⁻ forms 4 bonds like BH4⁻
      explanation = 'B⁻ has gained 1 e⁻ (4 valence e⁻, isoelectronic with C) and forms 4 bonds (e.g. BH₄⁻).';
    } else if (currentValence === 3) {
      maxBonds = 3;
      explanation = 'Neutral Boron has 3 valence e⁻ and forms 3 bonds.';
    } else if (currentValence === 2) {
      maxBonds = 2;
      explanation = 'B⁺ has 2 valence e⁻ and forms 2 bonds.';
    } else {
      maxBonds = Math.max(0, currentValence);
      explanation = `Boron with ${currentValence} valence e⁻.`;
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Carbon group (Group 14: C, Si)
  if (['C', 'Si'].includes(elementSymbol)) {
    if (currentValence === 4) {
      maxBonds = 4;
      explanation = `Neutral ${elementSymbol} has 4 valence e⁻ and forms 4 bonds to complete octet.`;
    } else if (currentValence === 3) {
      maxBonds = 3; // C⁺ or C⁻
      explanation = `${elementSymbol} with 3 valence e⁻ (charge ${formalCharge > 0 ? '+' : ''}${formalCharge}) forms 3 bonds (e.g. CH₃⁺).`;
    } else if (currentValence === 5) {
      maxBonds = 3; // Carbanion
      explanation = `${elementSymbol}⁻ has gained 1 e⁻ (5 valence e⁻, 1 lone pair) and forms 3 bonds (e.g. CH₃⁻).`;
    } else if (currentValence === 2) {
      maxBonds = 2;
      explanation = `${elementSymbol} with 2 valence e⁻ forms 2 bonds.`;
    } else {
      maxBonds = Math.max(0, Math.min(4, currentValence));
      explanation = `${elementSymbol} with ${currentValence} valence e⁻.`;
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Pnictogens (Group 15: N, P)
  if (['N', 'P'].includes(elementSymbol)) {
    if (currentValence === 4) { // N⁺ (Ammonium NH4⁺, NO2⁺)
      maxBonds = 4;
      explanation = `${elementSymbol}⁺ has lost 1 e⁻ (4 valence e⁻, isoelectronic with C) and forms 4 bonds (like in NH₄⁺)!`;
    } else if (currentValence === 5) { // Neutral N (NH3)
      maxBonds = elementSymbol === 'P' ? 5 : 3;
      explanation = `Neutral ${elementSymbol} has 5 valence e⁻ (1 lone pair) and forms 3 bonds${elementSymbol === 'P' ? ' (up to 5 in expanded octet)' : ''}.`;
    } else if (currentValence === 6) { // N⁻ (Amide NH2⁻)
      maxBonds = 2;
      explanation = `${elementSymbol}⁻ has gained 1 e⁻ (6 valence e⁻, isoelectronic with O) and forms 2 bonds.`;
    } else if (currentValence === 7) { // N²⁻
      maxBonds = 1;
      explanation = `${elementSymbol}²⁻ has 7 valence e⁻ and forms 1 bond.`;
    } else if (currentValence >= 8) { // N³⁻
      maxBonds = 0;
      explanation = `${elementSymbol}³⁻ has a closed octet (8 e⁻) and forms 0 covalent bonds.`;
    } else {
      maxBonds = Math.max(0, currentValence);
      explanation = `${elementSymbol} with ${currentValence} valence e⁻.`;
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Chalcogens (Group 16: O, S)
  if (['O', 'S'].includes(elementSymbol)) {
    if (currentValence === 5) { // O⁺ (Hydronium H3O⁺)
      maxBonds = 3;
      explanation = `${elementSymbol}⁺ has lost 1 e⁻ (5 valence e⁻, isoelectronic with N) and forms 3 bonds (like in H₃O⁺)!`;
    } else if (currentValence === 6) { // Neutral O (H2O)
      maxBonds = elementSymbol === 'S' ? 6 : 2;
      explanation = `Neutral ${elementSymbol} has 6 valence e⁻ (2 lone pairs) and forms 2 bonds${elementSymbol === 'S' ? ' (up to 6 in expanded octet)' : ''}.`;
    } else if (currentValence === 7) { // O⁻ (Hydroxide OH⁻)
      maxBonds = 1;
      explanation = `${elementSymbol}⁻ has gained 1 e⁻ (7 valence e⁻, isoelectronic with F) and forms 1 bond (like in OH⁻).`;
    } else if (currentValence >= 8) { // O²⁻ (Oxide)
      maxBonds = 0;
      explanation = `${elementSymbol}²⁻ has a filled octet (8 e⁻) and forms 0 covalent bonds.`;
    } else if (currentValence === 4) { // O²⁺
      maxBonds = 4;
      explanation = `${elementSymbol}²⁺ has 4 valence e⁻ and can form up to 4 bonds.`;
    } else {
      maxBonds = Math.max(0, currentValence);
      explanation = `${elementSymbol} with ${currentValence} valence e⁻.`;
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Halogens (Group 17: F, Cl, Br, I)
  if (['F', 'Cl', 'Br', 'I'].includes(elementSymbol)) {
    if (currentValence === 7) {
      maxBonds = 1;
      explanation = `Neutral ${elementSymbol} has 7 valence e⁻ and forms 1 bond to fill its octet.`;
    } else if (currentValence === 6) {
      maxBonds = 2;
      explanation = `${elementSymbol}⁺ has lost 1 e⁻ (6 valence e⁻) and forms 2 bonds (halonium ion).`;
    } else if (currentValence >= 8) {
      maxBonds = 0;
      explanation = `${elementSymbol}⁻ has a complete octet (8 e⁻) and forms 0 covalent bonds (stable halide anion).`;
    } else {
      maxBonds = Math.max(0, 8 - currentValence);
      explanation = `${elementSymbol} with ${currentValence} valence e⁻.`;
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Alkali metals (Li, Na, K)
  if (['Li', 'Na', 'K'].includes(elementSymbol)) {
    if (currentValence === 1) {
      maxBonds = 1;
      explanation = `Neutral ${elementSymbol} has 1 valence e⁻ and forms 1 bond.`;
    } else {
      maxBonds = 0;
      explanation = `${elementSymbol}⁺ has lost its valence e⁻ and forms ionic interactions.`;
    }
    return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
  }

  // Default octet rule fallback
  if (currentValence <= 4) {
    maxBonds = currentValence;
  } else {
    maxBonds = Math.max(0, 8 - currentValence);
  }
  explanation = `${elementSymbol} with ${currentValence} outermost e⁻ (charge ${formalCharge > 0 ? '+' : ''}${formalCharge}).`;
  return { maxBonds, valenceElectrons: currentValence, baseValence, octetTarget, explanation };
}

// Generate high-resolution 3D billboard sprite for atom symbol with +/- charge sign
function createAtomBadgeSprite(symbol: string, formalCharge: number = 0, isSelected: boolean = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);

  // Background circular badge
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);

  if (formalCharge > 0) {
    // Electric blue for positive charge (lost electron)
    ctx.fillStyle = isSelected ? 'rgba(14, 165, 233, 0.95)' : 'rgba(14, 165, 233, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
  } else if (formalCharge < 0) {
    // Warm rose for negative charge (gained electron)
    ctx.fillStyle = isSelected ? 'rgba(244, 63, 94, 0.95)' : 'rgba(225, 29, 72, 0.85)';
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 5;
  } else {
    // Neutral atom badge
    ctx.fillStyle = isSelected ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = isSelected ? 4 : 2;
  }
  ctx.fill();
  ctx.stroke();

  let chargeStr = '';
  if (formalCharge > 0) {
    chargeStr = formalCharge === 1 ? '⁺' : `${formalCharge}⁺`;
  } else if (formalCharge < 0) {
    chargeStr = formalCharge === -1 ? '⁻' : `${Math.abs(formalCharge)}⁻`;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (chargeStr) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px monospace';
    ctx.fillText(symbol, 46, 66);

    ctx.fillStyle = formalCharge > 0 ? '#bae6fd' : '#fecdd3';
    ctx.font = '900 38px monospace';
    ctx.fillText(chargeStr, 88, 44);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 50px monospace';
    ctx.fillText(symbol, 64, 65);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.9, 0.9, 1);
  return sprite;
}

// VSEPR Geometry Specification
export interface VSEPRGeometryInfo {
  name: string;
  hybridization: string;
  idealAngleDeg: number;
  stericNumber: number;
  lonePairs: number;
  bondedCount: number;
  description: string;
}

export function getAtomVSEPRGeometry(
  atom: MolecularAtom,
  allAtoms: MolecularAtom[],
  allBonds: MolecularBond[]
): VSEPRGeometryInfo {
  const el = getElement(atom.element);
  const baseValence = el ? el.valenceElectrons : 4;
  const currentValence = Math.max(0, Math.min(18, baseValence - (atom.formalCharge || 0)));

  const connectedBonds = allBonds.filter((b) => b.from === atom.id || b.to === atom.id);
  const totalBondOrder = connectedBonds.reduce((sum, b) => sum + b.order, 0);
  const bondedCount = connectedBonds.length;

  const nonBondingElectrons = Math.max(0, currentValence - totalBondOrder);
  const lonePairs = Math.floor(nonBondingElectrons / 2);
  const stericNumber = bondedCount + lonePairs;

  if (bondedCount <= 1) {
    return {
      name: 'Terminal',
      hybridization: stericNumber === 4 ? 'sp³' : stericNumber === 3 ? 'sp²' : 's',
      idealAngleDeg: 180,
      stericNumber,
      lonePairs,
      bondedCount,
      description: 'Single-bonded terminal atom.',
    };
  }

  if (bondedCount === 2) {
    if (stericNumber <= 2) {
      return {
        name: 'Linear (180°)',
        hybridization: 'sp',
        idealAngleDeg: 180.0,
        stericNumber: 2,
        lonePairs: 0,
        bondedCount: 2,
        description: 'Linear geometry with 180° bond angle (sp hybridization).',
      };
    }
    if (stericNumber === 3) {
      return {
        name: 'Bent (~119°)',
        hybridization: 'sp²',
        idealAngleDeg: 119.0,
        stericNumber: 3,
        lonePairs: 1,
        bondedCount: 2,
        description: 'Bent geometry with ~119° bond angle from lone pair repulsion (sp² hybridization).',
      };
    }
    if (stericNumber === 4) {
      return {
        name: 'Bent (104.5°)',
        hybridization: 'sp³',
        idealAngleDeg: 104.45,
        stericNumber: 4,
        lonePairs: 2,
        bondedCount: 2,
        description: 'Bent geometry with 104.5° bond angle compressed by 2 lone pairs (sp³ hybridization).',
      };
    }
    return {
      name: 'Linear (180°)',
      hybridization: 'sp³d',
      idealAngleDeg: 180.0,
      stericNumber,
      lonePairs,
      bondedCount: 2,
      description: 'Linear geometry with 180° bond angle (axial ligands in sp³d).',
    };
  }

  if (bondedCount === 3) {
    if (stericNumber <= 3) {
      return {
        name: 'Trigonal Planar (120°)',
        hybridization: 'sp²',
        idealAngleDeg: 120.0,
        stericNumber: 3,
        lonePairs: 0,
        bondedCount: 3,
        description: 'Trigonal planar geometry with exact 120° bond angles (sp² hybridization).',
      };
    }
    if (stericNumber === 4) {
      return {
        name: 'Trigonal Pyramidal (107°)',
        hybridization: 'sp³',
        idealAngleDeg: 107.0,
        stericNumber: 4,
        lonePairs: 1,
        bondedCount: 3,
        description: 'Trigonal pyramidal geometry with 107.0° bond angles compressed by 1 lone pair (sp³ hybridization).',
      };
    }
    return {
      name: 'T-Shaped (90°/180°)',
      hybridization: 'sp³d',
      idealAngleDeg: 90.0,
      stericNumber,
      lonePairs,
      bondedCount: 3,
      description: 'T-shaped geometry with 90° and 180° bond angles (sp³d hybridization).',
    };
  }

  if (bondedCount === 4) {
    if (stericNumber <= 4) {
      return {
        name: 'Tetrahedral (109.5°)',
        hybridization: 'sp³',
        idealAngleDeg: 109.47,
        stericNumber: 4,
        lonePairs: 0,
        bondedCount: 4,
        description: 'Tetrahedral geometry with exact 109.47° bond angles (sp³ hybridization).',
      };
    }
    if (stericNumber === 6) {
      return {
        name: 'Square Planar (90°)',
        hybridization: 'sp³d²',
        idealAngleDeg: 90.0,
        stericNumber: 6,
        lonePairs: 2,
        bondedCount: 4,
        description: 'Square planar geometry with 90° adjacent and 180° opposite bond angles (sp³d² hybridization).',
      };
    }
    return {
      name: 'Seesaw',
      hybridization: 'sp³d',
      idealAngleDeg: 109.47,
      stericNumber: 5,
      lonePairs: 1,
      bondedCount: 4,
      description: 'Seesaw geometry derived from trigonal bipyramidal (sp³d hybridization).',
    };
  }

  if (bondedCount === 5) {
    return {
      name: 'Trigonal Bipyramidal',
      hybridization: 'sp³d',
      idealAngleDeg: 120.0,
      stericNumber: 5,
      lonePairs: 0,
      bondedCount: 5,
      description: 'Trigonal bipyramidal with 120° equatorial and 90° axial bond angles (sp³d hybridization).',
    };
  }

  return {
    name: 'Octahedral (90°)',
    hybridization: 'sp³d²',
    idealAngleDeg: 90.0,
    stericNumber: 6,
    lonePairs: 0,
    bondedCount,
    description: 'Octahedral geometry with 90° adjacent and 180° opposite bond angles (sp³d² hybridization).',
  };
}

export interface MeasuredBondAngle {
  atom1Id: string;
  atom1Element: string;
  centerId: string;
  centerElement: string;
  atom2Id: string;
  atom2Element: string;
  currentAngleDeg: number;
  idealAngleDeg: number;
  differenceDeg: number;
  isOptimal: boolean;
}

export function computeBondAnglesForAtom(
  centerAtom: MolecularAtom,
  allAtoms: MolecularAtom[],
  allBonds: MolecularBond[]
): MeasuredBondAngle[] {
  const connectedBonds = allBonds.filter((b) => b.from === centerAtom.id || b.to === centerAtom.id);
  const neighborIds = connectedBonds.map((b) => (b.from === centerAtom.id ? b.to : b.from));
  const neighbors = neighborIds
    .map((id) => allAtoms.find((a) => a.id === id))
    .filter((a): a is MolecularAtom => !!a);

  if (neighbors.length < 2) return [];

  const vsepr = getAtomVSEPRGeometry(centerAtom, allAtoms, allBonds);
  const centerPos = new THREE.Vector3(...centerAtom.position);
  const results: MeasuredBondAngle[] = [];

  for (let i = 0; i < neighbors.length; i++) {
    for (let j = i + 1; j < neighbors.length; j++) {
      const a1 = neighbors[i];
      const a2 = neighbors[j];

      const v1 = new THREE.Vector3(...a1.position).sub(centerPos);
      const v2 = new THREE.Vector3(...a2.position).sub(centerPos);

      const d1 = v1.length();
      const d2 = v2.length();
      if (d1 < 0.001 || d2 < 0.001) continue;

      const cosTheta = Math.max(-1, Math.min(1, v1.dot(v2) / (d1 * d2)));
      const currentAngleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

      let ideal = vsepr.idealAngleDeg;
      if (vsepr.name.startsWith('Octahedral') || vsepr.name.startsWith('Square Planar')) {
        ideal = currentAngleDeg > 135 ? 180 : 90;
      } else if (vsepr.name.startsWith('Trigonal Bipyramidal')) {
        if (currentAngleDeg > 150) ideal = 180;
        else if (currentAngleDeg > 105) ideal = 120;
        else ideal = 90;
      }

      const diff = Math.abs(currentAngleDeg - ideal);
      results.push({
        atom1Id: a1.id,
        atom1Element: a1.element,
        centerId: centerAtom.id,
        centerElement: centerAtom.element,
        atom2Id: a2.id,
        atom2Element: a2.element,
        currentAngleDeg: Math.round(currentAngleDeg * 10) / 10,
        idealAngleDeg: Math.round(ideal * 10) / 10,
        differenceDeg: Math.round(diff * 10) / 10,
        isOptimal: diff < 2.5,
      });
    }
  }

  return results;
}

// Generate high-resolution 3D billboard sprite for measured angle badge
function createAngleBadgeSprite(text: string, isOptimal: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 160, 64);

  // Rounded pill background
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(8, 10, 144, 44, 22);
  } else {
    ctx.rect(8, 10, 144, 44);
  }
  ctx.fillStyle = isOptimal ? 'rgba(6, 78, 59, 0.95)' : 'rgba(120, 53, 15, 0.95)';
  ctx.fill();
  ctx.strokeStyle = isOptimal ? '#34d399' : '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.75, 0.3, 1);
  return sprite;
}

// Get the optimal 3D vector direction for attaching the next atom to a parent atom according to VSEPR geometry
export function getNextVSEPRBondPosition(
  parentAtom: MolecularAtom,
  allAtoms: MolecularAtom[],
  allBonds: MolecularBond[],
  bondLength = 1.45
): [number, number, number] {
  const parentPos = new THREE.Vector3(...parentAtom.position);
  const connectedBonds = allBonds.filter((b) => b.from === parentAtom.id || b.to === parentAtom.id);
  const neighborIds = connectedBonds.map((b) => (b.from === parentAtom.id ? b.to : b.from));
  const neighbors = neighborIds
    .map((id) => allAtoms.find((a) => a.id === id))
    .filter((a): a is MolecularAtom => !!a);

  if (neighbors.length === 0) {
    return [parentPos.x + bondLength, parentPos.y, parentPos.z];
  }

  const existingVectors = neighbors.map((n) =>
    new THREE.Vector3(...n.position).sub(parentPos).normalize()
  );

  const vsepr = getAtomVSEPRGeometry(parentAtom, allAtoms, allBonds);

  if (existingVectors.length === 1) {
    const v1 = existingVectors[0];
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(v1.dot(up)) > 0.85) up = new THREE.Vector3(0, 0, 1);
    const perp = up.clone().cross(v1).normalize();

    // Determine target angle for 2nd bond on parentAtom based on prospective steric number & lone pairs
    let targetAngleDeg = 109.47;
    const el = parentAtom.element;
    const formalCharge = parentAtom.formalCharge || 0;
    if (el === 'O' || el === 'S') {
      targetAngleDeg = formalCharge > 0 ? 107.0 : 104.45;
    } else if (el === 'N' || el === 'P') {
      targetAngleDeg = formalCharge > 0 ? 109.47 : 107.0;
    } else if (el === 'C' || el === 'Si') {
      targetAngleDeg = 109.47;
    } else if (el === 'B') {
      targetAngleDeg = 120.0;
    } else if (el === 'Be' || vsepr.name.startsWith('Linear')) {
      targetAngleDeg = 180.0;
    }

    if (targetAngleDeg >= 170) {
      const dir = v1.clone().negate();
      return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
    }

    const angleRad = (targetAngleDeg * Math.PI) / 180;
    const dir = v1.clone().applyAxisAngle(perp, angleRad).normalize();
    return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
  }

  if (existingVectors.length === 2) {
    const v1 = existingVectors[0];
    const v2 = existingVectors[1];
    let normal = v1.clone().cross(v2).normalize();
    if (normal.lengthSq() < 0.01) {
      let up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(v1.dot(up)) > 0.85) up = new THREE.Vector3(0, 0, 1);
      normal = v1.clone().cross(up).normalize();
    }
    const bisector = v1.clone().add(v2).normalize();

    if (vsepr.name.startsWith('Trigonal Planar') || parentAtom.element === 'B') {
      const dir = bisector.clone().negate().normalize();
      return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
    }

    // 3rd bond on tetrahedral or pyramidal center (e.g. NH3 or CH4)
    const dir = bisector.clone().negate().addScaledVector(normal, 0.72).normalize();
    return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
  }

  if (existingVectors.length === 3) {
    const sum = existingVectors[0].clone().add(existingVectors[1]).add(existingVectors[2]);
    const dir = sum.clone().negate().normalize();
    return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
  }

  let bestDir = new THREE.Vector3(0, 1, 0);
  let minDot = 2.0;
  for (let step = 0; step < 32; step++) {
    const phi = Math.acos(1 - 2 * (step / 32));
    const theta = Math.sqrt(32 * Math.PI) * phi;
    const testDir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ).normalize();
    let maxDotWithExisting = -1.0;
    for (const ev of existingVectors) {
      const d = testDir.dot(ev);
      if (d > maxDotWithExisting) maxDotWithExisting = d;
    }
    if (maxDotWithExisting < minDot) {
      minDot = maxDotWithExisting;
      bestDir.copy(testDir);
    }
  }

  return [parentPos.x + bestDir.x * bondLength, parentPos.y + bestDir.y * bondLength, parentPos.z + bestDir.z * bondLength];
}

// Optimal equilibrium covalent bond distances in Ångströms
export function getTargetBondLength(el1: string, el2: string, order: number = 1): number {
  if (el1 === 'H' || el2 === 'H') {
    const other = el1 === 'H' ? el2 : el1;
    if (other === 'O') return 1.00;
    if (other === 'N') return 1.02;
    if (other === 'C') return 1.10;
    return 1.05;
  }
  if (order === 3) return 1.20;
  if (order === 2) return 1.34;
  return 1.48;
}

// Helper to center the entire molecular assembly at origin (0, 0, 0)
function recenterMolecule(molAtoms: MolecularAtom[]) {
  if (molAtoms.length === 0) return;
  let cx = 0, cy = 0, cz = 0;
  molAtoms.forEach((a) => {
    cx += a.position[0];
    cy += a.position[1];
    cz += a.position[2];
  });
  cx /= molAtoms.length;
  cy /= molAtoms.length;
  cz /= molAtoms.length;
  molAtoms.forEach((a) => {
    a.position[0] = Number((a.position[0] - cx).toFixed(4));
    a.position[1] = Number((a.position[1] - cy).toFixed(4));
    a.position[2] = Number((a.position[2] - cz).toFixed(4));
  });
}

// Function to analytically fix and snap all bond angles to exact VSEPR geometries
// without distorting or ripping multi-center molecules apart
export function fixAllBondAngles(
  currentAtoms: MolecularAtom[],
  currentBonds: MolecularBond[],
  targetBondLength = 1.45
): MolecularAtom[] {
  if (currentAtoms.length <= 1) return currentAtoms;

  const nextAtoms = currentAtoms.map((a) => ({
    ...a,
    position: [...a.position] as [number, number, number],
  }));

  const centers = nextAtoms.filter((atom) => {
    const cnt = currentBonds.filter((b) => b.from === atom.id || b.to === atom.id).length;
    return cnt >= 2;
  });

  if (centers.length === 0) return nextAtoms;

  // Tier 1: Single-center systems (Water, Ammonia, Methane, BF3, CO2, SF6, etc.)
  // Clean analytical VSEPR projection with greedy permutation matching (never crosses bonds)
  if (centers.length === 1) {
    const center = centers[0];
    const connectedBonds = currentBonds.filter((b) => b.from === center.id || b.to === center.id);
    const neighborIds = connectedBonds.map((b) => (b.from === center.id ? b.to : b.from));
    const neighbors = neighborIds
      .map((id) => nextAtoms.find((a) => a.id === id))
      .filter((a): a is MolecularAtom => !!a);

    const k = neighbors.length;
    if (k >= 2) {
      const vsepr = getAtomVSEPRGeometry(center, nextAtoms, currentBonds);
      const centerPos = new THREE.Vector3(...center.position);

      if (k === 2) {
        const a1 = neighbors[0];
        const a2 = neighbors[1];
        const b1 = connectedBonds.find((b) => (b.from === a1.id && b.to === center.id) || (b.to === a1.id && b.from === center.id));
        const b2 = connectedBonds.find((b) => (b.from === a2.id && b.to === center.id) || (b.to === a2.id && b.from === center.id));
        const d1 = getTargetBondLength(center.element, a1.element, b1?.order || 1);
        const d2 = getTargetBondLength(center.element, a2.element, b2?.order || 1);

        const v1 = new THREE.Vector3(...a1.position).sub(centerPos);
        const v2 = new THREE.Vector3(...a2.position).sub(centerPos);

        if (vsepr.idealAngleDeg >= 170) {
          // Linear: 180°
          const dir1 = v1.lengthSq() > 0.01 ? v1.normalize() : new THREE.Vector3(1, 0, 0);
          a1.position = [centerPos.x + dir1.x * d1, centerPos.y + dir1.y * d1, centerPos.z + dir1.z * d1];
          a2.position = [centerPos.x - dir1.x * d2, centerPos.y - dir1.y * d2, centerPos.z - dir1.z * d2];
          recenterMolecule(nextAtoms);
          return nextAtoms;
        } else {
          // Bent: 104.5° (Water) or 120° (SO2)
          const theta0 = (vsepr.idealAngleDeg * Math.PI) / 180;
          const halfAngle = theta0 / 2;

          let u1 = v1.clone().normalize();
          let u2 = v2.clone().normalize();
          if (u1.lengthSq() < 0.1) u1 = new THREE.Vector3(1, 0, 0);
          if (u2.lengthSq() < 0.1) u2 = new THREE.Vector3(-0.5, 0.866, 0);

          const dot12 = Math.max(-1, Math.min(1, u1.dot(u2)));
          let bisector: THREE.Vector3;
          let normal: THREE.Vector3;

          if (dot12 < -0.96) {
            // Near 180° collinear: build an orthogonal bend plane
            let ref = new THREE.Vector3(0, 1, 0);
            if (Math.abs(u1.dot(ref)) > 0.85) ref = new THREE.Vector3(0, 0, 1);
            const perp = ref.clone().cross(u1).normalize();
            bisector = perp;
            normal = u1.clone().cross(perp).normalize();
          } else if (dot12 > 0.96) {
            // Near 0° collinear: separate them
            let ref = new THREE.Vector3(0, 1, 0);
            if (Math.abs(u1.dot(ref)) > 0.85) ref = new THREE.Vector3(0, 0, 1);
            bisector = u1.clone();
            normal = ref.clone().cross(u1).normalize();
          } else {
            bisector = u1.clone().add(u2).normalize();
            normal = u1.clone().cross(u2).normalize();
            if (normal.lengthSq() < 0.01) {
              let ref = new THREE.Vector3(0, 1, 0);
              if (Math.abs(bisector.dot(ref)) > 0.85) ref = new THREE.Vector3(0, 0, 1);
              normal = bisector.clone().cross(ref).normalize();
            }
          }

          const optA = bisector.clone().applyAxisAngle(normal, -halfAngle).normalize();
          const optB = bisector.clone().applyAxisAngle(normal, halfAngle).normalize();

          let dir1 = optA;
          let dir2 = optB;
          if (u1.dot(optA) + u2.dot(optB) < u1.dot(optB) + u2.dot(optA)) {
            dir1 = optB;
            dir2 = optA;
          }

          a1.position = [
            Number((centerPos.x + dir1.x * d1).toFixed(4)),
            Number((centerPos.y + dir1.y * d1).toFixed(4)),
            Number((centerPos.z + dir1.z * d1).toFixed(4)),
          ];
          a2.position = [
            Number((centerPos.x + dir2.x * d2).toFixed(4)),
            Number((centerPos.y + dir2.y * d2).toFixed(4)),
            Number((centerPos.z + dir2.z * d2).toFixed(4)),
          ];
          recenterMolecule(nextAtoms);
          return nextAtoms;
        }
      } else if (k === 3) {
        // Trigonal Planar (120°) or Trigonal Pyramidal (107°)
        const isPyramidal = vsepr.name.startsWith('Trigonal Pyramidal');
        const vList = neighbors.map((nbr) => new THREE.Vector3(...nbr.position).sub(centerPos));

        let normal = new THREE.Vector3();
        if (vList[0].lengthSq() > 0.01 && vList[1].lengthSq() > 0.01) {
          normal.crossVectors(vList[0], vList[1]).normalize();
        }
        if (normal.lengthSq() < 0.01) normal.set(0, 0, 1);

        let refAxis = vList[0].clone().sub(normal.clone().multiplyScalar(vList[0].dot(normal))).normalize();
        if (refAxis.lengthSq() < 0.01) refAxis.set(1, 0, 0);
        const orthoAxis = normal.clone().cross(refAxis).normalize();

        const idealDirs: THREE.Vector3[] = [];
        if (isPyramidal) {
          const alpha = (68.16 * Math.PI) / 180; // 107.0° pairwise
          const sinA = Math.sin(alpha);
          const cosA = Math.cos(alpha);
          for (let phi = 0; phi < 3; phi++) {
            const angle = (phi * 2 * Math.PI) / 3;
            idealDirs.push(
              refAxis
                .clone()
                .multiplyScalar(sinA * Math.cos(angle))
                .add(orthoAxis.clone().multiplyScalar(sinA * Math.sin(angle)))
                .add(normal.clone().multiplyScalar(-cosA))
                .normalize()
            );
          }
        } else {
          for (let phi = 0; phi < 3; phi++) {
            const angle = (phi * 2 * Math.PI) / 3;
            idealDirs.push(
              refAxis
                .clone()
                .multiplyScalar(Math.cos(angle))
                .add(orthoAxis.clone().multiplyScalar(Math.sin(angle)))
                .normalize()
            );
          }
        }

        const used = new Set<number>();
        neighbors.forEach((nbr) => {
          const v = new THREE.Vector3(...nbr.position).sub(centerPos).normalize();
          let bestIdx = -1;
          let bestDot = -999;
          idealDirs.forEach((dir, idx) => {
            if (used.has(idx)) return;
            const dot = v.dot(dir);
            if (dot > bestDot) {
              bestDot = dot;
              bestIdx = idx;
            }
          });
          if (bestIdx !== -1) {
            used.add(bestIdx);
            const dist = getTargetBondLength(center.element, nbr.element, 1);
            const d = idealDirs[bestIdx];
            nbr.position = [
              Number((centerPos.x + d.x * dist).toFixed(4)),
              Number((centerPos.y + d.y * dist).toFixed(4)),
              Number((centerPos.z + d.z * dist).toFixed(4)),
            ];
          }
        });
        recenterMolecule(nextAtoms);
        return nextAtoms;
      } else if (k === 4) {
        // Tetrahedral (109.47°)
        const invSqrt3 = 1 / Math.sqrt(3);
        const baseTetra = [
          new THREE.Vector3(invSqrt3, invSqrt3, invSqrt3),
          new THREE.Vector3(invSqrt3, -invSqrt3, -invSqrt3),
          new THREE.Vector3(-invSqrt3, invSqrt3, -invSqrt3),
          new THREE.Vector3(-invSqrt3, -invSqrt3, invSqrt3),
        ];

        let v0 = new THREE.Vector3(...neighbors[0].position).sub(centerPos);
        if (v0.lengthSq() < 0.01) v0 = new THREE.Vector3(0, 1, 0);
        else v0.normalize();

        const rotQuat = new THREE.Quaternion().setFromUnitVectors(baseTetra[0], v0);
        baseTetra.forEach((td) => td.applyQuaternion(rotQuat));

        const perms: number[][] = [];
        const p = [0, 1, 2, 3];
        const permute = (arr: number[], m: number[] = []) => {
          if (arr.length === 0) perms.push(m);
          else {
            for (let i = 0; i < arr.length; i++) {
              const curr = arr.slice();
              const next = curr.splice(i, 1);
              permute(curr.slice(), m.concat(next));
            }
          }
        };
        permute(p);

        const nbrDirs = neighbors.map((nbr) => {
          const v = new THREE.Vector3(...nbr.position).sub(centerPos);
          return v.lengthSq() > 0.01 ? v.normalize() : new THREE.Vector3(1, 0, 0);
        });

        let bestPerm = perms[0];
        let maxScore = -99999;
        for (const perm of perms) {
          let score = 0;
          for (let i = 0; i < 4; i++) {
            score += nbrDirs[i].dot(baseTetra[perm[i]]);
          }
          if (score > maxScore) {
            maxScore = score;
            bestPerm = perm;
          }
        }

        for (let i = 0; i < 4; i++) {
          const nbr = neighbors[i];
          const dist = getTargetBondLength(center.element, nbr.element, 1);
          const d = baseTetra[bestPerm[i]];
          nbr.position = [
            Number((centerPos.x + d.x * dist).toFixed(4)),
            Number((centerPos.y + d.y * dist).toFixed(4)),
            Number((centerPos.z + d.z * dist).toFixed(4)),
          ];
        }
        recenterMolecule(nextAtoms);
        return nextAtoms;
      }
    }
  }

  // Tier 2: Multi-center systems (Chains, rings, branched molecules, peptides)
  // Simultaneous in-memory coupled distance & VSEPR angle optimization
  // Preserves full molecular topology and prevents ripped or colliding atoms!
  const posMap = new Map<string, THREE.Vector3>();
  nextAtoms.forEach((a) => posMap.set(a.id, new THREE.Vector3(...a.position)));

  const exclusion12_13 = new Set<string>();
  currentBonds.forEach((b) => {
    exclusion12_13.add(`${b.from}_${b.to}`);
    exclusion12_13.add(`${b.to}_${b.from}`);
  });
  nextAtoms.forEach((c) => {
    const cBonds = currentBonds.filter((b) => b.from === c.id || b.to === c.id);
    const nIds = cBonds.map((b) => (b.from === c.id ? b.to : b.from));
    for (let i = 0; i < nIds.length; i++) {
      for (let j = i + 1; j < nIds.length; j++) {
        exclusion12_13.add(`${nIds[i]}_${nIds[j]}`);
        exclusion12_13.add(`${nIds[j]}_${nIds[i]}`);
      }
    }
  });

  const optimizationRounds = 120;
  for (let step = 0; step < optimizationRounds; step++) {
    // 1. Bond Length Spring Constraints
    currentBonds.forEach((bond) => {
      const p1 = posMap.get(bond.from);
      const p2 = posMap.get(bond.to);
      if (!p1 || !p2) return;

      const a1 = nextAtoms.find((a) => a.id === bond.from);
      const a2 = nextAtoms.find((a) => a.id === bond.to);
      const targetLen = getTargetBondLength(a1?.element || 'C', a2?.element || 'C', bond.order);

      const delta = p2.clone().sub(p1);
      const len = delta.length();
      if (len < 0.001) return;

      const diff = len - targetLen;
      const correction = delta.normalize().multiplyScalar(diff * 0.4);
      p1.add(correction);
      p2.sub(correction);
    });

    // 2. Harmonic VSEPR Angle Restoring Torques
    nextAtoms.forEach((center) => {
      const cBonds = currentBonds.filter((b) => b.from === center.id || b.to === center.id);
      if (cBonds.length < 2) return;

      const cPos = posMap.get(center.id);
      if (!cPos) return;

      const neighborIds = cBonds.map((b) => (b.from === center.id ? b.to : b.from));
      const vsepr = getAtomVSEPRGeometry(center, nextAtoms, currentBonds);
      const targetAngleRad = (vsepr.idealAngleDeg * Math.PI) / 180;

      for (let i = 0; i < neighborIds.length; i++) {
        for (let j = i + 1; j < neighborIds.length; j++) {
          const pA = posMap.get(neighborIds[i]);
          const pB = posMap.get(neighborIds[j]);
          if (!pA || !pB) continue;

          const vA = pA.clone().sub(cPos);
          const vB = pB.clone().sub(cPos);
          const lenA = vA.length();
          const lenB = vB.length();
          if (lenA < 0.1 || lenB < 0.1) continue;

          const uA = vA.multiplyScalar(1 / lenA);
          const uB = vB.multiplyScalar(1 / lenB);
          const dot = Math.max(-0.9999, Math.min(0.9999, uA.dot(uB)));
          const currentAngle = Math.acos(dot);

          let pairTarget = targetAngleRad;
          if (vsepr.name.startsWith('Octahedral') || vsepr.name.startsWith('Square Planar')) {
            pairTarget = currentAngle > (135 * Math.PI) / 180 ? Math.PI : Math.PI / 2;
          }

          const angleError = currentAngle - pairTarget;
          if (Math.abs(angleError) < 0.002) continue;

          const sinVal = Math.sqrt(Math.max(1e-6, 1 - dot * dot));
          const nA = uB.clone().addScaledVector(uA, -dot).multiplyScalar(1 / sinVal);
          const nB = uA.clone().addScaledVector(uB, -dot).multiplyScalar(1 / sinVal);

          const torque = 0.22 * angleError;
          pA.addScaledVector(nA, torque);
          pB.addScaledVector(nB, torque);
          cPos.addScaledVector(nA.clone().add(nB), -0.5 * torque);
        }
      }
    });

    // 3. 1-4+ Non-bonded Steric Repulsion
    for (let i = 0; i < nextAtoms.length; i++) {
      for (let j = i + 1; j < nextAtoms.length; j++) {
        const idA = nextAtoms[i].id;
        const idB = nextAtoms[j].id;
        if (exclusion12_13.has(`${idA}_${idB}`)) continue;

        const pA = posMap.get(idA);
        const pB = posMap.get(idB);
        if (!pA || !pB) continue;

        const delta = pB.clone().sub(pA);
        const dist = delta.length();
        if (dist > 0.01 && dist < 2.2) {
          const push = 0.07 / (dist * dist);
          const dir = delta.normalize().multiplyScalar(push);
          pA.sub(dir);
          pB.add(dir);
        }
      }
    }
  }

  // Write finalized positions
  nextAtoms.forEach((a) => {
    const p = posMap.get(a.id);
    if (p) {
      a.position = [
        Number(p.x.toFixed(4)),
        Number(p.y.toFixed(4)),
        Number(p.z.toFixed(4)),
      ];
    }
  });

  recenterMolecule(nextAtoms);
  return nextAtoms;
}

const PALETTE_ELEMENTS = [
  { symbol: 'H', name: 'Hydrogen', maxBonds: 1, color: '#FFFFFF' },
  { symbol: 'C', name: 'Carbon', maxBonds: 4, color: '#334155' },
  { symbol: 'N', name: 'Nitrogen', maxBonds: 3, color: '#3050F8' },
  { symbol: 'O', name: 'Oxygen', maxBonds: 2, color: '#FF0D0D' },
  { symbol: 'F', name: 'Fluorine', maxBonds: 1, color: '#90E050' },
  { symbol: 'P', name: 'Phosphorus', maxBonds: 5, color: '#FF8000' },
  { symbol: 'S', name: 'Sulfur', maxBonds: 6, color: '#FFFF30' },
  { symbol: 'Cl', name: 'Chlorine', maxBonds: 1, color: '#1FF01F' },
  { symbol: 'Br', name: 'Bromine', maxBonds: 1, color: '#A62929' },
  { symbol: 'I', name: 'Iodine', maxBonds: 1, color: '#940094' },
  { symbol: 'B', name: 'Boron', maxBonds: 3, color: '#FFB5B5' },
  { symbol: 'Si', name: 'Silicon', maxBonds: 4, color: '#F0C8A0' },
];

// Helper to guarantee every atom in the list has a distinct, collision-free ID
export function ensureUniqueAtomIds(atomList: MolecularAtom[]): MolecularAtom[] {
  const seen = new Set<string>();
  let hasDupes = false;
  for (const a of atomList) {
    if (seen.has(a.id)) {
      hasDupes = true;
      break;
    }
    seen.add(a.id);
  }
  if (!hasDupes) return atomList;

  const used = new Set<string>();
  return atomList.map((a) => {
    if (!used.has(a.id)) {
      used.add(a.id);
      return a;
    }
    let n = 1;
    while (used.has(`${a.element}${n}`)) {
      n++;
    }
    const newId = `${a.element}${n}`;
    used.add(newId);
    return { ...a, id: newId };
  });
}

export const MoleculeBuilderSandbox: React.FC<MoleculeBuilderSandboxProps> = ({
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Builder Atoms & Bonds state (Initial state: Water H₂O at exact 104.5° bent VSEPR angle)
  const [atomsRaw, setAtomsRaw] = useState<MolecularAtom[]>([
    { id: 'O1', element: 'O', position: [0, 0, 0] },
    { id: 'H1', element: 'H', position: [-1.146, -0.888, 0] },
    { id: 'H2', element: 'H', position: [1.146, -0.888, 0] },
  ]);

  const setAtoms = useCallback((action: React.SetStateAction<MolecularAtom[]>) => {
    setAtomsRaw((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      return ensureUniqueAtomIds(next);
    });
  }, []);
  const atoms = atomsRaw;

  const [bonds, setBonds] = useState<MolecularBond[]>([
    { id: 'b1', from: 'O1', to: 'H1', order: 1 },
    { id: 'b2', from: 'O1', to: 'H2', order: 1 },
  ]);

  // Selected atom for bonding / manipulation
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>('O1');
  const [selectedBondOrder, setSelectedBondOrder] = useState<1 | 2 | 3>(1);
  const [isRelaxing, setIsRelaxing] = useState<boolean>(true);
  const [relaxNonce, setRelaxNonce] = useState<number>(0);
  const triggerRelax = useCallback(() => {
    setRelaxNonce((n) => n + 1);
  }, []);
  const [hoveredAtomId, setHoveredAtomId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Click an atom to select, then click another atom to bond them together.');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [showIupacInfo, setShowIupacInfo] = useState<boolean>(false);
  const [pubchemVerifiedIupac, setPubchemVerifiedIupac] = useState<string | null>(null);
  const [autoFixBondAngles, setAutoFixBondAngles] = useState<boolean>(true);
  const autoFixBondAnglesRef = useRef<boolean>(true);
  autoFixBondAnglesRef.current = autoFixBondAngles;

  // Always keep fresh refs to eliminate any stale closures in Three.js event handlers!
  const atomsRef = useRef<MolecularAtom[]>(atoms);
  atomsRef.current = atoms;

  const bondsRef = useRef<MolecularBond[]>(bonds);
  bondsRef.current = bonds;

  const selectedAtomIdRef = useRef<string | null>(selectedAtomId);
  selectedAtomIdRef.current = selectedAtomId;

  const selectedBondOrderRef = useRef<1 | 2 | 3>(selectedBondOrder);
  selectedBondOrderRef.current = selectedBondOrder;

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const molGroupRef = useRef<THREE.Group | null>(null);
  const atomMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const [sceneReady, setSceneReady] = useState<number>(0);

  // Count existing bond orders connected to an atom
  const getAtomBondsCount = useCallback((atomId: string, currentBonds: MolecularBond[], excludeBondId?: string) => {
    return currentBonds
      .filter((b) => b.id !== excludeBondId && (b.from === atomId || b.to === atomId))
      .reduce((sum, b) => sum + b.order, 0);
  }, []);

  // Function to create or toggle a bond between two atoms obeying outermost valence limits
  const connectOrToggleBond = useCallback((atomAId: string, atomBId: string, bondOrder: 1 | 2 | 3 = 1) => {
    if (atomAId === atomBId) return;

    const atomA = atomsRef.current.find((a) => a.id === atomAId);
    const atomB = atomsRef.current.find((a) => a.id === atomBId);
    if (!atomA || !atomB) return;

    const chargeA = atomA.formalCharge || 0;
    const chargeB = atomB.formalCharge || 0;
    const specA = getMaxBondsForAtom(atomA.element, chargeA);
    const specB = getMaxBondsForAtom(atomB.element, chargeB);

    const currentBonds = bondsRef.current;
    const existingIndex = currentBonds.findIndex(
      (b) =>
        (b.from === atomAId && b.to === atomBId) ||
        (b.from === atomBId && b.to === atomAId)
    );

    if (existingIndex >= 0) {
      // If bond already exists, cycle order: 1 -> 2 -> 3 -> delete
      const existing = currentBonds[existingIndex];
      const nextOrder = existing.order === 1 ? 2 : existing.order === 2 ? 3 : 0;

      if (nextOrder > 0) {
        const orderDelta = nextOrder - existing.order;
        const bondsA = getAtomBondsCount(atomAId, currentBonds, existing.id);
        const bondsB = getAtomBondsCount(atomBId, currentBonds, existing.id);

        if (bondsA + nextOrder > specA.maxBonds) {
          soundFx.playQuizChime(false);
          setStatusMessage(
            `Cannot upgrade bond: ${formatAtomWithCharge(atomA.element, chargeA)} (${atomA.id}) has ${specA.valenceElectrons} outermost e⁻ (max ${specA.maxBonds} bonds). Use "Lose e⁻" to allow more bonds (e.g. O ➔ O⁺)!`
          );
          return;
        }

        if (bondsB + nextOrder > specB.maxBonds) {
          soundFx.playQuizChime(false);
          setStatusMessage(
            `Cannot upgrade bond: ${formatAtomWithCharge(atomB.element, chargeB)} (${atomB.id}) has ${specB.valenceElectrons} outermost e⁻ (max ${specB.maxBonds} bonds). Use "Lose e⁻" to allow more bonds!`
          );
          return;
        }

        const next = [...currentBonds];
        next[existingIndex] = { ...existing, order: nextOrder as 1 | 2 | 3 };
        if (autoFixBondAnglesRef.current) {
          const fixed = fixAllBondAngles(atomsRef.current, next);
          setAtoms(fixed);
        }
        setBonds(next);
        triggerRelax();
        soundFx.playBondSnap();
        setStatusMessage(`Upgraded bond between ${atomAId} and ${atomBId} to ${nextOrder === 2 ? 'Double Bond (=)' : 'Triple Bond (≡)'}. Bond angles automatically fixed.`);
      } else {
        // Remove bond
        const nextBonds = currentBonds.filter((_, i) => i !== existingIndex);
        if (autoFixBondAnglesRef.current && atomsRef.current.length > 1) {
          const fixed = fixAllBondAngles(atomsRef.current, nextBonds);
          setAtoms(fixed);
        }
        setBonds(nextBonds);
        triggerRelax();
        soundFx.playReactionStep();
        setStatusMessage(`Disconnected bond between ${atomAId} and ${atomBId}.`);
      }
    } else {
      // Check if both atoms have enough free bonding capacity
      const bondsA = getAtomBondsCount(atomAId, currentBonds);
      const bondsB = getAtomBondsCount(atomBId, currentBonds);

      if (bondsA + bondOrder > specA.maxBonds) {
        soundFx.playQuizChime(false);
        setStatusMessage(
          `Cannot form bond: ${formatAtomWithCharge(atomA.element, chargeA)} (${atomA.id}) already has ${bondsA}/${specA.maxBonds} bonds (${specA.valenceElectrons} outermost e⁻). Use "Lose e⁻" to increase its capacity!`
        );
        return;
      }

      if (bondsB + bondOrder > specB.maxBonds) {
        soundFx.playQuizChime(false);
        setStatusMessage(
          `Cannot form bond: ${formatAtomWithCharge(atomB.element, chargeB)} (${atomB.id}) already has ${bondsB}/${specB.maxBonds} bonds (${specB.valenceElectrons} outermost e⁻). Use "Lose e⁻" to increase its capacity!`
        );
        return;
      }

      const newBond: MolecularBond = {
        id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        from: atomAId,
        to: atomBId,
        order: bondOrder,
      };
      const nextBonds = [...currentBonds, newBond];
      if (autoFixBondAnglesRef.current) {
        const fixed = fixAllBondAngles(atomsRef.current, nextBonds);
        setAtoms(fixed);
      }
      setBonds(nextBonds);
      triggerRelax();
      soundFx.playBondSnap();
      setStatusMessage(`Created bond between ${atomAId} and ${atomBId}! Bond angles automatically fixed to VSEPR geometry.`);
    }
  }, [getAtomBondsCount, triggerRelax]);

  // Handle 3D atom click
  const handleAtomClick = useCallback((clickedId: string) => {
    const currentSelected = selectedAtomIdRef.current;

    if (!currentSelected) {
      // First selection
      setSelectedAtomId(clickedId);
      soundFx.playReactionStep();
      const atom = atomsRef.current.find((a) => a.id === clickedId);
      setStatusMessage(`Selected ${atom?.element || ''} (${clickedId}). Now click another atom to bond them together.`);
    } else if (currentSelected === clickedId) {
      // Clicking same atom toggles selection off
      setSelectedAtomId(null);
      setStatusMessage('Deselected atom. Click any atom to begin bonding.');
    } else {
      // Clicking second atom -> CREATE OR TOGGLE BOND!
      connectOrToggleBond(currentSelected, clickedId, selectedBondOrderRef.current);
      // Keep clicked atom selected for continuous chaining
      setSelectedAtomId(clickedId);
    }
  }, [connectOrToggleBond]);

  // Setup Three.js
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 10);
    cameraRef.current = camera;

    const renderer = setupStandardRenderer(canvas);
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const disposeEnv = setupSceneEnvironment(renderer, scene);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(8, 12, 10);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
    scene.add(hemiLight);

    const group = new THREE.Group();
    scene.add(group);
    molGroupRef.current = group;

    // Contact floor
    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x000000 : 0x94a3b8,
      transparent: true,
      opacity: theme === 'dark' ? 0.35 : 0.12,
      depthWrite: false,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -3.5;
    scene.add(floorMesh);
    floorMeshRef.current = floorMesh;

    // Raycast handling with drag prevention
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: MouseEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: MouseEvent) => {
      if (!canvasRef.current || !cameraRef.current) return;
      // If user dragged to orbit camera (>6 pixels), ignore click
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;

      const rect = canvasRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const meshes = Array.from(atomMeshMapRef.current.values());
      const hits = raycaster.intersectObjects(meshes, false);

      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        const atomId = hitMesh.userData.atomId;
        if (atomId) {
          handleAtomClick(atomId);
        }
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!canvasRef.current || !cameraRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const meshes = Array.from(atomMeshMapRef.current.values());
      const hits = raycaster.intersectObjects(meshes, false);

      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        setHoveredAtomId(hitMesh.userData.atomId || null);
        canvasRef.current.style.cursor = 'pointer';
      } else {
        setHoveredAtomId(null);
        canvasRef.current.style.cursor = 'grab';
      }
    };

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mousemove', onPointerMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    setSceneReady((prev) => prev + 1);

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
      canvas.removeEventListener('mousedown', onPointerDown);
      canvas.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('mousemove', onPointerMove);
      disposeEnv();
      renderer.dispose();
      floorMeshRef.current = null;
    };
  }, [handleAtomClick]);

  // Update scene background and floor color on theme change without tearing down the molecule
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    }
    if (floorMeshRef.current) {
      const mat = floorMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(theme === 'dark' ? 0x000000 : 0x94a3b8);
      mat.opacity = theme === 'dark' ? 0.35 : 0.12;
    }
  }, [theme]);

  // VSEPR Force-Directed 3D Relaxation Loop with Convergence Detection
  useEffect(() => {
    if (!isRelaxing || atoms.length <= 1) return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let stepCount = 0;
    const maxSteps = 120; // Bound relaxation per event

    const relaxStep = () => {
      if (!isMounted) return;

      let hasConverged = false;

      setAtoms((prevAtoms) => {
        if (prevAtoms.length <= 1) {
          hasConverged = true;
          return prevAtoms;
        }

        const next = prevAtoms.map((a) => ({
          ...a,
          position: [...a.position] as [number, number, number],
        }));

        let maxDisp = 0;

        // Perform 2 mini-passes per frame for rapid, stable settling
        for (let pass = 0; pass < 2; pass++) {
          // 1. Hooke's Law Spring Forces on bonds (lengths)
          bondsRef.current.forEach((bond) => {
            const a1 = next.find((a) => a.id === bond.from);
            const a2 = next.find((a) => a.id === bond.to);
            if (!a1 || !a2) return;

            const targetBondLength = getTargetBondLength(a1.element, a2.element, bond.order);
            const p1 = new THREE.Vector3(...a1.position);
            const p2 = new THREE.Vector3(...a2.position);
            const delta = p2.clone().sub(p1);
            const currentDist = delta.length();
            if (currentDist < 0.001) return;

            const displacement = currentDist - targetBondLength;
            const forceMag = displacement * 0.15;
            const dir = delta.normalize();

            a1.position[0] += dir.x * forceMag;
            a1.position[1] += dir.y * forceMag;
            a1.position[2] += dir.z * forceMag;

            a2.position[0] -= dir.x * forceMag;
            a2.position[1] -= dir.y * forceMag;
            a2.position[2] -= dir.z * forceMag;
          });

          // 2. Harmonic VSEPR Angle Restoring Forces (Fixing bond angles)
          const connectedCenters = next.filter((atom) => {
            return bondsRef.current.filter((b) => b.from === atom.id || b.to === atom.id).length >= 2;
          });

          connectedCenters.forEach((centerAtom) => {
            const connectedBonds = bondsRef.current.filter((b) => b.from === centerAtom.id || b.to === centerAtom.id);
            const neighborIds = connectedBonds.map((b) => (b.from === centerAtom.id ? b.to : b.from));
            const neighbors = neighborIds
              .map((id) => next.find((a) => a.id === id))
              .filter((a): a is MolecularAtom => !!a);

            if (neighbors.length < 2) return;

            const vsepr = getAtomVSEPRGeometry(centerAtom, next, bondsRef.current);
            const centerPos = new THREE.Vector3(...centerAtom.position);

            for (let i = 0; i < neighbors.length; i++) {
              for (let j = i + 1; j < neighbors.length; j++) {
                const a1 = neighbors[i];
                const a2 = neighbors[j];

                const v1 = new THREE.Vector3(...a1.position).sub(centerPos);
                const v2 = new THREE.Vector3(...a2.position).sub(centerPos);

                const d1 = v1.length();
                const d2 = v2.length();
                if (d1 < 0.1 || d2 < 0.1) continue;

                const u1 = v1.multiplyScalar(1 / d1);
                const u2 = v2.multiplyScalar(1 / d2);

                const dot = Math.max(-0.9999, Math.min(0.9999, u1.dot(u2)));
                const currentAngle = Math.acos(dot);

                let targetAngle = (vsepr.idealAngleDeg * Math.PI) / 180;
                if (vsepr.name.startsWith('Octahedral') || vsepr.name.startsWith('Square Planar')) {
                  targetAngle = currentAngle > (135 * Math.PI) / 180 ? Math.PI : Math.PI / 2;
                }

                const angleError = currentAngle - targetAngle;
                if (Math.abs(angleError) < 0.002) continue;

                const sinVal = Math.sqrt(Math.max(1e-6, 1 - dot * dot));
                const n1 = u2.clone().addScaledVector(u1, -dot).multiplyScalar(1 / sinVal);
                const n2 = u1.clone().addScaledVector(u2, -dot).multiplyScalar(1 / sinVal);

                const kAngle = 0.12;
                const shiftMag = kAngle * angleError;

                a1.position[0] += n1.x * shiftMag;
                a1.position[1] += n1.y * shiftMag;
                a1.position[2] += n1.z * shiftMag;

                a2.position[0] += n2.x * shiftMag;
                a2.position[1] += n2.y * shiftMag;
                a2.position[2] += n2.z * shiftMag;

                centerAtom.position[0] -= (n1.x + n2.x) * shiftMag * 0.5;
                centerAtom.position[1] -= (n1.y + n2.y) * shiftMag * 0.5;
                centerAtom.position[2] -= (n1.z + n2.z) * shiftMag * 0.5;
              }
            }
          });

          // 3. Van der Waals Repulsion with 1-3 exclusion
          const bondedOr13Pair = new Set<string>();
          bondsRef.current.forEach((b) => {
            bondedOr13Pair.add(`${b.from}_${b.to}`);
            bondedOr13Pair.add(`${b.to}_${b.from}`);
          });
          connectedCenters.forEach((center) => {
            const cBonds = bondsRef.current.filter((b) => b.from === center.id || b.to === center.id);
            const nIds = cBonds.map((b) => (b.from === center.id ? b.to : b.from));
            for (let m = 0; m < nIds.length; m++) {
              for (let n = m + 1; n < nIds.length; n++) {
                bondedOr13Pair.add(`${nIds[m]}_${nIds[n]}`);
                bondedOr13Pair.add(`${nIds[n]}_${nIds[m]}`);
              }
            }
          });

          for (let i = 0; i < next.length; i++) {
            for (let j = i + 1; j < next.length; j++) {
              const a1 = next[i];
              const a2 = next[j];
              if (bondedOr13Pair.has(`${a1.id}_${a2.id}`)) continue;

              const p1 = new THREE.Vector3(...a1.position);
              const p2 = new THREE.Vector3(...a2.position);
              const delta = p2.clone().sub(p1);
              const dist = delta.length();
              if (dist < 0.1 || dist > 2.8) continue;

              const repulseMag = 0.06 / (dist * dist);
              const dir = delta.normalize();

              a1.position[0] -= dir.x * repulseMag;
              a1.position[1] -= dir.y * repulseMag;
              a1.position[2] -= dir.z * repulseMag;

              a2.position[0] += dir.x * repulseMag;
              a2.position[1] += dir.y * repulseMag;
              a2.position[2] += dir.z * repulseMag;
            }
          }
        }

        // Measure maximum displacement across all atoms
        for (let i = 0; i < next.length; i++) {
          const d = Math.hypot(
            next[i].position[0] - prevAtoms[i].position[0],
            next[i].position[1] - prevAtoms[i].position[1],
            next[i].position[2] - prevAtoms[i].position[2]
          );
          if (d > maxDisp) maxDisp = d;
        }

        if (maxDisp < 0.002 || stepCount >= maxSteps) {
          hasConverged = true;
          return prevAtoms; // Same reference -> React skips re-render!
        }

        stepCount++;
        return next;
      });

      if (!hasConverged && stepCount < maxSteps && isMounted) {
        timeoutId = setTimeout(relaxStep, 35);
      }
    };

    relaxStep();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isRelaxing, atoms.length, bonds.length, relaxNonce]);

  // Rebuild 3D Mesh
  useEffect(() => {
    const group = molGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      group.remove(child);
    }
    atomMeshMapRef.current.clear();

    const bondMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, roughness: 0.35 });

    // Render Atoms
    atoms.forEach((atom) => {
      const el = getElement(atom.element);
      const colorHex = el ? el.cpkColor : '#cbd5e1';
      const radius = atom.element === 'H' ? 0.32 : 0.52;

      const isSelected = atom.id === selectedAtomId;
      const isHovered = atom.id === hoveredAtomId;

      const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.25,
        clearcoat: 0.8,
      });

      if (isSelected) {
        sphereMat.emissive = new THREE.Color(0x38bdf8); // Glowing cyan for selected
        sphereMat.emissiveIntensity = 0.7;
      } else if (isHovered) {
        sphereMat.emissive = new THREE.Color(0xf59e0b); // Gold for hovered
        sphereMat.emissiveIntensity = 0.4;
      }

      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.position.set(...atom.position);
      mesh.userData = { atomId: atom.id };
      mesh.castShadow = true;

      // Add a selection ring around selected atom
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.45, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        mesh.add(ringMesh);

        // Second vertical ring
        const ringGeo2 = new THREE.RingGeometry(radius * 1.3, radius * 1.45, 32);
        const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat);
        mesh.add(ringMesh2);
      }

      // 3D Billboard Sprite showing element symbol and +/- charge sign
      const charge = atom.formalCharge || 0;
      const sprite = createAtomBadgeSprite(atom.element, charge, isSelected);
      sprite.position.set(0, radius + 0.38, 0);
      mesh.add(sprite);

      // If atom has gained/lost electrons, render glowing ion aura
      if (charge !== 0) {
        const auraGeo = new THREE.SphereGeometry(radius * 1.35, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({
          color: charge > 0 ? 0x38bdf8 : 0xf43f5e,
          wireframe: true,
          transparent: true,
          opacity: 0.35,
        });
        mesh.add(new THREE.Mesh(auraGeo, auraMat));
      }

      group.add(mesh);
      atomMeshMapRef.current.set(atom.id, mesh);
    });

    // Render Bonds
    bonds.forEach((bond) => {
      const a1 = atoms.find((a) => a.id === bond.from);
      const a2 = atoms.find((a) => a.id === bond.to);
      if (!a1 || !a2) return;

      const p1 = new THREE.Vector3(...a1.position);
      const p2 = new THREE.Vector3(...a2.position);
      const dist = p1.distanceTo(p2);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const dir = p2.clone().sub(p1).normalize();

      if (bond.order === 1) {
        const bGeo = new THREE.CylinderGeometry(0.08, 0.08, dist, 12);
        const bMesh = new THREE.Mesh(bGeo, bondMat);
        bMesh.position.copy(mid);
        bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        group.add(bMesh);
      } else if (bond.order === 2) {
        const offset = 0.11;
        let perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        if (perp.lengthSq() < 0.01) perp.set(1, 0, 0).cross(dir).normalize();

        [-1, 1].forEach((sign) => {
          const bGeo = new THREE.CylinderGeometry(0.06, 0.06, dist, 12);
          const bMesh = new THREE.Mesh(bGeo, bondMat);
          bMesh.position.copy(mid.clone().addScaledVector(perp, sign * offset));
          bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          group.add(bMesh);
        });
      } else if (bond.order === 3) {
        const offset = 0.12;
        const perp1 = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        const perp2 = dir.clone().cross(perp1).normalize();

        [
          new THREE.Vector3(0, 0, 0),
          perp1.clone().multiplyScalar(offset),
          perp2.clone().multiplyScalar(offset),
        ].forEach((shift) => {
          const bGeo = new THREE.CylinderGeometry(0.05, 0.05, dist, 12);
          const bMesh = new THREE.Mesh(bGeo, bondMat);
          bMesh.position.copy(mid.clone().add(shift));
          bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          group.add(bMesh);
        });
      }
    });

    // Render 3D Bond Angle Arcs & Measurements for Inspected Atom
    const targetInspectAtomId = selectedAtomId;
    if (targetInspectAtomId) {
      const inspectAtom = atoms.find((a) => a.id === targetInspectAtomId);
      if (inspectAtom) {
        const measuredAngles = computeBondAnglesForAtom(inspectAtom, atoms, bonds);
        measuredAngles.forEach((ang) => {
          const a1 = atoms.find((a) => a.id === ang.atom1Id);
          const a2 = atoms.find((a) => a.id === ang.atom2Id);
          if (!a1 || !a2) return;

          const centerPos = new THREE.Vector3(...inspectAtom.position);
          const v1 = new THREE.Vector3(...a1.position).sub(centerPos).normalize();
          const v2 = new THREE.Vector3(...a2.position).sub(centerPos).normalize();

          // Smooth Arc connecting the two bond directions
          const arcRadius = 0.65;
          const points: THREE.Vector3[] = [];
          const segments = 16;
          for (let s = 0; s <= segments; s++) {
            const frac = s / segments;
            const pt = v1.clone().lerp(v2, frac).normalize().multiplyScalar(arcRadius).add(centerPos);
            points.push(pt);
          }
          const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
          const arcMat = new THREE.LineBasicMaterial({
            color: ang.isOptimal ? 0x10b981 : 0xf59e0b,
          });
          group.add(new THREE.Line(arcGeo, arcMat));

          // Angle badge sprite floating at arc midpoint
          const midPt = v1.clone().lerp(v2, 0.5).normalize().multiplyScalar(arcRadius + 0.28).add(centerPos);
          const angleSprite = createAngleBadgeSprite(`${ang.currentAngleDeg}°`, ang.isOptimal);
          angleSprite.position.copy(midPt);
          group.add(angleSprite);
        });
      }
    }
  }, [atoms, bonds, selectedAtomId, sceneReady]);

  // Fast hover highlight without rebuilding scene geometry or canvas textures
  const prevHoveredAtomRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevHoveredAtomRef.current;
    if (prevId && prevId !== selectedAtomId) {
      const mesh = atomMeshMapRef.current.get(prevId);
      if (mesh && (mesh as any).material && ((mesh as any).material as THREE.MeshPhysicalMaterial).emissive) {
        ((mesh as any).material as THREE.MeshPhysicalMaterial).emissive.setHex(0x000000);
        ((mesh as any).material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0;
      }
    }
    if (hoveredAtomId && hoveredAtomId !== selectedAtomId) {
      const mesh = atomMeshMapRef.current.get(hoveredAtomId);
      if (mesh && (mesh as any).material && ((mesh as any).material as THREE.MeshPhysicalMaterial).emissive) {
        ((mesh as any).material as THREE.MeshPhysicalMaterial).emissive.setHex(0xf59e0b);
        ((mesh as any).material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.5;
      }
    }
    prevHoveredAtomRef.current = hoveredAtomId;
  }, [hoveredAtomId, selectedAtomId]);

  // Add new atom
  const handleAddAtom = (elSymbol: string) => {
    soundFx.playReactionStep();
    // Guarantee strictly unique ID across all current atoms
    const existingIds = new Set(atoms.map((a) => a.id));
    let nextNum = 1;
    while (existingIds.has(`${elSymbol}${nextNum}`)) {
      nextNum++;
    }
    const id = `${elSymbol}${nextNum}`;

    // Position according to exact VSEPR coordination geometry of selected atom, or near origin
    let newPos: [number, number, number];
    const selected = atoms.find((a) => a.id === selectedAtomId);
    if (selected) {
      newPos = getNextVSEPRBondPosition(selected, atoms, bonds, 1.45);
    } else {
      newPos = atoms.length === 0 ? [0, 0, 0] : [atoms[atoms.length - 1].position[0] + 1.8, 0, 0];
    }

    const newAtom: MolecularAtom = { id, element: elSymbol, position: newPos };
    const nextAtoms = [...atoms, newAtom];

    // If an atom was already selected, check valence limits before auto-bonding
    if (selected) {
      const specSelected = getMaxBondsForAtom(selected.element, selected.formalCharge || 0);
      const specNew = getMaxBondsForAtom(elSymbol, 0);
      const currentSelectedBonds = getAtomBondsCount(selected.id, bonds);

      if (currentSelectedBonds + selectedBondOrder > specSelected.maxBonds) {
        setAtoms(nextAtoms);
        triggerRelax();
        soundFx.playQuizChime(false);
        setStatusMessage(
          `Added ${elSymbol} (${id}). Could not auto-bond: ${formatAtomWithCharge(selected.element, selected.formalCharge || 0)} (${selected.id}) is at max bonding capacity (${currentSelectedBonds}/${specSelected.maxBonds} bonds with ${specSelected.valenceElectrons} outermost e⁻). Select ${selected.id} and click "Lose e⁻" to expand bonding!`
        );
      } else if (selectedBondOrder > specNew.maxBonds) {
        setAtoms(nextAtoms);
        triggerRelax();
        soundFx.playQuizChime(false);
        setStatusMessage(
          `Added ${elSymbol} (${id}). Could not auto-bond with order ${selectedBondOrder}: ${elSymbol} can only form max ${specNew.maxBonds} bond(s).`
        );
      } else {
        const newBond: MolecularBond = {
          id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          from: selected.id,
          to: id,
          order: selectedBondOrder,
        };
        const nextBonds = [...bonds, newBond];
        if (autoFixBondAnglesRef.current) {
          const fixedAtoms = fixAllBondAngles(nextAtoms, nextBonds);
          setAtoms(fixedAtoms);
        } else {
          setAtoms(nextAtoms);
        }
        setBonds(nextBonds);
        triggerRelax();
        setStatusMessage(`Added ${elSymbol} (${id}), bonded to ${selected.id}, and automatically fixed bond angle to ideal VSEPR geometry!`);
        soundFx.playBondSnap();
      }
    } else {
      setAtoms(nextAtoms);
      triggerRelax();
      setStatusMessage(`Added ${elSymbol} (${id}). Click it to select.`);
    }

    setSelectedAtomId(id);
  };

  // Delete selected atom
  const handleDeleteAtom = () => {
    if (!selectedAtomId) return;
    const remainingAtoms = atoms.filter((a) => a.id !== selectedAtomId);
    const remainingBonds = bonds.filter((b) => b.from !== selectedAtomId && b.to !== selectedAtomId);
    if (autoFixBondAnglesRef.current && remainingAtoms.length > 1) {
      const fixed = fixAllBondAngles(remainingAtoms, remainingBonds);
      setAtoms(fixed);
    } else {
      setAtoms(remainingAtoms);
    }
    setBonds(remainingBonds);
    setSelectedAtomId(null);
    triggerRelax();
    soundFx.playReactionStep();
    setStatusMessage('Deleted selected atom and its connected bonds.');
  };

  // Clear workspace
  const handleClearAll = () => {
    setAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
    setStatusMessage('Cleared workspace. Add atoms to start building.');
  };

  // Auto-connect bonds based on spatial distance (0.8 Å to 1.9 Å)
  const handleAutoConnectProximity = () => {
    soundFx.playBondSnap();
    const newBonds: MolecularBond[] = [...bonds];
    let createdCount = 0;

    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const a1 = atoms[i];
        const a2 = atoms[j];
        const dist = new THREE.Vector3(...a1.position).distanceTo(new THREE.Vector3(...a2.position));

        // If distance between 0.8 Å and 1.9 Å and not already bonded
        if (dist >= 0.7 && dist <= 2.0) {
          const exists = newBonds.some(
            (b) =>
              (b.from === a1.id && b.to === a2.id) ||
              (b.from === a2.id && b.to === a1.id)
          );
          if (!exists) {
            newBonds.push({
              id: `b_auto_${i}_${j}_${Date.now()}`,
              from: a1.id,
              to: a2.id,
              order: 1,
            });
            createdCount++;
          }
        }
      }
    }

    if (autoFixBondAnglesRef.current && atoms.length > 1) {
      const fixed = fixAllBondAngles(atoms, newBonds);
      setAtoms(fixed);
    }
    setBonds(newBonds);
    triggerRelax();
    setStatusMessage(`Auto-connected ${createdCount} bonds based on spatial proximity. Bond angles automatically adjusted.`);
  };

  // Add hydrogens to satisfy standard octets
  const handleAddHydrogens = () => {
    soundFx.playBondSnap();
    const maxValence: Record<string, number> = { C: 4, N: 3, O: 2, P: 5, S: 6, Cl: 1, F: 1 };
    let newAtoms = [...atoms];
    let newBonds = [...bonds];
    const existingIds = new Set(newAtoms.map((a) => a.id));
    let hNum = 1;

    atoms.forEach((atom) => {
      const allowed = maxValence[atom.element];
      if (!allowed) return;

      const currentBonds = newBonds
        .filter((b) => b.from === atom.id || b.to === atom.id)
        .reduce((sum, b) => sum + b.order, 0);

      const neededH = allowed - currentBonds;
      for (let k = 0; k < neededH; k++) {
        while (existingIds.has(`H${hNum}`)) {
          hNum++;
        }
        const hid = `H${hNum}`;
        existingIds.add(hid);
        const hPos = getNextVSEPRBondPosition(atom, newAtoms, newBonds, 1.15);

        newAtoms.push({ id: hid, element: 'H', position: hPos });
        newBonds.push({
          id: `b_${hid}_${atom.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          from: atom.id,
          to: hid,
          order: 1,
        });
      }
    });

    const finalizedAtoms = fixAllBondAngles(newAtoms, newBonds);
    setAtoms(finalizedAtoms);
    setBonds(newBonds);
    triggerRelax();
    setStatusMessage('Added Hydrogen atoms and fixed all bond angles to ideal VSEPR geometry.');
  };

  // Explicitly fix all bond angles in the molecule to VSEPR geometry
  const handleFixBondAngles = () => {
    soundFx.playBondSnap();
    setAtoms((prev) => fixAllBondAngles(prev, bonds));
    triggerRelax();
    setStatusMessage('Fixed all bond angles to exact VSEPR chemical geometries (104.5° bent, 107° pyramidal, 109.5° tetrahedral, 120° planar, 180° linear).');
  };

  // Determine comprehensive molecule identity, formula, and official IUPAC nomenclature
  const moleculeIdentity = useMemo(() => {
    return determineMoleculeIdentity(atoms, bonds);
  }, [atoms, bonds]);

  // Real-time asynchronous PubChem IUPAC confirmation (non-blocking)
  useEffect(() => {
    if (atoms.length === 0 || !moleculeIdentity.hillFormula || moleculeIdentity.hillFormula === 'Empty') {
      setPubchemVerifiedIupac(null);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const cleanFormula = moleculeIdentity.hillFormula.replace(/[^A-Za-z0-9]/g, '');
        if (!cleanFormula) return;
        const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${encodeURIComponent(
          cleanFormula
        )}/property/IUPACName,Title/JSON`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const props = data?.PropertyTable?.Properties;
          if (Array.isArray(props) && props.length > 0) {
            const verified = props[0]?.IUPACName || props[0]?.Title;
            if (verified && typeof verified === 'string') {
              setPubchemVerifiedIupac(verified);
            }
          }
        }
      } catch {
        // PubChem lookup is optional enhancement
      }
    }, 700);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [moleculeIdentity.hillFormula, atoms.length]);

  const synthesizedFormula = moleculeIdentity.formula;

  // Selected atom object
  const activeSelectedAtom = useMemo(() => {
    return atoms.find((a) => a.id === selectedAtomId) || null;
  }, [atoms, selectedAtomId]);

  // Outermost electron & bond capacity spec for selected atom
  const activeSpec = useMemo(() => {
    if (!activeSelectedAtom) return null;
    return getMaxBondsForAtom(activeSelectedAtom.element, activeSelectedAtom.formalCharge || 0);
  }, [activeSelectedAtom]);

  // VSEPR geometry analysis for selected atom
  const selectedAtomVSEPR = useMemo(() => {
    if (!activeSelectedAtom) return null;
    return getAtomVSEPRGeometry(activeSelectedAtom, atoms, bonds);
  }, [activeSelectedAtom, atoms, bonds]);

// Measured bond angles around selected atom
  const measuredAnglesForSelected = useMemo(() => {
    if (!activeSelectedAtom) return [];
    return computeBondAnglesForAtom(activeSelectedAtom, atoms, bonds);
  }, [activeSelectedAtom, atoms, bonds]);

  // Existing bonds for the selected atom
  const selectedAtomBonds = useMemo(() => {
    if (!selectedAtomId) return [];
    return bonds.filter((b) => b.from === selectedAtomId || b.to === selectedAtomId);
  }, [bonds, selectedAtomId]);

  // Current bond order count on selected atom
  const currentSelectedAtomBondsCount = useMemo(() => {
    return selectedAtomBonds.reduce((sum, b) => sum + b.order, 0);
  }, [selectedAtomBonds]);

  // Electron gain/loss handlers
  const handleGainElectron = () => {
    if (!selectedAtomId) return;
    setAtoms((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== selectedAtomId) return a;
        const currentCharge = a.formalCharge || 0;
        const newCharge = currentCharge - 1; // Gained 1 e⁻ => charge becomes more negative
        const spec = getMaxBondsForAtom(a.element, newCharge);
        setStatusMessage(
          `${a.element} gained 1 outermost e⁻ ➔ ${formatAtomWithCharge(a.element, newCharge)} (${spec.valenceElectrons} e⁻). Covalent capacity: ${spec.maxBonds} bonds.`
        );
        soundFx.playReactionStep();
        return { ...a, formalCharge: newCharge };
      });
      return autoFixBondAnglesRef.current && updated.length > 1 ? fixAllBondAngles(updated, bonds) : updated;
    });
    triggerRelax();
  };

  const handleLoseElectron = () => {
    if (!selectedAtomId) return;
    setAtoms((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== selectedAtomId) return a;
        const currentCharge = a.formalCharge || 0;
        const newCharge = currentCharge + 1; // Lost 1 e⁻ => charge becomes more positive
        const spec = getMaxBondsForAtom(a.element, newCharge);
        setStatusMessage(
          `${a.element} lost 1 outermost e⁻ ➔ ${formatAtomWithCharge(a.element, newCharge)} (${spec.valenceElectrons} e⁻). Covalent capacity: ${spec.maxBonds} bonds.`
        );
        soundFx.playReactionStep();
        return { ...a, formalCharge: newCharge };
      });
      return autoFixBondAnglesRef.current && updated.length > 1 ? fixAllBondAngles(updated, bonds) : updated;
    });
    triggerRelax();
  };

  const handleResetElectron = () => {
    if (!selectedAtomId) return;
    setAtoms((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== selectedAtomId) return a;
        const spec = getMaxBondsForAtom(a.element, 0);
        setStatusMessage(`Reset ${a.element} (${a.id}) to neutral atom (${spec.valenceElectrons} outermost e⁻, max ${spec.maxBonds} bonds).`);
        soundFx.playReactionStep();
        return { ...a, formalCharge: 0 };
      });
      return autoFixBondAnglesRef.current && updated.length > 1 ? fixAllBondAngles(updated, bonds) : updated;
    });
    triggerRelax();
  };

  // Atoms that can be connected to the currently selected atom
  const availableTargetAtoms = useMemo(() => {
    if (!selectedAtomId) return [];
    return atoms.filter((a) => a.id !== selectedAtomId);
  }, [atoms, selectedAtomId]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-slate-950 text-slate-100">
      {/* 3D Canvas */}
      <div ref={containerRef} className="relative flex-1 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block outline-none" />

        {/* Top-Left Molecule Formula & Status Badge with Official IUPAC Name */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm sm:max-w-md pointer-events-auto">
          <div className="backdrop-blur-md bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2.5">
            {/* Header: Full Official IUPAC Name (PIN) & Formula */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-cyan-200 font-mono tracking-tight select-all">
                      {moleculeIdentity.iupacName}
                    </h2>
                    {moleculeIdentity.formula !== 'Empty' && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 font-bold border border-sky-500/40 shadow-sm">
                        {moleculeIdentity.formula}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 font-mono mt-0.5">
                    {moleculeIdentity.commonName && moleculeIdentity.commonName.toLowerCase() !== moleculeIdentity.iupacName.toLowerCase() && (
                      <span className="text-slate-300">
                        Common: <span className="text-amber-300 font-semibold">{moleculeIdentity.commonName}</span> •
                      </span>
                    )}
                    <span>
                      {atoms.length} atoms • {bonds.length} bonds • {moleculeIdentity.molarMass > 0 ? `${moleculeIdentity.molarMass} g/mol` : '0 g/mol'}
                    </span>
                  </div>
                </div>
              </div>

              {atoms.length > 0 && (
                <button
                  onClick={() => {
                    setShowIupacInfo(!showIupacInfo);
                    soundFx.playReactionStep();
                  }}
                  className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-1 transition-all ${
                    showIupacInfo
                      ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                  title="Toggle detailed IUPAC nomenclature rules & derivation"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold hidden sm:inline">Rules</span>
                </button>
              )}
            </div>

            {/* Prominent Full Official IUPAC Name (PIN) Showcase Badge */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-sky-950/80 via-slate-900/90 to-indigo-950/80 border border-sky-500/50 shadow-lg shadow-sky-950/40 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 border-b border-sky-800/30 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  <span className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-cyan-300">
                    Full IUPAC Name (PIN)
                  </span>
                </div>
                <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-sky-900/70 border border-sky-600/40 text-sky-200 font-mono font-medium truncate max-w-[170px]">
                  {moleculeIdentity.classification}
                </span>
              </div>

              {/* Main Full IUPAC Name Typography */}
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="text-base sm:text-lg font-black font-mono text-cyan-200 tracking-tight break-words select-all">
                  {moleculeIdentity.iupacName}
                </span>
              </div>

              {/* Systematic / Additive IUPAC Name if distinct from PIN */}
              {moleculeIdentity.systematicIupacName &&
                moleculeIdentity.systematicIupacName.toLowerCase() !== moleculeIdentity.iupacName.toLowerCase() && (
                  <div className="pt-1.5 border-t border-slate-800/80 flex flex-col gap-0.5 text-[10.5px]">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Systematic / Additive IUPAC:
                    </span>
                    <span className="font-mono text-cyan-200 font-semibold select-all break-words">
                      {moleculeIdentity.systematicIupacName}
                    </span>
                  </div>
                )}

              {/* Verified Online IUPAC Tag if PubChem API confirms */}
              {pubchemVerifiedIupac && (
                <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded-lg px-2 py-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">PubChem Verified: {pubchemVerifiedIupac}</span>
                </div>
              )}
            </div>

            {/* Collapsible IUPAC Rules & Nomenclature Details */}
            {showIupacInfo && (
              <div className="p-2.5 rounded-xl bg-slate-950/95 border border-sky-500/30 text-[11px] text-slate-300 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-sky-300 font-semibold text-[11px]">
                  <span className="flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-sky-400" />
                    IUPAC Nomenclature Derivation
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    Net Charge: {moleculeIdentity.netCharge > 0 ? `+${moleculeIdentity.netCharge}` : moleculeIdentity.netCharge}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-300 leading-relaxed font-sans">
                  {moleculeIdentity.iupacRulesNote}
                </p>
                <div className="pt-1 border-t border-slate-800 text-[9.5px] text-slate-400 flex items-center justify-between font-mono">
                  <span>Hill Notation: {moleculeIdentity.hillFormula || 'N/A'}</span>
                  <span>Molar Mass: {moleculeIdentity.molarMass} g/mol</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Helper Banner */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-sky-500/30 text-xs text-sky-200 shadow-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="leading-tight">{statusMessage}</p>
            </div>
          </div>
        </div>

        {/* Selected Atom Bonding Tool HUD (Top-Right) */}
        {activeSelectedAtom && activeSpec && (
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 pointer-events-auto">
            <div className="backdrop-blur-md bg-slate-900/95 border border-slate-800 rounded-2xl p-3 shadow-2xl w-80 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping inline-block" />
                  Selected Atom: {activeSelectedAtom.id}
                </span>
                <button
                  onClick={() => setSelectedAtomId(null)}
                  className="text-slate-400 hover:text-white text-[11px]"
                >
                  Deselect
                </button>
              </div>

              {/* Atom Identity & Outermost Shell Status Badge */}
              <div className="mt-2.5 flex items-center gap-2.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-xl shadow-md border flex-shrink-0"
                  style={{
                    backgroundColor:
                      (activeSelectedAtom.formalCharge || 0) > 0
                        ? '#0284c7'
                        : (activeSelectedAtom.formalCharge || 0) < 0
                        ? '#e11d48'
                        : '#334155',
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: '#ffffff',
                  }}
                  title={`Atom ${activeSelectedAtom.id}: ${formatAtomWithCharge(activeSelectedAtom.element, activeSelectedAtom.formalCharge || 0)}`}
                >
                  {formatAtomWithCharge(activeSelectedAtom.element, activeSelectedAtom.formalCharge || 0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs truncate">
                      {activeSelectedAtom.element} ({activeSpec.baseValence} e⁻ neutral)
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        (activeSelectedAtom.formalCharge || 0) > 0
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : (activeSelectedAtom.formalCharge || 0) < 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {(activeSelectedAtom.formalCharge || 0) > 0
                        ? `+${activeSelectedAtom.formalCharge} (Lost e⁻)`
                        : (activeSelectedAtom.formalCharge || 0) < 0
                        ? `${activeSelectedAtom.formalCharge} (Gained e⁻)`
                        : 'Neutral (0)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    Outermost e⁻: <span className="font-bold text-amber-300">{activeSpec.valenceElectrons}</span> / {activeSpec.octetTarget}
                    {' • '}
                    Capacity: <span className="font-bold text-sky-300">{activeSpec.maxBonds}</span> bonds
                  </p>
                </div>
              </div>

              {/* Electron Gain / Loss Controls */}
              <div className="mt-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-400">Outermost Shell Electrons:</span>
                  <span className="font-mono text-slate-300">
                    Bonds: <span className="font-bold text-white">{currentSelectedAtomBondsCount}</span> / {activeSpec.maxBonds}
                  </span>
                </div>

                {/* Valence Rule Banner requested by user */}
                <div className="p-1.5 rounded-lg bg-sky-950/50 border border-sky-500/30 text-[10px] text-sky-200 leading-tight">
                  <span className="font-bold text-amber-300">Rule:</span> Gain e⁻ = fills shell (makes <span className="font-bold text-rose-300">fewer bonds</span>). Lose e⁻ = frees valence slots (makes <span className="font-bold text-sky-300">more bonds</span>)!
                </div>

                <div className="grid grid-cols-3 gap-1 mt-0.5">
                  <button
                    onClick={handleGainElectron}
                    className="px-2 py-1.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/45 text-rose-200 border border-rose-500/40 text-[10px] font-semibold flex flex-col items-center justify-center transition-all leading-none py-2"
                    title="Gain 1 electron into outermost shell (charge -1). Atom fills lone pairs, so it makes FEWER bonds!"
                  >
                    <span className="font-bold">+ Gain e⁻ (-)</span>
                    <span className="text-[8px] text-rose-300/80 mt-0.5 font-normal">Less Bonds</span>
                  </button>
                  <button
                    onClick={handleLoseElectron}
                    className="px-2 py-1.5 rounded-lg bg-sky-600/25 hover:bg-sky-600/45 text-sky-200 border border-sky-500/40 text-[10px] font-semibold flex flex-col items-center justify-center transition-all leading-none py-2"
                    title="Lose 1 electron from outermost shell (charge +1). Atom frees valence orbitals, so it makes MORE bonds!"
                  >
                    <span className="font-bold">- Lose e⁻ (+)</span>
                    <span className="text-[8px] text-sky-300/80 mt-0.5 font-normal">More Bonds</span>
                  </button>
                  <button
                    onClick={handleResetElectron}
                    disabled={!activeSelectedAtom.formalCharge}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 text-[10px] font-medium flex items-center justify-center transition-all"
                    title="Reset to neutral atom charge"
                  >
                    <span>Reset (0)</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight italic mt-0.5">
                  {activeSpec.explanation}
                </p>
              </div>

              {/* VSEPR Geometry & Bond Angles Inspector */}
              {selectedAtomVSEPR && (
                <div className="mt-2.5 p-2.5 bg-slate-950/80 rounded-xl border border-sky-500/30 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sky-300 font-bold text-xs">
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      <span>{selectedAtomVSEPR.name} Geometry</span>
                    </div>
                    <span className="text-[9px] font-mono text-sky-300 bg-sky-950/70 border border-sky-500/40 px-1.5 py-0.5 rounded font-bold">
                      {selectedAtomVSEPR.hybridization}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
                    <span>
                      Ideal Angle: <strong className="text-amber-300 font-bold">{selectedAtomVSEPR.idealAngleDeg.toFixed(1)}°</strong>
                    </span>
                    <span className="text-slate-400">
                      Steric #: {selectedAtomVSEPR.stericNumber} ({selectedAtomVSEPR.bondedCount}b + {selectedAtomVSEPR.lonePairs}lp)
                    </span>
                  </div>

                  {/* Live measured angles if >= 2 bonds */}
                  {measuredAnglesForSelected.length > 0 ? (
                    <div className="flex flex-col gap-1 mt-1 pt-1.5 border-t border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Live Measured Bond Angles:</span>
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-0.5">
                        {measuredAnglesForSelected.map((ma, idx) => {
                          const diff = Math.abs(ma.currentAngleDeg - ma.idealAngleDeg);
                          const isClose = diff < 2.5;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-mono border ${
                                isClose
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                              }`}
                            >
                              <span>
                                {ma.atom1Id}—<strong className="text-white">{activeSelectedAtom.id}</strong>—{ma.atom2Id}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">{ma.currentAngleDeg.toFixed(1)}°</span>
                                <span className={`text-[9px] ${isClose ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {isClose ? '✓ Exact' : `(Δ ${diff.toFixed(1)}°)`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      Connect 2 or more atoms to measure live bond angles.
                    </p>
                  )}

                  <button
                    onClick={handleFixBondAngles}
                    className="mt-1 w-full py-1.5 px-2 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Enforces exact VSEPR geometry angles on all bonds"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fix Bond Angles to Ideal {selectedAtomVSEPR.idealAngleDeg.toFixed(1)}°</span>
                  </button>
                </div>
              )}

              {/* Direct 1-Click Connect to Other Atoms List */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-slate-400">
                    1-Click Bond to Another Atom:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Order: {selectedBondOrder === 1 ? 'Single (-)' : selectedBondOrder === 2 ? 'Double (=)' : 'Triple (≡)'}
                  </span>
                </div>
                {availableTargetAtoms.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No other atoms in workspace. Add more atoms below.</p>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {availableTargetAtoms.map((target, idx) => {
                      const isBonded = bonds.some(
                        (b) =>
                          (b.from === activeSelectedAtom.id && b.to === target.id) ||
                          (b.from === target.id && b.to === activeSelectedAtom.id)
                      );
                      const currentBond = bonds.find(
                        (b) =>
                          (b.from === activeSelectedAtom.id && b.to === target.id) ||
                          (b.from === target.id && b.to === activeSelectedAtom.id)
                      );

                      const targetLabel = `${formatAtomWithCharge(target.element, target.formalCharge || 0)} (${target.id})`;

                      return (
                        <button
                          key={`${target.id}-${idx}`}
                          onClick={() => connectOrToggleBond(activeSelectedAtom.id, target.id, selectedBondOrder)}
                          className={`px-2 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1 transition-all ${
                            isBonded
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                          title={`Click to connect/toggle bond with ${targetLabel}`}
                        >
                          <Link className="w-3 h-3" />
                          <span>{targetLabel}</span>
                          {currentBond && (
                            <span className="text-[10px] text-amber-300 ml-0.5">
                              {currentBond.order === 1 ? '(-)' : currentBond.order === 2 ? '(=)' : '(≡)'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Existing Bonds on this atom with disconnect option */}
              {selectedAtomBonds.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">Connected Bonds:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAtomBonds.map((b, idx) => {
                      const otherId = b.from === activeSelectedAtom.id ? b.to : b.from;
                      return (
                        <button
                          key={`${b.id}-${idx}`}
                          onClick={() => setBonds(bonds.filter((x) => x.id !== b.id))}
                          className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono flex items-center gap-1"
                          title="Click to remove bond"
                        >
                          <Unlink className="w-2.5 h-2.5" />
                          <span>{otherId} ({b.order === 1 ? 'Single' : b.order === 2 ? 'Double' : 'Triple'}) ×</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Controls on Canvas (Right-Side) */}
        <div className="absolute right-2 sm:right-4 bottom-14 sm:bottom-24 z-10 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={() => {
              const nextVal = !autoFixBondAngles;
              setAutoFixBondAngles(nextVal);
              if (nextVal) {
                setAtoms((prev) => fixAllBondAngles(prev, bonds));
                triggerRelax();
                setStatusMessage('Auto-Fix Bond Angles enabled: VSEPR geometry is automatically maintained on every edit.');
              } else {
                setStatusMessage('Auto-Fix Bond Angles paused. You can still snap bond angles manually.');
              }
            }}
            className={`p-2.5 rounded-xl border shadow-lg transition-all ${
              autoFixBondAngles
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 ring-1 ring-emerald-500/40 hover:bg-emerald-600/40'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
            title={`Auto-Fix Bond Angles (${autoFixBondAngles ? 'Active: ON' : 'Paused: OFF'}): Automatically calculates and enforces exact VSEPR angles on every bond/atom`}
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsRelaxing(!isRelaxing)}
            className={`p-2.5 rounded-xl border border-slate-800 shadow-lg transition-all ${
              isRelaxing ? 'bg-sky-500 text-white' : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200'
            }`}
            title={isRelaxing ? 'Pause 3D VSEPR Relaxation' : 'Enable 3D Relaxation'}
          >
            <Wand2 className="w-4 h-4" />
          </button>
          {selectedAtomId && (
            <button
              onClick={handleDeleteAtom}
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all"
              title="Delete Selected Atom"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all"
            title="Clear All Atoms"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unified Bottom Control Dock */}
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
              <span className="truncate">Molecule Builder & VSEPR Assembly</span>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                [{atoms.length} atoms, {bonds.length} bonds]
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-medium text-sky-300">
              <span>{dockCollapsed ? '▴ Expand Palette' : '▾ Collapse Palette'}</span>
            </div>
          </div>

          <div className="p-2.5 sm:p-3 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100dvh-7.5rem)] sm:max-h-[55dvh] scrollbar-thin scrollbar-thumb-slate-700">
            {/* Top Row: Palette + Bond Order + Smart Helpers */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Add Atom Palette */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">Add Atom:</span>
              <div className="flex gap-1.5">
                {PALETTE_ELEMENTS.map((el) => (
                  <button
                    key={el.symbol}
                    onClick={() => handleAddAtom(el.symbol)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono border hover:scale-110 active:scale-95 transition-all shadow-sm"
                    style={{
                      backgroundColor: el.color === '#FFFFFF' ? '#475569' : el.color,
                      borderColor: 'rgba(255,255,255,0.3)',
                      color: '#ffffff',
                    }}
                    title={`Add ${el.name} (${el.symbol}) - Max ${el.maxBonds} bonds`}
                  >
                    {el.symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Bond Order Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Order:</span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {([1, 2, 3] as const).map((ord) => (
                  <button
                    key={ord}
                    onClick={() => setSelectedBondOrder(ord)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      selectedBondOrder === ord
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {ord === 1 ? 'Single (—)' : ord === 2 ? 'Double (=)' : 'Triple (≡)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Chemistry Assistants */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const nextVal = !autoFixBondAngles;
                  setAutoFixBondAngles(nextVal);
                  if (nextVal) {
                    setAtoms((prev) => fixAllBondAngles(prev, bonds));
                    triggerRelax();
                    setStatusMessage('Auto-Fix Bond Angles enabled: VSEPR geometry is automatically enforced upon any structure change.');
                  } else {
                    setStatusMessage('Auto-Fix Bond Angles paused. You can still snap bond angles manually.');
                  }
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                  autoFixBondAngles
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
                title={autoFixBondAngles ? 'Auto-Fix Bond Angles is ACTIVE (Click to toggle manual mode)' : 'Enable Auto-Fix Bond Angles (VSEPR geometry)'}
              >
                <Compass className={`w-3.5 h-3.5 ${autoFixBondAngles ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>Auto-Fix: <strong className={autoFixBondAngles ? 'text-emerald-300' : 'text-slate-400'}>{autoFixBondAngles ? 'ON' : 'OFF'}</strong></span>
              </button>
              <button
                onClick={handleFixBondAngles}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all"
                title="Enforces exact VSEPR chemical bond angles on all bonded atoms (104.5° bent, 107° pyramidal, 109.5° tetrahedral, 120° planar, 180° linear)"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Snap Angles</span>
              </button>
              <button
                onClick={handleAutoConnectProximity}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all"
                title="Automatically connects bonds between atoms close to each other in 3D"
              >
                <Link className="w-3.5 h-3.5" />
                <span>Auto-Bond</span>
              </button>
              <button
                onClick={handleAddHydrogens}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all"
                title="Fills open valences with Hydrogens and aligns to VSEPR angles (e.g. C to CH4, O to H2O)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Hydrogens</span>
              </button>
            </div>
          </div>

          {/* Preset Starters with exact VSEPR Geometry */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 gap-1.5">
            <span className="hidden sm:inline">How to bond: Select any atom in 3D, then click a second atom.</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-300">VSEPR Templates:</span>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'O1', element: 'O', position: [0, 0, 0] },
                    { id: 'H1', element: 'H', position: [-1.146, -0.888, 0] },
                    { id: 'H2', element: 'H', position: [1.146, -0.888, 0] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'O1', to: 'H1', order: 1 },
                    { id: 'b2', from: 'O1', to: 'H2', order: 1 },
                  ]);
                  setSelectedAtomId('O1');
                  triggerRelax();
                  setStatusMessage('Loaded Water (H₂O) — IUPAC: Oxidane (Bent geometry, 104.5° bond angle).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Water (H2O) — IUPAC: Oxidane"
              >
                H₂O (104.5°)
              </button>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'N1', element: 'N', position: [0, 0.25, 0] },
                    { id: 'H1', element: 'H', position: [1.346, 0.25, -0.539] },
                    { id: 'H2', element: 'H', position: [-0.673, 1.416, -0.539] },
                    { id: 'H3', element: 'H', position: [-0.673, -0.916, -0.539] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'N1', to: 'H1', order: 1 },
                    { id: 'b2', from: 'N1', to: 'H2', order: 1 },
                    { id: 'b3', from: 'N1', to: 'H3', order: 1 },
                  ]);
                  setSelectedAtomId('N1');
                  triggerRelax();
                  setStatusMessage('Loaded Ammonia (NH₃) — IUPAC: Azane (Trigonal pyramidal, 107.0° bond angles).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Ammonia (NH3) — IUPAC: Azane"
              >
                NH₃ (107°)
              </button>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'C1', element: 'C', position: [0, 0, 0] },
                    { id: 'H1', element: 'H', position: [0.837, 0.837, 0.837] },
                    { id: 'H2', element: 'H', position: [-0.837, -0.837, 0.837] },
                    { id: 'H3', element: 'H', position: [-0.837, 0.837, -0.837] },
                    { id: 'H4', element: 'H', position: [0.837, -0.837, -0.837] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'C1', to: 'H1', order: 1 },
                    { id: 'b2', from: 'C1', to: 'H2', order: 1 },
                    { id: 'b3', from: 'C1', to: 'H3', order: 1 },
                    { id: 'b4', from: 'C1', to: 'H4', order: 1 },
                  ]);
                  setSelectedAtomId('C1');
                  triggerRelax();
                  setStatusMessage('Loaded Methane (CH₄) — IUPAC: Methane (Tetrahedral, 109.5° bond angles).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Methane (CH4) — IUPAC: Methane"
              >
                CH₄ (109.5°)
              </button>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'C1', element: 'C', position: [0, 0, 0] },
                    { id: 'O1', element: 'O', position: [1.45, 0, 0] },
                    { id: 'O2', element: 'O', position: [-1.45, 0, 0] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'C1', to: 'O1', order: 2 },
                    { id: 'b2', from: 'C1', to: 'O2', order: 2 },
                  ]);
                  setSelectedAtomId('C1');
                  triggerRelax();
                  setStatusMessage('Loaded Carbon Dioxide (CO₂) — IUPAC: Carbon dioxide (Linear, 180.0° bond angle).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Carbon Dioxide (CO2) — IUPAC: Carbon dioxide"
              >
                CO₂ (180°)
              </button>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'B1', element: 'B', position: [0, 0, 0] },
                    { id: 'F1', element: 'F', position: [1.45, 0, 0] },
                    { id: 'F2', element: 'F', position: [-0.725, 1.256, 0] },
                    { id: 'F3', element: 'F', position: [-0.725, -1.256, 0] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'B1', to: 'F1', order: 1 },
                    { id: 'b2', from: 'B1', to: 'F2', order: 1 },
                    { id: 'b3', from: 'B1', to: 'F3', order: 1 },
                  ]);
                  setSelectedAtomId('B1');
                  triggerRelax();
                  setStatusMessage('Loaded Boron Trifluoride (BF₃) — IUPAC: Trifluoroborane (Trigonal planar, 120.0° angles).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Boron Trifluoride (BF3) — IUPAC: Trifluoroborane"
              >
                BF₃ (120°)
              </button>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'O1', element: 'O', position: [0, 0.25, 0], formalCharge: 1 },
                    { id: 'H1', element: 'H', position: [1.346, 0.25, -0.539] },
                    { id: 'H2', element: 'H', position: [-0.673, 1.416, -0.539] },
                    { id: 'H3', element: 'H', position: [-0.673, -0.916, -0.539] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'O1', to: 'H1', order: 1 },
                    { id: 'b2', from: 'O1', to: 'H2', order: 1 },
                    { id: 'b3', from: 'O1', to: 'H3', order: 1 },
                  ]);
                  setSelectedAtomId('O1');
                  triggerRelax();
                  setStatusMessage('Loaded Hydronium Ion (H₃O⁺) — IUPAC: Oxidanium (Onium cation with 3 pyramidal bonds).');
                }}
                className="px-2 py-0.5 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-500/40 text-sky-200 font-bold"
                title="Hydronium Ion (H3O+) — IUPAC: Oxidanium"
              >
                H₃O⁺
              </button>
              <button
                onClick={() => {
                  setAtoms([
                    { id: 'N1', element: 'N', position: [0, 0, 0], formalCharge: 1 },
                    { id: 'H1', element: 'H', position: [0.837, 0.837, 0.837] },
                    { id: 'H2', element: 'H', position: [-0.837, -0.837, 0.837] },
                    { id: 'H3', element: 'H', position: [-0.837, 0.837, -0.837] },
                    { id: 'H4', element: 'H', position: [0.837, -0.837, -0.837] },
                  ]);
                  setBonds([
                    { id: 'b1', from: 'N1', to: 'H1', order: 1 },
                    { id: 'b2', from: 'N1', to: 'H2', order: 1 },
                    { id: 'b3', from: 'N1', to: 'H3', order: 1 },
                    { id: 'b4', from: 'N1', to: 'H4', order: 1 },
                  ]);
                  setSelectedAtomId('N1');
                  triggerRelax();
                  setStatusMessage('Loaded Ammonium Ion (NH₄⁺) — IUPAC: Azanium (Onium cation with 4 tetrahedral bonds).');
                }}
                className="px-2 py-0.5 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-500/40 text-sky-200 font-bold"
                title="Ammonium Ion (NH4+) — IUPAC: Azanium"
              >
                NH₄⁺
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
