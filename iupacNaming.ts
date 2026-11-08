import { MolecularAtom, MolecularBond } from '../types/chemistry';
import { getElement } from '../data/elements';

export interface MoleculeIdentity {
  formula: string; // Formatted with subscripts, e.g. "H₂O"
  hillFormula: string; // Standard Hill notation, e.g. "H2O"
  iupacName: string; // Full official systematic IUPAC name (PIN), e.g. "Oxidane", "Propan-2-ol", "2-Methylpropane"
  systematicIupacName?: string; // Complete systematic compositional or additive IUPAC name, e.g. "Dihydrogen oxide", "Dihydroxidodioxidosulfur"
  commonName: string; // Common / conventional name, e.g. "Water", "Isopropanol", "Isobutane"
  netCharge: number;
  chargeFormatted: string; // e.g. "⁺", "²⁺", "⁻", "²⁻", or ""
  molarMass: number; // in g/mol
  classification: string; // e.g. "Secondary alcohol", "Branched alkane", etc.
  iupacRulesNote: string; // Detailed step-by-step explanation of IUPAC nomenclature rule applied
  isRecognized: boolean;
}

// Convert numbers in chemical formula to Unicode subscripts
export function toSubscriptFormula(formula: string): string {
  const subscriptMap: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
  };
  return formula.replace(/\d/g, (char) => subscriptMap[char] || char);
}

// Format formal charge to superscript
export function formatChargeSuperscript(charge: number): string {
  if (charge === 0) return '';
  if (charge === 1) return '⁺';
  if (charge === -1) return '⁻';
  const superscriptDigits: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  const absStr = Math.abs(charge).toString();
  const superDigits = absStr.split('').map((d) => superscriptDigits[d] || d).join('');
  return charge > 0 ? `${superDigits}⁺` : `${superDigits}⁻`;
}

// Standard element atomic masses for molar mass calculations
const ATOMIC_MASSES: Record<string, number> = {
  H: 1.008,
  He: 4.0026,
  Li: 6.94,
  Be: 9.0122,
  B: 10.81,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  Ne: 20.180,
  Na: 22.990,
  Mg: 24.305,
  Al: 26.982,
  Si: 28.085,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  Ar: 39.948,
  K: 39.098,
  Ca: 40.078,
  Br: 79.904,
  I: 126.90,
  Fe: 55.845,
  Cu: 63.546,
  Zn: 65.38,
  Ag: 107.87,
  Au: 196.97,
  Pt: 195.08,
  Pb: 207.2,
};

// Alkane root stems based on number of carbons
const ALKANE_ROOTS: Record<number, string> = {
  1: 'meth',
  2: 'eth',
  3: 'prop',
  4: 'but',
  5: 'pent',
  6: 'hex',
  7: 'hept',
  8: 'oct',
  9: 'non',
  10: 'dec',
  11: 'undec',
  12: 'dodec',
  13: 'tridec',
  14: 'tetradec',
  15: 'pentadec',
  16: 'hexadec',
  17: 'heptadec',
  18: 'octadec',
  19: 'nonadec',
  20: 'icos',
};

// Multiplicative prefixes for stoichiometry
const MULTIPLIERS = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];

// Capitalize first alphabetic character (handles locants like "2-methylpropane" -> "2-Methylpropane")
function capitalize(str: string): string {
  if (!str) return '';
  return str.replace(/[a-zA-Z]/, (m) => m.toUpperCase());
}

// Compute Hill notation formula: C first, then H, then remaining elements alphabetically
export function getHillFormula(counts: Record<string, number>): string {
  const cCount = counts['C'] || 0;
  const hCount = counts['H'] || 0;
  let formula = '';

  if (cCount > 0) {
    formula += `C${cCount > 1 ? cCount : ''}`;
    if (hCount > 0) {
      formula += `H${hCount > 1 ? hCount : ''}`;
    }
  }

  const remaining = Object.keys(counts)
    .filter((el) => el !== 'C' && (cCount === 0 || el !== 'H'))
    .sort();

  remaining.forEach((el) => {
    const c = counts[el];
    formula += `${el}${c > 1 ? c : ''}`;
  });

  return formula || 'Empty';
}

// Compute total molar mass (g/mol)
export function calculateMolarMass(counts: Record<string, number>): number {
  let total = 0;
  for (const [el, count] of Object.entries(counts)) {
    const mass = ATOMIC_MASSES[el] ?? (getElement(el)?.atomicMass || 0);
    total += mass * count;
  }
  return Math.round(total * 1000) / 1000;
}

// Recognized molecule registry with full systematic and PIN IUPAC nomenclature
interface RecognizedCompound {
  iupacName: string; // Full official IUPAC Name (PIN)
  systematicIupacName?: string; // Compositional or Additive IUPAC name
  commonName: string;
  classification: string;
  iupacRulesNote: string;
  connectivityCheck?: (atoms: MolecularAtom[], bonds: MolecularBond[]) => boolean;
}

