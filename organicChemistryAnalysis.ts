import { MolecularAtom, MolecularBond } from '../types/chemistry';
import { getElement } from '../data/elements';
import { getAtomVSEPRGeometry } from '../components/MoleculeBuilderSandbox';

export type ResonanceType =
  | 'Aromatic Cyclic Delocalization (Hückel 4n+2 π)'
  | 'Antiaromatic Cyclic System (4n π)'
  | 'Equivalent Lone-Pair to π (n → π*) Delocalization'
  | 'Amide Resonance (n → π* Peptide Conjugation)'
  | 'Carboxylic / Ester Resonance (n → π*)'
  | 'Lone-Pair to π Mesomeric Donation (n → π* / +M)'
  | 'π–π Conjugation (Alternating Multiple Bonds)'
  | 'Vacant p-Orbital Conjugation (π → p / Allylic-Benzylic)'
  | 'pπ–pπ Back-Bonding (Lone Pair → Vacant p-Orbital)'
  | 'Cumulated / Dipolar π-Resonance';

export interface ResonanceSystem {
  id: string;
  type: ResonanceType;
  categoryBadge: string;
  severity: 'primary' | 'equivalent' | 'secondary' | 'warning';
  title: string;
  atomIds: string[];
  pathNotation: string;
  contributingStructuresCount: number;
  delocalizedElectrons: number;
  effectiveBondOrder: string;
  electronFlowSummary: string;
  explanation: string;
  stabilityEffect: string;
}

export interface FunctionalGroupMatch {
  name: string;
  symbol: string;
  count: number;
  category: 'oxygen' | 'nitrogen' | 'hydrocarbon' | 'halogen' | 'sulfur' | 'charged' | 'aromatic';
  polarity: 'Polar' | 'Moderately Polar' | 'Nonpolar' | 'Ionic / Charged';
  description: string;
}

export interface AtomElectronicProfile {
  atomId: string;
  element: string;
  formalCharge: number;
  bondedCount: number;
  bondOrderSum: number;
  lonePairs: number;
  unpairedElectrons: number;
  stericHybridization: string;
  effectiveHybridization: string;
  resonanceAdjusted: boolean;
  hasVacantPOrbital: boolean;
  octetStatus: 'satisfied' | 'electron_deficient' | 'expanded' | 'radical';
}

export interface OrganicChemistryReport {
  isEmpty: boolean;
  // Core physicochemical properties
  atomCount: number;
  heavyAtomCount: number;
  bondCount: number;
  sigmaBondCount: number;
  piBondCount: number;
  ringCount: number;
  ihd: number; // Index of Hydrogen Deficiency (Degree of Unsaturation)
  ihdBreakdown: string;
  totalValenceElectrons: number;
  totalLonePairs: number;
  netCharge: number;

  // Polarity & Intermolecular Forces
  dipoleMagnitudeEstimate: number; // arbitrary Debye-like vector scale from ΔEN * 3D geometry
  maxBondDeltaEN: number;
  polarityClass:
    | 'Charged Ion'
    | 'Polar Molecule'
    | 'Moderately Polar'
    | 'Nonpolar (Symmetric Cancellation)'
    | 'Nonpolar';
  polarityReason: string;
  dominantIMF: 'Ion–Ion / Ion–Dipole' | 'Hydrogen Bonding' | 'Dipole–Dipole' | 'London Dispersion Forces';
  hBondDonors: number;
  hBondAcceptors: number;
  solubilityEstimate: string;
  acidBaseCharacter: string;
  acidBaseDetails: string;

  // Organic Structure & Electronic Breakdown
  isOrganic: boolean;
  carbonHybridizationCounts: { sp3: number; sp2: number; sp: number };
  carbonDegrees: { primary: number; secondary: number; tertiary: number; quaternary: number };
  functionalGroups: FunctionalGroupMatch[];
  aromaticityStatus: 'Aromatic (4n+2 π)' | 'Antiaromatic (4n π)' | 'Non-aromatic / Aliphatic';
  aromaticityDetails: string;
  inductiveSummary: string;
  reactivityHighlights: string[];
  octetSummary: {
    allSatisfied: boolean;
    deficientAtoms: string[];
    expandedAtoms: string[];
    radicalAtoms: string[];
  };

  // Resonance Analysis
  hasResonance: boolean;
  resonanceSystems: ResonanceSystem[];
  resonanceSummary: string;
  resonanceTypesPresent: ResonanceType[];
  hyperconjugationNote: string | null;
  atomProfiles: AtomElectronicProfile[];
}

interface AdjEdge {
  neighborId: string;
  neighborElement: string;
  neighborCharge: number;
  order: 1 | 2 | 3;
  bondId: string;
}

const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);
const LONE_PAIR_DONORS = new Set(['O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I']);

/**
 * Find minimal simple cycles (rings of length 3..8) in the molecular graph
 */
function findMinimalCycles(
  atomIds: string[],
  adj: Map<string, AdjEdge[]>
): string[][] {
  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  for (const startId of atomIds) {
    const startEdges = adj.get(startId) || [];
    if (startEdges.length < 2) continue;

    // DFS bounded up to length 8 to detect small-to-medium rings
    const path: string[] = [startId];
    const inPath = new Set<string>([startId]);

    const dfs = (curr: string, parent: string | null) => {
      if (path.length > 8) return;
      const neighbors = adj.get(curr) || [];
      for (const edge of neighbors) {
        const nxt = edge.neighborId;
        if (nxt === parent) continue;
        if (nxt === startId && path.length >= 3) {
          const canonical = [...path].sort().join('|');
          if (!seenCycleKeys.has(canonical)) {
            seenCycleKeys.add(canonical);
            cycles.push([...path]);
          }
          continue;
        }
        if (!inPath.has(nxt) && nxt > startId && path.length < 8) {
          inPath.add(nxt);
          path.push(nxt);
          dfs(nxt, curr);
          path.pop();
          inPath.delete(nxt);
        }
      }
    };

    dfs(startId, null);
  }

  // Filter out composite cycles that are unions of smaller chorded rings if needed, keep <= 8
  return cycles.sort((a, b) => a.length - b.length);
}

/**
 * Comprehensive Chemical, Organic & Resonance Analysis Engine
 */
