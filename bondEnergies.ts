import { ChemicalReaction } from '../types/chemistry';

export interface BondEnergyComponent {
  id: string;
  label: string;
  speciesFormula: string;
  bondType: 'covalent' | 'ionic' | 'metallic' | 'hydration' | 'nuclear';
  bondOrderLabel: string;
  count: number;
  energyPerUnitKj: number;
  totalKj: number;
  role: 'broken' | 'formed';
}

export interface BondEnergyTrajectoryPoint {
  extent: number;
  brokenAbsorbedKj: number; // >= 0 (endothermic bond breaking)
  formedReleasedKj: number; // <= 0 (exothermic bond formation)
  netBondDeltaKj: number;   // brokenAbsorbedKj + formedReleasedKj (ends at ΔH)
  potentialSurfaceKj: number; // PES curve passing through +Ea_eff at ξ=0.5 and ΔH at ξ=1
  phase: string;
}

export interface BondEnergyProfile {
  reactionId: string;
  isNuclear: boolean;
  unitLabel: 'kJ/mol' | 'GJ/mol';
  scaleFactor: number; // divide kJ/mol by scaleFactor to get display unit value
  effectiveEaKj: number;
  enthalpyDeltaHKj: number;
  totalBrokenKj: number;
  totalFormedKj: number;
  brokenBonds: BondEnergyComponent[];
  formedBonds: BondEnergyComponent[];
  trajectory: BondEnergyTrajectoryPoint[];
}

export interface BondEnergySample {
  extent: number;
  brokenAbsorbedKj: number;
  formedReleasedKj: number;
  netBondDeltaKj: number;
  potentialSurfaceKj: number;
  breakFraction: number;
  formFraction: number;
  phase: string;
}

interface RawBondSpec {
  label: string;
  speciesFormula: string;
  bondType: BondEnergyComponent['bondType'];
  bondOrderLabel: string;
  count: number;
  energyPerUnitKj: number;
}

interface ReactionBondInventory {
  broken: RawBondSpec[];
  formed: RawBondSpec[];
}

