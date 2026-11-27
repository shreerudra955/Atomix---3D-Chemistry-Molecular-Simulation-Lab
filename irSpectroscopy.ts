import { MoleculeData, MolecularAtom, MolecularBond } from '../types/chemistry';

export type IrIntensity = 'Very Strong' | 'Strong' | 'Medium' | 'Weak';
export type IrBandShape = 'Sharp' | 'Medium' | 'Broad' | 'Very Broad';
export type IrRegionId = 'xh_stretch' | 'triple_bond' | 'double_bond' | 'fingerprint';

export interface IrPeak {
  id: string;
  wavenumberCm1: number; // Center frequency in cm⁻¹ (400 - 4000)
  rangeCm1: [number, number]; // Typical diagnostic range
  absorbance: number; // Peak height (0.05 to 1.0 AU)
  fwhmCm1: number; // Full width at half maximum (controls Gaussian/Lorentzian width)
  bondLabel: string; // e.g., "O–H", "C=O", "C–H (sp³)"
  mode: string; // e.g., "Asymmetric Stretch", "Carbonyl Stretch", "Scissoring Bend"
  functionalGroup: string; // e.g., "Carboxylic Acid", "Alcohol / Hydroxyl", "Aromatic Ring"
  intensity: IrIntensity;
  shape: IrBandShape;
  region: IrRegionId;
  matchingBondIndices: number[]; // Indices in molecule.bonds to highlight in 3D
  description: string;
}

export interface IrSpectrumPoint {
  wavenumber: number; // 4000 down to 400
  absorbance: number; // 0.0 to 1.0
  transmittance: number; // 100 down to ~10% (T = 10^(-A) * 100)
}

export interface IrSpectrumAnalysis {
  peaks: IrPeak[];
  curve: IrSpectrumPoint[];
  isIrActive: boolean;
  summaryNote: string;
}

export const IR_REGIONS: Array<{
  id: IrRegionId;
  label: string;
  minCm1: number;
  maxCm1: number;
  color: string;
}> = [
  { id: 'xh_stretch', label: 'X–H Stretch (O–H, N–H, C–H)', minCm1: 2500, maxCm1: 4000, color: '#38bdf8' },
  { id: 'triple_bond', label: 'Triple Bonds (C≡C, C≡N)', minCm1: 2000, maxCm1: 2500, color: '#a78bfa' },
  { id: 'double_bond', label: 'Double Bonds (C=O, C=C, C=N)', minCm1: 1500, maxCm1: 2000, color: '#f59e0b' },
  { id: 'fingerprint', label: 'Fingerprint & Bending', minCm1: 400, maxCm1: 1500, color: '#10b981' },
];