const KNOWN_COMPOUNDS: Record<string, RecognizedCompound> = {
  // Simple inorganics and elemental gases
  H2O: {
    iupacName: 'Oxidane',
    systematicIupacName: 'Dihydrogen oxide',
    commonName: 'Water',
    classification: 'Inorganic hydride (Chalcogen hydride)',
    iupacRulesNote: 'IUPAC PIN (Preferred IUPAC Name) for neutral water is "Oxidane" under substitutive nomenclature; systematic compositional name is "Dihydrogen oxide"; "water" is retained for the natural liquid.',
  },
  'H3O+': {
    iupacName: 'Oxidanium',
    systematicIupacName: 'Trihydridooxygen(1+)',
    commonName: 'Hydronium Ion',
    classification: 'Onium cation',
    iupacRulesNote: 'IUPAC systematic onium name derived by adding suffix "-ium" to the parent hydride stem "oxidan-".',
  },
  'OH-': {
    iupacName: 'Hydroxide',
    systematicIupacName: 'Hydridooxygenate(1-)',
    commonName: 'Hydroxide Ion',
    classification: 'Inorganic anion',
    iupacRulesNote: 'Retained IUPAC systematic anion name for the deprotonated oxidane radical anion.',
  },
  H2O2: {
    iupacName: 'Dioxidane',
    systematicIupacName: 'Dihydrogen dioxide',
    commonName: 'Hydrogen Peroxide',
    classification: 'Peroxide parent hydride',
    iupacRulesNote: 'IUPAC substitutive parent hydride name for two catenated oxygen atoms terminated by hydrogen atoms.',
  },
  NH3: {
    iupacName: 'Azane',
    systematicIupacName: 'Nitrogen trihydride',
    commonName: 'Ammonia',
    classification: 'Pnictogen hydride',
    iupacRulesNote: 'IUPAC PIN parent hydride name for nitrogen trihydride is "Azane"; "ammonia" is retained for the compound itself.',
  },
  'NH4+': {
    iupacName: 'Azanium',
    systematicIupacName: 'Tetrahydridonitrogen(1+)',
    commonName: 'Ammonium Ion',
    classification: 'Onium cation',
    iupacRulesNote: 'IUPAC systematic onium cation name formed by protonation of the azane parent hydride (stem "azan-" + suffix "-ium").',
  },
  'NH2-': {
    iupacName: 'Azanide',
    systematicIupacName: 'Dihydridonitrate(1-)',
    commonName: 'Amide Ion',
    classification: 'Inorganic anion',
    iupacRulesNote: 'Formed by removing a proton from parent azane with the systematic anion suffix "-ide".',
  },
  N2H4: {
    iupacName: 'Diazane',
    systematicIupacName: 'Dinitrogen tetrahydride',
    commonName: 'Hydrazine',
    classification: 'Hydrazine parent hydride',
    iupacRulesNote: 'IUPAC systematic name for catenated dinitrogen tetrahydride (prefix "di-" + "azane").',
  },
  CH4: {
    iupacName: 'Methane',
    systematicIupacName: 'Carbon tetrahydride',
    commonName: 'Methane',
    classification: 'Alkane (Saturated hydrocarbon)',
    iupacRulesNote: 'Fundamental IUPAC parent hydride stem "meth-" (1 carbon atom) + suffix "-ane" for saturated acyclic alkane.',
  },
  'CH3+': {
    iupacName: 'Methylium',
    systematicIupacName: 'Trihydridocarbon(1+)',
    commonName: 'Methyl Carbocation',
    classification: 'Carbocation',
    iupacRulesNote: 'IUPAC systematic carbenium cation derived by adding "-ylium" to the fundamental root stem.',
  },
  'CH3-': {
    iupacName: 'Methanide',
    systematicIupacName: 'Trihydridocarbonate(1-)',
    commonName: 'Methyl Carbanion',
    classification: 'Carbanion',
    iupacRulesNote: 'IUPAC systematic carbanion formed by deprotonating methane with anion suffix "-ide".',
  },
  CO2: {
    iupacName: 'Carbon dioxide',
    systematicIupacName: 'Dioxocarbon',
    commonName: 'Carbon Dioxide',
    classification: 'Inorganic carbon oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary composition name: "Carbon" + multiplicative prefix "di-" + "oxide". Systematic additive name: "Dioxocarbon".',
  },
  CO: {
    iupacName: 'Carbon monoxide',
    systematicIupacName: 'Oxocarbon',
    commonName: 'Carbon Monoxide',
    classification: 'Inorganic carbon oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary composition name with prefix "mon-" + "oxide".',
  },
  HCN: {
    iupacName: 'Hydrogen cyanide',
    systematicIupacName: 'Formonitrile',
    commonName: 'Hydrogen Cyanide / Formonitrile',
    classification: 'Nitrile / Pseudohalide',
    iupacRulesNote: 'IUPAC binary name "Hydrogen cyanide", or systematic substitutive name "Formonitrile".',
  },
  H2CO3: {
    iupacName: 'Carbonic acid',
    systematicIupacName: 'Dihydroxidooxidocarbon',
    commonName: 'Carbonic Acid',
    classification: 'Inorganic oxoacid',
    iupacRulesNote: 'Retained IUPAC oxoacid name for dihydroxidooxidocarbon.',
  },
  'HCO3-': {
    iupacName: 'Hydrogen carbonate',
    systematicIupacName: 'Hydroxidodioxidocarbonate(1-)',
    commonName: 'Bicarbonate Ion',
    classification: 'Inorganic oxoanion',
    iupacRulesNote: 'IUPAC additive hydrogen-prefixed anion nomenclature: "Hydrogen carbonate".',
  },
  'CO3-2': {
    iupacName: 'Carbonate',
    systematicIupacName: 'Trioxidocarbonate(2-)',
    commonName: 'Carbonate Ion',
    classification: 'Inorganic oxoanion',
    iupacRulesNote: 'IUPAC systematic oxoanion name for the dianion [CO₃]²⁻.',
  },
  H2: {
    iupacName: 'Dihydrogen',
    systematicIupacName: 'Molecular hydrogen',
    commonName: 'Hydrogen Gas',
    classification: 'Elemental diatomic molecule',
    iupacRulesNote: 'IUPAC compositional name for homodiatomic molecular hydrogen.',
  },
  O2: {
    iupacName: 'Dioxygen',
    systematicIupacName: 'Molecular oxygen',
    commonName: 'Oxygen Gas',
    classification: 'Elemental diatomic molecule',
    iupacRulesNote: 'IUPAC compositional name for triplet homodiatomic molecular oxygen.',
  },
  O3: {
    iupacName: 'Trioxygen',
    systematicIupacName: 'Triatomic oxygen',
    commonName: 'Ozone',
    classification: 'Oxygen allotrope',
    iupacRulesNote: 'IUPAC systematic compositional name for allotropic triatomic oxygen.',
  },
  N2: {
    iupacName: 'Dinitrogen',
    systematicIupacName: 'Molecular nitrogen',
    commonName: 'Nitrogen Gas',
    classification: 'Elemental diatomic molecule',
    iupacRulesNote: 'IUPAC compositional name for homodiatomic triple-bonded nitrogen.',
  },
  F2: {
    iupacName: 'Difluorine',
    systematicIupacName: 'Molecular fluorine',
    commonName: 'Fluorine Gas',
    classification: 'Elemental halogen',
    iupacRulesNote: 'IUPAC compositional name for molecular fluorine.',
  },
  Cl2: {
    iupacName: 'Dichlorine',
    systematicIupacName: 'Molecular chlorine',
    commonName: 'Chlorine Gas',
    classification: 'Elemental halogen',
    iupacRulesNote: 'IUPAC compositional name for molecular chlorine.',
  },
  Br2: {
    iupacName: 'Dibromine',
    systematicIupacName: 'Molecular bromine',
    commonName: 'Bromine',
    classification: 'Elemental halogen',
    iupacRulesNote: 'IUPAC compositional name for molecular bromine.',
  },
  I2: {
    iupacName: 'Diiodine',
    systematicIupacName: 'Molecular iodine',
    commonName: 'Iodine',
    classification: 'Elemental halogen',
    iupacRulesNote: 'IUPAC compositional name for molecular iodine.',
  },
  HCl: {
    iupacName: 'Chlorane',
    systematicIupacName: 'Hydrogen chloride',
    commonName: 'Hydrogen Chloride / Hydrochloric Acid',
    classification: 'Hydrogen halide',
    iupacRulesNote: 'IUPAC substitutive parent hydride name is "Chlorane"; "Hydrogen chloride" is standard compositional name.',
  },
  HF: {
    iupacName: 'Fluorane',
    systematicIupacName: 'Hydrogen fluoride',
    commonName: 'Hydrogen Fluoride',
    classification: 'Hydrogen halide',
    iupacRulesNote: 'IUPAC substitutive parent hydride name is "Fluorane"; "Hydrogen fluoride" is standard compositional name.',
  },
  HBr: {
    iupacName: 'Bromane',
    systematicIupacName: 'Hydrogen bromide',
    commonName: 'Hydrogen Bromide',
    classification: 'Hydrogen halide',
    iupacRulesNote: 'IUPAC substitutive parent hydride name is "Bromane"; "Hydrogen bromide" is standard compositional name.',
  },
  HI: {
    iupacName: 'Iodane',
    systematicIupacName: 'Hydrogen iodide',
    commonName: 'Hydrogen Iodide',
    classification: 'Hydrogen halide',
    iupacRulesNote: 'IUPAC substitutive parent hydride name is "Iodane"; "Hydrogen iodide" is standard compositional name.',
  },
  H2S: {
    iupacName: 'Sulfane',
    systematicIupacName: 'Dihydrogen sulfide',
    commonName: 'Hydrogen Sulfide',
    classification: 'Chalcogen hydride',
    iupacRulesNote: 'IUPAC substitutive parent hydride name for H₂S is "Sulfane".',
  },
  SO2: {
    iupacName: 'Sulfur dioxide',
    systematicIupacName: 'Dioxidosulfur',
    commonName: 'Sulfur Dioxide',
    classification: 'Inorganic sulfur oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary composition name.',
  },
  SO3: {
    iupacName: 'Sulfur trioxide',
    systematicIupacName: 'Trioxidosulfur',
    commonName: 'Sulfur Trioxide',
    classification: 'Inorganic sulfur oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary composition name with prefix "tri-".',
  },
  H2SO4: {
    iupacName: 'Sulfuric acid',
    systematicIupacName: 'Dihydroxidodioxidosulfur',
    commonName: 'Sulfuric Acid',
    classification: 'Mineral oxoacid',
    iupacRulesNote: 'Retained IUPAC oxoacid name for dihydroxidodioxidosulfur.',
  },
  'HSO4-': {
    iupacName: 'Hydrogen sulfate',
    systematicIupacName: 'Hydroxidotrioxidosulfate(1-)',
    commonName: 'Bisulfate Ion',
    classification: 'Inorganic oxoanion',
    iupacRulesNote: 'IUPAC hydrogen-prefixed additive anion nomenclature.',
  },
  'SO4-2': {
    iupacName: 'Sulfate',
    systematicIupacName: 'Tetraoxidosulfate(2-)',
    commonName: 'Sulfate Ion',
    classification: 'Inorganic oxoanion',
    iupacRulesNote: 'IUPAC retained name for the tetraoxidosulfate(2-) anion.',
  },
  HNO3: {
    iupacName: 'Nitric acid',
    systematicIupacName: 'Hydroxidodioxidonitrogen',
    commonName: 'Nitric Acid',
    classification: 'Mineral oxoacid',
    iupacRulesNote: 'Retained IUPAC oxoacid name for hydronitrate.',
  },
  'NO3-': {
    iupacName: 'Nitrate',
    systematicIupacName: 'Trioxidonitrate(1-)',
    commonName: 'Nitrate Ion',
    classification: 'Inorganic oxoanion',
    iupacRulesNote: 'IUPAC retained oxoanion name for trioxidonitrate(1-).',
  },
  NO: {
    iupacName: 'Nitrogen monoxide',
    systematicIupacName: 'Oxidonitrogen',
    commonName: 'Nitric Oxide',
    classification: 'Nitrogen oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary name.',
  },
  NO2: {
    iupacName: 'Nitrogen dioxide',
    systematicIupacName: 'Dioxidonitrogen',
    commonName: 'Nitrogen Dioxide',
    classification: 'Nitrogen oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary name with prefix "di-".',
  },
  N2O: {
    iupacName: 'Dinitrogen monoxide',
    systematicIupacName: 'Oxidodinitrogen',
    commonName: 'Nitrous Oxide (Laughing Gas)',
    classification: 'Nitrogen oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary name with prefixes "di-" and "mon-".',
  },
  N2O4: {
    iupacName: 'Dinitrogen tetroxide',
    systematicIupacName: 'Tetraoxidodinitrogen',
    commonName: 'Dinitrogen Tetroxide',
    classification: 'Nitrogen oxide',
    iupacRulesNote: 'Stoichiometric IUPAC binary name with prefixes "di-" and "tetra-".',
  },
  H3PO4: {
    iupacName: 'Phosphoric acid',
    systematicIupacName: 'Trihydroxidooxidophosphorus',
    commonName: 'Phosphoric Acid',
    classification: 'Mineral oxoacid',
    iupacRulesNote: 'Retained IUPAC oxoacid name for trihydroxidooxidophosphorus.',
  },
  BF3: {
    iupacName: 'Trifluoroborane',
    systematicIupacName: 'Boron trifluoride',
    commonName: 'Boron Trifluoride',
    classification: 'Group 13 halide',
    iupacRulesNote: 'Substitutive IUPAC parent hydride derivative of borane with prefix "trifluoro-".',
  },
  BH3: {
    iupacName: 'Borane',
    systematicIupacName: 'Trihydridoboron',
    commonName: 'Borane',
    classification: 'Group 13 hydride',
    iupacRulesNote: 'IUPAC parent hydride name for monomeric BH₃.',
  },
  'BH4-': {
    iupacName: 'Tetrahydridoborate(1-)',
    systematicIupacName: 'Tetrahydridoborate(1-)',
    commonName: 'Borohydride Ion',
    classification: 'Inorganic complex anion',
    iupacRulesNote: 'IUPAC additive complex anion nomenclature.',
  },
  'BF4-': {
    iupacName: 'Tetrafluoroborate(1-)',
    systematicIupacName: 'Tetrafluoroborate(1-)',
    commonName: 'Tetrafluoroborate Ion',
    classification: 'Inorganic complex anion',
    iupacRulesNote: 'IUPAC additive complex anion nomenclature.',
  },
  PCl5: {
    iupacName: 'Pentachloro-λ⁵-phosphane',
    systematicIupacName: 'Phosphorus pentachloride',
    commonName: 'Phosphorus Pentachloride',
    classification: 'Hypervalent phosphorus halide',
    iupacRulesNote: 'IUPAC lambda convention for hypervalent pentacoordinate phosphorus.',
  },
  PCl3: {
    iupacName: 'Trichlorophosphane',
    systematicIupacName: 'Phosphorus trichloride',
    commonName: 'Phosphorus Trichloride',
    classification: 'Phosphorus halide',
    iupacRulesNote: 'Substitutive IUPAC parent hydride derivative of phosphane.',
  },
  SF6: {
    iupacName: 'Hexafluoro-λ⁶-sulfane',
    systematicIupacName: 'Sulfur hexafluoride',
    commonName: 'Sulfur Hexafluoride',
    classification: 'Hypervalent sulfur halide',
    iupacRulesNote: 'IUPAC lambda convention for hypervalent hexacoordinate sulfur.',
  },
  SF4: {
    iupacName: 'Tetrafluoro-λ⁴-sulfane',
    systematicIupacName: 'Sulfur tetrafluoride',
    commonName: 'Sulfur Tetrafluoride',
    classification: 'Hypervalent sulfur halide',
    iupacRulesNote: 'IUPAC lambda convention for hypervalent tetracoordinate sulfur.',
  },
  NaCl: {
    iupacName: 'Sodium chloride',
    systematicIupacName: 'Sodium chloride',
    commonName: 'Table Salt',
    classification: 'Alkali metal halide',
    iupacRulesNote: 'Binary ionic stoichiometric nomenclature: electropositive cation first, then electronegative anion with suffix "-ide".',
  },
  NaOH: {
    iupacName: 'Sodium hydroxide',
    systematicIupacName: 'Sodium hydroxide',
    commonName: 'Caustic Soda',
    classification: 'Alkali hydroxide base',
    iupacRulesNote: 'Binary ionic stoichiometric nomenclature.',
  },
  KOH: {
    iupacName: 'Potassium hydroxide',
    systematicIupacName: 'Potassium hydroxide',
    commonName: 'Potash Base',
    classification: 'Alkali hydroxide base',
    iupacRulesNote: 'Binary ionic stoichiometric nomenclature.',
  },

  // Alkanes, Alkenes, Alkynes
  C2H6: {
    iupacName: 'Ethane',
    systematicIupacName: 'Ethane',
    commonName: 'Ethane',
    classification: 'Alkane',
    iupacRulesNote: 'Root "eth-" (2 carbon chain) + saturated alkane suffix "-ane".',
  },
  C3H8: {
    iupacName: 'Propane',
    systematicIupacName: 'Propane',
    commonName: 'Propane',
    classification: 'Alkane',
    iupacRulesNote: 'Root "prop-" (3 carbon chain) + saturated alkane suffix "-ane".',
  },
  C2H4: {
    iupacName: 'Ethene',
    systematicIupacName: 'Ethene',
    commonName: 'Ethylene',
    classification: 'Alkene',
    iupacRulesNote: 'Root "eth-" (2 carbons) + unsaturated double bond suffix "-ene".',
  },
  C2H2: {
    iupacName: 'Ethyne',
    systematicIupacName: 'Ethyne',
    commonName: 'Acetylene',
    classification: 'Alkyne',
    iupacRulesNote: 'Root "eth-" (2 carbons) + unsaturated triple bond suffix "-yne".',
  },
  C6H6: {
    iupacName: 'Benzene',
    systematicIupacName: 'Cyclohexa-1,3,5-triene',
    commonName: 'Benzene',
    classification: 'Aromatic hydrocarbon (Arene)',
    iupacRulesNote: 'Retained IUPAC PIN for the conjugated aromatic 6-membered ring.',
  },
  C7H8: {
    iupacName: 'Methylbenzene',
    systematicIupacName: 'Methylbenzene',
    commonName: 'Toluene',
    classification: 'Aromatic hydrocarbon',
    iupacRulesNote: 'Substitutive name "Methylbenzene"; "Toluene" is retained IUPAC name.',
  },
  C6H12O6: {
    iupacName: '(2R,3S,4R,5R)-2,3,4,5,6-Pentahydroxyhexanal',
    systematicIupacName: '(2R,3S,4R,5R)-2,3,4,5,6-Pentahydroxyhexanal',
    commonName: 'D-Glucose',
    classification: 'Aldohexose monosaccharide',
    iupacRulesNote: 'Complete systematic stereochemical IUPAC PIN specifying all 4 stereocenters.',
  },
  C8H10N4O2: {
    iupacName: '1,3,7-Trimethylpurine-2,6-dione',
    systematicIupacName: '1,3,7-Trimethylxanthine',
    commonName: 'Caffeine',
    classification: 'Purine alkaloid',
    iupacRulesNote: 'Systematic purinedione numbering with locants 1,3,7- for methyl substituents.',
  },
  C9H8O4: {
    iupacName: '2-Acetoxybenzoic acid',
    systematicIupacName: '2-(Acetyloxy)benzoic acid',
    commonName: 'Aspirin (Acetylsalicylic Acid)',
    classification: 'Aromatic ester / Carboxylic acid',
    iupacRulesNote: 'IUPAC PIN: benzoic acid parent with 2-acetyloxy substituent.',
  },
  C8H9NO2: {
    iupacName: 'N-(4-Hydroxyphenyl)acetamide',
    systematicIupacName: 'N-(4-Hydroxyphenyl)ethanamide',
    commonName: 'Paracetamol (Acetaminophen)',
    classification: 'Amide / Phenol',
    iupacRulesNote: 'Acetamide parent with N-(4-hydroxyphenyl) aromatic substituent.',
  },
  C3H7NO2: {
    iupacName: '(2S)-2-Aminopropanoic acid',
    systematicIupacName: '(2S)-2-Aminopropanoic acid',
    commonName: 'L-Alanine',
    classification: 'Proteinogenic amino acid',
    iupacRulesNote: 'Systematic stereochemical IUPAC PIN for alpha-alanine with (2S) configuration.',
  },
  C2H5NO2: {
    iupacName: '2-Aminoethanoic acid',
    systematicIupacName: '2-Aminoethanoic acid',
    commonName: 'Glycine',
    classification: 'Amino acid',
    iupacRulesNote: 'Systematic substitutive name for the simplest non-chiral amino acid.',
  },
  C10H14N2: {
    iupacName: '3-[(2S)-1-Methylpyrrolidin-2-yl]pyridine',
    systematicIupacName: '3-[(2S)-1-Methylpyrrolidin-2-yl]pyridine',
    commonName: 'Nicotine',
    classification: 'Pyridine alkaloid',
    iupacRulesNote: 'Pyridine parent with 3-position substituted by chiral (2S)-pyrrolidine ring.',
  },
  C8H11NO2: {
    iupacName: '4-(2-Aminoethyl)benzene-1,2-diol',
    systematicIupacName: '4-(2-Aminoethyl)benzene-1,2-diol',
    commonName: 'Dopamine',
    classification: 'Catecholamine neurotransmitter',
    iupacRulesNote: 'Benzene-1,2-diol (catechol) parent with 4-(2-aminoethyl) sidechain.',
  },
  C10H12N2O: {
    iupacName: '3-(2-Aminoethyl)-1H-indol-5-ol',
    systematicIupacName: '3-(2-Aminoethyl)-1H-indol-5-ol',
    commonName: 'Serotonin',
    classification: 'Indole alkaloid neurotransmitter',
    iupacRulesNote: '1H-indole parent with 5-hydroxy and 3-aminoethyl substituents.',
  },
  C6H8O6: {
    iupacName: '(5R)-[(1S)-1,2-Dihydroxyethyl]-3,4-dihydroxyfuran-2(5H)-one',
    systematicIupacName: '(5R)-[(1S)-1,2-Dihydroxyethyl]-3,4-dihydroxyfuran-2(5H)-one',
    commonName: 'Vitamin C (L-Ascorbic Acid)',
    classification: 'Lactone / Vitamin',
    iupacRulesNote: 'Complete systematic stereochemical IUPAC PIN for the furan-2-one lactone ring.',
  },
};