const REACTION_BOND_INVENTORIES: Record<string, ReactionBondInventory> = {
  methane_combustion: {
    broken: [
      { label: 'C–H', speciesFormula: 'CH₄', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 4, energyPerUnitKj: 414 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 2, energyPerUnitKj: 498 },
    ],
    formed: [
      { label: 'C=O', speciesFormula: 'CO₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 2, energyPerUnitKj: 804 },
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 4, energyPerUnitKj: 463 },
      { label: 'H₂O Condensation', speciesFormula: 'H₂O(l)', bondType: 'hydration', bondOrderLabel: 'H-Bond Lattice', count: 2, energyPerUnitKj: 41.5 },
    ],
  },
  water_synthesis: {
    broken: [
      { label: 'H–H', speciesFormula: 'H₂', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 2, energyPerUnitKj: 436 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 1, energyPerUnitKj: 498 },
    ],
    formed: [
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 4, energyPerUnitKj: 463 },
      { label: 'H₂O Condensation', speciesFormula: 'H₂O(l)', bondType: 'hydration', bondOrderLabel: 'H-Bond Lattice', count: 2, energyPerUnitKj: 45 },
    ],
  },
  haber_bosch: {
    broken: [
      { label: 'N≡N', speciesFormula: 'N₂', bondType: 'covalent', bondOrderLabel: 'Triple σ+2π', count: 1, energyPerUnitKj: 945 },
      { label: 'H–H', speciesFormula: 'H₂', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 3, energyPerUnitKj: 436 },
    ],
    formed: [
      { label: 'N–H', speciesFormula: 'NH₃', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 6, energyPerUnitKj: 390.87 },
    ],
  },
  photosynthesis: {
    broken: [
      { label: 'C=O', speciesFormula: 'CO₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 12, energyPerUnitKj: 804 },
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 12, energyPerUnitKj: 463 },
      { label: 'H₂O H-Bonding', speciesFormula: 'H₂O(l)', bondType: 'hydration', bondOrderLabel: 'Liquid Lattice', count: 6, energyPerUnitKj: 44 },
    ],
    formed: [
      { label: 'C–C', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 5, energyPerUnitKj: 347 },
      { label: 'C–H', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 7, energyPerUnitKj: 414 },
      { label: 'C–O', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 7, energyPerUnitKj: 358 },
      { label: 'O–H', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 5, energyPerUnitKj: 463 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 6, energyPerUnitKj: 498 },
      { label: 'Glucose Packing', speciesFormula: 'C₆H₁₂O₆(s)', bondType: 'hydration', bondOrderLabel: 'Crystal Packing', count: 1, energyPerUnitKj: 221 },
    ],
  },
  cellular_respiration: {
    broken: [
      { label: 'C–C', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 5, energyPerUnitKj: 347 },
      { label: 'C–H', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 7, energyPerUnitKj: 414 },
      { label: 'C–O', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 7, energyPerUnitKj: 358 },
      { label: 'O–H', speciesFormula: 'C₆H₁₂O₆', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 5, energyPerUnitKj: 463 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 6, energyPerUnitKj: 498 },
      { label: 'Glucose Lattice', speciesFormula: 'C₆H₁₂O₆(s)', bondType: 'hydration', bondOrderLabel: 'Dissociation', count: 1, energyPerUnitKj: 146 },
    ],
    formed: [
      { label: 'C=O', speciesFormula: 'CO₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 12, energyPerUnitKj: 804 },
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 12, energyPerUnitKj: 463 },
      { label: 'H₂O H-Bonding', speciesFormula: 'H₂O(l)', bondType: 'hydration', bondOrderLabel: 'Liquid Lattice', count: 6, energyPerUnitKj: 44 },
    ],
  },
  h2o2_decomposition: {
    broken: [
      { label: 'O–O (Peroxide)', speciesFormula: 'H₂O₂', bondType: 'covalent', bondOrderLabel: 'Weak Single σ', count: 2, energyPerUnitKj: 142 },
      { label: 'O–H', speciesFormula: 'H₂O₂', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 4, energyPerUnitKj: 463 },
      { label: 'H₂O₂ Solvation', speciesFormula: 'H₂O₂(aq)', bondType: 'hydration', bondOrderLabel: 'H-Bond Shift', count: 2, energyPerUnitKj: 8.8 },
    ],
    formed: [
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 4, energyPerUnitKj: 463 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 1, energyPerUnitKj: 498 },
    ],
  },
  thermite_redox: {
    broken: [
      { label: 'Fe³⁺–O²⁻ Lattice', speciesFormula: 'Fe₂O₃', bondType: 'ionic', bondOrderLabel: 'Oxide Lattice', count: 1, energyPerUnitKj: 824.2 },
      { label: 'Al–Al Metallic', speciesFormula: 'Al(s)', bondType: 'metallic', bondOrderLabel: 'Metallic Sea', count: 2, energyPerUnitKj: 326 },
    ],
    formed: [
      { label: 'Al³⁺–O²⁻ Corundum', speciesFormula: 'Al₂O₃', bondType: 'ionic', bondOrderLabel: 'Oxide Lattice', count: 1, energyPerUnitKj: 1675.7 },
      { label: 'Fe–Fe Metallic', speciesFormula: 'Fe(l)', bondType: 'metallic', bondOrderLabel: 'Molten Metal', count: 2, energyPerUnitKj: 326 },
    ],
  },
  calcium_carbonate_calcination: {
    broken: [
      { label: 'Ca²⁺···O Lattice', speciesFormula: 'CaCO₃', bondType: 'ionic', bondOrderLabel: 'Ionic Coord', count: 2, energyPerUnitKj: 380 },
      { label: 'C–O (Carbonate)', speciesFormula: 'CO₃²⁻', bondType: 'covalent', bondOrderLabel: 'Cleaved σ', count: 1, energyPerUnitKj: 358 },
      { label: 'Calcite Resonance', speciesFormula: 'CaCO₃(s)', bondType: 'ionic', bondOrderLabel: 'Lattice Stab.', count: 1, energyPerUnitKj: 190.2 },
    ],
    formed: [
      { label: 'Ca²⁺–O²⁻ Lattice', speciesFormula: 'CaO(s)', bondType: 'ionic', bondOrderLabel: 'Quicklime Lattice', count: 1, energyPerUnitKj: 326 },
      { label: 'C=O', speciesFormula: 'CO₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 1, energyPerUnitKj: 804 },
    ],
  },
  ethanol_combustion: {
    broken: [
      { label: 'C–C', speciesFormula: 'C₂H₅OH', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 347 },
      { label: 'C–H', speciesFormula: 'C₂H₅OH', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 5, energyPerUnitKj: 414 },
      { label: 'C–O', speciesFormula: 'C₂H₅OH', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 358 },
      { label: 'O–H', speciesFormula: 'C₂H₅OH', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 463 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 3, energyPerUnitKj: 498 },
      { label: 'Ethanol Vaporization', speciesFormula: 'C₂H₅OH(l)', bondType: 'hydration', bondOrderLabel: 'H-Bond Lattice', count: 1, energyPerUnitKj: 42 },
    ],
    formed: [
      { label: 'C=O', speciesFormula: 'CO₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 4, energyPerUnitKj: 804 },
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 6, energyPerUnitKj: 463 },
      { label: 'H₂O Condensation', speciesFormula: 'H₂O(l)', bondType: 'hydration', bondOrderLabel: 'H-Bond Lattice', count: 3, energyPerUnitKj: 49 },
    ],
  },
  fischer_esterification: {
    broken: [
      { label: 'C–OH (Acyl)', speciesFormula: 'CH₃COOH', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 358 },
      { label: 'O–H (Alcohol)', speciesFormula: 'C₂H₅OH', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 463 },
      { label: 'H-Bond Shift', speciesFormula: 'Solution', bondType: 'hydration', bondOrderLabel: 'Solvation', count: 1, energyPerUnitKj: 15.1 },
    ],
    formed: [
      { label: 'C–OR (Ester)', speciesFormula: 'CH₃COOC₂H₅', bondType: 'covalent', bondOrderLabel: 'Ester σ', count: 1, energyPerUnitKj: 388.2 },
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 463 },
    ],
  },
  water_electrolysis: {
    broken: [
      { label: 'O–H', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 4, energyPerUnitKj: 463 },
      { label: 'H₂O H-Bonding', speciesFormula: 'H₂O(l)', bondType: 'hydration', bondOrderLabel: 'Liquid Lattice', count: 2, energyPerUnitKj: 45 },
    ],
    formed: [
      { label: 'H–H', speciesFormula: 'H₂', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 2, energyPerUnitKj: 436 },
      { label: 'O=O', speciesFormula: 'O₂', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 1, energyPerUnitKj: 498 },
    ],
  },
  baking_soda_vinegar: {
    broken: [
      { label: 'O–H (Carboxyl)', speciesFormula: 'CH₃COOH', bondType: 'covalent', bondOrderLabel: 'Acid Proton', count: 1, energyPerUnitKj: 463 },
      { label: 'C–OH (Bicarbonate)', speciesFormula: 'H₂CO₃*', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 358 },
      { label: 'NaHCO₃ Dissolution', speciesFormula: 'NaHCO₃(s)', bondType: 'ionic', bondOrderLabel: 'Lattice Input', count: 1, energyPerUnitKj: 32.5 },
    ],
    formed: [
      { label: 'O–H (Water)', speciesFormula: 'H₂O', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 463 },
      { label: 'C=O (CO₂ Gas)', speciesFormula: 'CO₂(g)', bondType: 'covalent', bondOrderLabel: 'π Stabilization', count: 1, energyPerUnitKj: 362 },
    ],
  },
  ionic_transfer: {
    broken: [
      { label: 'Na(3s¹) Ionization', speciesFormula: 'Na → Na⁺', bondType: 'ionic', bondOrderLabel: '1st IE', count: 1, energyPerUnitKj: 496 },
    ],
    formed: [
      { label: 'Cl Electron Affinity', speciesFormula: 'Cl → Cl⁻', bondType: 'ionic', bondOrderLabel: '3p⁵ + e⁻', count: 1, energyPerUnitKj: 349 },
      { label: 'Na⁺···Cl⁻ Lattice', speciesFormula: 'NaCl', bondType: 'ionic', bondOrderLabel: 'Coulomb Pair', count: 1, energyPerUnitKj: 558 },
    ],
  },
  acid_base_neutralization: {
    broken: [
      { label: 'H₃O⁺ / OH⁻ Desolvation', speciesFormula: 'HCl + NaOH(aq)', bondType: 'hydration', bondOrderLabel: 'Hydration Shell', count: 1, energyPerUnitKj: 405.7 },
    ],
    formed: [
      { label: 'O–H (Coordinate)', speciesFormula: 'H₂O(l)', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 463 },
    ],
  },
  uranium_fission: {
    broken: [
      { label: '²³⁶U* Saddle Deformation', speciesFormula: '²³⁵U + n', bondType: 'nuclear', bondOrderLabel: 'Surface Tension', count: 1, energyPerUnitKj: 627000000 },
    ],
    formed: [
      { label: '¹⁴¹Ba + ⁹²Kr Binding Gain', speciesFormula: '¹⁴¹Ba + ⁹²Kr', bondType: 'nuclear', bondOrderLabel: 'ΔB = 200 MeV', count: 1, energyPerUnitKj: 19927000000 },
    ],
  },
  plutonium_fission: {
    broken: [
      { label: '²⁴⁰Pu* Saddle Barrier', speciesFormula: '²³⁹Pu + n', bondType: 'nuclear', bondOrderLabel: 'Surface Tension', count: 1, energyPerUnitKj: 530000000 },
    ],
    formed: [
      { label: '¹³⁴Xe + ¹⁰³Zr Binding Gain', speciesFormula: '¹³⁴Xe + ¹⁰³Zr', bondType: 'nuclear', bondOrderLabel: 'ΔB = 207 MeV', count: 1, energyPerUnitKj: 20510000000 },
    ],
  },
  dt_fusion: {
    broken: [
      { label: '²H + ³H Nucleon Dissoc.', speciesFormula: 'D + T', bondType: 'nuclear', bondOrderLabel: 'Binding Input', count: 1, energyPerUnitKj: 1033000000 },
    ],
    formed: [
      { label: '⁴He Alpha Binding', speciesFormula: '⁴He + n', bondType: 'nuclear', bondOrderLabel: '28.3 MeV Core', count: 1, energyPerUnitKj: 2731000000 },
    ],
  },
  proton_proton_fusion: {
    broken: [
      { label: 'Coulomb Tunneling + Weak β⁺', speciesFormula: '4 ¹H', bondType: 'nuclear', bondOrderLabel: 'Barrier Input', count: 1, energyPerUnitKj: 155000000 },
    ],
    formed: [
      { label: '⁴He Solar Binding Gain', speciesFormula: '⁴He + 2e⁺', bondType: 'nuclear', bondOrderLabel: '26.7 MeV Net', count: 1, energyPerUnitKj: 2731000000 },
    ],
  },
  dd_fusion: {
    broken: [
      { label: '²H Deuteron Binding', speciesFormula: '²H', bondType: 'nuclear', bondOrderLabel: '2.22 MeV/n', count: 2, energyPerUnitKj: 214000000 },
    ],
    formed: [
      { label: '³He Nuclear Binding', speciesFormula: '³He + n', bondType: 'nuclear', bondOrderLabel: '7.72 MeV Core', count: 1, energyPerUnitKj: 743000000 },
    ],
  },
  lead_iodide_precipitation: {
    broken: [
      { label: 'Pb²⁺ Desolvation', speciesFormula: 'Pb²⁺(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Shell', count: 1, energyPerUnitKj: 1481 },
      { label: 'I⁻ Desolvation', speciesFormula: '2 I⁻(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Shell', count: 2, energyPerUnitKj: 305 },
    ],
    formed: [
      { label: 'PbI₂ Hexagonal Lattice', speciesFormula: 'PbI₂(s)', bondType: 'ionic', bondOrderLabel: 'Crystal Lattice', count: 1, energyPerUnitKj: 2156.2 },
    ],
  },
  silver_chloride_precipitation: {
    broken: [
      { label: 'Ag⁺ Desolvation', speciesFormula: 'Ag⁺(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Shell', count: 1, energyPerUnitKj: 473 },
      { label: 'Cl⁻ Desolvation', speciesFormula: 'Cl⁻(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Shell', count: 1, energyPerUnitKj: 367 },
    ],
    formed: [
      { label: 'AgCl Cubic Lattice', speciesFormula: 'AgCl(s)', bondType: 'ionic', bondOrderLabel: 'Rock-Salt Lattice', count: 1, energyPerUnitKj: 905.5 },
    ],
  },
  copper_hydroxide_precipitation: {
    broken: [
      { label: '[Cu(H₂O)₆]²⁺ Desolvation', speciesFormula: 'Cu²⁺(aq)', bondType: 'hydration', bondOrderLabel: 'Hexaaqua Shell', count: 1, energyPerUnitKj: 2100 },
      { label: 'OH⁻ Desolvation', speciesFormula: '2 OH⁻(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Shell', count: 2, energyPerUnitKj: 460 },
    ],
    formed: [
      { label: 'Cu(OH)₂ Polymeric Lattice', speciesFormula: 'Cu(OH)₂(s)', bondType: 'ionic', bondOrderLabel: 'Coord. Lattice', count: 1, energyPerUnitKj: 3074 },
    ],
  },
  zinc_copper_displacement: {
    broken: [
      { label: 'Zn–Zn Metallic Lattice', speciesFormula: 'Zn(s)', bondType: 'metallic', bondOrderLabel: 'Metallic Bond', count: 1, energyPerUnitKj: 130.4 },
      { label: 'Cu²⁺ Desolvation + e⁻', speciesFormula: 'Cu²⁺(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Reduction', count: 1, energyPerUnitKj: 2100 },
    ],
    formed: [
      { label: 'Cu–Cu Metallic Lattice', speciesFormula: 'Cu(s)', bondType: 'metallic', bondOrderLabel: 'Plated Crystal', count: 1, energyPerUnitKj: 337.7 },
      { label: 'Zn²⁺ Hydration Shell', speciesFormula: 'Zn²⁺(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Stabilization', count: 1, energyPerUnitKj: 2111.4 },
    ],
  },
  sodium_water_reaction: {
    broken: [
      { label: 'Na–Na Metallic', speciesFormula: 'Na(s)', bondType: 'metallic', bondOrderLabel: 'Alkali Lattice', count: 2, energyPerUnitKj: 107.3 },
      { label: 'O–H (Water)', speciesFormula: 'H₂O(l)', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 2, energyPerUnitKj: 463 },
    ],
    formed: [
      { label: 'H–H', speciesFormula: 'H₂(g)', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 436 },
      { label: 'Na⁺ + OH⁻ Hydration', speciesFormula: 'NaOH(aq)', bondType: 'hydration', bondOrderLabel: 'Ion Solvation', count: 2, energyPerUnitKj: 493.3 },
    ],
  },
  limewater_carbonation: {
    broken: [
      { label: 'C=O (π Cleavage)', speciesFormula: 'CO₂(g)', bondType: 'covalent', bondOrderLabel: 'π Bond Open', count: 1, energyPerUnitKj: 446 },
      { label: 'Ca²⁺ / OH⁻ Desolvation', speciesFormula: 'Ca(OH)₂(aq)', bondType: 'hydration', bondOrderLabel: 'Aqua Shell', count: 2, energyPerUnitKj: 228.5 },
    ],
    formed: [
      { label: 'CaCO₃ Calcite Lattice', speciesFormula: 'CaCO₃(s)', bondType: 'ionic', bondOrderLabel: 'Crystal Precip.', count: 1, energyPerUnitKj: 553 },
      { label: 'O–H (Water)', speciesFormula: 'H₂O(l)', bondType: 'covalent', bondOrderLabel: 'Single σ', count: 1, energyPerUnitKj: 463 },
    ],
  },
  potassium_chlorate_decomposition: {
    broken: [
      { label: 'Cl–O (Chlorate)', speciesFormula: 'KClO₃(s)', bondType: 'covalent', bondOrderLabel: 'Pyramidal Bond', count: 6, energyPerUnitKj: 206 },
      { label: 'KClO₃ → KCl Lattice Shift', speciesFormula: 'KClO₃(s)', bondType: 'ionic', bondOrderLabel: 'Lattice Shift', count: 2, energyPerUnitKj: 84.3 },
    ],
    formed: [
      { label: 'O=O', speciesFormula: 'O₂(g)', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 3, energyPerUnitKj: 498 },
    ],
  },
  iron_rusting: {
    broken: [
      { label: 'Fe–Fe Metallic', speciesFormula: 'Fe(s)', bondType: 'metallic', bondOrderLabel: 'Metallic Sea', count: 4, energyPerUnitKj: 416 },
      { label: 'O=O', speciesFormula: 'O₂(g)', bondType: 'covalent', bondOrderLabel: 'Double σ+π', count: 3, energyPerUnitKj: 498 },
    ],
    formed: [
      { label: 'Fe₂O₃·3H₂O Oxide Lattice', speciesFormula: 'Fe₂O₃·3H₂O(s)', bondType: 'ionic', bondOrderLabel: 'Hydrated Oxide', count: 2, energyPerUnitKj: 2404 },
    ],
  },
};

