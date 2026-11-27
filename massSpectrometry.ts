import { MoleculeData } from '../types/chemistry';

export type MsIonizationMode = 'ei' | 'esi';

export interface MsPeak {
  id: string;
  mz: number; // Exact mass-to-charge ratio (Da / e)
  nominalMz: number;
  relativeIntensity: number; // 0 - 100% (normalized to base peak = 100%)
  ionFormula: string; // e.g. "[C₂H₆O]⁺•", "[CH₂=OH]⁺", "M+1 (¹³C)"
  assignment: string; // e.g. "Base Peak", "Molecular Ion [M]⁺•", "α-Cleavage"
  neutralLoss?: string; // e.g. "−15 (·CH₃)", "−18 (H₂O)"
  category: 'molecular' | 'isotope' | 'fragment';
  description: string;
}

export interface MassSpectrumAnalysis {
  peaks: MsPeak[];
  formulaCounts: Record<string, number>;
  cleanFormula: string;
  monoisotopicMass: number; // Exact mass using most abundant isotopes
  averageMass: number;
  nominalMass: number;
  basePeakMz: number;
  molecularIonMz: number;
  dbe: number | null; // Degree of unsaturation (if C present)
  nitrogenRuleNote: string;
  minMz: number;
  maxMz: number;
  summaryNote: string;
}

interface IsotopeDef {
  massOffset: number; // nominal offset from principal isotope (e.g. +1, +2, -1)
  exactMass: number;
  prob: number; // natural abundance (0 - 1)
}

interface ElementMassSpec {
  exactMass: number; // Most abundant isotope exact mass
  avgMass: number;
  nominalMass: number;
  isotopes: IsotopeDef[];
}

const ELEMENT_MASS_DATA: Record<string, ElementMassSpec> = {
  H: {
    exactMass: 1.007825,
    avgMass: 1.008,
    nominalMass: 1,
    isotopes: [
      { massOffset: 0, exactMass: 1.007825, prob: 0.999885 },
      { massOffset: 1, exactMass: 2.014102, prob: 0.000115 },
    ],
  },
  B: {
    exactMass: 11.009305,
    avgMass: 10.811,
    nominalMass: 11,
    isotopes: [
      { massOffset: 0, exactMass: 11.009305, prob: 0.801 },
      { massOffset: -1, exactMass: 10.012937, prob: 0.199 },
    ],
  },
  C: {
    exactMass: 12.0,
    avgMass: 12.011,
    nominalMass: 12,
    isotopes: [
      { massOffset: 0, exactMass: 12.0, prob: 0.9893 },
      { massOffset: 1, exactMass: 13.003355, prob: 0.0107 },
    ],
  },
  N: {
    exactMass: 14.003074,
    avgMass: 14.007,
    nominalMass: 14,
    isotopes: [
      { massOffset: 0, exactMass: 14.003074, prob: 0.99632 },
      { massOffset: 1, exactMass: 15.000109, prob: 0.00368 },
    ],
  },
  O: {
    exactMass: 15.994915,
    avgMass: 15.999,
    nominalMass: 16,
    isotopes: [
      { massOffset: 0, exactMass: 15.994915, prob: 0.99757 },
      { massOffset: 1, exactMass: 16.999132, prob: 0.00038 },
      { massOffset: 2, exactMass: 17.999161, prob: 0.00205 },
    ],
  },
  F: {
    exactMass: 18.998403,
    avgMass: 18.998,
    nominalMass: 19,
    isotopes: [{ massOffset: 0, exactMass: 18.998403, prob: 1.0 }],
  },
  Na: {
    exactMass: 22.989769,
    avgMass: 22.99,
    nominalMass: 23,
    isotopes: [{ massOffset: 0, exactMass: 22.989769, prob: 1.0 }],
  },
  Si: {
    exactMass: 27.976927,
    avgMass: 28.085,
    nominalMass: 28,
    isotopes: [
      { massOffset: 0, exactMass: 27.976927, prob: 0.92223 },
      { massOffset: 1, exactMass: 28.976495, prob: 0.04685 },
      { massOffset: 2, exactMass: 29.97377, prob: 0.03092 },
    ],
  },
  P: {
    exactMass: 30.973762,
    avgMass: 30.974,
    nominalMass: 31,
    isotopes: [{ massOffset: 0, exactMass: 30.973762, prob: 1.0 }],
  },
  S: {
    exactMass: 31.972071,
    avgMass: 32.06,
    nominalMass: 32,
    isotopes: [
      { massOffset: 0, exactMass: 31.972071, prob: 0.9499 },
      { massOffset: 1, exactMass: 32.971459, prob: 0.0075 },
      { massOffset: 2, exactMass: 33.967867, prob: 0.0425 },
    ],
  },
  Cl: {
    exactMass: 34.968853,
    avgMass: 35.45,
    nominalMass: 35,
    isotopes: [
      { massOffset: 0, exactMass: 34.968853, prob: 0.7576 },
      { massOffset: 2, exactMass: 36.965903, prob: 0.2424 },
    ],
  },
  K: {
    exactMass: 38.963707,
    avgMass: 39.098,
    nominalMass: 39,
    isotopes: [
      { massOffset: 0, exactMass: 38.963707, prob: 0.93258 },
      { massOffset: 2, exactMass: 40.961826, prob: 0.0673 },
    ],
  },
  Br: {
    exactMass: 78.918337,
    avgMass: 79.904,
    nominalMass: 79,
    isotopes: [
      { massOffset: 0, exactMass: 78.918337, prob: 0.5069 },
      { massOffset: 2, exactMass: 80.91629, prob: 0.4931 },
    ],
  },
  I: {
    exactMass: 126.904473,
    avgMass: 126.904,
    nominalMass: 127,
    isotopes: [{ massOffset: 0, exactMass: 126.904473, prob: 1.0 }],
  },
};

