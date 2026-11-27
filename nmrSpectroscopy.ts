import { MoleculeData, MolecularAtom, MolecularBond } from '../types/chemistry';

export type NmrMultiplicity = 's' | 'd' | 't' | 'q' | 'quint' | 'sext' | 'sept' | 'm' | 'br s';
export type NmrRegionId = 'acid_aldehyde' | 'aromatic_vinyl' | 'heteroatom_alpha' | 'aliphatic';

export interface NmrPeak {
  id: string;
  shiftPpm: number; // Chemical shift δ in ppm (0.0 - 12.5)
  protonCount: number; // Integration (e.g., 1, 2, 3, 6)
  multiplicity: NmrMultiplicity;
  jCouplingHz?: number; // Typical J-coupling in Hz
  groupLabel: string; // e.g. "–CH₃", "–CH₂–", "Ar–H", "–COOH"
  environment: string; // e.g. "Methyl adjacent to ester oxygen"
  isExchangeable?: boolean; // True for O-H, N-H, COOH (D2O exchangeable)
  region: NmrRegionId;
  matchingBondIndices: number[];
  matchingAtomIds: string[];
  description: string;
}

export interface NmrSpectrumPoint {
  ppm: number; // 12.5 down to 0.0
  intensity: number; // Normalized 0.0 - 1.0
  integral: number; // Cumulative stepped integral (0.0 - 1.0)
}

export interface NmrSpectrumAnalysis {
  peaks: NmrPeak[];
  curve: NmrSpectrumPoint[];
  hasProtons: boolean;
  totalProtons: number;
  solventNote: string;
  summaryNote: string;
}

export const NMR_REGIONS: Array<{
  id: NmrRegionId;
  label: string;
  shortLabel: string;
  minPpm: number;
  maxPpm: number;
  color: string;
}> = [
  { id: 'acid_aldehyde', label: 'Carboxylic & Aldehyde (9.0–12.5)', shortLabel: 'COOH / CHO', minPpm: 9.0, maxPpm: 12.5, color: '#f43f5e' },
  { id: 'aromatic_vinyl', label: 'Aromatic & Alkene (4.5–9.0)', shortLabel: 'Aromatic / Vinyl', minPpm: 4.5, maxPpm: 9.0, color: '#f59e0b' },
  { id: 'heteroatom_alpha', label: 'α-Heteroatom & OH (2.5–4.5)', shortLabel: 'C–O / C–N / OH', minPpm: 2.5, maxPpm: 4.5, color: '#38bdf8' },
  { id: 'aliphatic', label: 'Aliphatic & TMS (0.0–2.5)', shortLabel: 'Aliphatic', minPpm: 0.0, maxPpm: 2.5, color: '#10b981' },
];

function getRegionForPpm(ppm: number): NmrRegionId {
  if (ppm >= 9.0) return 'acid_aldehyde';
  if (ppm >= 4.5) return 'aromatic_vinyl';
  if (ppm >= 2.5) return 'heteroatom_alpha';
  return 'aliphatic';
}

function getPascalWeights(mult: NmrMultiplicity): number[] {
  switch (mult) {
    case 's':
    case 'br s':
      return [1];
    case 'd':
      return [1, 1];
    case 't':
      return [1, 2, 1];
    case 'q':
      return [1, 3, 3, 1];
    case 'quint':
      return [1, 4, 6, 4, 1];
    case 'sext':
      return [1, 5, 10, 10, 5, 1];
    case 'sept':
      return [1, 6, 15, 20, 15, 6, 1];
    case 'm':
      return [0.45, 0.9, 1.3, 1.0, 0.5];
  }
}

function getMultiplicityFromNeighborH(n: number): NmrMultiplicity {
  if (n <= 0) return 's';
  if (n === 1) return 'd';
  if (n === 2) return 't';
  if (n === 3) return 'q';
  if (n === 4) return 'quint';
  if (n === 5) return 'sext';
  if (n === 6) return 'sept';
  return 'm';
}

function getStandardValence(element: string): number {
  switch (element) {
    case 'H':
    case 'F':
    case 'Cl':
    case 'Br':
    case 'I':
      return 1;
    case 'O':
    case 'S':
      return 2;
    case 'N':
    case 'P':
    case 'B':
      return 3;
    case 'C':
    case 'Si':
      return 4;
    default:
      return 1;
  }
}

function findBondsForAtoms(bonds: MolecularBond[], atomIds: string[]): number[] {
  const set = new Set(atomIds);
  const indices: number[] = [];
  bonds.forEach((b, idx) => {
    if (set.has(b.from) || set.has(b.to)) {
      indices.push(idx);
    }
  });
  return indices;
}