function normalizedSigmoid(x: number, center: number, steepness: number): number {
  const sig = (v: number) => 1 / (1 + Math.exp(-steepness * (v - center)));
  const s0 = sig(0);
  const s1 = sig(1);
  const raw = (sig(x) - s0) / (s1 - s0);
  return Math.max(0, Math.min(1, raw));
}

function getPhaseLabel(extent: number, isExothermic: boolean): string {
  if (extent < 0.12) return 'Reactant Approach';
  if (extent < 0.42) return 'Bond Dissociation (+Endothermic)';
  if (extent < 0.6) return 'Transition State (Activated Complex)';
  if (extent < 0.94) {
    return isExothermic ? 'Bond Formation (−Exothermic)' : 'Product Stabilization';
  }
  return 'Product Equilibrium Reached';
}

function computePotentialSurfaceAtExtent(
  extent: number,
  effectiveEaKj: number,
  enthalpyDeltaHKj: number
): number {
  const ξ = Math.max(0, Math.min(1, extent));
  // Smooth potential energy curve passing through 0 at ξ=0, peak at ξ=0.5, and ΔH at ξ=1
  const tsPeak = Math.max(effectiveEaKj, Math.max(0, enthalpyDeltaHKj) + 12);
  if (ξ <= 0.5) {
    const u = ξ / 0.5;
    const smooth = u * u * (3 - 2 * u);
    return tsPeak * smooth;
  }
  const u = (ξ - 0.5) / 0.5;
  const smooth = u * u * (3 - 2 * u);
  return tsPeak + (enthalpyDeltaHKj - tsPeak) * smooth;
}

