import React, { useMemo } from 'react';
import { MolecularBond, MolecularAtom } from '../types/chemistry';
import { BondPhysicsData, generateMorsePotentialCurve, calculateMorsePotential } from '../utils/bondPhysics';
import { getElement } from '../data/elements';
import {
  Zap,
  Activity,
  Flame,
  Waves,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Gauge,
  Sparkles,
  Info,
} from 'lucide-react';

interface BondStrengthIndicatorProps {
  bond: MolecularBond;
  allBonds: MolecularBond[];
  atoms: MolecularAtom[];
  bondPhysics: BondPhysicsData;
  instantaneousLength: number; // Ångströms (live from 3D scene)
  temperatureK: number;
  onSelectBondIndex: (index: number) => void;
  onClose: () => void;
}

export const BondStrengthIndicator: React.FC<BondStrengthIndicatorProps> = ({
  bond,
  allBonds,
  atoms,
  bondPhysics,
  instantaneousLength,
  temperatureK,
  onSelectBondIndex,
  onClose,
}) => {
  const atomA = atoms.find((a) => a.id === bond.from);
  const atomB = atoms.find((a) => a.id === bond.to);

  const elA = atomA ? getElement(atomA.element) : undefined;
  const elB = atomB ? getElement(atomB.element) : undefined;

  const rawBondIndex = allBonds.findIndex((b) => b.id === bond.id);
  const currentBondIndex = rawBondIndex >= 0 ? rawBondIndex : 0;

  // Live displacement and strain
  const r0 = bondPhysics.equilibriumLengthAngstrom || 1.0;
  const liveR = instantaneousLength > 0 && Number.isFinite(instantaneousLength) ? instantaneousLength : r0;
  const dr = Number((liveR - r0).toFixed(4));
  const strainPercent = r0 > 0 ? Number(((dr / r0) * 100).toFixed(2)) : 0;
  const livePm = Math.round(liveR * 100);
  const r0Pm = Math.round(r0 * 100);

  // Thermal energy RT in kJ/mol (R = 8.314e-3 kJ/(mol·K))
  const thermalEnergyKj = Number((8.314462618e-3 * Math.max(temperatureK, 0)).toFixed(2));
  const thermalRatio = bondPhysics.bondEnergyKj > 0
    ? Number(((thermalEnergyKj / bondPhysics.bondEnergyKj) * 100).toFixed(2))
    : 0;

  // Instantaneous potential energy in Morse well
  const currentMorsePotentialKj = Number(
    calculateMorsePotential(liveR, r0, bondPhysics.bondEnergyKj, bondPhysics.morseParameterA).toFixed(2)
  );

  // Generate Morse curve points for SVG
  const curvePoints = useMemo(() => {
    return generateMorsePotentialCurve(
      r0,
      bondPhysics.bondEnergyKj,
      bondPhysics.morseParameterA,
      50
    );
  }, [r0, bondPhysics.bondEnergyKj, bondPhysics.morseParameterA]);

  // SVG coordinate transformation
  const svgWidth = 260;
  const svgHeight = 110;
  const padding = { top: 12, right: 14, bottom: 22, left: 32 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  const minR = Math.max(0.4, r0 - 0.55);
  const maxR = r0 + 1.25;
  const maxEnergy = Math.max(bondPhysics.bondEnergyKj * 1.25, 50);

  const getSvgX = (r: number) => {
    const range = maxR - minR;
    if (range <= 0) return padding.left;
    const clamped = Math.max(minR, Math.min(maxR, r));
    return padding.left + ((clamped - minR) / range) * plotW;
  };

  const getSvgY = (energy: number) => {
    if (maxEnergy <= 0) return padding.top + plotH;
    const clamped = Math.max(0, Math.min(maxEnergy, energy));
    return padding.top + plotH - (clamped / maxEnergy) * plotH;
  };

  const pathD = useMemo(() => {
    return curvePoints.reduce((acc, pt, i) => {
      const x = getSvgX(pt.r);
      const y = getSvgY(pt.energyKj);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [curvePoints, minR, maxR, maxEnergy]);

  const liveDotX = getSvgX(liveR);
  const liveDotY = getSvgY(currentMorsePotentialKj);
  const eqDotX = getSvgX(r0);
  const eqDotY = getSvgY(0);

  // Energy percentage on a 0-1100 kJ/mol scale
  const energyMeterPercent = Math.min(Math.round((bondPhysics.bondEnergyKj / 1050) * 100), 100);

  return (
    <div className="backdrop-blur-xl bg-slate-900/95 border border-sky-500/30 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex flex-col gap-2.5 max-w-sm w-full animate-in fade-in zoom-in-95 pointer-events-auto">
      {/* Header with Bond Title and Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Bond Strength Inspector</span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded font-semibold text-white shadow-sm"
                style={{ backgroundColor: bondPhysics.categoryColor }}
              >
                {bondPhysics.strengthCategory}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              Bond #{currentBondIndex + 1} of {allBonds.length} • {bond.order === 3 ? 'Triple' : bond.order === 2 ? 'Double' : 'Single'} Covalent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {allBonds.length > 1 && (
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
              <button
                onClick={() => {
                  const prev = (currentBondIndex - 1 + allBonds.length) % allBonds.length;
                  onSelectBondIndex(prev);
                }}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                title="Previous Bond"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = (currentBondIndex + 1) % allBonds.length;
                  onSelectBondIndex(next);
                }}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                title="Next Bond"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Deselect Bond"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Atom Pair Identification Display */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border border-white/20 text-slate-900"
            style={{ backgroundColor: elA?.cpkColor || '#ccc' }}
            title={`${elA?.name || bond.from} (χ = ${bondPhysics.electronegativityA})`}
          >
            {atomA?.element || '?'}
          </div>
          <div className="text-left">
            <span className="text-xs font-semibold text-slate-200 block">
              {elA?.name || bond.from} ({atomA?.id})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">χ = {bondPhysics.electronegativityA}</span>
          </div>
        </div>

        {/* Bond order symbol */}
        <div className="flex flex-col items-center px-2">
          <span className="text-base font-black font-mono text-sky-400 tracking-widest">
            {bond.order === 3 ? '≡' : bond.order === 2 ? '=' : '—'}
          </span>
          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
            {bond.order === 3 ? '3σ/π' : bond.order === 2 ? 'σ + π' : 'σ-bond'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-200 block">
              {elB?.name || bond.to} ({atomB?.id})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">χ = {bondPhysics.electronegativityB}</span>
          </div>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border border-white/20 text-slate-900"
            style={{ backgroundColor: elB?.cpkColor || '#ccc' }}
            title={`${elB?.name || bond.to} (χ = ${bondPhysics.electronegativityB})`}
          >
            {atomB?.element || '?'}
          </div>
        </div>
      </div>

      {/* Primary Metrics: Dissociation Energy & Real-time Length */}
      <div className="grid grid-cols-2 gap-2">
        {/* Bond Energy Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              Bond Energy (BDE)
            </span>
          </div>
          <div className="my-1">
            <div className="text-lg font-extrabold text-white font-mono flex items-baseline gap-1">
              <span>{bondPhysics.bondEnergyKj}</span>
              <span className="text-xs font-medium text-slate-400">kJ/mol</span>
            </div>
            <div className="text-[11px] font-mono text-amber-400 font-semibold">
              {bondPhysics.bondEnergyKcal} <span className="text-[10px] text-slate-400 font-normal">kcal/mol</span>
            </div>
          </div>
          {/* Energy Meter Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${energyMeterPercent}%`,
                backgroundColor: bondPhysics.categoryColor,
              }}
            />
          </div>
        </div>

        {/* Real-time Dynamic Bond Length Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              Live Bond Length
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Live r(t)
            </span>
          </div>
          <div className="my-1">
            <div className="text-lg font-extrabold text-white font-mono flex items-baseline gap-1">
              <span>{liveR.toFixed(3)}</span>
              <span className="text-xs font-medium text-slate-400">Å</span>
            </div>
            <div className="text-[11px] font-mono text-cyan-300">
              {livePm} pm <span className="text-[10px] text-slate-500 font-normal">(r₀: {r0} Å / {r0Pm} pm)</span>
            </div>
          </div>
          {/* Dynamic Strain status */}
          <div className="text-[10px] font-mono flex items-center justify-between mt-1 pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">Δr:</span>
            <span
              className={`font-semibold ${
                Math.abs(dr) < 0.005
                  ? 'text-slate-400'
                  : dr > 0
                  ? 'text-rose-400'
                  : 'text-sky-400'
              }`}
            >
              {dr >= 0 ? `+${dr.toFixed(3)}` : dr.toFixed(3)} Å ({strainPercent > 0 ? `+${strainPercent}` : strainPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* Morse Potential Well Interactive Graph */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-sky-300 flex items-center gap-1">
            <Waves className="w-3 h-3 text-sky-400" />
            Morse Potential Well V(r) & Real-time Oscillation
          </span>
          <span className="text-[9px] text-slate-400 font-mono">
            V(r) = {currentMorsePotentialKj} kJ/mol
          </span>
        </div>

        <div className="relative w-full flex justify-center bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 py-1">
          <svg width={svgWidth} height={svgHeight} className="overflow-visible">
            <defs>
              <linearGradient id="morseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Equilibrium line r0 */}
            <line
              x1={eqDotX}
              y1={padding.top}
              x2={eqDotX}
              y2={padding.top + plotH}
              stroke="#64748b"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
            <text x={eqDotX} y={svgHeight - 4} fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">
              r₀={r0}Å
            </text>

            {/* Dissociation Limit De line */}
            <line
              x1={padding.left}
              y1={getSvgY(bondPhysics.bondEnergyKj)}
              x2={padding.left + plotW}
              y2={getSvgY(bondPhysics.bondEnergyKj)}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth="1"
              strokeOpacity="0.6"
            />
            <text
              x={padding.left + plotW - 2}
              y={getSvgY(bondPhysics.bondEnergyKj) - 3}
              fill="#fbbf24"
              fontSize="7"
              textAnchor="end"
              fontFamily="monospace"
            >
              De={bondPhysics.bondEnergyKj}
            </text>

            {/* Y axis text */}
            <text x={padding.left - 4} y={padding.top + 8} fill="#64748b" fontSize="7" textAnchor="end" fontFamily="monospace">
              V (kJ)
            </text>
            <text x={padding.left - 4} y={padding.top + plotH} fill="#64748b" fontSize="7" textAnchor="end" fontFamily="monospace">
              0
            </text>

            {/* Morse curve path */}
            <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />

            {/* Live oscillating dot */}
            <circle
              cx={liveDotX}
              cy={liveDotY}
              r="4.5"
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="1.5"
              className="drop-shadow"
            />
            {/* Live ripple pulse */}
            <circle
              cx={liveDotX}
              cy={liveDotY}
              r="7.5"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1"
              opacity="0.6"
            />
          </svg>
        </div>
      </div>

      {/* Polarity, Electronegativity & Ionic Character */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            Electronic Character & Polarity
          </span>
          <span className="text-[10px] font-mono text-emerald-300 font-semibold">
            {bondPhysics.polarityType}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span>Δχ = |{bondPhysics.electronegativityA} − {bondPhysics.electronegativityB}| = {bondPhysics.deltaElectronegativity}</span>
          <span>{bondPhysics.percentIonicCharacter}% Ionic Character</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-500 rounded-full"
            style={{ width: `${Math.max(bondPhysics.percentIonicCharacter, 4)}%` }}
          />
        </div>
      </div>

      {/* Thermochemical & Infrared Details */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2 text-[10px] text-slate-400 flex flex-col gap-1">
        <div className="flex items-center justify-between font-mono">
          <span>IR Stretch Wavenumber:</span>
          <span className="text-sky-300 font-semibold">{bondPhysics.irWavenumberCm1} cm⁻¹</span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span>Thermal Agitation (RT @ {temperatureK}K):</span>
          <span className="text-amber-300 font-semibold">{thermalEnergyKj} kJ/mol ({thermalRatio}% of BDE)</span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span>Thermal Rupture Risk:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Stable (&lt;0.01% dissociation probability)
          </span>
        </div>
      </div>

      {/* Scientific Note */}
      <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
        <span className="font-semibold text-slate-300 mr-1">Chemical Note:</span>
        {bondPhysics.description}
      </p>
    </div>
  );
};
    
