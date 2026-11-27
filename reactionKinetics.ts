import { ChemicalReaction } from '../types/chemistry';

export type KineticOrderMode = 'auto' | 'zero' | 'first' | 'second';

export interface SpeciesKineticSeries {
  id: string;
  formula: string;
  name: string;
  role: 'reactant' | 'product';
  stoichCoeff: number;
  initialConcM: number;
  color: string;
  valuesM: number[]; // Sampled at timePointsSec
}

export interface KineticSimulationResult {
  timePointsSec: number[];
  tMaxSec: number;
  extentValues: number[]; // Normalized conversion extent xi(t) in [0, 1]
  ratesMPerSec: number[]; // Instantaneous reaction rate r(t) = d(xi)/dt
  species: SpeciesKineticSeries[];
  effectiveOrder: 'zero' | 'first' | 'second';
  rateLawLabel: string;
  rateConstantValue: number;
  rateConstantUnit: string;
  effectiveEaKj: number;
  arrheniusMultiplier: number;
  halfLifeSec: number | null;
  isReversible: boolean;
  equilibriumExtent: number;
}

const REACTANT_COLORS = ['#fb7185', '#f59e0b', '#fb923c', '#f472b6'];
const PRODUCT_COLORS = ['#22d3ee', '#34d399', '#a78bfa', '#38bdf8'];

/**
 * Determines natural kinetic order from reaction metadata when mode is 'auto'.
 */
export function resolveEffectiveOrder(
  reaction: ChemicalReaction,
  mode: KineticOrderMode
): 'zero' | 'first' | 'second' {
  if (mode !== 'auto') return mode;

  if (
    reaction.type === 'nuclear_fission' ||
    reaction.type === 'nuclear_fusion' ||
    reaction.reactants.length === 1
  ) {
    return 'first';
  }
  if (reaction.id === 'water_electrolysis' || reaction.id === 'photosynthesis') {
    return 'zero';
  }
  return 'second';
}

/**
 * Computes temperature-dependent equilibrium extent (0..1) for reversible (⇌) reactions,
 * honoring Le Chatelier's principle via van 't Hoff enthalpy shift.
 */
function computeEquilibriumExtent(reaction: ChemicalReaction, temperatureK: number): {
  isReversible: boolean;
  eqExtent: number;
} {
  const isReversible = reaction.equation.includes('⇌');
  if (!isReversible) {
    return { isReversible: false, eqExtent: 1.0 };
  }

  // Base equilibrium extent around 298 K, shifted smoothly with temperature based on ΔH sign
  const deltaH = reaction.enthalpyDeltaH;
  const tempRatio = (temperatureK - 298.15) / 400; // dimensionless shift
  // Exothermic (ΔH < 0): higher T lowers equilibrium conversion; Endothermic: higher T raises it
  const shift = deltaH < 0 ? -0.14 * tempRatio : 0.14 * tempRatio;
  const baseEq = reaction.id === 'fischer_esterification' ? 0.67 : 0.78;
  const eqExtent = Math.min(0.92, Math.max(0.42, baseEq + shift));
  return { isReversible: true, eqExtent: Number(eqExtent.toFixed(3)) };
}

/**
 * Simulates real-time concentration vs time trajectories [R_i](t) and [P_j](t)
 * over t ∈ [0, 20 s] using 4th-order Runge-Kutta (RK4) integration.
 */