function buildFallbackInventory(reaction: ChemicalReaction): ReactionBondInventory {
  const baseBroken = Math.max(250, reaction.activationEnergyEa * 3 + 300);
  const baseFormed = Math.max(100, baseBroken - reaction.enthalpyDeltaH);
  return {
    broken: [
      {
        label: 'Reactant Bonds',
        speciesFormula: reaction.reactants.map((r) => r.formula).join(' + '),
        bondType: 'covalent',
        bondOrderLabel: 'Cleaved',
        count: 1,
        energyPerUnitKj: baseBroken,
      },
    ],
    formed: [
      {
        label: 'Product Bonds',
        speciesFormula: reaction.products.map((p) => p.formula).join(' + '),
        bondType: 'covalent',
        bondOrderLabel: 'Formed',
        count: 1,
        energyPerUnitKj: baseFormed,
      },
    ],
  };
}

export function computeBondEnergyProfile(
  reaction: ChemicalReaction,
  hasCatalyst: boolean
): BondEnergyProfile {
  const isNuclear =
    reaction.type === 'nuclear_fission' || reaction.type === 'nuclear_fusion';
  const unitLabel: 'kJ/mol' | 'GJ/mol' = isNuclear ? 'GJ/mol' : 'kJ/mol';
  const scaleFactor = isNuclear ? 1e6 : 1;

  const effectiveEaKj =
    hasCatalyst && !isNuclear
      ? Number((reaction.activationEnergyEa * 0.65).toFixed(1))
      : reaction.activationEnergyEa;

  const rawInv = REACTION_BOND_INVENTORIES[reaction.id] ?? buildFallbackInventory(reaction);

  const brokenBonds: BondEnergyComponent[] = rawInv.broken.map((b, idx) => ({
    id: `brk-${idx}-${b.label}`,
    label: b.label,
    speciesFormula: b.speciesFormula,
    bondType: b.bondType,
    bondOrderLabel: b.bondOrderLabel,
    count: b.count,
    energyPerUnitKj: b.energyPerUnitKj,
    totalKj: Number((b.count * b.energyPerUnitKj).toFixed(2)),
    role: 'broken',
  }));

  const formedBonds: BondEnergyComponent[] = rawInv.formed.map((b, idx) => ({
    id: `frm-${idx}-${b.label}`,
    label: b.label,
    speciesFormula: b.speciesFormula,
    bondType: b.bondType,
    bondOrderLabel: b.bondOrderLabel,
    count: b.count,
    energyPerUnitKj: b.energyPerUnitKj,
    totalKj: Number((b.count * b.energyPerUnitKj).toFixed(2)),
    role: 'formed',
  }));

  const totalBrokenKj = Number(
    brokenBonds.reduce((acc, b) => acc + b.totalKj, 0).toFixed(2)
  );
  const totalFormedKj = Number(
    formedBonds.reduce((acc, b) => acc + b.totalKj, 0).toFixed(2)
  );

  // Build 101-point trajectory along reaction extent ξ ∈ [0, 1]
  const steps = 100;
  const trajectory: BondEnergyTrajectoryPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const extent = i / steps;
    const breakFrac = normalizedSigmoid(extent, 0.34, 8.5);
    const formFrac = normalizedSigmoid(extent, 0.66, 8.5);
    const brokenAbsorbedKj = totalBrokenKj * breakFrac;
    const formedReleasedKj = -totalFormedKj * formFrac;
    const netBondDeltaKj = brokenAbsorbedKj + formedReleasedKj;
    const potentialSurfaceKj = computePotentialSurfaceAtExtent(
      extent,
      effectiveEaKj,
      reaction.enthalpyDeltaH
    );

    trajectory.push({
      extent,
      brokenAbsorbedKj,
      formedReleasedKj,
      netBondDeltaKj,
      potentialSurfaceKj,
      phase: getPhaseLabel(extent, reaction.isExothermic),
    });
  }

  return {
    reactionId: reaction.id,
    isNuclear,
    unitLabel,
    scaleFactor,
    effectiveEaKj,
    enthalpyDeltaHKj: reaction.enthalpyDeltaH,
    totalBrokenKj,
    totalFormedKj,
    brokenBonds,
    formedBonds,
    trajectory,
  };
}