export function analyzeMoleculeChemistry(
  atoms: MolecularAtom[],
  bonds: MolecularBond[]
): OrganicChemistryReport {
  if (atoms.length === 0) {
    return {
      isEmpty: true,
      atomCount: 0,
      heavyAtomCount: 0,
      bondCount: 0,
      sigmaBondCount: 0,
      piBondCount: 0,
      ringCount: 0,
      ihd: 0,
      ihdBreakdown: '0 rings + 0 π bonds',
      totalValenceElectrons: 0,
      totalLonePairs: 0,
      netCharge: 0,
      dipoleMagnitudeEstimate: 0,
      maxBondDeltaEN: 0,
      polarityClass: 'Nonpolar',
      polarityReason: 'Add atoms to compute polarity and dipole moment.',
      dominantIMF: 'London Dispersion Forces',
      hBondDonors: 0,
      hBondAcceptors: 0,
      solubilityEstimate: 'N/A',
      acidBaseCharacter: 'N/A',
      acidBaseDetails: 'Empty workspace.',
      isOrganic: false,
      carbonHybridizationCounts: { sp3: 0, sp2: 0, sp: 0 },
      carbonDegrees: { primary: 0, secondary: 0, tertiary: 0, quaternary: 0 },
      functionalGroups: [],
      aromaticityStatus: 'Non-aromatic / Aliphatic',
      aromaticityDetails: 'No cyclic conjugated rings present.',
      inductiveSummary: 'No substituents present.',
      reactivityHighlights: [],
      octetSummary: { allSatisfied: true, deficientAtoms: [], expandedAtoms: [], radicalAtoms: [] },
      hasResonance: false,
      resonanceSystems: [],
      resonanceSummary: 'Build a molecule to analyze resonance and delocalization.',
      resonanceTypesPresent: [],
      hyperconjugationNote: null,
      atomProfiles: [],
    };
  }

  const atomMap = new Map<string, MolecularAtom>();
  atoms.forEach((a) => atomMap.set(a.id, a));

  const adj = new Map<string, AdjEdge[]>();
  atoms.forEach((a) => adj.set(a.id, []));

  let piBondCount = 0;
  bonds.forEach((b) => {
    const a1 = atomMap.get(b.from);
    const a2 = atomMap.get(b.to);
    if (!a1 || !a2) return;
    piBondCount += Math.max(0, b.order - 1);
    adj.get(a1.id)!.push({
      neighborId: a2.id,
      neighborElement: a2.element,
      neighborCharge: a2.formalCharge || 0,
      order: b.order,
      bondId: b.id,
    });
    adj.get(a2.id)!.push({
      neighborId: a1.id,
      neighborElement: a1.element,
      neighborCharge: a1.formalCharge || 0,
      order: b.order,
      bondId: b.id,
    });
  });

  // Connected components for exact cyclomatic ring count: R = E - V + C
  const visitedComp = new Set<string>();
  let components = 0;
  for (const a of atoms) {
    if (!visitedComp.has(a.id)) {
      components++;
      const queue = [a.id];
      visitedComp.add(a.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const edge of adj.get(curr) || []) {
          if (!visitedComp.has(edge.neighborId)) {
            visitedComp.add(edge.neighborId);
            queue.push(edge.neighborId);
          }
        }
      }
    }
  }

  const ringCount = Math.max(0, bonds.length - atoms.length + components);
  const ihd = ringCount + piBondCount;
  const ihdBreakdown = `${ringCount} ring${ringCount === 1 ? '' : 's'} + ${piBondCount} π bond${piBondCount === 1 ? '' : 's'}`;

  // Compute Electronic Profiles per Atom
  let totalValenceElectrons = 0;
  let totalLonePairs = 0;
  let netCharge = 0;
  const deficientAtoms: string[] = [];
  const expandedAtoms: string[] = [];
  const radicalAtoms: string[] = [];

  const profileMap = new Map<string, AtomElectronicProfile>();

  atoms.forEach((atom) => {
    const elData = getElement(atom.element);
    const baseValence = elData ? elData.valenceElectrons : 4;
    const formalCharge = atom.formalCharge || 0;
    const currentValence = Math.max(0, baseValence - formalCharge);
    totalValenceElectrons += currentValence;
    netCharge += formalCharge;

    const edges = adj.get(atom.id) || [];
    const bondedCount = edges.length;
    const bondOrderSum = edges.reduce((s, e) => s + e.order, 0);
    const nonBondingElectrons = Math.max(0, currentValence - bondOrderSum);
    const lonePairs = Math.floor(nonBondingElectrons / 2);
    const unpairedElectrons = nonBondingElectrons % 2;
    totalLonePairs += lonePairs;

    const totalShell = nonBondingElectrons + 2 * bondOrderSum;
    const isH = atom.element === 'H';
    const target = isH ? 2 : 8;

    let octetStatus: AtomElectronicProfile['octetStatus'] = 'satisfied';
    if (unpairedElectrons > 0) {
      octetStatus = 'radical';
      radicalAtoms.push(`${atom.id} (${atom.element})`);
    } else if (totalShell < target && bondedCount > 0) {
      octetStatus = 'electron_deficient';
      deficientAtoms.push(`${atom.id} (${atom.element}, ${totalShell}e⁻)`);
    } else if (totalShell > target) {
      octetStatus = 'expanded';
      expandedAtoms.push(`${atom.id} (${atom.element}, ${totalShell}e⁻)`);
    }

    const vsepr = getAtomVSEPRGeometry(atom, atoms, bonds);
    const hasPiBond = edges.some((e) => e.order > 1);
    const hasVacantPOrbital =
      (atom.element === 'B' && bondOrderSum <= 3 && formalCharge === 0) ||
      (atom.element === 'C' && formalCharge > 0 && bondOrderSum <= 3 && !hasPiBond) ||
      (atom.element === 'Al' && bondOrderSum <= 3 && formalCharge === 0);

    // Determine steric hybridization accurately for organic atoms even if terminal
    let stericHybridization = vsepr.hybridization;
    if (atom.element !== 'H' && bondedCount === 1 && edges[0].order === 3) {
      stericHybridization = 'sp';
    } else if (atom.element !== 'H' && bondedCount === 1 && edges[0].order === 2) {
      stericHybridization = 'sp²';
    } else if (atom.element === 'C' && hasPiBond) {
      const tripleCount = edges.filter((e) => e.order === 3).length;
      const doubleCount = edges.filter((e) => e.order === 2).length;
      if (tripleCount >= 1 || doubleCount >= 2) stericHybridization = 'sp';
      else if (doubleCount === 1) stericHybridization = 'sp²';
    } else if (atom.element === 'C' && formalCharge > 0 && bondOrderSum === 3) {
      stericHybridization = 'sp²'; // Carbocation is trigonal planar sp²
    }

    profileMap.set(atom.id, {
      atomId: atom.id,
      element: atom.element,
      formalCharge,
      bondedCount,
      bondOrderSum,
      lonePairs,
      unpairedElectrons,
      stericHybridization,
      effectiveHybridization: stericHybridization,
      resonanceAdjusted: false,
      hasVacantPOrbital,
      octetStatus,
    });
  });

  // Helper: check if atom has pi bond
  const hasAtomPiBond = (id: string) => (adj.get(id) || []).some((e) => e.order > 1);
  const canDonateLonePair = (id: string) => {
    const prof = profileMap.get(id);
    if (!prof || prof.lonePairs <= 0) return false;
    return LONE_PAIR_DONORS.has(prof.element) || (prof.element === 'C' && prof.formalCharge < 0);
  };

  // Update effective hybridization for lone-pair donors conjugated to a pi system or vacant orbital
  atoms.forEach((atom) => {
    const prof = profileMap.get(atom.id)!;
    if (prof.lonePairs > 0 && prof.stericHybridization === 'sp³') {
      const edges = adj.get(atom.id) || [];
      const adjToPiOrVacant = edges.some((e) => {
        const nProf = profileMap.get(e.neighborId);
        return hasAtomPiBond(e.neighborId) || !!nProf?.hasVacantPOrbital;
      });
      if (adjToPiOrVacant && (LONE_PAIR_DONORS.has(atom.element) || (atom.element === 'C' && prof.formalCharge < 0))) {
        prof.effectiveHybridization = 'sp²';
        prof.resonanceAdjusted = true;
      }
    }
  });

  // ==========================================================
  // 1. RESONANCE & CONJUGATION DETECTION
  // ==========================================================
  const resonanceSystems: ResonanceSystem[] = [];
  const usedResonanceKeys = new Set<string>();
  const addResonance = (sys: ResonanceSystem) => {
    const key = `${sys.type}:${[...sys.atomIds].sort().join(',')}`;
    if (!usedResonanceKeys.has(key)) {
      usedResonanceKeys.add(key);
      resonanceSystems.push(sys);
    }
  };

  // A. Cyclic Aromatic / Antiaromatic Detection (Hückel 4n+2 vs 4n)
  const cycles = ringCount > 0 ? findMinimalCycles(atoms.map((a) => a.id), adj) : [];
  const aromaticRings: string[][] = [];
  const antiaromaticRings: string[][] = [];

  cycles.forEach((cycle, cIdx) => {
    if (cycle.length < 3 || cycle.length > 7) return;
    // Check if every atom in the cycle is conjugated (has pi bond inside ring, lone pair, or vacant p orbital)
    let allConjugated = true;
    let ringPiElectrons = 0;

    for (let i = 0; i < cycle.length; i++) {
      const id = cycle[i];
      const nextId = cycle[(i + 1) % cycle.length];
      const prevId = cycle[(i - 1 + cycle.length) % cycle.length];
      const edges = adj.get(id) || [];
      const prof = profileMap.get(id)!;

      const ringDoubleToNext = edges.find((e) => e.neighborId === nextId && e.order === 2);
      const ringDoubleToPrev = edges.find((e) => e.neighborId === prevId && e.order === 2);

      if (ringDoubleToNext) {
        ringPiElectrons += 2; // Count each C=C inside ring once (going forward to nextId)
      } else if (ringDoubleToPrev) {
        // Already counted when visiting prevId
      } else if (prof.hasVacantPOrbital) {
        ringPiElectrons += 0; // Contributes 0 pi electrons (empty p orbital)
      } else if (prof.lonePairs > 0 && (LONE_PAIR_DONORS.has(prof.element) || (prof.element === 'C' && prof.formalCharge < 0))) {
        ringPiElectrons += 2; // Contributes 1 lone pair = 2 pi electrons (e.g. pyrrole, furan, Cp⁻)
      } else {
        allConjugated = false;
        break;
      }
    }

    if (allConjugated && ringPiElectrons > 0) {
      const isHuckel = (ringPiElectrons - 2) % 4 === 0;
      const isAnti = ringPiElectrons % 4 === 0;

      if (isHuckel) {
        aromaticRings.push(cycle);
        const pathStr = cycle.join('–') + `–${cycle[0]}`;
        const isBenzene = cycle.length === 6 && cycle.every((id) => atomMap.get(id)?.element === 'C');
        addResonance({
          id: `res_arom_${cIdx}`,
          type: 'Aromatic Cyclic Delocalization (Hückel 4n+2 π)',
          categoryBadge: 'Aromatic 6π / 4n+2',
          severity: 'primary',
          title: isBenzene
            ? 'Aromatic Benzene Ring Delocalization (Kekulé Resonance)'
            : `Aromatic ${cycle.length}-Membered Ring (${ringPiElectrons}π e⁻)`,
          atomIds: cycle,
          pathNotation: pathStr,
          contributingStructuresCount: 2,
          delocalizedElectrons: ringPiElectrons,
          effectiveBondOrder: '1.50 (uniform aromatic bonds)',
          electronFlowSummary: `Continuous cyclic overlap of ${cycle.length} parallel p-orbitals sharing ${ringPiElectrons} π electrons (Hückel n = ${(ringPiElectrons - 2) / 4}).`,
          explanation: isBenzene
            ? 'The three alternating C=C double bonds do not sit still—all 6 π electrons are evenly delocalized above and below the planar hexagonal ring across two equivalent Kekulé resonance structures.'
            : `All ${cycle.length} ring atoms are sp²-hybridized with an uninterrupted loop of ${ringPiElectrons} π electrons satisfying Hückel’s 4n + 2 rule.`,
          stabilityEffect:
            'High aromatic stabilization energy (~150 kJ/mol for benzene); makes ring bonds equal in length (~1.39 Å) and favors substitution over addition.',
        });
      } else if (isAnti) {
        antiaromaticRings.push(cycle);
        addResonance({
          id: `res_anti_${cIdx}`,
          type: 'Antiaromatic Cyclic System (4n π)',
          categoryBadge: `Antiaromatic ${ringPiElectrons}π`,
          severity: 'warning',
          title: `Antiaromatic ${cycle.length}-Membered Conjugated Ring (${ringPiElectrons}π e⁻)`,
          atomIds: cycle,
          pathNotation: cycle.join('–') + `–${cycle[0]}`,
          contributingStructuresCount: 2,
          delocalizedElectrons: ringPiElectrons,
          effectiveBondOrder: 'Alternating (~1.0 / ~2.0)',
          electronFlowSummary: `Cyclic loop contains ${ringPiElectrons} π electrons (4n, Hückel-forbidden closed shell).`,
          explanation:
            'A planar cyclic conjugated ring with 4n π electrons places electrons into degenerate non-bonding/antibonding molecular orbitals, causing severe electronic destabilization.',
          stabilityEffect:
            'Antiaromatic destabilization: molecule tends to localize double bonds or pucker out of planarity to escape 4n π overlap.',
        });
      }
    }
  });

  const aromaticAtomSet = new Set(aromaticRings.flat());

  // B. Equivalent Oxoanion / Resonance-Stabilized Center (Carboxylate, Carbonate, Nitrate, Sulfate, Ozone)
  const handledCentralResonanceIds = new Set<string>();
  atoms.forEach((center) => {
    if (!['C', 'N', 'S', 'P', 'O'].includes(center.element)) return;
    const edges = adj.get(center.id) || [];
    const terminalOOrS = edges.filter((e) => {
      if (!['O', 'S'].includes(e.neighborElement)) return false;
      const nEdges = adj.get(e.neighborId) || [];
      return nEdges.length === 1; // terminal O or S
    });

    const doubleTerminal = terminalOOrS.filter((e) => e.order === 2);
    const singleNegTerminal = terminalOOrS.filter((e) => e.order === 1 && (e.neighborCharge < 0 || (center.element === 'O' && terminalOOrS.length === 2)));

    if (doubleTerminal.length >= 1 && singleNegTerminal.length >= 1) {
      handledCentralResonanceIds.add(center.id);
      const involved = [center.id, ...doubleTerminal.map((e) => e.neighborId), ...singleNegTerminal.map((e) => e.neighborId)];
      const totalTerminals = doubleTerminal.length + singleNegTerminal.length;
      const totalOrder = doubleTerminal.length * 2 + singleNegTerminal.length * 1;
      const avgOrder = (totalOrder / totalTerminals).toFixed(2);
      const numContrib = totalTerminals; // e.g., 2 for carboxylate/ozone, 3 for CO3^2- / NO3^-

      addResonance({
        id: `res_equiv_${center.id}`,
        type: 'Equivalent Lone-Pair to π (n → π*) Delocalization',
        categoryBadge: `${numContrib} Equivalent Forms`,
        severity: 'equivalent',
        title:
          center.element === 'C' && totalTerminals === 2
            ? 'Carboxylate / Formate Equivalent Resonance (–COO⁻)'
            : center.element === 'O'
            ? 'Ozone Equivalent 3-Center π Resonance (O₃)'
            : `Equivalent Oxoanion Delocalization (${center.element}O${totalTerminals})`,
        atomIds: involved,
        pathNotation: `${singleNegTerminal.map((e) => e.neighborId).join('/')} — ${center.id} = ${doubleTerminal.map((e) => e.neighborId).join('/')}`,
        contributingStructuresCount: numContrib,
        delocalizedElectrons: 4,
        effectiveBondOrder: `${avgOrder} (equalized terminal bonds)`,
        electronFlowSummary: `Lone pair on terminal ${singleNegTerminal[0].neighborElement}⁻ pushes into ${center.id} while π bond shifts onto the other ${doubleTerminal[0].neighborElement}.`,
        explanation: `All ${numContrib} resonance contributors have identical energy because the negative charge and π bond are shared symmetrically across ${totalTerminals} equivalent ${doubleTerminal[0].neighborElement} atoms.`,
        stabilityEffect:
          'Maximum resonance stabilization for charged species: lowers basicity of the conjugate base and makes all involved bond lengths identical.',
      });
    }
  });

  // C. Amide & Carboxylic Acid / Ester Resonance (O=C–N or O=C–OH / O=C–OR)
  atoms.forEach((center) => {
    if (center.element !== 'C' || handledCentralResonanceIds.has(center.id)) return;
    const edges = adj.get(center.id) || [];
    const carbonylO = edges.find((e) => e.neighborElement === 'O' && e.order === 2);
    if (!carbonylO) return;

    // Check for Amide Nitrogen
    const amideNs = edges.filter((e) => e.neighborElement === 'N' && e.order === 1 && canDonateLonePair(e.neighborId));
    amideNs.forEach((nEdge) => {
      handledCentralResonanceIds.add(center.id);
      addResonance({
        id: `res_amide_${center.id}_${nEdge.neighborId}`,
        type: 'Amide Resonance (n → π* Peptide Conjugation)',
        categoryBadge: 'Amide / Peptide n → π*',
        severity: 'primary',
        title: 'Amide Conjugation (O=C–N ↔ ⁻O–C=N⁺)',
        atomIds: [carbonylO.neighborId, center.id, nEdge.neighborId],
        pathNotation: `${carbonylO.neighborId} = ${center.id} — ${nEdge.neighborId}`,
        contributingStructuresCount: 2,
        delocalizedElectrons: 4,
        effectiveBondOrder: 'C–N ~1.40, C–O ~1.60',
        electronFlowSummary: `Nitrogen lone pair (${nEdge.neighborId}) donates into C=O π* orbital, pushing π electrons onto Oxygen (${carbonylO.neighborId}).`,
        explanation:
          'Nitrogen donates its lone pair into the adjacent carbonyl π system, creating a major dipolar contributor with a C=N⁺ double bond and C–O⁻ single bond.',
        stabilityEffect:
          'Forces the amide Nitrogen to be planar (sp²), restricts C–N bond rotation (forming rigid peptide bonds in proteins), and dramatically lowers N basicity.',
      });
    });

    // Check for Neutral -OH or -OR (Carboxylic Acid / Ester)
    const neutralOs = edges.filter((e) => e.neighborElement === 'O' && e.order === 1 && e.neighborCharge === 0 && canDonateLonePair(e.neighborId));
    neutralOs.forEach((oEdge) => {
      const oNeighbors = adj.get(oEdge.neighborId) || [];
      const isAcid = oNeighbors.some((on) => on.neighborElement === 'H');
      addResonance({
        id: `res_ester_${center.id}_${oEdge.neighborId}`,
        type: 'Carboxylic / Ester Resonance (n → π*)',
        categoryBadge: isAcid ? 'Carboxylic n → π*' : 'Ester n → π*',
        severity: 'secondary',
        title: isAcid ? 'Carboxylic Acid Lone-Pair Conjugation (O=C–OH)' : 'Ester Lone-Pair Conjugation (O=C–OR)',
        atomIds: [carbonylO.neighborId, center.id, oEdge.neighborId],
        pathNotation: `${carbonylO.neighborId} = ${center.id} — ${oEdge.neighborId}`,
        contributingStructuresCount: 2,
        delocalizedElectrons: 4,
        effectiveBondOrder: 'C–O(single) ~1.20, C=O ~1.80',
        electronFlowSummary: `Lone pair on ${oEdge.neighborId} donates into carbonyl π*, placing partial δ⁺ on ${oEdge.neighborId} and δ⁻ on ${carbonylO.neighborId}.`,
        explanation:
          'Cross-donation from the singly-bonded oxygen lone pair into the C=O carbonyl lowers carbonyl electrophilicity compared to aldehydes and ketones.',
        stabilityEffect:
          isAcid
            ? 'Moderately stabilizes the neutral acid; upon deprotonation, resonance turns into two equal-energy carboxylate contributors!'
            : 'Stabilizes the ester linkage (~40–50 kJ/mol) and makes esters less reactive toward nucleophiles than acid chlorides.',
      });
    });
  });

  // D. Vacant p-Orbital Conjugation (Allylic/Benzylic Carbocation & BF3 / Acylium Back-Bonding)
  atoms.forEach((vacAtom) => {
    const prof = profileMap.get(vacAtom.id)!;
    if (!prof.hasVacantPOrbital) return;
    const edges = adj.get(vacAtom.id) || [];

    // 1. Adjacent pi bond (Allylic or Benzylic carbocation)
    const piNeighbors = edges.filter((e) => e.order === 1 && hasAtomPiBond(e.neighborId));
    piNeighbors.forEach((pn) => {
      const nPiEdges = (adj.get(pn.neighborId) || []).filter((ne) => ne.order > 1 && ne.neighborId !== vacAtom.id);
      const partnerId = nPiEdges[0]?.neighborId;
      const inAromatic = aromaticAtomSet.has(pn.neighborId);
      addResonance({
        id: `res_vacpi_${vacAtom.id}_${pn.neighborId}`,
        type: 'Vacant p-Orbital Conjugation (π → p / Allylic-Benzylic)',
        categoryBadge: inAromatic ? 'Benzylic π → p' : 'Allylic π → p',
        severity: 'primary',
        title: inAromatic
          ? `Benzylic Vacant-Orbital Delocalization (${vacAtom.id})`
          : `Allylic π → Vacant p-Orbital Resonance (${vacAtom.id})`,
        atomIds: partnerId ? [vacAtom.id, pn.neighborId, partnerId] : [vacAtom.id, pn.neighborId],
        pathNotation: partnerId ? `${vacAtom.id} — ${pn.neighborId} = ${partnerId}` : `${vacAtom.id} — ${pn.neighborId}`,
        contributingStructuresCount: inAromatic ? 4 : 2,
        delocalizedElectrons: 2,
        effectiveBondOrder: '~1.50 across allylic/benzylic span',
        electronFlowSummary: `Adjacent π-bond shifts toward electron-deficient ${vacAtom.id}, spreading positive charge to ${partnerId || pn.neighborId}.`,
        explanation:
          'The empty 2p orbital on the sp² electron-deficient center aligns parallel with the adjacent π bond, allowing π electrons to delocalize over all 3+ atoms.',
        stabilityEffect:
          'Major carbocation stabilization (~60–90 kJ/mol); drives rapid SN1 solvolysis and allylic/benzylic rearrangements.',
      });
    });

    // 2. Adjacent lone-pair donor (e.g. BF3 backbonding, oxocarbenium C⁺–OR)
    const lpNeighbors = edges.filter((e) => canDonateLonePair(e.neighborId) && e.order === 1);
    if (lpNeighbors.length > 0 && vacAtom.element === 'B') {
      addResonance({
        id: `res_backbond_${vacAtom.id}`,
        type: 'pπ–pπ Back-Bonding (Lone Pair → Vacant p-Orbital)',
        categoryBadge: 'pπ–pπ Back-Bonding',
        severity: 'secondary',
        title: `Boron pπ–pπ Back-Bonding (${vacAtom.id})`,
        atomIds: [vacAtom.id, ...lpNeighbors.map((e) => e.neighborId)],
        pathNotation: `${vacAtom.id} — (${lpNeighbors.map((e) => e.neighborId).join(', ')})`,
        contributingStructuresCount: 1 + lpNeighbors.length,
        delocalizedElectrons: 2,
        effectiveBondOrder: '~1.33 (partial double bond)',
        electronFlowSummary: `Filled 2p lone pair from ${lpNeighbors.map((e) => e.neighborElement).join('/')} donates into Boron’s empty 2p orbital.`,
        explanation:
          'Trigonal planar Boron has an empty unhybridized 2p orbital perpendicular to the plane, which accepts partial π electron density from adjacent halogens/oxygens.',
        stabilityEffect:
          'Shortens B–X bonds and moderates Lewis acidity (explains why BF₃ is a weaker Lewis acid than BCl₃/BBr₃).',
      });
    } else if (lpNeighbors.length > 0 && vacAtom.element === 'C' && prof.formalCharge > 0) {
      lpNeighbors.forEach((ln) => {
        addResonance({
          id: `res_oxocarb_${vacAtom.id}_${ln.neighborId}`,
          type: 'pπ–pπ Back-Bonding (Lone Pair → Vacant p-Orbital)',
          categoryBadge: 'Octet-Completing Resonance',
          severity: 'primary',
          title: `Heteroatom-Stabilized Carbocation (${vacAtom.id}⁺–${ln.neighborElement})`,
          atomIds: [vacAtom.id, ln.neighborId],
          pathNotation: `${vacAtom.id}⁺ — ${ln.neighborId} ↔ ${vacAtom.id} = ${ln.neighborId}⁺`,
          contributingStructuresCount: 2,
          delocalizedElectrons: 2,
          effectiveBondOrder: '> 1.50 (major contributor has full octets)',
          electronFlowSummary: `Lone pair on ${ln.neighborId} forms a π bond with ${vacAtom.id}⁺, giving every heavy atom a full octet!`,
          explanation:
            'Although positive charge moves onto the heteroatom, the resonance contributor with a C=O⁺ or C=N⁺ double bond satisfies the octet rule for every atom and dominates the hybrid.',
          stabilityEffect: 'Exceptionally strong stabilization of α-heteroatom carbocations (oxocarbenium / iminium intermediates).',
        });
      });
    }
  });

  // E. Lone-Pair to Non-Carbonyl Pi System (+M Mesomeric Donation: Enolate, Phenol, Aniline, Vinyl Halide, Enamine)
  atoms.forEach((donor) => {
    const dProf = profileMap.get(donor.id)!;
    if (!canDonateLonePair(donor.id)) return;
    const dEdges = adj.get(donor.id) || [];

    dEdges.forEach((edge) => {
      if (edge.order !== 1) return;
      const targetId = edge.neighborId;
      if (handledCentralResonanceIds.has(targetId)) return; // Already handled by carboxylate/amide/ester
      if (!hasAtomPiBond(targetId)) return;

      const tEdges = adj.get(targetId) || [];
      const piPartner = tEdges.find((te) => te.order > 1);
      if (!piPartner) return;

      const inAromatic = aromaticAtomSet.has(targetId);
      const isEnolate =
        (donor.element === 'O' && dProf.formalCharge < 0 && piPartner.neighborElement === 'C') ||
        (donor.element === 'C' && dProf.formalCharge < 0 && piPartner.neighborElement === 'O');
      const isHalogen = HALOGENS.has(donor.element);

      let title = `Lone-Pair Conjugation (+M Effect: ${donor.id} → ${targetId}=${piPartner.neighborId})`;
      let badge = '+M / n → π*';
      let stability = 'Delocalizes lone pair into π system, creating partial double-bond character and nucleophilic α/para carbon sites.';
      if (inAromatic) {
        title = `Aromatic +M Ring Donation (${donor.element} into Ring)`;
        badge = 'Aromatic +M Activator';
        stability = isHalogen
          ? 'Weak +M donation directs Electrophilic Aromatic Substitution to ortho/para positions despite -I inductive pull.'
          : 'Strongly activates aromatic ring at ortho/para positions and stabilizes conjugate phenoxide base (increasing acidity).';
      } else if (isEnolate) {
        title = 'Enolate / α-Carbanion Resonance (C=C–O⁻ ↔ ⁻C–C=O)';
        badge = 'Enolate Ambident Hybrid';
        stability = 'Spreads negative charge across Carbon and electronegative Oxygen, lowering α-proton pKa (~19–20 vs ~50 for alkanes).';
      } else if (isHalogen) {
        title = `Vinyl Halide Weak +M Donation (${donor.id}–${targetId}=${piPartner.neighborId})`;
        badge = 'Weak +M (Vinyl Halide)';
      }

      addResonance({
        id: `res_plusM_${donor.id}_${targetId}`,
        type: 'Lone-Pair to π Mesomeric Donation (n → π* / +M)',
        categoryBadge: badge,
        severity: isHalogen ? 'secondary' : 'primary',
        title,
        atomIds: [donor.id, targetId, piPartner.neighborId],
        pathNotation: `${donor.id} — ${targetId} ${piPartner.order === 3 ? '≡' : '='} ${piPartner.neighborId}`,
        contributingStructuresCount: inAromatic ? 4 : 2,
        delocalizedElectrons: 4,
        effectiveBondOrder: `${donor.id}–${targetId} > 1.0 (partial double bond)`,
        electronFlowSummary: `Lone pair on ${donor.id} shifts into ${donor.id}–${targetId} bond while π electrons shift toward ${piPartner.neighborId}.`,
        explanation: `${donor.element} rehybridizes from sp³ toward sp² so a lone pair can occupy a parallel 2p orbital and overlap with the adjacent π bond.`,
        stabilityEffect: stability,
      });
    });
  });

  // F. Acyclic π–π Conjugation (Alternating Multiple Bonds: C=C–C=C, C=C–C=O, Styrene-like, Diene)
  // Find maximal acyclic conjugated paths of pi-bonded atoms connected by single bonds
  const piAtoms = atoms.filter((a) => hasAtomPiBond(a.id)).map((a) => a.id);
  const piAtomSet = new Set(piAtoms);
  const visitedPiChain = new Set<string>();

  for (const startId of piAtoms) {
    if (visitedPiChain.has(startId)) continue;
    // BFS over pi-bonded atoms (both through their pi bond and bridging single bonds between two pi-bonded atoms)
    const compNodes: string[] = [];
    const compSingleBridges: Array<[string, string]> = [];
    const q = [startId];
    visitedPiChain.add(startId);

    while (q.length > 0) {
      const curr = q.shift()!;
      compNodes.push(curr);
      for (const e of adj.get(curr) || []) {
        if (piAtomSet.has(e.neighborId)) {
          if (e.order === 1 && (!aromaticAtomSet.has(curr) || !aromaticAtomSet.has(e.neighborId))) {
            if (curr < e.neighborId) compSingleBridges.push([curr, e.neighborId]);
          }
          if (!visitedPiChain.has(e.neighborId)) {
            visitedPiChain.add(e.neighborId);
            q.push(e.neighborId);
          }
        }
      }
    }

    // Only register π–π conjugation if there is at least one non-aromatic single-bond bridge linking two distinct π bonds
    if (compSingleBridges.length > 0 && compNodes.length >= 4) {
      const hasCarbonyl = compNodes.some((id) => {
        const a = atomMap.get(id);
        return a?.element === 'O' && (adj.get(id) || []).some((e) => e.order === 2 && e.neighborElement === 'C');
      });
      addResonance({
        id: `res_pipi_${compNodes[0]}`,
        type: 'π–π Conjugation (Alternating Multiple Bonds)',
        categoryBadge: hasCarbonyl ? 'α,β-Unsaturated π–π' : 'Conjugated Polyene (π–π)',
        severity: 'primary',
        title: hasCarbonyl
          ? 'α,β-Unsaturated Carbonyl Conjugation (C=C–C=O)'
          : `Conjugated π–π System (${compNodes.length} Atoms)`,
        atomIds: compNodes,
        pathNotation: compNodes.join('–'),
        contributingStructuresCount: hasCarbonyl ? 3 : 3,
        delocalizedElectrons: compNodes.length,
        effectiveBondOrder: 'Bridging single bond ~1.2–1.35',
        electronFlowSummary: hasCarbonyl
          ? 'Alkene π electrons shift toward the electron-withdrawing C=O oxygen, creating an electrophilic β-carbon (δ⁺).'
          : 'Adjacent π orbitals overlap across the central single bond, delocalizing π electrons across the full conjugated backbone.',
        explanation:
          'Every atom along this alternating single/multiple-bond segment is sp²/sp hybridized with parallel p orbitals forming extended molecular orbitals.',
        stabilityEffect: hasCarbonyl
          ? 'Lowers LUMO energy and enables both 1,2-direct and 1,4-conjugate (Michael) nucleophilic addition.'
          : 'Provides ~15–20 kJ/mol conjugation stabilization per diene unit, shortens the central single bond, and shifts UV-Vis absorption to longer wavelengths.',
      });
    }
  }

  // G. Cumulated / Dipolar π Resonance (CO2, Allene-like heteroatom, N2O)
  atoms.forEach((center) => {
    const edges = adj.get(center.id) || [];
    const doubleToHetero = edges.filter((e) => e.order === 2 && ['O', 'N', 'S'].includes(e.neighborElement));
    if (center.element === 'C' && doubleToHetero.length === 2 && edges.length === 2) {
      addResonance({
        id: `res_cumul_${center.id}`,
        type: 'Cumulated / Dipolar π-Resonance',
        categoryBadge: 'Minor Charge-Separated',
        severity: 'secondary',
        title: `Cumulated Heterocumulene Resonance (${doubleToHetero[0].neighborId}=${center.id}=${doubleToHetero[1].neighborId})`,
        atomIds: [doubleToHetero[0].neighborId, center.id, doubleToHetero[1].neighborId],
        pathNotation: `${doubleToHetero[0].neighborId} = ${center.id} = ${doubleToHetero[1].neighborId}`,
        contributingStructuresCount: 3,
        delocalizedElectrons: 8,
        effectiveBondOrder: '~2.0 (major) + minor triple/single forms',
        electronFlowSummary: `Minor dipolar resonance shifts π pair onto one terminal ${doubleToHetero[0].neighborElement} while forming a triple bond to the other.`,
        explanation:
          'While the neutral double-bonded structure is dominant (zero formal charges), minor charge-separated triple-bonded contributors explain shortened C=O bonds in CO₂.',
        stabilityEffect: 'Explains why CO₂ bond lengths (1.16 Å) are slightly shorter than standard ketone C=O bonds (1.22 Å).',
      });
    }
  });

  // Check Hyperconjugation (secondary σ–p / σ–π* note, NOT counted as true π resonance)
  let hyperconjugationNote: string | null = null;
  const carbocationOrAlkeneAtoms = atoms.filter((a) => {
    const prof = profileMap.get(a.id)!;
    return (a.element === 'C' && prof.formalCharge > 0) || (a.element === 'C' && hasAtomPiBond(a.id));
  });
  for (const target of carbocationOrAlkeneAtoms) {
    const alphaCarbons = (adj.get(target.id) || []).filter(
      (e) => e.order === 1 && e.neighborElement === 'C' && !hasAtomPiBond(e.neighborId)
    );
    const totalAlphaH = alphaCarbons.reduce((sum, ac) => {
      const hCount = (adj.get(ac.neighborId) || []).filter((ne) => ne.neighborElement === 'H').length;
      return sum + hCount;
    }, 0);
    if (totalAlphaH > 0) {
      hyperconjugationNote = `Hyperconjugation (σ → p / σ → π*): ${totalAlphaH} α-C–H σ-bond${totalAlphaH === 1 ? '' : 's'} donate weak electron density into the adjacent ${
        (target.formalCharge || 0) > 0 ? 'vacant carbocation p-orbital' : 'π* orbital'
      } ("no-bond resonance", weaker than true π-resonance).`;
      break;
    }
  }

  // ==========================================================
  // 2. POLARITY, 3D DIPOLE & INTERMOLECULAR FORCES
  // ==========================================================
  const dipoleVec = { x: 0, y: 0, z: 0 };
  let maxBondDeltaEN = 0;

  bonds.forEach((b) => {
    const a1 = atomMap.get(b.from);
    const a2 = atomMap.get(b.to);
    if (!a1 || !a2) return;
    const en1 = getElement(a1.element)?.electronegativity ?? 2.2;
    const en2 = getElement(a2.element)?.electronegativity ?? 2.2;
    const deltaEN = Math.abs(en1 - en2);
    if (deltaEN > maxBondDeltaEN) maxBondDeltaEN = deltaEN;

    const dx = a2.position[0] - a1.position[0];
    const dy = a2.position[1] - a1.position[1];
    const dz = a2.position[2] - a1.position[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001 || deltaEN < 0.01) return;

    // Direction from less electronegative to more electronegative (negative dipole end)
    const sign = en2 >= en1 ? 1 : -1;
    const weight = deltaEN * (1 + (b.order - 1) * 0.25);
    dipoleVec.x += (dx / len) * sign * weight;
    dipoleVec.y += (dy / len) * sign * weight;
    dipoleVec.z += (dz / len) * sign * weight;
  });

  const dipoleMagnitudeEstimate = Math.round(Math.hypot(dipoleVec.x, dipoleVec.y, dipoleVec.z) * 100) / 100;

  let polarityClass: OrganicChemistryReport['polarityClass'] = 'Nonpolar';
  let polarityReason = 'All bonds have minimal electronegativity difference (ΔEN < 0.4).';

  if (netCharge !== 0) {
    polarityClass = 'Charged Ion';
    polarityReason = `Carries net formal charge (${netCharge > 0 ? `+${netCharge}` : netCharge}), dominating electrostatic interactions.`;
  } else if (bonds.length === 0) {
    polarityClass = 'Nonpolar';
    polarityReason = 'No covalent bonds formed yet.';
  } else if (maxBondDeltaEN < 0.38 && dipoleMagnitudeEstimate < 0.35) {
    polarityClass = 'Nonpolar';
    polarityReason = `All covalent bonds are nonpolar (max ΔEN = ${maxBondDeltaEN.toFixed(2)}, e.g. C–C and C–H bonds).`;
  } else if (dipoleMagnitudeEstimate < 0.22 && maxBondDeltaEN >= 0.38) {
    polarityClass = 'Nonpolar (Symmetric Cancellation)';
    polarityReason = `Contains polar bonds (max ΔEN = ${maxBondDeltaEN.toFixed(2)}), but 3D molecular symmetry cancels individual bond dipoles to ~0.`;
  } else if (dipoleMagnitudeEstimate < 0.85) {
    polarityClass = 'Moderately Polar';
    polarityReason = `Asymmetric distribution of polar bonds yields a moderate net dipole (μ_est ≈ ${dipoleMagnitudeEstimate.toFixed(2)}).`;
  } else {
    polarityClass = 'Polar Molecule';
    polarityReason = `Strong net 3D bond-dipole vector (μ_est ≈ ${dipoleMagnitudeEstimate.toFixed(2)}, max ΔEN = ${maxBondDeltaEN.toFixed(2)}) creates distinct δ⁺ / δ⁻ poles.`;
  }

  // Hydrogen bond donors & acceptors
  let hBondDonors = 0;
  let hBondAcceptors = 0;
  atoms.forEach((a) => {
    const edges = adj.get(a.id) || [];
    const prof = profileMap.get(a.id)!;
    if (a.element === 'H') {
      if (edges.some((e) => ['O', 'N', 'F'].includes(e.neighborElement))) {
        hBondDonors++;
      }
    }
    if (['O', 'N', 'F'].includes(a.element) && prof.lonePairs > 0) {
      hBondAcceptors++;
    }
  });

  let dominantIMF: OrganicChemistryReport['dominantIMF'] = 'London Dispersion Forces';
  if (netCharge !== 0) dominantIMF = 'Ion–Ion / Ion–Dipole';
  else if (hBondDonors > 0 && hBondAcceptors > 0) dominantIMF = 'Hydrogen Bonding';
  else if (polarityClass === 'Polar Molecule' || polarityClass === 'Moderately Polar') dominantIMF = 'Dipole–Dipole';

  let solubilityEstimate = 'Insoluble in water / Lipophilic (soluble in organic solvents like hexane)';
  if (netCharge !== 0) {
    solubilityEstimate = 'Highly water-soluble (strong ion–dipole hydration with H₂O)';
  } else if (hBondDonors > 0 && atoms.filter((a) => a.element === 'C').length <= 4) {
    solubilityEstimate = 'Water-miscible / Soluble (forms H-bonds with water)';
  } else if (hBondDonors > 0 || (hBondAcceptors > 0 && atoms.filter((a) => a.element === 'C').length <= 5)) {
    solubilityEstimate = 'Amphiphilic / Moderately water-soluble (H-bond capable)';
  } else if (polarityClass === 'Polar Molecule') {
    solubilityEstimate = 'Moderately polar (soluble in polar aprotic & protic solvents)';
  }

  // ==========================================================
  // 3. FUNCTIONAL GROUPS, HYBRIDIZATION & ORGANIC METRICS
  // ==========================================================
  const carbons = atoms.filter((a) => a.element === 'C');
  const isOrganic = carbons.length > 0;
  const carbonHybridizationCounts = { sp3: 0, sp2: 0, sp: 0 };
  const carbonDegrees = { primary: 0, secondary: 0, tertiary: 0, quaternary: 0 };

  carbons.forEach((c) => {
    const prof = profileMap.get(c.id)!;
    if (prof.effectiveHybridization === 'sp') carbonHybridizationCounts.sp++;
    else if (prof.effectiveHybridization === 'sp²') carbonHybridizationCounts.sp2++;
    else carbonHybridizationCounts.sp3++;

    const carbonNeighborCount = (adj.get(c.id) || []).filter((e) => e.neighborElement === 'C').length;
    if (carbonNeighborCount === 1) carbonDegrees.primary++;
    else if (carbonNeighborCount === 2) carbonDegrees.secondary++;
    else if (carbonNeighborCount === 3) carbonDegrees.tertiary++;
    else if (carbonNeighborCount >= 4) carbonDegrees.quaternary++;
  });

  const fgCounts = new Map<string, FunctionalGroupMatch>();
  const addFG = (
    name: string,
    symbol: string,
    category: FunctionalGroupMatch['category'],
    polarity: FunctionalGroupMatch['polarity'],
    description: string
  ) => {
    const existing = fgCounts.get(name);
    if (existing) existing.count++;
    else fgCounts.set(name, { name, symbol, count: 1, category, polarity, description });
  };

  if (aromaticRings.length > 0) {
    aromaticRings.forEach(() => {
      addFG(
        'Aromatic Ring (Arene)',
        'Ar',
        'aromatic',
        'Nonpolar',
        'Planar 4n+2 π conjugated ring resistant to addition; undergoes Electrophilic Aromatic Substitution.'
      );
    });
  }

  const consumedOxygenIds = new Set<string>();
  const consumedNitrogenIds = new Set<string>();
  const consumedCarbonylCarbonIds = new Set<string>();
  const handledAnhydrideBridgeOIds = new Set<string>();

  // Detect Carbonyl-containing & Isocyanate Functional Groups
  carbons.forEach((c) => {
    const edges = adj.get(c.id) || [];
    const doubleO = edges.find((e) => e.neighborElement === 'O' && e.order === 2);
    if (!doubleO) return;

    const doubleN = edges.find((e) => e.neighborElement === 'N' && e.order === 2);
    if (doubleN) {
      consumedCarbonylCarbonIds.add(c.id);
      consumedOxygenIds.add(doubleO.neighborId);
      consumedNitrogenIds.add(doubleN.neighborId);
      addFG('Isocyanate', '–N=C=O', 'nitrogen', 'Polar', 'Cumulated heterocumulene functional group reactive with alcohols/amines.');
      return;
    }

    consumedCarbonylCarbonIds.add(c.id);
    consumedOxygenIds.add(doubleO.neighborId);

    const singleOs = edges.filter((e) => e.neighborElement === 'O' && e.order === 1);
    const singleNs = edges.filter((e) => e.neighborElement === 'N' && e.order === 1);
    const halogens = edges.filter((e) => HALOGENS.has(e.neighborElement) && e.order === 1);
    const carbonNbrs = edges.filter((e) => e.neighborElement === 'C');
    const hNbrs = edges.filter((e) => e.neighborElement === 'H');

    const negSingleO = singleOs.find((o) => o.neighborCharge < 0 && (adj.get(o.neighborId) || []).length === 1);
    const ohSingleO = singleOs.find((o) => (adj.get(o.neighborId) || []).some((on) => on.neighborElement === 'H'));
    const anhydrideBridgeO = singleOs.find((o) =>
      (adj.get(o.neighborId) || []).some(
        (on) =>
          on.neighborId !== c.id &&
          on.neighborElement === 'C' &&
          (adj.get(on.neighborId) || []).some((ce) => ce.neighborElement === 'O' && ce.order === 2)
      )
    );
    const orSingleO = singleOs.find((o) => (adj.get(o.neighborId) || []).some((on) => on.neighborId !== c.id && on.neighborElement === 'C'));

    if (negSingleO && singleOs.length === 1) {
      consumedOxygenIds.add(negSingleO.neighborId);
      addFG('Carboxylate Ion', '–COO⁻', 'charged', 'Ionic / Charged', 'Resonance-stabilized conjugate base of a carboxylic acid.');
    } else if (ohSingleO) {
      consumedOxygenIds.add(ohSingleO.neighborId);
      addFG('Carboxylic Acid', '–COOH', 'oxygen', 'Polar', 'Acidic proton donor (pKa ~4–5) stabilized by carboxylate resonance.');
    } else if (anhydrideBridgeO) {
      consumedOxygenIds.add(anhydrideBridgeO.neighborId);
      if (!handledAnhydrideBridgeOIds.has(anhydrideBridgeO.neighborId)) {
        handledAnhydrideBridgeOIds.add(anhydrideBridgeO.neighborId);
        addFG('Acid Anhydride', '–C(=O)OC(=O)–', 'oxygen', 'Polar', 'Two carbonyls bridged by an oxygen atom; potent acylating derivative.');
      }
    } else if (orSingleO) {
      consumedOxygenIds.add(orSingleO.neighborId);
      addFG('Ester', '–COO–R', 'oxygen', 'Polar', 'Polar carbonyl derivative formed from carboxylic acid + alcohol condensation.');
    } else if (singleNs.length > 0) {
      singleNs.forEach((n) => consumedNitrogenIds.add(n.neighborId));
      addFG('Amide (Peptide Bond)', '–CON<', 'nitrogen', 'Polar', 'Resonance-stabilized planar C–N linkage; forms protein backbones.');
    } else if (halogens.length > 0) {
      addFG('Acyl Halide', '–COX', 'halogen', 'Polar', 'Highly reactive electrophilic carbonyl halide.');
    } else if (carbonNbrs.length >= 2) {
      addFG('Ketone', 'R₂C=O', 'oxygen', 'Polar', 'Internal polar carbonyl; H-bond acceptor & nucleophilic addition site.');
    } else if (hNbrs.length >= 1 && carbonNbrs.length <= 1) {
      addFG('Aldehyde', '–CHO', 'oxygen', 'Polar', 'Terminal carbonyl group; reactive electrophile, easily oxidized to –COOH.');
    } else if (singleOs.length >= 2) {
      singleOs.forEach((o) => consumedOxygenIds.add(o.neighborId));
      addFG('Carbonate / Carbonic Group', 'CO₃', 'oxygen', 'Polar', 'Trigonal planar oxocarbon motif.');
    }
  });

  // Non-carbonyl Oxygen groups: Alcohol, Phenol, Enol, Epoxide, Ether, Peroxide
  atoms
    .filter((a) => a.element === 'O' && !consumedOxygenIds.has(a.id))
    .forEach((o) => {
      const edges = adj.get(o.id) || [];
      const hEdges = edges.filter((e) => e.neighborElement === 'H');
      const cEdges = edges.filter((e) => e.neighborElement === 'C');
      const oEdges = edges.filter((e) => e.neighborElement === 'O');
      const sEdges = edges.filter((e) => e.neighborElement === 'S');
      const pEdges = edges.filter((e) => e.neighborElement === 'P');

      if (sEdges.length > 0 || pEdges.length > 0) return;

      if (oEdges.length > 0) {
        addFG('Peroxide', '–O–O–', 'oxygen', 'Polar', 'Weak O–O single bond prone to homolytic radical cleavage.');
      } else if (hEdges.length === 1 && cEdges.length === 1) {
        const cId = cEdges[0].neighborId;
        if (aromaticAtomSet.has(cId)) {
          addFG('Phenol', 'Ar–OH', 'oxygen', 'Polar', 'Acidic aromatic hydroxyl (pKa ~10) due to phenoxide resonance.');
        } else if (hasAtomPiBond(cId)) {
          addFG('Enol', 'C=C–OH', 'oxygen', 'Polar', 'Unsaturated alcohol tautomerizing with ketone/aldehyde.');
        } else {
          const cDeg = (adj.get(cId) || []).filter((e) => e.neighborElement === 'C').length;
          const degLabel = cDeg <= 1 ? '1°' : cDeg === 2 ? '2°' : '3°';
          addFG(`Alcohol (${degLabel})`, '–OH', 'oxygen', 'Polar', 'Polar H-bonding hydroxyl group; nucleophilic O and acidic proton.');
        }
      } else if (cEdges.length === 2) {
        const c1Edges = adj.get(cEdges[0].neighborId) || [];
        const isEpoxide = c1Edges.some((e) => e.neighborId === cEdges[1].neighborId);
        if (isEpoxide) {
          addFG('Epoxide (Oxirane)', 'C–O–C (3-ring)', 'oxygen', 'Polar', 'Strained 3-membered cyclic ether (~60° angles); undergoes rapid ring-opening.');
        } else {
          addFG('Ether', 'R–O–R′', 'oxygen', 'Moderately Polar', 'Unreactive polar aprotic C–O–C linkage; H-bond acceptor only.');
        }
      } else if ((o.formalCharge || 0) < 0 && cEdges.length === 1) {
        addFG('Alkoxide / Enolate', 'R–O⁻', 'charged', 'Ionic / Charged', 'Strong base and potent oxygen/carbon nucleophile.');
      }
    });

  // Nitrogen groups: Nitrile, Nitro, Azide, Amine, Imine, Ammonium
  const handledAzideSet = new Set<string>();
  atoms
    .filter((a) => a.element === 'N' && !consumedNitrogenIds.has(a.id))
    .forEach((n) => {
      if (handledAzideSet.has(n.id)) return;
      const edges = adj.get(n.id) || [];
      const tripleC = edges.find((e) => e.neighborElement === 'C' && e.order === 3);
      const doubleC = edges.find((e) => e.neighborElement === 'C' && e.order === 2);
      const oNbrs = edges.filter((e) => e.neighborElement === 'O');
      const cNbrs = edges.filter((e) => e.neighborElement === 'C');
      const nNbrs = edges.filter((e) => e.neighborElement === 'N');

      if (nNbrs.length === 2 && nNbrs.every((ne) => ne.order >= 2)) {
        handledAzideSet.add(n.id);
        nNbrs.forEach((ne) => handledAzideSet.add(ne.neighborId));
        addFG('Azide', '–N₃', 'nitrogen', 'Polar', 'Linear 1,3-dipolar N=N⁺=N⁻ chain reactive in click & Staudinger chemistry.');
      } else if (tripleC) {
        addFG('Nitrile', '–C≡N', 'nitrogen', 'Polar', 'Linear sp-hybridized strongly electron-withdrawing cyano group.');
      } else if (oNbrs.length >= 2) {
        addFG('Nitro Group', '–NO₂', 'nitrogen', 'Polar', 'Strongly resonance & inductively withdrawing group (–M, –I).');
      } else if (doubleC && !aromaticAtomSet.has(n.id)) {
        addFG('Imine (Schiff Base)', 'C=N–', 'nitrogen', 'Polar', 'Nitrogen analogue of a carbonyl; weakly basic C=N bond.');
      } else if ((n.formalCharge || 0) > 0 && edges.length === 4) {
        addFG('Ammonium Cation', 'R₄N⁺', 'charged', 'Ionic / Charged', 'Tetrahedral positively charged nitrogen lacking a lone pair.');
      } else if (cNbrs.length >= 1 && !aromaticAtomSet.has(n.id) && !nNbrs.some((ne) => ne.order >= 2)) {
        const deg = cNbrs.length === 1 ? '1° Primary' : cNbrs.length === 2 ? '2° Secondary' : '3° Tertiary';
        addFG(`Amine (${deg})`, '–NR₂', 'nitrogen', 'Polar', 'Basic nucleophilic lone pair on nitrogen (pKb ~3–4 for alkylamines).');
      }
    });

  // Alkenes & Alkynes (outside aromatic rings)
  bonds.forEach((b) => {
    const a1 = atomMap.get(b.from);
    const a2 = atomMap.get(b.to);
    if (!a1 || !a2) return;
    if (a1.element === 'C' && a2.element === 'C') {
      if (b.order === 2 && !(aromaticAtomSet.has(a1.id) && aromaticAtomSet.has(a2.id))) {
        addFG('Alkene', 'C=C', 'hydrocarbon', 'Nonpolar', 'Planar sp² π-bond; electron-rich nucleophile for electrophilic addition.');
      } else if (b.order === 3) {
        addFG('Alkyne', 'C≡C', 'hydrocarbon', 'Nonpolar', 'Linear sp triple bond (1σ + 2π); terminal C–H is weakly acidic (pKa ~25).');
      }
    }
  });

  // Halogens, Sulfur, Phosphorus, Carbocations/Carbanions
  let detectedDisulfide = false;
  atoms.forEach((a) => {
    const edges = adj.get(a.id) || [];
    if (HALOGENS.has(a.element) && edges.some((e) => e.neighborElement === 'C')) {
      addFG('Organohalide', `R–${a.element}`, 'halogen', 'Moderately Polar', 'Polarized C–X bond creates an electrophilic α-carbon for SN2/E2.');
    }
    if (a.element === 'S') {
      const hE = edges.filter((e) => e.neighborElement === 'H').length;
      const cE = edges.filter((e) => e.neighborElement === 'C').length;
      const sE = edges.filter((e) => e.neighborElement === 'S').length;
      const doubleO = edges.filter((e) => e.neighborElement === 'O' && e.order === 2).length;
      const singleO = edges.filter((e) => e.neighborElement === 'O' && e.order === 1).length;
      if (doubleO >= 2 && singleO >= 1) {
        addFG('Sulfonic Acid', '–SO₃H', 'sulfur', 'Polar', 'Strong organic acid (pKa < 0) with resonance-stabilized sulfonate anion.');
      } else if (doubleO === 1 && cE >= 2) {
        addFG('Sulfoxide', 'R₂S=O', 'sulfur', 'Polar', 'Polar aprotic pyramidal S=O group (e.g., DMSO).');
      } else if (sE >= 1 && !detectedDisulfide) {
        detectedDisulfide = true;
        addFG('Disulfide', '–S–S–', 'sulfur', 'Moderately Polar', 'Oxidized covalent S–S bridge common in folded proteins.');
      } else if (hE >= 1 && cE >= 1 && sE === 0) {
        addFG('Thiol', '–SH', 'sulfur', 'Moderately Polar', 'More acidic and nucleophilic than alcohols; forms disulfide bonds.');
      } else if (cE === 2 && doubleO === 0) {
        addFG('Sulfide (Thioether)', 'R–S–R′', 'sulfur', 'Moderately Polar', 'Sulfur analogue of an ether; soft nucleophile.');
      }
    }
    if (a.element === 'P') {
      const doubleO = edges.filter((e) => e.neighborElement === 'O' && e.order === 2).length;
      const singleO = edges.filter((e) => e.neighborElement === 'O' && e.order === 1).length;
      if (doubleO >= 1 && singleO >= 2) {
        addFG('Phosphate / Phosphoryl', '–OPO₃H₂', 'sulfur', 'Polar', 'Biological energy & nucleic acid ester linkage containing P=O.');
      } else if (edges.some((e) => e.neighborElement === 'C' || e.neighborElement === 'H')) {
        addFG('Phosphine', '–PR₂', 'sulfur', 'Moderately Polar', 'Pyramidal Phosphorus Lewis base and soft coordination ligand.');
      }
    }
    if (a.element === 'C' && (a.formalCharge || 0) > 0) {
      addFG('Carbocation', 'C⁺', 'charged', 'Ionic / Charged', 'Electron-deficient sp² electrophile with an empty 2p orbital.');
    } else if (a.element === 'C' && (a.formalCharge || 0) < 0) {
      addFG('Carbanion', 'C⁻', 'charged', 'Ionic / Charged', 'Electron-rich lone-pair carbon acting as a super-base/nucleophile.');
    }
  });

  const functionalGroups = Array.from(fgCounts.values());

  // ==========================================================
  // 4. ACID-BASE, INDUCTIVE & REACTIVITY INSIGHTS
  // ==========================================================
  const hasCarboxylicAcid = functionalGroups.some((f) => f.name === 'Carboxylic Acid');
  const hasPhenol = functionalGroups.some((f) => f.name === 'Phenol');
  const hasAmine = functionalGroups.some((f) => f.name.startsWith('Amine'));
  const hasBoronLewis = atoms.some((a) => a.element === 'B' && (adj.get(a.id) || []).length <= 3 && (a.formalCharge || 0) === 0);
  const hasCarbocation = functionalGroups.some((f) => f.name === 'Carbocation');

  let acidBaseCharacter = 'Neutral';
  let acidBaseDetails = 'No strongly acidic protons or basic lone-pair centers detected.';

  if ((hasCarboxylicAcid || hasPhenol) && hasAmine) {
    acidBaseCharacter = 'Amphoteric (Acid + Base)';
    acidBaseDetails = 'Contains both acidic –OH/–COOH proton donors and basic amine lone pairs (capable of zwitterion formation).';
  } else if (hasCarboxylicAcid) {
    acidBaseCharacter = 'Weak Organic Acid (pKa ~4–5)';
    acidBaseDetails = 'Donates H⁺ from –COOH; conjugate base –COO⁻ is stabilized by two equivalent resonance structures.';
  } else if (hasPhenol) {
    acidBaseCharacter = 'Weak Acid (pKa ~10)';
    acidBaseDetails = 'More acidic than aliphatic alcohols because the phenoxide anion delocalizes negative charge into the aromatic ring.';
  } else if (hasAmine) {
    acidBaseCharacter = 'Weak Organic Base';
    acidBaseDetails = 'Nitrogen lone pair readily accepts H⁺ to form an ammonium ion (or acts as a nucleophile).';
  } else if (hasBoronLewis || hasCarbocation) {
    acidBaseCharacter = 'Lewis Acid (Electrophile)';
    acidBaseDetails = 'Contains an empty 2p orbital capable of accepting an electron pair from a Lewis base.';
  } else if (netCharge > 0 && hBondDonors > 0) {
    acidBaseCharacter = 'Brønsted–Lowry Acidic Cation';
    acidBaseDetails = 'Positively charged protonated species ready to donate H⁺.';
  } else if (netCharge < 0) {
    acidBaseCharacter = 'Brønsted–Lowry Base / Nucleophile';
    acidBaseDetails = 'Negatively charged ion with high electron density ready to accept H⁺ or attack electrophiles.';
  } else if (hBondDonors > 0 && hBondAcceptors > 0) {
    acidBaseCharacter = 'Amphoteric / Weakly Protic';
    acidBaseDetails = 'Can act as a very weak acid (–OH/–NH) or weak Lewis base via lone pairs.';
  }

  // Inductive & Reactivity Highlights
  const ewgList: string[] = [];
  if (atoms.some((a) => HALOGENS.has(a.element))) ewgList.push('Halogens (–I inductive pull)');
  if (consumedCarbonylCarbonIds.size > 0) ewgList.push('Carbonyl C=O (–I & –M electron-withdrawing)');
  if (functionalGroups.some((f) => f.name === 'Nitro Group' || f.name === 'Nitrile')) ewgList.push('–NO₂ / –CN (strong –I, –M)');
  if (atoms.some((a) => a.element === 'O' && !consumedOxygenIds.has(a.id))) ewgList.push('Hydroxyl/Ether Oxygen (–I inductive pull)');

  const inductiveSummary =
    ewgList.length > 0
      ? `Electron-withdrawing effects from ${ewgList.join(', ')}${carbonDegrees.secondary + carbonDegrees.tertiary > 0 ? '; alkyl carbons provide mild +I inductive donation.' : '.'}`
      : isOrganic
      ? 'Purely +I alkyl / C–H framework with minimal inductive polarization.'
      : 'Polarized by electronegativity differences across inorganic bonds.';

  const reactivityHighlights: string[] = [];
  if (consumedCarbonylCarbonIds.size > 0) reactivityHighlights.push('Electrophilic carbonyl carbon(s) susceptible to nucleophilic attack');
  if (functionalGroups.some((f) => f.name === 'Alkene' || f.name === 'Alkyne')) reactivityHighlights.push('Electron-rich π bond(s) reactive toward electrophilic addition');
  if (functionalGroups.some((f) => f.name === 'Organohalide')) reactivityHighlights.push('Polar C–X bond acts as a leaving group in SN1/SN2/E1/E2 reactions');
  if (aromaticRings.length > 0) reactivityHighlights.push('Aromatic ring favors Electrophilic Aromatic Substitution (EAS)');
  if (hBondDonors > 0) reactivityHighlights.push('Protic X–H bond(s) participate in proton transfer & H-bonding');
  if (reactivityHighlights.length === 0 && isOrganic) {
    reactivityHighlights.push('Saturated σ-bond framework: relatively inert except free-radical substitution or combustion');
  }

  // Aromaticity Summary
  let aromaticityStatus: OrganicChemistryReport['aromaticityStatus'] = 'Non-aromatic / Aliphatic';
  let aromaticityDetails = 'No planar cyclic conjugated 4n+2 π-electron ring detected.';
  if (aromaticRings.length > 0) {
    aromaticityStatus = 'Aromatic (4n+2 π)';
    aromaticityDetails = `Contains ${aromaticRings.length} Hückel-aromatic ring${aromaticRings.length > 1 ? 's' : ''} with fully delocalized cyclic π electrons.`;
  } else if (antiaromaticRings.length > 0) {
    aromaticityStatus = 'Antiaromatic (4n π)';
    aromaticityDetails = 'Contains a cyclic conjugated 4n π-electron loop (electronically destabilized if planar).';
  }

  const hasResonance = resonanceSystems.length > 0;
  const resonanceTypesPresent = Array.from(new Set(resonanceSystems.map((r) => r.type)));
  const resonanceSummary = hasResonance
    ? `Resonance-stabilized molecule exhibiting ${resonanceSystems.length} delocalized motif${resonanceSystems.length > 1 ? 's' : ''}: ${resonanceTypesPresent.join('; ')}.`
    : 'No true π or lone-pair resonance detected — all bonding and non-bonding electrons remain localized in σ bonds, isolated π bonds, or sp³ lone pairs.';

  return {
    isEmpty: false,
    atomCount: atoms.length,
    heavyAtomCount: atoms.filter((a) => a.element !== 'H').length,
    bondCount: bonds.length,
    sigmaBondCount: bonds.length,
    piBondCount,
    ringCount,
    ihd,
    ihdBreakdown,
    totalValenceElectrons,
    totalLonePairs,
    netCharge,
    dipoleMagnitudeEstimate,
    maxBondDeltaEN: Math.round(maxBondDeltaEN * 100) / 100,
    polarityClass,
    polarityReason,
    dominantIMF,
    hBondDonors,
    hBondAcceptors,
    solubilityEstimate,
    acidBaseCharacter,
    acidBaseDetails,
    isOrganic,
    carbonHybridizationCounts,
    carbonDegrees,
    functionalGroups,
    aromaticityStatus,
    aromaticityDetails,
    inductiveSummary,
    reactivityHighlights,
    octetSummary: {
      allSatisfied: deficientAtoms.length === 0 && expandedAtoms.length === 0 && radicalAtoms.length === 0,
      deficientAtoms,
      expandedAtoms,
      radicalAtoms,
    },
    hasResonance,
    resonanceSystems,
    resonanceSummary,
    resonanceTypesPresent,
    hyperconjugationNote,
    atomProfiles: Array.from(profileMap.values()),
  };
}

