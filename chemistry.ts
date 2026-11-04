export type ElementCategory =
  | 'alkali_metal'
  | 'alkaline_earth'
  | 'transition_metal'
  | 'post_transition_metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble_gas'
  | 'lanthanide'
  | 'actinide';

export interface ElementData {
  atomicNumber: number;
  symbol: string;
  name: string;
  atomicMass: number;
  category: ElementCategory;
  period: number;
  group: number;
  block: 's' | 'p' | 'd' | 'f';
  electronConfiguration: string;
  shells: number[]; // electrons in K, L, M, N, O, P, Q
  valenceElectrons: number;
  electronegativity: number | null; // Pauling scale
  oxidationStates: number[];
  atomicRadius: number; // in picometers (pm)
  covalentRadius: number; // in pm
  ionizationEnergy: number; // in kJ/mol
  meltingPointK: number | null;
  boilingPointK: number | null;
  densityGPerCm3: number | null;
  cpkColor: string; // Hex color for CPK standard
  discoveryYear: string | number;
  phaseAtSTP: 'solid' | 'liquid' | 'gas';
  summary: string;
  realWorldUses: string[];
  stableIsotopes: Array<{
    massNumber: number;
    abundancePercent: number;
    halfLife?: string;
  }>;
}

export interface MolecularAtom {
  id: string;
  element: string; // Symbol, e.g. 'C', 'H', 'O'
  position: [number, number, number]; // [x, y, z] in Ångströms
  formalCharge?: number;
  partialCharge?: number; // e.g. -0.4 for O in H2O
  hybridization?: 'sp' | 'sp2' | 'sp3' | 'sp3d' | 'sp3d2';
}

export interface MolecularBond {
  id: string;
  from: string; // Atom ID
  to: string; // Atom ID
  order: 1 | 2 | 3;
  type?: 'covalent' | 'polar_covalent' | 'ionic' | 'hydrogen' | 'aromatic';
}

export interface MoleculeData {
  id: string;
  name: string;
  formula: string;
  iupacName?: string;
  category: 'simple_inorganic' | 'organic' | 'biomolecule' | 'atmospheric' | 'acid_base' | 'crystal' | 'neurotransmitter' | 'pharmaceutical';
  description: string;
  vseprGeometry: string;
  idealBondAngle: string;
  dipoleMomentDebye: number; // in Debye (D)
  isPolar: boolean;
  molarMass: number; // g/mol
  boilingPointC?: number;
  meltingPointC?: number;
  atoms: MolecularAtom[];
  bonds: MolecularBond[];
  keyFacts: string[];
  pubchemCid?: number;
  canonicalSmiles?: string;
  source?: 'curated' | 'pubchem';
}

export interface ChemicalReaction {
  id: string;
  name: string;
  equation: string;
  description: string;
  type:
    | 'combustion'
    | 'synthesis'
    | 'neutralization'
    | 'decomposition'
    | 'redox'
    | 'biochemical'
    | 'nuclear_fission'
    | 'nuclear_fusion'
    | 'precipitation'
    | 'displacement';
  enthalpyDeltaH: number; // kJ/mol (negative = exothermic, positive = endothermic)
  entropyDeltaS: number; // J/(mol·K) (positive = entropy increases/disorder increases, negative = entropy decreases/order increases)
  activationEnergyEa: number; // kJ/mol
  isExothermic: boolean;
  gibbsFreeEnergyDeltaG?: number; // kJ/mol at 298.15 K (ΔG° = ΔH° - TΔS°)
  thermodynamicsSummary?: string;
  reactants: Array<{ formula: string; name: string; count: number; moleculeId?: string }>;
  products: Array<{ formula: string; name: string; count: number; moleculeId?: string }>;
  stages: Array<{
    title: string;
    description: string;
    progress: number; // 0 to 1
    stateName: string;
  }>;
}