const ELECTRON_MASS = 0.00054858;
const PROTON_MASS = 1.007276;

/**
 * Parses a chemical formula (including Unicode subscripts and repeated groups like CH₃COOH or C₂H₅OH)
 * into total atom counts per element.
 */
export function parseFormulaCounts(formula: string): Record<string, number> {
  // Strip annotations like " (2x2 Unit)" and normalize Unicode subscripts
  const cleaned = formula
    .replace(/\(.*?\)/g, '')
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 8320))
    .replace(/[^A-Za-z0-9]/g, '');

  const counts: Record<string, number> = {};
  const regex = /([A-Z][a-z]?)(\d*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    const el = match[1];
    const num = match[2] ? parseInt(match[2], 10) : 1;
    counts[el] = (counts[el] || 0) + num;
  }
  return counts;
}

function formatHillFromCounts(counts: Record<string, number>): string {
  const keys = Object.keys(counts).filter((k) => counts[k] > 0);
  const sub = (n: number) =>
    n <= 1
      ? ''
      : String(n).replace(/\d/g, (d) => String.fromCharCode(8320 + Number(d)));

  let out = '';
  if (counts['C']) {
    out += `C${sub(counts['C'])}`;
    if (counts['H']) out += `H${sub(counts['H'])}`;
  }
  keys
    .filter((k) => k !== 'C' && (counts['C'] ? k !== 'H' : true))
    .sort()
    .forEach((k) => {
      out += `${k}${sub(counts[k])}`;
    });
  return out || 'Empty';
}

/**
 * Discrete polynomial convolution to compute the exact natural isotope envelope
 * around the monoisotopic nominal mass M.
 */