export interface ResonanceContributor {
  index: number;
  label: string;
  weightTag: 'Major (Equivalent)' | 'Major' | 'Significant' | 'Minor (Dipolar)';
  description: string;
  arrowSummary: string;
  atoms: MolecularAtom[];
  bonds: MolecularBond[];
  activeBondIds: string[];
  activeAtomIds: string[];
}

/**
 * Generates an ordered sequence of chemically valid Resonance Contributors (Canonical Forms)
 * so continuous resonance can animate bonds and formal charges (+ / -) shifting across the 3D molecule.
 */
export function generateResonanceContributors(
  baseAtoms: MolecularAtom[],
  baseBonds: MolecularBond[],
  report: OrganicChemistryReport
): ResonanceContributor[] {
  if (!report.hasResonance || baseAtoms.length === 0 || baseBonds.length === 0) {
    return [];
  }

  const cloneAtoms = (): MolecularAtom[] =>
    baseAtoms.map((a) => ({ ...a, position: [...a.position] as [number, number, number] }));
  const cloneBonds = (): MolecularBond[] => baseBonds.map((b) => ({ ...b }));

  const findBond = (bondList: MolecularBond[], idA: string, idB: string) =>
    bondList.find((b) => (b.from === idA && b.to === idB) || (b.from === idB && b.to === idA));

  const setAtomCharge = (atomList: MolecularAtom[], atomId: string, charge: number) => {
    const target = atomList.find((a) => a.id === atomId);
    if (target) target.formalCharge = charge;
  };

  const deltaAtomCharge = (atomList: MolecularAtom[], atomId: string, delta: number) => {
    const target = atomList.find((a) => a.id === atomId);
    if (target) target.formalCharge = (target.formalCharge || 0) + delta;
  };

  const adj = new Map<string, Array<{ neighborId: string; bondId: string; order: 1 | 2 | 3 }>>();
  baseAtoms.forEach((a) => adj.set(a.id, []));
  baseBonds.forEach((b) => {
    adj.get(b.from)?.push({ neighborId: b.to, bondId: b.id, order: b.order });
    adj.get(b.to)?.push({ neighborId: b.from, bondId: b.id, order: b.order });
  });

  const contributors: ResonanceContributor[] = [];

  const pushContributor = (
    label: string,
    weightTag: ResonanceContributor['weightTag'],
    description: string,
    arrowSummary: string,
    cAtoms: MolecularAtom[],
    cBonds: MolecularBond[],
    activeBondIds: string[],
    activeAtomIds: string[]
  ) => {
    contributors.push({
      index: contributors.length,
      label,
      weightTag,
      description,
      arrowSummary,
      atoms: cAtoms,
      bonds: cBonds,
      activeBondIds,
      activeAtomIds,
    });
  };

  // Deduplication signature for canonical forms
  const stateSignature = (cAtoms: MolecularAtom[], cBonds: MolecularBond[]) => {
    const aSig = cAtoms.map((a) => `${a.id}:${a.formalCharge || 0}`).join('|');
    const bSig = cBonds.map((b) => `${b.id}:${b.order}`).join('|');
    return `${aSig}__${bSig}`;
  };
  const seenStates = new Set<string>();

  const addUnique = (
    label: string,
    weightTag: ResonanceContributor['weightTag'],
    description: string,
    arrowSummary: string,
    cAtoms: MolecularAtom[],
    cBonds: MolecularBond[],
    activeBondIds: string[],
    activeAtomIds: string[]
  ) => {
    const sig = stateSignature(cAtoms, cBonds);
    if (seenStates.has(sig)) return;
    seenStates.add(sig);
    pushContributor(label, weightTag, description, arrowSummary, cAtoms, cBonds, activeBondIds, activeAtomIds);
  };

  // Helper: order a cycle's atoms sequentially around the ring
  const orderCycle = (cycleIds: string[]): string[] => {
    if (cycleIds.length < 3) return cycleIds;
    const cycleSet = new Set(cycleIds);
    const ordered = [cycleIds[0]];
    const used = new Set([cycleIds[0]]);
    while (ordered.length < cycleIds.length) {
      const curr = ordered[ordered.length - 1];
      const next = (adj.get(curr) || []).find((e) => cycleSet.has(e.neighborId) && !used.has(e.neighborId));
      if (!next) break;
      used.add(next.neighborId);
      ordered.push(next.neighborId);
    }
    return ordered;
  };

  // 1. Equivalent Oxoanion / Carboxylate / Carbonate / Nitrate / Ozone
  const equivSys = report.resonanceSystems.find(
    (s) => s.type === 'Equivalent Lone-Pair to π (n → π*) Delocalization'
  );
  if (equivSys && equivSys.atomIds.length >= 3) {
    const centerId = equivSys.atomIds[0];
    const terminals = equivSys.atomIds.slice(1);
    const terminalBonds = terminals
      .map((tid) => ({ tid, bond: findBond(baseBonds, centerId, tid) }))
      .filter((x): x is { tid: string; bond: MolecularBond } => !!x.bond);

    const doubleCount = terminalBonds.filter((tb) => tb.bond.order === 2).length;
    if (terminalBonds.length >= 2 && doubleCount >= 1) {
      // Total negative charge carried across terminals in original state
      const totalTerminalCharge = terminalBonds.reduce((sum, tb) => {
        const atom = baseAtoms.find((a) => a.id === tb.tid);
        return sum + (atom?.formalCharge || 0);
      }, 0);

      // Build rotated forms so double bond + negative charge swap symmetrically
      for (let shift = 0; shift < terminalBonds.length; shift++) {
        const cAtoms = cloneAtoms();
        const cBonds = cloneBonds();
        const activeBIds: string[] = [];
        const activeAIds: string[] = [centerId];

        const doubleIndices = new Set<number>();
        for (let k = 0; k < doubleCount; k++) {
          doubleIndices.add((shift + k) % terminalBonds.length);
        }

        const singleTerminalCount = terminalBonds.length - doubleCount;
        const chargePerSingle =
          singleTerminalCount > 0 && totalTerminalCharge < 0
            ? Math.round(totalTerminalCharge / singleTerminalCount)
            : singleTerminalCount > 0 && baseAtoms.find((a) => a.id === centerId)?.element === 'O'
            ? -1
            : 0;

        terminalBonds.forEach((tb, idx) => {
          const b = cBonds.find((x) => x.id === tb.bond.id)!;
          activeBIds.push(b.id);
          activeAIds.push(tb.tid);
          if (doubleIndices.has(idx)) {
            b.order = 2;
            setAtomCharge(cAtoms, tb.tid, 0);
          } else {
            b.order = 1;
            setAtomCharge(cAtoms, tb.tid, chargePerSingle);
          }
        });

        const doubleNames = Array.from(doubleIndices).map((i) => terminalBonds[i].tid).join(', ');
        const negNames = terminalBonds
          .filter((_, idx) => !doubleIndices.has(idx))
          .map((tb) => `${tb.tid}⁻`)
          .join(', ');

        addUnique(
          `Equivalent Form ${shift + 1}`,
          'Major (Equivalent)',
          `Double bond sits at ${centerId}=${doubleNames} while negative charge resides on ${negNames || 'terminal oxygen'}.`,
          `Lone pair pushes from ${negNames || 'O⁻'} into ${centerId}, shifting π bond onto ${doubleNames}.`,
          cAtoms,
          cBonds,
          activeBIds,
          activeAIds
        );
      }
    }
  }

  // 2. Aromatic Rings (Benzene Kekulé I <-> II, plus Phenol / Aniline / Phenoxide +M walk)
  const aromSys = report.resonanceSystems.find(
    (s) => s.type === 'Aromatic Cyclic Delocalization (Hückel 4n+2 π)'
  );
  if (aromSys && aromSys.atomIds.length >= 5) {
    const ring = orderCycle(aromSys.atomIds);
    const ringBonds = ring.map((id, idx) => findBond(baseBonds, id, ring[(idx + 1) % ring.length]));

    if (ringBonds.every((b): b is MolecularBond => !!b)) {
      const ringBondIds = ringBonds.map((b) => b.id);

      // Form 1: Original Kekulé
      addUnique(
        'Kekulé Structure I',
        'Major (Equivalent)',
        'Alternating π bonds around the aromatic ring (Kekulé Form I).',
        '6 π electrons delocalized in cyclic loop; push all 3 π bonds clockwise to form Kekulé II.',
        cloneAtoms(),
        cloneBonds(),
        ringBondIds,
        ring
      );

      // Check for +M substituent attached to a 6-membered aromatic ring (e.g. Phenol, Phenoxide, Aniline)
      const plusMDonorSys = report.resonanceSystems.find(
        (s) =>
          s.type === 'Lone-Pair to π Mesomeric Donation (n → π* / +M)' &&
          ring.includes(s.atomIds[1])
      );

      if (plusMDonorSys && ring.length === 6) {
        const donorId = plusMDonorSys.atomIds[0];
        const ipsoId = plusMDonorSys.atomIds[1];
        const ipsoIdx = ring.indexOf(ipsoId);
        const orderedFromIpso = Array.from({ length: 6 }, (_, k) => ring[(ipsoIdx + k) % 6]);
        // orderedFromIpso: [0: ipso, 1: ortho1, 2: meta1, 3: para, 4: meta2, 5: ortho2]
        const exocyclicBond = findBond(baseBonds, donorId, ipsoId);
        const b01 = findBond(baseBonds, orderedFromIpso[0], orderedFromIpso[1]);
        const b12 = findBond(baseBonds, orderedFromIpso[1], orderedFromIpso[2]);
        const b23 = findBond(baseBonds, orderedFromIpso[2], orderedFromIpso[3]);
        const b34 = findBond(baseBonds, orderedFromIpso[3], orderedFromIpso[4]);
        const b45 = findBond(baseBonds, orderedFromIpso[4], orderedFromIpso[5]);
        const b50 = findBond(baseBonds, orderedFromIpso[5], orderedFromIpso[0]);

        if (exocyclicBond && b01 && b12 && b23 && b34 && b45 && b50) {
          const allActiveB = [exocyclicBond.id, ...ringBondIds];
          const allActiveA = [donorId, ...ring];

          // Ortho-1 carbanion contributor
          {
            const cA = cloneAtoms();
            const cB = cloneBonds();
            cB.find((b) => b.id === exocyclicBond.id)!.order = 2;
            cB.find((b) => b.id === b01.id)!.order = 1;
            cB.find((b) => b.id === b12.id)!.order = 1;
            cB.find((b) => b.id === b23.id)!.order = 2;
            cB.find((b) => b.id === b34.id)!.order = 1;
            cB.find((b) => b.id === b45.id)!.order = 2;
            cB.find((b) => b.id === b50.id)!.order = 1;
            deltaAtomCharge(cA, donorId, +1);
            deltaAtomCharge(cA, orderedFromIpso[1], -1);
            addUnique(
              'Ortho (+M) Contributor',
              'Significant',
              `Lone pair forms ${donorId}=${ipsoId} double bond while negative charge shifts onto ortho carbon ${orderedFromIpso[1]}⁻.`,
              `LP(${donorId}) → ${donorId}=${ipsoId}; ring π bond pushes onto ${orderedFromIpso[1]}⁻.`,
              cA,
              cB,
              allActiveB,
              allActiveA
            );
          }

          // Para carbanion contributor
          {
            const cA = cloneAtoms();
            const cB = cloneBonds();
            cB.find((b) => b.id === exocyclicBond.id)!.order = 2;
            cB.find((b) => b.id === b01.id)!.order = 1;
            cB.find((b) => b.id === b12.id)!.order = 2;
            cB.find((b) => b.id === b23.id)!.order = 1;
            cB.find((b) => b.id === b34.id)!.order = 1;
            cB.find((b) => b.id === b45.id)!.order = 2;
            cB.find((b) => b.id === b50.id)!.order = 1;
            deltaAtomCharge(cA, donorId, +1);
            deltaAtomCharge(cA, orderedFromIpso[3], -1);
            addUnique(
              'Para (+M) Contributor',
              'Significant',
              `Negative charge shifts across the ring to the para carbon ${orderedFromIpso[3]}⁻.`,
              `Lone pair at ${orderedFromIpso[1]}⁻ shifts to ${orderedFromIpso[1]}=${orderedFromIpso[2]} and pushes π electrons to ${orderedFromIpso[3]}⁻.`,
              cA,
              cB,
              allActiveB,
              allActiveA
            );
          }

          // Ortho-2 carbanion contributor
          {
            const cA = cloneAtoms();
            const cB = cloneBonds();
            cB.find((b) => b.id === exocyclicBond.id)!.order = 2;
            cB.find((b) => b.id === b01.id)!.order = 1;
            cB.find((b) => b.id === b12.id)!.order = 2;
            cB.find((b) => b.id === b23.id)!.order = 1;
            cB.find((b) => b.id === b34.id)!.order = 2;
            cB.find((b) => b.id === b45.id)!.order = 1;
            cB.find((b) => b.id === b50.id)!.order = 1;
            deltaAtomCharge(cA, donorId, +1);
            deltaAtomCharge(cA, orderedFromIpso[5], -1);
            addUnique(
              'Ortho′ (+M) Contributor',
              'Significant',
              `Negative charge delocalizes to the opposite ortho carbon ${orderedFromIpso[5]}⁻ before returning to ${donorId}.`,
              `π electrons shift to ${orderedFromIpso[3]}=${orderedFromIpso[4]} and push charge onto ${orderedFromIpso[5]}⁻.`,
              cA,
              cB,
              allActiveB,
              allActiveA
            );
          }
        }
      }

      // Form 2 (or final Kekulé): Inverted alternating double/single bonds around the ring
      {
        const cAtoms = cloneAtoms();
        const cBonds = cloneBonds();
        ringBonds.forEach((origB) => {
          const targetB = cBonds.find((b) => b.id === origB.id)!;
          targetB.order = origB.order === 2 ? 1 : 2;
        });
        addUnique(
          'Kekulé Structure II',
          'Major (Equivalent)',
          'All π bonds in the aromatic ring have shifted by one position (Kekulé Form II).',
          'Continuous 6π cyclic delocalization rotates every C=C double bond around the ring.',
          cAtoms,
          cBonds,
          ringBondIds,
          ring
        );
      }
    }
  }

  // 3. Amide / Carboxylic Acid / Ester Resonance (O=C–N or O=C–OH/OR)
  report.resonanceSystems
    .filter(
      (s) =>
        s.type === 'Amide Resonance (n → π* Peptide Conjugation)' ||
        s.type === 'Carboxylic / Ester Resonance (n → π*)'
    )
    .forEach((sys) => {
      if (sys.atomIds.length < 3) return;
      const [oId, cId, donorId] = sys.atomIds;
      const bCO = findBond(baseBonds, cId, oId);
      const bCD = findBond(baseBonds, cId, donorId);
      if (!bCO || !bCD) return;

      addUnique(
        'Neutral Carbonyl (Major)',
        'Major',
        `Carbonyl π bond is localized at ${cId}=${oId} with zero charge separation.`,
        `Lone pair on ${donorId} prepares to donate into ${cId}=${oId} π* orbital.`,
        cloneAtoms(),
        cloneBonds(),
        [bCO.id, bCD.id],
        [oId, cId, donorId]
      );

      const cA = cloneAtoms();
      const cB = cloneBonds();
      cB.find((b) => b.id === bCO.id)!.order = 1;
      cB.find((b) => b.id === bCD.id)!.order = 2;
      deltaAtomCharge(cA, oId, -1);
      deltaAtomCharge(cA, donorId, +1);

      addUnique(
        'Dipolar Delocalized Form',
        sys.type.startsWith('Amide') ? 'Significant' : 'Minor (Dipolar)',
        `Double bond shifts to ${cId}=${donorId}⁺ while negative charge moves onto ${oId}⁻!`,
        `LP(${donorId}) → ${cId}=${donorId}; ${cId}=${oId} π bond breaks onto ${oId}⁻.`,
        cA,
        cB,
        [bCO.id, bCD.id],
        [oId, cId, donorId]
      );
    });

  // 4. +M Lone-Pair Donation outside aromatic rings (Enolate C=C-O⁻, Enamine, Vinyl Halide)
  report.resonanceSystems
    .filter((s) => s.type === 'Lone-Pair to π Mesomeric Donation (n → π* / +M)')
    .forEach((sys) => {
      if (sys.atomIds.length < 3) return;
      const [donorId, midId, endId] = sys.atomIds;
      if (aromSys && aromSys.atomIds.includes(midId)) return; // Already handled by ring +M walk

      const bDM = findBond(baseBonds, donorId, midId);
      const bME = findBond(baseBonds, midId, endId);
      if (!bDM || !bME || bDM.order !== 1 || bME.order < 2) return;

      addUnique(
        'Canonical Form I',
        'Major',
        `π bond sits between ${midId} and ${endId}; lone pair resides on ${donorId}.`,
        `Lone pair on ${donorId} shifts toward ${midId}.`,
        cloneAtoms(),
        cloneBonds(),
        [bDM.id, bME.id],
        [donorId, midId, endId]
      );

      const cA = cloneAtoms();
      const cB = cloneBonds();
      cB.find((b) => b.id === bDM.id)!.order = 2;
      cB.find((b) => b.id === bME.id)!.order = (bME.order - 1) as 1 | 2;
      deltaAtomCharge(cA, donorId, +1);
      deltaAtomCharge(cA, endId, -1);

      const donorNowNeutral = (cA.find((a) => a.id === donorId)?.formalCharge || 0) === 0;
      addUnique(
        donorNowNeutral ? 'Carbonyl Enolate Shift (Major)' : 'Zwitterionic +M Shift',
        donorNowNeutral ? 'Major' : 'Minor (Dipolar)',
        `Double bond moves to ${donorId}=${midId} and negative charge transfers to ${endId}⁻!`,
        `LP(${donorId}) → ${donorId}=${midId}; π bond shifts onto ${endId}⁻.`,
        cA,
        cB,
        [bDM.id, bME.id],
        [donorId, midId, endId]
      );
    });

  // 5. Acyclic π–π Conjugation (1,3-Butadiene, α,β-Unsaturated Carbonyl)
  report.resonanceSystems
    .filter((s) => s.type === 'π–π Conjugation (Alternating Multiple Bonds)')
    .forEach((sys) => {
      // Trace ordered chain of pi atoms connected by alternating bonds
      const nodeSet = new Set(sys.atomIds);
      const endpoints = sys.atomIds.filter((id) => {
        const degInSys = (adj.get(id) || []).filter((e) => nodeSet.has(e.neighborId)).length;
        return degInSys === 1;
      });
      const startNode = endpoints[0] || sys.atomIds[0];
      const chain: string[] = [startNode];
      const used = new Set([startNode]);
      while (chain.length < sys.atomIds.length) {
        const curr = chain[chain.length - 1];
        const nxt = (adj.get(curr) || []).find((e) => nodeSet.has(e.neighborId) && !used.has(e.neighborId));
        if (!nxt) break;
        used.add(nxt.neighborId);
        chain.push(nxt.neighborId);
      }

      if (chain.length >= 4) {
        const chainBonds = chain
          .slice(0, -1)
          .map((id, i) => findBond(baseBonds, id, chain[i + 1]))
          .filter((b): b is MolecularBond => !!b);
        const chainBondIds = chainBonds.map((b) => b.id);

        if (chainBonds.length === chain.length - 1) {
          addUnique(
            'Neutral Conjugated Form',
            'Major',
            `Alternating π bonds sit on terminal pairs (${chain[0]}=${chain[1]} and ${chain[chain.length - 2]}=${chain[chain.length - 1]}).`,
            'Parallel p-orbitals allow π electrons to flow across the central single bond.',
            cloneAtoms(),
            cloneBonds(),
            chainBondIds,
            chain
          );

          // Shift π bonds toward last atom (rightward)
          {
            const cA = cloneAtoms();
            const cB = cloneBonds();
            chainBonds.forEach((origB, idx) => {
              const b = cB.find((x) => x.id === origB.id)!;
              b.order = idx % 2 === 1 ? 2 : 1;
            });
            deltaAtomCharge(cA, chain[0], +1);
            deltaAtomCharge(cA, chain[chain.length - 1], -1);
            addUnique(
              'Dipolar Shift (→ Terminal ⁻)',
              'Minor (Dipolar)',
              `Central single bond gains double-bond character while negative charge moves onto ${chain[chain.length - 1]}⁻ (${chain[0]}⁺ left electron-deficient).`,
              `π electrons shift right across backbone: ${chain[0]}⁺ — ${chain.slice(1, -1).join('=')} — ${chain[chain.length - 1]}⁻.`,
              cA,
              cB,
              chainBondIds,
              chain
            );
          }

          // If ends have identical electronegativity (e.g. hydrocarbon diene), also show reverse shift
          const elStart = baseAtoms.find((a) => a.id === chain[0])?.element;
          const elEnd = baseAtoms.find((a) => a.id === chain[chain.length - 1])?.element;
          if (elStart === elEnd) {
            const cA = cloneAtoms();
            const cB = cloneBonds();
            chainBonds.forEach((origB, idx) => {
              const b = cB.find((x) => x.id === origB.id)!;
              b.order = idx % 2 === 1 ? 2 : 1;
            });
            deltaAtomCharge(cA, chain[0], -1);
            deltaAtomCharge(cA, chain[chain.length - 1], +1);
            addUnique(
              'Dipolar Shift (← Terminal ⁻)',
              'Minor (Dipolar)',
              `Mirror charge-separated form places negative charge on ${chain[0]}⁻ and positive charge on ${chain[chain.length - 1]}⁺.`,
              `π electrons shift left across central double bond onto ${chain[0]}⁻.`,
              cA,
              cB,
              chainBondIds,
              chain
            );
          }
        }
      }
    });

  // 6. Vacant p-Orbital Conjugation (Allylic C=C-C⁺, BF3 back-bonding, Oxocarbenium C⁺-O)
  report.resonanceSystems
    .filter(
      (s) =>
        s.type === 'Vacant p-Orbital Conjugation (π → p / Allylic-Benzylic)' ||
        s.type === 'pπ–pπ Back-Bonding (Lone Pair → Vacant p-Orbital)'
    )
    .forEach((sys) => {
      if (sys.type === 'Vacant p-Orbital Conjugation (π → p / Allylic-Benzylic)' && sys.atomIds.length >= 3) {
        const [vacId, midId, endId] = sys.atomIds;
        const bVM = findBond(baseBonds, vacId, midId);
        const bME = findBond(baseBonds, midId, endId);
        if (bVM && bME && bME.order >= 2) {
          addUnique(
            'Allylic Cation Form I',
            'Major',
            `Positive charge sits on ${vacId}⁺ adjacent to the ${midId}=${endId} double bond.`,
            `${midId}=${endId} π electrons swing toward empty 2p orbital on ${vacId}⁺.`,
            cloneAtoms(),
            cloneBonds(),
            [bVM.id, bME.id],
            [vacId, midId, endId]
          );

          const cA = cloneAtoms();
          const cB = cloneBonds();
          cB.find((b) => b.id === bVM.id)!.order = 2;
          cB.find((b) => b.id === bME.id)!.order = 1;
          deltaAtomCharge(cA, vacId, -1);
          deltaAtomCharge(cA, endId, +1);
          addUnique(
            'Allylic Cation Form II',
            'Major (Equivalent)',
            `Double bond shifts to ${vacId}=${midId} while positive charge moves to ${endId}⁺.`,
            `π bond now sits between ${vacId}=${midId}; ${endId}⁺ carries the vacant orbital.`,
            cA,
            cB,
            [bVM.id, bME.id],
            [vacId, midId, endId]
          );
        }
      } else if (sys.type === 'pπ–pπ Back-Bonding (Lone Pair → Vacant p-Orbital)') {
        const centerId = sys.atomIds[0];
        const donors = sys.atomIds.slice(1);
        const centerEl = baseAtoms.find((a) => a.id === centerId)?.element;

        addUnique(
          centerEl === 'B' ? 'All-Single Neutral Form (Major)' : 'Carbocation Form',
          centerEl === 'B' ? 'Major' : 'Significant',
          `Single bonds around ${centerId} with an empty unhybridized 2p orbital.`,
          `Adjacent lone-pair donor donates pπ density into ${centerId}.`,
          cloneAtoms(),
          cloneBonds(),
          donors.map((d) => findBond(baseBonds, centerId, d)?.id).filter((x): x is string => !!x),
          [centerId, ...donors]
        );

        donors.forEach((dId, i) => {
          const bond = findBond(baseBonds, centerId, dId);
          if (!bond || bond.order !== 1) return;
          const cA = cloneAtoms();
          const cB = cloneBonds();
          cB.find((b) => b.id === bond.id)!.order = 2;
          deltaAtomCharge(cA, centerId, -1);
          deltaAtomCharge(cA, dId, +1);
          addUnique(
            centerEl === 'B' ? `pπ–pπ Back-Bond Form ${i + 1}` : 'Octet-Complete Oxocarbenium (Major)',
            centerEl === 'B' ? 'Minor (Dipolar)' : 'Major',
            `${dId} donates a lone pair to form ${centerId}⁻=${dId}⁺, filling ${centerId}'s octet.`,
            `LP(${dId}) → ${centerId}=${dId} π bond; formal charges shift to ${centerId}⁻ and ${dId}⁺.`,
            cA,
            cB,
            [bond.id],
            [centerId, dId]
          );
        });
      }
    });

  // 7. Cumulated / Dipolar π Resonance (CO2)
  report.resonanceSystems
    .filter((s) => s.type === 'Cumulated / Dipolar π-Resonance')
    .forEach((sys) => {
      if (sys.atomIds.length < 3) return;
      const [leftId, centerId, rightId] = sys.atomIds;
      const bL = findBond(baseBonds, leftId, centerId);
      const bR = findBond(baseBonds, centerId, rightId);
      if (!bL || !bR) return;

      addUnique(
        'Neutral Cumulated Form (Major)',
        'Major',
        `Symmetric double bonds (${leftId}=${centerId}=${rightId}) with zero formal charges.`,
        'Minor dipolar resonance creates triple/single bond shifts toward terminal oxygens.',
        cloneAtoms(),
        cloneBonds(),
        [bL.id, bR.id],
        [leftId, centerId, rightId]
      );

      // Left negative, Right positive triple
      {
        const cA = cloneAtoms();
        const cB = cloneBonds();
        cB.find((b) => b.id === bL.id)!.order = 1;
        cB.find((b) => b.id === bR.id)!.order = 3;
        deltaAtomCharge(cA, leftId, -1);
        deltaAtomCharge(cA, rightId, +1);
        addUnique(
          `Dipolar Form (${leftId}⁻ / ${rightId}⁺)`,
          'Minor (Dipolar)',
          `Negative charge moves onto ${leftId}⁻ (single bond) while ${centerId}≡${rightId}⁺ becomes a triple bond.`,
          `π bond breaks onto ${leftId}⁻ as LP(${rightId}) forms triple bond ${centerId}≡${rightId}⁺.`,
          cA,
          cB,
          [bL.id, bR.id],
          [leftId, centerId, rightId]
        );
      }

      // Right negative, Left positive triple
      {
        const cA = cloneAtoms();
        const cB = cloneBonds();
        cB.find((b) => b.id === bL.id)!.order = 3;
        cB.find((b) => b.id === bR.id)!.order = 1;
        deltaAtomCharge(cA, leftId, +1);
        deltaAtomCharge(cA, rightId, -1);
        addUnique(
          `Dipolar Form (${leftId}⁺ / ${rightId}⁻)`,
          'Minor (Dipolar)',
          `Negative charge swaps to ${rightId}⁻ (single bond) while ${leftId}⁺≡${centerId} becomes a triple bond.`,
          `Symmetric electron shift places negative charge on ${rightId}⁻.`,
          cA,
          cB,
          [bL.id, bR.id],
          [leftId, centerId, rightId]
        );
      }
    });

  return contributors;
}

