import { MolecularAtom, MolecularBond } from '../types/chemistry';
import { getElement } from '../data/elements';

export interface BondPhysicsData {
  pairKey: string;
  order: 1 | 2 | 3;
  name: string;
  bondEnergyKj: number; // kJ/mol
  bondEnergyKcal: number; // kcal/mol
  equilibriumLengthAngstrom: number; // Å
  equilibriumLengthPm: number; // pm
  irWavenumberCm1: number; // typical IR stretch in cm⁻¹
  morseParameterA: number; // Å⁻¹ for Morse curve
  strengthCategory: 'Extremely Strong' | 'Very Strong' | 'Strong Covalent' | 'Moderate Covalent' | 'Weak / Dissociable';
  categoryColor: string; // Hex color for meters and badges
  electronegativityA: number;
  electronegativityB: number;
  deltaElectronegativity: number;
  percentIonicCharacter: number; // 0 - 100%
  polarityType: 'Nonpolar Covalent' | 'Weakly Polar' | 'Polar Covalent' | 'Strongly Polar' | 'Predominantly Ionic';
  description: string;
}

export interface LiveBondState {
  bond: MolecularBond;
  atomA: MolecularAtom;
  atomB: MolecularAtom;
  physics: BondPhysicsData;
  instantaneousLengthAngstrom: number;
  instantaneousLengthPm: number;
  equilibriumLengthAngstrom: number;
  displacementAngstrom: number; // r - r0
  strainPercent: number; // ((r - r0) / r0) * 100
  instantaneousPotentialKj: number; // V(r) from Morse potential
  thermalEnergyKj: number; // RT in kJ/mol
  thermalEnergyRatio: number; // RT / De
  vibrationalMode: 'Stretched' | 'Compressed' | 'Equilibrium';
  stabilityStatus: string;
}

// Empirical reference database of standard Chemical Bond Dissociation Energies (BDE) and lengths (r0)
// Sources: CRC Handbook of Chemistry & Physics, Pauling Electronegativities, IUPAC Gold Book
interface BondReferenceEntry {
  energyKj: number;
  lengthAngstrom: number;
  irWavenumber: number;
  morseA: number;
  description: string;
}

