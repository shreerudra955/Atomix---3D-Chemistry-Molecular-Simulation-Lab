import { ChemicalItem, ExperimentPreset, VesselType } from '../types/virtualLab';

export const ALL_CHEMICALS: ChemicalItem[] = [
  // --- ACIDS ---
  {
    id: 'hcl_1m',
    name: 'Hydrochloric Acid (1.0 M)',
    formula: 'HCl(aq)',
    category: 'acids',
    state: 'liquid',
    color: '#e2e8f0', // Clear colorless
    concentration: '1.0 M',
    densityGPerMl: 1.02,
    pH: 0.1,
    description: 'Strong monoprotic mineral acid. Readily donates H⁺ to bases and attacks reactive metals.',
    hazardNote: 'Corrosive. Causes skin burns.',
  },
  {
    id: 'hcl_6m',
    name: 'Hydrochloric Acid (6.0 M Concentrated)',
    formula: 'HCl(aq)',
    category: 'acids',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '6.0 M',
    densityGPerMl: 1.1,
    pH: 0.0,
    description: 'Concentrated hydrochloric acid for rapid gas generation and cobalt thermochromic shifts.',
    hazardNote: 'Highly Corrosive. Fuming acid.',
  },
  {
    id: 'h2so4_1m',
    name: 'Sulfuric Acid (1.0 M)',
    formula: 'H₂SO₄(aq)',
    category: 'acids',
    state: 'liquid',
    color: '#f1f5f9',
    concentration: '1.0 M',
    densityGPerMl: 1.06,
    pH: 0.3,
    description: 'Strong diprotic acid. Precipitates insoluble sulfates like BaSO₄ and catalyzes redox reactions.',
    hazardNote: 'Corrosive. Hydration heat.',
  },
  {
    id: 'hno3_1m',
    name: 'Nitric Acid (1.0 M)',
    formula: 'HNO₃(aq)',
    category: 'acids',
    state: 'liquid',
    color: '#fef9c3', // Pale yellow tinge
    concentration: '1.0 M',
    densityGPerMl: 1.05,
    pH: 0.2,
    description: 'Strong oxidizing acid capable of oxidizing metals and organic compounds.',
    hazardNote: 'Corrosive and oxidizing.',
  },
  {
    id: 'ch3cooh_1m',
    name: 'Acetic Acid / Vinegar (1.0 M)',
    formula: 'CH₃COOH(aq)',
    category: 'acids',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1.0 M',
    densityGPerMl: 1.01,
    pH: 2.4,
    description: 'Weak organic carboxylic acid with pungent scent. Produces vigorous foaming with bicarbonates.',
  },
  {
    id: 'citric_acid',
    name: 'Citric Acid Solution (0.5 M)',
    formula: 'C₆H₈O₇(aq)',
    category: 'acids',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '0.5 M',
    densityGPerMl: 1.03,
    pH: 2.1,
    description: 'Triprotic weak organic acid naturally found in citrus fruits.',
  },

  // --- BASES & ALKALIS ---
  {
    id: 'naoh_1m',
    name: 'Sodium Hydroxide (1.0 M)',
    formula: 'NaOH(aq)',
    category: 'bases',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1.0 M',
    densityGPerMl: 1.04,
    pH: 14.0,
    description: 'Strong caustic alkali. Neutralizes acids and forms rich hydroxide precipitates with metal ions.',
    hazardNote: 'Caustic. Harmful to skin and eyes.',
  },
  {
    id: 'naoh_6m',
    name: 'Sodium Hydroxide (6.0 M Concentrated)',
    formula: 'NaOH(aq)',
    category: 'bases',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '6.0 M',
    densityGPerMl: 1.22,
    pH: 14.5,
    description: 'Concentrated caustic soda solution.',
    hazardNote: 'Severe chemical burn hazard.',
  },
  {
    id: 'koh_1m',
    name: 'Potassium Hydroxide (1.0 M)',
    formula: 'KOH(aq)',
    category: 'bases',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1.0 M',
    densityGPerMl: 1.05,
    pH: 14.0,
    description: 'Potent caustic base with high solubility.',
  },
  {
    id: 'nh3_aq',
    name: 'Aqueous Ammonia (1.0 M)',
    formula: 'NH₃(aq) / NH₄OH',
    category: 'bases',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1.0 M',
    densityGPerMl: 0.99,
    pH: 11.6,
    description: 'Weak volatile alkali. Readily forms brilliant royal blue and purple amine coordination complexes with copper and nickel.',
  },
  {
    id: 'ca_oh2',
    name: 'Calcium Hydroxide / Limewater',
    formula: 'Ca(OH)₂(aq)',
    category: 'bases',
    state: 'liquid',
    color: '#f8fafc',
    concentration: 'Saturated (~0.02 M)',
    densityGPerMl: 1.0,
    pH: 12.4,
    description: 'Diagnostic limewater reagent: turns milky cloudy upon reacting with Carbon Dioxide (CO₂).',
  },
  {
    id: 'nahco3_sol',
    name: 'Sodium Bicarbonate Solution (1.0 M)',
    formula: 'NaHCO₃(aq)',
    category: 'bases',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1.0 M',
    densityGPerMl: 1.03,
    pH: 8.3,
    description: 'Baking soda solution. Effervesces with acids to generate thick foaming heads of CO₂ gas.',
  },

  // --- SALTS & COLORFUL TRANSITION METAL REAGENTS ---
  {
    id: 'cuso4_sol',
    name: 'Copper(II) Sulfate Solution (0.5 M)',
    formula: 'CuSO₄(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#0284c7', // Radiant Cerulean Blue
    concentration: '0.5 M',
    densityGPerMl: 1.08,
    pH: 4.2,
    description: 'Luminous azure blue solution of [Cu(H₂O)₆]²⁺. Yields royal blue gelatinous Cu(OH)₂ with NaOH.',
  },
  {
    id: 'cucl2_sol',
    name: 'Copper(II) Chloride Solution (0.5 M)',
    formula: 'CuCl₂(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#0d9488', // Emerald Aqua Turquoise
    concentration: '0.5 M',
    densityGPerMl: 1.07,
    pH: 3.6,
    description: 'Striking turquoise/emerald green solution. Changes color depending on chloride coordination.',
  },
  {
    id: 'fecl3_sol',
    name: 'Iron(III) Chloride Solution (0.5 M)',
    formula: 'FeCl₃(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#b45309', // Golden Amber Cognac
    concentration: '0.5 M',
    densityGPerMl: 1.06,
    pH: 2.0,
    description: 'Rich amber-brown solution. Yields deep Prussian Blue with ferrocyanide, and intense blood-red with KSCN!',
  },
  {
    id: 'feso4_sol',
    name: 'Iron(II) Sulfate Solution (0.5 M)',
    formula: 'FeSO₄(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#86efac', // Pale Seafoam Green
    concentration: '0.5 M',
    densityGPerMl: 1.05,
    pH: 3.8,
    description: 'Pale sea-green solution of Fe²⁺. Decolorizes purple permanganate in redox titrations.',
  },
  {
    id: 'kmno4_sol',
    name: 'Potassium Permanganate (0.05 M)',
    formula: 'KMnO₄(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#6b21a8', // Intense Royal Violet
    concentration: '0.05 M',
    densityGPerMl: 1.01,
    pH: 7.0,
    description: 'Vivid deep purple powerful oxidizing agent. Rapidly decolorizes to clear Mn²⁺ when reduced by Fe²⁺ or peroxide.',
  },
  {
    id: 'k2cr2o7_sol',
    name: 'Potassium Dichromate (0.2 M)',
    formula: 'K₂Cr₂O₇(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#ea580c', // Brilliant Fiery Orange
    concentration: '0.2 M',
    densityGPerMl: 1.05,
    pH: 4.0,
    description: 'Intense fiery neon orange oxidizer. In equilibrium with yellow chromate: shifts to yellow when base is added!',
    hazardNote: 'Toxic hexavalent chromium oxidizer.',
  },
  {
    id: 'k2cro4_sol',
    name: 'Potassium Chromate (0.2 M)',
    formula: 'K₂CrO₄(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#eab308', // Canary Sun Yellow
    concentration: '0.2 M',
    densityGPerMl: 1.04,
    pH: 8.5,
    description: 'Vivid bright yellow solution. Instantly turns fiery orange dichromate upon addition of acid!',
  },
  {
    id: 'cocl2_sol',
    name: 'Cobalt(II) Chloride Solution (0.5 M)',
    formula: 'CoCl₂(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f43f5e', // Striking Rose Pink
    concentration: '0.5 M',
    densityGPerMl: 1.06,
    pH: 5.5,
    description: 'Thermochromic reagent: aqueous [Co(H₂O)₆]²⁺ is brilliant rose-pink, but turns deep sapphire blue [CoCl₄]²⁻ when heated or in concentrated HCl!',
  },
  {
    id: 'niso4_sol',
    name: 'Nickel(II) Sulfate Solution (0.5 M)',
    formula: 'NiSO₄(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#10b981', // Radiant Apple Emerald Green
    concentration: '0.5 M',
    densityGPerMl: 1.07,
    pH: 4.5,
    description: 'Vibrant emerald green solution. Precipitates apple-green Ni(OH)₂ with NaOH, which dissolves in excess NH₃ to form deep purple-blue [Ni(NH₃)₆]²⁺!',
  },
  {
    id: 'kscn_sol',
    name: 'Potassium Thiocyanate (0.5 M)',
    formula: 'KSCN(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc', // Colorless
    concentration: '0.5 M',
    densityGPerMl: 1.03,
    pH: 7.0,
    description: 'Classic analytical and film reagent: reacts instantly with Iron(III) to generate an intense, horrifying ruby Blood-Red [Fe(SCN)]²⁺ complex!',
  },
  {
    id: 'k4fecn6_sol',
    name: 'Potassium Hexacyanoferrate(II) (0.2 M)',
    formula: 'K₄[Fe(CN)₆](aq)',
    category: 'salts',
    state: 'liquid',
    color: '#fef08a', // Pale straw yellow
    concentration: '0.2 M',
    densityGPerMl: 1.04,
    pH: 7.2,
    description: 'Forms the legendary, inky insoluble pigment "Prussian Blue" (Fe₄[Fe(CN)₆]₃) upon addition to Iron(III)!',
  },
  {
    id: 'ki_sol',
    name: 'Potassium Iodide Solution (0.5 M)',
    formula: 'KI(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '0.5 M',
    densityGPerMl: 1.07,
    pH: 7.0,
    description: 'Clear iodide source. Yields dazzling canary yellow crystalline precipitate PbI₂ ("Golden Rain") with Pb(NO₃)₂.',
  },
  {
    id: 'pbno32_sol',
    name: 'Lead(II) Nitrate Solution (0.2 M)',
    formula: 'Pb(NO₃)₂(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '0.2 M',
    densityGPerMl: 1.05,
    pH: 4.5,
    description: 'Clear solution of Pb²⁺. Famous for creating the sparkling "Golden Rain" yellow crystalline precipitate with KI.',
    hazardNote: 'Toxic heavy metal salt.',
  },
  {
    id: 'agno3_sol',
    name: 'Silver Nitrate Solution (0.1 M)',
    formula: 'AgNO₃(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '0.1 M',
    densityGPerMl: 1.02,
    pH: 6.0,
    description: 'Detects halides: forms curdy white AgCl, pale cream AgBr, and yellow AgI precipitates.',
    hazardNote: 'Stains skin dark upon exposure to UV light.',
  },
  {
    id: 'bacl2_sol',
    name: 'Barium Chloride Solution (0.2 M)',
    formula: 'BaCl₂(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '0.2 M',
    densityGPerMl: 1.04,
    pH: 6.5,
    description: 'Diagnostic reagent for sulfate ions. Produces dense milky white BaSO₄ precipitate.',
  },
  {
    id: 'nacl_sol',
    name: 'Sodium Chloride Saline (1.0 M)',
    formula: 'NaCl(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1.0 M',
    densityGPerMl: 1.04,
    pH: 7.0,
    description: 'Pure physiological table salt solution.',
  },
  {
    id: 'na2s2o3_sol',
    name: 'Sodium Thiosulfate Solution (0.5 M)',
    formula: 'Na₂S₂O₃(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '0.5 M',
    densityGPerMl: 1.05,
    pH: 7.2,
    description: 'Famous kinetics clock reagent. Acid decomposes it into a slowly clouding milky-yellow colloidal sulfur suspension!',
  },
  {
    id: 'i2_lugol',
    name: "Iodine Solution / Lugol's Tincture",
    formula: 'I₂ / KI(aq)',
    category: 'salts',
    state: 'liquid',
    color: '#78350f', // Rich Cognac Amber-Brown
    concentration: '0.05 M',
    densityGPerMl: 1.04,
    pH: 5.5,
    description: 'Amber-brown triiodide (I₃⁻). Reacts with starch to instantly trigger an inky midnight-blue black charge transfer complex!',
  },

  // --- METALS & SOLIDS ---
  {
    id: 'mg_ribbon',
    name: 'Magnesium Ribbon',
    formula: 'Mg(s)',
    category: 'metals',
    state: 'solid_strip',
    color: '#cbd5e1', // Lustrous bright silver
    densityGPerMl: 1.74,
    description: 'Extremely reactive alkaline earth metal. Generates rapid, violent bubbling of H₂ in acid with a steep temperature spike!',
  },
  {
    id: 'zn_metal',
    name: 'Zinc Metal Granules / Strips',
    formula: 'Zn(s)',
    category: 'metals',
    state: 'solid_strip',
    color: '#94a3b8', // Silver slate
    densityGPerMl: 7.14,
    description: 'Active transition metal. Displaces copper from CuSO₄ and effervesces H₂ gas with hydrochloric acid.',
  },
  {
    id: 'al_metal',
    name: 'Aluminum Granules / Foil',
    formula: 'Al(s)',
    category: 'metals',
    state: 'solid_strip',
    color: '#e2e8f0', // Bright shiny aluminum
    densityGPerMl: 2.7,
    description: 'Amphoteric metal: vigorous effervescence of H₂ with acids and strong caustic alkalis.',
  },
  {
    id: 'fe_filings',
    name: 'Iron Filings Powder',
    formula: 'Fe(s)',
    category: 'metals',
    state: 'solid_powder',
    color: '#334155', // Charcoal grey
    densityGPerMl: 7.87,
    description: 'Fine metallic iron powder. Displaces copper from CuSO₄ and reacts with acids.',
  },
  {
    id: 'cu_turnings',
    name: 'Copper Turnings / Foil',
    formula: 'Cu(s)',
    category: 'metals',
    state: 'solid_strip',
    color: '#d97706', // Copper bronze
    densityGPerMl: 8.96,
    description: 'Red-orange coinage metal. Displaces shiny silver needle crystals from AgNO₃ solution.',
  },
  {
    id: 'caco3_chips',
    name: 'Calcium Carbonate / Marble Chips',
    formula: 'CaCO₃(s)',
    category: 'metals',
    state: 'solid_powder',
    color: '#f1f5f9', // Chalk white
    densityGPerMl: 2.71,
    description: 'White mineral solid. Effervesces with acids to generate thick foaming bubbles of CO₂ gas.',
  },
  {
    id: 'mno2_powder',
    name: 'Manganese Dioxide Catalyst',
    formula: 'MnO₂(s)',
    category: 'metals',
    state: 'solid_powder',
    color: '#0f172a', // Midnight black
    densityGPerMl: 5.02,
    description: 'Fine black catalyst powder. Dramatically accelerates the violent decomposition of Hydrogen Peroxide into steaming hot O₂ and water.',
  },

  // --- INDICATORS & SPECIAL REAGENTS ---
  {
    id: 'phenolphthalein',
    name: 'Phenolphthalein Indicator Solution',
    formula: 'C₂₀H₁₄O₄ in EtOH',
    category: 'indicators',
    state: 'liquid',
    color: '#ffffff', // Colorless in acid, electric magenta-pink in base
    concentration: '1% w/v',
    pH: 7.0,
    description: 'Classic titration indicator. Completely colorless at pH < 8.2; turns fluorescent electric magenta-pink at pH > 8.2.',
  },
  {
    id: 'universal_ind',
    name: 'Universal Indicator Solution',
    formula: 'UI Mixture',
    category: 'indicators',
    state: 'liquid',
    color: '#22c55e', // Emerald green at neutral pH 7
    concentration: 'Standard',
    pH: 7.0,
    description: 'Multi-compound indicator displaying a full continuous rainbow spectrum across the entire pH 1 to 14 scale.',
  },
  {
    id: 'bromothymol_blue',
    name: 'Bromothymol Blue Indicator',
    formula: 'BTB (aq)',
    category: 'indicators',
    state: 'liquid',
    color: '#10b981', // Neutral emerald green
    concentration: '0.1%',
    pH: 7.0,
    description: 'Color transitions: canary yellow (pH < 6.0) ➔ green (pH 7.0) ➔ sapphire blue (pH > 7.6).',
  },
  {
    id: 'methyl_orange',
    name: 'Methyl Orange Indicator',
    formula: 'MO (aq)',
    category: 'indicators',
    state: 'liquid',
    color: '#f97316', // Orange
    concentration: '0.1%',
    pH: 4.0,
    description: 'Acid-base indicator: bright red in strong acid (pH < 3.1) and sunset yellow/orange in base (pH > 4.4).',
  },
  {
    id: 'starch_sol',
    name: 'Starch Indicator Solution',
    formula: '(C₆H₁₀O₅)n',
    category: 'indicators',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '1%',
    pH: 7.0,
    description: 'Forms an intense, inky midnight-blue/black charge-transfer complex in the presence of free Iodine (I₃⁻).',
  },
  {
    id: 'h2o2_10',
    name: 'Hydrogen Peroxide (10% Solution)',
    formula: 'H₂O₂(aq)',
    category: 'solvents',
    state: 'liquid',
    color: '#f8fafc',
    concentration: '10% (~3.0 M)',
    densityGPerMl: 1.04,
    pH: 6.2,
    description: 'Colorless oxidizing liquid. Decomposes into steaming hot Oxygen gas (O₂) and water when catalyzed by MnO₂.',
    hazardNote: 'Strong oxidizer. Bleaches organic matter.',
  },
  {
    id: 'distilled_h2o',
    name: 'Pure Distilled Water',
    formula: 'H₂O(l)',
    category: 'solvents',
    state: 'liquid',
    color: '#f8fafc',
    concentration: 'Pure',
    densityGPerMl: 1.0,
    pH: 7.0,
    molarMassGPerMol: 18.02,
    chemicalProperties: ['Pure universal polar solvent', 'Neutral pH 7.00', 'Dielectric constant 80.1', 'Density 1.00 g/mL'],
    description: 'Ultra-pure deionized water solvent with neutral pH 7.00.',
  },
];