/**
 * Generates a high-resolution Lorentzian 1H-NMR curve from 12.50 ppm to 0.00 ppm
 * (step 0.015 ppm) with Pascal's triangle multiplet splitting and stepped integral curve.
 */
function buildNmrCurve(peaks: NmrPeak[]): NmrSpectrumPoint[] {
  const step = 0.015;
  const rawPoints: Array<{ ppm: number; rawIntensity: number }> = [];

  for (let ppm = 12.5; ppm >= -0.001; ppm -= step) {
    const cleanPpm = Number(Math.max(ppm, 0).toFixed(3));
    let signal = 0.005; // clean flat baseline

    for (const p of peaks) {
      const weights = getPascalWeights(p.multiplicity);
      const totalWeight = weights.reduce((acc, w) => acc + w, 0);
      const isBroad = p.multiplicity === 'br s';
      // Visual splitting spacing (~0.055 ppm per line for crisp multiplet preview at 12.5 ppm span)
      const jSpacing = isBroad ? 0 : 0.055;
      const gamma = isBroad ? 0.14 : p.multiplicity === 'm' ? 0.032 : 0.024;
      const centerIdx = (weights.length - 1) / 2;

      weights.forEach((w, idx) => {
        const subPpm = p.shiftPpm + (idx - centerIdx) * jSpacing;
        const dx = cleanPpm - subPpm;
        // Scale area proportionally to protonCount, tempered slightly for broad exchangeable peaks
        const areaFactor = p.protonCount * (isBroad ? 0.85 : 1.0);
        const lineHeight = (w / totalWeight) * areaFactor;
        const lorentzian = 1 / (1 + Math.pow(dx / gamma, 2));
        signal += lineHeight * lorentzian;
      });
    }

    rawPoints.push({ ppm: cleanPpm, rawIntensity: signal });
  }

  const maxSignal = Math.max(...rawPoints.map((pt) => pt.rawIntensity), 0.1);
  // Calculate stepped integral (right-to-left or left-to-right cumulative sum; standard NMR integrates left->right 12.5->0)
  let runningIntegral = 0;
  const integralRaw: number[] = rawPoints.map((pt) => {
    const net = Math.max(0, pt.rawIntensity - 0.005);
    runningIntegral += net * step;
    return runningIntegral;
  });
  const totalIntegral = Math.max(runningIntegral, 0.0001);

  return rawPoints.map((pt, i) => ({
    ppm: pt.ppm,
    intensity: Math.min(Number((pt.rawIntensity / maxSignal).toFixed(4)), 1.0),
    integral: Number((integralRaw[i] / totalIntegral).toFixed(4)),
  }));
}

/**
 * Predicts 1H-NMR chemical shifts, multiplicities, and integrations for MoleculeData.
 */
