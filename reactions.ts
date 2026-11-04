import { ChemicalReaction } from '../types/chemistry';

export const REACTIONS: ChemicalReaction[] = [
  {
    id: 'methane_combustion',
    name: 'Methane Combustion',
    equation: 'CH₄ + 2 O₂  ⟶  CO₂ + 2 H₂O  +  891 kJ',
    description: 'The fundamental hydrocarbon burning reaction that heats homes and powers natural gas turbine generators. Highly exothermic with an activation energy barrier provided by a spark.',
    type: 'combustion',
    enthalpyDeltaH: -891, // kJ/mol (Exothermic)
    entropyDeltaS: -5.3, // J/(mol·K)
    gibbsFreeEnergyDeltaG: -889.4, // kJ/mol at 298.15 K
    activationEnergyEa: 125,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic (ΔH = -891 kJ/mol) with minor entropy change (ΔS = -5.3 J/(mol·K)). Strongly spontaneous (ΔG° = -889.4 kJ/mol) driven by energetic C=O and O-H bond formation.',
    reactants: [
      { formula: 'CH₄', name: 'Methane', count: 1, moleculeId: 'methane' },
      { formula: 'O₂', name: 'Oxygen gas', count: 2 },
    ],
    products: [
      { formula: 'CO₂', name: 'Carbon Dioxide', count: 1, moleculeId: 'carbon_dioxide' },
      { formula: 'H₂O', name: 'Water vapor', count: 2, moleculeId: 'water' },
    ],
    stages: [
      {
        title: 'Reactants Approach',
        description: 'CH₄ tetrahedral molecule and two diatomic O=O molecules collide with thermal kinetic velocity.',
        progress: 0.15,
        stateName: 'Initial Reactants (CH₄ + 2O₂)',
      },
      {
        title: 'Transition State & Bond Breaking',
        description: 'Activation energy Ea overcomes the strong C-H (414 kJ/mol) and O=O (498 kJ/mol) bonds. High-energy activated complex forms.',
        progress: 0.50,
        stateName: 'Activated Complex [Transition State]',
      },
      {
        title: 'New Bond Formation & Heat Release',
        description: 'Ultra-stable C=O double bonds (804 kJ/mol) and O-H bonds (463 kJ/mol) snap into place, releasing 891 kJ/mol as exothermic heat.',
        progress: 0.85,
        stateName: 'Products & Thermal Energy',
      },
      {
        title: 'Reaction Complete',
        description: 'One CO₂ and two H₂O molecules depart with high kinetic momentum.',
        progress: 1.0,
        stateName: 'Final Products (CO₂ + 2H₂O)',
      },
    ],
  },
  {
    id: 'water_synthesis',
    name: 'Water Synthesis (Hydrogen Oxy-Hydrogen Combustion)',
    equation: '2 H₂ + O₂  ⟶  2 H₂O  +  572 kJ',
    description: 'Clean rocket propulsion fuel chemistry! Hydrogen and oxygen gas combust with exceptional gravimetric energy density, producing exclusively pure water as the byproduct.',
    type: 'synthesis',
    enthalpyDeltaH: -572,
    entropyDeltaS: -326.6,
    gibbsFreeEnergyDeltaG: -474.6,
    activationEnergyEa: 160,
    isExothermic: true,
    thermodynamicsSummary: 'Highly exothermic (ΔH = -572 kJ/mol). Large entropy decrease (ΔS = -326.6 J/(mol·K)) as 3 moles of gas condense into liquid water. Strongly spontaneous at room temperature (ΔG° = -474.6 kJ/mol) due to dominant enthalpy release.',
    reactants: [
      { formula: 'H₂', name: 'Hydrogen gas', count: 2 },
      { formula: 'O₂', name: 'Oxygen gas', count: 1 },
    ],
    products: [
      { formula: 'H₂O', name: 'Water', count: 2, moleculeId: 'water' },
    ],
    stages: [
      {
        title: 'Diatomic Gas Mixture',
        description: 'Two H-H diatomic molecules and one O=O double-bonded oxygen collide.',
        progress: 0.15,
        stateName: 'Reactant Gases (2H₂ + O₂)',
      },
      {
        title: 'Radical Chain Initiation',
        description: 'Thermal spark homolytically cleaves H-H and O=O into radical intermediates (H•, •OH, •O•).',
        progress: 0.50,
        stateName: 'Radical Transition State',
      },
      {
        title: 'Bent H₂O Condensation',
        description: 'Protons and oxygen lone pairs orient into 104.5° bent geometry with strong covalent sigma bonds.',
        progress: 0.85,
        stateName: 'O-H Bond Formation',
      },
      {
        title: 'Water Molecules Stable',
        description: 'Two stable water molecules with 1.85 Debye dipole moments carry away the enthalpy release.',
        progress: 1.0,
        stateName: '2 H₂O Molecules',
      },
    ],
  },
  {
    id: 'haber_bosch',
    name: 'Haber-Bosch Ammonia Synthesis',
    equation: 'N₂ + 3 H₂  ⇌  2 NH₃  +  92 kJ',
    description: 'The Nobel prize-winning reaction sustaining global agriculture. Nitrogen’s ultra-strong triple bond (945 kJ/mol) is cleaved over an iron catalyst at 450 °C and 200 atm.',
    type: 'synthesis',
    enthalpyDeltaH: -92.2,
    entropyDeltaS: -198.7,
    gibbsFreeEnergyDeltaG: -32.9,
    activationEnergyEa: 230,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic (ΔH = -92.2 kJ/mol) with entropy penalty (ΔS = -198.7 J/(mol·K)) due to 4 gas molecules converting into 2. Spontaneous at standard room temperature (ΔG° = -32.9 kJ/mol), but requires catalyst and high pressure at industrial 450 °C.',
    reactants: [
      { formula: 'N₂', name: 'Dinitrogen gas', count: 1 },
      { formula: 'H₂', name: 'Hydrogen gas', count: 3 },
    ],
    products: [
      { formula: 'NH₃', name: 'Ammonia', count: 2, moleculeId: 'ammonia' },
    ],
    stages: [
      {
        title: 'Adsorption on Iron Catalyst',
        description: 'N₂ and H₂ molecules adsorb onto the Fe-K₂O-Al₂O₃ heterogeneous catalyst surface.',
        progress: 0.20,
        stateName: 'Dissociative Chemisorption',
      },
      {
        title: 'N≡N Triple Bond Dissociation',
        description: 'High pressure and catalytic active sites weaken the inert 945 kJ/mol triple bond, yielding atomic N and H radicals.',
        progress: 0.50,
        stateName: 'Surface Intermediate [N + 3H]',
      },
      {
        title: 'Sequential Hydrogenation',
        description: 'Atomic nitrogen binds successive hydrogen atoms (NH, then NH₂, then NH₃).',
        progress: 0.80,
        stateName: 'NH₃ Desorption',
      },
      {
        title: 'Ammonia Product Release',
        description: 'Two trigonal pyramidal NH₃ molecules (107.3° bond angles) depart into the gas stream.',
        progress: 1.0,
        stateName: '2 NH₃ Molecules',
      },
    ],
  },
  {
    id: 'photosynthesis',
    name: 'Photosynthesis (Solar Carbohydrate Synthesis)',
    equation: '6 CO₂ + 6 H₂O + Solar Photons  ⟶  C₆H₁₂O₆ + 6 O₂',
    description: 'The biochemical engine of the biosphere. Plants harness sunlight photons in chlorophyll photosystems to reduce carbon dioxide into glucose, storing solar energy in chemical bonds.',
    type: 'biochemical',
    enthalpyDeltaH: 2805, // Endothermic
    entropyDeltaS: -260.0,
    gibbsFreeEnergyDeltaG: 2882.5,
    activationEnergyEa: 350,
    isExothermic: false,
    thermodynamicsSummary: 'Endothermic (ΔH = +2805 kJ/mol) and entropy-disfavored (ΔS = -260.0 J/(mol·K)). Non-spontaneous (ΔG° = +2882.5 kJ/mol); driven solely by quantum solar photons absorbed in chlorophyll photosystems.',
    reactants: [
      { formula: 'CO₂', name: 'Carbon Dioxide', count: 6, moleculeId: 'carbon_dioxide' },
      { formula: 'H₂O', name: 'Water', count: 6, moleculeId: 'water' },
    ],
    products: [
      { formula: 'C₆H₁₂O₆', name: 'D-Glucose', count: 1, moleculeId: 'glucose' },
      { formula: 'O₂', name: 'Oxygen gas', count: 6 },
    ],
    stages: [
      {
        title: 'Light-Dependent Photolysis',
        description: 'Chlorophyll P680 splits H₂O in the Thylakoid membrane, releasing O₂ gas and generating ATP and NADPH.',
        progress: 0.25,
        stateName: 'Photolysis (H₂O Splitting)',
      },
      {
        title: 'Calvin-Benson Carbon Fixation',
        description: 'RuBisCO enzyme fixes atmospheric CO₂ into 3-phosphoglycerate (3-PGA) using chemical energy.',
        progress: 0.55,
        stateName: 'Carbon Fixation Complex',
      },
      {
        title: 'Hexose Sugar Condensation',
        description: 'Glyceraldehyde-3-phosphate molecules condense and isomerize into stable cyclic D-glucose.',
        progress: 0.85,
        stateName: 'Chair Conformation Ring Closure',
      },
      {
        title: 'Glucose & Oxygen Complete',
        description: 'One high-energy C₆H₁₂O₆ molecule and six O₂ molecules are produced.',
        progress: 1.0,
        stateName: 'Products (Glucose + 6 O₂)',
      },
    ],
  },
  {
    id: 'cellular_respiration',
    name: 'Cellular Respiration (Glucose Aerobic Oxidation)',
    equation: 'C₆H₁₂O₆ + 6 O₂  ⟶  6 CO₂ + 6 H₂O  +  30-32 ATP',
    description: 'The universal metabolic oxidation powering eukaryotic life. Mitochondria combust glucose in a controlled cascade, converting chemical potential energy into ATP currency.',
    type: 'biochemical',
    enthalpyDeltaH: -2880,
    entropyDeltaS: 260.0,
    gibbsFreeEnergyDeltaG: -2957.5,
    activationEnergyEa: 180,
    isExothermic: true,
    thermodynamicsSummary: 'Highly exothermic (ΔH = -2880 kJ/mol) and entropy-favored (ΔS = +260.0 J/(mol·K)). Spontaneous at all temperatures (ΔG° = -2957.5 kJ/mol), efficiently harnessed to synthesize ATP.',
    reactants: [
      { formula: 'C₆H₁₂O₆', name: 'D-Glucose', count: 1, moleculeId: 'glucose' },
      { formula: 'O₂', name: 'Oxygen gas', count: 6 },
    ],
    products: [
      { formula: 'CO₂', name: 'Carbon Dioxide', count: 6, moleculeId: 'carbon_dioxide' },
      { formula: 'H₂O', name: 'Water', count: 6, moleculeId: 'water' },
    ],
    stages: [
      {
        title: 'Glycolysis & Pyruvate Decarboxylation',
        description: 'Glucose is cleaved in cytoplasm into two 3-carbon pyruvates, entering mitochondria as Acetyl-CoA.',
        progress: 0.20,
        stateName: 'Glycolytic Cleavage',
      },
      {
        title: 'Citric Acid (Krebs) Cycle',
        description: 'Carbon-carbon bonds are oxidized sequentially, releasing CO₂ and loading NADH and FADH₂ electron carriers.',
        progress: 0.50,
        stateName: 'Krebs Cycle Dehydrogenation',
      },
      {
        title: 'Electron Transport Chain & Chemiosmosis',
        description: 'High-energy electrons reduce O₂ to H₂O, driving ATP synthase rotary motors via proton gradient.',
        progress: 0.80,
        stateName: 'Proton Gradient Phosphorylation',
      },
      {
        title: 'Full Oxidation Attained',
        description: 'Six CO₂ molecules and six H₂O molecules produced along with ~30-32 ATP molecules.',
        progress: 1.0,
        stateName: '6 CO₂ + 6 H₂O + ATP',
      },
    ],
  },
  {
    id: 'h2o2_decomposition',
    name: 'Hydrogen Peroxide Catalyzed Decomposition',
    equation: '2 H₂O₂  ⟶  2 H₂O + O₂  +  196 kJ',
    description: 'The dramatic "Elephant Toothpaste" demonstration! Unstable oxygen-oxygen single peroxide bonds (146 kJ/mol) rapidly disproportionate into water and effervescent oxygen gas.',
    type: 'decomposition',
    enthalpyDeltaH: -196.4,
    entropyDeltaS: 126.0,
    gibbsFreeEnergyDeltaG: -234.0,
    activationEnergyEa: 75,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic (ΔH = -196.4 kJ/mol) and entropy-increasing (ΔS = +126.0 J/(mol·K)) due to O₂ gas evolution. Spontaneous at all temperatures (ΔG° = -234.0 kJ/mol); accelerated by iodide or catalase catalyst.',
    reactants: [
      { formula: 'H₂O₂', name: 'Hydrogen Peroxide', count: 2 },
    ],
    products: [
      { formula: 'H₂O', name: 'Water', count: 2, moleculeId: 'water' },
      { formula: 'O₂', name: 'Oxygen gas', count: 1 },
    ],
    stages: [
      {
        title: 'Catalyst Coordination',
        description: 'Peroxide molecules coordinate with iodide ions (I⁻) or catalase enzyme active site.',
        progress: 0.20,
        stateName: 'Catalytic Coordination',
      },
      {
        title: 'O-O Peroxide Bond Scission',
        description: 'The weak O-O bond cleaves, forming an hypoiodite intermediate (IO⁻) and hydroxyl groups.',
        progress: 0.50,
        stateName: 'Hypoiodite Intermediate Complex',
      },
      {
        title: 'Oxygen Gas Bubble Nucleation',
        description: 'Two oxygen atoms combine into stable O=O double bonds while regeneration of catalyst occurs.',
        progress: 0.85,
        stateName: 'Effervescent O₂ Formation',
      },
      {
        title: 'Steam & Oxygen Release',
        description: 'Exothermic heat vaporizes water into steam accompanied by vigorous oxygen gas release.',
        progress: 1.0,
        stateName: '2 H₂O + O₂ Products',
      },
    ],
  },
  {
    id: 'thermite_redox',
    name: 'Thermite Pyrotechnic Redox Reaction',
    equation: 'Fe₂O₃ + 2 Al  ⟶  2 Fe + Al₂O₃  +  851 kJ',
    description: 'Extreme metallurgy! Aluminium’s immense affinity for oxygen strips iron oxide in a violent exothermic reaction producing molten white-hot liquid iron (exceeding 2500 °C), used to weld railway tracks.',
    type: 'redox',
    enthalpyDeltaH: -851.5,
    entropyDeltaS: -38.5,
    gibbsFreeEnergyDeltaG: -840.0,
    activationEnergyEa: 240,
    isExothermic: true,
    thermodynamicsSummary: 'Violently exothermic (ΔH = -851.5 kJ/mol) with minor entropy change (ΔS = -38.5 J/(mol·K)). Highly spontaneous (ΔG° = -840.0 kJ/mol) once high activation barrier (Ea = 240 kJ) is breached by magnesium fuse.',
    reactants: [
      { formula: 'Fe₂O₃', name: 'Iron(III) Oxide (Rust)', count: 1 },
      { formula: 'Al', name: 'Aluminium metal powder', count: 2 },
    ],
    products: [
      { formula: 'Fe', name: 'Molten Iron', count: 2 },
      { formula: 'Al₂O₃', name: 'Aluminium Oxide (Corundum)', count: 1 },
    ],
    stages: [
      {
        title: 'Ignition Ribbon Trigger',
        description: 'Magnesium fuse provides intense activation energy (over 1500 °C) to initiate electron transfer.',
        progress: 0.20,
        stateName: 'Thermal Ignition',
      },
      {
        title: 'Violent Redox Electron Transfer',
        description: 'Aluminium atoms lose 3 electrons each (oxidized to Al³⁺) reducing Fe³⁺ ions to neutral Fe metal atoms.',
        progress: 0.55,
        stateName: 'Redox Exchange State',
      },
      {
        title: 'Extreme Heat & Incandescence',
        description: 'Immense enthalpy release (-851.5 kJ/mol) melts newly formed iron into white-hot liquid metal (2500 °C).',
        progress: 0.85,
        stateName: 'Molten Iron Separation',
      },
      {
        title: 'Slag & Molten Weld Metal',
        description: 'Molten iron sinks to form weld seam while lighter Al₂O₃ slag floats to top.',
        progress: 1.0,
        stateName: 'Liquid Fe + Solid Al₂O₃',
      },
    ],
  },
  {
    id: 'calcium_carbonate_calcination',
    name: 'Limestone Thermal Calcination (Quicklime Manufacture)',
    equation: 'CaCO₃ + Heat  ⟶  CaO + CO₂  (ΔH = +178 kJ/mol)',
    description: 'The ancient industrial reaction creating lime for cement, concrete, and steelmaking. Crushed limestone is heated above 840 °C to thermally decompose into quicklime and carbon dioxide gas.',
    type: 'decomposition',
    enthalpyDeltaH: 178.2, // Endothermic
    entropyDeltaS: 160.5,
    gibbsFreeEnergyDeltaG: 130.3,
    activationEnergyEa: 195,
    isExothermic: false,
    thermodynamicsSummary: 'Endothermic (ΔH = +178.2 kJ/mol) with positive entropy gain (ΔS = +160.5 J/(mol·K)) from CO₂ degassing. Non-spontaneous at 25 °C (ΔG° = +130.3 kJ/mol), but becomes spontaneous above 840 °C (1110 K) as T·ΔS dominates.',
    reactants: [
      { formula: 'CaCO₃', name: 'Calcium Carbonate (Limestone)', count: 1 },
    ],
    products: [
      { formula: 'CaO', name: 'Calcium Oxide (Quicklime)', count: 1 },
      { formula: 'CO₂', name: 'Carbon Dioxide gas', count: 1, moleculeId: 'carbon_dioxide' },
    ],
    stages: [
      {
        title: 'Kiln Heating',
        description: 'Calcite mineral crystal lattice absorbs thermal energy in industrial rotary kilns (900-1000 °C).',
        progress: 0.20,
        stateName: 'Solid CaCO₃ Lattice Heating',
      },
      {
        title: 'Carbonate Ion Cleavage',
        description: 'Thermal vibrations overcome C-O ionic coordination bonds in planar [CO₃]²⁻ groups.',
        progress: 0.55,
        stateName: 'Transition Complex [Ca···O···CO₂]',
      },
      {
        title: 'CO₂ Gas Evolution',
        description: 'Linear CO₂ molecule desorbs and escapes upward, driving equilibrium forward via Le Chatelier’s principle.',
        progress: 0.85,
        stateName: 'Carbon Dioxide Degassing',
      },
      {
        title: 'Quicklime Sintering',
        description: 'Refractory Calcium Oxide (CaO) crystals remain as highly caustic quicklime.',
        progress: 1.0,
        stateName: 'Solid CaO + Gas CO₂',
      },
    ],
  },
  {
    id: 'ethanol_combustion',
    name: 'Ethanol Biofuel Complete Combustion',
    equation: 'C₂H₅OH + 3 O₂  ⟶  2 CO₂ + 3 H₂O  +  1367 kJ',
    description: 'Renewable biofuel energy conversion! Ethanol combusts in automotive flex-fuel combustion chambers, oxidizing the two-carbon chain into carbon dioxide and steam.',
    type: 'combustion',
    enthalpyDeltaH: -1367,
    entropyDeltaS: 217.0,
    gibbsFreeEnergyDeltaG: -1431.7,
    activationEnergyEa: 130,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic (ΔH = -1367 kJ/mol) with entropy increase (ΔS = +217.0 J/(mol·K)) from gaseous expansion. Spontaneous at all temperatures (ΔG° = -1431.7 kJ/mol).',
    reactants: [
      { formula: 'C₂H₅OH', name: 'Ethanol', count: 1, moleculeId: 'ethanol' },
      { formula: 'O₂', name: 'Oxygen gas', count: 3 },
    ],
    products: [
      { formula: 'CO₂', name: 'Carbon Dioxide', count: 2, moleculeId: 'carbon_dioxide' },
      { formula: 'H₂O', name: 'Water vapor', count: 3, moleculeId: 'water' },
    ],
    stages: [
      {
        title: 'Fuel-Air Intake Stroke',
        description: 'Atomized ethanol vapor mixes with gaseous diatomic oxygen in 1:3 stoichiometric ratio.',
        progress: 0.15,
        stateName: 'Fuel-Air Charge Mixture',
      },
      {
        title: 'C-C and C-O Bond Cleavage',
        description: 'Spark plug arc initiates thermal radical cracking of the ethyl group and hydroxyl group.',
        progress: 0.50,
        stateName: 'Radical Combustion Flame Front',
      },
      {
        title: 'Thermodynamic Expansion',
        description: 'Formation of 2 CO₂ and 3 H₂O molecules (5 moles gas per mole fuel) creates high piston expansion pressure.',
        progress: 0.85,
        stateName: 'Expanding Exhaust Gases',
      },
      {
        title: 'Exhaust Stroke',
        description: 'Carbon dioxide and steam depart through exhaust manifold carrying mechanical work output.',
        progress: 1.0,
        stateName: '2 CO₂ + 3 H₂O Products',
      },
    ],
  },
  {
    id: 'fischer_esterification',
    name: 'Fischer Esterification (Ethyl Acetate Synthesis)',
    equation: 'CH₃COOH + C₂H₅OH  ⇌  CH₃COOC₂H₅ + H₂O',
    description: 'Classic organic organic condensation! Acetic acid and ethanol react in the presence of sulfuric acid catalyst to form fruity-scented ethyl acetate solvent.',
    type: 'synthesis',
    enthalpyDeltaH: -15.1,
    entropyDeltaS: 10.2,
    gibbsFreeEnergyDeltaG: -18.1,
    activationEnergyEa: 85,
    isExothermic: true,
    thermodynamicsSummary: 'Mildly exothermic (ΔH = -15.1 kJ/mol) with near-neutral entropy (ΔS = +10.2 J/(mol·K)). Spontaneous reversible equilibrium (ΔG° = -18.1 kJ/mol), shifted forward by Le Chatelier removal of water.',
    reactants: [
      { formula: 'CH₃COOH', name: 'Acetic Acid', count: 1, moleculeId: 'acetic_acid' },
      { formula: 'C₂H₅OH', name: 'Ethanol', count: 1, moleculeId: 'ethanol' },
    ],
    products: [
      { formula: 'CH₃COOC₂H₅', name: 'Ethyl Acetate (Ester)', count: 1 },
      { formula: 'H₂O', name: 'Water', count: 1, moleculeId: 'water' },
    ],
    stages: [
      {
        title: 'Acid Protonation',
        description: 'H⁺ from acid catalyst protonates carbonyl oxygen of acetic acid, rendering carbonyl carbon electrophilic.',
        progress: 0.20,
        stateName: 'Protonated Carbonyl Intermediate',
      },
      {
        title: 'Nucleophilic Addition',
        description: 'Ethanol oxygen attacks the electrophilic carbonyl carbon to form a tetrahedral intermediate.',
        progress: 0.50,
        stateName: 'Tetrahedral Intermediate',
      },
      {
        title: 'Water Elimination',
        description: 'Proton transfer converts -OH into leaving group -OH₂⁺ which departs as water.',
        progress: 0.80,
        stateName: 'Ester Bond Condensation',
      },
      {
        title: 'Fruity Ester Complete',
        description: 'Deprotonation regenerates acid catalyst and leaves fragrant ethyl acetate ester.',
        progress: 1.0,
        stateName: 'Ethyl Acetate + Water',
      },
    ],
  },
  {
    id: 'water_electrolysis',
    name: 'Electrochemical Water Splitting (Green Hydrogen)',
    equation: '2 H₂O + Electrical Energy  ⟶  2 H₂ + O₂',
    description: 'The cornerstone of clean zero-emission energy! Electrical potential across cathode and anode overcomes water stability, producing pure green hydrogen fuel.',
    type: 'decomposition',
    enthalpyDeltaH: 572, // Endothermic / Electrolytic
    entropyDeltaS: 326.6,
    gibbsFreeEnergyDeltaG: 474.6,
    activationEnergyEa: 210,
    isExothermic: false,
    thermodynamicsSummary: 'Endothermic (ΔH = +572 kJ/mol) despite entropy gain (ΔS = +326.6 J/(mol·K)). Non-spontaneous (ΔG° = +474.6 kJ/mol); driven electrochemically with external cell potential (> 1.23 V).',
    reactants: [
      { formula: 'H₂O', name: 'Liquid Water', count: 2, moleculeId: 'water' },
    ],
    products: [
      { formula: 'H₂', name: 'Hydrogen gas (Cathode)', count: 2 },
      { formula: 'O₂', name: 'Oxygen gas (Anode)', count: 1 },
    ],
    stages: [
      {
        title: 'Electrode Interface Adsorption',
        description: 'H₂O molecules align with cathode and anode electric field at >1.23 V potential.',
        progress: 0.20,
        stateName: 'Electric Field Polarization',
      },
      {
        title: 'Cathodic Reduction & Anodic Oxidation',
        description: '2H₂O + 2e⁻ ⟶ H₂ + 2OH⁻ at cathode; 2H₂O ⟶ O₂ + 4H⁺ + 4e⁻ at anode.',
        progress: 0.55,
        stateName: 'Charge Transfer Transition',
      },
      {
        title: 'Gas Bubble Nucleation',
        description: 'Diatomic H₂ and O₂ molecules nucleate as micro-bubbles on catalytic electrode surfaces in 2:1 volume ratio.',
        progress: 0.85,
        stateName: 'Micro-bubble Formation',
      },
      {
        title: 'Pure Fuel Harvest',
        description: 'Two moles of H₂ gas harvested at negative cathode for fuel cells; one mole of O₂ at positive anode.',
        progress: 1.0,
        stateName: '2 H₂ + O₂ Clean Gases',
      },
    ],
  },
  {
    id: 'baking_soda_vinegar',
    name: 'Sodium Bicarbonate & Acetic Acid Effervescence',
    equation: 'NaHCO₃ + CH₃COOH  ⟶  CH₃COONa + H₂O + CO₂↑',
    description: 'The beloved classic chemistry volcano experiment! Acid-base proton transfer produces carbonic acid, which spontaneously decarboxylates into bubbling carbon dioxide gas.',
    type: 'neutralization',
    enthalpyDeltaH: 28.5, // Endothermic (feels cold to touch!)
    entropyDeltaS: 185.0,
    gibbsFreeEnergyDeltaG: -26.7,
    activationEnergyEa: 35,
    isExothermic: false,
    thermodynamicsSummary: 'Endothermic (ΔH = +28.5 kJ/mol, cools vessel) yet completely spontaneous (ΔG° = -26.7 kJ/mol) driven purely by large entropy increase (ΔS = +185.0 J/(mol·K)) from vigorous CO₂ gas effervescence.',
    reactants: [
      { formula: 'NaHCO₃', name: 'Sodium Bicarbonate (Baking Soda)', count: 1 },
      { formula: 'CH₃COOH', name: 'Acetic Acid (Vinegar)', count: 1, moleculeId: 'acetic_acid' },
    ],
    products: [
      { formula: 'CH₃COONa', name: 'Sodium Acetate', count: 1 },
      { formula: 'H₂O', name: 'Water', count: 1, moleculeId: 'water' },
      { formula: 'CO₂', name: 'Carbon Dioxide gas', count: 1, moleculeId: 'carbon_dioxide' },
    ],
    stages: [
      {
        title: 'Acid-Base Contact',
        description: 'Bicarbonate anion [HCO₃]⁻ and acetic acid molecules meet in aqueous solution.',
        progress: 0.20,
        stateName: 'Ionic Mixture',
      },
      {
        title: 'Proton Transfer',
        description: 'Acetic acid transfers its carboxylic proton to bicarbonate, forming unstable carbonic acid (H₂CO₃).',
        progress: 0.50,
        stateName: 'Carbonic Acid Intermediate (H₂CO₃)',
      },
      {
        title: 'Spontaneous Decarboxylation',
        description: 'H₂CO₃ spontaneously decomposes into water and rapidly expanding CO₂ gas bubbles, cooling the beaker.',
        progress: 0.80,
        stateName: 'Vigorous CO₂ Effervescence',
      },
      {
        title: 'Foam & Salt Solution',
        description: 'Dissolved sodium acetate remains in neutral aqueous solution while CO₂ escapes.',
        progress: 1.0,
        stateName: 'Sodium Acetate + Water + CO₂',
      },
    ],
  },
  {
    id: 'ionic_transfer',
    name: 'Ionic Bond Formation (Sodium + Chlorine)',
    equation: 'Na + Cl  ⟶  Na⁺ + Cl⁻  (ΔH = -411 kJ/mol)',
    description: 'Archetypal electron transfer between metal and non-metal. Sodium donates its single 3s valence electron to chlorine’s 3p valence shell, producing oppositely charged ions that electrostatically attract.',
    type: 'redox',
    enthalpyDeltaH: -411,
    entropyDeltaS: -90.3,
    gibbsFreeEnergyDeltaG: -384.1,
    activationEnergyEa: 45,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic (ΔH = -411 kJ/mol) driven by Coulombic attraction and crystal lattice enthalpy. Entropy decreases (ΔS = -90.3 J/(mol·K)) as free gas/atoms lock into solid NaCl lattice; overall spontaneous (ΔG° = -384.1 kJ/mol).',
    reactants: [
      { formula: 'Na', name: 'Sodium atom ([Ne] 3s¹)', count: 1 },
      { formula: 'Cl', name: 'Chlorine atom ([Ne] 3s² 3p⁵)', count: 1 },
    ],
    products: [
      { formula: 'Na⁺', name: 'Sodium Cation ([Ne] octet)', count: 1 },
      { formula: 'Cl⁻', name: 'Chloride Anion ([Ar] octet)', count: 1 },
    ],
    stages: [
      {
        title: 'Neutral Atoms Approach',
        description: 'Sodium has low ionization energy (496 kJ/mol) and chlorine has high electron affinity (-349 kJ/mol).',
        progress: 0.15,
        stateName: 'Neutral Na and Cl Atoms',
      },
      {
        title: 'Valence Electron Leap',
        description: 'Sodium’s single outer valence electron tunnels across to chlorine’s half-filled 3p orbital.',
        progress: 0.50,
        stateName: 'Electron Transfer',
      },
      {
        title: 'Coulombic Electrostatic Attraction',
        description: 'Na⁺ cation and Cl⁻ anion experience intense Coulombic attraction: F = k·(q₁·q₂)/r².',
        progress: 0.85,
        stateName: 'Coulomb Attraction',
      },
      {
        title: 'Ionic Crystal Nucleation',
        description: 'Ions settle at optimal ionic radius distance (282 pm), lowering energy via lattice energy release.',
        progress: 1.0,
        stateName: 'NaCl Ionic Pair',
      },
    ],
  },
  {
    id: 'acid_base_neutralization',
    name: 'Hydrochloric Acid & Sodium Hydroxide Neutralization',
    equation: 'HCl + NaOH  ⟶  NaCl + H₂O  +  57 kJ',
    description: 'Proton transfer reaction where hydronium/hydrogen ion from strong acid combines with hydroxide from strong base to form neutral water and salt.',
    type: 'neutralization',
    enthalpyDeltaH: -57.3,
    entropyDeltaS: 80.7,
    gibbsFreeEnergyDeltaG: -81.4,
    activationEnergyEa: 20,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic (ΔH = -57.3 kJ/mol) and entropy-favored (ΔS = +80.7 J/(mol·K)) as ordered water hydration shells around H⁺ and OH⁻ disperse into bulk liquid. Spontaneous at all temperatures (ΔG° = -81.4 kJ/mol).',
    reactants: [
      { formula: 'HCl', name: 'Hydrochloric Acid', count: 1 },
      { formula: 'NaOH', name: 'Sodium Hydroxide', count: 1 },
    ],
    products: [
      { formula: 'NaCl', name: 'Sodium Chloride (Salt)', count: 1, moleculeId: 'nacl_lattice' },
      { formula: 'H₂O', name: 'Water', count: 1, moleculeId: 'water' },
    ],
    stages: [
      {
        title: 'Aqueous Dissociation',
        description: 'HCl dissociates into H⁺ and Cl⁻; NaOH dissociates into Na⁺ and OH⁻ ions.',
        progress: 0.2,
        stateName: 'Hydrated Ions in Solution',
      },
      {
        title: 'Proton Transfer',
        description: 'H⁺ proton bonds with OH⁻ lone pair via coordinate covalent link.',
        progress: 0.6,
        stateName: 'H⁺ + OH⁻ ⟶ H₂O',
      },
      {
        title: 'Neutral Solution Formed',
        description: 'Water forms at neutral pH 7, with spectator ions Na⁺ and Cl⁻ dissolved in solution.',
        progress: 1.0,
        stateName: 'Neutral Salt Solution',
      },
    ],
  },
  // =========================================================================
  // 15. NUCLEAR FISSION: Uranium-235 Thermal Neutron Induced Fission
  // =========================================================================
  {
    id: 'uranium_fission',
    name: 'Uranium-235 Thermal Neutron Fission',
    equation: '²³⁵U + n  ⟶  ¹⁴¹Ba + ⁹²Kr + 3 n  +  200 MeV',
    description: 'The foundation of nuclear power reactors. A slow thermal neutron (0.025 eV) is captured by a ²³⁵U nucleus, forming an unstable ²³⁶U* compound nucleus that undergoes liquid-drop deformation, nuclear scission into ¹⁴¹Ba and ⁹²Kr fragments, emitting 3 prompt neutrons and 200 MeV of kinetic and gamma energy.',
    type: 'nuclear_fission',
    enthalpyDeltaH: -19300000000, // ~200 MeV per event converted to ~1.93×10¹⁰ kJ/mol
    entropyDeltaS: 450.0,
    gibbsFreeEnergyDeltaG: -19300000134,
    activationEnergyEa: 6.5,
    isExothermic: true,
    thermodynamicsSummary: 'Mass defect (Δm = 0.215 amu) directly converted to pure energy via Einstein’s E = mc². Releasing ~200 MeV (~1.93×10¹⁰ kJ/mol)—over 2.5 million times the gravimetric energy density of burning coal or fossil fuels.',
    reactants: [
      { formula: '²³⁵U', name: 'Uranium-235 Nucleus', count: 1 },
      { formula: 'n', name: 'Thermal Neutron', count: 1 },
    ],
    products: [
      { formula: '¹⁴¹Ba', name: 'Barium-141 Fragment', count: 1 },
      { formula: '⁹²Kr', name: 'Krypton-92 Fragment', count: 1 },
      { formula: 'n', name: 'Prompt Neutrons', count: 3 },
    ],
    stages: [
      {
        title: 'Thermal Neutron Capture',
        description: 'A thermal neutron (0.025 eV) enters the strong nuclear force range (1.2 fm) and is absorbed into the ²³⁵U nucleus.',
        progress: 0.15,
        stateName: '²³⁵U + n Collision',
      },
      {
        title: 'Compound Nucleus Oscillation (²³⁶U*)',
        description: 'Binding energy excites the compound nucleus into violent liquid-drop quadrupole and octupole oscillations.',
        progress: 0.45,
        stateName: 'Oscillating ²³⁶U* Dumbbell',
      },
      {
        title: 'Nuclear Scission & Neck Rupture',
        description: 'Electrostatic Coulomb repulsion overcomes nuclear surface tension; the neck ruptures, dividing into Ba and Kr fragments.',
        progress: 0.70,
        stateName: 'Scission & Neck Cleavage',
      },
      {
        title: 'Prompt Neutron & Energy Release',
        description: '¹⁴¹Ba and ⁹²Kr fly apart at 170 MeV kinetic energy, boiling off 3 prompt high-speed neutrons to sustain a chain reaction.',
        progress: 1.0,
        stateName: 'Fission Fragments + 3 Neutrons',
      },
    ],
  },
  // =========================================================================
  // 16. NUCLEAR FISSION: Plutonium-239 Fission
  // =========================================================================
  {
    id: 'plutonium_fission',
    name: 'Plutonium-239 Nuclear Fission',
    equation: '²³⁹Pu + n  ⟶  ¹³⁴Xe + ¹⁰³Zr + 3 n  +  207 MeV',
    description: 'High-yield nuclear fission utilized in fast-breeder power reactors. ²³⁹Pu absorbs a neutron to produce an excited ²⁴⁰Pu* nucleus, which cleaves into Xenon-134 and Zirconium-103 daughter nuclei with 3 prompt neutrons.',
    type: 'nuclear_fission',
    enthalpyDeltaH: -19980000000, // 207 MeV = ~2.00×10¹⁰ kJ/mol
    entropyDeltaS: 480.0,
    gibbsFreeEnergyDeltaG: -19980000143,
    activationEnergyEa: 5.5,
    isExothermic: true,
    thermodynamicsSummary: 'Mass defect conversion yielding 207.1 MeV per fission event (ΔH = -2.00×10¹⁰ kJ/mol). Coulomb kinetic repulsion imparts 175 MeV to the Xe and Zr fragments, with remaining energy carried by prompt neutrons and gamma rays.',
    reactants: [
      { formula: '²³⁹Pu', name: 'Plutonium-239 Nucleus', count: 1 },
      { formula: 'n', name: 'Neutron', count: 1 },
    ],
    products: [
      { formula: '¹³⁴Xe', name: 'Xenon-134 Nucleus', count: 1 },
      { formula: '¹⁰³Zr', name: 'Zirconium-103 Nucleus', count: 1 },
      { formula: 'n', name: 'Prompt Neutrons', count: 3 },
    ],
    stages: [
      {
        title: 'Neutron Capture',
        description: 'Neutron is absorbed into the ²³⁹Pu nucleus, exciting nucleons into high vibration.',
        progress: 0.20,
        stateName: '²⁴⁰Pu* Excited State',
      },
      {
        title: 'Elongation & Necking',
        description: 'The nucleus elongates into an asymmetric prolate ellipsoid.',
        progress: 0.50,
        stateName: 'Liquid-Drop Necking',
      },
      {
        title: 'Coulomb Explosion',
        description: 'Positive nuclear charges repel violently, snapping the neck and releasing 207 MeV.',
        progress: 0.80,
        stateName: 'Nuclear Fragmentation',
      },
      {
        title: 'Products Ejected',
        description: '¹³⁴Xe and ¹⁰³Zr nuclei fly apart, accompanied by 3 energetic prompt neutrons.',
        progress: 1.0,
        stateName: 'Separated Daughter Nuclei',
      },
    ],
  },
  // =========================================================================
  // 17. NUCLEAR FUSION: Deuterium-Tritium (D-T) Thermonuclear Fusion
  // =========================================================================
  {
    id: 'dt_fusion',
    name: 'Deuterium-Tritium (D-T) Thermonuclear Fusion',
    equation: '²H + ³H  ⟶  ⁴He (3.5 MeV) + n (14.1 MeV)  +  17.6 MeV',
    description: 'The premier reaction for next-generation tokamak fusion power (ITER, SPARC). In a 150 million °C magnetic plasma, Deuterium and Tritium nuclei overcome Coulomb repulsion via quantum tunneling, fusing into a tightly bound alpha particle (⁴He) and a high-energy 14.1 MeV prompt neutron.',
    type: 'nuclear_fusion',
    enthalpyDeltaH: -1698000000, // 17.6 MeV = ~1.70×10⁹ kJ/mol
    entropyDeltaS: 120.0,
    gibbsFreeEnergyDeltaG: -1698000035,
    activationEnergyEa: 100, // Coulomb barrier ~100 keV in plasma
    isExothermic: true,
    thermodynamicsSummary: 'Highest cross-section fusion reaction in physics. Four nucleons rearrange into the tightly bound ⁴He alpha nucleus (total binding energy 28.3 MeV), releasing 17.59 MeV per reaction (1.70×10⁹ kJ/mol). Zero carbon emissions with abundant seawater deuterium fuel.',
    reactants: [
      { formula: '²H (D)', name: 'Deuterium (1p, 1n)', count: 1 },
      { formula: '³H (T)', name: 'Tritium (1p, 2n)', count: 1 },
    ],
    products: [
      { formula: '⁴He (α)', name: 'Helium-4 Alpha Particle (3.5 MeV)', count: 1 },
      { formula: 'n', name: 'Fast Prompt Neutron (14.1 MeV)', count: 1 },
    ],
    stages: [
      {
        title: 'Tokamak Plasma Confinement',
        description: 'D⁺ and T⁺ ions race at high velocities inside a 150 million Kelvin magnetic field.',
        progress: 0.20,
        stateName: 'High-Temperature Plasma',
      },
      {
        title: 'Coulomb Barrier Quantum Tunneling',
        description: 'Wavefunctions overlap as nuclei penetrate the electrostatic repulsion barrier at ~1 femtometer.',
        progress: 0.50,
        stateName: 'Resonant ⁵He* Intermediate',
      },
      {
        title: 'Strong Force Cleavage & Energy Flash',
        description: 'Strong force binds 4 nucleons into an ultra-dense alpha particle, ejecting an uncharged neutron.',
        progress: 0.80,
        stateName: 'Alpha & Neutron Ejection',
      },
      {
        title: 'Thermonuclear Energy Release',
        description: '⁴He carries 3.5 MeV to self-heat the plasma; the 14.1 MeV neutron penetrates the lithium blanket to generate electricity.',
        progress: 1.0,
        stateName: '⁴He + n (17.6 MeV Total)',
      },
    ],
  },
  // =========================================================================
  // 18. NUCLEAR FUSION: Solar Core Proton-Proton Chain
  // =========================================================================
  {
    id: 'proton_proton_fusion',
    name: 'Proton-Proton Solar Core Fusion Chain',
    equation: '4 ¹H  ⟶  ⁴He + 2 e⁺ + 2 νₑ + 2 γ  +  26.7 MeV',
    description: 'The thermonuclear engine powering the Sun and all life on Earth. At 15 million Kelvin and 250 billion atmospheres in the solar core, four protons undergo sequential fusion via weak-force beta decay into an ultra-stable Helium-4 nucleus, releasing positrons, neutrinos, and 26.7 MeV of gamma radiation.',
    type: 'nuclear_fusion',
    enthalpyDeltaH: -2576000000, // 26.7 MeV = ~2.58×10⁹ kJ/mol
    entropyDeltaS: 180.0,
    gibbsFreeEnergyDeltaG: -2576000053,
    activationEnergyEa: 1200,
    isExothermic: true,
    thermodynamicsSummary: 'Solar nucleosynthesis converts 0.7% of proton rest mass into thermal radiation and neutrinos. Releasing 26.73 MeV per ⁴He formed (2.58×10⁹ kJ/mol), powering the Sun’s 3.828×10²⁶ Watt continuous luminosity.',
    reactants: [
      { formula: '¹H', name: 'Protons (Hydrogen Nuclei)', count: 4 },
    ],
    products: [
      { formula: '⁴He', name: 'Helium-4 Nucleus (Alpha)', count: 1 },
      { formula: 'e⁺', name: 'Positrons (Antielectrons)', count: 2 },
      { formula: 'νₑ', name: 'Electron Neutrinos', count: 2 },
    ],
    stages: [
      {
        title: 'Solar Core Proton Collision',
        description: 'Protons collide in the 15 million Kelvin core; weak force converts a proton into a neutron, forming Deuterium.',
        progress: 0.25,
        stateName: 'p-p Collision & Beta Decay',
      },
      {
        title: 'Helium-3 Synthesis',
        description: 'Deuterium captures another proton, forming ³He and emitting a gamma ray photon.',
        progress: 0.55,
        stateName: '³He Nucleosynthesis',
      },
      {
        title: 'Alpha Assembly',
        description: 'Two ³He nuclei fuse together, ejecting two free protons and assembling a tightly bound ⁴He nucleus.',
        progress: 0.85,
        stateName: '⁴He Core Assembly',
      },
      {
        title: 'Solar Luminosity Release',
        description: 'Stable Helium-4 nucleus formed; annihilating positrons generate gamma rays that diffuse outward to shine as sunlight.',
        progress: 1.0,
        stateName: 'Helium-4 + Solar Energy',
      },
    ],
  },
  // =========================================================================
  // 19. NUCLEAR FUSION: Deuterium-Deuterium (D-D) Fusion
  // =========================================================================
  {
    id: 'dd_fusion',
    name: 'Deuterium-Deuterium (D-D) Fusion',
    equation: '²H + ²H  ⟶  ³He + n  +  3.27 MeV',
    description: 'Abundant ocean-fuel fusion! Deuterium extracted from regular seawater fuses in an aneutronic/low-tritium alternative branch, producing Helium-3 and a 2.45 MeV neutron.',
    type: 'nuclear_fusion',
    enthalpyDeltaH: -315000000, // 3.27 MeV = ~3.15×10⁸ kJ/mol
    entropyDeltaS: 90.0,
    gibbsFreeEnergyDeltaG: -315000027,
    activationEnergyEa: 150,
    isExothermic: true,
    thermodynamicsSummary: 'Deuterium is abundant in Earth’s oceans (1 in every 6,420 hydrogen atoms). D-D fusion releases 3.27 MeV per event, representing virtually limitless clean energy without requiring tritium breeding blankets.',
    reactants: [
      { formula: '²H', name: 'Deuterium Nucleus', count: 2 },
    ],
    products: [
      { formula: '³He', name: 'Helium-3 Nucleus', count: 1 },
      { formula: 'n', name: 'Fast Neutron (2.45 MeV)', count: 1 },
    ],
    stages: [
      {
        title: 'Deuteron Approach',
        description: 'Two deuterons (each containing 1 proton and 1 neutron) accelerate toward each other.',
        progress: 0.20,
        stateName: '²H + ²H Approach',
      },
      {
        title: 'Nuclear Core Tunneling',
        description: 'Quantum tunneling allows nuclear wavefunctions to merge across the positive potential wall.',
        progress: 0.50,
        stateName: 'Tunneling Intermediate',
      },
      {
        title: 'Helium-3 & Neutron Ejection',
        description: 'Strong force partitions the nucleons into a Helium-3 nucleus and a prompt free neutron.',
        progress: 0.80,
        stateName: 'Nucleon Partitioning',
      },
      {
        title: 'Energy Emitted',
        description: '³He and 2.45 MeV neutron fly apart at high relative momentum.',
        progress: 1.0,
        stateName: '³He + n Products',
      },
    ],
  },
  // =========================================================================
  // 20. PRECIPITATION: Lead(II) Iodide ("Golden Rain")
  // =========================================================================
  {
    id: 'lead_iodide_precipitation',
    name: 'Lead(II) Iodide Precipitation ("Golden Rain")',
    equation: 'Pb(NO₃)₂ (aq) + 2 KI (aq)  ⟶  PbI₂ (s)↓ + 2 KNO₃ (aq)  +  65 kJ',
    description: 'The famous "Golden Rain" visual experiment. Mixing clear lead nitrate and potassium iodide solutions exceeds the solubility product (Ksp = 9.8×10⁻⁹), crystallizing into shimmering golden-yellow hexagonal platelet flakes of PbI₂ that float and settle like gold glitter.',
    type: 'precipitation',
    enthalpyDeltaH: -65.2,
    entropyDeltaS: -42.0,
    gibbsFreeEnergyDeltaG: -52.7,
    activationEnergyEa: 12,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic lattice enthalpy release (ΔH = -65.2 kJ/mol). Strong ionic electrostatic attraction between divalent Pb²⁺ and polarizable I⁻ anions drives spontaneous crystallization (ΔG° = -52.7 kJ/mol).',
    reactants: [
      { formula: 'Pb(NO₃)₂', name: 'Lead(II) Nitrate (aq)', count: 1 },
      { formula: 'KI', name: 'Potassium Iodide (aq)', count: 2 },
    ],
    products: [
      { formula: 'PbI₂', name: 'Lead(II) Iodide (Golden Crystals)↓', count: 1 },
      { formula: 'KNO₃', name: 'Potassium Nitrate (aq)', count: 2 },
    ],
    stages: [
      {
        title: 'Aqueous Ion Migration',
        description: 'Colorless hydrated Pb²⁺ and I⁻ ions diffuse through liquid solution.',
        progress: 0.20,
        stateName: 'Hydrated Reactant Ions',
      },
      {
        title: 'Solubility Product Exceeded (Ksp)',
        description: 'Ion activity product [Pb²⁺][I⁻]² exceeds Ksp; nucleation seed clusters form rapidly.',
        progress: 0.50,
        stateName: 'Lattice Nucleation Seeds',
      },
      {
        title: 'Hexagonal Crystal Platelet Growth',
        description: 'Ions assemble into yellow hexagonal CdI₂-type crystal layer sheets.',
        progress: 0.80,
        stateName: 'Golden Platelet Growth',
      },
      {
        title: 'Golden Rain Precipitate Settles',
        description: 'Glittering yellow PbI₂ flakes settle to the bottom, leaving clear KNO₃ supernatant.',
        progress: 1.0,
        stateName: 'PbI₂ Solid Precipitate',
      },
    ],
  },
  // =========================================================================
  // 21. PRECIPITATION: Silver Chloride Curdy White Precipitate
  // =========================================================================
  {
    id: 'silver_chloride_precipitation',
    name: 'Silver Chloride Precipitation (Curdy White Precipitate)',
    equation: 'AgNO₃ (aq) + NaCl (aq)  ⟶  AgCl (s)↓ + NaNO₃ (aq)  +  65.5 kJ',
    description: 'The definitive analytical chloride test. Colorless solutions of silver nitrate and sodium chloride mix to instantaneously precipitate an opaque, curdy white solid of insoluble AgCl (Ksp = 1.77×10⁻¹⁰), which is photosensitive and darkens in UV light.',
    type: 'precipitation',
    enthalpyDeltaH: -65.5,
    entropyDeltaS: 33.2,
    gibbsFreeEnergyDeltaG: -75.4,
    activationEnergyEa: 10,
    isExothermic: true,
    thermodynamicsSummary: 'Favorable lattice enthalpy (ΔH = -65.5 kJ/mol) combined with desolvation entropy increase (ΔS = +33.2 J/(mol·K)). The large negative ΔG° (-75.4 kJ/mol) makes precipitation virtually instantaneous.',
    reactants: [
      { formula: 'AgNO₃', name: 'Silver Nitrate (aq)', count: 1 },
      { formula: 'NaCl', name: 'Sodium Chloride (aq)', count: 1 },
    ],
    products: [
      { formula: 'AgCl', name: 'Silver Chloride (White Solid)↓', count: 1 },
      { formula: 'NaNO₃', name: 'Sodium Nitrate (aq)', count: 1 },
    ],
    stages: [
      {
        title: 'Dissolved Aqueous Ions',
        description: 'Ag⁺ cations and Cl⁻ anions circulate with protective water hydration spheres.',
        progress: 0.20,
        stateName: 'Hydrated Ag⁺ and Cl⁻',
      },
      {
        title: 'Desolvation & Ionic Binding',
        description: 'Ions shed water molecules and snap together via Coulombic electrostatic attraction.',
        progress: 0.50,
        stateName: 'Ion-Pair Cluster',
      },
      {
        title: 'Cubic Rock-Salt Lattice Assembly',
        description: 'Ag⁺ and Cl⁻ lock into face-centered cubic microcrystals, forming curdy agglomerates.',
        progress: 0.80,
        stateName: 'Curdy White Agglomerate',
      },
      {
        title: 'White Precipitate Complete',
        description: 'Dense white AgCl solid falls out of solution, leaving spectator Na⁺ and NO₃⁻ ions.',
        progress: 1.0,
        stateName: 'AgCl (s) Precipitate',
      },
    ],
  },
  // =========================================================================
  // 22. PRECIPITATION: Copper(II) Hydroxide Royal Blue Precipitate
  // =========================================================================
  {
    id: 'copper_hydroxide_precipitation',
    name: 'Copper(II) Hydroxide Precipitation (Royal Blue)',
    equation: 'CuSO₄ (aq) + 2 NaOH (aq)  ⟶  Cu(OH)₂ (s)↓ + Na₂SO₄ (aq)  +  54 kJ',
    description: 'Transition metal qualitative analysis! Deep sky-blue copper sulfate solution reacts with sodium hydroxide to form a vibrant, gelatinous royal-blue precipitate of insoluble copper(II) hydroxide (Ksp = 2.2×10⁻²⁰).',
    type: 'precipitation',
    enthalpyDeltaH: -54.0,
    entropyDeltaS: -28.0,
    gibbsFreeEnergyDeltaG: -45.6,
    activationEnergyEa: 14,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic precipitation (ΔH = -54.0 kJ/mol). Cu²⁺ coordinates strongly with two OH⁻ ligands forming insoluble octahedral cross-linked polymer layers.',
    reactants: [
      { formula: 'CuSO₄', name: 'Copper(II) Sulfate (aq)', count: 1 },
      { formula: 'NaOH', name: 'Sodium Hydroxide (aq)', count: 2 },
    ],
    products: [
      { formula: 'Cu(OH)₂', name: 'Copper(II) Hydroxide (Royal Blue)↓', count: 1 },
      { formula: 'Na₂SO₄', name: 'Sodium Sulfate (aq)', count: 1 },
    ],
    stages: [
      {
        title: 'Blue Copper Aqua Complex',
        description: 'Hydrated [Cu(H₂O)₆]²⁺ ions encounter incoming hydroxide OH⁻ ions in water.',
        progress: 0.20,
        stateName: 'Hydrated Cu²⁺ + 2OH⁻',
      },
      {
        title: 'Ligand Displacement',
        description: 'Hydroxide ions displace coordination water molecules, binding directly to copper.',
        progress: 0.50,
        stateName: 'Cu-OH Coordination',
      },
      {
        title: 'Gelatinous Blue Sheet Condensation',
        description: 'Polymeric ribbons of Cu(OH)₂ condense into a vibrant blue colloid.',
        progress: 0.80,
        stateName: 'Gelatinous Blue Flocculant',
      },
      {
        title: 'Royal Blue Precipitate Settled',
        description: 'Striking royal-blue Cu(OH)₂ solid settles, leaving neutral Na₂SO₄ solution.',
        progress: 1.0,
        stateName: 'Cu(OH)₂ Solid Flocculant',
      },
    ],
  },
  // =========================================================================
  // 23. SINGLE DISPLACEMENT: Zinc in Copper(II) Sulfate
  // =========================================================================
  {
    id: 'zinc_copper_displacement',
    name: 'Zinc-Copper Single Displacement (Daniell Cell Redox)',
    equation: 'Zn (s) + CuSO₄ (aq)  ⟶  ZnSO₄ (aq) + Cu (s)↓  +  218 kJ',
    description: 'The foundation of electrochemical batteries. Metallic zinc is placed in deep blue copper sulfate solution. Zinc oxidizes (Zn ⟶ Zn²⁺ + 2e⁻) and transfers electrons to Cu²⁺ ions, plating out spongy reddish-brown metallic copper crystals while the blue solution decolors to clear zinc sulfate.',
    type: 'displacement',
    enthalpyDeltaH: -218.7,
    entropyDeltaS: -21.0,
    gibbsFreeEnergyDeltaG: -212.4,
    activationEnergyEa: 35,
    isExothermic: true,
    thermodynamicsSummary: 'Strongly exothermic redox displacement (ΔH = -218.7 kJ/mol). Cell potential E° = +1.10 V drives spontaneous two-electron transfer from Zn to Cu²⁺ (ΔG° = -212.4 kJ/mol).',
    reactants: [
      { formula: 'Zn', name: 'Metallic Zinc Metal', count: 1 },
      { formula: 'CuSO₄', name: 'Copper(II) Sulfate (Blue Solution)', count: 1 },
    ],
    products: [
      { formula: 'ZnSO₄', name: 'Zinc Sulfate (Clear Solution)', count: 1 },
      { formula: 'Cu', name: 'Metallic Copper (Reddish Crystals)↓', count: 1 },
    ],
    stages: [
      {
        title: 'Interfacial Contact',
        description: 'Blue Cu²⁺ ions migrate to the metallic zinc crystal lattice surface.',
        progress: 0.20,
        stateName: 'Zn(s) + Cu²⁺(aq) Interface',
      },
      {
        title: 'Two-Electron Transfer',
        description: 'Zinc atoms lose 2 electrons to Cu²⁺ ions across the metal-solution boundary.',
        progress: 0.50,
        stateName: 'Zn⁰ ⟶ Zn²⁺ + 2e⁻ ⟶ Cu⁰',
      },
      {
        title: 'Reddish Copper Crystal Plating',
        description: 'Zinc dissolves as Zn²⁺ ions; reduced copper atoms crystallize as reddish dendrites.',
        progress: 0.80,
        stateName: 'Copper Dendrite Growth',
      },
      {
        title: 'Complete Displacement',
        description: 'Solution decolors from blue to colorless ZnSO₄; solid metallic copper precipitates.',
        progress: 1.0,
        stateName: 'Solid Copper + Zn²⁺ Solution',
      },
    ],
  },
  // =========================================================================
  // 24. REDOX: Sodium Alkali Metal in Water
  // =========================================================================
  {
    id: 'sodium_water_reaction',
    name: 'Sodium Alkali Metal Hydrolysis',
    equation: '2 Na (s) + 2 H₂O (l)  ⟶  2 NaOH (aq) + H₂ (g)↑  +  282 kJ',
    description: 'Dramatic alkali metal chemistry! A chunk of soft metallic sodium dropped in water melts into a shiny silvery sphere from reaction heat, skitters vigorously across the surface, decomposes water into hydrogen gas and alkaline sodium hydroxide, and emits orange-yellow sparks.',
    type: 'redox',
    enthalpyDeltaH: -282.0,
    entropyDeltaS: 31.0,
    gibbsFreeEnergyDeltaG: -291.2,
    activationEnergyEa: 15,
    isExothermic: true,
    thermodynamicsSummary: 'Violently exothermic (ΔH = -282 kJ/mol). High sodium oxidation potential (-2.71 V) makes the reaction fiercely spontaneous at any temperature (ΔG° = -291.2 kJ/mol).',
    reactants: [
      { formula: 'Na', name: 'Sodium Metal', count: 2 },
      { formula: 'H₂O', name: 'Water', count: 2 },
    ],
    products: [
      { formula: 'NaOH', name: 'Sodium Hydroxide (aq)', count: 2 },
      { formula: 'H₂', name: 'Hydrogen Gas', count: 1 },
    ],
    stages: [
      {
        title: 'Sodium Melts on Water',
        description: 'Low-melting sodium (97.8 °C) melts into a sphere floating on surface tension.',
        progress: 0.20,
        stateName: 'Molten Sodium Droplet',
      },
      {
        title: 'Electron Emission & Hydrolysis',
        description: 'Sodium transfers single 3s electrons to water molecules, generating OH⁻ and H• radicals.',
        progress: 0.50,
        stateName: 'Solvated Electrons & Radicals',
      },
      {
        title: 'Hydrogen Bubble Effervescence',
        description: 'H₂ gas rapidly bubbles underneath the droplet, propelling it across the surface.',
        progress: 0.80,
        stateName: 'H₂ Gas Evolution',
      },
      {
        title: 'Strong Alkaline Solution Formed',
        description: 'Sodium fully dissolves as Na⁺ and OH⁻ ions (pH 14), with pure hydrogen gas released.',
        progress: 1.0,
        stateName: 'NaOH Solution + H₂ Gas',
      },
    ],
  },
  // =========================================================================
  // 25. PRECIPITATION / NEUTRALIZATION: Limewater Test
  // =========================================================================
  {
    id: 'limewater_carbonation',
    name: 'Limewater Test (Milky Calcium Carbonate Turbidity)',
    equation: 'Ca(OH)₂ (aq) + CO₂ (g)  ⟶  CaCO₃ (s)↓ + H₂O (l)  +  113 kJ',
    description: 'The standard test for carbon dioxide gas. Clear limewater (calcium hydroxide solution) reacts with bubbling CO₂ gas to form a fine suspension of insoluble calcium carbonate precipitate, turning the transparent solution cloudy milky white.',
    type: 'precipitation',
    enthalpyDeltaH: -113.0,
    entropyDeltaS: -198.0,
    gibbsFreeEnergyDeltaG: -54.0,
    activationEnergyEa: 25,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic neutralization and precipitation (ΔH = -113 kJ/mol). Spontaneous at room temperature (ΔG° = -54.0 kJ/mol), forming calcite micro-crystallites that scatter light.',
    reactants: [
      { formula: 'Ca(OH)₂', name: 'Calcium Hydroxide (Limewater)', count: 1 },
      { formula: 'CO₂', name: 'Carbon Dioxide Gas', count: 1 },
    ],
    products: [
      { formula: 'CaCO₃', name: 'Calcium Carbonate (Milky White)↓', count: 1 },
      { formula: 'H₂O', name: 'Water', count: 1 },
    ],
    stages: [
      {
        title: 'CO₂ Bubbles Through Limewater',
        description: 'Carbon dioxide gas dissolves in water, establishing equilibrium with carbonic acid.',
        progress: 0.20,
        stateName: 'CO₂ Gas Dissolution',
      },
      {
        title: 'Proton Neutralization to Carbonate',
        description: 'Hydroxide ions deprotonate bicarbonate into carbonate [CO₃]²⁻ anions.',
        progress: 0.50,
        stateName: 'Ca²⁺ and Carbonate Formation',
      },
      {
        title: 'Calcite Micro-Nucleation',
        description: 'Ca²⁺ and [CO₃]²⁻ ions rapidly assemble into insoluble microcrystals.',
        progress: 0.80,
        stateName: 'Milky Turbidity Nucleation',
      },
      {
        title: 'Cloudy Milky Suspension Formed',
        description: 'Dense suspension of fine white CaCO₃ particles scatters light, confirming CO₂.',
        progress: 1.0,
        stateName: 'Milky CaCO₃ Precipitate',
      },
    ],
  },
  // =========================================================================
  // 26. DECOMPOSITION: Potassium Chlorate Catalytic Decomposition
  // =========================================================================
  {
    id: 'potassium_chlorate_decomposition',
    name: 'Potassium Chlorate Catalytic Decomposition',
    equation: '2 KClO₃ (s)  ⟶  2 KCl (s) + 3 O₂ (g)↑  +  89 kJ',
    description: 'Classic laboratory oxygen preparation! Solid potassium chlorate decomposes when heated in the presence of manganese dioxide catalyst, vigorously evolving pure oxygen gas and leaving solid potassium chloride salt.',
    type: 'decomposition',
    enthalpyDeltaH: -89.4,
    entropyDeltaS: 494.0,
    gibbsFreeEnergyDeltaG: -236.7,
    activationEnergyEa: 140,
    isExothermic: true,
    thermodynamicsSummary: 'Exothermic decomposition driven by massive entropy increase (ΔS = +494 J/(mol·K)) as 3 moles of gaseous O₂ are released from 2 moles of crystalline solid. Strongly spontaneous upon heating.',
    reactants: [
      { formula: 'KClO₃', name: 'Potassium Chlorate Solid', count: 2 },
    ],
    products: [
      { formula: 'KCl', name: 'Potassium Chloride Salt', count: 2 },
      { formula: 'O₂', name: 'Oxygen Gas (3 Moles)', count: 3 },
    ],
    stages: [
      {
        title: 'Thermal Lattice Excitation',
        description: 'Heat weakens the Cl-O covalent bonds within the [ClO₃]⁻ pyramidal anion.',
        progress: 0.20,
        stateName: 'Heated KClO₃ Crystal',
      },
      {
        title: 'Catalytic Bond Cleavage',
        description: 'Chlorine-oxygen bonds break, releasing high-energy oxygen radical intermediates.',
        progress: 0.50,
        stateName: 'Cl-O Cleavage Transition',
      },
      {
        title: 'Oxygen Diatomic Gas Evolution',
        description: 'Oxygen atoms recombine into stable O=O double bonds, bubbling out as pure gas.',
        progress: 0.80,
        stateName: 'O₂ Gas Effervescence',
      },
      {
        title: 'Solid KCl Residue',
        description: 'Three moles of pure O₂ gas released; solid white KCl salt remains in crucible.',
        progress: 1.0,
        stateName: 'KCl Solid + 3 O₂ Gas',
      },
    ],
  },
  // =========================================================================
  // 27. REDOX: Iron Rusting (Hydrated Oxide Formation)
  // =========================================================================
  {
    id: 'iron_rusting',
    name: 'Iron Rusting (Hydrated Oxide Formation)',
    equation: '4 Fe + 3 O₂ + 6 H₂O  ⟶  2 Fe₂O₃·3H₂O  +  1650 kJ',
    description: 'The electrochemical corrosion of iron and steel. In the presence of moisture and air, iron metal oxidizes at anodic sites into Fe²⁺, while oxygen is reduced at cathodic sites, ultimately precipitating flaky reddish-brown rust.',
    type: 'redox',
    enthalpyDeltaH: -1650.0,
    entropyDeltaS: -540.0,
    gibbsFreeEnergyDeltaG: -1489.0,
    activationEnergyEa: 60,
    isExothermic: true,
    thermodynamicsSummary: 'Highly exothermic redox (ΔH = -1650 kJ/mol). Driven by large standard potential (+1.23 V for oxygen reduction), making rust formation thermodynamically spontaneous in damp atmospheric environments.',
    reactants: [
      { formula: 'Fe', name: 'Iron Metal', count: 4 },
      { formula: 'O₂', name: 'Atmospheric Oxygen', count: 3 },
      { formula: 'H₂O', name: 'Water Moisture', count: 6 },
    ],
    products: [
      { formula: 'Fe₂O₃·3H₂O', name: 'Hydrated Iron(III) Oxide (Rust)', count: 2 },
    ],
    stages: [
      {
        title: 'Anodic Iron Oxidation',
        description: 'Iron metal oxidizes to Fe²⁺ at microscopic pitting sites: Fe ⟶ Fe²⁺ + 2e⁻.',
        progress: 0.20,
        stateName: 'Anodic Dissolution (Fe²⁺)',
      },
      {
        title: 'Cathodic Oxygen Reduction',
        description: 'Electrons reduce dissolved O₂ and moisture into hydroxide ions: O₂ + 2H₂O + 4e⁻ ⟶ 4OH⁻.',
        progress: 0.50,
        stateName: 'Cathodic Oxygen Reduction',
      },
      {
        title: 'Ferric Hydroxide Precipitation',
        description: 'Fe²⁺ and OH⁻ react, rapidly oxidizing in air into insoluble Fe(OH)₃ gel.',
        progress: 0.80,
        stateName: 'Fe(OH)₃ Gel Assembly',
      },
      {
        title: 'Flaky Rust Layer Formed',
        description: 'Dehydration yields porous, crumbly reddish-brown hydrated ferric oxide rust.',
        progress: 1.0,
        stateName: 'Fe₂O₃·3H₂O Rust Flakes',
      },
    ],
  },
];