export interface ChemicalMetaRecord {
  molarMass: number;
  molarity?: number;
  state: 'aq' | 's' | 'l' | 'g';
  densityGPerMl?: number;
  properties: string[];
}

export const CHEMICAL_METADATA_MAP: Record<string, ChemicalMetaRecord> = {
  // Acids
  hcl_1m: {
    molarMass: 36.46,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.02,
    properties: ['Strong monoprotic acid', 'Completely dissociated (H⁺ + Cl⁻)', 'pH ~ 0.1', 'Corrosive'],
  },
  hcl_6m: {
    molarMass: 36.46,
    molarity: 6.0,
    state: 'aq',
    densityGPerMl: 1.10,
    properties: ['Concentrated fuming acid', 'High hydronium [H₃O⁺]', 'Rapidly decomposes carbonates & active metals', 'pH ~ 0.0'],
  },
  h2so4_1m: {
    molarMass: 98.08,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.06,
    properties: ['Strong diprotic mineral acid', 'Precipitates insoluble sulfates (BaSO₄)', 'Dehydrating agent', 'pH ~ 0.3'],
  },
  hno3_1m: {
    molarMass: 63.01,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.05,
    properties: ['Strong oxidizing acid', 'Passivates aluminum', 'Forms highly soluble nitrates', 'pH ~ 0.2'],
  },
  ch3cooh_1m: {
    molarMass: 60.05,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.01,
    properties: ['Weak carboxylic acid', 'Partial ionization (pKa = 4.76)', 'Effervescent with bicarbonate', 'pH ~ 2.4'],
  },
  citric_acid: {
    molarMass: 192.12,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.03,
    properties: ['Triprotic organic acid', 'Natural chelating agent', 'Weak acid buffer', 'pH ~ 2.1'],
  },
  // Bases
  naoh_1m: {
    molarMass: 40.00,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Strong caustic alkali', 'Hydroxide donor (OH⁻)', 'High pH (~14.0)', 'Precipitates metal hydroxides'],
  },
  naoh_6m: {
    molarMass: 40.00,
    molarity: 6.0,
    state: 'aq',
    densityGPerMl: 1.22,
    properties: ['Concentrated caustic soda', 'Exothermic hydration', 'Attacks amphoteric aluminum foil', 'pH ~ 14.5'],
  },
  koh_1m: {
    molarMass: 56.11,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.05,
    properties: ['Strong caustic alkali', 'Deliquescent', 'High ionic mobility', 'pH ~ 14.0'],
  },
  nh3_aq: {
    molarMass: 17.03,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 0.99,
    properties: ['Weak base & Lewis ligand', 'Forms deep azure-violet amine complexes', 'Volatile pungent scent', 'pH ~ 11.6'],
  },
  ca_oh2: {
    molarMass: 74.09,
    molarity: 0.02,
    state: 'aq',
    densityGPerMl: 1.00,
    properties: ['Limewater reagent', 'Sparingly soluble base', 'Diagnostic CO₂ milkiness cloud test', 'pH ~ 12.4'],
  },
  nahco3_sol: {
    molarMass: 84.01,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.03,
    properties: ['Sodium bicarbonate', 'Amphoteric buffer', 'Effervesces CO₂ gas with acid', 'pH ~ 8.3'],
  },
  // Salts & Reagents
  cuso4_sol: {
    molarMass: 159.61,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.08,
    properties: ['Copper(II) sulfate', 'Radiant azure blue [Cu(H₂O)₆]²⁺', 'Precipitates blue Cu(OH)₂', 'Forms royal navy tetraammine with NH₃'],
  },
  cucl2_sol: {
    molarMass: 134.45,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.07,
    properties: ['Copper(II) chloride', 'Emerald-turquoise solution', 'Chloride coordination dependent', 'pH ~ 3.6'],
  },
  fecl3_sol: {
    molarMass: 162.20,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.06,
    properties: ['Iron(III) chloride', 'Amber-brown solution', 'Forms ruby blood-red [Fe(SCN)]²⁺', 'Forms Prussian Blue with ferrocyanide'],
  },
  feso4_sol: {
    molarMass: 151.91,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.05,
    properties: ['Iron(II) sulfate', 'Pale seafoam green Fe²⁺', 'Reducing agent in redox titrations', 'Decolorizes purple KMnO₄'],
  },
  kmno4_sol: {
    molarMass: 158.03,
    molarity: 0.05,
    state: 'aq',
    densityGPerMl: 1.01,
    properties: ['Potassium permanganate', 'Intense royal purple oxidizer', 'Mn(VII) oxidation state', 'Decolorizes upon reduction to Mn²⁺'],
  },
  k2cr2o7_sol: {
    molarMass: 294.18,
    molarity: 0.2,
    state: 'aq',
    densityGPerMl: 1.05,
    properties: ['Potassium dichromate', 'Fiery neon orange oxidizer', 'Cr(VI) oxidation state', 'Converts to yellow chromate in base'],
  },
  k2cro4_sol: {
    molarMass: 194.19,
    molarity: 0.2,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Potassium chromate', 'Bright canary yellow salt', 'Turns fiery orange dichromate in acid', 'pH ~ 8.5'],
  },
  cocl2_sol: {
    molarMass: 129.84,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.06,
    properties: ['Cobalt(II) chloride', 'Rose-pink octahedral complex', 'Thermochromic: turns sapphire blue when heated or in conc. HCl'],
  },
  niso4_sol: {
    molarMass: 154.75,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.07,
    properties: ['Nickel(II) sulfate', 'Vibrant apple-emerald green', 'Forms royal violet hexaammine with NH₃', 'pH ~ 4.5'],
  },
  kscn_sol: {
    molarMass: 97.18,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.03,
    properties: ['Potassium thiocyanate', 'Colorless reagent', 'Selective for Fe³⁺: forms intense blood-red complex'],
  },
  k4fecn6_sol: {
    molarMass: 368.35,
    molarity: 0.2,
    state: 'aq',
    densityGPerMl: 1.05,
    properties: ['Potassium ferrocyanide', 'Yellow crystal solution', 'Forms insoluble Prussian Blue pigment with Fe³⁺'],
  },
  agno3_sol: {
    molarMass: 169.87,
    molarity: 0.2,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Silver nitrate', 'Clear photosensitive oxidizer', 'Precipitates insoluble halides (AgCl, AgI)', 'Displaced by copper into silver needles'],
  },
  pbno32_sol: {
    molarMass: 331.21,
    molarity: 0.2,
    state: 'aq',
    densityGPerMl: 1.06,
    properties: ['Lead(II) nitrate', 'Soluble lead salt', 'Forms glittering Golden Rain PbI₂ flakes with KI', 'pH ~ 4.5'],
  },
  ki_sol: {
    molarMass: 166.00,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Potassium iodide', 'Halide reducing agent', 'Yields sparkling canary yellow PbI₂ with Pb²⁺', 'Solubilizes iodine'],
  },
  bacl2_sol: {
    molarMass: 208.23,
    molarity: 0.2,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Barium chloride', 'Diagnostic reagent for sulfate detection', 'Precipitates dense white BaSO₄ with H₂SO₄'],
  },
  nacl_sol: {
    molarMass: 58.44,
    molarity: 1.0,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Sodium chloride', 'Neutral electrolyte (pH 7.0)', 'Precipitates curdy white AgCl with AgNO₃'],
  },
  na2s2o3_sol: {
    molarMass: 158.11,
    molarity: 0.5,
    state: 'aq',
    densityGPerMl: 1.05,
    properties: ['Sodium thiosulfate', 'Iodine reducing agent', 'Undergoes acid clock disproportionation into colloidal sulfur'],
  },
  i2_lugol: {
    molarMass: 253.81,
    molarity: 0.05,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Lugol\'s iodine (I₃⁻)', 'Rich cognac amber-brown', 'Intercalates into starch helix producing inky midnight blue'],
  },
  // Metals & Solids
  mg_ribbon: {
    molarMass: 24.31,
    state: 's',
    densityGPerMl: 1.74,
    properties: ['Magnesium metal', 'Reactive alkaline earth metal (E° = -2.37 V)', 'Violent fizzing in acid releasing H₂', 'Silvery ribbon'],
  },
  zn_metal: {
    molarMass: 65.38,
    state: 's',
    densityGPerMl: 7.14,
    properties: ['Zinc metal', 'Granular reducing metal (E° = -0.76 V)', 'Bubbles H₂ gas in mineral acid'],
  },
  al_metal: {
    molarMass: 26.98,
    state: 's',
    densityGPerMl: 2.70,
    properties: ['Aluminum metal', 'Amphoteric metal: dissolves in acid & hot NaOH', 'Generates H₂ gas', 'Silver granules'],
  },
  fe_filings: {
    molarMass: 55.85,
    state: 's',
    densityGPerMl: 7.87,
    properties: ['Iron metal powder', 'Ferromagnetic transition metal', 'Displaces Cu²⁺ to plate copper on iron'],
  },
  cu_turnings: {
    molarMass: 63.55,
    state: 's',
    densityGPerMl: 8.96,
    properties: ['Copper metal', 'Coinage metal', 'Displaces Ag⁺ to grow dendritic silver crystals', 'Red-bronze foil'],
  },
  caco3_chips: {
    molarMass: 100.09,
    state: 's',
    densityGPerMl: 2.71,
    properties: ['Calcium carbonate', 'Insoluble marble chips', 'Effervesces CO₂ gas with acids', 'Chalk white solid'],
  },
  mno2_powder: {
    molarMass: 86.94,
    state: 's',
    densityGPerMl: 5.02,
    properties: ['Manganese dioxide', 'Heterogeneous catalyst for H₂O₂ decomposition', 'Midnight black insoluble powder'],
  },
  // Indicators & Solvents
  phenolphthalein: {
    molarMass: 318.32,
    state: 'aq',
    properties: ['pH indicator', 'Colorless below pH 8.2', 'Fluorescent magenta-pink above pH 8.2'],
  },
  universal_ind: {
    molarMass: 280.00,
    state: 'aq',
    properties: ['Universal pH indicator', 'Rainbow transition (Red: acid ➔ Green: pH 7 ➔ Violet: alkali)'],
  },
  bromothymol_blue: {
    molarMass: 624.38,
    state: 'aq',
    properties: ['pH indicator', 'Yellow below pH 6.0, green at pH 7.0, blue above pH 7.6'],
  },
  methyl_orange: {
    molarMass: 327.33,
    state: 'aq',
    properties: ['pH indicator', 'Red below pH 3.1, sunset yellow above pH 4.4'],
  },
  starch_sol: {
    molarMass: 162.14,
    state: 'aq',
    properties: ['Starch indicator', 'Forms intense inky blue complex with free iodine (I₃⁻)'],
  },
  h2o2_10: {
    molarMass: 34.01,
    molarity: 3.0,
    state: 'aq',
    densityGPerMl: 1.04,
    properties: ['Hydrogen peroxide (10%)', 'Strong oxidizer & unstable peroxide', 'Decomposes into O₂ gas and steam'],
  },
  distilled_h2o: {
    molarMass: 18.02,
    molarity: 55.5,
    state: 'l',
    densityGPerMl: 1.00,
    properties: ['Pure distilled water', 'Neutral universal solvent (pH 7.00)', 'Density 1.00 g/mL'],
  },
};