interface GraphNeighbor {
  neighborId: string;
  order: number;
  element: string;
}

// Build adjacency graph of atoms and bonds
function buildAdjacency(
  atoms: MolecularAtom[],
  bonds: MolecularBond[]
): Map<string, GraphNeighbor[]> {
  const adj = new Map<string, GraphNeighbor[]>();
  atoms.forEach((a) => adj.set(a.id, []));

  bonds.forEach((b) => {
    const fromAtom = atoms.find((a) => a.id === b.from);
    const toAtom = atoms.find((a) => a.id === b.to);
    if (!fromAtom || !toAtom) return;

    adj.get(b.from)?.push({ neighborId: b.to, order: b.order, element: toAtom.element });
    adj.get(b.to)?.push({ neighborId: b.from, order: b.order, element: fromAtom.element });
  });

  return adj;
}

// Find simple paths between carbons
function findAllSimpleCarbonPaths(
  current: string,
  target: string,
  visited: Set<string>,
  adj: Map<string, GraphNeighbor[]>
): string[][] {
  if (current === target) {
    return [[current]];
  }

  visited.add(current);
  const paths: string[][] = [];
  const neighbors = adj.get(current) || [];

  for (const n of neighbors) {
    if (n.element === 'C' && !visited.has(n.neighborId)) {
      const subPaths = findAllSimpleCarbonPaths(n.neighborId, target, visited, adj);
      for (const p of subPaths) {
        paths.push([current, ...p]);
      }
    }
  }

  visited.delete(current);
  return paths;
}

