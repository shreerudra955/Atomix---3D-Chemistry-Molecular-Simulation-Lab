import * as THREE from 'three';
import { MolecularAtom, MolecularBond } from '../types/chemistry';
import {
  fixAllBondAngles,
  getMaxBondsForAtom,
  getNextVSEPRBondPosition,
  formatAtomWithCharge,
} from '../components/MoleculeBuilderSandbox';

export type FunctionalGroupCategory =
  | 'oxygen'
  | 'nitrogen'
  | 'hydrocarbon'
  | 'sulfur_phosphorus'
  | 'halogen';

export interface FGTemplateAtom {
  key: string;
  element: string;
  localPos: [number, number, number];
  formalCharge?: number;
}

export interface FGTemplateBond {
  fromKey: string; // '__PARENT__' connects to the selected parent atom
  toKey: string;
  order: 1 | 2 | 3;
}

export interface FunctionalGroupDef {
  id: string;
  name: string;
  formula: string;
  classLabel: string;
  category: FunctionalGroupCategory;
  polarity: string;
  hint: string;
  attachBondOrder: 1 | 2 | 3;
  atoms: FGTemplateAtom[];
  bonds: FGTemplateBond[];
  standaloneName: string;
  standaloneCustom?: {
    atoms: Array<{ key: string; element: string; pos: [number, number, number]; formalCharge?: number }>;
    bonds: Array<{ from: string; to: string; order: 1 | 2 | 3 }>;
    selectKey: string;
  };
}

export const FUNCTIONAL_GROUP_CATEGORIES: Array<{
  id: FunctionalGroupCategory | 'all';
  label: string;
  accent: string;
}> = [
  { id: 'all', label: 'All Groups', accent: 'sky' },
  { id: 'oxygen', label: 'Oxygen (O)', accent: 'rose' },
  { id: 'nitrogen', label: 'Nitrogen (N)', accent: 'indigo' },
  { id: 'hydrocarbon', label: 'Hydrocarbon & Aromatic', accent: 'emerald' },
  { id: 'sulfur_phosphorus', label: 'Sulfur & Phosphorus', accent: 'amber' },
  { id: 'halogen', label: 'Halogens & Acyl', accent: 'lime' },
];

// Helper to build a phenyl ring attached along +X starting at parent [0,0,0]
function makePhenylTemplate(): { atoms: FGTemplateAtom[]; bonds: FGTemplateBond[] } {
  // Center of ring at x = 1.95 + 1.96 = 3.91
  const rC = 1.96;
  const rH = 3.45;
  const cx = 1.95 + rC;
  const atoms: FGTemplateAtom[] = [];
  const bonds: FGTemplateBond[] = [];

  // k=0 at angle PI -> leftmost vertex at (1.95, 0, 0), going around hexagon
  for (let k = 0; k < 6; k++) {
    const ang = Math.PI + (k * Math.PI) / 3;
    const x = Number((cx + rC * Math.cos(ang)).toFixed(4));
    const y = Number((rC * Math.sin(ang)).toFixed(4));
    atoms.push({ key: `C${k + 1}`, element: 'C', localPos: [x, y, 0] });

    if (k > 0) {
      const hx = Number((cx + rH * Math.cos(ang)).toFixed(4));
      const hy = Number((rH * Math.sin(ang)).toFixed(4));
      atoms.push({ key: `H${k}`, element: 'H', localPos: [hx, hy, 0] });
      bonds.push({ fromKey: `C${k + 1}`, toKey: `H${k}`, order: 1 });
    }
  }

  bonds.push({ fromKey: '__PARENT__', toKey: 'C1', order: 1 });
  for (let k = 0; k < 6; k++) {
    bonds.push({
      fromKey: `C${k + 1}`,
      toKey: `C${((k + 1) % 6) + 1}`,
      order: k % 2 === 0 ? 2 : 1,
    });
  }

  return { atoms, bonds };
}

const PHENYL_TEMPLATE = makePhenylTemplate();