/**
 * Returns accurate chemical metadata (molar mass, state, properties) for any chemical ID
 */
export function getChemicalMetadata(chemicalId: string): ChemicalMetaRecord {
  if (CHEMICAL_METADATA_MAP[chemicalId]) {
    return CHEMICAL_METADATA_MAP[chemicalId];
  }
  const item = ALL_CHEMICALS.find((c) => c.id === chemicalId);
  return {
    molarMass: item?.molarMassGPerMol || 50.0,
    molarity: item?.concentration?.includes('M') ? parseFloat(item.concentration) : undefined,
    state: (item?.state?.startsWith('solid') ? 's' : 'aq') as 'aq' | 's' | 'l' | 'g',
    densityGPerMl: item?.densityGPerMl || 1.0,
    properties: item?.description ? [item.description] : ['Aqueous chemical solution'],
  };
}

/**
 * Accurately calculates moles and mass for a chemical item by amount (volume mL or mass g)
 */
export function calculateChemicalMoles(chemicalId: string, amountMl: number): { moles: number; massG: number } {
  const meta = getChemicalMetadata(chemicalId);
  if (meta.molarity !== undefined) {
    // Liquid solution: moles = Molarity * Volume(L)
    const moles = Number(((amountMl * meta.molarity) / 1000).toFixed(5));
    const density = meta.densityGPerMl || 1.0;
    const massG = Number((amountMl * density).toFixed(2));
    return { moles, massG };
  } else {
    // Solid powder or pure substance: amountMl is grams
    const massG = Number(amountMl.toFixed(2));
    const moles = Number((massG / meta.molarMass).toFixed(5));
    return { moles, massG };
  }
}