export function simulateReactionKinetics(
  reaction: ChemicalReaction,
  temperatureK: number = 298,
  hasCatalyst: boolean = false,
  orderMode: KineticOrderMode = 'auto'
): KineticSimulationResult {
  const tMaxSec = 20;
  const numSamples = 101; // every 0.2 s
  const dtSample = tMaxSec / (numSamples - 1);
  const subSteps = 4;
  const dt = dtSample / subSteps;

  const effectiveOrder = resolveEffectiveOrder(reaction, orderMode);
  const isNuclear =
    reaction.type === 'nuclear_fission' || reaction.type === 'nuclear_fusion';

  const rawEa = Math.max(reaction.activationEnergyEa, 5);
  const effectiveEaKj = Number((hasCatalyst && !isNuclear ? rawEa * 0.65 : rawEa).toFixed(1));

  // Calibrated Arrhenius scaling factor relative to 298.15 K
  let arrheniusMultiplier = 1.0;
  if (isNuclear) {
    // Nuclear cross-section/flux sensitivity to plasma/core temperature
    arrheniusMultiplier = hasCatalyst
      ? 1.35 * (0.7 + 0.3 * (temperatureK / 298.15))
      : 0.7 + 0.3 * (temperatureK / 298.15);
  } else {
    const cappedEa = Math.min(effectiveEaKj, 140);
    const R = 8.31446e-3; // kJ/(mol·K)
    const invDelta = 1 / 298.15 - 1 / Math.max(temperatureK, 150);
    // Compressed exponent for interactive 0-20s laboratory visualization
    const exponent = (cappedEa / R) * 0.085 * invDelta;
    const catalystBoost = hasCatalyst ? 1.55 : 1.0;
    arrheniusMultiplier = catalystBoost * Math.exp(Math.max(-2.5, Math.min(2.5, exponent)));
  }
  arrheniusMultiplier = Number(Math.min(4.2, Math.max(0.22, arrheniusMultiplier)).toFixed(2));

  const { isReversible, eqExtent } = computeEquilibriumExtent(reaction, temperatureK);

  // Calibrate base rate constant so standard 298 K conversion approaches completion in ~14-18s
  const baseK =
    effectiveOrder === 'zero'
      ? 0.075
      : effectiveOrder === 'first'
      ? 0.22
      : 0.38;
  const kFwd = baseK * arrheniusMultiplier;

  // For reversible reactions, match reverse rate constant kRev so steady-state matches eqExtent
  const getRate = (alpha: number): number => {
    const clamped = Math.max(0, Math.min(1, alpha));
    if (effectiveOrder === 'zero') {
      if (clamped >= eqExtent) return 0;
      const tailTapering = clamped > eqExtent - 0.02 ? (eqExtent - clamped) / 0.02 : 1;
      return kFwd * tailTapering;
    }
    if (effectiveOrder === 'first') {
      if (!isReversible) {
        return kFwd * Math.max(0, 1 - clamped);
      }
      const kRev = kFwd * ((1 - eqExtent) / eqExtent);
      return Math.max(0, kFwd * (1 - clamped) - kRev * clamped);
    }
    // Second-order
    if (!isReversible) {
      return kFwd * Math.pow(Math.max(0, 1 - clamped), 2);
    }
    const kRev = kFwd * Math.pow((1 - eqExtent) / eqExtent, 2);
    return Math.max(0, kFwd * Math.pow(1 - clamped, 2) - kRev * Math.pow(clamped, 2));
  };

  const timePointsSec: number[] = [];
  const extentValues: number[] = [];
  const ratesMPerSec: number[] = [];

  let alpha = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = Number((i * dtSample).toFixed(2));
    timePointsSec.push(t);
    extentValues.push(Number(alpha.toFixed(4)));
    ratesMPerSec.push(Number(getRate(alpha).toFixed(4)));

    if (i < numSamples - 1) {
      for (let s = 0; s < subSteps; s++) {
        const k1 = getRate(alpha);
        const k2 = getRate(alpha + 0.5 * dt * k1);
        const k3 = getRate(alpha + 0.5 * dt * k2);
        const k4 = getRate(alpha + dt * k3);
        alpha = Math.min(eqExtent, Math.max(0, alpha + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4)));
      }
    }
  }

  // Build stoichiometric concentration arrays for every reactant & product
  const species: SpeciesKineticSeries[] = [];

  reaction.reactants.forEach((r, idx) => {
    const initM = r.count;
    species.push({
      id: `r_${idx}_${r.formula}`,
      formula: r.formula,
      name: r.name,
      role: 'reactant',
      stoichCoeff: r.count,
      initialConcM: initM,
      color: REACTANT_COLORS[idx % REACTANT_COLORS.length],
      valuesM: extentValues.map((xi) => Number((initM * Math.max(0, 1 - xi)).toFixed(3))),
    });
  });

  reaction.products.forEach((p, idx) => {
    species.push({
      id: `p_${idx}_${p.formula}`,
      formula: p.formula,
      name: p.name,
      role: 'product',
      stoichCoeff: p.count,
      initialConcM: 0,
      color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length],
      valuesM: extentValues.map((xi) => Number((p.count * xi).toFixed(3))),
    });
  });

  // Compute exact half-life t_{1/2} (time when extent reaches 50% of equilibrium conversion)
  const targetHalfExtent = eqExtent * 0.5;
  let halfLifeSec: number | null = null;
  for (let i = 1; i < extentValues.length; i++) {
    if (extentValues[i] >= targetHalfExtent) {
      const prev = extentValues[i - 1];
      const curr = extentValues[i];
      const frac = curr > prev ? (targetHalfExtent - prev) / (curr - prev) : 0;
      halfLifeSec = Number((timePointsSec[i - 1] + frac * dtSample).toFixed(2));
      break;
    }
  }

  const rateConstantUnit =
    effectiveOrder === 'zero'
      ? 'M·s⁻¹'
      : effectiveOrder === 'first'
      ? 's⁻¹'
      : 'M⁻¹·s⁻¹';

  const primaryReactant = reaction.reactants[0]?.formula || 'R';
  const rateLawLabel =
    effectiveOrder === 'zero'
      ? `Rate = k`
      : effectiveOrder === 'first'
      ? `Rate = k[${primaryReactant}]`
      : `Rate = k[${primaryReactant}]²`;

  return {
    timePointsSec,
    tMaxSec,
    extentValues,
    ratesMPerSec,
    species,
    effectiveOrder,
    rateLawLabel,
    rateConstantValue: Number(kFwd.toFixed(3)),
    rateConstantUnit,
    effectiveEaKj,
    arrheniusMultiplier,
    halfLifeSec,
    isReversible,
    equilibriumExtent: eqExtent,
  };
}

