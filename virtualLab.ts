export type VesselType =
  | 'beaker_250_open'
  | 'beaker_250_closed'
  | 'beaker_250'
  | 'beaker_500'
  | 'erlenmeyer_250'
  | 'round_bottom_250'
  | 'volumetric_250'
  | 'florence_500'
  | 'test_tube_50'
  | 'graduated_100'
  | 'burette_50'
  | 'separatory_250'
  | 'evaporating_dish'
  | 'crucible_50'
  | 'petri_dish_50';

export type ChemicalCategory =
  | 'acids'
  | 'bases'
  | 'salts'
  | 'metals'
  | 'elements'
  | 'solids'
  | 'gases'
  | 'indicators'
  | 'solvents';

export type PhysicalState = 'liquid' | 'solid_powder' | 'solid_strip' | 'gas';

export type SpeciesKind = 'element' | 'molecule' | 'ionic' | 'solution';

export interface ChemicalItem {
  id: string;
  name: string;
  formula: string;
  category: ChemicalCategory;
  state: PhysicalState;
  speciesKind?: SpeciesKind;
  color: string; // Hex color for liquid/solid/gas
  concentration?: string; // e.g. "1.0 M", "6.0 M", "30%"
  densityGPerMl?: number; // approx density in g/mL (or g/L noted for gas if small)
  pH?: number; // baseline pH in water
  description: string;
  hazardNote?: string;
  molarMassGPerMol?: number; // Molar mass in g/mol
  chemicalProperties?: string[]; // Array of key chemical/physical properties
}

export interface ProductPhysicalProperties {
  physicalStateLabel: string; // e.g. 'Solid (Crystalline)', 'Liquid', 'Gas', 'Aqueous Solution'
  colorName: string; // e.g. 'Canary Yellow', 'Colorless', 'Deep Royal Navy Blue'
  odor: string; // e.g. 'Odorless', 'Pungent / Sharp'
  meltingPointC: string; // e.g. '402 °C', '0.0 °C'
  boilingPointC: string; // e.g. '953 °C', '100.0 °C'
  density: string; // e.g. '6.16 g/cm³', '1.00 g/mL', '1.98 g/L (STP)'
  solubilityInWater: string; // e.g. 'Insoluble (Precipitate)', 'Highly Soluble'
  textureOrForm: string; // e.g. 'Hexagonal Crystalline Flakes', 'Diatomic Gas'
  conductivityOrMagnetism?: string; // e.g. 'Strong Electrolyte', 'Diamagnetic', 'Paramagnetic'
}

export interface ReactionParticipant {
  formula: string;
  name: string;
  role: 'reactant' | 'product' | 'catalyst' | 'spectator';
  moles: number; // Moles amount (e.g. 0.050 mol)
  massG: number; // Mass in grams
  volumeMl?: number; // Volume in mL (for liquids/solutions)
  state: 'aq' | 's' | 'l' | 'g';
  molarMassGPerMol: number; // Molar mass in g/mol
  colorHex?: string;
  appearance: string; // Visual appearance description
  properties: string[]; // Specific chemical & physical properties
  physicalProperties?: ProductPhysicalProperties; // Structured physical constants & properties
}

export interface SubReactionInfo {
  name: string;
  equation: string;
  type: string;
  category?: DetailedReactionInfo['typeCategory'];
  deltaHKjPerMol?: number;
  deltaSJoulesPerMolK?: number;
  reactants: ReactionParticipant[];
  products: ReactionParticipant[];
}

export interface DetailedReactionInfo {
  reactionName: string; // e.g. "Acid-Carbonate Effervescence"
  reactionType: string; // e.g. "Gas Evolution / Double Displacement"
  typeCategory:
    | 'acid_base'
    | 'precipitation'
    | 'gas_evolution'
    | 'redox'
    | 'complexation'
    | 'decomposition'
    | 'single_displacement'
    | 'thermal_equilibrium';
  balancedEquation: string; // e.g. "NaHCO₃(aq) + HCl(aq) ➔ NaCl(aq) + H₂O(l) + CO₂(g)↑"
  thermochemistry: string; // e.g. "Exothermic (ΔH = -12.4 kJ/mol)"
  deltaHKjPerMol?: number; // ΔH Enthalpy change in kJ/mol (negative = exothermic, positive = endothermic)
  deltaSJoulesPerMolK?: number; // ΔS Entropy change in J/(mol·K) (positive = entropy increase/disorder, negative = ordering)
  deltaGKjPerMol?: number; // ΔG Gibbs Free Energy change in kJ/mol at vessel temperature
  spontaneity?: 'spontaneous' | 'non_spontaneous' | 'equilibrium';
  thermoInterpretation?: string; // Summary of enthalpy vs entropy driving forces
  reactants: ReactionParticipant[];
  products: ReactionParticipant[];
  conservationNote?: string; // Law of Conservation of Mass verification note
  subReactions?: SubReactionInfo[]; // When multiple reactions/stages occur simultaneously
  isMultiReactant?: boolean; // True when 3 or more reactants participate
  reactionTimeLengthSec?: number; // Characteristic duration of reaction in seconds (e.g. 4.5s)
  kineticsType?: string; // Kinetics classification (e.g. "Rapid Ionic Lattice Precipitation")
  rateDescription?: string; // Kinetics summary explanation
}

