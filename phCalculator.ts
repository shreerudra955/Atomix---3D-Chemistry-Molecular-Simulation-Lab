import { MoleculeData } from '../types/chemistry';

export type AcidBaseNature =
  | 'strong_acid'
  | 'weak_acid'
  | 'neutral'
  | 'weak_base'
  | 'strong_base'
  | 'amphoteric';

export interface MoleculePhInfo {
  phValue: number; // Numeric pH (0.0 - 14.0)
  phFormatted: string; // e.g. "7.0", "2.9", "11.1"
  classification: string; // e.g. "Strong Acid", "Weak Acid", "Neutral", "Weak Base", "Strong Base", "Amphoteric"
  condition: string; // e.g. "0.1 M aq (25 °C)", "Pure liquid (25 °C)", "Saturated aq"
  pka?: string;
  nature: AcidBaseNature;
  badgeClasses: string; // Tailwind badge classes matching universal indicator
  textColorClass: string;
  barColorHex: string;
  isEstimated: boolean;
}

interface KnownCompoundPh {
  phValue: number;
  condition: string;
  nature: AcidBaseNature;
  pka?: string;
}

const KNOWN_COMPOUNDS_PH: Record<string, KnownCompoundPh> = {
  // Strong Acids
  'hydrochloric acid': { phValue: 1.0, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-6.3' },
  'hydrogen chloride': { phValue: 1.0, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-6.3' },
  'nitric acid': { phValue: 1.0, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-1.4' },
  'sulfuric acid': { phValue: 0.9, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-3.0 / 1.99' },
  'perchloric acid': { phValue: 1.0, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-10' },
  'hydrobromic acid': { phValue: 1.0, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-9.0' },
  'hydroiodic acid': { phValue: 1.0, condition: '0.1 M aq (25 °C)', nature: 'strong_acid', pka: '-10' },

  // Moderate / Weak Acids
  'phosphoric acid': { phValue: 1.5, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '2.16 / 7.21' },
  'formic acid': { phValue: 2.4, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '3.75' },
  'methanoic acid': { phValue: 2.4, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '3.75' },
  'citric acid': { phValue: 2.1, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '3.13 / 4.76 / 6.40' },
  'oxalic acid': { phValue: 1.3, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '1.25 / 4.14' },
  'lactic acid': { phValue: 2.4, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '3.86' },
  'acetic acid': { phValue: 2.9, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '4.76' },
  'ethanoic acid': { phValue: 2.9, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '4.76' },
  'propanoic acid': { phValue: 2.9, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '4.87' },
  'benzoic acid': { phValue: 2.8, condition: 'Saturated aq (25 °C)', nature: 'weak_acid', pka: '4.20' },
  'salicylic acid': { phValue: 2.4, condition: 'Saturated aq (25 °C)', nature: 'weak_acid', pka: '2.97' },
  'aspirin': { phValue: 2.4, condition: 'Saturated aq (25 °C)', nature: 'weak_acid', pka: '3.49' },
  'acetylsalicylic acid': { phValue: 2.4, condition: 'Saturated aq (25 °C)', nature: 'weak_acid', pka: '3.49' },
  'ascorbic acid': { phValue: 2.5, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '4.10 / 11.6' },
  'ibuprofen': { phValue: 3.6, condition: 'Saturated aq (25 °C)', nature: 'weak_acid', pka: '4.91' },
  'naproxen': { phValue: 3.5, condition: 'Saturated aq (25 °C)', nature: 'weak_acid', pka: '4.15' },
  'penicillin': { phValue: 3.0, condition: '0.01 M aq (25 °C)', nature: 'weak_acid', pka: '2.75' },
  'penicillin g': { phValue: 3.0, condition: '0.01 M aq (25 °C)', nature: 'weak_acid', pka: '2.75' },
  'carbonic acid': { phValue: 3.7, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '6.35 / 10.33' },
  'boric acid': { phValue: 5.1, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '9.24' },
  'phenol': { phValue: 5.5, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '9.95' },
  'hydrogen sulfide': { phValue: 4.0, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '7.05' },
  'hydrogen fluoride': { phValue: 2.1, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '3.17' },
  'hydrofluoric acid': { phValue: 2.1, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '3.17' },
  'vitamin c': { phValue: 2.5, condition: '0.1 M aq (25 °C)', nature: 'weak_acid', pka: '4.10' },

  // Strong Bases
  'sodium hydroxide': { phValue: 13.0, condition: '0.1 M aq (25 °C)', nature: 'strong_base', pka: '14.8 (conj.)' },
  'potassium hydroxide': { phValue: 13.0, condition: '0.1 M aq (25 °C)', nature: 'strong_base', pka: '14.8 (conj.)' },
  'lithium hydroxide': { phValue: 13.0, condition: '0.1 M aq (25 °C)', nature: 'strong_base', pka: '14.4 (conj.)' },
  'calcium hydroxide': { phValue: 12.4, condition: 'Saturated aq (25 °C)', nature: 'strong_base', pka: '12.6' },
  'barium hydroxide': { phValue: 13.3, condition: '0.1 M aq (25 °C)', nature: 'strong_base', pka: '13.4' },

  // Weak Bases & Alkaloids
  'ammonia': { phValue: 11.1, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '9.25 (conj.)' },
  'methylamine': { phValue: 11.8, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '10.66 (conj.)' },
  'ethylamine': { phValue: 11.8, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '10.71 (conj.)' },
  'triethylamine': { phValue: 11.9, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '10.75 (conj.)' },
  'pyridine': { phValue: 9.1, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '5.23 (conj.)' },
  'aniline': { phValue: 8.8, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '4.60 (conj.)' },
  'nicotine': { phValue: 10.2, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '3.12 / 8.02' },
  'morphine': { phValue: 9.2, condition: 'Saturated aq (25 °C)', nature: 'weak_base', pka: '8.21' },
  'codeine': { phValue: 9.5, condition: 'Saturated aq (25 °C)', nature: 'weak_base', pka: '8.21' },
  'quinine': { phValue: 8.8, condition: 'Saturated aq (25 °C)', nature: 'weak_base', pka: '8.52' },
  'atropine': { phValue: 9.8, condition: 'Saturated aq (25 °C)', nature: 'weak_base', pka: '9.43' },
  'histamine': { phValue: 10.5, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '6.04 / 9.75' },
  'sodium bicarbonate': { phValue: 8.3, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '10.33' },
  'sodium carbonate': { phValue: 11.5, condition: '0.1 M aq (25 °C)', nature: 'weak_base', pka: '10.33' },

  // Amphoteric / Zwitterionic & Neutral Biomolecules
  'water': { phValue: 7.0, condition: 'Pure liquid (25 °C)', nature: 'neutral', pka: '14.0' },
  'urea': { phValue: 7.2, condition: '0.1 M aq (25 °C)', nature: 'neutral', pka: '0.10' },
  'sucrose': { phValue: 7.0, condition: '0.1 M aq (25 °C)', nature: 'neutral', pka: '12.6' },
  'glucose': { phValue: 7.0, condition: '0.1 M aq (25 °C)', nature: 'neutral', pka: '12.3' },
  'glycine': { phValue: 6.0, condition: 'Isoelectric aq (25 °C)', nature: 'amphoteric', pka: '2.34 / 9.60' },
  'alanine': { phValue: 6.0, condition: 'Isoelectric aq (25 °C)', nature: 'amphoteric', pka: '2.34 / 9.69' },
  'glutamic acid': { phValue: 3.2, condition: 'Isoelectric aq (25 °C)', nature: 'weak_acid', pka: '2.19 / 4.25 / 9.67' },
  'aspartic acid': { phValue: 2.8, condition: 'Isoelectric aq (25 °C)', nature: 'weak_acid', pka: '1.88 / 3.65 / 9.60' },
  'lysine': { phValue: 9.7, condition: 'Isoelectric aq (25 °C)', nature: 'weak_base', pka: '2.18 / 8.95 / 10.53' },
  'arginine': { phValue: 10.8, condition: 'Isoelectric aq (25 °C)', nature: 'weak_base', pka: '2.17 / 9.04 / 12.48' },
  'gaba': { phValue: 7.3, condition: 'Isoelectric aq (25 °C)', nature: 'amphoteric', pka: '4.23 / 10.43' },
};

function getClassificationLabel(nature: AcidBaseNature): string {
  switch (nature) {
    case 'strong_acid':
      return 'Strong Acid';
    case 'weak_acid':
      return 'Weak Acid';
    case 'neutral':
      return 'Neutral';
    case 'weak_base':
      return 'Weak Base';
    case 'strong_base':
      return 'Strong Base';
    case 'amphoteric':
      return 'Amphoteric';
  }
}

function getIndicatorStyling(ph: number, nature: AcidBaseNature): {
  badgeClasses: string;
  textColorClass: string;
  barColorHex: string;
} {
  if (nature === 'strong_acid' || ph < 3.0) {
    return {
      badgeClasses: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      textColorClass: 'text-rose-400',
      barColorHex: '#f43f5e',
    };
  }
  if (nature === 'weak_acid' || (ph >= 3.0 && ph < 6.4)) {
    return {
      badgeClasses: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      textColorClass: 'text-amber-300',
      barColorHex: '#f59e0b',
    };
  }
  if (ph >= 6.4 && ph <= 7.6) {
    return {
      badgeClasses: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      textColorClass: 'text-emerald-300',
      barColorHex: '#10b981',
    };
  }
  if (nature === 'weak_base' || (ph > 7.6 && ph <= 11.5)) {
    return {
      badgeClasses: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      textColorClass: 'text-cyan-300',
      barColorHex: '#06b6d4',
    };
  }
  return {
    badgeClasses: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    textColorClass: 'text-violet-300',
    barColorHex: '#8b5cf6',
  };
}

/**
 * Inspects a MoleculeData's explicit pH metadata, known chemical registry,
 * or 3D structural functional groups (carboxylic acid, amine, amide, phenol, mineral oxyacid)
 * to return accurate aqueous pH value and acid-base nature.
 */
export function getMoleculePhInfo(molecule: MoleculeData): MoleculePhInfo {
  // 1. Curated explicit pH metadata
  if (molecule.phValue !== undefined && molecule.acidBaseType) {
    const style = getIndicatorStyling(molecule.phValue, molecule.acidBaseType);
    return {
      phValue: molecule.phValue,
      phFormatted: molecule.phValue.toFixed(1),
      classification: getClassificationLabel(molecule.acidBaseType),
      condition: molecule.phCondition || '0.1 M aq (25 °C)',
      pka: molecule.pka,
      nature: molecule.acidBaseType,
      ...style,
      isEstimated: false,
    };
  }

  // 2. Lookup by common name / IUPAC name
  const nameKey = molecule.name.toLowerCase().trim();
  const iupacKey = (molecule.iupacName || '').toLowerCase().trim();
  const lookupHit = KNOWN_COMPOUNDS_PH[nameKey] || KNOWN_COMPOUNDS_PH[iupacKey];
  if (lookupHit) {
    const style = getIndicatorStyling(lookupHit.phValue, lookupHit.nature);
    return {
      phValue: lookupHit.phValue,
      phFormatted: lookupHit.phValue.toFixed(1),
      classification: getClassificationLabel(lookupHit.nature),
      condition: lookupHit.condition,
      pka: lookupHit.pka,
      nature: lookupHit.nature,
      ...style,
      isEstimated: false,
    };
  }

  // 3. Structural functional group analysis from 3D graph + SMILES/IUPAC
  const { atoms, bonds, canonicalSmiles = '' } = molecule;
  const atomById = new Map(atoms.map((a) => [a.id, a]));
  const neighborsOf = new Map<string, Array<{ atomId: string; element: string; order: number }>>();

  for (const a of atoms) {
    neighborsOf.set(a.id, []);
  }
  for (const b of bonds) {
    const aFrom = atomById.get(b.from);
    const aTo = atomById.get(b.to);
    if (!aFrom || !aTo) continue;
    neighborsOf.get(b.from)?.push({ atomId: b.to, element: aTo.element, order: b.order });
    neighborsOf.get(b.to)?.push({ atomId: b.from, element: aFrom.element, order: b.order });
  }

  let hasCarboxylicAcid = false;
  let hasMineralOxyacid = false;
  let hasBasicAmine = false;
  let hasAmide = false;
  let hasPhenol = false;
  let hasHydroxideSalt = false;

  // Check IUPAC / name hints
  if (
    iupacKey.endsWith('oic acid') ||
    iupacKey.includes('carboxylic acid') ||
    nameKey.endsWith(' acid')
  ) {
    hasCarboxylicAcid = true;
  }
  if (iupacKey.includes('sulfonic acid') || iupacKey.includes('phosphonic acid')) {
    hasMineralOxyacid = true;
  }
  if (nameKey.includes('hydroxide')) {
    hasHydroxideSalt = true;
  }

  // Graph traversal for functional groups
  for (const atom of atoms) {
    const nbrs = neighborsOf.get(atom.id) || [];

    // Carboxylic acid: C(=O)O where the single-bonded O does NOT bond to another C (except H)
    if (atom.element === 'C') {
      const doubleO = nbrs.find((n) => n.element === 'O' && n.order === 2);
      const singleOs = nbrs.filter((n) => n.element === 'O' && n.order === 1);
      if (doubleO && singleOs.length > 0) {
        for (const sO of singleOs) {
          const oNbrs = neighborsOf.get(sO.atomId) || [];
          const hasNonHC = oNbrs.some((on) => on.atomId !== atom.id && on.element !== 'H');
          if (!hasNonHC) {
            hasCarboxylicAcid = true;
          }
        }
      }
      // Amide: C(=O)-N
      const singleN = nbrs.find((n) => n.element === 'N' && n.order === 1);
      if (doubleO && singleN) {
        hasAmide = true;
      }
    }

    // Mineral oxyacid: S or P with =O and -OH
    if (atom.element === 'S' || atom.element === 'P') {
      const doubleO = nbrs.some((n) => n.element === 'O' && n.order === 2);
      const singleOs = nbrs.filter((n) => n.element === 'O' && n.order === 1);
      const hasOH = singleOs.some((sO) => {
        const oNbrs = neighborsOf.get(sO.atomId) || [];
        return !oNbrs.some((on) => on.atomId !== atom.id && on.element !== 'H');
      });
      if (doubleO && hasOH) {
        hasMineralOxyacid = true;
      }
    }

    // Phenolic OH: O bonded to H (or terminal) and an aromatic/sp2 C (neighbor count <= 3 on C or has double/aromatic bond)
    if (atom.element === 'O') {
      const nonHNbrs = nbrs.filter((n) => n.element !== 'H');
      if (nonHNbrs.length === 1 && nonHNbrs[0].element === 'C') {
        const cNbrs = neighborsOf.get(nonHNbrs[0].atomId) || [];
        const isSp2Carbon = cNbrs.some((cn) => cn.order === 2) || cNbrs.length <= 3;
        const hasDoubleO = cNbrs.some((cn) => cn.element === 'O' && cn.order === 2);
        if (isSp2Carbon && !hasDoubleO && canonicalSmiles.includes('c')) {
          hasPhenol = true;
        }
      }
    }

    // Basic Amine: N without double/triple bond to O/N, not bonded to C(=O), and formalCharge <= 0
    if (atom.element === 'N' && (atom.formalCharge || 0) <= 0) {
      const hasOxo = nbrs.some((n) => n.element === 'O');
      const bondedToCarbonyl = nbrs.some((n) => {
        if (n.element !== 'C') return false;
        const cNbrs = neighborsOf.get(n.atomId) || [];
        return cNbrs.some((cn) => cn.element === 'O' && cn.order === 2);
      });
      const isNitrile = nbrs.some((n) => n.element === 'C' && n.order === 3);
      if (!hasOxo && !bondedToCarbonyl && !isNitrile && nbrs.length <= 3) {
        hasBasicAmine = true;
      }
    }
  }

  let phValue = 7.0;
  let nature: AcidBaseNature = 'neutral';
  let condition = 'Est. 0.1 M aq (25 °C)';
  let pka: string | undefined;

  if (hasHydroxideSalt) {
    phValue = 13.0;
    nature = 'strong_base';
  } else if (hasMineralOxyacid) {
    phValue = 1.5;
    nature = 'strong_acid';
    pka = '< 2.0 (est.)';
  } else if (hasCarboxylicAcid && hasBasicAmine) {
    // Amino acid / Zwitterionic compound
    phValue = 6.2;
    nature = 'amphoteric';
    condition = 'Est. Isoelectric aq (25 °C)';
    pka = '~2.3 / ~9.5 (est.)';
  } else if (hasCarboxylicAcid) {
    phValue = 2.9;
    nature = 'weak_acid';
    pka = '~4.5 (est.)';
  } else if (hasPhenol && !hasBasicAmine) {
    phValue = 5.6;
    nature = 'weak_acid';
    pka = '~9.9 (est.)';
  } else if (hasBasicAmine) {
    phValue = 10.3;
    nature = 'weak_base';
    pka = '~9.5 conj. (est.)';
  } else if (hasAmide) {
    phValue = 7.0;
    nature = 'neutral';
  } else {
    const hasOnlyCH = atoms.every((a) => a.element === 'C' || a.element === 'H');
    phValue = 7.0;
    nature = 'neutral';
    condition = hasOnlyCH ? 'Neutral / Non-ionizable' : 'Est. Neutral aq (25 °C)';
  }

  const style = getIndicatorStyling(phValue, nature);
  return {
    phValue,
    phFormatted: phValue.toFixed(1),
    classification: getClassificationLabel(nature),
    condition,
    pka,
    nature,
    ...style,
    isEstimated: true,
  };
}
