import { ALL_CHEMICALS, calculateChemicalMoles, getChemicalMetadata } from '../data/virtualLabData';
import { enrichParticipantPhysicalProperties } from './productPhysicalProperties';
import {
  DetailedReactionInfo,
  DissolvedChemical,
  EvolvedGasInfo,
  GasAtmosphereInfo,
  LabLogEntry,
  PrecipitateInfo,
  ReactionParticipant,
  SubReactionInfo,
  UndissolvedSolidInfo,
} from '../types/virtualLab';

export interface ReactionOutcome {
  pH: number;
  color: string;
  temperatureChange: number;
  precipitate: PrecipitateInfo | null;
  gasEvolving: EvolvedGasInfo | null;
  gasAtmosphere: GasAtmosphereInfo | null;
  undissolvedSolids: UndissolvedSolidInfo[];
  foamHeightPercent: number;
  activeIndicator: string | null;
  activeReactionName: string | null;
  activeReactionEquation: string | null;
  activeReactionType: string | null; // e.g. "Gas Evolution / Acid-Base Metathesis"
  detailedReaction: DetailedReactionInfo | null; // Stoichiometry: moles & properties of reactants and products
  allReactions?: DetailedReactionInfo[]; // List of all concurrent/sequential reactions
  reactionPulse: boolean;
  loggedEvents: LabLogEntry[];
  reactionTimeLengthSec?: number;
  kineticsType?: string;
}

export function createReactionDetails(
  reactionName: string,
  reactionType: string,
  typeCategory: DetailedReactionInfo['typeCategory'],
  balancedEquation: string,
  thermochemistry: string,
  reactants: ReactionParticipant[],
  products: ReactionParticipant[],
  conservationNote?: string,
  deltaHKjPerMol?: number,
  deltaSJoulesPerMolK?: number,
  currentTempC: number = 22,
  subReactions?: SubReactionInfo[],
  isMultiReactant?: boolean,
  customTimeLengthSec?: number
): DetailedReactionInfo {
  let deltaGKjPerMol: number | undefined;
  let spontaneity: DetailedReactionInfo['spontaneity'];
  let thermoInterpretation: string | undefined;

  if (deltaHKjPerMol !== undefined && deltaSJoulesPerMolK !== undefined) {
    const tempK = (currentTempC ?? 22) + 273.15;
    // Gibbs Free Energy: ΔG = ΔH - T·(ΔS / 1000) (in kJ/mol)
    deltaGKjPerMol = Number((deltaHKjPerMol - (tempK * deltaSJoulesPerMolK) / 1000).toFixed(2));
    if (deltaGKjPerMol < -0.1) {
      spontaneity = 'spontaneous';
    } else if (deltaGKjPerMol > 0.1) {
      spontaneity = 'non_spontaneous';
    } else {
      spontaneity = 'equilibrium';
    }

    const dHStr = deltaHKjPerMol > 0 ? `+${deltaHKjPerMol}` : `${deltaHKjPerMol}`;
    const dSStr = deltaSJoulesPerMolK > 0 ? `+${deltaSJoulesPerMolK}` : `${deltaSJoulesPerMolK}`;
    const dGStr = deltaGKjPerMol > 0 ? `+${deltaGKjPerMol}` : `${deltaGKjPerMol}`;

    thermoInterpretation = `ΔH = ${dHStr} kJ/mol | ΔS = ${dSStr} J/(mol·K) → ΔG = ${dGStr} kJ/mol (${
      spontaneity === 'spontaneous'
        ? `Thermodynamically Spontaneous (favored at ${tempK.toFixed(0)} K)`
        : `Non-spontaneous at ${tempK.toFixed(0)} K`
    })`;
  }

  // Derive realistic reaction time length and kinetics mechanism
  let reactionTimeLengthSec = customTimeLengthSec ?? 4.0;
  let kineticsType = 'Chemical Reaction Kinetics';

  switch (typeCategory) {
    case 'acid_base':
      reactionTimeLengthSec = customTimeLengthSec ?? 2.5;
      kineticsType = 'Fast Proton-Transfer Neutralization';
      break;
    case 'precipitation':
      reactionTimeLengthSec = customTimeLengthSec ?? 3.5;
      kineticsType = 'Rapid Ionic Lattice Nucleation & Precipitation';
      break;
    case 'gas_evolution':
      reactionTimeLengthSec = customTimeLengthSec ?? 5.5;
      kineticsType = 'Heterogeneous Effervescent Gas Bubble Evolution';
      break;
    case 'redox':
      reactionTimeLengthSec = customTimeLengthSec ?? 4.5;
      kineticsType = 'Multistep Electron Transfer (Redox Kinetics)';
      break;
    case 'complexation':
      reactionTimeLengthSec = customTimeLengthSec ?? 3.0;
      kineticsType = 'Rapid Coordination Ligand Exchange Complexation';
      break;
    case 'decomposition':
      reactionTimeLengthSec = customTimeLengthSec ?? 6.0;
      kineticsType = 'Thermal Activation Energy Barrier Decomposition';
      break;
    case 'single_displacement':
      reactionTimeLengthSec = customTimeLengthSec ?? 5.0;
      kineticsType = 'Surface Oxidation-Reduction Metal Displacement';
      break;
    case 'thermal_equilibrium':
      reactionTimeLengthSec = customTimeLengthSec ?? 4.0;
      kineticsType = 'Le Chatelier Endothermic / Exothermic Equilibrium Shift';
      break;
    default:
      reactionTimeLengthSec = customTimeLengthSec ?? 4.0;
      kineticsType = 'Bimolecular Solution Reaction Kinetics';
  }

  const nameLower = reactionName.toLowerCase();
  if (nameLower.includes('clock') || nameLower.includes('thiosulfate')) {
    reactionTimeLengthSec = customTimeLengthSec ?? 7.5;
    kineticsType = 'Disproportionation Kinetics (Colloidal Sulfur Cloud Formation)';
  } else if (nameLower.includes('elephant') || nameLower.includes('foam')) {
    reactionTimeLengthSec = customTimeLengthSec ?? 6.0;
    kineticsType = 'Catalytic Decomposition with Rapid Micellar Foam Expansion';
  } else if (nameLower.includes('golden rain') || nameLower.includes('lead iodide')) {
    reactionTimeLengthSec = customTimeLengthSec ?? 4.5;
    kineticsType = 'Crystalline Hexagonal Platelet Lattice Precipitation';
  } else if (nameLower.includes('magnesium') && nameLower.includes('acid')) {
    reactionTimeLengthSec = customTimeLengthSec ?? 5.0;
    kineticsType = 'Vigorous Heterogeneous Surface Metal-Acid Reaction';
  }

  const enrichedProducts = products.map((p) => enrichParticipantPhysicalProperties(p));

  return {
    reactionName,
    reactionType,
    typeCategory,
    balancedEquation,
    thermochemistry,
    deltaHKjPerMol,
    deltaSJoulesPerMolK,
    deltaGKjPerMol,
    spontaneity,
    thermoInterpretation,
    reactants,
    products: enrichedProducts,
    conservationNote:
      conservationNote ||
      'Law of Conservation of Mass: Total reactant mass equals total product mass. In a sealed closed beaker, mass is strictly constant (Δm = 0). In an open beaker, gaseous products escape into the room.',
    subReactions,
    isMultiReactant: isMultiReactant ?? reactants.length > 2,
    reactionTimeLengthSec,
    kineticsType,
    rateDescription: `Typical reaction time length: ~${reactionTimeLengthSec.toFixed(1)} seconds under standard laboratory conditions (298 K, 1 atm).`,
  };
}

/**
 * Aggregates multiple concurrent/sequential reactions and all dissolved reagents
 * when >2 reactants are present in the vessel.
 */
function aggregateMultiReactantSystem(
  reactions: DetailedReactionInfo[],
  contents: DissolvedChemical[],
  currentTempC: number = 22
): DetailedReactionInfo {
  if (reactions.length === 0) {
    // Fallback: Create detailed reaction from contents if reagents are present
    const reactants: ReactionParticipant[] = contents.map((c) => {
      const { moles, massG } = calculateChemicalMoles(c.chemicalId, c.amountMl);
      const meta = getChemicalMetadata(c.chemicalId);
      const chemItem = ALL_CHEMICALS.find((x) => x.id === c.chemicalId);
      return {
        formula: c.formula,
        name: c.name,
        role: 'reactant',
        moles,
        massG,
        volumeMl: c.amountMl,
        state: meta.state as 'aq' | 's' | 'l' | 'g',
        molarMassGPerMol: meta.molarMass,
        colorHex: chemItem?.color || '#f8fafc',
        appearance: chemItem?.description || meta.properties[0] || 'Aqueous reagent',
        properties: meta.properties,
      };
    });

    return createReactionDetails(
      `Multi-Component Mixture (${reactants.length} Species)`,
      'Equilibrium Aqueous Mixture',
      'thermal_equilibrium',
      reactants.map((r) => r.formula).join(' + ') + ' ⇌ Homogeneous Solution',
      'Thermally Stable Ambient Mixture',
      reactants,
      [],
      'Law of Conservation of Mass: Total mixture mass is conserved.',
      0,
      0,
      currentTempC,
      undefined,
      reactants.length > 2
    );
  }

  if (reactions.length === 1 && contents.length <= 2) {
    return reactions[0];
  }

  // 1. Combine all reactants from all reactions without duplicate formulas
  const reactantMap = new Map<string, ReactionParticipant>();
  reactions.forEach((rxn) => {
    rxn.reactants.forEach((r) => {
      const key = r.formula.replace(/\(aq\)|\(s\)|\(l\)|\(g\)/g, '').trim();
      if (!reactantMap.has(key)) {
        reactantMap.set(key, { ...r });
      } else {
        const existing = reactantMap.get(key)!;
        existing.moles = Number((existing.moles + r.moles).toFixed(4));
        existing.massG = Number((existing.massG + r.massG).toFixed(2));
      }
    });
  });

  // Ensure ALL chemicals added to the vessel by the student are included in reactants
  contents.forEach((c) => {
    const key = c.formula.replace(/\(aq\)|\(s\)|\(l\)|\(g\)/g, '').trim();
    if (!reactantMap.has(key)) {
      const { moles, massG } = calculateChemicalMoles(c.chemicalId, c.amountMl);
      const meta = getChemicalMetadata(c.chemicalId);
      const chemItem = ALL_CHEMICALS.find((x) => x.id === c.chemicalId);
      const isCatalyst = c.chemicalId.includes('mno2');
      const isSpectator = !isCatalyst;
      reactantMap.set(key, {
        formula: c.formula,
        name: c.name,
        role: isCatalyst ? 'catalyst' : isSpectator ? 'spectator' : 'reactant',
        moles,
        massG,
        volumeMl: c.amountMl,
        state: meta.state as 'aq' | 's' | 'l' | 'g',
        molarMassGPerMol: meta.molarMass,
        colorHex: chemItem?.color || '#f8fafc',
        appearance: chemItem?.description || meta.properties[0] || 'Aqueous solution',
        properties: meta.properties,
      });
    }
  });

  // 2. Combine all products from all reactions (sum moles and mass for identical products like H2O or NaCl)
  const productMap = new Map<string, ReactionParticipant>();
  reactions.forEach((rxn) => {
    rxn.products.forEach((p) => {
      const enriched = enrichParticipantPhysicalProperties(p);
      const key = enriched.formula.replace(/\(aq\)|\(s\)|\(l\)|\(g\)/g, '').trim();
      if (!productMap.has(key)) {
        productMap.set(key, { ...enriched });
      } else {
        const existing = productMap.get(key)!;
        existing.moles = Number((existing.moles + enriched.moles).toFixed(4));
        existing.massG = Number((existing.massG + enriched.massG).toFixed(2));
        if (!existing.physicalProperties && enriched.physicalProperties) {
          existing.physicalProperties = enriched.physicalProperties;
        }
        if (enriched.properties && enriched.properties.length > 0) {
          existing.properties = Array.from(new Set([...existing.properties, ...enriched.properties]));
        }
      }
    });
  });

  const combinedReactants = Array.from(reactantMap.values());
  const combinedProducts = Array.from(productMap.values());

  // 3. Aggregate sub-reactions for step-by-step mechanism tracking
  const subReactions: SubReactionInfo[] = reactions.map((rxn) => ({
    name: rxn.reactionName,
    equation: rxn.balancedEquation,
    type: rxn.reactionType,
    category: rxn.typeCategory,
    deltaHKjPerMol: rxn.deltaHKjPerMol,
    deltaSJoulesPerMolK: rxn.deltaSJoulesPerMolK,
    reactants: rxn.reactants,
    products: rxn.products,
  }));

  // 4. Calculate Net Thermodynamics: ΔH_net and ΔS_net
  let netDeltaH: number | undefined;
  let netDeltaS: number | undefined;

  const validH = reactions.filter((r) => r.deltaHKjPerMol !== undefined);
  if (validH.length > 0) {
    netDeltaH = Number(validH.reduce((sum, r) => sum + (r.deltaHKjPerMol || 0), 0).toFixed(1));
  }

  const validS = reactions.filter((r) => r.deltaSJoulesPerMolK !== undefined);
  if (validS.length > 0) {
    netDeltaS = Number(validS.reduce((sum, r) => sum + (r.deltaSJoulesPerMolK || 0), 0).toFixed(1));
  }

  // 5. Construct Overall Multi-Reactant Names and Equations
  const distinctTypes = Array.from(new Set(reactions.map((r) => r.reactionType)));
  const reactionClassification =
    reactions.length > 1
      ? `Coupled Multi-Stage: ${distinctTypes.join(' + ')}`
      : reactions[0].reactionType;

  const systemName =
    reactions.length > 1
      ? `Multi-Reactant System (${combinedReactants.length} Reactants, ${reactions.length} Stages)`
      : `${reactions[0].reactionName} (${combinedReactants.length} Reactants Present)`;

  const reactantEquationPart = combinedReactants
    .filter((r) => r.role === 'reactant' || r.role === 'catalyst')
    .map((r) => r.formula)
    .join(' + ');
  const productEquationPart =
    combinedProducts.length > 0
      ? combinedProducts.map((p) => p.formula).join(' + ')
      : 'Complex Equilibrium';

  const overallEquation = `[Overall System] ${reactantEquationPart} ➔ ${productEquationPart}\n${reactions
    .map((r, i) => `[Stage ${i + 1}] ${r.balancedEquation}`)
    .join('\n')}`;

  const primaryCategory = reactions[0].typeCategory;

  const totalReactantMass = combinedReactants.reduce((sum, r) => sum + r.massG, 0);
  const totalProductMass = combinedProducts.reduce((sum, p) => sum + p.massG, 0);

  const conservationNote = `Law of Conservation of Mass: Combined reactant mass (${totalReactantMass.toFixed(
    1
  )} g) yields all ${combinedProducts.length} formed products (${totalProductMass.toFixed(
    1
  )} g). In a sealed closed beaker, mass is strictly invariant (Δm = 0.00 g). In an open beaker, evolved gases escape to air.`;

  return createReactionDetails(
    systemName,
    reactionClassification,
    primaryCategory,
    overallEquation,
    netDeltaH !== undefined
      ? `Net ${netDeltaH < 0 ? 'Exothermic' : 'Endothermic'} (ΔH_net = ${netDeltaH > 0 ? '+' : ''}${netDeltaH} kJ/mol)`
      : 'Thermally Coupled Equilibrium',
    combinedReactants,
    combinedProducts,
    conservationNote,
    netDeltaH,
    netDeltaS,
    currentTempC,
    subReactions,
    true
  );
}