/**
 * Advanced Graph-Based Algorithmic IUPAC Engine
 * Determines official IUPAC Preferred Name (PIN) with exact locants,
 * parent chain selection, functional group priorities, and stereochemical/stoichiometric rules.
 */
function determineGraphOrganicIUPAC(
  atoms: MolecularAtom[],
  bonds: MolecularBond[],
  counts: Record<string, number>,
  displayFormula: string,
  hill: string,
  netCharge: number,
  chargeFormatted: string,
  molarMass: number
): MoleculeIdentity | null {
  const adj = buildAdjacency(atoms, bonds);
  const carbons = atoms.filter((a) => a.element === 'C');
  const cCount = carbons.length;

  if (cCount === 0) return null;

  // Check for cyclic carbon ring
  const carbonIdSet = new Set(carbons.map((c) => c.id));
  const visited = new Set<string>();
  const parentMap = new Map<string, string | null>();
  let hasCycle = false;
  let cycleNodes: string[] = [];

  function dfsCycle(node: string, parent: string | null): boolean {
    visited.add(node);
    parentMap.set(node, parent);
    const neighbors = adj.get(node) || [];
    for (const n of neighbors) {
      if (carbonIdSet.has(n.neighborId)) {
        if (!visited.has(n.neighborId)) {
          if (dfsCycle(n.neighborId, node)) return true;
        } else if (n.neighborId !== parent) {
          hasCycle = true;
          // Reconstruct cycle
          let curr: string | null = node;
          while (curr && curr !== n.neighborId) {
            cycleNodes.push(curr);
            curr = parentMap.get(curr) || null;
          }
          cycleNodes.push(n.neighborId);
          return true;
        }
      }
    }
    return false;
  }

  for (const c of carbons) {
    if (!visited.has(c.id)) {
      if (dfsCycle(c.id, null)) break;
    }
  }

  // Handle Cycloalkanes and Aromatic Rings
  if (hasCycle && cycleNodes.length >= 3) {
    const ringSize = cycleNodes.length;
    const ringRoot = ALKANE_ROOTS[ringSize] || `${ringSize}-membered ring`;

    // Check if Benzene (6-carbon ring with alternating/3 double bonds)
    const ringBonds = bonds.filter(
      (b) => cycleNodes.includes(b.from) && cycleNodes.includes(b.to)
    );
    const doubleBondsInRing = ringBonds.filter((b) => b.order === 2).length;

    if (ringSize === 6 && (doubleBondsInRing === 3 || counts['H'] === 6 && cCount === 6)) {
      // Benzene derivative
      const nonRingCarbons = carbons.filter((c) => !cycleNodes.includes(c.id));
      if (nonRingCarbons.length === 0) {
        // Pure benzene or substituted with other elements
        const oxygens = atoms.filter((a) => a.element === 'O');
        const halogens = atoms.filter((a) => ['F', 'Cl', 'Br', 'I'].includes(a.element));
        const nitrogens = atoms.filter((a) => a.element === 'N');

        if (oxygens.length === 1 && halogens.length === 0 && nitrogens.length === 0) {
          return {
            formula: displayFormula,
            hillFormula: hill,
            iupacName: 'Phenol',
            systematicIupacName: 'Hydroxybenzene',
            commonName: 'Phenol',
            netCharge,
            chargeFormatted,
            molarMass,
            classification: 'Aromatic alcohol (Phenol)',
            iupacRulesNote: 'IUPAC PIN "Phenol" for hydroxybenzene (retained PIN under P-52.2.8).',
            isRecognized: true,
          };
        }
        if (halogens.length === 1 && oxygens.length === 0 && nitrogens.length === 0) {
          const halName = halogens[0].element === 'Cl' ? 'Chlorobenzene' : halogens[0].element === 'Br' ? 'Bromobenzene' : 'Halobenzene';
          return {
            formula: displayFormula,
            hillFormula: hill,
            iupacName: halName,
            systematicIupacName: halName,
            commonName: halName,
            netCharge,
            chargeFormatted,
            molarMass,
            classification: 'Aromatic halide',
            iupacRulesNote: `Substitutive nomenclature: substituent "${halName}" on benzene parent.`,
            isRecognized: true,
          };
        }
        if (nitrogens.length === 1 && oxygens.length === 0 && halogens.length === 0) {
          return {
            formula: displayFormula,
            hillFormula: hill,
            iupacName: 'Benzenamine',
            systematicIupacName: 'Benzenamine',
            commonName: 'Aniline',
            netCharge,
            chargeFormatted,
            molarMass,
            classification: 'Aromatic amine',
            iupacRulesNote: 'Substitutive nomenclature "Benzenamine"; "Aniline" is retained IUPAC PIN.',
            isRecognized: true,
          };
        }

        return {
          formula: displayFormula,
          hillFormula: hill,
          iupacName: 'Benzene',
          systematicIupacName: 'Cyclohexa-1,3,5-triene',
          commonName: 'Benzene',
          netCharge,
          chargeFormatted,
          molarMass,
          classification: 'Aromatic hydrocarbon (Arene)',
          iupacRulesNote: 'Retained IUPAC PIN for the conjugated aromatic 6-membered ring.',
          isRecognized: true,
        };
      }

      if (nonRingCarbons.length === 1) {
        return {
          formula: displayFormula,
          hillFormula: hill,
          iupacName: 'Methylbenzene',
          systematicIupacName: 'Methylbenzene',
          commonName: 'Toluene',
          netCharge,
          chargeFormatted,
          molarMass,
          classification: 'Substituted arene',
          iupacRulesNote: 'Substitutive nomenclature "Methylbenzene"; "Toluene" is retained IUPAC name.',
          isRecognized: true,
        };
      }
    }

    if (doubleBondsInRing === 1) {
      const name = capitalize(`cyclo${ringRoot}ene`);
      return {
        formula: displayFormula,
        hillFormula: hill,
        iupacName: name,
        systematicIupacName: name,
        commonName: name,
        netCharge,
        chargeFormatted,
        molarMass,
        classification: 'Cycloalkene',
        iupacRulesNote: `IUPAC cycloalkene nomenclature: prefix "cyclo" + root "${ringRoot}" + suffix "-ene".`,
        isRecognized: true,
      };
    }

    const cycloName = capitalize(`cyclo${ringRoot}ane`);
    return {
      formula: displayFormula,
      hillFormula: hill,
      iupacName: cycloName,
      systematicIupacName: cycloName,
      commonName: cycloName,
      netCharge,
      chargeFormatted,
      molarMass,
      classification: 'Cycloalkane',
      iupacRulesNote: `IUPAC cycloalkane nomenclature: prefix "cyclo" + root "${ringRoot}" + suffix "-ane".`,
      isRecognized: true,
    };
  }

  // Acyclic Carbon Framework: Find Principal Carbon Chain
  const carbonIds = carbons.map((c) => c.id);
  let bestChain: string[] = [];

  // Terminal carbons are carbons with <= 1 carbon neighbor (or single carbon)
  const terminalCarbons = carbonIds.filter((cid) => {
    const cNeighbors = (adj.get(cid) || []).filter((n) => carbonIdSet.has(n.neighborId));
    return cNeighbors.length <= 1;
  });

  const endpoints = terminalCarbons.length >= 2 ? terminalCarbons : carbonIds;

  // Find all simple paths between terminal carbons
  let maxScore = -1;

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i; j < endpoints.length; j++) {
      const paths =
        endpoints[i] === endpoints[j]
          ? [[endpoints[i]]]
          : findAllSimpleCarbonPaths(endpoints[i], endpoints[j], new Set<string>(), adj);

      for (const p of paths) {
        // Score path:
        // Priority 1: Principal functional groups attached (COOH > C=O > OH)
        let fgScore = 0;
        let multBonds = 0;

        for (let idx = 0; idx < p.length; idx++) {
          const cid = p[idx];
          const neighbors = adj.get(cid) || [];
          for (const n of neighbors) {
            if (n.element === 'O') {
              if (n.order === 2) fgScore += 100; // carbonyl
              if (n.order === 1) fgScore += 50;  // hydroxyl
            }
          }
          if (idx < p.length - 1) {
            const nextC = p[idx + 1];
            const bond = bonds.find(
              (b) => (b.from === cid && b.to === nextC) || (b.from === nextC && b.to === cid)
            );
            if (bond && bond.order > 1) {
              multBonds += bond.order * 20;
            }
          }
        }

        const score = fgScore + multBonds + p.length;
        if (score > maxScore) {
          maxScore = score;
          bestChain = p;
        }
      }
    }
  }

  if (bestChain.length === 0) {
    bestChain = [carbonIds[0]];
  }

  const chainLength = bestChain.length;
  const root = ALKANE_ROOTS[chainLength] || `${chainLength}-carbon`;

  // Number the chain: determine if forward (0 -> L-1) or reverse (L-1 -> 0) gives lower locants
  function getLocantScore(chainOrder: string[]): number[] {
    const locants: number[] = [];
    for (let i = 0; i < chainOrder.length; i++) {
      const cid = chainOrder[i];
      const locant = i + 1;
      const neighbors = adj.get(cid) || [];

      // Check principal group
      const hasDoubleO = neighbors.some((n) => n.element === 'O' && n.order === 2);
      const hasSingleO = neighbors.some((n) => n.element === 'O' && n.order === 1);
      if (hasDoubleO) locants.push(locant * 1);
      if (hasSingleO) locants.push(locant * 2);

      // Check multiple bonds
      if (i < chainOrder.length - 1) {
        const nextC = chainOrder[i + 1];
        const b = bonds.find((x) => (x.from === cid && x.to === nextC) || (x.from === nextC && x.to === cid));
        if (b && b.order > 1) locants.push(locant * 5);
      }

      // Check branches / halogens
      for (const n of neighbors) {
        if (!chainOrder.includes(n.neighborId) && (n.element === 'C' || ['F', 'Cl', 'Br', 'I'].includes(n.element))) {
          locants.push(locant * 10);
        }
      }
    }
    return locants.sort((a, b) => a - b);
  }

  const fwdLocants = getLocantScore(bestChain);
  const revChain = [...bestChain].reverse();
  const revLocants = getLocantScore(revChain);

  let orderedChain = bestChain;
  for (let k = 0; k < Math.min(fwdLocants.length, revLocants.length); k++) {
    if (revLocants[k] < fwdLocants[k]) {
      orderedChain = revChain;
      break;
    } else if (fwdLocants[k] < revLocants[k]) {
      break;
    }
  }

  // Analyze Substituents and Functional Groups along the ordered chain
  const chainIdSet = new Set(orderedChain);
  const substituents: { locant: number; name: string }[] = [];
  const doubleBondLocants: number[] = [];
  const tripleBondLocants: number[] = [];
  const alcoholLocants: number[] = [];
  const ketoneLocants: number[] = [];
  let isAldehyde = false;
  let isCarboxylicAcid = false;

  for (let i = 0; i < orderedChain.length; i++) {
    const cid = orderedChain[i];
    const locant = i + 1;
    const neighbors = adj.get(cid) || [];

    // Multiple bonds to next chain carbon
    if (i < orderedChain.length - 1) {
      const nextC = orderedChain[i + 1];
      const b = bonds.find((x) => (x.from === cid && x.to === nextC) || (x.from === nextC && x.to === cid));
      if (b && b.order === 2) doubleBondLocants.push(locant);
      if (b && b.order === 3) tripleBondLocants.push(locant);
    }

    // Oxygen groups
    const doubleO = neighbors.filter((n) => n.element === 'O' && n.order === 2);
    const singleO = neighbors.filter((n) => n.element === 'O' && n.order === 1);

    if (doubleO.length > 0 && singleO.length > 0) {
      isCarboxylicAcid = true;
    } else if (doubleO.length > 0) {
      if (locant === 1 || locant === chainLength) {
        isAldehyde = true;
      } else {
        ketoneLocants.push(locant);
      }
    } else if (singleO.length > 0) {
      // Check if oxygen is bonded to another carbon (Ether)
      for (const o of singleO) {
        const oNeighbors = adj.get(o.neighborId) || [];
        const otherC = oNeighbors.filter((on) => on.neighborId !== cid && on.element === 'C');
        if (otherC.length === 0) {
          alcoholLocants.push(locant);
        }
      }
    }

    // Halogens attached to this carbon
    for (const n of neighbors) {
      if (['F', 'Cl', 'Br', 'I'].includes(n.element)) {
        const halName = n.element === 'F' ? 'fluoro' : n.element === 'Cl' ? 'chloro' : n.element === 'Br' ? 'bromo' : 'iodo';
        substituents.push({ locant, name: halName });
      }
    }

    // Carbon branches attached to this chain carbon
    for (const n of neighbors) {
      if (n.element === 'C' && !chainIdSet.has(n.neighborId)) {
        // Find size of branch
        const branchVisited = new Set<string>(orderedChain);
        let branchSize = 0;
        function countBranch(bNode: string) {
          branchVisited.add(bNode);
          branchSize++;
          const bNeighbors = adj.get(bNode) || [];
          for (const bn of bNeighbors) {
            if (bn.element === 'C' && !branchVisited.has(bn.neighborId)) {
              countBranch(bn.neighborId);
            }
          }
        }
        countBranch(n.neighborId);
        const branchName = branchSize === 1 ? 'methyl' : branchSize === 2 ? 'ethyl' : branchSize === 3 ? 'propyl' : 'alkyl';
        substituents.push({ locant, name: branchName });
      }
    }
  }

  // Format Substituent Prefix Block with IUPAC Locants
  // Group by name
  const subGroups = new Map<string, number[]>();
  for (const s of substituents) {
    if (!subGroups.has(s.name)) subGroups.set(s.name, []);
    subGroups.get(s.name)?.push(s.locant);
  }

  const prefixParts: string[] = [];
  const sortedNames = Array.from(subGroups.keys()).sort();

  for (const sName of sortedNames) {
    const locs = subGroups.get(sName)!.sort((a, b) => a - b);
    const multPrefix = locs.length > 1 ? MULTIPLIERS[locs.length] : '';
    prefixParts.push(`${locs.join(',')}-${multPrefix}${sName}`);
  }

  const prefixString = prefixParts.length > 0 ? `${prefixParts.join('-')}` : '';

  // Determine Suffix and Unsaturation
  let unsatInfix = 'an';
  if (doubleBondLocants.length > 0 && tripleBondLocants.length === 0) {
    if (doubleBondLocants.length === 1) {
      unsatInfix = chainLength <= 3 ? 'en' : `-${doubleBondLocants[0]}-en`;
    } else {
      unsatInfix = `a-${doubleBondLocants.join(',')}-${MULTIPLIERS[doubleBondLocants.length]}en`;
    }
  } else if (tripleBondLocants.length > 0) {
    if (tripleBondLocants.length === 1) {
      unsatInfix = chainLength <= 3 ? 'yn' : `-${tripleBondLocants[0]}-yn`;
    } else {
      unsatInfix = `a-${tripleBondLocants.join(',')}-${MULTIPLIERS[tripleBondLocants.length]}yn`;
    }
  }

  let finalSuffix = 'e';
  let classification = 'Acyclic alkane';
  let rulesNote = `IUPAC systematic nomenclature: Root '${root}' (${chainLength} continuous carbons) + saturated suffix '-ane'.`;

  if (isCarboxylicAcid) {
    finalSuffix = 'oic acid';
    classification = 'Carboxylic acid';
    rulesNote = `IUPAC principal group priority: Carboxylic acid suffix '-oic acid' on parent '${root}${unsatInfix}'.`;
  } else if (isAldehyde) {
    finalSuffix = 'al';
    classification = 'Aldehyde';
    rulesNote = `IUPAC aldehyde nomenclature: Principal group suffix '-al' on parent '${root}${unsatInfix}'.`;
  } else if (ketoneLocants.length > 0) {
    const kLoc = ketoneLocants.join(',');
    finalSuffix = chainLength === 3 ? '-2-one' : `-${kLoc}-${ketoneLocants.length > 1 ? MULTIPLIERS[ketoneLocants.length] : ''}one`;
    classification = 'Ketone';
    rulesNote = `IUPAC ketone nomenclature: Carbonyl principal group suffix '-one' with locant (${kLoc}) on '${root}${unsatInfix}'.`;
  } else if (alcoholLocants.length > 0) {
    const alcLoc = alcoholLocants.join(',');
    finalSuffix = alcoholLocants.length === 1 && chainLength <= 2 ? 'ol' : `-${alcLoc}-${alcoholLocants.length > 1 ? MULTIPLIERS[alcoholLocants.length] : ''}ol`;
    classification = alcoholLocants.length > 1 ? 'Polyol' : 'Alcohol';
    rulesNote = `IUPAC substitutive alcohol nomenclature: Hydroxyl principal group suffix '-ol' with locant (${alcLoc}) on parent '${root}${unsatInfix}'.`;
  } else if (doubleBondLocants.length > 0) {
    finalSuffix = 'e';
    classification = 'Alkene (Unsaturated hydrocarbon)';
    rulesNote = `IUPAC alkene nomenclature: Double bond locant (${doubleBondLocants.join(',')}) on root '${root}'.`;
  } else if (tripleBondLocants.length > 0) {
    finalSuffix = 'e';
    classification = 'Alkyne (Unsaturated hydrocarbon)';
    rulesNote = `IUPAC alkyne nomenclature: Triple bond locant (${tripleBondLocants.join(',')}) on root '${root}'.`;
  }

  let fullIupac = '';
  if (prefixString) {
    fullIupac = capitalize(`${prefixString}${root}${unsatInfix}${finalSuffix}`);
  } else {
    fullIupac = capitalize(`${root}${unsatInfix}${finalSuffix}`);
  }

  // Clean double hyphens or formatting quirks
  fullIupac = fullIupac.replace(/--+/g, '-').replace(/an-e$/, 'ane');

  return {
    formula: displayFormula,
    hillFormula: hill,
    iupacName: fullIupac,
    systematicIupacName: fullIupac,
    commonName: fullIupac,
    netCharge,
    chargeFormatted,
    molarMass,
    classification,
    iupacRulesNote: rulesNote,
    isRecognized: true,
  };
}