export const VESSEL_SPECS: Record<
  VesselType,
  { name: string; capacityMl: number; shape: string; iconName: string; defaultHeightPx: number }
> = {
  beaker_250_open: {
    name: '250 mL Open Beaker (Mass Changes)',
    capacityMl: 250,
    shape: 'Open rim with spout • Gas escapes to air, mass decreases',
    iconName: 'Beaker',
    defaultHeightPx: 175,
  },
  beaker_250_closed: {
    name: '250 mL Closed Beaker (Mass Constant)',
    capacityMl: 250,
    shape: 'Airtight sealed lid • Gas trapped inside, mass constant',
    iconName: 'Beaker',
    defaultHeightPx: 175,
  },
  beaker_250: {
    name: '250 mL Open Beaker',
    capacityMl: 250,
    shape: 'Open cylindrical with spout',
    iconName: 'Beaker',
    defaultHeightPx: 175,
  },
  erlenmeyer_250: {
    name: '250 mL Erlenmeyer Conical Flask',
    capacityMl: 250,
    shape: 'Conical base with narrow neck',
    iconName: 'FlaskConical',
    defaultHeightPx: 190,
  },
  test_tube_50: {
    name: '50 mL Glass Test Tube',
    capacityMl: 50,
    shape: 'Narrow rounded bottom tube',
    iconName: 'TestTube',
    defaultHeightPx: 195,
  },
  graduated_100: {
    name: '100 mL Graduated Cylinder',
    capacityMl: 100,
    shape: 'Tall graduated cylinder',
    iconName: 'Columns3',
    defaultHeightPx: 215,
  },
  burette_50: {
    name: '50 mL Titration Burette with Stopcock',
    capacityMl: 50,
    shape: 'Precision graduated tube with tap',
    iconName: 'Pipette',
    defaultHeightPx: 235,
  },
  evaporating_dish: {
    name: '100 mL Porcelain Evaporating Dish',
    capacityMl: 100,
    shape: 'Shallow wide bowl',
    iconName: 'Disc',
    defaultHeightPx: 110,
  },
};