export const ALL_FUNCTIONAL_GROUPS: FunctionalGroupDef[] = [
  // ================= OXYGEN FUNCTIONAL GROUPS =================
  {
    id: 'hydroxyl',
    name: 'Hydroxyl (Alcohol)',
    formula: '–OH',
    classLabel: 'Alcohol / Phenol',
    category: 'oxygen',
    polarity: 'Polar (H-Bond Donor)',
    hint: 'Forms hydrogen bonds; acidic Ar–OH on aromatic rings.',
    attachBondOrder: 1,
    atoms: [
      { key: 'O1', element: 'O', localPos: [1.95, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.36, 1.36, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'O1', order: 1 },
      { fromKey: 'O1', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Methanol (CH₃OH)',
  },
  {
    id: 'aldehyde',
    name: 'Aldehyde (Formyl)',
    formula: '–CHO',
    classLabel: 'Aldehyde',
    category: 'oxygen',
    polarity: 'Polar (C=O Dipole)',
    hint: 'Terminal trigonal planar carbonyl; easily oxidized to –COOH.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.89, 1.63, 0] },
      { key: 'H1', element: 'H', localPos: [2.72, -1.33, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Ethanal / Acetaldehyde (CH₃CHO)',
  },
  {
    id: 'ketone',
    name: 'Ketone (Carbonyl)',
    formula: '–C(=O)CH₃',
    classLabel: 'Ketone',
    category: 'oxygen',
    polarity: 'Polar (H-Bond Acceptor)',
    hint: 'Internal sp² carbonyl carbon flanked by two carbon groups.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.90, 1.63, 0] },
      { key: 'C2', element: 'C', localPos: [2.98, -1.77, 0] },
      { key: 'H1', element: 'H', localPos: [4.45, -1.52, 0] },
      { key: 'H2', element: 'H', localPos: [2.62, -2.55, 1.24] },
      { key: 'H3', element: 'H', localPos: [2.62, -2.55, -1.24] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'C2', order: 1 },
      { fromKey: 'C2', toKey: 'H1', order: 1 },
      { fromKey: 'C2', toKey: 'H2', order: 1 },
      { fromKey: 'C2', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Propan-2-one / Acetone ((CH₃)₂CO)',
  },
  {
    id: 'carboxylic_acid',
    name: 'Carboxylic Acid',
    formula: '–COOH',
    classLabel: 'Carboxylic Acid',
    category: 'oxygen',
    polarity: 'Strongly Polar (H-Bonding)',
    hint: 'Weak organic acid (pKa ~4–5) with n → π* carbonyl resonance.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.89, 1.63, 0] },
      { key: 'O2', element: 'O', localPos: [2.98, -1.77, 0] },
      { key: 'H1', element: 'H', localPos: [4.40, -1.77, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'O2', order: 1 },
      { fromKey: 'O2', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Ethanoic / Acetic Acid (CH₃COOH)',
  },
  {
    id: 'carboxylate',
    name: 'Carboxylate Anion',
    formula: '–COO⁻',
    classLabel: 'Carboxylate (Resonant)',
    category: 'oxygen',
    polarity: 'Ionic / Charged',
    hint: 'Two equivalent resonance forms sharing negative charge across both O atoms.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.90, 1.65, 0] },
      { key: 'O2', element: 'O', localPos: [2.90, -1.65, 0], formalCharge: -1 },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'O2', order: 1 },
    ],
    standaloneName: 'Acetate Ion (CH₃COO⁻)',
  },
  {
    id: 'ester',
    name: 'Ester',
    formula: '–COOCH₃',
    classLabel: 'Ester',
    category: 'oxygen',
    polarity: 'Moderately Polar',
    hint: 'Condensation product of carboxylic acid + alcohol; fragrant volatile ester.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.89, 1.63, 0] },
      { key: 'O2', element: 'O', localPos: [2.98, -1.77, 0] },
      { key: 'C2', element: 'C', localPos: [4.85, -1.55, 0] },
      { key: 'H1', element: 'H', localPos: [5.45, -2.92, 0] },
      { key: 'H2', element: 'H', localPos: [5.25, -0.78, 1.24] },
      { key: 'H3', element: 'H', localPos: [5.25, -0.78, -1.24] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'O2', order: 1 },
      { fromKey: 'O2', toKey: 'C2', order: 1 },
      { fromKey: 'C2', toKey: 'H1', order: 1 },
      { fromKey: 'C2', toKey: 'H2', order: 1 },
      { fromKey: 'C2', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Methyl Ethanoate / Methyl Acetate',
  },
  {
    id: 'ether',
    name: 'Ether (Alkoxy)',
    formula: '–OCH₃',
    classLabel: 'Ether',
    category: 'oxygen',
    polarity: 'Moderately Polar (Aprotic)',
    hint: 'Bent C–O–C linkage; unreactive polar aprotic H-bond acceptor.',
    attachBondOrder: 1,
    atoms: [
      { key: 'O1', element: 'O', localPos: [1.95, 0, 0] },
      { key: 'C1', element: 'C', localPos: [2.55, 1.92, 0] },
      { key: 'H1', element: 'H', localPos: [2.05, 2.75, 1.15] },
      { key: 'H2', element: 'H', localPos: [2.05, 2.75, -1.15] },
      { key: 'H3', element: 'H', localPos: [4.05, 2.05, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'O1', order: 1 },
      { fromKey: 'O1', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C1', toKey: 'H2', order: 1 },
      { fromKey: 'C1', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Methoxymethane / Dimethyl Ether (CH₃OCH₃)',
  },
  {
    id: 'anhydride',
    name: 'Acid Anhydride',
    formula: '–COOC(=O)CH₃',
    classLabel: 'Carboxylic Anhydride',
    category: 'oxygen',
    polarity: 'Polar (Electrophilic)',
    hint: 'Two carbonyls bridged by an oxygen atom; potent acylating agent.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.85, 1.65, 0] },
      { key: 'O2', element: 'O', localPos: [3.05, -1.65, 0] },
      { key: 'C2', element: 'C', localPos: [4.85, -1.15, 0] },
      { key: 'O3', element: 'O', localPos: [5.45, 0.62, 0] },
      { key: 'C3', element: 'C', localPos: [6.15, -2.65, 0] },
      { key: 'H1', element: 'H', localPos: [7.55, -2.15, 0] },
      { key: 'H2', element: 'H', localPos: [5.95, -3.55, 1.2] },
      { key: 'H3', element: 'H', localPos: [5.95, -3.55, -1.2] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'O2', order: 1 },
      { fromKey: 'O2', toKey: 'C2', order: 1 },
      { fromKey: 'C2', toKey: 'O3', order: 2 },
      { fromKey: 'C2', toKey: 'C3', order: 1 },
      { fromKey: 'C3', toKey: 'H1', order: 1 },
      { fromKey: 'C3', toKey: 'H2', order: 1 },
      { fromKey: 'C3', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Acetic Anhydride ((CH₃CO)₂O)',
  },
  {
    id: 'peroxide',
    name: 'Peroxide',
    formula: '–O–OH',
    classLabel: 'Hydroperoxide / Peroxide',
    category: 'oxygen',
    polarity: 'Polar (Oxidant)',
    hint: 'Weak O–O single bond prone to homolytic cleavage into radicals.',
    attachBondOrder: 1,
    atoms: [
      { key: 'O1', element: 'O', localPos: [1.95, 0, 0] },
      { key: 'O2', element: 'O', localPos: [2.65, 1.88, 0] },
      { key: 'H1', element: 'H', localPos: [3.98, 1.48, 0.4] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'O1', order: 1 },
      { fromKey: 'O1', toKey: 'O2', order: 1 },
      { fromKey: 'O2', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Methyl Hydroperoxide (CH₃OOH)',
  },
  {
    id: 'epoxide',
    name: 'Epoxide (Oxirane)',
    formula: 'C₂H₃O (ring)',
    classLabel: 'Cyclic Ether (Strained)',
    category: 'oxygen',
    polarity: 'Polar (Ring-Strained)',
    hint: '3-membered C–O–C ring with ~60° angle strain; opens readily with nucleophiles.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'C2', element: 'C', localPos: [3.85, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.90, 1.65, 0] },
      { key: 'H1', element: 'H', localPos: [1.45, -1.25, 0.7] },
      { key: 'H2', element: 'H', localPos: [4.45, -1.15, 0.85] },
      { key: 'H3', element: 'H', localPos: [4.45, -1.15, -0.85] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'C2', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 1 },
      { fromKey: 'C2', toKey: 'O1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C2', toKey: 'H2', order: 1 },
      { fromKey: 'C2', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Oxirane / Ethylene Oxide (C₂H₄O)',
    standaloneCustom: {
      atoms: [
        { key: 'C1', element: 'C', pos: [-0.95, -0.55, 0] },
        { key: 'C2', element: 'C', pos: [0.95, -0.55, 0] },
        { key: 'O1', element: 'O', pos: [0, 1.15, 0] },
        { key: 'H1', element: 'H', pos: [-1.75, -1.15, 1.05] },
        { key: 'H2', element: 'H', pos: [-1.75, -1.15, -1.05] },
        { key: 'H3', element: 'H', pos: [1.75, -1.15, 1.05] },
        { key: 'H4', element: 'H', pos: [1.75, -1.15, -1.05] },
      ],
      bonds: [
        { from: 'C1', to: 'C2', order: 1 },
        { from: 'C1', to: 'O1', order: 1 },
        { from: 'C2', to: 'O1', order: 1 },
        { from: 'C1', to: 'H1', order: 1 },
        { from: 'C1', to: 'H2', order: 1 },
        { from: 'C2', to: 'H3', order: 1 },
        { from: 'C2', to: 'H4', order: 1 },
      ],
      selectKey: 'O1',
    },
  },

  // ================= NITROGEN FUNCTIONAL GROUPS =================
  {
    id: 'amine',
    name: 'Amino (1° Amine)',
    formula: '–NH₂',
    classLabel: 'Primary Amine',
    category: 'nitrogen',
    polarity: 'Polar (Basic & Nucleophilic)',
    hint: 'Trigonal pyramidal sp³ Nitrogen with reactive basic lone pair.',
    attachBondOrder: 1,
    atoms: [
      { key: 'N1', element: 'N', localPos: [1.95, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.45, 1.18, 0.72] },
      { key: 'H2', element: 'H', localPos: [2.45, -1.18, 0.72] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'N1', order: 1 },
      { fromKey: 'N1', toKey: 'H1', order: 1 },
      { fromKey: 'N1', toKey: 'H2', order: 1 },
    ],
    standaloneName: 'Methanamine / Methylamine (CH₃NH₂)',
  },
  {
    id: 'ammonium',
    name: 'Ammonium Cation',
    formula: '–NH₃⁺',
    classLabel: 'Alkylammonium Ion',
    category: 'nitrogen',
    polarity: 'Ionic / Cationic',
    hint: 'Protonated tetrahedral Nitrogen (+1 charge); lacks lone pair.',
    attachBondOrder: 1,
    atoms: [
      { key: 'N1', element: 'N', localPos: [1.95, 0, 0], formalCharge: 1 },
      { key: 'H1', element: 'H', localPos: [2.45, 1.37, 0] },
      { key: 'H2', element: 'H', localPos: [2.45, -0.68, 1.19] },
      { key: 'H3', element: 'H', localPos: [2.45, -0.68, -1.19] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'N1', order: 1 },
      { fromKey: 'N1', toKey: 'H1', order: 1 },
      { fromKey: 'N1', toKey: 'H2', order: 1 },
      { fromKey: 'N1', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Methylammonium Ion (CH₃NH₃⁺)',
  },
  {
    id: 'amide',
    name: 'Amide (Carboxamide)',
    formula: '–CONH₂',
    classLabel: 'Amide / Peptide',
    category: 'nitrogen',
    polarity: 'Strongly Polar (Resonant)',
    hint: 'n → π* peptide resonance restricts C–N rotation and keeps N planar sp².',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.89, 1.63, 0] },
      { key: 'N1', element: 'N', localPos: [2.98, -1.77, 0] },
      { key: 'H1', element: 'H', localPos: [4.43, -1.77, 0] },
      { key: 'H2', element: 'H', localPos: [2.25, -3.03, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'N1', order: 1 },
      { fromKey: 'N1', toKey: 'H1', order: 1 },
      { fromKey: 'N1', toKey: 'H2', order: 1 },
    ],
    standaloneName: 'Ethanamide / Acetamide (CH₃CONH₂)',
  },
  {
    id: 'nitrile',
    name: 'Nitrile (Cyano)',
    formula: '–C≡N',
    classLabel: 'Nitrile',
    category: 'nitrogen',
    polarity: 'Strongly Polar (Linear sp)',
    hint: 'Linear sp triple bond (180°); strongly electron-withdrawing.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'N1', element: 'N', localPos: [3.67, 0, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'N1', order: 3 },
    ],
    standaloneName: 'Ethanenitrile / Acetonitrile (CH₃CN)',
  },
  {
    id: 'nitro',
    name: 'Nitro Group',
    formula: '–NO₂',
    classLabel: 'Nitro Compound (Resonant)',
    category: 'nitrogen',
    polarity: 'Strongly Polar (–M / –I)',
    hint: 'Equivalent resonance shares negative charge across both Oxygens (N⁺).',
    attachBondOrder: 1,
    atoms: [
      { key: 'N1', element: 'N', localPos: [1.95, 0, 0], formalCharge: 1 },
      { key: 'O1', element: 'O', localPos: [2.90, 1.64, 0] },
      { key: 'O2', element: 'O', localPos: [2.90, -1.64, 0], formalCharge: -1 },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'N1', order: 1 },
      { fromKey: 'N1', toKey: 'O1', order: 2 },
      { fromKey: 'N1', toKey: 'O2', order: 1 },
    ],
    standaloneName: 'Nitromethane (CH₃NO₂)',
  },
  {
    id: 'imine',
    name: 'Imine (Schiff Base)',
    formula: '–CH=NH',
    classLabel: 'Imine',
    category: 'nitrogen',
    polarity: 'Polar (C=N)',
    hint: 'Nitrogen analogue of an aldehyde/ketone formed from carbonyl + 1° amine.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'N1', element: 'N', localPos: [2.89, 1.63, 0] },
      { key: 'H1', element: 'H', localPos: [2.72, -1.33, 0] },
      { key: 'H2', element: 'H', localPos: [4.35, 1.63, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'N1', order: 2 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'N1', toKey: 'H2', order: 1 },
    ],
    standaloneName: 'Ethanimine (CH₃CH=NH)',
  },
  {
    id: 'azide',
    name: 'Azide',
    formula: '–N=N⁺=N⁻',
    classLabel: 'Organic Azide',
    category: 'nitrogen',
    polarity: 'Polar (1,3-Dipole)',
    hint: 'Linear dipolar 3-nitrogen chain used in Staudinger & click chemistry.',
    attachBondOrder: 1,
    atoms: [
      { key: 'N1', element: 'N', localPos: [1.95, 0, 0] },
      { key: 'N2', element: 'N', localPos: [3.83, 0, 0], formalCharge: 1 },
      { key: 'N3', element: 'N', localPos: [5.71, 0, 0], formalCharge: -1 },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'N1', order: 1 },
      { fromKey: 'N1', toKey: 'N2', order: 2 },
      { fromKey: 'N2', toKey: 'N3', order: 2 },
    ],
    standaloneName: 'Azidomethane / Methyl Azide (CH₃N₃)',
  },
  {
    id: 'isocyanate',
    name: 'Isocyanate',
    formula: '–N=C=O',
    classLabel: 'Isocyanate',
    category: 'nitrogen',
    polarity: 'Polar (Cumulated)',
    hint: 'Cumulated heterocumulene (N=C=O) precursor to polyurethanes.',
    attachBondOrder: 1,
    atoms: [
      { key: 'N1', element: 'N', localPos: [1.95, 0, 0] },
      { key: 'C1', element: 'C', localPos: [3.83, 0, 0] },
      { key: 'O1', element: 'O', localPos: [5.71, 0, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'N1', order: 1 },
      { fromKey: 'N1', toKey: 'C1', order: 2 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
    ],
    standaloneName: 'Methyl Isocyanate (CH₃NCO)',
  },

  // ================= HYDROCARBON & AROMATIC GROUPS =================
  {
    id: 'methyl',
    name: 'Methyl (Alkyl)',
    formula: '–CH₃',
    classLabel: 'Alkyl Group',
    category: 'hydrocarbon',
    polarity: 'Nonpolar (+I Donor)',
    hint: 'Tetrahedral sp³ carbon substituent with mild +I electron donation.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [2.05, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.56, 1.45, 0] },
      { key: 'H2', element: 'H', localPos: [2.56, -0.72, 1.26] },
      { key: 'H3', element: 'H', localPos: [2.56, -0.72, -1.26] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C1', toKey: 'H2', order: 1 },
      { fromKey: 'C1', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Ethane (C₂H₆)',
  },
  {
    id: 'ethyl',
    name: 'Ethyl',
    formula: '–CH₂CH₃',
    classLabel: 'Alkyl Group',
    category: 'hydrocarbon',
    polarity: 'Nonpolar (+I Donor)',
    hint: 'Two-carbon saturated alkyl chain extending hydrocarbon backbone.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [2.05, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.56, -0.72, 1.26] },
      { key: 'H2', element: 'H', localPos: [2.56, -0.72, -1.26] },
      { key: 'C2', element: 'C', localPos: [2.73, 1.93, 0] },
      { key: 'H3', element: 'H', localPos: [4.27, 1.93, 0] },
      { key: 'H4', element: 'H', localPos: [2.22, 2.65, 1.26] },
      { key: 'H5', element: 'H', localPos: [2.22, 2.65, -1.26] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C1', toKey: 'H2', order: 1 },
      { fromKey: 'C1', toKey: 'C2', order: 1 },
      { fromKey: 'C2', toKey: 'H3', order: 1 },
      { fromKey: 'C2', toKey: 'H4', order: 1 },
      { fromKey: 'C2', toKey: 'H5', order: 1 },
    ],
    standaloneName: 'Propane (C₃H₈)',
  },
  {
    id: 'alkene_vinyl',
    name: 'Alkene (Vinyl)',
    formula: '–CH=CH₂',
    classLabel: 'Alkene (C=C)',
    category: 'hydrocarbon',
    polarity: 'Nonpolar (π Nucleophile)',
    hint: 'Planar sp² C=C double bond (1σ + 1π); undergoes electrophilic addition.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.72, -1.33, 0] },
      { key: 'C2', element: 'C', localPos: [2.89, 1.63, 0] },
      { key: 'H2', element: 'H', localPos: [2.12, 2.96, 0] },
      { key: 'H3', element: 'H', localPos: [4.43, 1.63, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C1', toKey: 'C2', order: 2 },
      { fromKey: 'C2', toKey: 'H2', order: 1 },
      { fromKey: 'C2', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Ethene / Ethylene (C₂H₄)',
    standaloneCustom: {
      atoms: [
        { key: 'C1', element: 'C', pos: [-0.94, 0, 0] },
        { key: 'C2', element: 'C', pos: [0.94, 0, 0] },
        { key: 'H1', element: 'H', pos: [-1.71, 1.33, 0] },
        { key: 'H2', element: 'H', pos: [-1.71, -1.33, 0] },
        { key: 'H3', element: 'H', pos: [1.71, 1.33, 0] },
        { key: 'H4', element: 'H', pos: [1.71, -1.33, 0] },
      ],
      bonds: [
        { from: 'C1', to: 'C2', order: 2 },
        { from: 'C1', to: 'H1', order: 1 },
        { from: 'C1', to: 'H2', order: 1 },
        { from: 'C2', to: 'H3', order: 1 },
        { from: 'C2', to: 'H4', order: 1 },
      ],
      selectKey: 'C1',
    },
  },
  {
    id: 'alkyne_ethynyl',
    name: 'Alkyne (Ethynyl)',
    formula: '–C≡CH',
    classLabel: 'Alkyne (C≡C)',
    category: 'hydrocarbon',
    polarity: 'Nonpolar (Linear sp)',
    hint: 'Linear sp triple bond (1σ + 2π); terminal C–H is weakly acidic (pKa ~25).',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'C2', element: 'C', localPos: [3.67, 0, 0] },
      { key: 'H1', element: 'H', localPos: [5.21, 0, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'C2', order: 3 },
      { fromKey: 'C2', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Ethyne / Acetylene (C₂H₂)',
    standaloneCustom: {
      atoms: [
        { key: 'C1', element: 'C', pos: [-0.86, 0, 0] },
        { key: 'C2', element: 'C', pos: [0.86, 0, 0] },
        { key: 'H1', element: 'H', pos: [-2.40, 0, 0] },
        { key: 'H2', element: 'H', pos: [2.40, 0, 0] },
      ],
      bonds: [
        { from: 'C1', to: 'C2', order: 3 },
        { from: 'C1', to: 'H1', order: 1 },
        { from: 'C2', to: 'H2', order: 1 },
      ],
      selectKey: 'C1',
    },
  },
  {
    id: 'phenyl',
    name: 'Phenyl (Arene Ring)',
    formula: '–C₆H₅',
    classLabel: 'Aromatic Ring (6π)',
    category: 'hydrocarbon',
    polarity: 'Nonpolar (Aromatic)',
    hint: 'Planar Hückel 4n+2 (6π) aromatic benzene ring with Kekulé resonance.',
    attachBondOrder: 1,
    atoms: PHENYL_TEMPLATE.atoms,
    bonds: PHENYL_TEMPLATE.bonds,
    standaloneName: 'Benzene (C₆H₆)',
    standaloneCustom: (() => {
      const rC = 1.96;
      const rH = 3.50;
      const atoms: Array<{ key: string; element: string; pos: [number, number, number] }> = [];
      const bonds: Array<{ from: string; to: string; order: 1 | 2 | 3 }> = [];
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3;
        atoms.push({
          key: `C${k + 1}`,
          element: 'C',
          pos: [Number((rC * Math.cos(ang)).toFixed(4)), Number((rC * Math.sin(ang)).toFixed(4)), 0],
        });
        atoms.push({
          key: `H${k + 1}`,
          element: 'H',
          pos: [Number((rH * Math.cos(ang)).toFixed(4)), Number((rH * Math.sin(ang)).toFixed(4)), 0],
        });
        bonds.push({
          from: `C${k + 1}`,
          to: `C${((k + 1) % 6) + 1}`,
          order: k % 2 === 0 ? 2 : 1,
        });
        bonds.push({
          from: `C${k + 1}`,
          to: `H${k + 1}`,
          order: 1,
        });
      }
      return { atoms, bonds, selectKey: 'C1' };
    })(),
  },
  {
    id: 'cyclopropyl',
    name: 'Cyclopropyl Ring',
    formula: '–C₃H₅',
    classLabel: 'Cycloalkane',
    category: 'hydrocarbon',
    polarity: 'Nonpolar (Ring Strain)',
    hint: '3-membered carbon ring with 60° angle strain ("banana bonds").',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [2.05, 0, 0] },
      { key: 'C2', element: 'C', localPos: [3.82, 1.02, 0] },
      { key: 'C3', element: 'C', localPos: [3.82, -1.02, 0] },
      { key: 'H1', element: 'H', localPos: [1.55, 0, 1.35] },
      { key: 'H2', element: 'H', localPos: [4.45, 1.65, 1.1] },
      { key: 'H3', element: 'H', localPos: [4.45, 1.65, -1.1] },
      { key: 'H4', element: 'H', localPos: [4.45, -1.65, 1.1] },
      { key: 'H5', element: 'H', localPos: [4.45, -1.65, -1.1] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'C2', order: 1 },
      { fromKey: 'C2', toKey: 'C3', order: 1 },
      { fromKey: 'C3', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C2', toKey: 'H2', order: 1 },
      { fromKey: 'C2', toKey: 'H3', order: 1 },
      { fromKey: 'C3', toKey: 'H4', order: 1 },
      { fromKey: 'C3', toKey: 'H5', order: 1 },
    ],
    standaloneName: 'Cyclopropane (C₃H₆)',
    standaloneCustom: {
      atoms: [
        { key: 'C1', element: 'C', pos: [0, 1.18, 0] },
        { key: 'C2', element: 'C', pos: [-1.02, -0.59, 0] },
        { key: 'C3', element: 'C', pos: [1.02, -0.59, 0] },
        { key: 'H1', element: 'H', pos: [0, 2.05, 1.18] },
        { key: 'H2', element: 'H', pos: [0, 2.05, -1.18] },
        { key: 'H3', element: 'H', pos: [-1.78, -1.05, 1.18] },
        { key: 'H4', element: 'H', pos: [-1.78, -1.05, -1.18] },
        { key: 'H5', element: 'H', pos: [1.78, -1.05, 1.18] },
        { key: 'H6', element: 'H', pos: [1.78, -1.05, -1.18] },
      ],
      bonds: [
        { from: 'C1', to: 'C2', order: 1 },
        { from: 'C2', to: 'C3', order: 1 },
        { from: 'C3', to: 'C1', order: 1 },
        { from: 'C1', to: 'H1', order: 1 },
        { from: 'C1', to: 'H2', order: 1 },
        { from: 'C2', to: 'H3', order: 1 },
        { from: 'C2', to: 'H4', order: 1 },
        { from: 'C3', to: 'H5', order: 1 },
        { from: 'C3', to: 'H6', order: 1 },
      ],
      selectKey: 'C1',
    },
  },

  // ================= SULFUR & PHOSPHORUS GROUPS =================
  {
    id: 'thiol',
    name: 'Thiol (Sulfhydryl)',
    formula: '–SH',
    classLabel: 'Thiol',
    category: 'sulfur_phosphorus',
    polarity: 'Moderately Polar',
    hint: 'Sulfur analogue of alcohol; more acidic & forms disulfide bridges.',
    attachBondOrder: 1,
    atoms: [
      { key: 'S1', element: 'S', localPos: [2.05, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.25, 1.46, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'S1', order: 1 },
      { fromKey: 'S1', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Methanethiol (CH₃SH)',
  },
  {
    id: 'sulfide',
    name: 'Sulfide (Thioether)',
    formula: '–SCH₃',
    classLabel: 'Thioether',
    category: 'sulfur_phosphorus',
    polarity: 'Moderately Polar',
    hint: 'Soft nucleophilic sulfur bridge (R–S–R′); present in methionine.',
    attachBondOrder: 1,
    atoms: [
      { key: 'S1', element: 'S', localPos: [2.05, 0, 0] },
      { key: 'C1', element: 'C', localPos: [2.45, 2.01, 0] },
      { key: 'H1', element: 'H', localPos: [1.95, 2.75, 1.24] },
      { key: 'H2', element: 'H', localPos: [1.95, 2.75, -1.24] },
      { key: 'H3', element: 'H', localPos: [3.95, 2.15, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'S1', order: 1 },
      { fromKey: 'S1', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C1', toKey: 'H2', order: 1 },
      { fromKey: 'C1', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Dimethyl Sulfide (CH₃SCH₃)',
  },
  {
    id: 'disulfide',
    name: 'Disulfide',
    formula: '–S–SH',
    classLabel: 'Disulfide Bridge',
    category: 'sulfur_phosphorus',
    polarity: 'Weakly Polar',
    hint: 'Covalent S–S linkage stabilizing folded protein tertiary structures.',
    attachBondOrder: 1,
    atoms: [
      { key: 'S1', element: 'S', localPos: [2.05, 0, 0] },
      { key: 'S2', element: 'S', localPos: [2.65, 1.95, 0] },
      { key: 'H1', element: 'H', localPos: [3.95, 1.65, 0.7] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'S1', order: 1 },
      { fromKey: 'S1', toKey: 'S2', order: 1 },
      { fromKey: 'S2', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Methyldisulfane (CH₃SSH)',
  },
  {
    id: 'sulfoxide',
    name: 'Sulfoxide',
    formula: '–S(=O)CH₃',
    classLabel: 'Sulfoxide',
    category: 'sulfur_phosphorus',
    polarity: 'Strongly Polar (Aprotic)',
    hint: 'Pyramidal chiral S=O center; classic polar aprotic solvent motif (DMSO).',
    attachBondOrder: 1,
    atoms: [
      { key: 'S1', element: 'S', localPos: [2.05, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.65, 1.75, 0.5] },
      { key: 'C1', element: 'C', localPos: [2.65, -1.35, -1.25] },
      { key: 'H1', element: 'H', localPos: [4.15, -1.35, -1.25] },
      { key: 'H2', element: 'H', localPos: [2.25, -2.65, -0.55] },
      { key: 'H3', element: 'H', localPos: [2.25, -1.45, -2.68] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'S1', order: 1 },
      { fromKey: 'S1', toKey: 'O1', order: 2 },
      { fromKey: 'S1', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'H1', order: 1 },
      { fromKey: 'C1', toKey: 'H2', order: 1 },
      { fromKey: 'C1', toKey: 'H3', order: 1 },
    ],
    standaloneName: 'Dimethyl Sulfoxide / DMSO ((CH₃)₂SO)',
  },
  {
    id: 'sulfonic_acid',
    name: 'Sulfonic Acid',
    formula: '–SO₃H',
    classLabel: 'Sulfonic Acid (Strong)',
    category: 'sulfur_phosphorus',
    polarity: 'Strongly Polar (Strong Acid)',
    hint: 'Very strong organic acid (pKa < 0); sulfonate conjugate base has 3-way resonance.',
    attachBondOrder: 1,
    atoms: [
      { key: 'S1', element: 'S', localPos: [2.05, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.65, 1.78, 0] },
      { key: 'O2', element: 'O', localPos: [2.65, -0.89, 1.54] },
      { key: 'O3', element: 'O', localPos: [2.65, -0.89, -1.54] },
      { key: 'H1', element: 'H', localPos: [4.05, -0.89, -1.54] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'S1', order: 1 },
      { fromKey: 'S1', toKey: 'O1', order: 2 },
      { fromKey: 'S1', toKey: 'O2', order: 2 },
      { fromKey: 'S1', toKey: 'O3', order: 1 },
      { fromKey: 'O3', toKey: 'H1', order: 1 },
    ],
    standaloneName: 'Methanesulfonic Acid (CH₃SO₃H)',
  },
  {
    id: 'phosphine',
    name: 'Phosphine',
    formula: '–PH₂',
    classLabel: 'Organophosphine',
    category: 'sulfur_phosphorus',
    polarity: 'Weakly Polar',
    hint: 'Soft Phosphorus Lewis base / ligand; larger & less basic than amines.',
    attachBondOrder: 1,
    atoms: [
      { key: 'P1', element: 'P', localPos: [2.05, 0, 0] },
      { key: 'H1', element: 'H', localPos: [2.35, 1.25, 0.72] },
      { key: 'H2', element: 'H', localPos: [2.35, -1.25, 0.72] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'P1', order: 1 },
      { fromKey: 'P1', toKey: 'H1', order: 1 },
      { fromKey: 'P1', toKey: 'H2', order: 1 },
    ],
    standaloneName: 'Methylphosphane (CH₃PH₂)',
  },
  {
    id: 'phosphate',
    name: 'Phosphate Ester',
    formula: '–OPO₃H₂',
    classLabel: 'Phosphate (ATP / DNA)',
    category: 'sulfur_phosphorus',
    polarity: 'Strongly Polar (H-Bonding)',
    hint: 'Essential biological energy & nucleic acid backbone linkage (P=O).',
    attachBondOrder: 1,
    atoms: [
      { key: 'O1', element: 'O', localPos: [1.95, 0, 0] },
      { key: 'P1', element: 'P', localPos: [3.85, 0.72, 0] },
      { key: 'O2', element: 'O', localPos: [4.45, 2.48, 0] },
      { key: 'O3', element: 'O', localPos: [4.55, -0.35, 1.54] },
      { key: 'H1', element: 'H', localPos: [5.95, -0.35, 1.54] },
      { key: 'O4', element: 'O', localPos: [4.55, -0.35, -1.54] },
      { key: 'H2', element: 'H', localPos: [5.95, -0.35, -1.54] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'O1', order: 1 },
      { fromKey: 'O1', toKey: 'P1', order: 1 },
      { fromKey: 'P1', toKey: 'O2', order: 2 },
      { fromKey: 'P1', toKey: 'O3', order: 1 },
      { fromKey: 'O3', toKey: 'H1', order: 1 },
      { fromKey: 'P1', toKey: 'O4', order: 1 },
      { fromKey: 'O4', toKey: 'H2', order: 1 },
    ],
    standaloneName: 'Methyl Dihydrogen Phosphate (CH₃OPO₃H₂)',
  },

  // ================= HALOGENS & ACYL HALIDES =================
  {
    id: 'fluoro',
    name: 'Fluoro (Fluoride)',
    formula: '–F',
    classLabel: 'Organofluoride',
    category: 'halogen',
    polarity: 'Polar (Strong –I)',
    hint: 'Most electronegative element; very strong C–F bond & –I inductive pull.',
    attachBondOrder: 1,
    atoms: [{ key: 'F1', element: 'F', localPos: [1.95, 0, 0] }],
    bonds: [{ fromKey: '__PARENT__', toKey: 'F1', order: 1 }],
    standaloneName: 'Fluoromethane (CH₃F)',
  },
  {
    id: 'chloro',
    name: 'Chloro (Chloride)',
    formula: '–Cl',
    classLabel: 'Organochloride',
    category: 'halogen',
    polarity: 'Moderately Polar',
    hint: 'Good leaving group in SN2/E2 substitutions and eliminations.',
    attachBondOrder: 1,
    atoms: [{ key: 'Cl1', element: 'Cl', localPos: [2.05, 0, 0] }],
    bonds: [{ fromKey: '__PARENT__', toKey: 'Cl1', order: 1 }],
    standaloneName: 'Chloromethane (CH₃Cl)',
  },
  {
    id: 'bromo',
    name: 'Bromo (Bromide)',
    formula: '–Br',
    classLabel: 'Organobromide',
    category: 'halogen',
    polarity: 'Moderately Polar',
    hint: 'Excellent leaving group and classic Grignard / radical substrate.',
    attachBondOrder: 1,
    atoms: [{ key: 'Br1', element: 'Br', localPos: [2.05, 0, 0] }],
    bonds: [{ fromKey: '__PARENT__', toKey: 'Br1', order: 1 }],
    standaloneName: 'Bromomethane (CH₃Br)',
  },
  {
    id: 'iodo',
    name: 'Iodo (Iodide)',
    formula: '–I',
    classLabel: 'Organoiodide',
    category: 'halogen',
    polarity: 'Weakly Polar',
    hint: 'Weakest C–X bond and fastest leaving group among halogens.',
    attachBondOrder: 1,
    atoms: [{ key: 'I1', element: 'I', localPos: [2.05, 0, 0] }],
    bonds: [{ fromKey: '__PARENT__', toKey: 'I1', order: 1 }],
    standaloneName: 'Iodomethane (CH₃I)',
  },
  {
    id: 'acyl_chloride',
    name: 'Acyl Chloride',
    formula: '–COCl',
    classLabel: 'Acyl Halide',
    category: 'halogen',
    polarity: 'Polar (Highly Reactive)',
    hint: 'Most reactive carboxylic acid derivative for nucleophilic acyl substitution.',
    attachBondOrder: 1,
    atoms: [
      { key: 'C1', element: 'C', localPos: [1.95, 0, 0] },
      { key: 'O1', element: 'O', localPos: [2.89, 1.63, 0] },
      { key: 'Cl1', element: 'Cl', localPos: [2.98, -1.77, 0] },
    ],
    bonds: [
      { fromKey: '__PARENT__', toKey: 'C1', order: 1 },
      { fromKey: 'C1', toKey: 'O1', order: 2 },
      { fromKey: 'C1', toKey: 'Cl1', order: 1 },
    ],
    standaloneName: 'Ethanoyl / Acetyl Chloride (CH₃COCl)',
  },
];

function nextUniqueAtomId(element: string, usedIds: Set<string>): string {
  let n = 1;
  while (usedIds.has(`${element}${n}`)) {
    n++;
  }
  const id = `${element}${n}`;
  usedIds.add(id);
  return id;
}

function nextUniqueBondId(prefix: string): string {
  return `b_fg_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface FunctionalGroupBuildResult {
  ok: boolean;
  atoms: MolecularAtom[];
  bonds: MolecularBond[];
  focusAtomId: string | null;
  substitutedH?: boolean;
  reason?: string;
}

/**
 * Attaches a functional group to `parentAtom` (automatically substituting 1 bonded H if
 * parentAtom is saturated with hydrogens, or using an open VSEPR bond slot).
 */
export function attachFunctionalGroupToAtom(
  group: FunctionalGroupDef,
  parentAtom: MolecularAtom,
  currentAtoms: MolecularAtom[],
  currentBonds: MolecularBond[]
): FunctionalGroupBuildResult {
  const spec = getMaxBondsForAtom(parentAtom.element, parentAtom.formalCharge || 0);
  const connectedBonds = currentBonds.filter(
    (b) => b.from === parentAtom.id || b.to === parentAtom.id
  );
  const currentBondOrder = connectedBonds.reduce((s, b) => s + b.order, 0);

  let workingAtoms = currentAtoms.map((a) => ({
    ...a,
    position: [...a.position] as [number, number, number],
  }));
  let workingBonds = currentBonds.map((b) => ({ ...b }));
  let substitutedH = false;
  let attachDir: THREE.Vector3;

  if (currentBondOrder + group.attachBondOrder <= spec.maxBonds) {
    // Open bond slot exists on parentAtom
    const nextPos = getNextVSEPRBondPosition(parentAtom, workingAtoms, workingBonds, 1.95);
    attachDir = new THREE.Vector3(...nextPos)
      .sub(new THREE.Vector3(...parentAtom.position))
      .normalize();
  } else {
    // Check if parentAtom has a terminal H we can replace cleanly
    const hBond = connectedBonds.find((b) => {
      if (b.order !== 1) return false;
      const otherId = b.from === parentAtom.id ? b.to : b.from;
      const otherAtom = workingAtoms.find((a) => a.id === otherId);
      const otherDegree = workingBonds.filter((x) => x.from === otherId || x.to === otherId).length;
      return otherAtom?.element === 'H' && otherDegree === 1;
    });

    if (!hBond || group.attachBondOrder !== 1) {
      return {
        ok: false,
        atoms: currentAtoms,
        bonds: currentBonds,
        focusAtomId: parentAtom.id,
        reason: `${formatAtomWithCharge(parentAtom.element, parentAtom.formalCharge || 0)} (${parentAtom.id}) is at full bonding capacity (${currentBondOrder}/${spec.maxBonds}) with no H to substitute. Select another atom or switch to "New Molecule".`,
      };
    }

    const removedHId = hBond.from === parentAtom.id ? hBond.to : hBond.from;
    const removedHAtom = workingAtoms.find((a) => a.id === removedHId)!;
    attachDir = new THREE.Vector3(...removedHAtom.position)
      .sub(new THREE.Vector3(...parentAtom.position))
      .normalize();

    workingAtoms = workingAtoms.filter((a) => a.id !== removedHId);
    workingBonds = workingBonds.filter((b) => b.id !== hBond.id);
    substitutedH = true;
  }

  if (attachDir.lengthSq() < 0.001) {
    attachDir.set(1, 0, 0);
  }

  // Rotate template +X axis to align along attachDir
  const xAxis = new THREE.Vector3(1, 0, 0);
  const quat = new THREE.Quaternion();
  if (attachDir.dot(xAxis) < -0.999) {
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  } else {
    quat.setFromUnitVectors(xAxis, attachDir);
  }

  const parentPos = new THREE.Vector3(...parentAtom.position);
  const usedIds = new Set(workingAtoms.map((a) => a.id));
  const keyToId = new Map<string, string>();
  keyToId.set('__PARENT__', parentAtom.id);

  group.atoms.forEach((tmpl) => {
    const newId = nextUniqueAtomId(tmpl.element, usedIds);
    keyToId.set(tmpl.key, newId);

    const worldPos = new THREE.Vector3(...tmpl.localPos).applyQuaternion(quat).add(parentPos);
    workingAtoms.push({
      id: newId,
      element: tmpl.element,
      position: [
        Number(worldPos.x.toFixed(4)),
        Number(worldPos.y.toFixed(4)),
        Number(worldPos.z.toFixed(4)),
      ],
      ...(tmpl.formalCharge ? { formalCharge: tmpl.formalCharge } : {}),
    });
  });

  group.bonds.forEach((b, idx) => {
    const fromId = keyToId.get(b.fromKey);
    const toId = keyToId.get(b.toKey);
    if (!fromId || !toId) return;
    workingBonds.push({
      id: nextUniqueBondId(`${group.id}_${idx}`),
      from: fromId,
      to: toId,
      order: b.order,
    });
  });

  const firstKey = group.atoms[0]?.key;
  const focusAtomId = (firstKey && keyToId.get(firstKey)) || parentAtom.id;
  const fixedAtoms = fixAllBondAngles(workingAtoms, workingBonds);

  return {
    ok: true,
    atoms: fixedAtoms,
    bonds: workingBonds,
    focusAtomId,
    substitutedH,
  };
}

/**
 * Creates a clean standalone representative molecule showcasing the chosen functional group.
 */
export function buildStandaloneFunctionalGroup(
  group: FunctionalGroupDef
): FunctionalGroupBuildResult {
  if (group.standaloneCustom) {
    const custom = group.standaloneCustom;
    const atoms: MolecularAtom[] = custom.atoms.map((a) => ({
      id: a.key,
      element: a.element,
      position: [...a.pos] as [number, number, number],
      ...(a.formalCharge ? { formalCharge: a.formalCharge } : {}),
    }));
    const bonds: MolecularBond[] = custom.bonds.map((b, idx) => ({
      id: nextUniqueBondId(`custom_${group.id}_${idx}`),
      from: b.from,
      to: b.to,
      order: b.order,
    }));
    return {
      ok: true,
      atoms: fixAllBondAngles(atoms, bonds),
      bonds,
      focusAtomId: custom.selectKey,
    };
  }

  // Standard Methyl scaffold (CH3–) with open bond along +X
  const baseC: MolecularAtom = { id: 'C1', element: 'C', position: [0, 0, 0] };
  const baseAtoms: MolecularAtom[] = [
    baseC,
    { id: 'H1', element: 'H', position: [-0.51, 1.45, 0] },
    { id: 'H2', element: 'H', position: [-0.51, -0.72, 1.26] },
    { id: 'H3', element: 'H', position: [-0.51, -0.72, -1.26] },
  ];
  const baseBonds: MolecularBond[] = [
    { id: nextUniqueBondId('scaffold_h1'), from: 'C1', to: 'H1', order: 1 },
    { id: nextUniqueBondId('scaffold_h2'), from: 'C1', to: 'H2', order: 1 },
    { id: nextUniqueBondId('scaffold_h3'), from: 'C1', to: 'H3', order: 1 },
  ];

  return attachFunctionalGroupToAtom(group, baseC, baseAtoms, baseBonds);
}