function getRegionForWavenumber(wn: number): IrRegionId {
  if (wn >= 2500) return 'xh_stretch';
  if (wn >= 2000) return 'triple_bond';
  if (wn >= 1500) return 'double_bond';
  return 'fingerprint';
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

function findBondIndices(
  bonds: MolecularBond[],
  atomsById: Map<string, MolecularAtom>,
  predicate: (a1: MolecularAtom, a2: MolecularAtom, bond: MolecularBond) => boolean
): number[] {
  const indices: number[] = [];
  bonds.forEach((b, idx) => {
    const a1 = atomsById.get(b.from);
    const a2 = atomsById.get(b.to);
    if (a1 && a2 && predicate(a1, a2, b)) {
      indices.push(idx);
    }
  });
  return indices;
}

/**
 * Generates an accurate Lorentzian-Gaussian (pseudo-Voigt) IR spectrum curve
 * from 4000 cm⁻¹ to 400 cm⁻¹ at 5 cm⁻¹ resolution.
 */
function buildIrCurve(peaks: IrPeak[], temperatureK = 298): IrSpectrumPoint[] {
  const points: IrSpectrumPoint[] = [];
  // Slight thermal broadening at higher temperatures
  const thermalBroadening = 1 + Math.max(0, (temperatureK - 298) / 1500);

  for (let wn = 4000; wn >= 400; wn -= 5) {
    let totalAbs = 0.015; // subtle baseline instrument floor

    for (const p of peaks) {
      const gamma = (p.fwhmCm1 * thermalBroadening) / 2;
      const dx = wn - p.wavenumberCm1;
      // 65% Lorentzian + 35% Gaussian lineshape (realistic condensed-phase FTIR band)
      const lorentzian = 1 / (1 + Math.pow(dx / gamma, 2));
      const gaussian = Math.exp(-Math.LN2 * Math.pow(dx / gamma, 2));
      const profile = 0.65 * lorentzian + 0.35 * gaussian;
      totalAbs += p.absorbance * profile;
    }

    const clampedAbs = Math.min(Number(totalAbs.toFixed(4)), 1.0);
    // T(%) = 100 * 10^(-A)
    const transmittance = Number((100 * Math.pow(10, -clampedAbs)).toFixed(2));
    points.push({
      wavenumber: wn,
      absorbance: clampedAbs,
      transmittance,
    });
  }

  return points;
}

/**
 * Predicts IR absorbance peaks for any curated or PubChem-fetched MoleculeData.
 */
export function predictIrSpectrum(molecule: MoleculeData, temperatureK = 298): IrSpectrumAnalysis {
  const { atoms, bonds, id } = molecule;
  const atomsById = new Map<string, MolecularAtom>(atoms.map((a) => [a.id, a]));

  // Adjacency & bond-order sum per atom (for implicit hydrogen and functional group detection)
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

  const peaks: IrPeak[] = [];
  const addedKeys = new Set<string>();

  const pushPeak = (peak: Omit<IrPeak, 'region'>) => {
    const bucket = Math.round(peak.wavenumberCm1 / 15);
    const dedupeKey = `${peak.bondLabel}_${bucket}`;
    if (addedKeys.has(dedupeKey)) return;
    addedKeys.add(dedupeKey);
    peaks.push({
      ...peak,
      region: getRegionForWavenumber(peak.wavenumberCm1),
    });
  };

  // --- Curated high-precision spectroscopic assignments for textbook molecules ---
  if (id === 'water') {
    const ohBonds = findBondIndices(bonds, atomsById, (a, b) => (a.element === 'O' && b.element === 'H') || (a.element === 'H' && b.element === 'O'));
    pushPeak({
      id: 'h2o_oh_stretch',
      wavenumberCm1: 3405,
      rangeCm1: [3200, 3600],
      absorbance: 0.94,
      fwhmCm1: 280,
      bondLabel: 'O–H',
      mode: 'Symmetric & Antisymmetric Stretch (H-bonded)',
      functionalGroup: 'Hydroxyl / Liquid Water',
      intensity: 'Very Strong',
      shape: 'Very Broad',
      matchingBondIndices: ohBonds,
      description: 'Extensive intermolecular hydrogen-bonding network broadens the coupled O–H stretching modes into a massive envelope centered near 3405 cm⁻¹.',
    });
    pushPeak({
      id: 'h2o_bend',
      wavenumberCm1: 1645,
      rangeCm1: [1595, 1655],
      absorbance: 0.62,
      fwhmCm1: 75,
      bondLabel: 'H–O–H',
      mode: 'Scissoring Bend (δ)',
      functionalGroup: 'Bent Water Core',
      intensity: 'Strong',
      shape: 'Medium',
      matchingBondIndices: ohBonds,
      description: 'In-plane H–O–H bending vibration cleanly isolated at 1645 cm⁻¹.',
    });
    pushPeak({
      id: 'h2o_libration',
      wavenumberCm1: 685,
      rangeCm1: [500, 850],
      absorbance: 0.52,
      fwhmCm1: 220,
      bondLabel: 'H₂O···H₂O',
      mode: 'Hindered Rotation (Libration)',
      functionalGroup: 'Hydrogen-Bond Lattice',
      intensity: 'Medium',
      shape: 'Very Broad',
      matchingBondIndices: ohBonds,
      description: 'Restricted rotational motion of water molecules constrained within the hydrogen-bonded liquid lattice.',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Strong permanent dipole (1.85 D) and extensive hydrogen bonding yield intense, broad O–H stretching and H–O–H bending bands.',
    };
  }

  if (id === 'carbon_dioxide') {
    const coBonds = findBondIndices(bonds, atomsById, (a, b) => (a.element === 'C' && b.element === 'O') || (a.element === 'O' && b.element === 'C'));
    pushPeak({
      id: 'co2_asym_stretch',
      wavenumberCm1: 2349,
      rangeCm1: [2320, 2380],
      absorbance: 0.96,
      fwhmCm1: 36,
      bondLabel: 'O=C=O',
      mode: 'Antisymmetric Stretch (ν₃)',
      functionalGroup: 'Linear Carbonyl / Greenhouse Band',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: coBonds,
      description: 'One C=O bond compresses while the other stretches, breaking symmetry and creating an oscillating dipole at 2349 cm⁻¹ (classic atmospheric CO₂ band).',
    });
    pushPeak({
      id: 'co2_bend',
      wavenumberCm1: 667,
      rangeCm1: [650, 685],
      absorbance: 0.78,
      fwhmCm1: 28,
      bondLabel: 'O=C=O',
      mode: 'Degenerate Bending (ν₂)',
      functionalGroup: 'Planetary Infrared Absorption',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: coBonds,
      description: 'Doubly degenerate bending mode that traps outgoing Earth thermal infrared radiation at 15 μm (667 cm⁻¹).',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Although CO₂ has 0 D net dipole at equilibrium, its antisymmetric stretch (2349 cm⁻¹) and bend (667 cm⁻¹) induce transient dipoles and absorb strongly.',
    };
  }

  if (id === 'methane') {
    const chBonds = findBondIndices(bonds, atomsById, (a, b) => (a.element === 'C' && b.element === 'H') || (a.element === 'H' && b.element === 'C'));
    pushPeak({
      id: 'ch4_stretch',
      wavenumberCm1: 3019,
      rangeCm1: [2980, 3040],
      absorbance: 0.82,
      fwhmCm1: 42,
      bondLabel: 'C–H',
      mode: 'Triply Degenerate Antisymmetric Stretch (ν₃)',
      functionalGroup: 'Tetrahedral Alkane',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: chBonds,
      description: 'Only the antisymmetric triply degenerate C–H stretch (ν₃) changes the molecular dipole; the totally symmetric stretch (2917 cm⁻¹) is IR-forbidden.',
    });
    pushPeak({
      id: 'ch4_bend',
      wavenumberCm1: 1306,
      rangeCm1: [1290, 1320],
      absorbance: 0.68,
      fwhmCm1: 38,
      bondLabel: 'H–C–H',
      mode: 'Triply Degenerate Deformation Bend (ν₄)',
      functionalGroup: 'Tetrahedral Alkane',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: chBonds,
      description: 'Infrared-active H–C–H bending band contributing to methane’s potent greenhouse absorption.',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Td symmetry renders the totally symmetric C–H stretch IR-inactive; only triply degenerate T₂ modes (3019 and 1306 cm⁻¹) appear in the IR spectrum.',
    };
  }

  if (id === 'ammonia') {
    const nhBonds = findBondIndices(bonds, atomsById, (a, b) => (a.element === 'N' && b.element === 'H') || (a.element === 'H' && b.element === 'N'));
    pushPeak({
      id: 'nh3_asym',
      wavenumberCm1: 3444,
      rangeCm1: [3400, 3480],
      absorbance: 0.62,
      fwhmCm1: 48,
      bondLabel: 'N–H',
      mode: 'Antisymmetric Stretch (ν₃)',
      functionalGroup: 'Azane / Amine',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: nhBonds,
      description: 'Antisymmetric N–H stretching mode of trigonal pyramidal ammonia.',
    });
    pushPeak({
      id: 'nh3_sym',
      wavenumberCm1: 3337,
      rangeCm1: [3300, 3360],
      absorbance: 0.56,
      fwhmCm1: 45,
      bondLabel: 'N–H',
      mode: 'Symmetric Stretch (ν₁)',
      functionalGroup: 'Azane / Amine',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: nhBonds,
      description: 'In-phase breathing stretch of the three N–H bonds.',
    });
    pushPeak({
      id: 'nh3_deg_bend',
      wavenumberCm1: 1627,
      rangeCm1: [1600, 1650],
      absorbance: 0.54,
      fwhmCm1: 44,
      bondLabel: 'H–N–H',
      mode: 'Degenerate Deformation Bend (ν₄)',
      functionalGroup: 'Azane / Amine',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: nhBonds,
      description: 'Asymmetric H–N–H scissoring deformation.',
    });
    pushPeak({
      id: 'nh3_umbrella',
      wavenumberCm1: 950,
      rangeCm1: [920, 980],
      absorbance: 0.92,
      fwhmCm1: 52,
      bondLabel: 'NH₃',
      mode: 'Symmetric Umbrella Inversion (ν₂)',
      functionalGroup: 'Trigonal Pyramidal Nitrogen',
      intensity: 'Very Strong',
      shape: 'Medium',
      matchingBondIndices: nhBonds,
      description: 'Signature intense umbrella inversion doublet near 932 / 968 cm⁻¹ as nitrogen tunnels through the H₃ plane.',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Features classic N–H stretch doublet (3444 & 3337 cm⁻¹) and a powerful umbrella inversion band at ~950 cm⁻¹.',
    };
  }

  if (id === 'sulfur_hexafluoride') {
    const sfBonds = findBondIndices(bonds, atomsById, (a, b) => a.element === 'S' || b.element === 'S');
    pushPeak({
      id: 'sf6_stretch',
      wavenumberCm1: 948,
      rangeCm1: [930, 965],
      absorbance: 0.98,
      fwhmCm1: 28,
      bondLabel: 'S–F',
      mode: 'Triply Degenerate Asymmetric Stretch (ν₃)',
      functionalGroup: 'Hypervalent Octahedral Fluoride',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: sfBonds,
      description: 'Extraordinarily intense S–F asymmetric stretch making SF₆ one of the strongest known infrared absorbers.',
    });
    pushPeak({
      id: 'sf6_bend',
      wavenumberCm1: 615,
      rangeCm1: [600, 630],
      absorbance: 0.65,
      fwhmCm1: 26,
      bondLabel: 'F–S–F',
      mode: 'Triply Degenerate Bend (ν₄)',
      functionalGroup: 'Hypervalent Octahedral Fluoride',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: sfBonds,
      description: 'Octahedral F–S–F bending deformation.',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Octahedral Oₕ symmetry permits only T₁ᵤ modes (948 and 615 cm⁻¹), with the 948 cm⁻¹ S–F stretch displaying immense transition dipole strength.',
    };
  }

  if (id === 'boron_trifluoride') {
    const bfBonds = findBondIndices(bonds, atomsById, (a, b) => a.element === 'B' || b.element === 'B');
    pushPeak({
      id: 'bf3_asym',
      wavenumberCm1: 1454,
      rangeCm1: [1430, 1480],
      absorbance: 0.94,
      fwhmCm1: 35,
      bondLabel: 'B–F',
      mode: 'Degenerate Asymmetric Stretch (ν₃)',
      functionalGroup: 'Trigonal Planar Lewis Acid',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: bfBonds,
      description: 'Strong polar B–F asymmetric stretching vibration.',
    });
    pushPeak({
      id: 'bf3_oop',
      wavenumberCm1: 691,
      rangeCm1: [675, 710],
      absorbance: 0.72,
      fwhmCm1: 30,
      bondLabel: 'BF₃',
      mode: 'Out-of-Plane Pyramidalization Bend (ν₂)',
      functionalGroup: 'Trigonal Planar Core',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: bfBonds,
      description: 'Boron oscillates perpendicular to the F₃ plane, producing a strong dipole perpendicular to the molecular plane.',
    });
    pushPeak({
      id: 'bf3_ip_bend',
      wavenumberCm1: 480,
      rangeCm1: [465, 495],
      absorbance: 0.45,
      fwhmCm1: 28,
      bondLabel: 'F–B–F',
      mode: 'In-Plane Degenerate Bend (ν₄)',
      functionalGroup: 'Trigonal Planar Core',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: bfBonds,
      description: 'In-plane scissoring vibration of the B–F bonds.',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'D₃ₕ symmetry restricts IR activity to E′ in-plane modes (1454, 480 cm⁻¹) and the A₂″ out-of-plane umbrella bend (691 cm⁻¹).',
    };
  }

  if (id === 'phosphorus_pentachloride') {
    const pclBonds = findBondIndices(bonds, atomsById, (a, b) => a.element === 'P' || b.element === 'P');
    pushPeak({
      id: 'pcl5_eq_stretch',
      wavenumberCm1: 580,
      rangeCm1: [560, 600],
      absorbance: 0.88,
      fwhmCm1: 32,
      bondLabel: 'P–Cl (eq)',
      mode: 'Equatorial Asymmetric Stretch',
      functionalGroup: 'Trigonal Bipyramidal Halide',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: pclBonds,
      description: 'Stronger, shorter equatorial P–Cl bonds vibrate at higher wavenumber (580 cm⁻¹) than axial bonds.',
    });
    pushPeak({
      id: 'pcl5_ax_stretch',
      wavenumberCm1: 448,
      rangeCm1: [430, 465],
      absorbance: 0.74,
      fwhmCm1: 30,
      bondLabel: 'P–Cl (ax)',
      mode: 'Axial Asymmetric Stretch',
      functionalGroup: 'Trigonal Bipyramidal Halide',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: pclBonds,
      description: 'Longer, weaker axial P–Cl bonds absorb at noticeably lower wavenumber (~448 cm⁻¹).',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Heavy chlorine atoms shift all P–Cl stretching modes into the far/low-wavenumber fingerprint region (< 600 cm⁻¹), clearly resolving equatorial vs. axial bond strengths.',
    };
  }

  if (id === 'ozone') {
    const ooBonds = findBondIndices(bonds, atomsById, () => true);
    pushPeak({
      id: 'o3_asym',
      wavenumberCm1: 1042,
      rangeCm1: [1025, 1060],
      absorbance: 0.92,
      fwhmCm1: 30,
      bondLabel: 'O–O (1.5)',
      mode: 'Antisymmetric Stretch (ν₃)',
      functionalGroup: 'Trioxygen Resonance Core',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: ooBonds,
      description: 'Classic atmospheric ozone IR band at 9.6 μm (1042 cm⁻¹), used in satellite remote sensing of the ozone layer.',
    });
    pushPeak({
      id: 'o3_sym',
      wavenumberCm1: 1103,
      rangeCm1: [1090, 1120],
      absorbance: 0.34,
      fwhmCm1: 28,
      bondLabel: 'O–O (1.5)',
      mode: 'Symmetric Stretch (ν₁)',
      functionalGroup: 'Trioxygen Resonance Core',
      intensity: 'Weak',
      shape: 'Sharp',
      matchingBondIndices: ooBonds,
      description: 'Weak symmetric stretching band of the bent C₂ᵥ trioxygen geometry.',
    });
    pushPeak({
      id: 'o3_bend',
      wavenumberCm1: 701,
      rangeCm1: [685, 720],
      absorbance: 0.48,
      fwhmCm1: 26,
      bondLabel: 'O–O–O',
      mode: 'Bending Mode (ν₂)',
      functionalGroup: 'Bent Trioxygen Core',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: ooBonds,
      description: 'In-plane O–O–O angle bending vibration at 701 cm⁻¹.',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Bent C₂ᵥ symmetry and 1.5 bond order resonance create the famous 1042 cm⁻¹ (9.6 μm) stratospheric remote-sensing band.',
    };
  }

  if (id === 'nacl_lattice') {
    const ionicBonds = findBondIndices(bonds, atomsById, () => true);
    pushPeak({
      id: 'nacl_phonon',
      wavenumberCm1: 405,
      rangeCm1: [164, 420],
      absorbance: 0.25,
      fwhmCm1: 70,
      bondLabel: 'Na⁺···Cl⁻',
      mode: 'Far-IR Optical Lattice Phonon Tail',
      functionalGroup: 'Ionic Crystal Lattice',
      intensity: 'Weak',
      shape: 'Broad',
      matchingBondIndices: ionicBonds,
      description: 'NaCl lattice vibrations occur in the far-IR near 164 cm⁻¹; above 400 cm⁻¹, crystalline NaCl is virtually transparent—which is why NaCl plates are used as IR sample windows!',
    });
    return {
      peaks: peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1),
      curve: buildIrCurve(peaks, temperatureK),
      isIrActive: true,
      summaryNote: 'Rock-salt NaCl has no covalent bonds and is transparent across 4000–450 cm⁻¹ (making pressed NaCl salt plates the standard optical window for IR spectrometers).',
    };
  }

  // --- General Structural Functional-Group Analyzer (works for all organic/biomolecules/PubChem) ---
  const carboxylicAcidOBonds: number[] = [];
  const carboxylicCarbonylBonds: number[] = [];
  const esterCarbonylBonds: number[] = [];
  const amideCarbonylBonds: number[] = [];
  const ketoneCarbonylBonds: number[] = [];
  const aldehydeCHBonds: number[] = [];
  const alcoholOHBonds: number[] = [];
  const phenolOHBonds: number[] = [];
  const amineNHBonds: number[] = [];
  const amideNHBonds: number[] = [];
  const sp3CHBonds: number[] = [];
  const sp2CHBonds: number[] = [];
  const spCHBonds: number[] = [];
  const nitrileBonds: number[] = [];
  const alkyneBonds: number[] = [];
  const alkeneBonds: number[] = [];
  const aromaticBonds: number[] = [];
  const singleCOBonds: number[] = [];
  const singleCNBonds: number[] = [];
  const cxHalogenBonds: Map<string, number[]> = new Map();
  const soDoubleBonds: number[] = [];
  const soSingleBonds: number[] = [];

  let hasCarboxylicAcid = false;
  let hasAlcohol = false;
  let hasPhenol = false;
  let hasAmineNH = false;
  let hasAmideNH = false;
  let hasSp3CH = false;
  let hasSp2CH = false;
  let hasSpCH = false;
  let hasAldehyde = false;

  // Detect aromatic carbons
  const aromaticAtomIds = new Set<string>();
  bonds.forEach((b) => {
    if (b.type === 'aromatic') {
      aromaticAtomIds.add(b.from);
      aromaticAtomIds.add(b.to);
    }
  });
  if (molecule.canonicalSmiles && /[cnos]/.test(molecule.canonicalSmiles)) {
    // Lowercase atoms in SMILES denote aromaticity; also mark ring C=C alternating bonds
    bonds.forEach((b) => {
      const a1 = atomsById.get(b.from);
      const a2 = atomsById.get(b.to);
      if (a1 && a2 && a1.element === 'C' && a2.element === 'C' && b.order === 2) {
        aromaticAtomIds.add(a1.id);
        aromaticAtomIds.add(a2.id);
      }
    });
  }

  for (const atom of atoms) {
    const nbrs = neighbors.get(atom.id) || [];
    const currentOrderSum = bondOrderSum.get(atom.id) || 0;
    const implicitH = Math.max(0, getStandardValence(atom.element) - currentOrderSum - (atom.formalCharge || 0));

    if (atom.element === 'C') {
      const doubleO = nbrs.find((n) => n.atom.element === 'O' && n.bond.order === 2);
      const singleOs = nbrs.filter((n) => n.atom.element === 'O' && n.bond.order === 1);
      const singleNs = nbrs.filter((n) => n.atom.element === 'N' && n.bond.order === 1);
      const explicitHs = nbrs.filter((n) => n.atom.element === 'H');
      const totalH = explicitHs.length + implicitH;
      const hasDoubleOrAromatic = nbrs.some((n) => n.bond.order === 2) || aromaticAtomIds.has(atom.id);
      const hasTriple = nbrs.some((n) => n.bond.order === 3);

      // Carbonyl sub-classification
      if (doubleO) {
        let isAcid = false;
        let isEster = false;
        for (const sO of singleOs) {
          const oNbrs = neighbors.get(sO.atom.id) || [];
          const otherNonHC = oNbrs.find((on) => on.atom.id !== atom.id && on.atom.element !== 'H');
          if (!otherNonHC) {
            isAcid = true;
            carboxylicAcidOBonds.push(sO.bondIndex);
          } else {
            isEster = true;
          }
        }
        if (isAcid) {
          hasCarboxylicAcid = true;
          carboxylicCarbonylBonds.push(doubleO.bondIndex);
        } else if (singleNs.length > 0) {
          amideCarbonylBonds.push(doubleO.bondIndex);
        } else if (isEster) {
          esterCarbonylBonds.push(doubleO.bondIndex);
        } else if (totalH > 0) {
          hasAldehyde = true;
          ketoneCarbonylBonds.push(doubleO.bondIndex);
          explicitHs.forEach((h) => aldehydeCHBonds.push(h.bondIndex));
        } else {
          ketoneCarbonylBonds.push(doubleO.bondIndex);
        }
      }

      // C-H hybridization classification
      if (totalH > 0 && !doubleO) {
        if (hasTriple) {
          hasSpCH = true;
          explicitHs.forEach((h) => spCHBonds.push(h.bondIndex));
        } else if (hasDoubleOrAromatic) {
          hasSp2CH = true;
          explicitHs.forEach((h) => sp2CHBonds.push(h.bondIndex));
        } else {
          hasSp3CH = true;
          explicitHs.forEach((h) => sp3CHBonds.push(h.bondIndex));
        }
      }
    }

    // Hydroxyl O-H detection (explicit or implicit H)
    if (atom.element === 'O') {
      const nonHNbrs = nbrs.filter((n) => n.atom.element !== 'H');
      const hNbrs = nbrs.filter((n) => n.atom.element === 'H');
      const hasOH = hNbrs.length > 0 || (nonHNbrs.length === 1 && currentOrderSum === 1);

      if (hasOH && nonHNbrs.length === 1) {
        const anchor = nonHNbrs[0].atom;
        const anchorNbrs = neighbors.get(anchor.id) || [];
        const anchorIsCarboxylic =
          anchor.element === 'C' && anchorNbrs.some((an) => an.atom.element === 'O' && an.bond.order === 2);
        const anchorIsMineralAcid =
          (anchor.element === 'S' || anchor.element === 'P') &&
          anchorNbrs.some((an) => an.atom.element === 'O' && an.bond.order === 2);

        if (anchorIsCarboxylic || anchorIsMineralAcid) {
          hasCarboxylicAcid = true;
          hNbrs.forEach((h) => carboxylicAcidOBonds.push(h.bondIndex));
          carboxylicAcidOBonds.push(nonHNbrs[0].bondIndex);
        } else if (aromaticAtomIds.has(anchor.id)) {
          hasPhenol = true;
          hNbrs.forEach((h) => phenolOHBonds.push(h.bondIndex));
          phenolOHBonds.push(nonHNbrs[0].bondIndex);
        } else {
          hasAlcohol = true;
          hNbrs.forEach((h) => alcoholOHBonds.push(h.bondIndex));
          alcoholOHBonds.push(nonHNbrs[0].bondIndex);
        }
      }
    }

    // N-H Amine vs Amide detection
    if (atom.element === 'N') {
      const hNbrs = nbrs.filter((n) => n.atom.element === 'H');
      const totalH = hNbrs.length + implicitH;
      const isAromaticRingN = aromaticAtomIds.has(atom.id) && nbrs.length >= 2 && nbrs.some((n) => n.bond.order === 2);
      if (totalH > 0 && !isAromaticRingN) {
        const bondedToCarbonyl = nbrs.some((n) => {
          if (n.atom.element !== 'C') return false;
          const cNbrs = neighbors.get(n.atom.id) || [];
          return cNbrs.some((cn) => cn.atom.element === 'O' && cn.bond.order === 2);
        });
        if (bondedToCarbonyl) {
          hasAmideNH = true;
          hNbrs.forEach((h) => amideNHBonds.push(h.bondIndex));
          nbrs.forEach((n) => amideNHBonds.push(n.bondIndex));
        } else {
          hasAmineNH = true;
          hNbrs.forEach((h) => amineNHBonds.push(h.bondIndex));
          nbrs.forEach((n) => amineNHBonds.push(n.bondIndex));
        }
      }
    }
  }

  // Classify bond stretches directly
  bonds.forEach((b, idx) => {
    const a1 = atomsById.get(b.from);
    const a2 = atomsById.get(b.to);
    if (!a1 || !a2) return;
    const pair = [a1.element, a2.element].sort().join('-');

    if (pair === 'C-N' && b.order === 3) nitrileBonds.push(idx);
    if (pair === 'C-C' && b.order === 3) alkyneBonds.push(idx);
    if (pair === 'C-C' && b.type === 'aromatic') aromaticBonds.push(idx);
    else if (pair === 'C-C' && b.order === 2) {
      if (aromaticAtomIds.has(a1.id) && aromaticAtomIds.has(a2.id)) {
        aromaticBonds.push(idx);
      } else {
        alkeneBonds.push(idx);
      }
    }
    if (pair === 'C-O' && b.order === 1) singleCOBonds.push(idx);
    if (pair === 'C-N' && b.order === 1) singleCNBonds.push(idx);
    if (pair === 'O-S' && b.order === 2) soDoubleBonds.push(idx);
    if (pair === 'O-S' && b.order === 1) soSingleBonds.push(idx);

    if (
      pair === 'C-F' ||
      pair === 'C-Cl' ||
      pair === 'C-Br' ||
      pair === 'C-I'
    ) {
      const list = cxHalogenBonds.get(pair) || [];
      list.push(idx);
      cxHalogenBonds.set(pair, list);
    }
  });

  // --- Emit spectroscopic peaks based on detected groups ---

  // 1. O-H Stretches
  if (hasCarboxylicAcid) {
    pushPeak({
      id: 'acid_oh',
      wavenumberCm1: 3010,
      rangeCm1: [2500, 3300],
      absorbance: 0.78,
      fwhmCm1: 360,
      bondLabel: 'O–H (Acid)',
      mode: 'H-Bonded Carboxylic O–H Stretch',
      functionalGroup: 'Carboxylic Acid / Oxyacid',
      intensity: 'Strong',
      shape: 'Very Broad',
      matchingBondIndices: carboxylicAcidOBonds,
      description: 'Ultra-broad, strong dimeric hydrogen-bonded O–H stretching envelope spanning 2500–3300 cm⁻¹, overlapping the C–H region.',
    });
  } else if (hasPhenol) {
    pushPeak({
      id: 'phenol_oh',
      wavenumberCm1: 3340,
      rangeCm1: [3200, 3550],
      absorbance: 0.85,
      fwhmCm1: 165,
      bondLabel: 'O–H (Phenol)',
      mode: 'H-Bonded Phenolic O–H Stretch',
      functionalGroup: 'Phenol / Catechol',
      intensity: 'Strong',
      shape: 'Broad',
      matchingBondIndices: phenolOHBonds,
      description: 'Broad hydrogen-bonded phenolic O–H stretching band centered near 3340 cm⁻¹.',
    });
  } else if (hasAlcohol) {
    pushPeak({
      id: 'alcohol_oh',
      wavenumberCm1: 3360,
      rangeCm1: [3200, 3550],
      absorbance: 0.86,
      fwhmCm1: 170,
      bondLabel: 'O–H (Alcohol)',
      mode: 'H-Bonded Hydroxyl O–H Stretch',
      functionalGroup: 'Alcohol / Hydroxyl',
      intensity: 'Strong',
      shape: 'Broad',
      matchingBondIndices: alcoholOHBonds,
      description: 'Characteristic broad, rounded hydrogen-bonded O–H stretch between 3200 and 3550 cm⁻¹.',
    });
  }

  // 2. N-H Stretches & Bends
  if (hasAmideNH) {
    pushPeak({
      id: 'amide_nh',
      wavenumberCm1: 3315,
      rangeCm1: [3250, 3450],
      absorbance: 0.64,
      fwhmCm1: 70,
      bondLabel: 'N–H (Amide)',
      mode: 'Amide N–H Stretch',
      functionalGroup: 'Amide Linkage',
      intensity: 'Medium',
      shape: 'Medium',
      matchingBondIndices: amideNHBonds,
      description: 'Medium-intensity amide N–H stretch, noticeably sharper than alcohol O–H bands.',
    });
    pushPeak({
      id: 'amide_ii_bend',
      wavenumberCm1: 1550,
      rangeCm1: [1510, 1570],
      absorbance: 0.68,
      fwhmCm1: 42,
      bondLabel: 'N–H / C–N',
      mode: 'Amide II (N–H Bend + C–N Stretch)',
      functionalGroup: 'Secondary Amide',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: amideNHBonds,
      description: 'Coupled N–H in-plane bending and C–N stretching band diagnostic of secondary amides & peptides.',
    });
  }
  if (hasAmineNH) {
    pushPeak({
      id: 'amine_nh_stretch',
      wavenumberCm1: 3365,
      rangeCm1: [3300, 3500],
      absorbance: 0.52,
      fwhmCm1: 58,
      bondLabel: 'N–H (Amine)',
      mode: 'Amine N–H Stretch',
      functionalGroup: 'Primary / Secondary Amine',
      intensity: 'Medium',
      shape: 'Medium',
      matchingBondIndices: amineNHBonds,
      description: 'Medium-strength N–H stretch between 3300 and 3500 cm⁻¹ (doublet for primary –NH₂, singlet for secondary –NH–).',
    });
    pushPeak({
      id: 'amine_nh_bend',
      wavenumberCm1: 1610,
      rangeCm1: [1580, 1650],
      absorbance: 0.48,
      fwhmCm1: 45,
      bondLabel: 'N–H',
      mode: 'Scissoring Bend',
      functionalGroup: 'Amine',
      intensity: 'Medium',
      shape: 'Medium',
      matchingBondIndices: amineNHBonds,
      description: 'N–H bending deformation in the 1580–1650 cm⁻¹ region.',
    });
  }

  // 3. C-H Stretches & Bends
  if (hasSpCH) {
    pushPeak({
      id: 'sp_ch',
      wavenumberCm1: 3305,
      rangeCm1: [3260, 3330],
      absorbance: 0.72,
      fwhmCm1: 28,
      bondLabel: '≡C–H',
      mode: 'Terminal Alkyne / sp C–H Stretch',
      functionalGroup: 'sp Carbonyl/Alkyne/HCN',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: spCHBonds,
      description: 'Sharp, diagnostic high-frequency stretch of an sp-hybridized C–H bond near 3300 cm⁻¹.',
    });
  }
  if (hasSp2CH || aromaticBonds.length > 0 || alkeneBonds.length > 0) {
    pushPeak({
      id: 'sp2_ch',
      wavenumberCm1: 3045,
      rangeCm1: [3000, 3100],
      absorbance: 0.46,
      fwhmCm1: 36,
      bondLabel: '=C–H (sp²)',
      mode: 'Aromatic / Alkene C–H Stretch',
      functionalGroup: 'Unsaturated / Aromatic C–H',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: sp2CHBonds.length > 0 ? sp2CHBonds : aromaticBonds.length > 0 ? aromaticBonds : alkeneBonds,
      description: 'Characteristic unsaturated sp² C–H stretch appearing just above the 3000 cm⁻¹ boundary.',
    });
  }
  if (hasSp3CH) {
    pushPeak({
      id: 'sp3_ch_asym',
      wavenumberCm1: 2958,
      rangeCm1: [2920, 2985],
      absorbance: 0.68,
      fwhmCm1: 45,
      bondLabel: 'C–H (sp³)',
      mode: 'Asymmetric Alkyl C–H Stretch',
      functionalGroup: 'Aliphatic Methyl / Methylene',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: sp3CHBonds,
      description: 'Standard sp³ C–H stretching vibrations located just below 3000 cm⁻¹.',
    });
    pushPeak({
      id: 'sp3_ch_sym',
      wavenumberCm1: 2875,
      rangeCm1: [2845, 2905],
      absorbance: 0.48,
      fwhmCm1: 42,
      bondLabel: 'C–H (sp³)',
      mode: 'Symmetric Alkyl C–H Stretch',
      functionalGroup: 'Aliphatic Methyl / Methylene',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: sp3CHBonds,
      description: 'Symmetric in-phase stretching of aliphatic C–H bonds.',
    });
    pushPeak({
      id: 'sp3_ch_bend',
      wavenumberCm1: 1450,
      rangeCm1: [1370, 1475],
      absorbance: 0.44,
      fwhmCm1: 38,
      bondLabel: 'H–C–H',
      mode: 'CH₂ Scissoring / CH₃ Asymmetric Bend',
      functionalGroup: 'Aliphatic Backbone',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: sp3CHBonds,
      description: 'Aliphatic C–H scissoring and umbrella bending vibrations near 1375 & 1450 cm⁻¹.',
    });
  }
  if (hasAldehyde) {
    pushPeak({
      id: 'aldehyde_ch_1',
      wavenumberCm1: 2820,
      rangeCm1: [2800, 2850],
      absorbance: 0.45,
      fwhmCm1: 35,
      bondLabel: 'O=C–H',
      mode: 'Aldehyde Fermi Doublet (High)',
      functionalGroup: 'Aldehyde',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: aldehydeCHBonds,
      description: 'Signature aldehyde C–H doublet caused by Fermi resonance with the C–H bending overtone.',
    });
    pushPeak({
      id: 'aldehyde_ch_2',
      wavenumberCm1: 2720,
      rangeCm1: [2700, 2750],
      absorbance: 0.42,
      fwhmCm1: 35,
      bondLabel: 'O=C–H',
      mode: 'Aldehyde Fermi Doublet (Low)',
      functionalGroup: 'Aldehyde',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: aldehydeCHBonds,
      description: 'Diagnostic 2720 cm⁻¹ companion peak uniquely identifying the aldehyde functional group.',
    });
  }

  // 4. Triple Bonds (C≡N, C≡C)
  if (nitrileBonds.length > 0) {
    const isHCN = molecule.id === 'hydrogen_cyanide' || molecule.formula === 'HCN';
    pushPeak({
      id: 'nitrile_cn',
      wavenumberCm1: isHCN ? 2097 : 2245,
      rangeCm1: [2090, 2260],
      absorbance: isHCN ? 0.62 : 0.72,
      fwhmCm1: 22,
      bondLabel: 'C≡N',
      mode: 'Nitrile / Cyano Triple Bond Stretch',
      functionalGroup: 'Nitrile / Cyanide',
      intensity: 'Strong',
      shape: 'Sharp',
      matchingBondIndices: nitrileBonds,
      description: 'Razor-sharp triple bond C≡N stretch isolated cleanly in the 2100–2260 cm⁻¹ triple-bond window.',
    });
    if (isHCN) {
      pushPeak({
        id: 'hcn_bend',
        wavenumberCm1: 712,
        rangeCm1: [695, 730],
        absorbance: 0.88,
        fwhmCm1: 26,
        bondLabel: 'H–C≡N',
        mode: 'Degenerate Linear Bend (ν₂)',
        functionalGroup: 'Hydrogen Cyanide',
        intensity: 'Very Strong',
        shape: 'Sharp',
        matchingBondIndices: nitrileBonds,
        description: 'Strong doubly degenerate H–C≡N bending fundamental at 712 cm⁻¹.',
      });
    }
  }
  if (alkyneBonds.length > 0) {
    pushPeak({
      id: 'alkyne_cc',
      wavenumberCm1: 2140,
      rangeCm1: [2100, 2260],
      absorbance: 0.42,
      fwhmCm1: 25,
      bondLabel: 'C≡C',
      mode: 'Alkyne Triple Bond Stretch',
      functionalGroup: 'Alkyne',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: alkyneBonds,
      description: 'Sharp C≡C triple-bond stretching absorption in the 2100–2260 cm⁻¹ region.',
    });
  }

  // 5. Carbonyls (C=O)
  if (esterCarbonylBonds.length > 0) {
    pushPeak({
      id: 'ester_co',
      wavenumberCm1: 1752,
      rangeCm1: [1735, 1775],
      absorbance: 0.94,
      fwhmCm1: 30,
      bondLabel: 'C=O (Ester)',
      mode: 'Ester / Lactone Carbonyl Stretch',
      functionalGroup: 'Ester / Lactone',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: esterCarbonylBonds,
      description: 'High-frequency, intense C=O stretch boosted by inductive electron withdrawal of the adjacent –O– atom.',
    });
  }
  if (carboxylicCarbonylBonds.length > 0) {
    pushPeak({
      id: 'acid_co',
      wavenumberCm1: 1712,
      rangeCm1: [1695, 1730],
      absorbance: 0.95,
      fwhmCm1: 34,
      bondLabel: 'C=O (Acid)',
      mode: 'Carboxylic Acid Carbonyl Stretch',
      functionalGroup: 'Carboxylic Acid',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: carboxylicCarbonylBonds,
      description: 'Intense C=O carbonyl stretch near 1712 cm⁻¹ (lowered slightly by dimeric hydrogen bonding).',
    });
  }
  if (ketoneCarbonylBonds.length > 0) {
    pushPeak({
      id: 'ketone_co',
      wavenumberCm1: 1715,
      rangeCm1: [1705, 1735],
      absorbance: 0.92,
      fwhmCm1: 28,
      bondLabel: 'C=O (Carbonyl)',
      mode: 'Ketone / Aldehyde C=O Stretch',
      functionalGroup: 'Carbonyl',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: ketoneCarbonylBonds,
      description: 'Intense, sharp carbonyl C=O dipole stretch dominating the 1715 cm⁻¹ region.',
    });
  }
  if (amideCarbonylBonds.length > 0) {
    pushPeak({
      id: 'amide_co',
      wavenumberCm1: 1665,
      rangeCm1: [1630, 1695],
      absorbance: 0.92,
      fwhmCm1: 34,
      bondLabel: 'C=O (Amide I)',
      mode: 'Resonance-Lowered Amide C=O Stretch',
      functionalGroup: 'Amide / Xanthine',
      intensity: 'Very Strong',
      shape: 'Sharp',
      matchingBondIndices: amideCarbonylBonds,
      description: 'Nitrogen lone-pair resonance weakens C=O double-bond character, shifting the Amide I band down to ~1665 cm⁻¹.',
    });
  }

  // 6. Alkenes & Aromatic Rings
  if (alkeneBonds.length > 0) {
    pushPeak({
      id: 'alkene_cc',
      wavenumberCm1: 1648,
      rangeCm1: [1620, 1680],
      absorbance: 0.54,
      fwhmCm1: 30,
      bondLabel: 'C=C',
      mode: 'Alkene Double-Bond Stretch',
      functionalGroup: 'Alkene / Enediol',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: alkeneBonds,
      description: 'C=C stretching vibration appearing between 1620 and 1680 cm⁻¹.',
    });
  }
  if (aromaticBonds.length > 0) {
    // Benzene has zero ring stretch dipole unless substituted; if only C & H benzene, skeletal ring stretches are weak/forbidden except E1u at 1486 cm-1 and intense CH OOP at 673 cm-1
    const isPureBenzene = molecule.id === 'benzene';
    if (!isPureBenzene) {
      pushPeak({
        id: 'arom_cc_1600',
        wavenumberCm1: 1602,
        rangeCm1: [1580, 1615],
        absorbance: 0.58,
        fwhmCm1: 28,
        bondLabel: 'C=C (Ar)',
        mode: 'Aromatic Ring Skeletal Stretch',
        functionalGroup: 'Benzene / Heteroarene Ring',
        intensity: 'Medium',
        shape: 'Sharp',
        matchingBondIndices: aromaticBonds,
        description: 'Characteristic conjugated aromatic ring quadrant stretching vibration near 1600 cm⁻¹.',
      });
    }
    pushPeak({
      id: 'arom_cc_1486',
      wavenumberCm1: isPureBenzene ? 1486 : 1502,
      rangeCm1: [1470, 1520],
      absorbance: 0.62,
      fwhmCm1: 28,
      bondLabel: 'C=C (Ar)',
      mode: 'Aromatic Semicircle Ring Stretch',
      functionalGroup: 'Aromatic Ring',
      intensity: 'Medium',
      shape: 'Sharp',
      matchingBondIndices: aromaticBonds,
      description: 'IR-active aromatic skeletal C–C ring breathing mode near 1486–1502 cm⁻¹.',
    });
    pushPeak({
      id: 'arom_oop_bend',
      wavenumberCm1: isPureBenzene ? 673 : 755,
      rangeCm1: [670, 860],
      absorbance: isPureBenzene ? 0.94 : 0.72,
      fwhmCm1: 28,
      bondLabel: 'Ar C–H',
      mode: 'Out-of-Plane Ring C–H Bend (γ)',
      functionalGroup: 'Substituted / Benzene Ring',
      intensity: isPureBenzene ? 'Very Strong' : 'Strong',
      shape: 'Sharp',
      matchingBondIndices: sp2CHBonds.length > 0 ? sp2CHBonds : aromaticBonds,
      description: 'Intense out-of-plane aromatic C–H wagging vibration diagnostic of benzene substitution patterns.',
    });
  }

  // 7. Sulfonyl / Sulfuric Acid (S=O & S-O)
  if (soDoubleBonds.length > 0) {
    pushPeak({
      id: 'so2_asym',
      wavenumberCm1: 1368,
      rangeCm1: [1340, 1390],
      absorbance: 0.92,
      fwhmCm1: 40,
      bondLabel: 'S=O (asym)',
      mode: 'Sulfonyl Asymmetric Stretch',
      functionalGroup: 'Sulfuric Acid / Sulfonate',
      intensity: 'Very Strong',
      shape: 'Medium',
      matchingBondIndices: soDoubleBonds,
      description: 'Intense asymmetric S(=O)₂ stretching mode around 1368 cm⁻¹.',
    });
    pushPeak({
      id: 'so2_sym',
      wavenumberCm1: 1175,
      rangeCm1: [1150, 1205],
      absorbance: 0.88,
      fwhmCm1: 42,
      bondLabel: 'S=O (sym)',
      mode: 'Sulfonyl Symmetric Stretch',
      functionalGroup: 'Sulfuric Acid / Sulfonate',
      intensity: 'Very Strong',
      shape: 'Medium',
      matchingBondIndices: soDoubleBonds,
      description: 'Companion symmetric S(=O)₂ stretching vibration near 1175 cm⁻¹.',
    });
  }
  if (soSingleBonds.length > 0) {
    pushPeak({
      id: 'so_single',
      wavenumberCm1: 905,
      rangeCm1: [870, 940],
      absorbance: 0.74,
      fwhmCm1: 48,
      bondLabel: 'S–O(H)',
      mode: 'S–O Single Bond Stretch',
      functionalGroup: 'Oxyacid Hydroxyl',
      intensity: 'Strong',
      shape: 'Medium',
      matchingBondIndices: soSingleBonds,
      description: 'Polar S–OH single-bond stretching vibration near 905 cm⁻¹.',
    });
  }

  // 8. C-O & C-N Single Bonds (Fingerprint Region)
  if (singleCOBonds.length > 0) {
    const wn = esterCarbonylBonds.length > 0 ? 1195 : carboxylicCarbonylBonds.length > 0 ? 1245 : 1065;
    pushPeak({
      id: 'single_co',
      wavenumberCm1: wn,
      rangeCm1: [1020, 1290],
      absorbance: 0.76,
      fwhmCm1: 45,
      bondLabel: 'C–O',
      mode: 'C–O Single Bond Stretch',
      functionalGroup: esterCarbonylBonds.length > 0 ? 'Ester C–O–C' : hasCarboxylicAcid ? 'Carboxylic C–O' : 'Alcohol / Sugar C–O',
      intensity: 'Strong',
      shape: 'Medium',
      matchingBondIndices: singleCOBonds,
      description: 'Strong polar C–O stretching absorption inside the fingerprint region (1020–1280 cm⁻¹).',
    });
  }
  if (singleCNBonds.length > 0) {
    pushPeak({
      id: 'single_cn',
      wavenumberCm1: 1140,
      rangeCm1: [1030, 1230],
      absorbance: 0.48,
      fwhmCm1: 42,
      bondLabel: 'C–N',
      mode: 'C–N Single Bond Stretch',
      functionalGroup: 'Amine / Heterocycle',
      intensity: 'Medium',
      shape: 'Medium',
      matchingBondIndices: singleCNBonds,
      description: 'Medium C–N stretching vibration in amines and nitrogen heterocycles.',
    });
  }

  // 9. Organohalogens (C-X)
  cxHalogenBonds.forEach((bIndices, pair) => {
    const haloFreq: Record<string, { wn: number; label: string; desc: string }> = {
      'C-F': { wn: 1180, label: 'C–F', desc: 'Strong polar C–F stretch between 1000 and 1400 cm⁻¹.' },
      'C-Cl': { wn: 735, label: 'C–Cl', desc: 'Organochlorine C–Cl stretch appearing in the 600–800 cm⁻¹ region.' },
      'C-Br': { wn: 610, label: 'C–Br', desc: 'Heavy bromine mass shifts C–Br stretch down to ~500–650 cm⁻¹.' },
      'C-I': { wn: 515, label: 'C–I', desc: 'Low-frequency C–I stretch near 500 cm⁻¹.' },
    };
    const cfg = haloFreq[pair];
    if (cfg) {
      pushPeak({
        id: `cx_${pair}`,
        wavenumberCm1: cfg.wn,
        rangeCm1: [cfg.wn - 70, cfg.wn + 70],
        absorbance: 0.72,
        fwhmCm1: 35,
        bondLabel: cfg.label,
        mode: `${cfg.label} Stretching Vibration`,
        functionalGroup: 'Organohalide',
        intensity: 'Strong',
        shape: 'Sharp',
        matchingBondIndices: bIndices,
        description: cfg.desc,
      });
    }
  });

  // Fallback if a PubChem compound had unusual heteroatoms and produced 0 peaks
  if (peaks.length === 0 && bonds.length > 0) {
    const isHomonuclear = atoms.length === 2 && atoms[0].element === atoms[1].element;
    if (!isHomonuclear) {
      pushPeak({
        id: 'skeletal_fallback',
        wavenumberCm1: 1050,
        rangeCm1: [800, 1300],
        absorbance: 0.45,
        fwhmCm1: 60,
        bondLabel: 'Skeletal',
        mode: 'Molecular Skeletal Stretching',
        functionalGroup: 'Covalent Framework',
        intensity: 'Medium',
        shape: 'Medium',
        matchingBondIndices: bonds.map((_, i) => i),
        description: 'General skeletal framework vibration in the fingerprint region.',
      });
    }
  }

  const sortedPeaks = peaks.sort((a, b) => b.wavenumberCm1 - a.wavenumberCm1);
  const isIrActive = sortedPeaks.length > 0;

  let summaryNote = '';
  if (!isIrActive) {
    summaryNote =
      'IR-Inactive Molecule: Symmetric homonuclear vibrations produce zero change in dipole moment (Δμ = 0), so no infrared photons are absorbed.';
  } else {
    const topPeaks = sortedPeaks.slice(0, 3).map((p) => `${p.bondLabel} (${p.wavenumberCm1} cm⁻¹)`).join(', ');
    summaryNote = `Predicted ${sortedPeaks.length} IR-active vibrational bands led by ${topPeaks}.`;
  }

  return {
    peaks: sortedPeaks,
    curve: buildIrCurve(sortedPeaks, temperatureK),
    isIrActive,
    summaryNote,
  };
}