export function predict1HNmrSpectrum(molecule: MoleculeData): NmrSpectrumAnalysis {
  const { atoms, bonds, id } = molecule;
  const atomsById = new Map<string, MolecularAtom>(atoms.map((a) => [a.id, a]));

  const neighbors = new Map<string, Array<{ atom: MolecularAtom; bond: MolecularBond; bondIndex: number }>>();
  const bondOrderSum = new Map<string, number>();

  for (const a of atoms) {
    neighbors.set(a.id, []);
    bondOrderSum.set(a.id, 0);
  }

  bonds.forEach((b, idx) => {
    const a1 = atomsById.get(b.from);
    const a2 = atomsById.get(b.to);
    if (!a1 || !a2) return;
    neighbors.get(b.from)?.push({ atom: a2, bond: b, bondIndex: idx });
    neighbors.get(b.to)?.push({ atom: a1, bond: b, bondIndex: idx });
    bondOrderSum.set(b.from, (bondOrderSum.get(b.from) || 0) + b.order);
    bondOrderSum.set(b.to, (bondOrderSum.get(b.to) || 0) + b.order);
  });

  // Check whether molecule contains any explicit H or H in its chemical formula
  const hasExplicitH = atoms.some((a) => a.element === 'H');
  const normalizedFormula = molecule.formula.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 8320));
  const formulaHasH = /H(?![a-z])/.test(normalizedFormula);

  let implicitOrExplicitProtons = 0;
  for (const a of atoms) {
    if (a.element === 'H') {
      implicitOrExplicitProtons++;
    } else if (!hasExplicitH && formulaHasH && ['C', 'N', 'O', 'S', 'P'].includes(a.element)) {
      const orderSum = bondOrderSum.get(a.id) || 0;
      const charge = a.formalCharge || 0;
      const imp = Math.max(0, getStandardValence(a.element) - orderSum - charge);
      implicitOrExplicitProtons += imp;
    }
  }

  if (implicitOrExplicitProtons === 0 || (!hasExplicitH && !formulaHasH)) {
    return {
      peaks: [],
      curve: buildNmrCurve([]),
      hasProtons: false,
      totalProtons: 0,
      solventNote: 'No ¹H nuclei present',
      summaryNote: `${molecule.name} (${molecule.formula}) contains zero hydrogen atoms, so it produces no ¹H-NMR signals. Alternative NMR-active nuclei (e.g. ¹³C, ¹⁹F, ³¹P, ¹⁷O) must be probed instead.`,
    };
  }

  const peaks: NmrPeak[] = [];
  const pushPeak = (p: Omit<NmrPeak, 'region'>) => {
    peaks.push({
      ...p,
      region: getRegionForPpm(p.shiftPpm),
    });
  };

  // --- Curated Textbook High-Accuracy 1H-NMR Assignments ---
  if (id === 'water') {
    pushPeak({
      id: 'h2o_oh',
      shiftPpm: 4.79,
      protonCount: 2,
      multiplicity: 's',
      groupLabel: 'H₂O',
      environment: 'Pure water / D₂O residual solvent peak',
      isExchangeable: true,
      matchingBondIndices: [0, 1],
      matchingAtomIds: ['O1', 'H1', 'H2'],
      description: 'Oxygen electronegativity and hydrogen bonding strongly deshield water protons to 4.79 ppm (1.56 ppm when trace dissolved in CDCl₃).',
    });
  } else if (id === 'methane') {
    pushPeak({
      id: 'ch4_h',
      shiftPpm: 0.23,
      protonCount: 4,
      multiplicity: 's',
      groupLabel: 'CH₄',
      environment: 'Four chemically equivalent tetrahedral protons',
      matchingBondIndices: [0, 1, 2, 3],
      matchingAtomIds: ['C1', 'H1', 'H2', 'H3', 'H4'],
      description: 'All four protons are homotopic by Td symmetry, yielding one sharp upfield singlet at 0.23 ppm near TMS (0.00 ppm).',
    });
  } else if (id === 'ammonia') {
    pushPeak({
      id: 'nh3_h',
      shiftPpm: 0.95,
      protonCount: 3,
      multiplicity: 'br s',
      groupLabel: 'NH₃',
      environment: 'Three equivalent exchangeable N–H protons',
      isExchangeable: true,
      matchingBondIndices: [0, 1, 2],
      matchingAtomIds: ['N1', 'H1', 'H2', 'H3'],
      description: 'Nitrogen quadrupolar relaxation (¹⁴N, I = 1) and rapid proton exchange broaden the NH₃ singlet near 0.95 ppm.',
    });
  } else if (id === 'ethanol') {
    pushPeak({
      id: 'etoh_ch2',
      shiftPpm: 3.72,
      protonCount: 2,
      multiplicity: 'q',
      jCouplingHz: 7.0,
      groupLabel: '–CH₂–O–',
      environment: 'Methylene protons coupled to 3 methyl protons (n+1 = 4)',
      matchingBondIndices: [1, 5, 6],
      matchingAtomIds: ['C2', 'H4', 'H5'],
      description: 'Electronegative oxygen pulls electron density away, shifting –CH₂– downfield to 3.72 ppm as a clean quartet (1:3:3:1).',
    });
    pushPeak({
      id: 'etoh_oh',
      shiftPpm: 2.6,
      protonCount: 1,
      multiplicity: 'br s',
      groupLabel: '–OH',
      environment: 'Exchangeable hydroxyl proton',
      isExchangeable: true,
      matchingBondIndices: [7],
      matchingAtomIds: ['O1', 'H6'],
      description: 'Rapid intermolecular proton exchange averages spin-spin coupling, producing a concentration-dependent broad singlet.',
    });
    pushPeak({
      id: 'etoh_ch3',
      shiftPpm: 1.24,
      protonCount: 3,
      multiplicity: 't',
      jCouplingHz: 7.0,
      groupLabel: '–CH₃',
      environment: 'Methyl protons coupled to 2 methylene protons (n+1 = 3)',
      matchingBondIndices: [2, 3, 4],
      matchingAtomIds: ['C1', 'H1', 'H2', 'H3'],
      description: 'Classic shielded aliphatic methyl triplet (1:2:1) at 1.24 ppm.',
    });
  } else if (id === 'benzene') {
    pushPeak({
      id: 'bz_arh',
      shiftPpm: 7.36,
      protonCount: 6,
      multiplicity: 's',
      groupLabel: 'Ar–H',
      environment: 'Six chemically equivalent aromatic protons',
      matchingBondIndices: [6, 7, 8, 9, 10, 11],
      matchingAtomIds: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
      description: 'Diamagnetic aromatic ring current generates an induced magnetic field reinforcing B₀ outside the ring, shifting all 6 protons downfield to 7.36 ppm.',
    });
  } else if (id === 'caffeine') {
    pushPeak({
      id: 'caf_c8',
      shiftPpm: 7.52,
      protonCount: 1,
      multiplicity: 's',
      groupLabel: 'C8–H',
      environment: 'Imidazole aromatic methine proton',
      matchingBondIndices: [15],
      matchingAtomIds: ['C8', 'H8'],
      description: 'Deshielded by adjacent sp² ring nitrogens N7 and N9 of the xanthine core.',
    });
    pushPeak({
      id: 'caf_n7me',
      shiftPpm: 3.99,
      protonCount: 3,
      multiplicity: 's',
      groupLabel: 'N7–CH₃',
      environment: 'Imidazole N-methyl group',
      matchingBondIndices: [14],
      matchingAtomIds: ['C12', 'N7'],
      description: 'Most downfield methyl singlet due to proximity to the electron-poor imidazole ring.',
    });
    pushPeak({
      id: 'caf_n3me',
      shiftPpm: 3.58,
      protonCount: 3,
      multiplicity: 's',
      groupLabel: 'N3–CH₃',
      environment: 'Pyrimidinedione N3-methyl group',
      matchingBondIndices: [13],
      matchingAtomIds: ['C11', 'N3'],
      description: 'Sharp 3H singlet flanked by C2=O and C4.',
    });
    pushPeak({
      id: 'caf_n1me',
      shiftPpm: 3.4,
      protonCount: 3,
      multiplicity: 's',
      groupLabel: 'N1–CH₃',
      environment: 'Pyrimidinedione N1-methyl group',
      matchingBondIndices: [12],
      matchingAtomIds: ['C10', 'N1'],
      description: 'Sharp 3H singlet between the two carbonyls C2=O and C6=O.',
    });
  } else if (id === 'aspirin') {
    pushPeak({
      id: 'asp_cooh',
      shiftPpm: 11.05,
      protonCount: 1,
      multiplicity: 'br s',
      groupLabel: '–COOH',
      environment: 'Carboxylic acid proton',
      isExchangeable: true,
      matchingBondIndices: [8],
      matchingAtomIds: ['O2', 'C7'],
      description: 'Strongly deshielded far downfield (11.05 ppm) by resonance withdrawal and dimeric hydrogen bonding.',
    });
    pushPeak({
      id: 'asp_h6',
      shiftPpm: 8.12,
      protonCount: 1,
      multiplicity: 'd',
      jCouplingHz: 7.8,
      groupLabel: 'Ar H-6',
      environment: 'Aromatic proton ortho to –COOH',
      matchingBondIndices: [4],
      matchingAtomIds: ['C5'],
      description: 'Strong anisotropic deshielding from the adjacent carboxylic carbonyl.',
    });
    pushPeak({
      id: 'asp_h4',
      shiftPpm: 7.62,
      protonCount: 1,
      multiplicity: 't',
      jCouplingHz: 7.6,
      groupLabel: 'Ar H-4',
      environment: 'Aromatic proton para to –COOH',
      matchingBondIndices: [2],
      matchingAtomIds: ['C3'],
      description: 'Split into an apparent triplet by two adjacent ortho ring protons.',
    });
    pushPeak({
      id: 'asp_h5',
      shiftPpm: 7.35,
      protonCount: 1,
      multiplicity: 't',
      jCouplingHz: 7.6,
      groupLabel: 'Ar H-5',
      environment: 'Aromatic proton meta to –COOH',
      matchingBondIndices: [3],
      matchingAtomIds: ['C4'],
      description: 'Apparent triplet split by H-4 and H-6.',
    });
    pushPeak({
      id: 'asp_h3',
      shiftPpm: 7.14,
      protonCount: 1,
      multiplicity: 'd',
      jCouplingHz: 8.0,
      groupLabel: 'Ar H-3',
      environment: 'Aromatic proton ortho to ester –OCOCH₃',
      matchingBondIndices: [1],
      matchingAtomIds: ['C2'],
      description: 'Slightly shielded upfield relative to H-6 by resonance donation from the ester oxygen.',
    });
    pushPeak({
      id: 'asp_oac',
      shiftPpm: 2.35,
      protonCount: 3,
      multiplicity: 's',
      groupLabel: '–OCOCH₃',
      environment: 'Acetate methyl singlet',
      matchingBondIndices: [12],
      matchingAtomIds: ['C9', 'C8'],
      description: 'Diagnostic sharp 3H methyl singlet of the acetyl group at 2.35 ppm.',
    });
  } else if (id === 'sulfuric_acid') {
    pushPeak({
      id: 'h2so4_oh',
      shiftPpm: 11.4,
      protonCount: 2,
      multiplicity: 'br s',
      groupLabel: '–SO₂(OH)₂',
      environment: 'Two strongly acidic sulfate protons',
      isExchangeable: true,
      matchingBondIndices: [4, 5],
      matchingAtomIds: ['H1', 'H2'],
      description: 'Extreme inductive withdrawal by S(=O)₂ shifts acidic protons far downfield above 11 ppm.',
    });
  } else if (id === 'hydrogen_cyanide') {
    pushPeak({
      id: 'hcn_h',
      shiftPpm: 2.86,
      protonCount: 1,
      multiplicity: 's',
      groupLabel: 'H–C≡N',
      environment: 'sp-Hybridized cyanomethine proton',
      matchingBondIndices: [0],
      matchingAtomIds: ['H1', 'C1'],
      description: 'Diamagnetic anisotropy of the C≡N triple bond shields along the bond axis while sp electronegativity pulls downfield to 2.86 ppm.',
    });
  } else if (id === 'acetic_acid') {
    pushPeak({
      id: 'acoh_oh',
      shiftPpm: 11.42,
      protonCount: 1,
      multiplicity: 'br s',
      groupLabel: '–COOH',
      environment: 'Carboxylic acid hydroxyl proton',
      isExchangeable: true,
      matchingBondIndices: [3],
      matchingAtomIds: ['H1', 'O2'],
      description: 'Classic carboxylic acid resonance/H-bonded singlet above 11 ppm.',
    });
    pushPeak({
      id: 'acoh_ch3',
      shiftPpm: 2.1,
      protonCount: 3,
      multiplicity: 's',
      groupLabel: '–CH₃',
      environment: 'α-Methyl adjacent to carbonyl',
      matchingBondIndices: [4, 5, 6],
      matchingAtomIds: ['C1', 'H2', 'H3', 'H4'],
      description: 'Deshielded by ~1.2 ppm relative to alkanes due to the adjacent C=O carbonyl group.',
    });
  } else if (id === 'acetone') {
    pushPeak({
      id: 'acet_ch3',
      shiftPpm: 2.17,
      protonCount: 6,
      multiplicity: 's',
      groupLabel: '–CH₃ (×2)',
      environment: 'Six equivalent α-carbonyl methyl protons',
      matchingBondIndices: [3, 4, 5, 6, 7, 8],
      matchingAtomIds: ['C2', 'C3'],
      description: 'C₂ᵥ symmetry renders both methyl groups chemical-shift equivalent, yielding a single intense 6H singlet at 2.17 ppm.',
    });
  } else if (id === 'paracetamol') {
    pushPeak({
      id: 'para_nh',
      shiftPpm: 9.66,
      protonCount: 1,
      multiplicity: 'br s',
      groupLabel: '–NHCO–',
      environment: 'Secondary amide proton (DMSO-d₆)',
      isExchangeable: true,
      matchingBondIndices: [7, 8],
      matchingAtomIds: ['N1'],
      description: 'Resonance-deshielded secondary amide N–H singlet at 9.66 ppm.',
    });
    pushPeak({
      id: 'para_oh',
      shiftPpm: 9.15,
      protonCount: 1,
      multiplicity: 'br s',
      groupLabel: 'Ar–OH',
      environment: 'Phenolic hydroxyl proton (DMSO-d₆)',
      isExchangeable: true,
      matchingBondIndices: [6],
      matchingAtomIds: ['O1'],
      description: 'Hydrogen-bonded phenolic O–H broad singlet at 9.15 ppm.',
    });
    pushPeak({
      id: 'para_ar1',
      shiftPpm: 7.34,
      protonCount: 2,
      multiplicity: 'd',
      jCouplingHz: 8.8,
      groupLabel: 'Ar–H (2,6)',
      environment: 'Two symmetric aromatic protons ortho to amide',
      matchingBondIndices: [2, 3],
      matchingAtomIds: ['C3', 'C5'],
      description: 'Para-disubstituted benzene AA′BB′ doublet pattern (2H) ortho to the acetamide nitrogen.',
    });
    pushPeak({
      id: 'para_ar2',
      shiftPpm: 6.68,
      protonCount: 2,
      multiplicity: 'd',
      jCouplingHz: 8.8,
      groupLabel: 'Ar–H (3,5)',
      environment: 'Two symmetric aromatic protons ortho to –OH',
      matchingBondIndices: [0, 5],
      matchingAtomIds: ['C2', 'C6'],
      description: 'Shielded upfield to 6.68 ppm by ortho π-electron donation from the phenolic –OH.',
    });
    pushPeak({
      id: 'para_me',
      shiftPpm: 1.98,
      protonCount: 3,
      multiplicity: 's',
      groupLabel: '–COCH₃',
      environment: 'Acetamide methyl singlet',
      matchingBondIndices: [10],
      matchingAtomIds: ['C8'],
      description: 'Sharp 3H methyl singlet at 1.98 ppm.',
    });
  } else if (id === 'alanine') {
    pushPeak({
      id: 'ala_nh',
      shiftPpm: 8.1,
      protonCount: 3,
      multiplicity: 'br s',
      groupLabel: '–NH₃⁺ / OH',
      environment: 'Zwitterionic exchangeable protons',
      isExchangeable: true,
      matchingBondIndices: [3],
      matchingAtomIds: ['N1', 'O2'],
      description: 'Broad exchangeable signal from zwitterionic ammonium/carboxyl protons.',
    });
    pushPeak({
      id: 'ala_ch',
      shiftPpm: 3.78,
      protonCount: 1,
      multiplicity: 'q',
      jCouplingHz: 7.2,
      groupLabel: 'α–CH',
      environment: 'Chiral α-methine proton coupled to β-CH₃',
      matchingBondIndices: [0, 3],
      matchingAtomIds: ['C1'],
      description: 'Deshielded by both –NH₂ and –COOH groups to 3.78 ppm; split into a 1:3:3:1 quartet by the adjacent methyl group.',
    });
    pushPeak({
      id: 'ala_ch3',
      shiftPpm: 1.47,
      protonCount: 3,
      multiplicity: 'd',
      jCouplingHz: 7.2,
      groupLabel: 'β–CH₃',
      environment: 'Alanine methyl side chain coupled to α-CH',
      matchingBondIndices: [4],
      matchingAtomIds: ['C3'],
      description: 'Sharp 3H doublet at 1.47 ppm (n+1 = 2 from the single α-proton).',
    });
  } else {
    // --- General Graph-Based 1H-NMR Chemical Shift & Coupling Predictor (PubChem & remaining curated) ---
    const hasExplicitH = atoms.some((a) => a.element === 'H');
    const aromaticAtomIds = new Set<string>();

    bonds.forEach((b) => {
      if (b.type === 'aromatic') {
        aromaticAtomIds.add(b.from);
        aromaticAtomIds.add(b.to);
      }
    });
    if (molecule.canonicalSmiles && /[cnos]/.test(molecule.canonicalSmiles)) {
      bonds.forEach((b) => {
        const a1 = atomsById.get(b.from);
        const a2 = atomsById.get(b.to);
        if (a1 && a2 && a1.element === 'C' && a2.element === 'C' && b.order === 2) {
          aromaticAtomIds.add(a1.id);
          aromaticAtomIds.add(a2.id);
        }
      });
    }

    const protonCountOnAtom = new Map<string, number>();
    const carbonProtonCountOnAtom = new Map<string, number>();

    for (const a of atoms) {
      if (a.element === 'H') continue;
      const nbrs = neighbors.get(a.id) || [];
      const explicitHs = nbrs.filter((n) => n.atom.element === 'H').length;
      const orderSum = bondOrderSum.get(a.id) || 0;
      const impH = hasExplicitH ? 0 : Math.max(0, getStandardValence(a.element) - orderSum - (a.formalCharge || 0));
      const totalH = explicitHs + impH;
      protonCountOnAtom.set(a.id, totalH);
      if (a.element === 'C') {
        carbonProtonCountOnAtom.set(a.id, totalH);
      }
    }

    interface RawEnv {
      signature: string;
      shiftPpm: number;
      protonCount: number;
      multiplicity: NmrMultiplicity;
      groupLabel: string;
      environment: string;
      isExchangeable: boolean;
      atomIds: string[];
      description: string;
    }

    const grouped = new Map<string, RawEnv>();

    for (const a of atoms) {
      const hCount = protonCountOnAtom.get(a.id) || 0;
      if (hCount <= 0) continue;

      const nbrs = neighbors.get(a.id) || [];
      const heavyNbrs = nbrs.filter((n) => n.atom.element !== 'H');

      let shift = 1.2;
      let mult: NmrMultiplicity = 's';
      let label = `${a.element}–H`;
      let env = '';
      let exchangeable = false;
      let desc = '';

      if (a.element === 'O') {
        exchangeable = true;
        mult = 'br s';
        const anchor = heavyNbrs[0]?.atom;
        const anchorNbrs = anchor ? neighbors.get(anchor.id) || [] : [];
        const isCarboxylic = anchor?.element === 'C' && anchorNbrs.some((an) => an.atom.element === 'O' && an.bond.order === 2);
        const isPhenolic = anchor && aromaticAtomIds.has(anchor.id);

        if (isCarboxylic) {
          shift = 11.2;
          label = '–COOH';
          env = 'Carboxylic acid proton';
          desc = 'Strongly deshielded carboxylic –OH proton appearing far downfield (10.5–12.5 ppm).';
        } else if (isPhenolic) {
          shift = 9.05;
          label = 'Ar–OH';
          env = 'Phenolic hydroxyl proton';
          desc = 'Deshielded by conjugation with the aromatic ring to ~9.0 ppm.';
        } else {
          shift = 3.85;
          label = '–OH';
          env = 'Alcohol / hydroxyl proton';
          desc = 'Exchangeable hydroxyl proton appearing as a broad singlet (2.0–5.0 ppm depending on concentration).';
        }
      } else if (a.element === 'N') {
        exchangeable = true;
        mult = 'br s';
        const isAmide = heavyNbrs.some((hn) => {
          if (hn.atom.element !== 'C') return false;
          const cNbrs = neighbors.get(hn.atom.id) || [];
          return cNbrs.some((cn) => cn.atom.element === 'O' && cn.bond.order === 2);
        });
        const isIndoleOrAromatic = aromaticAtomIds.has(a.id);

        if (isIndoleOrAromatic) {
          shift = 10.6;
          label = 'Ar–NH';
          env = 'Heteroaromatic N–H proton';
          desc = 'Heteroaromatic indole/purine N–H strongly deshielded by ring current (~10.6 ppm).';
        } else if (isAmide) {
          shift = 8.15;
          label = '–CONH–';
          env = 'Amide N–H proton';
          desc = 'Resonance-deshielded amide N–H broad singlet.';
        } else {
          shift = 2.15;
          label = hCount === 2 ? '–NH₂' : '–NH–';
          env = 'Aliphatic amine proton(s)';
          desc = 'Exchangeable aliphatic amine N–H signal broadened by ¹⁴N quadrupolar coupling.';
        }
      } else if (a.element === 'C') {
        const hasDoubleO = heavyNbrs.some((hn) => hn.atom.element === 'O' && hn.bond.order === 2);
        const hasTriple = heavyNbrs.some((hn) => hn.bond.order === 3);
        const hasDoubleC = heavyNbrs.some((hn) => hn.atom.element === 'C' && hn.bond.order === 2);
        const isAromatic = aromaticAtomIds.has(a.id);

        // Sum coupling protons on adjacent heavy carbons
        let couplingNeighborsH = 0;
        for (const hn of heavyNbrs) {
          if (hn.atom.element === 'C') {
            couplingNeighborsH += carbonProtonCountOnAtom.get(hn.atom.id) || 0;
          }
        }
        mult = getMultiplicityFromNeighborH(couplingNeighborsH);

        if (hasDoubleO) {
          shift = 9.75;
          label = '–CHO';
          env = 'Aldehyde formyl proton';
          desc = 'Intense anisotropic and inductive deshielding of the carbonyl places aldehyde protons near 9.5–10.0 ppm.';
        } else if (isAromatic) {
          let arShift = 7.25;
          if (heavyNbrs.some((hn) => hn.atom.element === 'N' || hn.atom.element === 'O')) {
            arShift -= 0.35;
          }
          // Check ortho substituents for slight differentiation
          const orthoElems = heavyNbrs.map((hn) => {
            const sub = neighbors.get(hn.atom.id) || [];
            return sub.find((s) => !aromaticAtomIds.has(s.atom.id) && s.atom.element !== 'H')?.atom.element || '';
          });
          if (orthoElems.includes('O')) arShift -= 0.25;
          if (orthoElems.includes('N')) arShift -= 0.15;
          shift = Number(arShift.toFixed(2));
          label = 'Ar–H';
          env = 'Aromatic ring methine proton';
          desc = 'Ring-current deshielded aromatic C–H proton in the 6.5–8.2 ppm window.';
        } else if (hasTriple) {
          shift = 2.35;
          label = '≡C–H';
          env = 'Terminal alkyne proton';
          desc = 'Shielded by cylindrical π-cloud anisotropy relative to alkenes (~2.0–2.9 ppm).';
        } else if (hasDoubleC) {
          let alkShift = 5.45;
          if (heavyNbrs.some((hn) => hn.atom.element === 'O')) alkShift += 0.9;
          shift = Number(alkShift.toFixed(2));
          label = '=C–H';
          env = 'Vinylic / alkene proton';
          desc = 'sp² C–H vinylic proton deshielded to 4.8–6.5 ppm.';
        } else {
          // sp3 C-H additive Shoolery-style estimation
          let base = hCount === 3 ? 0.92 : hCount === 2 ? 1.32 : 1.58;
          for (const hn of heavyNbrs) {
            if (hn.atom.element === 'O') base += 2.35;
            else if (hn.atom.element === 'Cl' || hn.atom.element === 'Br' || hn.atom.element === 'F') base += 2.15;
            else if (hn.atom.element === 'N') base += 1.42;
            else if (hn.atom.element === 'S') base += 1.15;
            else if (hn.atom.element === 'C') {
              const cNbrs = neighbors.get(hn.atom.id) || [];
              if (cNbrs.some((cn) => cn.atom.element === 'O' && cn.bond.order === 2)) base += 1.05;
              else if (aromaticAtomIds.has(hn.atom.id)) base += 1.25;
              else if (cNbrs.some((cn) => cn.bond.order >= 2)) base += 0.72;
            }
          }
          shift = Number(Math.min(base, 5.8).toFixed(2));
          label = hCount === 3 ? '–CH₃' : hCount === 2 ? '–CH₂–' : '–CH–';
          const alphaList = heavyNbrs
            .map((hn) => hn.atom.element)
            .filter((el) => el !== 'C')
            .join('/');
          env = alphaList ? `α to ${alphaList} (${hCount}H)` : `Aliphatic ${label.replace(/–/g, '')}`;
          desc = `${label} signal split into a ${mult === 's' ? 'singlet' : mult === 'd' ? 'doublet' : mult === 't' ? 'triplet' : mult === 'q' ? 'quartet' : 'multiplet'} by ${couplingNeighborsH} neighboring carbon-bound proton(s).`;
        }
      }

      const sig = `${label}_${shift.toFixed(1)}_${mult}`;
      const existing = grouped.get(sig);
      if (existing) {
        existing.protonCount += hCount;
        existing.atomIds.push(a.id);
      } else {
        grouped.set(sig, {
          signature: sig,
          shiftPpm: shift,
          protonCount: hCount,
          multiplicity: mult,
          groupLabel: label,
          environment: env,
          isExchangeable: exchangeable,
          atomIds: [a.id],
          description: desc,
        });
      }
    }

    let idxCounter = 0;
    grouped.forEach((g) => {
      idxCounter++;
      const explicitChildHs: string[] = [];
      g.atomIds.forEach((aid) => {
        (neighbors.get(aid) || []).forEach((n) => {
          if (n.atom.element === 'H') explicitChildHs.push(n.atom.id);
        });
      });
      const targetAtoms = [...g.atomIds, ...explicitChildHs];
      pushPeak({
        id: `nmr_${idxCounter}_${g.signature}`,
        shiftPpm: g.shiftPpm,
        protonCount: g.protonCount,
        multiplicity: g.multiplicity,
        jCouplingHz: g.multiplicity === 's' || g.multiplicity === 'br s' ? undefined : 7.0,
        groupLabel: g.groupLabel,
        environment: g.environment,
        isExchangeable: g.isExchangeable,
        matchingBondIndices: findBondsForAtoms(bonds, g.atomIds),
        matchingAtomIds: targetAtoms,
        description: g.description,
      });
    });
  }

  const sortedPeaks = peaks.sort((a, b) => b.shiftPpm - a.shiftPpm);
  const totalProtons = sortedPeaks.reduce((sum, p) => sum + p.protonCount, 0);
  const peakSummary = sortedPeaks
    .slice(0, 3)
    .map((p) => `${p.shiftPpm.toFixed(2)} ppm (${p.multiplicity}, ${p.protonCount}H)`)
    .join(', ');

  return {
    peaks: sortedPeaks,
    curve: buildNmrCurve(sortedPeaks),
    hasProtons: sortedPeaks.length > 0,
    totalProtons,
    solventNote: id === 'paracetamol' || id === 'dopamine' ? 'DMSO-d₆ (400 MHz)' : 'CDCl₃ / D₂O Ref. (400 MHz)',
    summaryNote: `Predicted ${sortedPeaks.length} distinct ¹H environments (${totalProtons}H total): ${peakSummary}.`,
  };
}