const BOND_DATABASE: Record<string, BondReferenceEntry> = {
  // Hydrogen bonds
  'H-H#1': { energyKj: 436, lengthAngstrom: 0.74, irWavenumber: 4160, morseA: 1.94, description: 'Single covalent bond between hydrogen atoms; fundamental diatomic orbital overlap.' },
  'C-H#1': { energyKj: 413, lengthAngstrom: 1.09, irWavenumber: 2960, morseA: 1.88, description: 'Ubiquitous organic C-H σ-bond; foundational building block of hydrocarbons and lipids.' },
  'N-H#1': { energyKj: 391, lengthAngstrom: 1.01, irWavenumber: 3350, morseA: 2.12, description: 'Polar covalent bond key to amino acid backbones, peptides, and hydrogen-bonded protein folding.' },
  'O-H#1': { energyKj: 463, lengthAngstrom: 0.96, irWavenumber: 3650, morseA: 2.28, description: 'High-energy polar bond responsible for water’s high cohesion, boiling point, and solvent power.' },
  'F-H#1': { energyKj: 567, lengthAngstrom: 0.92, irWavenumber: 4138, morseA: 2.22, description: 'Extremely strong single covalent bond due to intense fluorine electronegativity.' },
  'Cl-H#1': { energyKj: 431, lengthAngstrom: 1.27, irWavenumber: 2886, morseA: 1.87, description: 'Polar covalent halogen acid bond; easily ionizes in aqueous solution to yield hydronium.' },
  'Br-H#1': { energyKj: 366, lengthAngstrom: 1.41, irWavenumber: 2559, morseA: 1.81, description: 'Strong acid bond with large halogen diffuse orbital overlap.' },
  'I-H#1': { energyKj: 298, lengthAngstrom: 1.61, irWavenumber: 2230, morseA: 1.74, description: 'Long, easily dissociable bond; among the strongest hydrohalic Bronsted acids.' },
  'B-H#1': { energyKj: 389, lengthAngstrom: 1.19, irWavenumber: 2560, morseA: 1.75, description: 'Borane hydride bond; readily engages in 3-center 2-electron bridging bonds.' },
  'S-H#1': { energyKj: 363, lengthAngstrom: 1.34, irWavenumber: 2570, morseA: 1.78, description: 'Thiol bond found in cysteine residues; critical for redox signaling and disulfide bridges.' },
  'P-H#1': { energyKj: 322, lengthAngstrom: 1.42, irWavenumber: 2320, morseA: 1.65, description: 'Phosphine covalent bond with low polarity due to matched electronegativities.' },

  // Carbon - Carbon bonds
  'C-C#1': { energyKj: 348, lengthAngstrom: 1.54, irWavenumber: 1000, morseA: 1.85, description: 'Standard carbon-carbon σ-bond; defines the tetrahedral sp³ backbone of organic chemistry.' },
  'C-C#2': { energyKj: 614, lengthAngstrom: 1.34, irWavenumber: 1650, morseA: 1.95, description: 'Carbon-carbon double bond (σ + π); rigid planar geometry preventing free rotation.' },
  'C-C#3': { energyKj: 839, lengthAngstrom: 1.20, irWavenumber: 2150, morseA: 2.15, description: 'Carbon-carbon triple bond (σ + 2π); linear cylinder of electron density with immense energy.' },

  // Carbon - Heteroatom bonds
  'C-O#1': { energyKj: 358, lengthAngstrom: 1.43, irWavenumber: 1100, morseA: 1.90, description: 'Alcohol, ether, and sugar backbone bond; polar σ-bond with significant dipole.' },
  'C-O#2': { energyKj: 799, lengthAngstrom: 1.23, irWavenumber: 1720, morseA: 2.10, description: 'Carbonyl double bond; highly polarized electrophilic center in ketones, esters, and CO₂.' },
  'C-O#3': { energyKj: 1072, lengthAngstrom: 1.13, irWavenumber: 2143, morseA: 2.30, description: 'Carbon monoxide triple bond; one of the strongest chemical bonds known in molecular chemistry.' },
  'C-N#1': { energyKj: 305, lengthAngstrom: 1.47, irWavenumber: 1150, morseA: 1.82, description: 'Amine and peptide linkage σ-bond; essential in all biochemical nitrogen metabolites.' },
  'C-N#2': { energyKj: 615, lengthAngstrom: 1.28, irWavenumber: 1640, morseA: 2.05, description: 'Imine / Schiff base double bond; central to enzymatic catalysis and visual rhodopsin.' },
  'C-N#3': { energyKj: 891, lengthAngstrom: 1.16, irWavenumber: 2240, morseA: 2.25, description: 'Nitrile / cyano triple bond; highly stable cylindrical π-cloud with high dipole.' },
  'C-F#1': { energyKj: 485, lengthAngstrom: 1.35, irWavenumber: 1250, morseA: 2.05, description: 'Strongest single bond in organic chemistry; imparts extreme chemical inertness (e.g. Teflon).' },
  'C-Cl#1': { energyKj: 328, lengthAngstrom: 1.77, irWavenumber: 700, morseA: 1.75, description: 'Polar organochlorine bond; key electrophile in SN2 and SN1 nucleophilic substitutions.' },
  'C-Br#1': { energyKj: 276, lengthAngstrom: 1.94, irWavenumber: 600, morseA: 1.68, description: 'Organobromine bond; facile leaving group in synthetic organic cross-coupling.' },
  'C-I#1': { energyKj: 240, lengthAngstrom: 2.14, irWavenumber: 500, morseA: 1.60, description: 'Weak, polarized carbon-iodine bond; exceptional leaving group and radical precursor.' },
  'C-S#1': { energyKj: 272, lengthAngstrom: 1.82, irWavenumber: 690, morseA: 1.72, description: 'Thioether and methionine bond; critical for enzymatic methyl transfers (SAM).' },
  'C-S#2': { energyKj: 573, lengthAngstrom: 1.61, irWavenumber: 1050, morseA: 1.95, description: 'Thiocarbonyl double bond (e.g., carbon disulfide); reactive diffuse π-overlap.' },

  // Nitrogen bonds
  'N-N#1': { energyKj: 163, lengthAngstrom: 1.45, irWavenumber: 900, morseA: 1.60, description: 'Hydrazine single bond; notably weak due to adjacent lone-pair repulsion.' },
  'N-N#2': { energyKj: 418, lengthAngstrom: 1.25, irWavenumber: 1550, morseA: 1.92, description: 'Azo double bond (-N=N-); common chromophore in synthetic dyes and photo-switches.' },
  'N-N#3': { energyKj: 945, lengthAngstrom: 1.10, irWavenumber: 2330, morseA: 2.35, description: 'Atmospheric dinitrogen triple bond; near-inert inertness requiring nitrogenase enzyme or Haber-Bosch.' },
  'N-O#1': { energyKj: 201, lengthAngstrom: 1.40, irWavenumber: 950, morseA: 1.70, description: 'Hydroxylamine single bond; readily cleaved in biochemical redox pathways.' },
  'N-O#2': { energyKj: 607, lengthAngstrom: 1.21, irWavenumber: 1530, morseA: 2.05, description: 'Nitro / nitroso double bond; significant resonance delocalization in organic explosives & signaling (NO).' },

  // Oxygen bonds
  'O-O#1': { energyKj: 146, lengthAngstrom: 1.48, irWavenumber: 880, morseA: 1.55, description: 'Peroxide single bond; notoriously fragile and prone to homolytic cleavage to generate free radicals.' },
  'O-O#2': { energyKj: 498, lengthAngstrom: 1.21, irWavenumber: 1556, morseA: 2.00, description: 'Paramagnetic triplet dioxygen double bond; essential terminal electron acceptor in aerobic respiration.' },

  // Halogen - Halogen bonds
  'F-F#1': { energyKj: 155, lengthAngstrom: 1.42, irWavenumber: 892, morseA: 1.62, description: 'Fluorine molecule single bond; unexpectedly weak due to compact lone pair non-bonded repulsion.' },
  'Cl-Cl#1': { energyKj: 242, lengthAngstrom: 1.99, irWavenumber: 560, morseA: 1.71, description: 'Diatomic chlorine bond; readily photo-cleaved by UV light to form chlorine radicals.' },
  'Br-Br#1': { energyKj: 193, lengthAngstrom: 2.28, irWavenumber: 323, morseA: 1.65, description: 'Diatomic bromine bond; volatile brown-red liquid at standard room temperature.' },
  'I-I#1': { energyKj: 151, lengthAngstrom: 2.67, irWavenumber: 214, morseA: 1.58, description: 'Diatomic iodine bond; weak covalent bond giving rise to purple sublimation vapors.' },

  // Inorganic and Ionic / Polar Network Interactions
  'Na-Cl#1': { energyKj: 412, lengthAngstrom: 2.36, irWavenumber: 365, morseA: 1.50, description: 'Classic rock salt ionic pair; electrostatic attraction between closed-shell Na⁺ and Cl⁻ ions.' },
  'Mg-O#1': { energyKj: 393, lengthAngstrom: 2.10, irWavenumber: 490, morseA: 1.65, description: 'Refractory metal oxide bond; high lattice energy from divalent cation/anion charges.' },
  'B-F#1': { energyKj: 646, lengthAngstrom: 1.31, irWavenumber: 1450, morseA: 2.18, description: 'Exceptionally strong Lewis acid polar covalent bond with partial back-donation.' },
  'Si-O#1': { energyKj: 467, lengthAngstrom: 1.63, irWavenumber: 1080, morseA: 1.88, description: 'Silica silicate backbone bond; foundational to Earth’s crust, quartz minerals, and glass.' },
  'P-O#1': { energyKj: 335, lengthAngstrom: 1.60, irWavenumber: 1000, morseA: 1.80, description: 'Phosphodiester DNA/RNA linkage and phosphate ester single bond.' },
  'P-O#2': { energyKj: 544, lengthAngstrom: 1.43, irWavenumber: 1250, morseA: 2.05, description: 'Phosphoryl double bond (P=O); thermodynamically driving organophosphorus chemistry.' },
};

