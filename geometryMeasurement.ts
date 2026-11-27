import * as THREE from 'three';
import { MoleculeData } from '../types/chemistry';

export interface LiveDistanceMetrics {
  angstroms: number;
  picometers: number;
}

export interface LiveAngleMetrics {
  degrees: number;
  radians: number;
  idealDegrees: number | null;
  deviationDeg: number | null;
  leg1Angstroms: number;
  leg2Angstroms: number;
}

export interface LiveMeasurementSnapshot {
  mode: 'distance' | 'angle';
  atomIds: string[];
  atomLabels: string[];
  distance?: LiveDistanceMetrics;
  angle?: LiveAngleMetrics;
  isDirectBond?: boolean;
  bondOrder?: 1 | 2 | 3;
  equilibriumAngstroms?: number;
}

export interface DetectedBondAngle {
  id: string;
  atomIds: [string, string, string]; // [armA, vertex, armC]
  label: string; // e.g. "H—O—H"
  detailLabel: string; // e.g. "H1—O1—H2"
  equilibriumDegrees: number;
}

/**
 * Extracts the primary numeric angle (in degrees) from a molecule's idealBondAngle string
 * e.g. "104.5°", "~109.5° (Tetrahedral)", "120° / 109.5°" -> 104.5, 109.5, 120
 */
export function parseIdealAngleDegrees(idealBondAngle?: string): number | null {
  if (!idealBondAngle) return null;
  const match = idealBondAngle.match(/(\d+(?:\.\d+)?)\s*°/);
  if (!match) return null;
  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Computes real-time distance between two 3D vectors (in Ångströms and picometers).
 */
export function computeLiveDistance(p1: THREE.Vector3, p2: THREE.Vector3): LiveDistanceMetrics {
  const angstroms = p1.distanceTo(p2);
  return {
    angstroms: Number(angstroms.toFixed(3)),
    picometers: Number((angstroms * 100).toFixed(1)),
  };
}

const _leg1 = new THREE.Vector3();
const _leg2 = new THREE.Vector3();

/**
 * Computes real-time bond angle ∠ABC (with B as vertex) and both leg lengths.
 */
export function computeLiveAngle(
  pA: THREE.Vector3,
  pVertex: THREE.Vector3,
  pC: THREE.Vector3,
  idealDegrees: number | null = null
): LiveAngleMetrics {
  _leg1.subVectors(pA, pVertex);
  _leg2.subVectors(pC, pVertex);

  const leg1Angstroms = _leg1.length();
  const leg2Angstroms = _leg2.length();

  let radians = 0;
  if (leg1Angstroms > 1e-5 && leg2Angstroms > 1e-5) {
    radians = _leg1.angleTo(_leg2);
  }
  const degrees = Number(((radians * 180) / Math.PI).toFixed(1));
  const deviationDeg =
    idealDegrees !== null ? Number((degrees - idealDegrees).toFixed(1)) : null;

  return {
    degrees,
    radians: Number(radians.toFixed(3)),
    idealDegrees,
    deviationDeg,
    leg1Angstroms: Number(leg1Angstroms.toFixed(3)),
    leg2Angstroms: Number(leg2Angstroms.toFixed(3)),
  };
}

/**
 * Finds all natural bonded triplets A - B(vertex) - C in a molecule for 1-click live angle tracking.
 */
export function extractMolecularAngles(molecule: MoleculeData): DetectedBondAngle[] {
  const atomMap = new Map(molecule.atoms.map((a) => [a.id, a]));
  const neighbors = new Map<string, string[]>();

  for (const bond of molecule.bonds) {
    if (!neighbors.has(bond.from)) neighbors.set(bond.from, []);
    if (!neighbors.has(bond.to)) neighbors.set(bond.to, []);
    neighbors.get(bond.from)!.push(bond.to);
    neighbors.get(bond.to)!.push(bond.from);
  }

  const angles: DetectedBondAngle[] = [];
  const seen = new Set<string>();

  for (const vertex of molecule.atoms) {
    const nbrIds = neighbors.get(vertex.id) || [];
    if (nbrIds.length < 2) continue;

    for (let i = 0; i < nbrIds.length; i++) {
      for (let j = i + 1; j < nbrIds.length; j++) {
        const idA = nbrIds[i];
        const idC = nbrIds[j];
        const pairKey = [idA, idC].sort().join('|') + `@${vertex.id}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const atomA = atomMap.get(idA);
        const atomC = atomMap.get(idC);
        if (!atomA || !atomC) continue;

        const vA = new THREE.Vector3(...atomA.position);
        const vB = new THREE.Vector3(...vertex.position);
        const vC = new THREE.Vector3(...atomC.position);
        const metrics = computeLiveAngle(vA, vB, vC);

        angles.push({
          id: `${idA}-${vertex.id}-${idC}`,
          atomIds: [idA, vertex.id, idC],
          label: `${atomA.element}—${vertex.element}—${atomC.element}`,
          detailLabel: `${idA}—${vertex.id}—${idC}`,
          equilibriumDegrees: metrics.degrees,
        });
      }
    }
  }

  // Prefer heavy-atom central vertices first (e.g. C, N, O, P, S, B before H)
  angles.sort((a, b) => {
    const vA = atomMap.get(a.atomIds[1])?.element || '';
    const vB = atomMap.get(b.atomIds[1])?.element || '';
    if (vA === 'H' && vB !== 'H') return 1;
    if (vB === 'H' && vA !== 'H') return -1;
    return 0;
  });

  return angles.slice(0, 16);
}