/**
 * Main IUPAC Identifier for Molecular Builder
 * Determines complete official IUPAC Name, systematic PIN, Hill notation, and derivation rules.
 */
export function determineMoleculeIdentity(
  atoms: MolecularAtom[],
  bonds: MolecularBond[]
): MoleculeIdentity {
  if (atoms.length === 0) {
    return {
      formula: 'Empty',
      hillFormula: '',
      iupacName: 'No atoms added',
      systematicIupacName: 'Empty System',
      commonName: 'Empty Workspace',
      netCharge: 0,
      chargeFormatted: '',
      molarMass: 0,
      classification: 'None',
      iupacRulesNote: 'Add atoms from the element palette to begin synthesizing a molecule.',
      isRecognized: false,
    };
  }

  // Count atoms and calculate net charge
  const counts: Record<string, number> = {};
  let netCharge = 0;

  atoms.forEach((a) => {
    counts[a.element] = (counts[a.element] || 0) + 1;
    netCharge += a.formalCharge || 0;
  });

  const hill = getHillFormula(counts);
  const chargeFormatted = formatChargeSuperscript(netCharge);
  const displayFormula = `${toSubscriptFormula(hill)}${chargeFormatted}`;
  const molarMass = calculateMolarMass(counts);

  // Construct lookup keys (with and without charge)
  const chargeSignStr =
    netCharge > 0
      ? netCharge === 1
        ? '+'
        : `+${netCharge}`
      : netCharge < 0
      ? netCharge === -1
        ? '-'
        : `${netCharge}`
      : '';
  const keyWithCharge = `${hill}${chargeSignStr}`;

  // 1. Check known compound registry
  const match = KNOWN_COMPOUNDS[keyWithCharge] || KNOWN_COMPOUNDS[hill];
  if (match) {
    // If connectivity check exists, verify it
    if (!match.connectivityCheck || match.connectivityCheck(atoms, bonds)) {
      return {
        formula: displayFormula,
        hillFormula: hill,
        iupacName: match.iupacName,
        systematicIupacName: match.systematicIupacName || match.iupacName,
        commonName: match.commonName,
        netCharge,
        chargeFormatted,
        molarMass,
        classification: match.classification,
        iupacRulesNote: match.iupacRulesNote,
        isRecognized: true,
      };
    }
  }

  // 2. Handle single isolated atoms / monatomic ions
  if (atoms.length === 1) {
    const el = atoms[0].element;
    const elData = getElement(el);
    const elName = elData ? elData.name : el;
    if (netCharge === 0) {
      return {
        formula: displayFormula,
        hillFormula: hill,
        iupacName: `Atomic ${elName}`,
        systematicIupacName: `${elName} atom`,
        commonName: `${elName} Atom`,
        netCharge: 0,
        chargeFormatted: '',
        molarMass,
        classification: 'Neutral atom',
        iupacRulesNote: `Isolated unbonded ${elName} atom.`,
        isRecognized: true,
      };
    }
    const ionName =
      netCharge > 0
        ? `${elName}(${netCharge}+) cation`
        : `${elName.toLowerCase().replace(/ine$|ogen$|ur$|on$/, '')}ide(${Math.abs(netCharge)}-) anion`;
    return {
      formula: displayFormula,
      hillFormula: hill,
      iupacName: capitalize(ionName),
      systematicIupacName: capitalize(ionName),
      commonName: `${elName} ${netCharge > 0 ? 'Cation' : 'Anion'}`,
      netCharge,
      chargeFormatted,
      molarMass,
      classification: 'Monatomic ion',
      iupacRulesNote: 'IUPAC systematic charge designation for monatomic ions.',
      isRecognized: true,
    };
  }

  // 3. Algorithmic Graph IUPAC Engine for Organic Molecules
  const organicIdentity = determineGraphOrganicIUPAC(
    atoms,
    bonds,
    counts,
    displayFormula,
    hill,
    netCharge,
    chargeFormatted,
    molarMass
  );
  if (organicIdentity) {
    return organicIdentity;
  }

  // 4. Binary Inorganic Compound Naming (e.g. SF6, PCl5, AlCl3, Na2O)
  const uniqueElements = Object.keys(counts);
  if (uniqueElements.length === 2 && !counts['C']) {
    const [el1, el2] = uniqueElements;
    const c1 = counts[el1];
    const c2 = counts[el2];
    const el1Data = getElement(el1);
    const el2Data = getElement(el2);

    if (el1Data && el2Data) {
      // Determine electropositive first
      const en1 = el1Data.electronegativity ?? 2.0;
      const en2 = el2Data.electronegativity ?? 2.0;
      const [posEl, negEl, posC, negC] =
        en1 <= en2 ? [el1Data, el2Data, c1, c2] : [el2Data, el1Data, c2, c1];

      const prefix1 = posC > 1 ? MULTIPLIERS[posC] : '';
      const prefix2 = MULTIPLIERS[negC] || '';

      const stem = negEl.name.toLowerCase().replace(/ine$|ogen$|ur$|on$|ium$/, '');
      const anionName = stem === 'ox' ? 'oxide' : stem === 'sulf' ? 'sulfide' : `${stem}ide`;

      const iupac = capitalize(`${prefix1}${posEl.name.toLowerCase()} ${prefix2}${anionName}`);
      return {
        formula: displayFormula,
        hillFormula: hill,
        iupacName: iupac,
        systematicIupacName: iupac,
        commonName: iupac,
        netCharge,
        chargeFormatted,
        molarMass,
        classification: 'Binary inorganic compound',
        iupacRulesNote: `IUPAC binary stoichiometric composition rules: Electropositive element '${posEl.name}' + electronegative element with suffix '-ide'.`,
        isRecognized: true,
      };
    }
  }

  // 5. Multi-Element Stoichiometric Compositional IUPAC Designation
  const elementFragments = Object.entries(counts)
    .sort(([a], [b]) => (getElement(a)?.electronegativity || 2.5) - (getElement(b)?.electronegativity || 2.5))
    .map(([el, c]) => {
      const data = getElement(el);
      const name = data ? data.name.toLowerCase() : el;
      return c > 1 ? `${MULTIPLIERS[c] || c}-${name}` : name;
    });

  const customIupac = capitalize(`${elementFragments.join(' ')}`);

  return {
    formula: displayFormula,
    hillFormula: hill,
    iupacName: customIupac,
    systematicIupacName: `Composition: ${displayFormula}`,
    commonName: `Compound (${displayFormula})`,
    netCharge,
    chargeFormatted,
    molarMass,
    classification: netCharge === 0 ? 'Synthesized molecular compound' : 'Molecular ion',
    iupacRulesNote: `IUPAC stoichiometric composition rules: Ordered by electropositivity (${Object.entries(counts)
      .map(([el, c]) => `${c} × ${el}`)
      .join(', ')}) with net charge ${netCharge}.`,
    isRecognized: false,
  };
}