/**
 * Linearly interpolates concentration and rate values at any continuous progress in [0, 1].
 */
export function sampleKineticsAtProgress(
  sim: KineticSimulationResult,
  progress: number
): {
  timeSec: number;
  rateMPerSec: number;
  extent: number;
  concentrations: Array<{
    id: string;
    formula: string;
    name: string;
    role: 'reactant' | 'product';
    stoichCoeff: number;
    color: string;
    concM: number;
    rateMPerSec: number;
  }>;
} {
  const clamped = Math.max(0, Math.min(1, progress));
  const exactIdx = clamped * (sim.timePointsSec.length - 1);
  const idx0 = Math.floor(exactIdx);
  const idx1 = Math.min(sim.timePointsSec.length - 1, idx0 + 1);
  const frac = exactIdx - idx0;

  const lerp = (a: number, b: number) => a + (b - a) * frac;
  const timeSec = Number(lerp(sim.timePointsSec[idx0], sim.timePointsSec[idx1]).toFixed(2));
  const rateMPerSec = Number(lerp(sim.ratesMPerSec[idx0], sim.ratesMPerSec[idx1]).toFixed(4));
  const extent = Number(lerp(sim.extentValues[idx0], sim.extentValues[idx1]).toFixed(4));

  const concentrations = sim.species.map((sp) => {
    const concM = Number(lerp(sp.valuesM[idx0], sp.valuesM[idx1]).toFixed(3));
    const signedRate =
      sp.role === 'reactant'
        ? -sp.stoichCoeff * rateMPerSec
        : sp.stoichCoeff * rateMPerSec;
    return {
      id: sp.id,
      formula: sp.formula,
      name: sp.name,
      role: sp.role,
      stoichCoeff: sp.stoichCoeff,
      color: sp.color,
      concM,
      rateMPerSec: Number(signedRate.toFixed(3)),
    };
  });

  return {
    timeSec,
    rateMPerSec,
    extent,
    concentrations,
  };
}

/**
 * Zero-allocation O(1) extent and rate sampler for 60fps Three.js animation loops.
 */
export function sampleExtentAndRateAtProgress(
  sim: KineticSimulationResult,
  progress: number
): { extent: number; rateMPerSec: number } {
  const clamped = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  const maxIdx = sim.extentValues.length - 1;
  const exactIdx = clamped * maxIdx;
  const idx0 = exactIdx | 0;
  const idx1 = idx0 < maxIdx ? idx0 + 1 : maxIdx;
  const frac = exactIdx - idx0;

  const e0 = sim.extentValues[idx0];
  const e1 = sim.extentValues[idx1];
  const r0 = sim.ratesMPerSec[idx0];
  const r1 = sim.ratesMPerSec[idx1];

  return {
    extent: e0 + (e1 - e0) * frac,
    rateMPerSec: r0 + (r1 - r0) * frac,
  };
}