/**
 * Standardize pair key alphabetically so 'C-O' matches 'O-C'
 */
function makeCanonicalPairKey(elemA: string, elemB: string, order: 1 | 2 | 3): string {
  const [first, second] = [elemA, elemB].sort();
  return `${first}-${second}#${order}`;
}

/**
 * Retrieve or compute physical properties for an atomic bond
 */
export function getBondPhysics(
  elemA: string,
  elemB: string,
  order: 1 | 2 | 3 = 1,
  fallbackLength?: number
): BondPhysicsData {
  const elDataA = getElement(elemA);
  const elDataB = getElement(elemB);

  const chiA = elDataA?.electronegativity ?? 2.2;
  const chiB = elDataB?.electronegativity ?? 2.2;
  const deltaChi = Number(Math.abs(chiA - chiB).toFixed(2));

  // Pauling percent ionic character formula: % = (1 - e^(-(Δχ)^2 / 4)) * 100
  const ionicPct = Math.round((1 - Math.exp(-0.25 * Math.pow(deltaChi, 2))) * 100);

  let polarityType: BondPhysicsData['polarityType'] = 'Nonpolar Covalent';
  if (deltaChi > 2.0) {
    polarityType = 'Predominantly Ionic';
  } else if (deltaChi >= 1.0) {
    polarityType = 'Strongly Polar';
  } else if (deltaChi >= 0.5) {
    polarityType = 'Polar Covalent';
  } else if (deltaChi >= 0.2) {
    polarityType = 'Weakly Polar';
  }

  // Lookup empirical entry
  const key = makeCanonicalPairKey(elemA, elemB, order);
  const found = BOND_DATABASE[key];

  let energyKj: number;
  let eqLength: number;
  let irFreq: number;
  let morseA: number;
  let desc: string;

  if (found) {
    energyKj = found.energyKj;
    eqLength = found.lengthAngstrom;
    irFreq = found.irWavenumber;
    morseA = found.morseA;
    desc = found.description;
  } else {
    // Estimations based on covalent radii and bond order
    const radA = (elDataA?.covalentRadius || 70) / 100; // in Å
    const radB = (elDataB?.covalentRadius || 70) / 100;
    const baseLength = fallbackLength || (radA + radB);
    eqLength = Number((order === 3 ? baseLength * 0.78 : order === 2 ? baseLength * 0.88 : baseLength).toFixed(2));

    // Base energy estimate: approx 320 kJ/mol * order multiplier + ionic resonance
    const orderMult = order === 3 ? 2.4 : order === 2 ? 1.7 : 1.0;
    const ionicBonus = deltaChi * 80;
    energyKj = Math.round((330 * orderMult) + ionicBonus);
    irFreq = Math.round(1100 * Math.sqrt(order));
    morseA = 1.85;
    desc = `${order === 3 ? 'Triple' : order === 2 ? 'Double' : 'Single'} covalent bond between ${elDataA?.name || elemA} and ${elDataB?.name || elemB}.`;
  }

  const energyKcal = Number((energyKj / 4.184).toFixed(1));

  // Determine strength category
  let strengthCategory: BondPhysicsData['strengthCategory'] = 'Strong Covalent';
  let categoryColor = '#10b981'; // emerald

  if (energyKj >= 800) {
    strengthCategory = 'Extremely Strong';
    categoryColor = '#8b5cf6'; // violet
  } else if (energyKj >= 550) {
    strengthCategory = 'Very Strong';
    categoryColor = '#06b6d4'; // cyan
  } else if (energyKj >= 350) {
    strengthCategory = 'Strong Covalent';
    categoryColor = '#10b981'; // emerald
  } else if (energyKj >= 220) {
    strengthCategory = 'Moderate Covalent';
    categoryColor = '#f59e0b'; // amber
  } else {
    strengthCategory = 'Weak / Dissociable';
    categoryColor = '#ef4444'; // rose
  }

  const orderSymbol = order === 3 ? '≡' : order === 2 ? '=' : '—';

  return {
    pairKey: `${elemA} ${orderSymbol} ${elemB}`,
    order,
    name: `${elDataA?.name || elemA}–${elDataB?.name || elemB} (${order === 3 ? 'Triple' : order === 2 ? 'Double' : 'Single'})`,
    bondEnergyKj: energyKj,
    bondEnergyKcal: energyKcal,
    equilibriumLengthAngstrom: eqLength,
    equilibriumLengthPm: Math.round(eqLength * 100),
    irWavenumberCm1: irFreq,
    morseParameterA: morseA,
    strengthCategory,
    categoryColor,
    electronegativityA: chiA,
    electronegativityB: chiB,
    deltaElectronegativity: deltaChi,
    percentIonicCharacter: ionicPct,
    polarityType,
    description: desc,
  };
}

/**
 * Calculates Morse Potential energy V(r) = D_e * (1 - exp(-a * (r - r_0)))^2
 * in kJ/mol.
 */
export function calculateMorsePotential(r: number, r0: number, DeKj: number, a: number): number {
  const dr = r - r0;
  const factor = 1 - Math.exp(-a * dr);
  return DeKj * Math.pow(factor, 2);
}

/**
 * Generates sample curve points for Morse potential well diagram
 */
export function generateMorsePotentialCurve(
  r0: number,
  DeKj: number,
  a: number,
  steps = 40
): Array<{ r: number; energyKj: number }> {
  const minR = Math.max(0.4, r0 - 0.55);
  const maxR = r0 + 1.25;
  const stepSize = (maxR - minR) / steps;

  const points: Array<{ r: number; energyKj: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const r = minR + i * stepSize;
    const energy = Math.min(calculateMorsePotential(r, r0, DeKj, a), DeKj * 1.35);
    points.push({ r: Number(r.toFixed(3)), energyKj: Number(energy.toFixed(1)) });
  }
  return points;
}