export interface DissolvedChemical {
  chemicalId: string;
  formula: string;
  name: string;
  amountMl: number; // Volume in mL (for liquids) or equivalent mass (g)
  portionAmountsG?: number[]; // Individual portion masses added for solids (tracks count n and per-piece mass)
  concentration?: string;
  moles?: number;
}

export interface PrecipitateInfo {
  formula: string;
  name: string;
  color: string;
  amountG: number;
  moles?: number;
  texture: 'crystalline' | 'gelatinous' | 'curdy' | 'granular' | 'colloidal';
  description?: string;
  properties?: string[];
}

export interface EvolvedGasInfo {
  formula: string;
  name: string;
  volumeMl: number;
  rate: 'none' | 'slow' | 'vigorous' | 'violent';
  gasMassG?: number; // Mass of evolved gas in grams
  moles?: number; // Moles of evolved gas
  properties?: string[];
}

export interface GasAtmosphereInfo {
  formula: string;
  name: string;
  color: string;
  opacity: number;
  volumeMl: number;
  densityFactor?: number; // 0.08 (trace) to 1.0 (very dense) scaled by gas quantity
}

export interface UndissolvedSolidInfo {
  chemicalId: string;
  formula: string;
  name: string;
  color: string;
  amountG: number;
  portionAmountsG: number[];
  texture: 'strip' | 'powder' | 'crystal';
}

export interface VesselState {
  id: string;
  name: string;
  type: VesselType;
  maxVolumeMl: number;
  currentVolumeMl: number;
  contents: DissolvedChemical[];
  color: string; // Blended solution color
  temperatureC: number; // in Celsius (ambient ~22C)
  pH: number; // 0 to 14
  precipitate: PrecipitateInfo | null;
  gasEvolving: EvolvedGasInfo | null;
  gasAtmosphere?: GasAtmosphereInfo | null;
  undissolvedSolids?: UndissolvedSolidInfo[];
  foamHeightPercent?: number; // Foam head percentage on top of liquid
  activeIndicator: string | null; // e.g. 'phenolphthalein', 'universal', etc.
  isStirring: boolean;
  isHeating: boolean; // under Bunsen burner
  activeReactionName?: string | null;
  activeReactionEquation?: string | null;
  reactionType?: string | null; // Specific name of the type of reaction (e.g. "Double Displacement / Precipitation")
  detailedReaction?: DetailedReactionInfo | null; // Stoichiometry, moles, and properties of reactants & products
  allReactions?: DetailedReactionInfo[]; // List of all concurrent/sequential reactions
  reactionPulse?: boolean; // trigger visual glowing effect on reaction event
  // Open vs Closed System (Conservation of Mass)
  isClosed?: boolean; // false = Open Beaker (gas escapes, mass decreases); true = Closed Beaker (mass constant)
  escapedGasMassG?: number; // Cumulative mass of gas lost to surroundings in open beaker (g)
  trappedGasMassG?: number; // Mass of gas trapped inside closed container (g)
  internalPressureAtm?: number; // Internal pressure in atmospheres (1.00 atm ambient)
  // Continuous Reaction Kinetics & Time Length
  reactionProgress?: number; // 0.0 to 1.0 (continuous reaction progress)
  reactionDurationSec?: number; // Total reaction time length in seconds (e.g. 4.5s)
  reactionElapsedSec?: number; // Elapsed reaction time in seconds
  reactionStartTimeMs?: number; // Wall-clock timestamp when reaction started for rock-solid timing
  isReactionActive?: boolean; // True while reaction is running 0% -> 100%
  isReactionComplete?: boolean; // True when reaction is finished
}

export interface LabLogEntry {
  id: string;
  timestamp: string;
  title: string;
  details: string;
  equation?: string;
  reactionType?: string;
  detailedReaction?: DetailedReactionInfo | null;
  allReactions?: DetailedReactionInfo[];
  reactants?: ReactionParticipant[];
  products?: ReactionParticipant[];
  type: 'addition' | 'reaction' | 'temperature' | 'measurement' | 'heat';
}

export interface ExperimentPreset {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  summary: string;
  expectedEquation: string;
  initialVessels: Array<{
    type: VesselType;
    name: string;
    chemicals: Array<{ chemicalId: string; amountMl: number }>;
  }>;
  suggestedSteps: string[];
}

export interface MovableInstrument {
  id: string;
  name: string;
  type:
    | 'beaker'
    | 'erlenmeyer_flask'
    | 'florence_flask'
    | 'test_tubes'
    | 'graduated_cylinder'
    | 'bunsen_burner'
    | 'thermometer'
    | 'digital_balance'
    | 'ph_meter'
    | 'magnetic_stirrer'
    | 'pipette_dropper'
    | 'watch_glass'
    | 'crucible_tongs'
    | 'crucible_cover'
    | 'mortar_pestle'
    | 'buret'
    | 'condenser'
    | 'pipet_bulb'
    | 'volumetric_pipet'
    | 'graduated_pipet'
    | 'scoopula'
    | 'rubber_stoppers'
    | 'wire_gauze'
    | 'clay_triangle'
    | 'funnel'
    | 'ceramic_square'
    | 'clamps'
    | 'test_tube_holder'
    | 'platform_balance'
    | 'ring_stand'
    | 'burner'
    | 'test_tube_brush'
    | 'reagent_bottle'
    | 'spatula'
    | string;
  x: number;
  y: number;
  vesselState?: VesselState;
  isFlameOn?: boolean;
  measuredTempC?: number;
  measuredMassG?: number;
  heldChemical?: { chemicalId: string; amountMl: number };
}