export function evaluateVesselState(
  contents: DissolvedChemical[],
  currentTempC: number,
  isHeating: boolean
): ReactionOutcome {
  const chemicalMap = new Map<string, number>();
  contents.forEach((c) => {
    chemicalMap.set(c.chemicalId, (chemicalMap.get(c.chemicalId) || 0) + c.amountMl);
  });

  const getAmount = (id: string) => chemicalMap.get(id) || 0;
  const has = (id: string) => (chemicalMap.get(id) || 0) > 0;

  const totalVol = contents.reduce((sum, c) => sum + c.amountMl, 0);
  if (totalVol === 0) {
    return {
      pH: 7.0,
      color: 'rgba(255, 255, 255, 0.05)',
      temperatureChange: 0,
      precipitate: null,
      gasEvolving: null,
      gasAtmosphere: null,
      undissolvedSolids: [],
      foamHeightPercent: 0,
      activeIndicator: null,
      activeReactionName: null,
      activeReactionEquation: null,
      activeReactionType: null,
      detailedReaction: null,
      allReactions: [],
      reactionPulse: false,
      loggedEvents: [],
    };
  }

  // Check whether aqueous water/solvent medium is present in the vessel
  const hasAqueousMedium = contents.some((c) => {
    const item = ALL_CHEMICALS.find((x) => x.id === c.chemicalId);
    return item?.state === 'liquid';
  });

  // 1. Calculate Acid-Base Neutralization & Net pH
  const naohPelletMoles = hasAqueousMedium ? calculateChemicalMoles('naoh_pellets', getAmount('naoh_pellets')).moles : 0;
  const naMetalMoles = hasAqueousMedium ? calculateChemicalMoles('na_metal', getAmount('na_metal')).moles : 0;
  const caMetalMoles = hasAqueousMedium ? calculateChemicalMoles('ca_granules', getAmount('ca_granules')).moles : 0;
  const nh3GasMoles = hasAqueousMedium ? calculateChemicalMoles('nh3_gas', getAmount('nh3_gas')).moles : 0;
  const hclGasMoles = hasAqueousMedium ? calculateChemicalMoles('hcl_gas', getAmount('hcl_gas')).moles : 0;
  const co2MolesAcid = hasAqueousMedium
    ? (calculateChemicalMoles('co2_gas', getAmount('co2_gas')).moles +
        calculateChemicalMoles('co2_dry_ice', getAmount('co2_dry_ice')).moles * 0.04)
    : 0;
  const so2MolesAcid = hasAqueousMedium ? calculateChemicalMoles('so2_gas', getAmount('so2_gas')).moles * 0.45 : 0;
  const nh4clMolesAcid = hasAqueousMedium ? calculateChemicalMoles('nh4cl_solid', getAmount('nh4cl_solid')).moles * 0.002 : 0;

  let molesH =
    (getAmount('hcl_1m') * 1.0) / 1000 +
    (getAmount('hcl_6m') * 6.0) / 1000 +
    (getAmount('h2so4_1m') * 2.0) / 1000 +
    (getAmount('hno3_1m') * 1.0) / 1000 +
    (getAmount('ch3cooh_1m') * 0.15) / 1000 +
    (getAmount('citric_acid') * 0.3) / 1000 +
    hclGasMoles +
    co2MolesAcid +
    so2MolesAcid +
    nh4clMolesAcid;

  let molesOH =
    (getAmount('naoh_1m') * 1.0) / 1000 +
    (getAmount('naoh_6m') * 6.0) / 1000 +
    (getAmount('koh_1m') * 1.0) / 1000 +
    (getAmount('nh3_aq') * 0.15) / 1000 +
    (getAmount('ca_oh2') * 0.08) / 1000 +
    (getAmount('nahco3_sol') * 0.1) / 1000 +
    naohPelletMoles +
    naMetalMoles +
    caMetalMoles * 0.6 +
    nh3GasMoles * 0.25;

  let calculatedPH = 7.0;
  let tempDelta = 0;

  if (molesH > 0 && molesOH > 0) {
    const reactedMoles = Math.min(molesH, molesOH);
    tempDelta += Math.min(22, (reactedMoles * 57300) / (Math.max(10, totalVol) * 4.18));
  }

  const netMoles = molesH - molesOH;
  const volL = Math.max(0.001, totalVol / 1000);

  if (Math.abs(netMoles) < 0.0001) {
    calculatedPH = 7.0;
  } else if (netMoles > 0) {
    const concH = netMoles / volL;
    calculatedPH = Math.max(0.1, Math.min(6.9, -Math.log10(concH)));
  } else {
    const concOH = Math.abs(netMoles) / volL;
    const pOH = -Math.log10(concOH);
    calculatedPH = Math.max(7.1, Math.min(14.0, 14.0 - pOH));
  }

  // 2. Base Solution Color & Visual Properties
  let baseSolutionColor = hasAqueousMedium ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
  let reactionPulse = false;
  let foamHeightPercent = 0;
  let precipitate: PrecipitateInfo | null = null;
  let gasEvolving: EvolvedGasInfo | null = null;
  let gasAtmosphere: GasAtmosphereInfo | null = null;
  let activeIndicator: string | null = null;

  // Compute any undissolved solid elements / molecules sitting in the vessel
  const undissolvedSolids: UndissolvedSolidInfo[] = [];
  contents.forEach((c) => {
    const item = ALL_CHEMICALS.find((x) => x.id === c.chemicalId);
    if (!item || (item.state !== 'solid_powder' && item.state !== 'solid_strip')) return;
    // Soluble crystalline salts/bases dissolve rapidly if aqueous medium exists (unless already dehydrated dry)
    const dissolvesCleanly =
      hasAqueousMedium &&
      ['naoh_pellets', 'nh4cl_solid', 'urea_solid', 'sucrose_solid', 'cuso4_crystals', 'kmno4_crystals'].includes(c.chemicalId);
    if (!dissolvesCleanly) {
      undissolvedSolids.push({
        chemicalId: item.id,
        formula: item.formula,
        name: item.name,
        color: item.color,
        amountG: c.amountMl,
        portionAmountsG:
          c.portionAmountsG && c.portionAmountsG.length > 0 ? c.portionAmountsG : [c.amountMl],
        texture: item.state === 'solid_strip' ? 'strip' : item.speciesKind === 'molecule' ? 'crystal' : 'powder',
      });
    }
  });

  // Compute visible gaseous atmosphere in vessel headspace from added gases or heated sublimates
  const gasItemsInVessel = contents
    .map((c) => ({ content: c, item: ALL_CHEMICALS.find((x) => x.id === c.chemicalId) }))
    .filter((pair) => pair.item?.state === 'gas');

  if (gasItemsInVessel.length > 0) {
    const primary = gasItemsInVessel[gasItemsInVessel.length - 1];
    const totalGasVol = gasItemsInVessel.reduce((s, p) => s + p.content.amountMl, 0);
    const id = primary.item!.id;
    const densityFactor = Number(
      Math.min(1, Math.max(0.08, Math.pow(Math.max(1, totalGasVol) / 180, 0.68))).toFixed(3)
    );
    let atmoColor = primary.item!.color;
    let maxAtmoOpacity = 0.68;
    if (id === 'no2_gas') {
      // NO2/N2O4 dimerization intensifies deep amber-brown with heat
      atmoColor = currentTempC > 45 || isHeating ? '#9a3412' : '#d97706';
      maxAtmoOpacity = currentTempC > 45 || isHeating ? 0.88 : 0.78;
    } else if (id === 'cl2_gas') {
      maxAtmoOpacity = 0.76;
    } else if (id === 'so2_gas') {
      maxAtmoOpacity = 0.7;
    }
    const atmoOpacity = Number((0.1 + densityFactor * (maxAtmoOpacity - 0.1)).toFixed(3));
    gasAtmosphere = {
      formula: primary.item!.formula,
      name: primary.item!.name,
      color: atmoColor,
      opacity: atmoOpacity,
      volumeMl: totalGasVol,
      densityFactor,
    };
  }

  // Baseline transition metal & dissolved solid colors
  if (has('cuso4_sol') || (has('cuso4_crystals') && hasAqueousMedium)) {
    baseSolutionColor = '#0284c7'; // Azure Blue
  } else if (has('cucl2_sol')) {
    baseSolutionColor = '#0d9488'; // Emerald Aqua Turquoise
  } else if (has('fecl3_sol')) {
    baseSolutionColor = '#b45309'; // Golden Amber Cognac
  } else if (has('feso4_sol')) {
    baseSolutionColor = '#86efac'; // Pale Mint Green
  } else if (has('kmno4_sol') || (has('kmno4_crystals') && hasAqueousMedium)) {
    baseSolutionColor = '#6b21a8'; // Royal Purple
  } else if (has('k2cr2o7_sol')) {
    baseSolutionColor = '#ea580c'; // Fiery Orange
  } else if (has('k2cro4_sol')) {
    baseSolutionColor = '#eab308'; // Canary Yellow
  } else if (has('cocl2_sol')) {
    baseSolutionColor = '#f43f5e'; // Rose Pink
  } else if (has('niso4_sol')) {
    baseSolutionColor = '#10b981'; // Apple Emerald Green
  } else if (has('i2_lugol') || (has('i2_crystals') && hasAqueousMedium)) {
    baseSolutionColor = '#78350f'; // Whiskey Amber Brown
  }

  // 3. Discrete Reaction Detection Array: Collect ALL active reactions
  const detectedReactions: DetailedReactionInfo[] = [];

  // REACTION 1: Single Displacement of Silver by Copper (Cu + 2AgNO3 -> Cu(NO3)2 + 2Ag)
  if (has('cu_turnings') && has('agno3_sol')) {
    baseSolutionColor = '#0284c7'; // Azure Blue from Cu2+
    reactionPulse = true;

    const cuMoles = calculateChemicalMoles('cu_turnings', getAmount('cu_turnings')).moles;
    const agMoles = calculateChemicalMoles('agno3_sol', getAmount('agno3_sol')).moles;
    const reactedCu = Math.min(cuMoles, agMoles / 2);
    const formedAgMoles = reactedCu * 2;
    const agMass = Number((formedAgMoles * 107.87).toFixed(2));

    precipitate = {
      formula: '2Ag(s)↓',
      name: 'Lustrous Silver Crystals',
      color: '#e2e8f0',
      amountG: agMass,
      moles: formedAgMoles,
      texture: 'crystalline',
      description: 'Shiny lustrous dendritic silver needle crystals growing on copper surface.',
      properties: ['Precipitated solid metal', 'Zero oxidation state Ag(0)', 'Dendritic crystal habit'],
    };

    detectedReactions.push(
      createReactionDetails(
        'Single Displacement: Silver Crystal Growth',
        'Single Displacement / Oxidation-Reduction (Redox)',
        'single_displacement',
        'Cu(s) + 2AgNO₃(aq) ➔ Cu(NO₃)₂(aq) (Blue) + 2Ag(s)↓ (Silver Crystals)',
        'Exothermic (ΔH° = -147 kJ/mol)',
        [
          {
            formula: 'Cu(s)',
            name: 'Copper Metal Turnings',
            role: 'reactant',
            moles: cuMoles,
            massG: Number((cuMoles * 63.55).toFixed(2)),
            state: 's',
            molarMassGPerMol: 63.55,
            colorHex: '#d97706',
            appearance: 'Red-orange metallic foil/turnings',
            properties: ['Reducing metal (E° = +0.34 V)', 'Displaces Ag⁺ ions', 'High electrical conductivity'],
          },
          {
            formula: 'AgNO₃(aq)',
            name: 'Silver Nitrate Solution',
            role: 'reactant',
            moles: agMoles,
            massG: Number((agMoles * 169.87).toFixed(2)),
            volumeMl: getAmount('agno3_sol'),
            state: 'aq',
            molarMassGPerMol: 169.87,
            colorHex: '#f8fafc',
            appearance: 'Clear colorless solution (0.2 M)',
            properties: ['Oxidizing silver(I) salt', 'Photosensitive', 'Soluble electrolyte'],
          },
        ],
        [
          {
            formula: '2Ag(s)↓',
            name: 'Elemental Silver Crystals',
            role: 'product',
            moles: formedAgMoles,
            massG: agMass,
            state: 's',
            molarMassGPerMol: 107.87,
            colorHex: '#e2e8f0',
            appearance: 'Lustrous dendritic silver needle crystals',
            properties: ['Precipitated solid metal', 'Zero oxidation state Ag(0)', 'Dendritic crystal habit'],
          },
          {
            formula: 'Cu(NO₃)₂(aq)',
            name: 'Copper(II) Nitrate Solution',
            role: 'product',
            moles: reactedCu,
            massG: Number((reactedCu * 187.56).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 187.56,
            colorHex: '#0284c7',
            appearance: 'Radiant azure blue solution',
            properties: ['Hexaaquacopper(II) complex [Cu(H₂O)₆]²⁺', 'Soluble blue salt', 'Paramagnetic d⁹'],
          },
        ],
        undefined,
        -147.0,
        -84.2,
        currentTempC
      )
    );
  }

  // REACTION 2: Single Displacement of Copper by Iron (Fe + CuSO4 -> FeSO4 + Cu)
  if (has('fe_filings') && has('cuso4_sol')) {
    baseSolutionColor = '#86efac'; // Shifts from blue to pale seafoam green FeSO4
    reactionPulse = true;

    const feMoles = calculateChemicalMoles('fe_filings', getAmount('fe_filings')).moles;
    const cuMoles = calculateChemicalMoles('cuso4_sol', getAmount('cuso4_sol')).moles;
    const reactedMoles = Math.min(feMoles, cuMoles);
    const cuMass = Number((reactedMoles * 63.55).toFixed(2));

    if (!precipitate) {
      precipitate = {
        formula: 'Cu(s)↓',
        name: 'Elemental Copper Metal',
        color: '#d97706',
        amountG: cuMass,
        moles: reactedMoles,
        texture: 'granular',
        description: 'Red-bronze elemental copper metal deposited on iron filings.',
        properties: ['Elemental metal Cu(0)', 'Insoluble coating', 'Conductive'],
      };
    }

    detectedReactions.push(
      createReactionDetails(
        'Single Displacement: Copper Plating on Iron',
        'Single Displacement / Redox Deposition',
        'single_displacement',
        'Fe(s) + CuSO₄(aq) ➔ FeSO₄(aq) (Pale Green) + Cu(s)↓ (Copper Metal)',
        'Exothermic (ΔH° = -152 kJ/mol)',
        [
          {
            formula: 'Fe(s)',
            name: 'Iron Filings Powder',
            role: 'reactant',
            moles: feMoles,
            massG: Number((feMoles * 55.85).toFixed(2)),
            state: 's',
            molarMassGPerMol: 55.85,
            colorHex: '#334155',
            appearance: 'Dark grey ferromagnetic powder',
            properties: ['Reducing agent (E° = -0.44 V)', 'Oxidizes from Fe(0) to Fe(II)', 'Transition metal'],
          },
          {
            formula: 'CuSO₄(aq)',
            name: 'Copper(II) Sulfate Solution',
            role: 'reactant',
            moles: cuMoles,
            massG: Number((cuMoles * 159.61).toFixed(2)),
            volumeMl: getAmount('cuso4_sol'),
            state: 'aq',
            molarMassGPerMol: 159.61,
            colorHex: '#0284c7',
            appearance: 'Azure blue solution (0.5 M)',
            properties: ['Oxidant Cu²⁺ (E° = +0.34 V)', 'Reduces to Cu(0)', 'Hydrated copper salt'],
          },
        ],
        [
          {
            formula: 'Cu(s)↓',
            name: 'Elemental Copper Coating',
            role: 'product',
            moles: reactedMoles,
            massG: cuMass,
            state: 's',
            molarMassGPerMol: 63.55,
            colorHex: '#d97706',
            appearance: 'Red-bronze granular metallic coating on iron',
            properties: ['Elemental reduced metal Cu(0)', 'Insoluble solid coating', 'Conductive metal'],
          },
          {
            formula: 'FeSO₄(aq)',
            name: 'Iron(II) Sulfate Solution',
            role: 'product',
            moles: reactedMoles,
            massG: Number((reactedMoles * 151.91).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 151.91,
            colorHex: '#86efac',
            appearance: 'Pale seafoam green solution',
            properties: ['Soluble iron(II) electrolyte', 'Paramagnetic Fe²⁺', 'Slowly oxidizes in air to brown Fe³⁺'],
          },
        ],
        undefined,
        -152.4,
        24.0,
        currentTempC
      )
    );
  }

  // REACTION 3: Copper(II) Hydroxide Precipitation (CuSO4 + 2NaOH -> Cu(OH)2 + Na2SO4)
  if (has('cuso4_sol') && (has('naoh_1m') || has('naoh_6m') || has('koh_1m')) && getAmount('nh3_aq') < 10) {
    const isDehydrated = currentTempC >= 65 || isHeating;
    const cuMoles = calculateChemicalMoles('cuso4_sol', getAmount('cuso4_sol')).moles;
    const naohMoles =
      calculateChemicalMoles('naoh_1m', getAmount('naoh_1m')).moles +
      calculateChemicalMoles('naoh_6m', getAmount('naoh_6m')).moles;
    const reactedCu = Math.min(cuMoles, naohMoles / 2);
    reactionPulse = true;

    if (isDehydrated) {
      precipitate = {
        formula: 'CuO(s)↓',
        name: 'Copper(II) Oxide',
        color: '#18181b',
        amountG: Number((reactedCu * 79.55).toFixed(2)),
        moles: reactedCu,
        texture: 'granular',
        description: 'Black granular copper oxide from thermal dehydration.',
        properties: ['Insoluble basic oxide', 'Jet black granular powder', 'Formed by thermal dehydration'],
      };

      detectedReactions.push(
        createReactionDetails(
          'Thermal Dehydration of Copper Hydroxide',
          'Thermal Decomposition / Dehydration',
          'decomposition',
          'CuSO₄(aq) + 2NaOH(aq) ──[Heat Δ]──➔ CuO(s)↓ (Jet Black) + Na₂SO₄(aq) + H₂O(l)',
          'Endothermic Dehydration (+54 kJ/mol)',
          [
            {
              formula: 'CuSO₄(aq)',
              name: 'Copper(II) Sulfate Solution',
              role: 'reactant',
              moles: cuMoles,
              massG: Number((cuMoles * 159.61).toFixed(2)),
              volumeMl: getAmount('cuso4_sol'),
              state: 'aq',
              molarMassGPerMol: 159.61,
              colorHex: '#0284c7',
              appearance: 'Luminous azure blue solution',
              properties: ['Copper(II) cation source', 'Hydrated sulfate salt'],
            },
            {
              formula: 'NaOH(aq)',
              name: 'Sodium Hydroxide Alkali',
              role: 'reactant',
              moles: naohMoles,
              massG: Number((naohMoles * 40.0).toFixed(2)),
              state: 'aq',
              molarMassGPerMol: 40.0,
              colorHex: '#f8fafc',
              appearance: 'Caustic alkaline solution',
              properties: ['Strong caustic base', 'Hydroxide donor OH⁻'],
            },
          ],
          [
            {
              formula: 'CuO(s)↓',
              name: 'Copper(II) Oxide Black Solid',
              role: 'product',
              moles: reactedCu,
              massG: Number((reactedCu * 79.55).toFixed(2)),
              state: 's',
              molarMassGPerMol: 79.55,
              colorHex: '#18181b',
              appearance: 'Jet black granular solid oxide precipitate',
              properties: ['Basic oxide', 'Insoluble in water', 'Thermal product'],
            },
            {
              formula: 'Na₂SO₄(aq)',
              name: 'Sodium Sulfate Solution',
              role: 'product',
              moles: reactedCu,
              massG: Number((reactedCu * 142.04).toFixed(2)),
              state: 'aq',
              molarMassGPerMol: 142.04,
              colorHex: '#f8fafc',
              appearance: 'Clear aqueous salt solution',
              properties: ['Soluble spectator salt', 'Neutral pH 7.00'],
            },
          ],
          undefined,
          54.0,
          95.0,
          currentTempC
        )
      );
    } else {
      precipitate = {
        formula: 'Cu(OH)₂(s)↓',
        name: 'Copper(II) Hydroxide',
        color: '#38bdf8',
        amountG: Number((reactedCu * 97.56).toFixed(2)),
        moles: reactedCu,
        texture: 'gelatinous',
        description: 'Gelatinous flocculent royal azure blue precipitate.',
        properties: ['Insoluble basic hydroxide (Ksp = 2.2 × 10⁻²⁰)', 'Gelatinous blue flocculent', 'Dehydrates to CuO above 65°C'],
      };

      detectedReactions.push(
        createReactionDetails(
          'Copper(II) Hydroxide Precipitation',
          'Precipitation / Double Displacement',
          'precipitation',
          'CuSO₄(aq) + 2NaOH(aq) ➔ Cu(OH)₂(s)↓ (Blue Gel) + Na₂SO₄(aq)',
          'Exothermic Precipitation (ΔH° = -48.2 kJ/mol)',
          [
            {
              formula: 'CuSO₄(aq)',
              name: 'Copper(II) Sulfate Solution',
              role: 'reactant',
              moles: cuMoles,
              massG: Number((cuMoles * 159.61).toFixed(2)),
              volumeMl: getAmount('cuso4_sol'),
              state: 'aq',
              molarMassGPerMol: 159.61,
              colorHex: '#0284c7',
              appearance: 'Luminous azure blue solution',
              properties: ['Cu²⁺ Lewis acid cation', 'Azure blue chromophore', 'Soluble salt'],
            },
            {
              formula: 'NaOH(aq)',
              name: 'Sodium Hydroxide Alkali',
              role: 'reactant',
              moles: naohMoles,
              massG: Number((naohMoles * 40.0).toFixed(2)),
              volumeMl: getAmount('naoh_1m') + getAmount('naoh_6m'),
              state: 'aq',
              molarMassGPerMol: 40.0,
              colorHex: '#f8fafc',
              appearance: 'Clear caustic solution',
              properties: ['Strong caustic base', 'Hydroxide donor (OH⁻)', 'pH ~ 14.0'],
            },
          ],
          [
            {
              formula: 'Cu(OH)₂(s)↓',
              name: 'Copper(II) Hydroxide Gel',
              role: 'product',
              moles: reactedCu,
              massG: Number((reactedCu * 97.56).toFixed(2)),
              state: 's',
              molarMassGPerMol: 97.56,
              colorHex: '#38bdf8',
              appearance: 'Royal azure blue gelatinous precipitate',
              properties: ['Insoluble hydroxide (Ksp = 2.2 × 10⁻²⁰)', 'Gelatinous texture', 'Thermal precursor to CuO'],
            },
            {
              formula: 'Na₂SO₄(aq)',
              name: 'Sodium Sulfate Solution',
              role: 'product',
              moles: reactedCu,
              massG: Number((reactedCu * 142.04).toFixed(2)),
              state: 'aq',
              molarMassGPerMol: 142.04,
              colorHex: '#f8fafc',
              appearance: 'Clear aqueous solution',
              properties: ['Neutral soluble salt', 'Strong electrolyte', 'Spectator ions'],
            },
          ],
          undefined,
          -48.2,
          -56.0,
          currentTempC
        )
      );
    }
  }

  // REACTION 4: Tetraamminecopper(II) Deep Azure-Violet Complex (Cu2+ + 4NH3 -> [Cu(NH3)4]2+)
  if (has('cuso4_sol') && has('nh3_aq')) {
    baseSolutionColor = '#312e81'; // Intense Royal Navy Azure-Violet
    reactionPulse = true;

    const cuMoles = calculateChemicalMoles('cuso4_sol', getAmount('cuso4_sol')).moles;
    const nh3Moles = calculateChemicalMoles('nh3_aq', getAmount('nh3_aq')).moles;
    const complexMoles = Math.min(cuMoles, nh3Moles / 4);

    detectedReactions.push(
      createReactionDetails(
        'Tetraamminecopper(II) Coordination Complex',
        'Lewis Acid-Base Coordination (Ligand Exchange)',
        'complexation',
        'Cu²⁺(aq) + 4NH₃(aq) ➔ [Cu(NH₃)₄]²⁺(aq) (Deep Azure-Violet Solution)',
        'Exothermic (ΔH° = -88 kJ/mol)',
        [
          {
            formula: 'Cu²⁺(aq)',
            name: 'Aqueous Copper(II) Ions',
            role: 'reactant',
            moles: cuMoles,
            massG: Number((cuMoles * 63.55).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 63.55,
            colorHex: '#0284c7',
            appearance: 'Pale blue hexaaqua complex [Cu(H₂O)₆]²⁺',
            properties: ['Lewis acid central cation', 'd⁹ electronic configuration', 'Jahn-Teller distorted'],
          },
          {
            formula: 'NH₃(aq)',
            name: 'Aqueous Ammonia (Ligand)',
            role: 'reactant',
            moles: nh3Moles,
            massG: Number((nh3Moles * 17.03).toFixed(2)),
            volumeMl: getAmount('nh3_aq'),
            state: 'aq',
            molarMassGPerMol: 17.03,
            colorHex: '#f8fafc',
            appearance: 'Colorless pungent volatile base',
            properties: ['Lewis base monodentate ligand', 'Stronger crystal field than H₂O', 'Pungent aroma'],
          },
        ],
        [
          {
            formula: '[Cu(NH₃)₄]²⁺(aq)',
            name: 'Tetraamminecopper(II) Complex Ion',
            role: 'product',
            moles: complexMoles,
            massG: Number((complexMoles * 227.75).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 227.75,
            colorHex: '#312e81',
            appearance: 'Luminous royal navy azure-violet chromophore',
            properties: ['Square planar geometry', 'Intense d-d transition absorption (~600 nm)', 'Soluble coordination complex'],
          },
        ],
        undefined,
        -88.0,
        -112.0,
        currentTempC
      )
    );
  }

  // REACTION 5: Iron(III) Thiocyanate Blood-Red Complex (Fe3+ + SCN- -> [Fe(SCN)]2+)
  if (has('fecl3_sol') && has('kscn_sol')) {
    baseSolutionColor = '#991b1b'; // Intense Ruby Blood-Red
    reactionPulse = true;

    const feMoles = calculateChemicalMoles('fecl3_sol', getAmount('fecl3_sol')).moles;
    const scnMoles = calculateChemicalMoles('kscn_sol', getAmount('kscn_sol')).moles;
    const complexMoles = Math.min(feMoles, scnMoles);

    detectedReactions.push(
      createReactionDetails(
        'Iron(III) Thiocyanate Complex',
        'Lewis Acid-Base Coordination Complexation',
        'complexation',
        'Fe³⁺(aq) + SCN⁻(aq) ➔ [Fe(SCN)]²⁺(aq) (Blood-Red Complex)',
        'Rapid Exothermic Equilibrium (Kf = 8.9 × 10²)',
        [
          {
            formula: 'Fe³⁺(aq)',
            name: 'Iron(III) Cation Reagent',
            role: 'reactant',
            moles: feMoles,
            massG: Number((feMoles * 55.85).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 162.2,
            colorHex: '#b45309',
            appearance: 'Golden amber cognac solution',
            properties: ['Hard Lewis acid', 'High charge density (z/r = 4.6)', 'Paramagnetic high-spin d⁵'],
          },
          {
            formula: 'SCN⁻(aq)',
            name: 'Potassium Thiocyanate',
            role: 'reactant',
            moles: scnMoles,
            massG: Number((scnMoles * 97.18).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 97.18,
            colorHex: '#f8fafc',
            appearance: 'Clear colorless solution',
            properties: ['Pseudohalide ambidentate ligand', 'Coordinates through nitrogen', 'Selective for Fe³⁺'],
          },
        ],
        [
          {
            formula: '[Fe(SCN)]²⁺(aq)',
            name: 'Pentaaquathiocyanatoiron(III)',
            role: 'product',
            moles: complexMoles,
            massG: Number((complexMoles * 113.93).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 113.93,
            colorHex: '#991b1b',
            appearance: 'Intense, horrific ruby blood-red chromophore',
            properties: ['Ligand-to-metal charge-transfer (LMCT) transition', 'Extremely high molar extinction (ε ~ 5000 M⁻¹cm⁻¹)', 'Forensic indicator'],
          },
        ],
        undefined,
        -24.3,
        12.5,
        currentTempC
      )
    );
  }

  // REACTION 6: Synthesis of Prussian Blue (FeCl3 + K4[Fe(CN)6])
  if (has('fecl3_sol') && has('k4fecn6_sol')) {
    const mass = Math.min(getAmount('fecl3_sol'), getAmount('k4fecn6_sol')) * 0.12;
    const feMoles = calculateChemicalMoles('fecl3_sol', getAmount('fecl3_sol')).moles;
    const pbMoles = Number((mass / 859.23).toFixed(5));

    precipitate = {
      formula: 'Fe₄[Fe(CN)₆]₃(s)↓',
      name: 'Prussian Blue Pigment',
      color: '#0f172a',
      amountG: Number(mass.toFixed(2)),
      moles: pbMoles,
      texture: 'curdy',
      description: 'Insoluble deep royal navy blue coordination pigment.',
      properties: ['Mixed-valence coordination polymer (Fe²⁺/Fe³⁺)', 'Insoluble pigment', 'Charge transfer chromophore'],
    };
    reactionPulse = true;

    detectedReactions.push(
      createReactionDetails(
        'Prussian Blue Synthesis',
        'Coordination Polymerization / Double Displacement',
        'complexation',
        '4FeCl₃(aq) + 3K₄[Fe(CN)₆](aq) ➔ Fe₄[Fe(CN)₆]₃(s)↓ + 12KCl(aq)',
        'Exothermic Coordination Polymerization',
        [
          {
            formula: 'FeCl₃(aq)',
            name: 'Iron(III) Chloride Solution',
            role: 'reactant',
            moles: feMoles,
            massG: Number((feMoles * 162.2).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 162.2,
            appearance: 'Golden amber cognac solution',
            properties: ['Transition metal cation', 'Lewis acid'],
          },
          {
            formula: 'K₄[Fe(CN)₆](aq)',
            name: 'Potassium Ferrocyanide',
            role: 'reactant',
            moles: feMoles * 0.75,
            massG: Number((feMoles * 0.75 * 368.35).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 368.35,
            appearance: 'Yellowish clear solution',
            properties: ['Ferrocyanide complex ligand', 'Low toxicity cyanometallate'],
          },
        ],
        [
          {
            formula: 'Fe₄[Fe(CN)₆]₃(s)↓',
            name: 'Prussian Blue Insoluble Pigment',
            role: 'product',
            moles: pbMoles,
            massG: Number(mass.toFixed(2)),
            state: 's',
            molarMassGPerMol: 859.23,
            colorHex: '#0f172a',
            appearance: 'Deep royal navy blue insoluble coordination precipitate',
            properties: ['Fe(II)-CN-Fe(III) intervalence charge transfer', 'Historic artists pigment', 'Insoluble in water'],
          },
        ],
        undefined,
        -118.0,
        45.0,
        currentTempC
      )
    );
  }

  // REACTION 7: Golden Rain (Lead(II) Nitrate + Potassium Iodide)
  if (has('pbno32_sol') && has('ki_sol')) {
    reactionPulse = true;
    const pbMoles = calculateChemicalMoles('pbno32_sol', getAmount('pbno32_sol')).moles;
    const kiMoles = calculateChemicalMoles('ki_sol', getAmount('ki_sol')).moles;
    const formedMoles = Math.min(pbMoles, kiMoles / 2);
    const pbi2Mass = Number((formedMoles * 461.01).toFixed(2));

    if (currentTempC <= 80 || !isHeating) {
      precipitate = {
        formula: 'PbI₂(s)↓',
        name: 'Lead(II) Iodide ("Golden Rain")',
        color: '#facc15',
        amountG: pbi2Mass,
        moles: formedMoles,
        texture: 'crystalline',
        description: 'Dazzling sparkling canary yellow crystalline flakes.',
        properties: ['Insoluble salt (Ksp = 7.1 × 10⁻⁹)', 'Golden Rain optical phenomenon', 'Solubility increases with temperature'],
      };
    }

    detectedReactions.push(
      createReactionDetails(
        'Lead(II) Iodide Precipitation (Golden Rain)',
        'Precipitation / Double Displacement (Metathesis)',
        'precipitation',
        'Pb(NO₃)₂(aq) + 2KI(aq) ➔ PbI₂(s)↓ (Bright Yellow Crystals) + 2KNO₃(aq)',
        'Exothermic Precipitation (ΔH° = -62.8 kJ/mol)',
        [
          {
            formula: 'Pb(NO₃)₂(aq)',
            name: 'Lead(II) Nitrate Solution',
            role: 'reactant',
            moles: pbMoles,
            massG: Number((pbMoles * 331.21).toFixed(2)),
            volumeMl: getAmount('pbno32_sol'),
            state: 'aq',
            molarMassGPerMol: 331.21,
            colorHex: '#f8fafc',
            appearance: 'Clear colorless solution (0.2 M)',
            properties: ['Soluble toxic lead salt', 'Lead cation Pb²⁺ donor', 'Nitrate spectator ions'],
          },
          {
            formula: 'KI(aq)',
            name: 'Potassium Iodide Solution',
            role: 'reactant',
            moles: kiMoles,
            massG: Number((kiMoles * 166.0).toFixed(2)),
            volumeMl: getAmount('ki_sol'),
            state: 'aq',
            molarMassGPerMol: 166.0,
            colorHex: '#f8fafc',
            appearance: 'Clear colorless solution (0.5 M)',
            properties: ['Iodide anion I⁻ source', 'Soluble halide salt', 'Strong electrolyte'],
          },
        ],
        [
          {
            formula: 'PbI₂(s)↓',
            name: 'Lead(II) Iodide Crystals',
            role: 'product',
            moles: formedMoles,
            massG: pbi2Mass,
            state: 's',
            molarMassGPerMol: 461.01,
            colorHex: '#facc15',
            appearance: 'Dazzling canary yellow sparkling crystalline flakes',
            properties: ['Insoluble golden crystalline precipitate (Ksp = 7.1 × 10⁻⁹)', 'Forms "Golden Rain"', 'Heavy metal iodide'],
          },
          {
            formula: 'KNO₃(aq)',
            name: 'Potassium Nitrate Solution',
            role: 'product',
            moles: formedMoles * 2,
            massG: Number((formedMoles * 2 * 101.1).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 101.1,
            colorHex: '#f8fafc',
            appearance: 'Clear aqueous solution',
            properties: ['Soluble spectator salt', 'Neutral pH 7.00', 'Strong electrolyte'],
          },
        ],
        undefined,
        -62.8,
        -78.4,
        currentTempC
      )
    );
  }

  // REACTION 8: Silver Halide Precipitation (AgNO3 + Halides)
  if (has('agno3_sol') && (has('nacl_sol') || has('ki_sol') || has('hcl_1m') || has('hcl_6m'))) {
    reactionPulse = true;
    const isIodide = has('ki_sol');
    const agMoles = calculateChemicalMoles('agno3_sol', getAmount('agno3_sol')).moles;
    const halideMoles = isIodide
      ? calculateChemicalMoles('ki_sol', getAmount('ki_sol')).moles
      : calculateChemicalMoles('nacl_sol', getAmount('nacl_sol')).moles +
        calculateChemicalMoles('hcl_1m', getAmount('hcl_1m')).moles;

    const reacted = Math.min(agMoles, halideMoles);
    const agMass = Number((reacted * (isIodide ? 234.77 : 143.32)).toFixed(2));

    if (!precipitate) {
      precipitate = {
        formula: isIodide ? 'AgI(s)↓' : 'AgCl(s)↓',
        name: isIodide ? 'Silver Iodide' : 'Silver Chloride',
        color: isIodide ? '#fde047' : '#f8fafc',
        amountG: agMass,
        moles: reacted,
        texture: 'curdy',
        description: isIodide
          ? 'Pale primrose yellow curdy silver halide precipitate.'
          : 'Dense cottage-cheese curdy white silver halide precipitate.',
        properties: [
          isIodide ? 'Ksp = 8.5 × 10⁻¹⁷' : 'Ksp = 1.8 × 10⁻¹⁰',
          'Photosensitive silver halide',
          'Dissolves in ammonia',
        ],
      };
    }

    detectedReactions.push(
      createReactionDetails(
        isIodide ? 'Silver Iodide Precipitation' : 'Silver Chloride Precipitation',
        'Precipitation / Double Displacement (Halide Metathesis)',
        'precipitation',
        isIodide
          ? 'AgNO₃(aq) + KI(aq) ➔ AgI(s)↓ (Yellow Curd) + KNO₃(aq)'
          : 'AgNO₃(aq) + NaCl(aq) ➔ AgCl(s)↓ (Curdy White) + NaNO₃(aq)',
        'Exothermic Precipitation (ΔH° = -65.5 kJ/mol)',
        [
          {
            formula: 'AgNO₃(aq)',
            name: 'Silver Nitrate Solution',
            role: 'reactant',
            moles: agMoles,
            massG: Number((agMoles * 169.87).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 169.87,
            appearance: 'Clear colorless solution',
            properties: ['Soluble silver salt', 'Halide testing reagent'],
          },
          {
            formula: isIodide ? 'KI(aq)' : 'NaCl(aq)',
            name: isIodide ? 'Potassium Iodide' : 'Sodium Chloride',
            role: 'reactant',
            moles: halideMoles,
            massG: Number((halideMoles * (isIodide ? 166.0 : 58.44)).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: isIodide ? 166.0 : 58.44,
            appearance: 'Clear aqueous salt solution',
            properties: ['Halide anion source', 'Strong electrolyte'],
          },
        ],
        [
          {
            formula: isIodide ? 'AgI(s)↓' : 'AgCl(s)↓',
            name: isIodide ? 'Silver Iodide Precipitate' : 'Silver Chloride Precipitate',
            role: 'product',
            moles: reacted,
            massG: agMass,
            state: 's',
            molarMassGPerMol: isIodide ? 234.77 : 143.32,
            colorHex: isIodide ? '#fde047' : '#f8fafc',
            appearance: isIodide ? 'Primrose yellow curdy solid' : 'Curdy white cottage-cheese solid',
            properties: ['Insoluble silver halide', 'Photosensitive: darkens on light exposure'],
          },
          {
            formula: isIodide ? 'KNO₃(aq)' : 'NaNO₃(aq)',
            name: isIodide ? 'Potassium Nitrate' : 'Sodium Nitrate',
            role: 'product',
            moles: reacted,
            massG: Number((reacted * (isIodide ? 101.1 : 84.99)).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: isIodide ? 101.1 : 84.99,
            appearance: 'Clear spectator salt solution',
            properties: ['Soluble neutral salt', 'Spectator ions'],
          },
        ],
        undefined,
        -65.5,
        -48.0,
        currentTempC
      )
    );
  }

  // REACTION 9: Barium Sulfate Precipitation (BaCl2 + H2SO4 -> BaSO4 + 2HCl)
  if (has('bacl2_sol') && has('h2so4_1m')) {
    reactionPulse = true;
    const baMoles = calculateChemicalMoles('bacl2_sol', getAmount('bacl2_sol')).moles;
    const so4Moles = calculateChemicalMoles('h2so4_1m', getAmount('h2so4_1m')).moles;
    const reacted = Math.min(baMoles, so4Moles);
    const baso4Mass = Number((reacted * 233.39).toFixed(2));

    if (!precipitate) {
      precipitate = {
        formula: 'BaSO₄(s)↓',
        name: 'Barium Sulfate',
        color: '#ffffff',
        amountG: baso4Mass,
        moles: reacted,
        texture: 'granular',
        description: 'Heavy, dense insoluble white sulfate precipitate.',
        properties: ['Extremely insoluble (Ksp = 1.1 × 10⁻¹⁰)', 'Dense chalk white powder', 'Diagnostic gravimetric test for sulfate'],
      };
    }

    detectedReactions.push(
      createReactionDetails(
        'Barium Sulfate Gravimetric Precipitation',
        'Precipitation / Double Displacement (Sulfate Gravimetric Test)',
        'precipitation',
        'BaCl₂(aq) + H₂SO₄(aq) ➔ BaSO₄(s)↓ (Milky White) + 2HCl(aq)',
        'Exothermic Precipitation (ΔH° = -26.0 kJ/mol)',
        [
          {
            formula: 'BaCl₂(aq)',
            name: 'Barium Chloride Solution',
            role: 'reactant',
            moles: baMoles,
            massG: Number((baMoles * 208.23).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 208.23,
            appearance: 'Clear colorless solution',
            properties: ['Barium cation donor Ba²⁺', 'Diagnostic sulfate test reagent'],
          },
          {
            formula: 'H₂SO₄(aq)',
            name: 'Sulfuric Acid Solution',
            role: 'reactant',
            moles: so4Moles,
            massG: Number((so4Moles * 98.08).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 98.08,
            appearance: 'Strong mineral acid solution',
            properties: ['Sulfate anion donor SO₄²⁻', 'Strong diprotic acid'],
          },
        ],
        [
          {
            formula: 'BaSO₄(s)↓',
            name: 'Barium Sulfate Chalk Precipitate',
            role: 'product',
            moles: reacted,
            massG: baso4Mass,
            state: 's',
            molarMassGPerMol: 233.39,
            colorHex: '#ffffff',
            appearance: 'Heavy, dense insoluble milky chalk-white precipitate',
            properties: ['Extremely insoluble (Ksp = 1.1 × 10⁻¹⁰)', 'Insoluble even in concentrated boiling acid'],
          },
          {
            formula: '2HCl(aq)',
            name: 'Hydrochloric Acid Solution',
            role: 'product',
            moles: reacted * 2,
            massG: Number((reacted * 2 * 36.46).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 36.46,
            appearance: 'Acidic aqueous solution',
            properties: ['Produced mineral acid', 'Maintains low pH'],
          },
        ],
        undefined,
        -26.0,
        -32.0,
        currentTempC
      )
    );
  }

  // REACTION 10: Elephant Toothpaste (H2O2 + MnO2 Catalytic Decomposition)
  if (has('h2o2_10') && has('mno2_powder')) {
    tempDelta += 38;
    const gasMass = Number((getAmount('h2o2_10') * 0.048).toFixed(2));
    const o2Moles = Number((gasMass / 32.0).toFixed(4));
    gasEvolving = {
      formula: 'O₂(g)↑',
      name: 'Oxygen Gas (Violent Foaming Vapor)',
      volumeMl: Math.round(getAmount('h2o2_10') * 20.0),
      rate: 'violent',
      gasMassG: gasMass,
      moles: o2Moles,
      properties: ['Pure oxygen gas (M = 32.00 g/mol)', 'Vigorous bubbling effervescence', 'Strong supporter of combustion', 'Escapes in open beaker'],
    };
    foamHeightPercent = 65;
    reactionPulse = true;

    const h2o2Moles = calculateChemicalMoles('h2o2_10', getAmount('h2o2_10')).moles;
    detectedReactions.push(
      createReactionDetails(
        'Catalytic Peroxide Decomposition (Elephant Toothpaste)',
        'Exothermic Catalytic Decomposition (Disproportionation)',
        'decomposition',
        '2H₂O₂(aq) ──[MnO₂]──➔ 2H₂O(l) + O₂(g)↑ [High Exothermicity: ΔT > +30°C]',
        'Highly Exothermic (ΔH° = -98.2 kJ/mol)',
        [
          {
            formula: 'H₂O₂(aq)',
            name: 'Hydrogen Peroxide (10%)',
            role: 'reactant',
            moles: h2o2Moles,
            massG: Number((h2o2Moles * 34.01).toFixed(2)),
            volumeMl: getAmount('h2o2_10'),
            state: 'aq',
            molarMassGPerMol: 34.01,
            colorHex: '#f8fafc',
            appearance: 'Colorless oxidizing liquid',
            properties: ['Thermodynamically unstable peroxide', 'Disproportionates into O₂ and H₂O', 'Strong oxidant'],
          },
          {
            formula: 'MnO₂(s)',
            name: 'Manganese Dioxide Catalyst',
            role: 'catalyst',
            moles: calculateChemicalMoles('mno2_powder', getAmount('mno2_powder')).moles,
            massG: getAmount('mno2_powder'),
            state: 's',
            molarMassGPerMol: 86.94,
            colorHex: '#0f172a',
            appearance: 'Midnight black insoluble powder',
            properties: ['Heterogeneous catalyst', 'Lowers activation energy Ea', 'Remains chemically unconsumed'],
          },
        ],
        [
          {
            formula: 'O₂(g)↑',
            name: 'Oxygen Gas',
            role: 'product',
            moles: o2Moles,
            massG: gasMass,
            state: 'g',
            molarMassGPerMol: 32.0,
            colorHex: '#38bdf8',
            appearance: 'Steaming effervescent gas bubbles',
            properties: ['Molecular oxygen (O₂)', 'Escapes in open beaker (causes mass drop)', 'Trapped in closed beaker (maintains constant mass)'],
          },
          {
            formula: 'H₂O(l)',
            name: 'Liquid Water / Hot Steam',
            role: 'product',
            moles: o2Moles * 2,
            massG: Number((o2Moles * 2 * 18.02).toFixed(2)),
            state: 'l',
            molarMassGPerMol: 18.02,
            colorHex: '#f8fafc',
            appearance: 'Hot liquid water',
            properties: ['Universal neutral solvent', 'Specific heat 4.18 J/g°C'],
          },
        ],
        undefined,
        -98.2,
        126.0,
        currentTempC
      )
    );
  }

  // REACTION 11: Reactive Metals in Acid (Mg / Zn / Al / Fe + HCl/H2SO4 -> H2 Gas)
  if ((has('mg_ribbon') || has('zn_metal') || has('al_metal') || has('fe_filings')) && molesH > 0) {
    const isMg = has('mg_ribbon');
    const isZn = has('zn_metal');
    const isAl = has('al_metal');
    const isFe = has('fe_filings');
    const metalName = isMg ? 'Magnesium' : isZn ? 'Zinc' : isAl ? 'Aluminum' : 'Iron';
    const metalFormula = isMg ? 'Mg(s)' : isZn ? 'Zn(s)' : isAl ? 'Al(s)' : 'Fe(s)';
    const saltFormula = isMg ? 'MgCl₂(aq)' : isZn ? 'ZnCl₂(aq)' : isAl ? 'AlCl₃(aq)' : 'FeCl₂(aq)';

    const metalMass =
      getAmount('mg_ribbon') + getAmount('zn_metal') + getAmount('al_metal') + (isFe ? getAmount('fe_filings') * 0.5 : 0);
    const gasMass = Number((metalMass * 0.08).toFixed(2));
    const h2Moles = Number((gasMass / 2.016).toFixed(4));

    if (!gasEvolving) {
      gasEvolving = {
        formula: 'H₂(g)↑',
        name: 'Hydrogen Gas (Flammable Rapid Fizzing)',
        volumeMl: Math.round(metalMass * 26.0),
        rate: isMg ? 'violent' : 'vigorous',
        gasMassG: gasMass,
        moles: h2Moles,
        properties: ['Diatomic hydrogen gas H₂', 'Density 0.089 g/L', 'Highly flammable', 'Escapes in open beaker (-Δm)'],
      };
      foamHeightPercent = Math.max(foamHeightPercent, isMg ? 45 : 30);
    }
    reactionPulse = true;
    tempDelta += isMg ? 24 : 12;

    const metalMoles = isMg
      ? calculateChemicalMoles('mg_ribbon', getAmount('mg_ribbon')).moles
      : isZn
      ? calculateChemicalMoles('zn_metal', getAmount('zn_metal')).moles
      : isAl
      ? calculateChemicalMoles('al_metal', getAmount('al_metal')).moles
      : calculateChemicalMoles('fe_filings', getAmount('fe_filings')).moles;

    detectedReactions.push(
      createReactionDetails(
        `${metalName} Dissolution in Acid (Hydrogen Evolution)`,
        'Single Displacement & Oxidation-Reduction (Redox)',
        'single_displacement',
        `${metalFormula} + 2HCl(aq) ➔ ${saltFormula} + H₂(g)↑ [Violent Fizzing]`,
        'Highly Exothermic (ΔH° = -467 kJ/mol for Mg)',
        [
          {
            formula: metalFormula,
            name: `${metalName} Metal`,
            role: 'reactant',
            moles: metalMoles,
            massG: Number(metalMass.toFixed(2)),
            state: 's',
            molarMassGPerMol: isMg ? 24.31 : isZn ? 65.38 : isAl ? 26.98 : 55.85,
            colorHex: '#cbd5e1',
            appearance: 'Metallic elemental solid',
            properties: ['Active reducing metal', 'Displaces protons from acid', 'Forms metal chloride'],
          },
          {
            formula: 'HCl(aq)',
            name: 'Hydrochloric Acid Solution',
            role: 'reactant',
            moles: molesH,
            massG: Number((molesH * 36.46).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 36.46,
            colorHex: '#f8fafc',
            appearance: 'Strong acid solution',
            properties: ['Strong monoprotic acid', 'Hydronium donor H⁺', 'pH < 1.0'],
          },
        ],
        [
          {
            formula: saltFormula,
            name: `${metalName} Chloride Solution`,
            role: 'product',
            moles: metalMoles,
            massG: Number((metalMoles * (isMg ? 95.21 : isZn ? 136.3 : 133.3)).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: isMg ? 95.21 : isZn ? 136.3 : 133.3,
            colorHex: '#f8fafc',
            appearance: 'Clear aqueous salt solution',
            properties: ['Soluble neutral electrolyte', 'Metal chloride salt'],
          },
          {
            formula: 'H₂(g)↑',
            name: 'Hydrogen Gas',
            role: 'product',
            moles: h2Moles,
            massG: gasMass,
            state: 'g',
            molarMassGPerMol: 2.016,
            colorHex: '#38bdf8',
            appearance: 'Rapid vigorous effervescent fizzing bubbles',
            properties: ['Lightest gas known (0.089 g/L)', 'Escapes in open beaker', 'Trapped in closed beaker'],
          },
        ],
        undefined,
        isMg ? -467.0 : -153.0,
        112.0,
        currentTempC
      )
    );
  }

  // REACTION 12: Acid-Carbonate Effervescence (NaHCO3 / CaCO3 + Acid -> CO2 Gas)
  if ((has('nahco3_sol') || has('caco3_chips')) && molesH > 0) {
    const isBicarb = has('nahco3_sol');
    const carbMoles = isBicarb
      ? calculateChemicalMoles('nahco3_sol', getAmount('nahco3_sol')).moles
      : calculateChemicalMoles('caco3_chips', getAmount('caco3_chips')).moles;
    const reactedMoles = Math.min(molesH, carbMoles);
    const co2Mass = Number(Math.max(0.2, reactedMoles * 44.01).toFixed(2));
    const co2Moles = Number((co2Mass / 44.01).toFixed(4));

    if (!gasEvolving) {
      gasEvolving = {
        formula: 'CO₂(g)↑',
        name: 'Carbon Dioxide Gas (Effervescent Foaming)',
        volumeMl: Math.round((getAmount('nahco3_sol') + getAmount('caco3_chips')) * 24.0),
        rate: 'vigorous',
        gasMassG: co2Mass,
        moles: co2Moles,
        properties: ['Carbon dioxide gas (M = 44.01 g/mol)', 'Density 1.98 g/L (heavier than air)', 'Causes mass decrease in open beaker; pressure increase in closed beaker'],
      };
      foamHeightPercent = Math.max(foamHeightPercent, 48);
    }
    reactionPulse = true;

    detectedReactions.push(
      createReactionDetails(
        'Acid-Carbonate Effervescence',
        'Gas Evolution & Acid-Base Metathesis',
        'gas_evolution',
        'NaHCO₃(aq) + HCl(aq) ➔ NaCl(aq) + H₂O(l) + CO₂(g)↑ [Vigorous Foam]',
        'Exothermic Metathesis (ΔH° = -12.6 kJ/mol)',
        [
          {
            formula: 'NaHCO₃(aq)',
            name: 'Sodium Bicarbonate Solution',
            role: 'reactant',
            moles: carbMoles,
            massG: Number((carbMoles * 84.01).toFixed(2)),
            volumeMl: getAmount('nahco3_sol'),
            state: 'aq',
            molarMassGPerMol: 84.01,
            colorHex: '#f8fafc',
            appearance: 'Clear colorless solution (1.0 M)',
            properties: ['Amphoteric bicarbonate buffer', 'Weak base (pH ~ 8.3)', 'Decomposes with acid to evolve CO₂'],
          },
          {
            formula: 'HCl(aq)',
            name: 'Hydrochloric Acid',
            role: 'reactant',
            moles: molesH,
            massG: Number((molesH * 36.46).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 36.46,
            colorHex: '#f8fafc',
            appearance: 'Strong mineral acid solution',
            properties: ['Strong monoprotic acid', 'High hydronium [H₃O⁺]', 'pH < 1.0', 'Attacks carbonates immediately'],
          },
        ],
        [
          {
            formula: 'NaCl(aq)',
            name: 'Sodium Chloride Solution',
            role: 'product',
            moles: reactedMoles,
            massG: Number((reactedMoles * 58.44).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 58.44,
            colorHex: '#f8fafc',
            appearance: 'Clear saline solution',
            properties: ['Pure table salt', 'Neutral pH 7.00', 'Non-volatile electrolyte'],
          },
          {
            formula: 'H₂O(l)',
            name: 'Water Liquid',
            role: 'product',
            moles: reactedMoles,
            massG: Number((reactedMoles * 18.02).toFixed(2)),
            state: 'l',
            molarMassGPerMol: 18.02,
            colorHex: '#f8fafc',
            appearance: 'Liquid water',
            properties: ['Solvent produced by neutralization', 'Neutral pH 7.00'],
          },
          {
            formula: 'CO₂(g)↑',
            name: 'Carbon Dioxide Gas',
            role: 'product',
            moles: co2Moles,
            massG: co2Mass,
            state: 'g',
            molarMassGPerMol: 44.01,
            colorHex: '#94a3b8',
            appearance: 'Effervescent bubbling gas & foaming head',
            properties: [
              'Density 1.98 g/L (heavier than air)',
              'In Open Beaker: escapes freely into air, causing analytical balance to drop by -' + co2Mass + ' g',
              'In Closed Beaker: trapped under lid, gross mass is strictly invariant (constant mass), and internal pressure increases',
            ],
          },
        ],
        undefined,
        -12.6,
        185.0,
        currentTempC
      )
    );
  }

  // REACTION 13: Limewater Carbon Dioxide Precipitation (Ca(OH)2 + CO2 -> CaCO3)
  if (has('ca_oh2') && (has('nahco3_sol') || (has('caco3_chips') && molesH > 0) || detectedReactions.some((r) => r.products.some((p) => p.formula.includes('CO₂'))))) {
    const mass = 0.8;
    const moles = 0.008;
    precipitate = {
      formula: 'CaCO₃(s)↓',
      name: 'Calcium Carbonate (Limewater Milkiness)',
      color: '#f1f5f9',
      amountG: mass,
      moles,
      texture: 'colloidal',
      description: 'Fine colloidal cloudiness suspended in solution.',
      properties: ['Diagnostic test for carbon dioxide (CO₂)', 'Fine chalk cloudiness', 'Dissolves in excess acid'],
    };
    reactionPulse = true;

    detectedReactions.push(
      createReactionDetails(
        'Limewater Carbon Dioxide Milkiness Test',
        'Gas-Solution Carbonation & Precipitation',
        'precipitation',
        'Ca(OH)₂(aq) + CO₂(g) ➔ CaCO₃(s)↓ (Milky White Cloud) + H₂O(l)',
        'Exothermic Carbonation (ΔH° = -113 kJ/mol)',
        [
          {
            formula: 'Ca(OH)₂(aq)',
            name: 'Calcium Hydroxide Limewater',
            role: 'reactant',
            moles: 0.008,
            massG: 0.59,
            state: 'aq',
            molarMassGPerMol: 74.09,
            appearance: 'Clear limewater solution',
            properties: ['Saturated calcium hydroxide', 'Selective test for CO₂ gas'],
          },
          {
            formula: 'CO₂(g)',
            name: 'Carbon Dioxide Gas',
            role: 'reactant',
            moles: 0.008,
            massG: 0.35,
            state: 'g',
            molarMassGPerMol: 44.01,
            appearance: 'Dissolved gas bubbles',
            properties: ['Acidic oxide gas', 'Reacts with base to precipitate carbonate'],
          },
        ],
        [
          {
            formula: 'CaCO₃(s)↓',
            name: 'Calcium Carbonate Milky Precipitate',
            role: 'product',
            moles,
            massG: mass,
            state: 's',
            molarMassGPerMol: 100.09,
            colorHex: '#f1f5f9',
            appearance: 'Milky white colloidal chalk suspension',
            properties: ['Insoluble carbonate (Ksp = 3.3 × 10⁻⁹)', 'Limewater milkiness test'],
          },
          {
            formula: 'H₂O(l)',
            name: 'Liquid Water',
            role: 'product',
            moles,
            massG: 0.14,
            state: 'l',
            molarMassGPerMol: 18.02,
            appearance: 'Water solvent',
            properties: ['Reaction byproduct'],
          },
        ],
        undefined,
        -113.0,
        -160.0,
        currentTempC
      )
    );
  }

  // REACTION 14: Permanganate Redox Decolorization (KMnO4 + FeSO4 / H2O2 + Acid)
  if (has('kmno4_sol') && (has('feso4_sol') || has('h2o2_10')) && molesH > 0) {
    baseSolutionColor = 'rgba(254, 240, 138, 0.25)'; // Faint pale straw Mn2+ / Fe3+
    reactionPulse = true;
    const kmno4Moles = calculateChemicalMoles('kmno4_sol', getAmount('kmno4_sol')).moles;
    const feso4Moles = calculateChemicalMoles('feso4_sol', getAmount('feso4_sol')).moles;

    detectedReactions.push(
      createReactionDetails(
        'Permanganate Redox Titration & Decolorization',
        'Oxidation-Reduction (Redox) Permanganate Titration',
        'redox',
        '2KMnO₄(aq) + 10FeSO₄(aq) + 8H₂SO₄(aq) ➔ 2MnSO₄(aq) (Clear) + 5Fe₂(SO₄)₃(aq) + K₂SO₄ + 8H₂O',
        'Highly Exothermic Redox (ΔH° = -180 kJ/mol)',
        [
          {
            formula: 'KMnO₄(aq)',
            name: 'Potassium Permanganate',
            role: 'reactant',
            moles: kmno4Moles,
            massG: Number((kmno4Moles * 158.03).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 158.03,
            colorHex: '#6b21a8',
            appearance: 'Deep royal purple solution',
            properties: ['Powerful oxidizing agent (Mn(VII))', 'Self-indicating titrant', 'Reduces to colorless Mn(II)'],
          },
          {
            formula: 'FeSO₄(aq)',
            name: 'Iron(II) Sulfate Solution',
            role: 'reactant',
            moles: feso4Moles,
            massG: Number((feso4Moles * 151.91).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 151.91,
            colorHex: '#86efac',
            appearance: 'Pale seafoam green solution',
            properties: ['Reducing agent (Fe(II))', 'Oxidizes to yellow Fe(III)'],
          },
        ],
        [
          {
            formula: 'MnSO₄(aq)',
            name: 'Manganese(II) Sulfate Solution',
            role: 'product',
            moles: kmno4Moles,
            massG: Number((kmno4Moles * 151.0).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 151.0,
            colorHex: '#f8fafc',
            appearance: 'Clear virtually colorless solution',
            properties: ['Reduced Mn²⁺ species', 'High-spin d⁵ colorless ion'],
          },
          {
            formula: 'Fe₂(SO₄)₃(aq)',
            name: 'Iron(III) Sulfate Solution',
            role: 'product',
            moles: feso4Moles / 2,
            massG: Number((feso4Moles * 0.5 * 399.88).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 399.88,
            colorHex: '#fef08a',
            appearance: 'Pale straw yellow solution',
            properties: ['Oxidized iron(III) salt', 'Strong electrolyte'],
          },
        ],
        undefined,
        -180.0,
        42.0,
        currentTempC
      )
    );
  }

  // REACTION 16: Alkali / Alkaline-Earth Metal Element + Water (Na(s) or Ca(s) + H2O -> Hydroxide + H2)
  if ((has('na_metal') || has('ca_granules')) && hasAqueousMedium) {
    const isNa = has('na_metal');
    const metalId = isNa ? 'na_metal' : 'ca_granules';
    const metalFormula = isNa ? 'Na(s)' : 'Ca(s)';
    const metalName = isNa ? 'Sodium Metal' : 'Calcium Granules';
    const metalMoles = calculateChemicalMoles(metalId, getAmount(metalId)).moles;
    const h2Moles = Number((isNa ? metalMoles * 0.5 : metalMoles).toFixed(4));
    const h2Mass = Number(Math.max(0.05, h2Moles * 2.016).toFixed(2));
    reactionPulse = true;
    tempDelta += isNa ? 28 : 14;

    if (!gasEvolving) {
      gasEvolving = {
        formula: 'H₂(g)↑',
        name: 'Hydrogen Gas (Alkali-Water Evolution)',
        volumeMl: Math.round(h2Moles * 24465),
        rate: isNa ? 'violent' : 'vigorous',
        gasMassG: h2Mass,
        moles: h2Moles,
        properties: ['Flammable diatomic H₂(g)', 'Alkaline solution turns phenolphthalein magenta', 'Exothermic evolution'],
      };
      foamHeightPercent = Math.max(foamHeightPercent, isNa ? 42 : 24);
    }

    if (!isNa && !precipitate) {
      precipitate = {
        formula: 'Ca(OH)₂(s)↓',
        name: 'Calcium Hydroxide Suspension',
        color: '#f8fafc',
        amountG: Number((metalMoles * 74.09).toFixed(2)),
        moles: metalMoles,
        texture: 'colloidal',
        description: 'Milky white sparingly soluble calcium hydroxide suspension.',
      };
    }

    detectedReactions.push(
      createReactionDetails(
        isNa ? 'Sodium Metal + Water Exothermic Reaction' : 'Calcium + Water Hydrogen Evolution',
        'Single Displacement / Alkali-Water Oxidation',
        'single_displacement',
        isNa
          ? '2Na(s) + 2H₂O(l) ➔ 2NaOH(aq) + H₂(g)↑ [Violent Exothermic Fizzing]'
          : 'Ca(s) + 2H₂O(l) ➔ Ca(OH)₂(s)↓ + H₂(g)↑',
        isNa ? 'Highly Exothermic (ΔH° = -368 kJ/mol)' : 'Exothermic (ΔH° = -414 kJ/mol)',
        [
          {
            formula: metalFormula,
            name: metalName,
            role: 'reactant',
            moles: metalMoles,
            massG: getAmount(metalId),
            state: 's',
            molarMassGPerMol: isNa ? 22.99 : 40.08,
            colorHex: '#e2e8f0',
            appearance: isNa ? 'Silvery soft alkali metal chunks' : 'Silvery alkaline earth granules',
            properties: ['Elemental s-block metal', 'Vigorous reducing agent'],
          },
          {
            formula: 'H₂O(l)',
            name: 'Water Solvent',
            role: 'reactant',
            moles: isNa ? metalMoles : metalMoles * 2,
            massG: Number(((isNa ? metalMoles : metalMoles * 2) * 18.02).toFixed(2)),
            state: 'l',
            molarMassGPerMol: 18.02,
            appearance: 'Liquid water medium',
            properties: ['Oxidizes active alkali/alkaline-earth metals'],
          },
        ],
        [
          {
            formula: isNa ? 'NaOH(aq)' : 'Ca(OH)₂(s/aq)',
            name: isNa ? 'Sodium Hydroxide Solution' : 'Calcium Hydroxide Suspension',
            role: 'product',
            moles: metalMoles,
            massG: Number((metalMoles * (isNa ? 40.0 : 74.09)).toFixed(2)),
            state: isNa ? 'aq' : 's',
            molarMassGPerMol: isNa ? 40.0 : 74.09,
            appearance: isNa ? 'Strongly alkaline clear solution (pH ~14)' : 'Milky white alkaline suspension',
            properties: ['Turns Phenolphthalein bright magenta-pink'],
          },
          {
            formula: 'H₂(g)↑',
            name: 'Hydrogen Gas',
            role: 'product',
            moles: h2Moles,
            massG: h2Mass,
            state: 'g',
            molarMassGPerMol: 2.016,
            colorHex: '#bae6fd',
            appearance: 'Rapidly escaping flammable gas bubbles',
            properties: ['Lightest molecular gas H₂(g)'],
          },
        ],
        undefined,
        isNa ? -368.0 : -414.0,
        92.0,
        currentTempC
      )
    );
  }

  // REACTION 17: Gas-Phase Ammonia + HCl Synthesis (NH3(g) + HCl(g) -> NH4Cl(s)↓)
  if ((has('nh3_gas') || has('nh3_aq')) && (has('hcl_gas') || has('hcl_1m') || has('hcl_6m')) && (has('nh3_gas') || has('hcl_gas'))) {
    const nh3Moles = calculateChemicalMoles('nh3_gas', getAmount('nh3_gas')).moles + calculateChemicalMoles('nh3_aq', getAmount('nh3_aq')).moles;
    const hclMoles =
      calculateChemicalMoles('hcl_gas', getAmount('hcl_gas')).moles +
      calculateChemicalMoles('hcl_1m', getAmount('hcl_1m')).moles +
      calculateChemicalMoles('hcl_6m', getAmount('hcl_6m')).moles;
    const reacted = Math.min(nh3Moles, hclMoles);
    const massG = Number(Math.max(0.08, reacted * 53.49).toFixed(3));
    reactionPulse = true;
    tempDelta += 6.5;

    if (!precipitate) {
      precipitate = {
        formula: 'NH₄Cl(s)↓',
        name: 'Ammonium Chloride White Smoke / Deposit',
        color: '#f8fafc',
        amountG: massG,
        moles: reacted,
        texture: 'colloidal',
        description: 'Dense frosty white microcrystalline ammonium chloride smoke settling from gas diffusion.',
        properties: ['Gas-to-solid acid-base synthesis', 'Sublimable ionic solid'],
      };
    }

    detectedReactions.push(
      createReactionDetails(
        'Gas-Phase Ammonia + HCl Smoke Synthesis',
        'Gas-Solid Lewis Acid-Base Synthesis',
        'acid_base',
        'NH₃(g) + HCl(g) ➔ NH₄Cl(s)↓ (Dense White Smoke/Crystals)',
        'Strongly Exothermic Synthesis (ΔH° = -176.0 kJ/mol)',
        [
          {
            formula: 'NH₃(g)',
            name: 'Ammonia Gas',
            role: 'reactant',
            moles: nh3Moles,
            massG: Number((nh3Moles * 17.03).toFixed(4)),
            state: 'g',
            molarMassGPerMol: 17.03,
            appearance: 'Colorless alkaline molecular gas',
            properties: ['Graham\'s law fast diffusion gas'],
          },
          {
            formula: 'HCl(g)',
            name: 'Hydrogen Chloride Gas',
            role: 'reactant',
            moles: hclMoles,
            massG: Number((hclMoles * 36.46).toFixed(4)),
            state: 'g',
            molarMassGPerMol: 36.46,
            appearance: 'Colorless acidic molecular gas',
            properties: ['Strong Brønsted proton donor'],
          },
        ],
        [
          {
            formula: 'NH₄Cl(s)↓',
            name: 'Ammonium Chloride White Crystals',
            role: 'product',
            moles: reacted,
            massG,
            state: 's',
            molarMassGPerMol: 53.49,
            colorHex: '#f8fafc',
            appearance: 'Dense white snowy microcrystalline smoke',
            properties: ['Negative ΔS° (-284 J/mol·K) due to gas-to-solid ordering'],
          },
        ],
        undefined,
        -176.0,
        -284.0,
        currentTempC
      )
    );
  }

  // REACTION 18: Dry Ice Cryogenic Sublimation & Limewater Carbonation
  if (has('co2_dry_ice')) {
    const dryIceMass = getAmount('co2_dry_ice');
    const co2Moles = Number((dryIceMass / 44.01).toFixed(4));
    tempDelta -= 11.0;
    reactionPulse = true;
    if (!gasEvolving) {
      gasEvolving = {
        formula: 'CO₂(g)↑',
        name: 'Subliming Cold Carbon Dioxide Fog',
        volumeMl: Math.round(co2Moles * 24465),
        rate: 'vigorous',
        gasMassG: Number(dryIceMass.toFixed(2)),
        moles: co2Moles,
        properties: ['Endothermic phase change CO₂(s) ➔ CO₂(g)', 'Cools surroundings sharply'],
      };
      foamHeightPercent = Math.max(foamHeightPercent, hasAqueousMedium ? 28 : 10);
    }
    const co2VolMl = Math.round(co2Moles * 24465);
    const co2DensityFactor = Number(
      Math.min(1, Math.max(0.12, Math.pow(Math.max(1, co2VolMl) / 2500, 0.5))).toFixed(3)
    );
    gasAtmosphere = {
      formula: 'CO₂(g)',
      name: 'Dense Cold Carbon Dioxide Vapor',
      color: '#e0f2fe',
      opacity: Number((0.15 + co2DensityFactor * 0.65).toFixed(3)),
      volumeMl: co2VolMl,
      densityFactor: co2DensityFactor,
    };

    detectedReactions.push(
      createReactionDetails(
        'Dry Ice Sublimation (Solid ➔ Gas Phase Transition)',
        'Endothermic Phase Sublimation',
        'decomposition',
        'CO₂(s) (Dry Ice, -78.5°C) ➔ CO₂(g)↑ (Chilling Fog)',
        'Endothermic Sublimation (ΔH°_sub = +25.2 kJ/mol)',
        [
          {
            formula: 'CO₂(s)',
            name: 'Solid Carbon Dioxide (Dry Ice)',
            role: 'reactant',
            moles: co2Moles,
            massG: dryIceMass,
            state: 's',
            molarMassGPerMol: 44.01,
            colorHex: '#e0f2fe',
            appearance: 'Frost-white cryogenic molecular solid',
            properties: ['Sublimes directly at 1 atm without melting'],
          },
        ],
        [
          {
            formula: 'CO₂(g)↑',
            name: 'Carbon Dioxide Gas Vapor',
            role: 'product',
            moles: co2Moles,
            massG: dryIceMass,
            state: 'g',
            molarMassGPerMol: 44.01,
            colorHex: '#e0f2fe',
            appearance: 'Cold billowing CO₂ vapor',
            properties: ['Large positive entropy ΔS° = +129 J/(mol·K) drives spontaneous sublimation'],
          },
        ],
        undefined,
        25.2,
        129.0,
        currentTempC
      )
    );
  }

  // Limewater precipitation directly from gaseous CO2(g) or Dry Ice CO2(s)
  if (has('ca_oh2') && (has('co2_gas') || has('co2_dry_ice')) && !precipitate) {
    const co2Moles =
      calculateChemicalMoles('co2_gas', getAmount('co2_gas')).moles +
      calculateChemicalMoles('co2_dry_ice', getAmount('co2_dry_ice')).moles;
    const caMoles = calculateChemicalMoles('ca_oh2', getAmount('ca_oh2')).moles;
    const reacted = Math.max(0.001, Math.min(co2Moles, caMoles));
    const caco3Mass = Number((reacted * 100.09).toFixed(2));
    reactionPulse = true;
    precipitate = {
      formula: 'CaCO₃(s)↓',
      name: 'Calcium Carbonate (Limewater Milkiness)',
      color: '#f1f5f9',
      amountG: caco3Mass,
      moles: reacted,
      texture: 'colloidal',
      description: 'Milky white CaCO₃ suspension diagnostic of CO₂ gas.',
    };
    detectedReactions.push(
      createReactionDetails(
        'Limewater Carbonation by CO₂',
        'Gas-Solution Carbonation & Precipitation',
        'precipitation',
        'Ca(OH)₂(aq) + CO₂(g/s) ➔ CaCO₃(s)↓ (Milky White) + H₂O(l)',
        'Exothermic Carbonation (ΔH° = -113 kJ/mol)',
        [
          {
            formula: 'Ca(OH)₂(aq)',
            name: 'Limewater',
            role: 'reactant',
            moles: caMoles,
            massG: Number((caMoles * 74.09).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 74.09,
            appearance: 'Clear calcium hydroxide solution',
            properties: ['Diagnostic CO₂ reagent'],
          },
          {
            formula: 'CO₂(g)',
            name: 'Carbon Dioxide',
            role: 'reactant',
            moles: co2Moles,
            massG: Number((co2Moles * 44.01).toFixed(3)),
            state: 'g',
            molarMassGPerMol: 44.01,
            appearance: 'Linear molecular CO₂',
            properties: ['Acidic oxide'],
          },
        ],
        [
          {
            formula: 'CaCO₃(s)↓',
            name: 'Calcium Carbonate Precipitate',
            role: 'product',
            moles: reacted,
            massG: caco3Mass,
            state: 's',
            molarMassGPerMol: 100.09,
            colorHex: '#f1f5f9',
            appearance: 'Milky white colloidal chalk cloud',
            properties: ['Insoluble carbonate'],
          },
        ],
        undefined,
        -113.0,
        -160.0,
        currentTempC
      )
    );
  }

  // REACTION 19: Endothermic Cold-Pack Dissolution (NH4Cl(s) or Urea(s) + Water)
  if ((has('nh4cl_solid') || has('urea_solid')) && hasAqueousMedium && molesOH < 0.002) {
    const isAmmonium = has('nh4cl_solid');
    const solidId = isAmmonium ? 'nh4cl_solid' : 'urea_solid';
    const m = calculateChemicalMoles(solidId, getAmount(solidId));
    tempDelta -= isAmmonium ? 8.5 : 6.5;
    reactionPulse = true;

    detectedReactions.push(
      createReactionDetails(
        isAmmonium ? 'Endothermic Dissolution of NH₄Cl (Cold Pack)' : 'Endothermic Dissolution of Urea Crystals',
        'Endothermic Hydration & Crystal Lattice Dissociation',
        'thermal_equilibrium',
        isAmmonium
          ? 'NH₄Cl(s) + H₂O(l) ➔ NH₄⁺(aq) + Cl⁻(aq)  [Chills Solution: ΔH > 0]'
          : 'CO(NH₂)₂(s) + H₂O(l) ➔ CO(NH₂)₂(aq)  [Chills Solution: ΔH > 0]',
        isAmmonium ? 'Endothermic (ΔH° = +14.8 kJ/mol)' : 'Endothermic (ΔH° = +15.4 kJ/mol)',
        [
          {
            formula: isAmmonium ? 'NH₄Cl(s)' : 'CO(NH₂)₂(s)',
            name: isAmmonium ? 'Ammonium Chloride Crystals' : 'Urea Molecular Crystals',
            role: 'reactant',
            moles: m.moles,
            massG: m.massG,
            state: 's',
            molarMassGPerMol: isAmmonium ? 53.49 : 60.06,
            appearance: 'White crystalline solid',
            properties: ['High lattice enthalpy absorbed from surroundings'],
          },
        ],
        [
          {
            formula: isAmmonium ? 'NH₄⁺(aq) + Cl⁻(aq)' : 'CO(NH₂)₂(aq)',
            name: isAmmonium ? 'Chilled Aqueous Ions' : 'Chilled Urea Solution',
            role: 'product',
            moles: m.moles,
            massG: m.massG,
            state: 'aq',
            molarMassGPerMol: isAmmonium ? 53.49 : 60.06,
            appearance: 'Noticeably chilled clear solution',
            properties: ['Entropy-driven spontaneous endothermic dissolution (ΔS > 0)'],
          },
        ],
        undefined,
        isAmmonium ? 14.8 : 15.4,
        75.2,
        currentTempC
      )
    );
  }

  // REACTION 20: Chlorine Gas Halogen Displacement (Cl2(g) + 2KI(aq) -> 2KCl(aq) + I2(aq/s))
  if (has('cl2_gas') && has('ki_sol')) {
    const cl2Moles = calculateChemicalMoles('cl2_gas', getAmount('cl2_gas')).moles;
    const kiMoles = calculateChemicalMoles('ki_sol', getAmount('ki_sol')).moles;
    const reacted = Math.min(cl2Moles, kiMoles / 2);
    baseSolutionColor = '#78350f'; // Rich amber-brown triiodide/iodine
    reactionPulse = true;
    tempDelta += 4.0;

    detectedReactions.push(
      createReactionDetails(
        'Halogen Single Displacement (Chlorine Oxidizes Iodide)',
        'Halogen Redox Displacement',
        'redox',
        'Cl₂(g) + 2KI(aq) ➔ 2KCl(aq) + I₂(aq) (Amber-Brown Iodine)',
        'Exothermic Redox (ΔH° = -108 kJ/mol)',
        [
          {
            formula: 'Cl₂(g)',
            name: 'Chlorine Gas Element',
            role: 'reactant',
            moles: cl2Moles,
            massG: Number((cl2Moles * 70.91).toFixed(4)),
            state: 'g',
            molarMassGPerMol: 70.91,
            colorHex: '#a3e635',
            appearance: 'Pale yellow-green halogen gas',
            properties: ['Stronger halogen oxidizer (E° = +1.36 V)'],
          },
          {
            formula: 'KI(aq)',
            name: 'Potassium Iodide Solution',
            role: 'reactant',
            moles: kiMoles,
            massG: Number((kiMoles * 166.0).toFixed(2)),
            state: 'aq',
            molarMassGPerMol: 166.0,
            appearance: 'Colorless iodide solution',
            properties: ['I⁻ reducing halide'],
          },
        ],
        [
          {
            formula: 'I₂(aq)',
            name: 'Elemental Iodine (in Solution)',
            role: 'product',
            moles: reacted,
            massG: Number((reacted * 253.81).toFixed(3)),
            state: 'aq',
            molarMassGPerMol: 253.81,
            colorHex: '#78350f',
            appearance: 'Rich cognac amber-brown iodine solution',
            properties: ['Turns starch indicator midnight navy blue'],
          },
          {
            formula: '2KCl(aq)',
            name: 'Potassium Chloride',
            role: 'product',
            moles: reacted * 2,
            massG: Number((reacted * 2 * 74.55).toFixed(3)),
            state: 'aq',
            molarMassGPerMol: 74.55,
            appearance: 'Colorless salt electrolyte',
            properties: ['Soluble chloride salt'],
          },
        ],
        undefined,
        -108.0,
        18.0,
        currentTempC
      )
    );
  }

  // REACTION 21: Solid Iodine + Starch or Gas Sublimation on Heating
  if (has('i2_crystals') && has('starch_sol')) {
    baseSolutionColor = '#1e1b4b'; // Inky midnight indigo-black
    reactionPulse = true;
    const i2Moles = calculateChemicalMoles('i2_crystals', getAmount('i2_crystals')).moles;
    detectedReactions.push(
      createReactionDetails(
        'Iodine-Starch Helical Complexation',
        'Charge-Transfer Intercalation Complex',
        'complexation',
        'I₂(s/aq) + Amylose Starch ➔ [Starch-I₃⁻] (Deep Midnight Indigo)',
        'Mildly Exothermic (ΔH° = -32 kJ/mol)',
        [
          {
            formula: 'I₂(s)',
            name: 'Elemental Iodine Crystals',
            role: 'reactant',
            moles: i2Moles,
            massG: getAmount('i2_crystals'),
            state: 's',
            molarMassGPerMol: 253.81,
            colorHex: '#4c1d95',
            appearance: 'Violet-black solid halogen',
            properties: ['Diatomic halogen solid element'],
          },
        ],
        [
          {
            formula: '[Starch-I₃⁻](aq)',
            name: 'Inky Midnight Blue Starch Complex',
            role: 'product',
            moles: i2Moles,
            massG: getAmount('i2_crystals'),
            state: 'aq',
            molarMassGPerMol: 253.81,
            colorHex: '#1e1b4b',
            appearance: 'Deep midnight indigo-blue solution',
            properties: ['Diagnostic test for molecular iodine / starch'],
          },
        ],
        undefined,
        -32.0,
        -40.0,
        currentTempC
      )
    );
  } else if (has('i2_crystals') && (currentTempC >= 55 || isHeating)) {
    reactionPulse = true;
    const i2Moles = calculateChemicalMoles('i2_crystals', getAmount('i2_crystals')).moles;
    const i2VolMl = Math.max(40, Math.round(i2Moles * 24465));
    const i2DensityFactor = Number(
      Math.min(1, Math.max(0.18, Math.pow(Math.max(1, i2VolMl) / 1200, 0.55))).toFixed(3)
    );
    gasAtmosphere = {
      formula: 'I₂(g)',
      name: 'Subliming Violet Iodine Vapor',
      color: '#9333ea',
      opacity: Number((0.2 + i2DensityFactor * 0.65).toFixed(3)),
      volumeMl: i2VolMl,
      densityFactor: i2DensityFactor,
    };
    detectedReactions.push(
      createReactionDetails(
        'Iodine Thermal Sublimation (Solid ➔ Violet Gas)',
        'Thermal Phase Sublimation',
        'decomposition',
        'I₂(s) (Dark Crystals) ──[Heat Δ]──➔ I₂(g) (Luminous Violet Vapor)',
        'Endothermic Sublimation (ΔH° = +62.4 kJ/mol)',
        [
          {
            formula: 'I₂(s)',
            name: 'Solid Iodine Crystals',
            role: 'reactant',
            moles: i2Moles,
            massG: getAmount('i2_crystals'),
            state: 's',
            molarMassGPerMol: 253.81,
            appearance: 'Dark metallic violet crystals',
            properties: ['Molecular van der Waals crystal'],
          },
        ],
        [
          {
            formula: 'I₂(g)',
            name: 'Gaseous Diatomic Iodine',
            role: 'product',
            moles: i2Moles,
            massG: getAmount('i2_crystals'),
            state: 'g',
            molarMassGPerMol: 253.81,
            colorHex: '#9333ea',
            appearance: 'Rich luminous violet gas cloud filling vessel',
            properties: ['Diatomic halogen gas molecule', 'Recrystallizes on cool glass rim'],
          },
        ],
        undefined,
        62.4,
        144.0,
        currentTempC
      )
    );
  }

  // REACTION 22: Solid Elements Synthesis — Iron + Sulfur Thermal Combination (8Fe + S8 -> 8FeS)
  if (has('fe_filings') && has('s8_powder') && (currentTempC >= 70 || isHeating)) {
    const feMoles = calculateChemicalMoles('fe_filings', getAmount('fe_filings')).moles;
    const sAtomMoles = (getAmount('s8_powder') / 32.06);
    const reacted = Math.min(feMoles, sAtomMoles);
    const fesMass = Number((reacted * 87.91).toFixed(2));
    reactionPulse = true;
    precipitate = {
      formula: 'FeS(s)↓',
      name: 'Iron(II) Sulfide Compound',
      color: '#18181b',
      amountG: fesMass,
      moles: reacted,
      texture: 'granular',
      description: 'Jet-black non-magnetic iron(II) sulfide formed by direct elemental synthesis.',
    };
    detectedReactions.push(
      createReactionDetails(
        'Direct Elemental Synthesis: Iron + Sulfur',
        'Exothermic Direct Combination Synthesis',
        'redox',
        '8Fe(s) + S₈(s) ──[Heat Δ]──➔ 8FeS(s)↓ (Black Iron(II) Sulfide)',
        'Exothermic Synthesis (ΔH° = -100.0 kJ/mol)',
        [
          {
            formula: 'Fe(s)',
            name: 'Iron Filings',
            role: 'reactant',
            moles: feMoles,
            massG: getAmount('fe_filings'),
            state: 's',
            molarMassGPerMol: 55.85,
            appearance: 'Grey ferromagnetic iron element',
            properties: ['Transition metal element'],
          },
          {
            formula: 'S₈(s)',
            name: 'Sulfur Powder',
            role: 'reactant',
            moles: Number((getAmount('s8_powder') / 256.48).toFixed(4)),
            massG: getAmount('s8_powder'),
            state: 's',
            molarMassGPerMol: 256.48,
            appearance: 'Canary yellow solid non-metal element',
            properties: ['Octasulfur molecular rings'],
          },
        ],
        [
          {
            formula: 'FeS(s)↓',
            name: 'Iron(II) Sulfide',
            role: 'product',
            moles: reacted,
            massG: fesMass,
            state: 's',
            molarMassGPerMol: 87.91,
            colorHex: '#18181b',
            appearance: 'Dark slate-black solid compound',
            properties: ['Distinct compound properties unlike reactant mixture'],
          },
        ],
        undefined,
        -100.0,
        -11.0,
        currentTempC
      )
    );
  }

  // REACTION 23: Gaseous & Elemental Combustions with Oxygen Gas (H2+O2, CH4+O2, C+O2, S8+O2 under Bunsen ignition)
  if (has('o2_gas') && (has('h2_gas') || has('ch4_gas') || has('c_graphite') || has('s8_powder')) && (currentTempC >= 55 || isHeating)) {
    const o2Moles = calculateChemicalMoles('o2_gas', getAmount('o2_gas')).moles;
    reactionPulse = true;
    tempDelta += 32;

    if (has('h2_gas')) {
      const h2Moles = calculateChemicalMoles('h2_gas', getAmount('h2_gas')).moles;
      const h2oMoles = Math.min(h2Moles, o2Moles * 2);
      detectedReactions.push(
        createReactionDetails(
          'Hydrogen-Oxygen Synthesis (Combustion)',
          'Exothermic Elemental Combustion',
          'redox',
          '2H₂(g) + O₂(g) ──[Ignition Δ]──➔ 2H₂O(g/l) [Vigorous Energy Release]',
          'Strongly Exothermic (ΔH° = -571.6 kJ/mol)',
          [
            {
              formula: 'H₂(g)',
              name: 'Hydrogen Gas',
              role: 'reactant',
              moles: h2Moles,
              massG: Number((h2Moles * 2.016).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 2.016,
              appearance: 'Colorless flammable elemental gas',
              properties: ['Clean high-energy fuel'],
            },
            {
              formula: 'O₂(g)',
              name: 'Oxygen Gas',
              role: 'reactant',
              moles: o2Moles,
              massG: Number((o2Moles * 32.0).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 32.0,
              appearance: 'Paramagnetic oxidizing elemental gas',
              properties: ['Combustion oxidizer'],
            },
          ],
          [
            {
              formula: '2H₂O(l/g)',
              name: 'Water Condensation / Steam',
              role: 'product',
              moles: h2oMoles,
              massG: Number((h2oMoles * 18.02).toFixed(4)),
              state: 'l',
              molarMassGPerMol: 18.02,
              appearance: 'Warm water mist droplets inside glass wall',
              properties: ['Zero-carbon combustion product'],
            },
          ],
          undefined,
          -571.6,
          -326.0,
          currentTempC
        )
      );
    } else if (has('ch4_gas')) {
      const ch4Moles = calculateChemicalMoles('ch4_gas', getAmount('ch4_gas')).moles;
      const reacted = Math.min(ch4Moles, o2Moles / 2);
      detectedReactions.push(
        createReactionDetails(
          'Methane Hydrocarbon Complete Combustion',
          'Exothermic Hydrocarbon Combustion',
          'redox',
          'CH₄(g) + 2O₂(g) ──[Flame Δ]──➔ CO₂(g) + 2H₂O(g)',
          'Strongly Exothermic (ΔH° = -890.4 kJ/mol)',
          [
            {
              formula: 'CH₄(g)',
              name: 'Methane Gas',
              role: 'reactant',
              moles: ch4Moles,
              massG: Number((ch4Moles * 16.04).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 16.04,
              appearance: 'Colorless flammable molecular gas',
              properties: ['Natural gas primary constituent'],
            },
            {
              formula: 'O₂(g)',
              name: 'Oxygen Gas',
              role: 'reactant',
              moles: o2Moles,
              massG: Number((o2Moles * 32.0).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 32.0,
              appearance: 'Oxidizing gas',
              properties: ['Supports hydrocarbon oxidation'],
            },
          ],
          [
            {
              formula: 'CO₂(g)',
              name: 'Carbon Dioxide Gas',
              role: 'product',
              moles: reacted,
              massG: Number((reacted * 44.01).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 44.01,
              appearance: 'Colorless gas',
              properties: ['Fully oxidized carbon product'],
            },
            {
              formula: '2H₂O(g)',
              name: 'Water Vapor',
              role: 'product',
              moles: reacted * 2,
              massG: Number((reacted * 2 * 18.02).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 18.02,
              appearance: 'Condensing mist on vessel wall',
              properties: ['Combustion product'],
            },
          ],
          undefined,
          -890.4,
          -242.0,
          currentTempC
        )
      );
    } else if (has('c_graphite')) {
      const cMoles = calculateChemicalMoles('c_graphite', getAmount('c_graphite')).moles;
      const reacted = Math.min(cMoles, o2Moles);
      detectedReactions.push(
        createReactionDetails(
          'Elemental Carbon Combustion',
          'Exothermic Elemental Oxidation',
          'redox',
          'C(s) + O₂(g) ──[Heat Δ]──➔ CO₂(g)',
          'Exothermic (ΔH° = -393.5 kJ/mol)',
          [
            {
              formula: 'C(s)',
              name: 'Carbon / Charcoal Powder',
              role: 'reactant',
              moles: cMoles,
              massG: getAmount('c_graphite'),
              state: 's',
              molarMassGPerMol: 12.01,
              appearance: 'Black solid carbon element',
              properties: ['Elemental carbon'],
            },
            {
              formula: 'O₂(g)',
              name: 'Oxygen Gas',
              role: 'reactant',
              moles: o2Moles,
              massG: Number((o2Moles * 32.0).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 32.0,
              appearance: 'Colorless gas',
              properties: ['Oxidizer'],
            },
          ],
          [
            {
              formula: 'CO₂(g)',
              name: 'Carbon Dioxide Gas',
              role: 'product',
              moles: reacted,
              massG: Number((reacted * 44.01).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 44.01,
              appearance: 'Colorless CO₂ gas',
              properties: ['Linear triatomic molecule'],
            },
          ],
          undefined,
          -393.5,
          2.9,
          currentTempC
        )
      );
    } else if (has('s8_powder')) {
      const sAtomMoles = getAmount('s8_powder') / 32.06;
      const reacted = Math.min(sAtomMoles, o2Moles);
      const so2VolMl = Math.max(40, Math.round(reacted * 24465));
      const so2DensityFactor = Number(
        Math.min(1, Math.max(0.15, Math.pow(Math.max(1, so2VolMl) / 1200, 0.55))).toFixed(3)
      );
      gasAtmosphere = {
        formula: 'SO₂(g)',
        name: 'Sulfur Dioxide Gas Cloud',
        color: '#fef08a',
        opacity: Number((0.14 + so2DensityFactor * 0.58).toFixed(3)),
        volumeMl: so2VolMl,
        densityFactor: so2DensityFactor,
      };
      detectedReactions.push(
        createReactionDetails(
          'Sulfur Oxidation in Oxygen',
          'Exothermic Non-Metal Combustion',
          'redox',
          'S₈(s) + 8O₂(g) ──[Heat Δ]──➔ 8SO₂(g)',
          'Exothermic (ΔH° = -296.8 kJ/mol per S)',
          [
            {
              formula: 'S₈(s)',
              name: 'Sulfur Powder',
              role: 'reactant',
              moles: Number((getAmount('s8_powder') / 256.48).toFixed(4)),
              massG: getAmount('s8_powder'),
              state: 's',
              molarMassGPerMol: 256.48,
              appearance: 'Bright yellow molecular element',
              properties: ['Burns with pale blue flame'],
            },
            {
              formula: 'O₂(g)',
              name: 'Oxygen Gas',
              role: 'reactant',
              moles: o2Moles,
              massG: Number((o2Moles * 32.0).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 32.0,
              appearance: 'Oxidizer gas',
              properties: ['Supports sulfur oxidation'],
            },
          ],
          [
            {
              formula: 'SO₂(g)',
              name: 'Sulfur Dioxide Gas',
              role: 'product',
              moles: reacted,
              massG: Number((reacted * 64.07).toFixed(4)),
              state: 'g',
              molarMassGPerMol: 64.07,
              appearance: 'Pungent pale yellow gas',
              properties: ['Acidic oxide gas'],
            },
          ],
          undefined,
          -296.8,
          11.0,
          currentTempC
        )
      );
    }
  }

  // REACTION 24: Nitrogen Dioxide Thermochromic Gas Equilibrium (2NO2(g) ⇌ N2O4(g))
  if (has('no2_gas') && detectedReactions.length === 0) {
    const no2Moles = calculateChemicalMoles('no2_gas', getAmount('no2_gas')).moles;
    detectedReactions.push(
      createReactionDetails(
        'Nitrogen Dioxide Dimerization Equilibrium',
        'Thermochromic Gas-Phase Equilibrium',
        'thermal_equilibrium',
        '2NO₂(g) (Red-Brown) ⇌ N₂O₄(g) (Colorless Dimer)  [Heat shifts left ➔ Darker]',
        'Exothermic Dimerization (ΔH° = -57.2 kJ/mol)',
        [
          {
            formula: 'NO₂(g)',
            name: 'Nitrogen Dioxide Gas',
            role: 'reactant',
            moles: no2Moles,
            massG: Number((no2Moles * 46.01).toFixed(4)),
            state: 'g',
            molarMassGPerMol: 46.01,
            colorHex: '#c2410c',
            appearance: 'Reddish-brown paramagnetic gas',
            properties: ['Odd-electron radical monomer', 'Deepens in color when heated'],
          },
        ],
        [
          {
            formula: 'N₂O₄(g)',
            name: 'Dinitrogen Tetroxide Dimer',
            role: 'product',
            moles: Number((no2Moles * 0.5).toFixed(5)),
            massG: Number((no2Moles * 46.01).toFixed(4)),
            state: 'g',
            molarMassGPerMol: 92.01,
            colorHex: '#fef3c7',
            appearance: 'Pale / colorless diamagnetic dimer favored when cool',
            properties: ['Favored at lower temperature (Le Chatelier\'s principle)'],
          },
        ],
        undefined,
        -57.2,
        -175.8,
        currentTempC
      )
    );
  }

  // REACTION 15: General Acid-Base Neutralization (H+ + OH- -> H2O)
  if (molesH > 0 && molesOH > 0) {
    reactionPulse = true;
    const reactedMoles = Math.min(molesH, molesOH);

    detectedReactions.push(
      createReactionDetails(
        'Acid-Base Neutralization',
        'Acid-Base Neutralization / Proton Transfer',
        'acid_base',
        'H⁺(aq) + OH⁻(aq) ➔ H₂O(l) [Exothermic Neutralization: ΔH = -57.3 kJ/mol]',
        'Exothermic Neutralization (ΔH° = -57.3 kJ/mol)',
        [
          {
            formula: 'H⁺(aq)',
            name: 'Hydronium / Acid Protons',
            role: 'reactant',
            moles: molesH,
            massG: Number((molesH * 1.008).toFixed(3)),
            state: 'aq',
            molarMassGPerMol: 1.008,
            colorHex: '#ef4444',
            appearance: 'Acidic aqueous hydronium ions',
            properties: ['Proton donor (Brønsted-Lowry acid)', 'pH < 7', 'Reaches neutral pH upon titration'],
          },
          {
            formula: 'OH⁻(aq)',
            name: 'Hydroxide / Base Anions',
            role: 'reactant',
            moles: molesOH,
            massG: Number((molesOH * 17.008).toFixed(3)),
            state: 'aq',
            molarMassGPerMol: 17.008,
            colorHex: '#3b82f6',
            appearance: 'Caustic alkaline hydroxide ions',
            properties: ['Proton acceptor (Brønsted-Lowry base)', 'pH > 7', 'Caustic alkali'],
          },
        ],
        [
          {
            formula: 'H₂O(l)',
            name: 'Liquid Water',
            role: 'product',
            moles: reactedMoles,
            massG: Number((reactedMoles * 18.02).toFixed(2)),
            state: 'l',
            molarMassGPerMol: 18.02,
            colorHex: '#f8fafc',
            appearance: 'Neutral liquid water',
            properties: ['Pure solvent', 'Neutral pH 7.00', 'Enthalpy release: -57.3 kJ per mole reacted'],
          },
        ],
        undefined,
        -57.3,
        80.7,
        currentTempC
      )
    );
  }

  // Indicator Evaluation & Chromophore Shift
  const isTransitionDominated =
    has('fecl3_sol') ||
    has('kmno4_sol') ||
    has('kmno4_crystals') ||
    has('k2cr2o7_sol') ||
    has('cocl2_sol') ||
    (has('cuso4_sol') && has('nh3_aq')) ||
    (has('i2_lugol') && has('starch_sol'));

  if (has('phenolphthalein')) {
    activeIndicator = 'phenolphthalein';
    if (calculatedPH >= 8.2) {
      baseSolutionColor = '#ec4899'; // Fluorescent electric pink / magenta
    } else if (!isTransitionDominated) {
      baseSolutionColor = 'rgba(255, 255, 255, 0.15)';
    }
  } else if (has('universal_ind')) {
    activeIndicator = 'universal_ind';
    if (calculatedPH < 3.0) baseSolutionColor = '#ef4444'; // Red
    else if (calculatedPH < 5.5) baseSolutionColor = '#f97316'; // Orange
    else if (calculatedPH < 6.8) baseSolutionColor = '#eab308'; // Yellow
    else if (calculatedPH < 7.8) baseSolutionColor = '#22c55e'; // Emerald Green
    else if (calculatedPH < 9.5) baseSolutionColor = '#06b6d4'; // Cyan
    else if (calculatedPH < 11.5) baseSolutionColor = '#3b82f6'; // Sapphire Blue
    else baseSolutionColor = '#7c3aed'; // Deep Violet
  } else if (has('bromothymol_blue')) {
    activeIndicator = 'bromothymol_blue';
    if (calculatedPH < 6.0) baseSolutionColor = '#eab308'; // Yellow
    else if (calculatedPH <= 7.6) baseSolutionColor = '#10b981'; // Green
    else baseSolutionColor = '#2563eb'; // Blue
  } else if (has('methyl_orange')) {
    activeIndicator = 'methyl_orange';
    if (calculatedPH < 3.1) baseSolutionColor = '#ef4444'; // Red
    else if (calculatedPH < 4.4) baseSolutionColor = '#f97316'; // Orange
    else baseSolutionColor = '#eab308'; // Yellow
  }

  // 4. AGGREGATE FINAL REACTION STATE
  let detailedReaction: DetailedReactionInfo | null = null;
  let activeReactionName: string | null = null;
  let activeReactionEquation: string | null = null;
  let activeReactionType: string | null = null;

  if (detectedReactions.length > 0 || contents.length > 2) {
    detailedReaction = aggregateMultiReactantSystem(detectedReactions, contents, currentTempC);
    activeReactionName = detailedReaction.reactionName;
    activeReactionEquation = detailedReaction.balancedEquation;
    activeReactionType = detailedReaction.reactionType;
  }

  return {
    pH: Number(calculatedPH.toFixed(2)),
    color: baseSolutionColor,
    temperatureChange: tempDelta,
    precipitate,
    gasEvolving,
    gasAtmosphere,
    undissolvedSolids,
    foamHeightPercent,
    activeIndicator,
    activeReactionName,
    activeReactionEquation,
    activeReactionType,
    detailedReaction,
    allReactions: detectedReactions,
    reactionPulse,
    loggedEvents: [],
    reactionTimeLengthSec: detailedReaction?.reactionTimeLengthSec,
    kineticsType: detailedReaction?.kineticsType,
  };
}
