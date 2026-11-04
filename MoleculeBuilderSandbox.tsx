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
} from 'lucide-react';

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
    if (Math.abs(v1.dot(up)) > 0.9) up = new THREE.Vector3(1, 0, 0);
    const perp = up.clone().cross(v1).normalize();

    if (vsepr.idealAngleDeg >= 170) {
      const dir = v1.clone().negate();
      return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
    }

    const angleRad = (vsepr.idealAngleDeg * Math.PI) / 180;
    const dir = v1.clone().applyAxisAngle(perp, angleRad).normalize();
    return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
  }

  if (existingVectors.length === 2) {
    const v1 = existingVectors[0];
    const v2 = existingVectors[1];
    const normal = v1.clone().cross(v2).normalize();
    const bisector = v1.clone().add(v2).normalize();

    if (vsepr.name.startsWith('Trigonal Planar')) {
      const dir = bisector.clone().negate().normalize();
      return [parentPos.x + dir.x * bondLength, parentPos.y + dir.y * bondLength, parentPos.z + dir.z * bondLength];
    }

    const dir = bisector.clone().negate().addScaledVector(normal, 1.1).normalize();
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

// Function to analytically fix and snap all bond angles to exact VSEPR geometries
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

  centers.forEach((center) => {
    const connectedBonds = currentBonds.filter((b) => b.from === center.id || b.to === center.id);
    const neighborIds = connectedBonds.map((b) => (b.from === center.id ? b.to : b.from));
    const neighbors = neighborIds
      .map((id) => nextAtoms.find((a) => a.id === id))
      .filter((a): a is MolecularAtom => !!a);

    const k = neighbors.length;
    if (k < 2) return;

    const vsepr = getAtomVSEPRGeometry(center, nextAtoms, currentBonds);
    const centerPos = new THREE.Vector3(...center.position);

    // 2-Bond Systems: Linear (180°), Bent 120°, Bent 104.5°
    if (k === 2) {
      const a1 = neighbors[0];
      const a2 = neighbors[1];
      const v1 = new THREE.Vector3(...a1.position).sub(centerPos);
      const v2 = new THREE.Vector3(...a2.position).sub(centerPos);

      if (vsepr.idealAngleDeg >= 170) {
        const dir1 = v1.lengthSq() > 0.01 ? v1.normalize() : new THREE.Vector3(1, 0, 0);
        a1.position = [centerPos.x + dir1.x * targetBondLength, centerPos.y + dir1.y * targetBondLength, centerPos.z + dir1.z * targetBondLength];
        a2.position = [centerPos.x - dir1.x * targetBondLength, centerPos.y - dir1.y * targetBondLength, centerPos.z - dir1.z * targetBondLength];
      } else {
        const theta0Rad = (vsepr.idealAngleDeg * Math.PI) / 180;
        const halfAngle = theta0Rad / 2;

        let bisector = v1.clone().normalize().add(v2.clone().normalize()).normalize();
        if (bisector.lengthSq() < 0.01) {
          bisector = new THREE.Vector3(0, -1, 0);
        }

        let normal = v1.clone().cross(v2).normalize();
        if (normal.lengthSq() < 0.01) {
          let up = new THREE.Vector3(0, 0, 1);
          if (Math.abs(bisector.dot(up)) > 0.9) up = new THREE.Vector3(0, 1, 0);
          normal = bisector.clone().cross(up).normalize();
        }

        const dir1 = bisector.clone().applyAxisAngle(normal, -halfAngle).normalize();
        const dir2 = bisector.clone().applyAxisAngle(normal, halfAngle).normalize();

        a1.position = [centerPos.x + dir1.x * targetBondLength, centerPos.y + dir1.y * targetBondLength, centerPos.z + dir1.z * targetBondLength];
        a2.position = [centerPos.x + dir2.x * targetBondLength, centerPos.y + dir2.y * targetBondLength, centerPos.z + dir2.z * targetBondLength];
      }
    }
    // 3-Bond Systems: Trigonal Planar (120°) or Trigonal Pyramidal (107°)
    else if (k === 3) {
      const a1 = neighbors[0];
      const a2 = neighbors[1];
      const a3 = neighbors[2];
      const v1 = new THREE.Vector3(...a1.position).sub(centerPos);
      const v2 = new THREE.Vector3(...a2.position).sub(centerPos);

      let normal = v1.clone().cross(v2).normalize();
      if (normal.lengthSq() < 0.01) normal = new THREE.Vector3(0, 0, 1);

      let dir1 = v1.lengthSq() > 0.01 ? v1.clone().normalize() : new THREE.Vector3(1, 0, 0);

      if (vsepr.name.startsWith('Trigonal Pyramidal')) {
        const alpha = (68.16 * Math.PI) / 180; // for 107.0° between bonds
        const sinA = Math.sin(alpha);
        const cosA = Math.cos(alpha);

        let perp1 = dir1.clone().sub(normal.clone().multiplyScalar(dir1.dot(normal))).normalize();
        if (perp1.lengthSq() < 0.01) perp1 = new THREE.Vector3(1, 0, 0);
        const perp2 = normal.clone().cross(perp1).normalize();

        const dirs = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((phi) => {
          return perp1
            .clone()
            .multiplyScalar(sinA * Math.cos(phi))
            .add(perp2.clone().multiplyScalar(sinA * Math.sin(phi)))
            .add(normal.clone().multiplyScalar(-cosA))
            .normalize();
        });

        a1.position = [centerPos.x + dirs[0].x * targetBondLength, centerPos.y + dirs[0].y * targetBondLength, centerPos.z + dirs[0].z * targetBondLength];
        a2.position = [centerPos.x + dirs[1].x * targetBondLength, centerPos.y + dirs[1].y * targetBondLength, centerPos.z + dirs[1].z * targetBondLength];
        a3.position = [centerPos.x + dirs[2].x * targetBondLength, centerPos.y + dirs[2].y * targetBondLength, centerPos.z + dirs[2].z * targetBondLength];
      } else {
        dir1 = dir1.sub(normal.clone().multiplyScalar(dir1.dot(normal))).normalize();
        const dir2 = dir1.clone().applyAxisAngle(normal, (2 * Math.PI) / 3).normalize();
        const dir3 = dir1.clone().applyAxisAngle(normal, (4 * Math.PI) / 3).normalize();

        a1.position = [centerPos.x + dir1.x * targetBondLength, centerPos.y + dir1.y * targetBondLength, centerPos.z + dir1.z * targetBondLength];
        a2.position = [centerPos.x + dir2.x * targetBondLength, centerPos.y + dir2.y * targetBondLength, centerPos.z + dir2.z * targetBondLength];
        a3.position = [centerPos.x + dir3.x * targetBondLength, centerPos.y + dir3.y * targetBondLength, centerPos.z + dir3.z * targetBondLength];
      }
    }
    // 4-Bond Systems: Tetrahedral (109.47°)
    else if (k === 4) {
      const invSqrt3 = 1 / Math.sqrt(3);
      const tetraDirs = [
        new THREE.Vector3(invSqrt3, invSqrt3, invSqrt3),
        new THREE.Vector3(invSqrt3, -invSqrt3, -invSqrt3),
        new THREE.Vector3(-invSqrt3, invSqrt3, -invSqrt3),
        new THREE.Vector3(-invSqrt3, -invSqrt3, invSqrt3),
      ];

      const v0 = new THREE.Vector3(...neighbors[0].position).sub(centerPos).normalize();
      const rotQuat = new THREE.Quaternion().setFromUnitVectors(tetraDirs[0], v0);
      tetraDirs.forEach((td) => td.applyQuaternion(rotQuat));

      neighbors.forEach((nbr, idx) => {
        const d = tetraDirs[idx];
        nbr.position = [centerPos.x + d.x * targetBondLength, centerPos.y + d.y * targetBondLength, centerPos.z + d.z * targetBondLength];
      });
    }
  });

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

export const MoleculeBuilderSandbox: React.FC<MoleculeBuilderSandboxProps> = ({
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Builder Atoms & Bonds state (Initial state: Water H₂O at exact 104.5° bent VSEPR angle)
  const [atoms, setAtoms] = useState<MolecularAtom[]>([
    { id: 'O1', element: 'O', position: [0, 0, 0] },
    { id: 'H1', element: 'H', position: [-1.146, -0.888, 0] },
    { id: 'H2', element: 'H', position: [1.146, -0.888, 0] },
  ]);

  const [bonds, setBonds] = useState<MolecularBond[]>([
    { id: 'b1', from: 'O1', to: 'H1', order: 1 },
    { id: 'b2', from: 'O1', to: 'H2', order: 1 },
  ]);

  // Selected atom for bonding / manipulation
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>('O1');
  const [selectedBondOrder, setSelectedBondOrder] = useState<1 | 2 | 3>(1);
  const [isRelaxing, setIsRelaxing] = useState<boolean>(true);
  const [hoveredAtomId, setHoveredAtomId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Click an atom to select, then click another atom to bond them together.');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

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
        setBonds(next);
        soundFx.playBondSnap();
        setStatusMessage(`Upgraded bond between ${atomAId} and ${atomBId} to ${nextOrder === 2 ? 'Double Bond (=)' : 'Triple Bond (≡)'}.`);
      } else {
        // Remove bond
        setBonds(currentBonds.filter((_, i) => i !== existingIndex));
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
      setBonds([...currentBonds, newBond]);
      soundFx.playBondSnap();
      setStatusMessage(`Created bond between ${atomAId} and ${atomBId}!`);
    }
  }, [getAtomBondsCount]);

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
    };
  }, [theme, handleAtomClick]);

  // VSEPR Force-Directed 3D Relaxation Loop
  useEffect(() => {
    if (!isRelaxing || atoms.length <= 1) return;

    let timeoutId: NodeJS.Timeout;
    const relaxStep = () => {
      setAtoms((prevAtoms) => {
        const next = prevAtoms.map((a) => ({
          ...a,
          position: [...a.position] as [number, number, number],
        }));

        const targetBondLength = 1.45; // Equilibrium covalent bond distance in Ångströms

        // 1. Hooke's Law Spring Forces on bonds (lengths)
        bondsRef.current.forEach((bond) => {
          const a1 = next.find((a) => a.id === bond.from);
          const a2 = next.find((a) => a.id === bond.to);
          if (!a1 || !a2) return;

          const p1 = new THREE.Vector3(...a1.position);
          const p2 = new THREE.Vector3(...a2.position);
          const delta = p2.clone().sub(p1);
          const currentDist = delta.length();
          if (currentDist < 0.001) return;

          const displacement = currentDist - targetBondLength;
          const forceMag = displacement * 0.12;
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
          const cnt = bondsRef.current.filter((b) => b.from === atom.id || b.to === atom.id).length;
          return cnt >= 2;
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

              const u1 = v1.clone().multiplyScalar(1 / d1);
              const u2 = v2.clone().multiplyScalar(1 / d2);

              const dot = Math.max(-0.9999, Math.min(0.9999, u1.dot(u2)));
              const currentAngle = Math.acos(dot);

              let targetAngle = (vsepr.idealAngleDeg * Math.PI) / 180;
              if (vsepr.name.startsWith('Octahedral') || vsepr.name.startsWith('Square Planar')) {
                targetAngle = currentAngle > (135 * Math.PI) / 180 ? Math.PI : Math.PI / 2;
              }

              const angleError = currentAngle - targetAngle;
              if (Math.abs(angleError) < 0.001) continue;

              // Orthogonal in-plane vectors pointing toward each other
              const sinVal = Math.sqrt(Math.max(1e-6, 1 - dot * dot));
              const n1 = u2.clone().addScaledVector(u1, -dot).multiplyScalar(1 / sinVal);
              const n2 = u1.clone().addScaledVector(u2, -dot).multiplyScalar(1 / sinVal);

              const kAngle = 0.085;
              const shiftMag = kAngle * angleError;

              // Rotate bonds toward ideal VSEPR angle
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

        // 3. Van der Waals Repulsion with 1-3 exclusion (so non-bonded repulsion does not distort bond angles)
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
            if (bondedOr13Pair.has(`${a1.id}_${a2.id}`)) continue; // 1-2 and 1-3 exclusion!

            const p1 = new THREE.Vector3(...a1.position);
            const p2 = new THREE.Vector3(...a2.position);
            const delta = p2.clone().sub(p1);
            const dist = delta.length();
            if (dist < 0.1 || dist > 3.0) continue;

            const repulseMag = 0.08 / (dist * dist);
            const dir = delta.normalize();

            a1.position[0] -= dir.x * repulseMag;
            a1.position[1] -= dir.y * repulseMag;
            a1.position[2] -= dir.z * repulseMag;

            a2.position[0] += dir.x * repulseMag;
            a2.position[1] += dir.y * repulseMag;
            a2.position[2] += dir.z * repulseMag;
          }
        }

        return next;
      });

      timeoutId = setTimeout(relaxStep, 50);
    };

    relaxStep();
    return () => clearTimeout(timeoutId);
  }, [isRelaxing, atoms.length]);

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
    const targetInspectAtomId = selectedAtomId || hoveredAtomId;
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
  }, [atoms, bonds, selectedAtomId, hoveredAtomId]);

  // Add new atom
  const handleAddAtom = (elSymbol: string) => {
    soundFx.playReactionStep();
    const countSame = atoms.filter((a) => a.element === elSymbol).length + 1;
    const id = `${elSymbol}${countSame}`;

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
    setAtoms(nextAtoms);

    // If an atom was already selected, check valence limits before auto-bonding
    if (selected) {
      const specSelected = getMaxBondsForAtom(selected.element, selected.formalCharge || 0);
      const specNew = getMaxBondsForAtom(elSymbol, 0);
      const currentSelectedBonds = getAtomBondsCount(selected.id, bonds);

      if (currentSelectedBonds + selectedBondOrder > specSelected.maxBonds) {
        soundFx.playQuizChime(false);
        setStatusMessage(
          `Added ${elSymbol} (${id}). Could not auto-bond: ${formatAtomWithCharge(selected.element, selected.formalCharge || 0)} (${selected.id}) is at max bonding capacity (${currentSelectedBonds}/${specSelected.maxBonds} bonds with ${specSelected.valenceElectrons} outermost e⁻). Select ${selected.id} and click "Lose e⁻" to expand bonding!`
        );
      } else if (selectedBondOrder > specNew.maxBonds) {
        soundFx.playQuizChime(false);
        setStatusMessage(
          `Added ${elSymbol} (${id}). Could not auto-bond with order ${selectedBondOrder}: ${elSymbol} can only form max ${specNew.maxBonds} bond(s).`
        );
      } else {
        const newBond: MolecularBond = {
          id: `b_${Date.now()}`,
          from: selected.id,
          to: id,
          order: selectedBondOrder,
        };
        setBonds([...bonds, newBond]);
        setStatusMessage(`Added ${elSymbol} (${id}) and bonded to ${formatAtomWithCharge(selected.element, selected.formalCharge || 0)} (${selected.id})!`);
        soundFx.playBondSnap();
      }
    } else {
      setStatusMessage(`Added ${elSymbol} (${id}). Click it to select.`);
    }

    setSelectedAtomId(id);
  };

  // Delete selected atom
  const handleDeleteAtom = () => {
    if (!selectedAtomId) return;
    setAtoms(atoms.filter((a) => a.id !== selectedAtomId));
    setBonds(bonds.filter((b) => b.from !== selectedAtomId && b.to !== selectedAtomId));
    setSelectedAtomId(null);
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

    setBonds(newBonds);
    setStatusMessage(`Auto-connected ${createdCount} bonds based on spatial proximity.`);
  };

  // Add hydrogens to satisfy standard octets
  const handleAddHydrogens = () => {
    soundFx.playBondSnap();
    const maxValence: Record<string, number> = { C: 4, N: 3, O: 2, P: 5, S: 6, Cl: 1, F: 1 };
    let newAtoms = [...atoms];
    let newBonds = [...bonds];
    let hCounter = newAtoms.filter((a) => a.element === 'H').length;

    atoms.forEach((atom) => {
      const allowed = maxValence[atom.element];
      if (!allowed) return;

      const currentBonds = newBonds
        .filter((b) => b.from === atom.id || b.to === atom.id)
        .reduce((sum, b) => sum + b.order, 0);

      const neededH = allowed - currentBonds;
      for (let k = 0; k < neededH; k++) {
        hCounter++;
        const hid = `H${hCounter}`;
        const hPos = getNextVSEPRBondPosition(atom, newAtoms, newBonds, 1.15);

        newAtoms.push({ id: hid, element: 'H', position: hPos });
        newBonds.push({ id: `b_${hid}_${atom.id}`, from: atom.id, to: hid, order: 1 });
      }
    });

    const finalizedAtoms = fixAllBondAngles(newAtoms, newBonds);
    setAtoms(finalizedAtoms);
    setBonds(newBonds);
    setStatusMessage('Added Hydrogen atoms and fixed all bond angles to ideal VSEPR geometry.');
  };

  // Explicitly fix all bond angles in the molecule to VSEPR geometry
  const handleFixBondAngles = () => {
    soundFx.playBondSnap();
    setAtoms((prev) => {
      const fixed = fixAllBondAngles(prev, bonds);
      return fixed;
    });
    setStatusMessage('Fixed all bond angles to exact VSEPR chemical geometries (104.5° bent, 107° pyramidal, 109.5° tetrahedral, 120° planar, 180° linear).');
  };

  // Identify synthesized chemical formula with net charge
  const synthesizedFormula = useMemo(() => {
    if (atoms.length === 0) return 'Empty Workspace';
    const counts: Record<string, number> = {};
    let netCharge = 0;

    atoms.forEach((a) => {
      counts[a.element] = (counts[a.element] || 0) + 1;
      netCharge += a.formalCharge || 0;
    });

    let res = '';
    if (counts['C']) {
      res += `C${counts['C'] > 1 ? counts['C'] : ''}`;
      delete counts['C'];
      if (counts['H']) {
        res += `H${counts['H'] > 1 ? counts['H'] : ''}`;
        delete counts['H'];
      }
    }
    Object.keys(counts)
      .sort()
      .forEach((el) => {
        res += `${el}${counts[el] > 1 ? counts[el] : ''}`;
      });

    let chargeSign = '';
    if (netCharge > 0) {
      chargeSign = netCharge === 1 ? '⁺' : `${netCharge}⁺`;
    } else if (netCharge < 0) {
      chargeSign = netCharge === -1 ? '⁻' : `${Math.abs(netCharge)}⁻`;
    }

    const formulaWithCharge = chargeSign ? `${res}${chargeSign}` : res;

    const knownMap: Record<string, string> = {
      H2O: 'Water (H₂O)',
      'H3O+': 'Hydronium Ion (H₃O⁺)',
      'OH-': 'Hydroxide Ion (OH⁻)',
      'NH4+': 'Ammonium Ion (NH₄⁺)',
      NH3: 'Ammonia (NH₃)',
      'NH2-': 'Amide Ion (NH₂⁻)',
      CH4: 'Methane (CH₄)',
      'CH3+': 'Methyl Carbocation (CH₃⁺)',
      'CH3-': 'Methyl Carbanion (CH₃⁻)',
      CO2: 'Carbon Dioxide (CO₂)',
      C2H6O: 'Ethanol / Dimethyl Ether',
      C6H6: 'Benzene (C₆H₆)',
      NaCl: 'Sodium Chloride (Salt)',
      O2: 'Oxygen Gas (O₂)',
      H2: 'Hydrogen Gas (H₂)',
      HCl: 'Hydrochloric Acid',
      HF: 'Hydrofluoric Acid',
      'BF4-': 'Tetrafluoroborate Ion (BF₄⁻)',
      'BH4-': 'Borohydride Ion (BH₄⁻)',
    };

    const key = `${res}${netCharge > 0 ? (netCharge === 1 ? '+' : `${netCharge}+`) : netCharge < 0 ? (netCharge === -1 ? '-' : `${Math.abs(netCharge)}-`) : ''}`;
    const match = knownMap[key] || knownMap[res];
    return match ? `${match}` : `Molecule • ${formulaWithCharge}`;
  }, [atoms]);

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
    setAtoms((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAtomId) return a;
        const currentCharge = a.formalCharge || 0;
        const newCharge = currentCharge - 1; // Gained 1 e⁻ => charge becomes more negative
        const spec = getMaxBondsForAtom(a.element, newCharge);
        setStatusMessage(
          `${a.element} gained 1 outermost e⁻ ➔ ${formatAtomWithCharge(a.element, newCharge)} (${spec.valenceElectrons} e⁻). Covalent capacity: ${spec.maxBonds} bonds.`
        );
        soundFx.playReactionStep();
        return { ...a, formalCharge: newCharge };
      })
    );
  };

  const handleLoseElectron = () => {
    if (!selectedAtomId) return;
    setAtoms((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAtomId) return a;
        const currentCharge = a.formalCharge || 0;
        const newCharge = currentCharge + 1; // Lost 1 e⁻ => charge becomes more positive
        const spec = getMaxBondsForAtom(a.element, newCharge);
        setStatusMessage(
          `${a.element} lost 1 outermost e⁻ ➔ ${formatAtomWithCharge(a.element, newCharge)} (${spec.valenceElectrons} e⁻). Covalent capacity: ${spec.maxBonds} bonds.`
        );
        soundFx.playReactionStep();
        return { ...a, formalCharge: newCharge };
      })
    );
  };

  const handleResetElectron = () => {
    if (!selectedAtomId) return;
    setAtoms((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAtomId) return a;
        const spec = getMaxBondsForAtom(a.element, 0);
        setStatusMessage(`Reset ${a.element} (${a.id}) to neutral atom (${spec.valenceElectrons} outermost e⁻, max ${spec.maxBonds} bonds).`);
        soundFx.playReactionStep();
        return { ...a, formalCharge: 0 };
      })
    );
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

        {/* Top-Left Molecule Formula & Status Badge */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm pointer-events-auto">
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-3 shadow-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white font-mono">{synthesizedFormula}</h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {atoms.length} atoms • {bonds.length} bonds connected
            </p>
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
                    {availableTargetAtoms.map((target) => {
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
                          key={target.id}
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
                    {selectedAtomBonds.map((b) => {
                      const otherId = b.from === activeSelectedAtom.id ? b.to : b.from;
                      return (
                        <button
                          key={b.id}
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
            onClick={handleFixBondAngles}
            className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-slate-800 shadow-lg transition-all hover:scale-105"
            title="Fix Bond Angles (VSEPR Geometry: 104.5° bent, 107° pyramidal, 109.5° tetrahedral, 120° planar, 180° linear)"
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
                onClick={handleFixBondAngles}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-medium flex items-center gap-1 transition-all"
                title="Enforces exact VSEPR chemical bond angles on all bonded atoms (104.5° bent, 107° pyramidal, 109.5° tetrahedral, 120° planar, 180° linear)"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fix Bond Angles</span>
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
                  setStatusMessage('Loaded Water (H₂O) template: Bent geometry with exact 104.5° bond angle (2 bonds + 2 lone pairs).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Water (H2O): Bent geometry, 104.5° angle"
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
                  setStatusMessage('Loaded Ammonia (NH₃) template: Trigonal pyramidal with exact 107.0° bond angles (3 bonds + 1 lone pair).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Ammonia (NH3): Trigonal Pyramidal geometry, 107.0° angle"
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
                  setStatusMessage('Loaded Methane (CH₄) template: Tetrahedral geometry with exact 109.5° bond angles (sp³ hybridization).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Methane (CH4): Tetrahedral geometry, 109.5° angle"
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
                  setStatusMessage('Loaded Carbon Dioxide (CO₂) template: Linear geometry with exact 180.0° bond angle (sp hybridization).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Carbon Dioxide (CO2): Linear geometry, 180.0° angle"
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
                  setStatusMessage('Loaded Boron Trifluoride (BF₃) template: Trigonal planar geometry with exact 120.0° bond angles (sp² hybridization).');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Boron Trifluoride (BF3): Trigonal Planar, 120.0° angle"
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
                  setStatusMessage('Loaded Hydronium Ion (H₃O⁺): O⁺ lost 1 e⁻ (5 valence e⁻) enabling 3 pyramidal bonds!');
                }}
                className="px-2 py-0.5 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-500/40 text-sky-200 font-bold"
                title="Hydronium Ion: O lost an electron to become O+ and make 3 bonds"
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
                  setStatusMessage('Loaded Ammonium Ion (NH₄⁺): N⁺ lost 1 e⁻ (4 valence e⁻) forming 4 tetrahedral bonds!');
                }}
                className="px-2 py-0.5 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-500/40 text-sky-200 font-bold"
                title="Ammonium Ion: N lost an electron to become N+ and make 4 bonds"
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