function computeIsotopeDistribution(
  counts: Record<string, number>,
  baseExactMass: number
): Array<{ offset: number; exactMass: number; relProb: number }> {
  // Map from integer nominal offset -> { prob, weightedMass }
  let dist = new Map<number, { prob: number; massSum: number }>();
  dist.set(0, { prob: 1.0, massSum: 0 });

  for (const [el, count] of Object.entries(counts)) {
    const data = ELEMENT_MASS_DATA[el];
    if (!data || count <= 0) continue;

    // Multiply atom distribution `count` times (fast exponentiation or simple loop since count <= 100)
    for (let i = 0; i < count; i++) {
      const next = new Map<number, { prob: number; massSum: number }>();
      for (const [curOff, curVal] of dist.entries()) {
        for (const iso of data.isotopes) {
          const newOff = curOff + iso.massOffset;
          if (newOff < -4 || newOff > 8) continue;
          const p = curVal.prob * iso.prob;
          if (p < 1e-5) continue;
          const existing = next.get(newOff);
          if (existing) {
            existing.prob += p;
            existing.massSum += curVal.prob * (curVal.massSum / curVal.prob + iso.exactMass) * iso.prob;
          } else {
            const avgCurMass = curVal.prob > 0 ? curVal.massSum / curVal.prob : 0;
            next.set(newOff, {
              prob: p,
              massSum: p * (avgCurMass + iso.exactMass),
            });
          }
        }
      }
      dist = next;
    }
  }

  const entries = Array.from(dist.entries())
    .map(([offset, val]) => ({
      offset,
      exactMass: val.prob > 0 ? val.massSum / val.prob : baseExactMass + offset,
      prob: val.prob,
    }))
    .filter((e) => e.prob >= 0.002)
    .sort((a, b) => a.offset - b.offset);

  const maxProb = Math.max(...entries.map((e) => e.prob), 0.0001);
  return entries.map((e) => ({
    offset: e.offset,
    exactMass: Number(e.exactMass.toFixed(4)),
    relProb: Number(((e.prob / maxProb) * 100).toFixed(1)),
  }));
}

function getCountsForMolecule(molecule: MoleculeData): Record<string, number> {
  // Always prefer formula parsing when formula is valid (handles condensed CH3COOH and heavy-atom-only curated structures)
  if (molecule.formula && molecule.formula !== 'N/A' && molecule.formula !== 'Empty') {
    const parsed = parseFormulaCounts(molecule.formula);
    if (Object.keys(parsed).length > 0) {
      return parsed;
    }
  }
  const counts: Record<string, number> = {};
  for (const a of molecule.atoms) {
    counts[a.element] = (counts[a.element] || 0) + 1;
  }
  return counts;
}

/**
 * Generates theoretical EI fragments and isotope envelope peaks for any MoleculeData.
 */