export function sampleBondEnergyAtExtent(
  profile: BondEnergyProfile,
  extent: number
): BondEnergySample {
  const ξ = Math.max(0, Math.min(1, extent));
  const breakFraction = normalizedSigmoid(ξ, 0.34, 8.5);
  const formFraction = normalizedSigmoid(ξ, 0.66, 8.5);
  const brokenAbsorbedKj = profile.totalBrokenKj * breakFraction;
  const formedReleasedKj = -profile.totalFormedKj * formFraction;
  const netBondDeltaKj = brokenAbsorbedKj + formedReleasedKj;
  const potentialSurfaceKj = computePotentialSurfaceAtExtent(
    ξ,
    profile.effectiveEaKj,
    profile.enthalpyDeltaHKj
  );

  return {
    extent: ξ,
    brokenAbsorbedKj,
    formedReleasedKj,
    netBondDeltaKj,
    potentialSurfaceKj,
    breakFraction,
    formFraction,
    phase: getPhaseLabel(ξ, profile.enthalpyDeltaHKj < 0),
  };
}

export function formatBondEnergyValue(
  kjValue: number,
  profile: BondEnergyProfile,
  showSign = true
): string {
  const scaled = kjValue / profile.scaleFactor;
  const abs = Math.abs(scaled);
  const sign = showSign ? (scaled > 0.05 ? '+' : scaled < -0.05 ? '−' : '') : '';
  if (abs >= 10000) {
    return `${sign}${Math.round(abs).toLocaleString()} ${profile.unitLabel}`;
  }
  if (abs >= 100) {
    return `${sign}${abs.toFixed(0)} ${profile.unitLabel}`;
  }
  if (abs >= 1) {
    return `${sign}${abs.toFixed(1)} ${profile.unitLabel}`;
  }
  return `${sign}${abs.toFixed(2)} ${profile.unitLabel}`;
}