export const GUIDED_EXPERIMENTS: ExperimentPreset[] = [
  {
    id: 'conservation_of_mass_beakers',
    title: 'Law of Conservation of Mass: Open vs Closed Beaker',
    category: 'Fundamental Chemistry',
    difficulty: 'Beginner',
    summary:
      'Compare an Open Beaker against a Closed Airtight Beaker during gas-releasing effervescence! In the Open Beaker, CO₂ gas escapes and mass decreases on the scale. In the Closed Beaker, mass remains strictly constant.',
    expectedEquation: 'NaHCO₃(aq) + HCl(aq) ➔ NaCl(aq) + H₂O(l) + CO₂(g)↑ [Open: Δm < 0 | Closed: Δm = 0]',
    initialVessels: [
      {
        type: 'beaker_250_open',
        name: 'Vessel 1: Open Beaker (Mass Changes)',
        chemicals: [
          { chemicalId: 'nahco3_sol', amountMl: 30 },
          { chemicalId: 'hcl_1m', amountMl: 20 },
        ],
      },
      {
        type: 'beaker_250_closed',
        name: 'Vessel 2: Closed Beaker (Mass Constant)',
        chemicals: [
          { chemicalId: 'nahco3_sol', amountMl: 30 },
          { chemicalId: 'hcl_1m', amountMl: 20 },
        ],
      },
    ],
    suggestedSteps: [
      'Observe Vessel 1 (Open Beaker): effervescent CO₂ gas escapes into surroundings. Check the Digital Analytical Scale to see mass drop by ~1.05 g!',
      'Observe Vessel 2 (Closed Beaker with airtight lid): gas bubbles form but remain trapped inside. Total mass remains 100% constant, proving Lavoisier’s Law of Conservation of Mass.',
      'Click the "Open Lid" button on Vessel 2 to unseal it: watch the trapped gas whoosh out and the mass immediately drop!',
    ],
  },
  {
    id: 'golden_rain',
    title: 'The Golden Rain: Lead(II) Iodide Precipitation',
    category: 'Inorganic Chemistry',
    difficulty: 'Intermediate',
    summary:
      'Mix two crystal-clear colorless solutions of Lead(II) Nitrate and Potassium Iodide to instantly precipitate brilliant canary-yellow sparkling crystals of Lead(II) Iodide!',
    expectedEquation: 'Pb(NO₃)₂(aq) + 2KI(aq) ➔ PbI₂(s)↓ (Golden Sparkling Crystals) + 2KNO₃(aq)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Beaker A (Lead Nitrate)',
        chemicals: [{ chemicalId: 'pbno32_sol', amountMl: 30 }],
      },
      {
        type: 'beaker_250',
        name: 'Beaker B (Potassium Iodide)',
        chemicals: [{ chemicalId: 'ki_sol', amountMl: 30 }],
      },
    ],
    suggestedSteps: [
      'Pour 25 mL of Potassium Iodide (Beaker B) into Beaker A.',
      'Watch the instantaneous precipitation of dazzling yellow PbI₂ crystals suspended in solution!',
      'Turn on the Bunsen burner under Beaker A: the yellow precipitate dissolves upon heating, then crystallizes into sparkling golden flakes as it cools!',
    ],
  },
  {
    id: 'prussian_blue',
    title: 'Synthesis of Prussian Blue Pigment',
    category: 'Coordination Chemistry',
    difficulty: 'Intermediate',
    summary:
      'Combine amber-brown Iron(III) Chloride with pale yellow Potassium Ferrocyanide to instantly produce the legendary, inky deep royal navy pigment "Prussian Blue"!',
    expectedEquation: '4FeCl₃(aq) + 3K₄[Fe(CN)₆](aq) ➔ Fe₄[Fe(CN)₆]₃(s)↓ (Deep Inky Navy Blue) + 12KCl(aq)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Iron(III) Solution',
        chemicals: [{ chemicalId: 'fecl3_sol', amountMl: 35 }],
      },
      {
        type: 'beaker_250',
        name: 'Ferrocyanide Solution',
        chemicals: [{ chemicalId: 'k4fecn6_sol', amountMl: 35 }],
      },
    ],
    suggestedSteps: [
      'Observe the amber-gold color of the Iron(III) Chloride solution.',
      'Pour 20 mL of Potassium Ferrocyanide into the beaker.',
      'Witness the immediate, dramatic precipitation of deep royal navy "Prussian Blue" pigment!',
    ],
  },
  {
    id: 'blood_red_thiocyanate',
    title: 'The Blood-Red Thiocyanate Complex (Film Blood Test)',
    category: 'Analytical Chemistry',
    difficulty: 'Beginner',
    summary:
      'Mix amber Iron(III) Chloride with colorless Potassium Thiocyanate. An instantaneous, vivid ruby blood-red coordination complex forms with extreme sensitivity!',
    expectedEquation: 'Fe³⁺(aq) + SCN⁻(aq) ➔ [Fe(SCN)]²⁺(aq) (Intense Ruby Blood-Red Complex)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Reaction Beaker',
        chemicals: [
          { chemicalId: 'fecl3_sol', amountMl: 25 },
          { chemicalId: 'distilled_h2o', amountMl: 30 },
        ],
      },
      {
        type: 'beaker_250',
        name: 'KSCN Reagent',
        chemicals: [{ chemicalId: 'kscn_sol', amountMl: 30 }],
      },
    ],
    suggestedSteps: [
      'Observe the pale amber-yellow diluted Iron(III) solution.',
      'Pour 10 mL of colorless KSCN into the beaker.',
      'Watch the solution abruptly flash into a deep, terrifyingly realistic ruby blood-red [Fe(SCN)]²⁺ complex!',
    ],
  },
  {
    id: 'cobalt_thermochromism',
    title: 'Cobalt Chloride Thermochromism (Temperature-Driven Color Shift)',
    category: 'Chemical Equilibrium',
    difficulty: 'Advanced',
    summary:
      'Observe Le Chatelier’s principle in real time: pink octahedral [Co(H₂O)₆]²⁺ turns into brilliant sapphire blue tetrahedral [CoCl₄]²⁻ when heated or exposed to concentrated HCl!',
    expectedEquation: '[Co(H₂O)₆]²⁺ (Pink) + 4Cl⁻ ⇌ [CoCl₄]²⁻ (Sapphire Blue) + 6H₂O  [Endothermic ΔH > 0]',
    initialVessels: [
      {
        type: 'erlenmeyer_250',
        name: 'Cobalt Equilibrium Flask',
        chemicals: [
          { chemicalId: 'cocl2_sol', amountMl: 30 },
          { chemicalId: 'hcl_6m', amountMl: 20 },
        ],
      },
    ],
    suggestedSteps: [
      'The flask starts as rose-pink [Co(H₂O)₆]²⁺ at room temperature (~22°C).',
      'Turn on the Bunsen burner under the flask: as temperature rises above 55°C, the pink color dynamically shifts into an electric deep sapphire blue [CoCl₄]²⁻!',
      'Turn off the burner: as the flask cools back down, the equilibrium reverses back to rose-pink!',
    ],
  },
  {
    id: 'chromate_dichromate_flip',
    title: 'Chromate-Dichromate pH Color Flip',
    category: 'Chemical Equilibrium',
    difficulty: 'Intermediate',
    summary:
      'Demonstrate pH-dependent equilibrium: yellow chromate (CrO₄²⁻) instantly turns fiery orange dichromate (Cr₂O₇²⁻) with acid, and reverses back with base!',
    expectedEquation: '2CrO₄²⁻(aq) (Canary Yellow) + 2H⁺(aq) ⇌ Cr₂O₇²⁻(aq) (Fiery Orange) + H₂O(l)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Chromate Beaker',
        chemicals: [{ chemicalId: 'k2cro4_sol', amountMl: 40 }],
      },
    ],
    suggestedSteps: [
      'Beaker starts with bright canary sun-yellow Potassium Chromate (CrO₄²⁻).',
      'Add 10 mL of Hydrochloric Acid (HCl): watch the color instantly switch from yellow to fiery blazing orange (Cr₂O₇²⁻)!',
      'Now add 15 mL of Sodium Hydroxide (NaOH): watch the color effortlessly flip right back to canary yellow!',
    ],
  },
  {
    id: 'elephant_toothpaste',
    title: 'Catalytic Peroxide Decomposition (Elephant Toothpaste)',
    category: 'Kinetics & Catalysis',
    difficulty: 'Intermediate',
    summary:
      'Catalyze the decomposition of Hydrogen Peroxide with solid Manganese Dioxide: furious boiling effervescence, steaming hot oxygen gas, and a thick foaming head!',
    expectedEquation: '2H₂O₂(aq) ──[MnO₂]──➔ 2H₂O(l) + O₂(g)↑  [High Exothermicity: ΔT > +25°C]',
    initialVessels: [
      {
        type: 'erlenmeyer_250',
        name: 'Catalytic Flask',
        chemicals: [{ chemicalId: 'h2o2_10', amountMl: 50 }],
      },
    ],
    suggestedSteps: [
      'The flask contains 50 mL of 10% Hydrogen Peroxide.',
      'Add 5 g of black Manganese Dioxide (MnO₂) catalyst from the chemical drawer.',
      'Watch the furious volcanic effervescence, thick foaming head, and billowing hot steam as pure Oxygen gas is liberated in seconds!',
    ],
  },
  {
    id: 'hydrogen_gas_rocket',
    title: 'Hydrogen Gas Generation (Metal + Acid)',
    category: 'Gas Chemistry',
    difficulty: 'Beginner',
    summary:
      'React reactive Magnesium ribbon or Zinc with Hydrochloric Acid to generate violent bubbling effervescence of flammable Hydrogen gas (H₂) and a sharp temperature spike!',
    expectedEquation: 'Mg(s) + 2HCl(aq) ➔ MgCl₂(aq) + H₂(g)↑  [ΔH = -462 kJ/mol]',
    initialVessels: [
      {
        type: 'test_tube_50',
        name: 'Reaction Test Tube',
        chemicals: [
          { chemicalId: 'hcl_6m', amountMl: 15 },
          { chemicalId: 'mg_ribbon', amountMl: 5 },
        ],
      },
    ],
    suggestedSteps: [
      'Observe the rapid bubbling and effervescence of Hydrogen gas surging through the test tube!',
      'Check the digital thermometer to see the substantial temperature rise (+18°C) from the exothermic displacement reaction.',
      'Check the gas collection readout: detects pure flammable H₂ gas evolved.',
    ],
  },
  {
    id: 'iodine_starch_complex',
    title: 'Iodine-Starch Inky Blue Charge-Transfer Complex',
    category: 'Biochemical / Analytical',
    difficulty: 'Beginner',
    summary:
      'Add amber-brown Iodine solution to colorless Starch: helical amylose traps triiodide to generate a striking inky midnight navy-blue complex!',
    expectedEquation: 'I₃⁻(aq) + Starch(aq) ➔ [Starch-I₃⁻] (Deep Inky Midnight Navy Blue Complex)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Starch Solution',
        chemicals: [
          { chemicalId: 'distilled_h2o', amountMl: 40 },
          { chemicalId: 'starch_sol', amountMl: 10 },
        ],
      },
      {
        type: 'beaker_250',
        name: 'Iodine Reagent',
        chemicals: [{ chemicalId: 'i2_lugol', amountMl: 25 }],
      },
    ],
    suggestedSteps: [
      'The starch solution is completely clear and colorless.',
      'Add 5 mL of amber-brown Iodine into the starch solution.',
      'Observe the instant transformation into an intense, inky midnight sapphire blue/black complex!',
      'Add 10 mL of Sodium Thiosulfate (Na₂S₂O₃): watch the inky blue color instantly decolorize back to clear as iodine is reduced to iodide!',
    ],
  },
  {
    id: 'thiosulfate_acid_clock',
    title: 'Thiosulfate Acid Clock (Colloidal Sulfur Light Blinding)',
    category: 'Reaction Kinetics',
    difficulty: 'Intermediate',
    summary:
      'Sodium Thiosulfate disproportionates upon acidification to generate a dense, milky-yellow colloidal sulfur cloud that slowly obscures light!',
    expectedEquation: 'Na₂S₂O₃(aq) + 2HCl(aq) ➔ 2NaCl(aq) + H₂O(l) + SO₂(g)↑ + S(s)↓ (Colloidal Sulfur Cloud)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Kinetics Beaker',
        chemicals: [
          { chemicalId: 'na2s2o3_sol', amountMl: 35 },
          { chemicalId: 'distilled_h2o', amountMl: 25 },
        ],
      },
    ],
    suggestedSteps: [
      'Beaker starts crystal clear.',
      'Add 15 mL of Hydrochloric Acid (HCl).',
      'Watch as a fine milky-yellow colloidal sulfur turbidity develops, growing increasingly dense and cloudy until the solution is completely opaque!',
    ],
  },
  {
    id: 'copper_hydroxide_thermal',
    title: 'Copper Hydroxide & Thermal Dehydration',
    category: 'Thermodynamics',
    difficulty: 'Intermediate',
    summary:
      'Precipitate gelatinous azure blue Copper(II) Hydroxide with NaOH, then heat with a Bunsen burner to thermally dehydrate into velvety jet-black Copper(II) Oxide!',
    expectedEquation: 'CuSO₄(aq) + 2NaOH(aq) ➔ Cu(OH)₂(s)↓ (Gelatinous Blue) ──[Heat Δ]──➔ CuO(s)↓ (Jet Black) + H₂O(l)',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Reaction Beaker',
        chemicals: [
          { chemicalId: 'cuso4_sol', amountMl: 30 },
          { chemicalId: 'naoh_1m', amountMl: 25 },
        ],
      },
    ],
    suggestedSteps: [
      'Notice the gelatinous royal blue Cu(OH)₂ precipitate formed from CuSO₄ + NaOH.',
      'Click "Heat with Bunsen Burner" to place the beaker over the roaring flame.',
      'As temperature exceeds 65°C, observe the blue precipitate thermally dehydrate into velvety jet-black Copper(II) Oxide (CuO)!',
    ],
  },
  {
    id: 'acid_base_titration',
    title: 'Acid-Base Neutralization & Titration',
    category: 'Analytical Chemistry',
    difficulty: 'Beginner',
    summary:
      'Neutralize strong acid (HCl) with strong base (NaOH) in the presence of Phenolphthalein. Observe the sharp colorless to magenta pink transition at the equivalence point!',
    expectedEquation: 'HCl(aq) + NaOH(aq) ➔ NaCl(aq) + H₂O(l)  [ΔH = -57.3 kJ/mol Exothermic]',
    initialVessels: [
      {
        type: 'erlenmeyer_250',
        name: 'Titration Flask',
        chemicals: [
          { chemicalId: 'hcl_1m', amountMl: 25 },
          { chemicalId: 'phenolphthalein', amountMl: 2 },
          { chemicalId: 'distilled_h2o', amountMl: 20 },
        ],
      },
      {
        type: 'burette_50',
        name: 'NaOH Burette',
        chemicals: [{ chemicalId: 'naoh_1m', amountMl: 40 }],
      },
    ],
    suggestedSteps: [
      'Observe the titration flask: it is colorless because phenolphthalein is colorless in acidic solution (pH ~0.8).',
      'Dispense NaOH dropwise from the burette into the flask while monitoring the digital pH meter.',
      'As you reach ~25 mL of NaOH added, observe the solution abruptly turn fluorescent magenta pink (pH > 8.2) and the temperature warm from exothermic neutralization!',
    ],
  },
  {
    id: 'universal_indicator_rainbow',
    title: 'Universal Indicator Rainbow Spectrum',
    category: 'Acids & Bases',
    difficulty: 'Beginner',
    summary:
      'Explore the complete pH spectrum from Red (pH 1 strongly acidic) to Green (pH 7 neutral) to Violet (pH 14 strongly alkaline) using Universal Indicator.',
    expectedEquation: 'H⁺(aq) + OH⁻(aq) ⇌ H₂O(l) [Continuous pH 0 to 14 Spectrum]',
    initialVessels: [
      {
        type: 'beaker_250',
        name: 'Spectrum Beaker',
        chemicals: [
          { chemicalId: 'distilled_h2o', amountMl: 40 },
          { chemicalId: 'universal_ind', amountMl: 5 },
        ],
      },
    ],
    suggestedSteps: [
      'The water with universal indicator glows emerald green at neutral pH 7.0.',
      'Add drops of Hydrochloric Acid (HCl) to watch it shift to yellow, then orange, then vivid crimson red (pH < 2).',
      'Now add drops of Sodium Hydroxide (NaOH) to sweep the color back through green, sapphire blue, and deep royal violet (pH > 12)!',
    ],
  },
];