export function calculateMassSpectrum(
  molecule: MoleculeData,
  mode: MsIonizationMode = 'ei',
  chargeZ: 1 | 2 = 1
): MassSpectrumAnalysis {
  const counts = getCountsForMolecule(molecule);
  const cleanFormula = formatHillFromCounts(counts);

  let monoisotopicMass = 0;
  let averageMass = 0;
  let nominalMass = 0;

  for (const [el, count] of Object.entries(counts)) {
    const data = ELEMENT_MASS_DATA[el];
    if (data) {
      monoisotopicMass += data.exactMass * count;
      averageMass += data.avgMass * count;
      nominalMass += data.nominalMass * count;
    } else {
      const approx = molecule.molarMass / Math.max(molecule.atoms.length, 1);
      monoisotopicMass += approx * count;
      averageMass += approx * count;
      nominalMass += Math.round(approx) * count;
    }
  }

  const cCount = counts['C'] || 0;
  const hCount = counts['H'] || 0;
  const nCount = counts['N'] || 0;
  const halCount = (counts['F'] || 0) + (counts['Cl'] || 0) + (counts['Br'] || 0) + (counts['I'] || 0);
  const dbe = cCount > 0 ? Number((cCount + 1 - (hCount + halCount - nCount) / 2).toFixed(1)) : null;

  const isEvenNominal = nominalMass % 2 === 0;
  const isEvenNitrogen = nCount % 2 === 0;
  const nitrogenRuleNote =
    isEvenNominal === isEvenNitrogen
      ? `Follows Nitrogen Rule: ${isEvenNominal ? 'Even' : 'Odd'} nominal mass (${nominalMass}) matches ${nCount} N atom(s).`
      : `Ionic/non-standard valence formula (Nominal ${nominalMass}, ${nCount} N).`;

  const envelope = computeIsotopeDistribution(counts, monoisotopicMass);
  const rawPeaks: MsPeak[] = [];

  const toMz = (exactDa: number) => Number((exactDa / chargeZ).toFixed(3));

  if (mode === 'esi') {
    // ESI+: Protonated molecular ion [M + zH]^(z+) and its full isotope cluster
    const adductMass = chargeZ * PROTON_MASS;
    const baseTargetMz = toMz(monoisotopicMass + adductMass);

    envelope.forEach((iso) => {
      const ionExact = iso.exactMass + adductMass;
      const mz = toMz(ionExact);
      const tag =
        iso.offset === 0
          ? `[M+${chargeZ > 1 ? `${chargeZ}` : ''}H]${chargeZ > 1 ? `${chargeZ}⁺` : '⁺'}`
          : iso.offset > 0
          ? `M+${iso.offset} Isotope`
          : `M${iso.offset} Isotope`;
      const isoCause =
        iso.offset === 0
          ? 'Monoisotopic protonated quasi-molecular ion.'
          : iso.offset === 2 && (counts['Cl'] || counts['Br'] || counts['S'])
          ? `Heavy-isotope peak (³⁷Cl / ⁸¹Br / ³⁴S contribution).`
          : iso.offset < 0 && counts['B']
          ? `Light ¹⁰B natural isotope (19.9% abundance).`
          : `Natural ¹³C / ¹⁵N / ¹⁸O heavy-isotope contribution.`;

      rawPeaks.push({
        id: `esi_${iso.offset}`,
        mz,
        nominalMz: Math.round(mz),
        relativeIntensity: iso.relProb,
        ionFormula: iso.offset === 0 ? `[${cleanFormula}+${chargeZ > 1 ? chargeZ : ''}H]${chargeZ > 1 ? `${chargeZ}⁺` : '⁺'}` : `${tag} (${cleanFormula})`,
        assignment: tag,
        category: iso.offset === 0 ? 'molecular' : 'isotope',
        description: isoCause,
      });
    });

    // Optional [M+Na]+ sodiated adduct if polar/oxygenated
    if ((counts['O'] || 0) > 0 && chargeZ === 1) {
      const naMz = toMz(monoisotopicMass + ELEMENT_MASS_DATA.Na.exactMass - ELECTRON_MASS);
      rawPeaks.push({
        id: 'esi_na_adduct',
        mz: naMz,
        nominalMz: Math.round(naMz),
        relativeIntensity: 24,
        ionFormula: `[${cleanFormula}+Na]⁺`,
        assignment: 'Sodiated Adduct [M+Na]⁺',
        category: 'molecular',
        description: 'Trace Na⁺ ion coordinates to oxygen lone pairs in electrospray ionization (+22.99 Da).',
      });
    }

    const maxInt = Math.max(...rawPeaks.map((p) => p.relativeIntensity), 1);
    const normalized = rawPeaks
      .map((p) => ({
        ...p,
        relativeIntensity: Number(((p.relativeIntensity / maxInt) * 100).toFixed(1)),
      }))
      .sort((a, b) => a.mz - b.mz);

    const basePeak = normalized.reduce((best, p) => (p.relativeIntensity > best.relativeIntensity ? p : best), normalized[0]);

    return {
      peaks: normalized,
      formulaCounts: counts,
      cleanFormula,
      monoisotopicMass: Number(monoisotopicMass.toFixed(4)),
      averageMass: Number(averageMass.toFixed(3)),
      nominalMass,
      basePeakMz: basePeak ? basePeak.mz : baseTargetMz,
      molecularIonMz: baseTargetMz,
      dbe,
      nitrogenRuleNote,
      minMz: 0,
      maxMz: Math.ceil((baseTargetMz + 35) / 10) * 10,
      summaryNote: `ESI+ (z=+${chargeZ}): Quasi-molecular [M+${chargeZ > 1 ? chargeZ : ''}H] at m/z ${baseTargetMz.toFixed(2)} with ${normalized.length} isotopic/adduct peaks.`,
    };
  }

  // --- EI (70 eV) Mode: Molecular Ion [M]⁺• + Isotope Cluster + Fragmentation ---
  const mRadicalExact = monoisotopicMass - chargeZ * ELECTRON_MASS;
  const mIonMz = toMz(mRadicalExact);

  // Curated benchmark fragment patterns + algorithmic fragment prediction
  const addFrag = (
    id: string,
    exactIonMass: number,
    intensity: number,
    ionFormula: string,
    assignment: string,
    neutralLoss: string | undefined,
    description: string
  ) => {
    if (exactIonMass <= 0.5) return;
    const mz = toMz(exactIonMass);
    rawPeaks.push({
      id,
      mz,
      nominalMz: Math.round(mz),
      relativeIntensity: intensity,
      ionFormula,
      assignment,
      neutralLoss,
      category: 'fragment',
      description,
    });
  };

  // Determine molecular ion stability (aromatic / small stable molecules have intense M+•, aliphatic alcohols/acids fragment heavily)
  let mIonRelHeight = 55;
  if (molecule.id === 'benzene' || molecule.id === 'caffeine' || molecule.id === 'water' || molecule.id === 'methane' || molecule.id === 'carbon_dioxide' || molecule.id === 'ammonia' || molecule.id === 'hydrogen_cyanide') {
    mIonRelHeight = 100;
  } else if (molecule.id === 'aspirin' || molecule.id === 'ethanol' || molecule.id === 'glucose' || molecule.id === 'alanine') {
    mIonRelHeight = 18;
  } else if (molecule.id === 'sulfur_hexafluoride' || molecule.id === 'phosphorus_pentachloride' || molecule.id === 'boron_trifluoride') {
    mIonRelHeight = 12;
  }

  // Add isotope envelope scaled by mIonRelHeight
  envelope.forEach((iso) => {
    const mz = toMz(iso.exactMass - chargeZ * ELECTRON_MASS);
    const scaled = Number(((iso.relProb / 100) * mIonRelHeight).toFixed(1));
    if (scaled < 0.8 && iso.offset !== 0) return;
    rawPeaks.push({
      id: `ei_iso_${iso.offset}`,
      mz,
      nominalMz: Math.round(mz),
      relativeIntensity: Math.max(scaled, iso.offset === 0 ? mIonRelHeight : 0.8),
      ionFormula: iso.offset === 0 ? `[${cleanFormula}]${chargeZ > 1 ? `${chargeZ}⁺` : '⁺•'}` : `M+${iso.offset} (${cleanFormula})`,
      assignment: iso.offset === 0 ? `Molecular Ion [M]${chargeZ > 1 ? `${chargeZ}⁺` : '⁺•'}` : iso.offset > 0 ? `M+${iso.offset} Isotope Peak` : `M${iso.offset} Isotope Peak`,
      category: iso.offset === 0 ? 'molecular' : 'isotope',
      description:
        iso.offset === 0
          ? `Intact unfragmented radical cation at exact m/z ${mz.toFixed(3)}.`
          : `Isotopologue peak shifted by ${iso.offset > 0 ? '+' : ''}${iso.offset} Da from natural heavy isotopes.`,
    });
  });

  // Specific textbook EI fragmentation spectra for curated compounds + structural fragmentation
  if (molecule.id === 'water') {
    addFrag('w_oh', 17.0027, 23, '[OH]⁺', 'Hydroxyl Cation', '−1 (·H)', 'Hydrogen atom cleavage from H₂O⁺• yields [OH]⁺ at m/z 17.');
    addFrag('w_o', 15.9949, 2, '[O]⁺•', 'Atomic Oxygen Ion', '−2 (H₂)', 'Minor atomic oxygen fragment.');
  } else if (molecule.id === 'methane') {
    addFrag('m_ch3', 15.0235, 86, '[CH₃]⁺', 'Methyl Cation', '−1 (·H)', 'Very intense [M−H]⁺ methyl cation at m/z 15.');
    addFrag('m_ch2', 14.0157, 16, '[CH₂]⁺•', 'Methylene Ion', '−2 (H₂)', 'Loss of H₂ yields m/z 14.');
  } else if (molecule.id === 'carbon_dioxide') {
    addFrag('co2_co', 27.9949, 10, '[CO]⁺•', 'Carbon Monoxide Ion', '−16 (O)', 'Cleavage of one C=O bond yields [CO]⁺• at m/z 28.');
    addFrag('co2_o', 15.9949, 9, '[O]⁺•', 'Oxygen Ion', '−28 (CO)', 'Atomic oxygen fragment at m/z 16.');
  } else if (molecule.id === 'ammonia') {
    addFrag('nh3_nh2', 16.0187, 80, '[NH₂]⁺', 'Amidogen Cation', '−1 (·H)', 'Strong N–H cleavage peak [M−H]⁺ at m/z 16.');
    addFrag('nh3_nh', 15.0109, 7, '[NH]⁺•', 'Imidogen Ion', '−2 (H₂)', 'Minor [NH]⁺• fragment at m/z 15.');
  } else if (molecule.id === 'ethanol') {
    addFrag('et_45', 45.034, 48, '[CH₃CH=OH]⁺', 'α-Cleavage [M−H]⁺', '−1 (·H)', 'Loss of α-hydrogen yields stabilized oxonium ion at m/z 45.');
    addFrag('et_31', 31.0184, 100, '[CH₂=OH]⁺', 'Base Peak (α-Cleavage)', '−15 (·CH₃)', 'Dominant α-cleavage of methyl radical forms resonance-stabilized hydroxymethyl cation [CH₂=OH]⁺.');
    addFrag('et_29', 29.0391, 28, '[C₂H₅]⁺', 'Ethyl / Formyl Cation', '−17 (·OH)', 'C–O bond cleavage yields ethyl cation at m/z 29.');
    addFrag('et_15', 15.0235, 12, '[CH₃]⁺', 'Methyl Cation', '−31 (·CH₂OH)', 'Terminal methyl cation at m/z 15.');
  } else if (molecule.id === 'benzene') {
    addFrag('bz_77', 77.0391, 24, '[C₆H₅]⁺', 'Phenyl Cation', '−1 (·H)', 'Loss of H radical yields phenyl cation at m/z 77.');
    addFrag('bz_51', 51.0235, 19, '[C₄H₃]⁺', 'Butadiynyl Fragment', '−27 (C₂H₂+H)', 'Diagnostic aromatic ring-cleavage fragment at m/z 51.');
    addFrag('bz_39', 39.0235, 14, '[C₃H₃]⁺', 'Cyclopropenyl Cation', '−39 (C₃H₃)', 'Aromatic cyclopropenyl cation at m/z 39.');
  } else if (molecule.id === 'acetone') {
    addFrag('ac_43', 43.0184, 100, '[CH₃C≡O]⁺', 'Acylium Base Peak', '−15 (·CH₃)', 'Textbook α-cleavage of ·CH₃ produces the stable acetylium cation [CH₃CO]⁺ at m/z 43 (100% base peak).');
    addFrag('ac_15', 15.0235, 22, '[CH₃]⁺', 'Methyl Cation', '−43 (CH₃CO·)', 'Methyl cation fragment at m/z 15.');
  } else if (molecule.id === 'acetic_acid') {
    addFrag('aa_45', 45.00, 90, '[COOH]⁺', 'Carboxyl α-Cleavage', '−15 (·CH₃)', 'Loss of methyl radical forms [COOH]⁺ at m/z 45.');
    addFrag('aa_43', 43.0184, 100, '[CH₃C≡O]⁺', 'Acylium Base Peak', '−17 (·OH)', 'Loss of ·OH yields acetylium cation [CH₃CO]⁺ at m/z 43.');
    addFrag('aa_15', 15.0235, 25, '[CH₃]⁺', 'Methyl Cation', '−45 (·COOH)', 'Methyl cation at m/z 15.');
  } else if (molecule.id === 'aspirin') {
    addFrag('asp_138', 138.0317, 68, '[C₇H₆O₃]⁺•', 'Salicylic Acid Ion (McLafferty/Ketene Loss)', '−42 (CH₂=C=O)', 'Loss of neutral ketene (42 Da) regenerates the salicylic acid radical cation at m/z 138.');
    addFrag('asp_120', 120.0211, 100, '[C₇H₄O₂]⁺•', 'Base Peak (Ortho-Effect H₂O/AcOH Loss)', '−60 (CH₃COOH)', 'Ortho-effect elimination of acetic acid (60 Da) yields the intense salicyloyl lactone ion at m/z 120.');
    addFrag('asp_92', 92.0262, 34, '[C₆H₄O]⁺•', 'CO Loss from m/z 120', '−88 (AcOH+CO)', 'Extrusion of carbon monoxide (28 Da) from m/z 120 yields m/z 92.');
    addFrag('asp_43', 43.0184, 72, '[CH₃C≡O]⁺', 'Acetylium Cation', '−137', 'Cleavage of the acetate ester yields intense acetylium ion at m/z 43.');
  } else if (molecule.id === 'caffeine') {
    addFrag('caf_109', 109.0514, 65, '[C₅H₇N₃]⁺•', 'Pyrimidine Ring Cleavage', '−85', 'Retro-Diels-Alder loss of CH₃N=C=O and CO yields the diagnostic m/z 109 fragment.');
    addFrag('caf_82', 82.0531, 35, '[C₄H₆N₂]⁺•', 'N-Methylimidazole Ion', '−112', 'Imidazole ring fragment at m/z 82.');
    addFrag('caf_67', 67.0296, 42, '[C₃H₃N₂]⁺', 'Imidazole Fragment', '−127', 'Diagnostic caffeine fragment at m/z 67.');
    addFrag('caf_55', 55.0296, 48, '[C₂H₃N₂]⁺', 'Xanthine Cleavage', '−139', 'N-methylated ring cleavage peak at m/z 55.');
  } else if (molecule.id === 'sulfur_hexafluoride') {
    addFrag('sf6_127', 126.964, 100, '[SF₅]⁺', 'Base Peak [M−F]⁺', '−19 (·F)', 'SF₆⁺• is unstable and instantaneously sheds a fluorine radical to give [SF₅]⁺ at m/z 127 (100% base peak).');
    addFrag('sf6_108', 107.966, 12, '[SF₄]⁺•', 'Tetrafluorosulfur Ion', '−38 (2F)', 'Secondary F loss at m/z 108.');
    addFrag('sf6_89', 88.967, 25, '[SF₃]⁺', 'Trifluorosulfur Cation', '−57 (3F)', 'Odd-electron loss yielding stable [SF₃]⁺ at m/z 89.');
  } else if (molecule.id === 'boron_trifluoride') {
    addFrag('bf3_49', 49.006, 100, '[¹¹BF₂]⁺', 'Base Peak [M−F]⁺', '−19 (·F)', 'Loss of fluorine yields intense [¹¹BF₂]⁺ at m/z 49 (with ¹⁰BF₂⁺ satellite at m/z 48).');
    addFrag('bf3_48', 48.01, 24, '[¹⁰BF₂]⁺', '¹⁰B Isotope Fragment', '−19 (·F)', 'Natural 19.9% ¹⁰B isotope satellite of the [BF₂]⁺ base peak.');
  } else if (molecule.id === 'phosphorus_pentachloride') {
    addFrag('pcl5_171', 170.88, 100, '[PCl₄]⁺', 'Base Peak [M−Cl]⁺', '−35 (·Cl)', 'Axial chlorine cleavage gives the stable tetrahedral [PCl₄]⁺ cation at m/z 171 (with M+2/M+4 chlorine cluster).');
    addFrag('pcl5_136', 135.91, 45, '[PCl₃]⁺•', '[PCl₃]⁺• Fragment', '−70 (Cl₂)', 'Loss of Cl₂ yields phosphorus trichloride radical cation at m/z 136.');
  } else {
    // --- Generic Structural & Formula-Based Fragment Predictor (PubChem & remaining curated) ---
    if (cCount >= 1 && hCount >= 3 && monoisotopicMass > 28) {
      addFrag(
        'gen_m15',
        mRadicalExact - 15.0235,
        42,
        `[${cleanFormula}−CH₃]⁺`,
        'Methyl Radical Loss [M−CH₃]⁺',
        '−15 (·CH₃)',
        'Cleavage of a methyl group leaves an even-electron cation 15 Da below M⁺•.'
      );
    }
    if ((counts['O'] || 0) >= 1 && hCount >= 1 && monoisotopicMass > 30) {
      addFrag(
        'gen_m17',
        mRadicalExact - 17.0027,
        32,
        `[${cleanFormula}−OH]⁺`,
        'Hydroxyl Loss [M−OH]⁺',
        '−17 (·OH)',
        'Loss of hydroxyl radical (−17 Da) characteristic of alcohols & carboxylic acids.'
      );
      if (hCount >= 2 && monoisotopicMass > 32) {
        addFrag(
          'gen_m18',
          mRadicalExact - 18.0106,
          48,
          `[${cleanFormula}−H₂O]⁺•`,
          'Dehydration [M−H₂O]⁺•',
          '−18 (H₂O)',
          'Neutral water elimination (−18 Da) common in alcohols, sugars, and hydroxy compounds.'
        );
      }
    }
    if (cCount >= 2 && (counts['O'] || 0) >= 1 && monoisotopicMass > 45) {
      addFrag(
        'gen_m28',
        mRadicalExact - 27.9949,
        36,
        `[${cleanFormula}−CO]⁺•`,
        'Carbonyl Extrusion [M−CO]⁺•',
        '−28 (CO)',
        'Extrusion of neutral carbon monoxide (−28 Da) from phenols, lactones, or carbonyls.'
      );
    }
    if ((counts['Cl'] || 0) >= 1 && monoisotopicMass > 48) {
      addFrag(
        'gen_m35',
        mRadicalExact - 34.9689,
        65,
        `[${cleanFormula}−Cl]⁺`,
        'Chlorine Loss [M−Cl]⁺',
        '−35 (·Cl)',
        'Facile C–Cl homolytic cleavage (−35 Da) leaving a chlorine-free carbocation.'
      );
    }
    if ((counts['Br'] || 0) >= 1 && monoisotopicMass > 90) {
      addFrag(
        'gen_m79',
        mRadicalExact - 78.9183,
        70,
        `[${cleanFormula}−Br]⁺`,
        'Bromine Loss [M−Br]⁺',
        '−79 (·Br)',
        'Facile C–Br cleavage (−79 Da) yielding intense de-brominated fragment.'
      );
    }
    if (cCount >= 6 && hCount >= 5 && monoisotopicMass > 95) {
      addFrag(
        'gen_91',
        91.0548,
        58,
        '[C₇H₇]⁺',
        'Tropylium / Benzyl Cation',
        undefined,
        'Diagnostic aromatic/benzylic rearrangement ion at m/z 91.'
      );
      addFrag(
        'gen_77',
        77.0391,
        34,
        '[C₆H₅]⁺',
        'Phenyl Cation',
        undefined,
        'Diagnostic aromatic phenyl ring cation at m/z 77.'
      );
    }
    if (cCount >= 2 && (counts['O'] || 0) >= 1 && hCount >= 3 && monoisotopicMass > 55) {
      addFrag(
        'gen_43',
        43.0184,
        62,
        '[C₂H₃O]⁺',
        'Acetylium / Oxonium Fragment',
        undefined,
        'Common oxygen-containing low-mass fragment at m/z 43.'
      );
    }
    if (nCount >= 1 && cCount >= 2 && hCount >= 6 && monoisotopicMass > 50) {
      addFrag(
        'gen_30',
        30.0344,
        85,
        '[CH₂=NH₂]⁺',
        'Iminium Cation (α-Cleavage)',
        undefined,
        'Primary amine α-cleavage produces the highly stable iminium base peak at m/z 30.'
      );
    }
  }

  // Normalize EI peaks so the strongest peak = 100%
  const maxInt = Math.max(...rawPeaks.map((p) => p.relativeIntensity), 1);
  const normalized = rawPeaks
    .map((p) => ({
      ...p,
      relativeIntensity: Number(((p.relativeIntensity / maxInt) * 100).toFixed(1)),
    }))
    .sort((a, b) => a.mz - b.mz);

  const basePeak = normalized.reduce((best, p) => (p.relativeIntensity > best.relativeIntensity ? p : best), normalized[0]);

  return {
    peaks: normalized,
    formulaCounts: counts,
    cleanFormula,
    monoisotopicMass: Number(monoisotopicMass.toFixed(4)),
    averageMass: Number(averageMass.toFixed(3)),
    nominalMass,
    basePeakMz: basePeak ? basePeak.mz : mIonMz,
    molecularIonMz: mIonMz,
    dbe,
    nitrogenRuleNote,
    minMz: 0,
    maxMz: Math.ceil((mIonMz + Math.max(12, mIonMz * 0.12)) / 10) * 10,
    summaryNote: `Monoisotopic M = ${monoisotopicMass.toFixed(4)} Da · Base Peak m/z ${basePeak?.mz.toFixed(2) ?? mIonMz.toFixed(2)} · [M]⁺• m/z ${mIonMz.toFixed(2)}.`,
  };
}
