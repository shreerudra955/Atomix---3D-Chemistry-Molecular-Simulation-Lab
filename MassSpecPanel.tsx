import React, { useMemo, useState, useRef } from 'react';
import { MoleculeData } from '../types/chemistry';
import {
  calculateMassSpectrum,
  MsIonizationMode,
  MsPeak,
} from '../utils/massSpectrometry';
import { BarChart3, Info, MousePointerClick } from 'lucide-react';

interface MassSpecPanelProps {
  molecule: MoleculeData;
}

const SVG_WIDTH = 720;
const SVG_HEIGHT = 230;
const PAD_LEFT = 46;
const PAD_RIGHT = 18;
const PAD_TOP = 24;
const PAD_BOTTOM = 34;

const PLOT_W = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

export const MassSpecPanel: React.FC<MassSpecPanelProps> = ({ molecule }) => {
  const [mode, setMode] = useState<MsIonizationMode>('ei');
  const [chargeZ, setChargeZ] = useState<1 | 2>(1);
  const [selectedPeakId, setSelectedPeakId] = useState<string | null>(null);
  const [hoveredPeak, setHoveredPeak] = useState<MsPeak | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const ms = useMemo(
    () => calculateMassSpectrum(molecule, mode, chargeZ),
    [molecule, mode, chargeZ]
  );

  const activePeak: MsPeak | null = useMemo(() => {
    if (ms.peaks.length === 0) return null;
    if (selectedPeakId) {
      const found = ms.peaks.find((p) => p.id === selectedPeakId);
      if (found) return found;
    }
    return (
      ms.peaks.find((p) => p.category === 'molecular') ||
      ms.peaks.reduce((best, p) => (p.relativeIntensity > best.relativeIntensity ? p : best), ms.peaks[0])
    );
  }, [ms.peaks, selectedPeakId]);

  const mzToX = (mz: number): number => {
    const span = Math.max(ms.maxMz - ms.minMz, 10);
    const ratio = Math.min(Math.max((mz - ms.minMz) / span, 0), 1);
    return PAD_LEFT + ratio * PLOT_W;
  };

  const intensityToY = (relInt: number): number => {
    const ratio = Math.min(Math.max(relInt / 100, 0), 1);
    return PAD_TOP + (1 - ratio) * PLOT_H;
  };

  // Compute clean X-axis tick spacing
  const mzTicks = useMemo(() => {
    const span = ms.maxMz;
    const step = span <= 60 ? 10 : span <= 150 ? 20 : span <= 300 ? 50 : 100;
    const ticks: number[] = [];
    for (let v = 0; v <= span; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [ms.maxMz]);

  const yTicks = [100, 75, 50, 25, 0];

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || ms.peaks.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;
    if (localX < PAD_LEFT || localX > SVG_WIDTH - PAD_RIGHT) {
      setHoveredPeak(null);
      return;
    }

    // Snap to closest peak within 16px SVG units
    let closest: MsPeak | null = null;
    let minDist = 16;
    for (const p of ms.peaks) {
      const dist = Math.abs(mzToX(p.mz) - localX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    setHoveredPeak(closest);
  };

  const getStickColor = (peak: MsPeak, isSelected: boolean): string => {
    if (isSelected) return '#fbbf24';
    if (peak.category === 'molecular') return '#f59e0b';
    if (peak.category === 'isotope') return '#38bdf8';
    return '#a78bfa';
  };

  return (
    <div className="flex flex-col gap-3 text-slate-200">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-violet-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
              Theoretical Mass Spectrum (m/z) — {molecule.name} ({ms.cleanFormula})
            </h3>
            <p className="text-[11px] text-slate-400 truncate font-mono tabular-nums">
              Monoisotopic: {ms.monoisotopicMass.toFixed(4)} Da · Base Peak: m/z {ms.basePeakMz.toFixed(2)}
              {ms.dbe !== null ? ` · DBE: ${ms.dbe}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Charge State z selector */}
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setChargeZ(1)}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-colors ${
                chargeZ === 1
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Singly charged ions (z = +1)"
            >
              z=+1
            </button>
            <button
              onClick={() => setChargeZ(2)}
              className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-colors ${
                chargeZ === 2
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Doubly charged ions (z = +2, halves m/z)"
            >
              z=+2
            </button>
          </div>

          {/* Ionization Mode Selector */}
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setMode('ei')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                mode === 'ei'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="70 eV Electron Ionization: [M]+• + Fragmentation"
            >
              EI (70 eV)
            </button>
            <button
              onClick={() => setMode('esi')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                mode === 'esi'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Soft Electrospray Ionization: [M+H]+ & Isotope Envelope"
            >
              ESI+
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Stick Spectrum SVG + Peak Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left: Interactive m/z Stick Plot */}
        <div className="lg:col-span-8 bg-slate-950/90 border border-slate-800/90 rounded-xl p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums px-1.5 pb-1 text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Molecular Ion
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                Isotopes
              </span>
              {mode === 'ei' && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                  Fragments
                </span>
              )}
            </div>
            {hoveredPeak ? (
              <span className="text-violet-300 font-semibold">
                m/z {hoveredPeak.mz.toFixed(3)} · {hoveredPeak.relativeIntensity}% · {hoveredPeak.ionFormula}
              </span>
            ) : (
              <span className="text-slate-500 hidden sm:inline">Hover or click any stick to inspect m/z ion</span>
            )}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto max-h-[210px] select-none cursor-crosshair overflow-visible"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHoveredPeak(null)}
            onClick={() => {
              if (hoveredPeak) setSelectedPeakId(hoveredPeak.id);
            }}
          >
            {/* Horizontal Y-Gridlines */}
            {yTicks.map((val) => {
              const y = intensityToY(val);
              return (
                <g key={val}>
                  <line
                    x1={PAD_LEFT}
                    y1={y}
                    x2={SVG_WIDTH - PAD_RIGHT}
                    y2={y}
                    stroke="#1e293b"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_LEFT - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Vertical m/z Gridlines */}
            {mzTicks.map((mzVal) => {
              const x = mzToX(mzVal);
              return (
                <g key={mzVal}>
                  <line
                    x1={x}
                    y1={PAD_TOP}
                    x2={x}
                    y2={PAD_TOP + PLOT_H}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={PAD_TOP + PLOT_H + 14}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {mzVal}
                  </text>
                </g>
              );
            })}

            {/* Frame */}
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={PLOT_W}
              height={PLOT_H}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Axis Titles */}
            <text
              x={PAD_LEFT + PLOT_W / 2}
              y={SVG_HEIGHT - 4}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              fontFamily="sans-serif"
            >
              Mass-to-Charge Ratio (m/z)
            </text>
            <text
              x={13}
              y={PAD_TOP + PLOT_H / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              transform={`rotate(-90 13 ${PAD_TOP + PLOT_H / 2})`}
            >
              Rel. Intensity (%)
            </text>

            {/* Spectrum Stick Peaks */}
            {ms.peaks.map((peak) => {
              const x = mzToX(peak.mz);
              const yTop = intensityToY(peak.relativeIntensity);
              const yBase = PAD_TOP + PLOT_H;
              const isSelected = activePeak?.id === peak.id;
              const isHovered = hoveredPeak?.id === peak.id;
              const color = getStickColor(peak, isSelected || isHovered);

              return (
                <g
                  key={peak.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPeakId(peak.id);
                  }}
                >
                  {/* Invisible wider click hitbox */}
                  <line
                    x1={x}
                    y1={PAD_TOP}
                    x2={x}
                    y2={yBase}
                    stroke="transparent"
                    strokeWidth="10"
                  />
                  {/* Vertical MS stick */}
                  <line
                    x1={x}
                    y1={yBase}
                    x2={x}
                    y2={yTop}
                    stroke={color}
                    strokeWidth={isSelected || isHovered ? 3.2 : 2.1}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={x}
                    cy={yTop}
                    r={isSelected || isHovered ? 3.5 : 2}
                    fill={color}
                  />
                  {/* Label prominent peaks or selected peak */}
                  {(isSelected || isHovered || peak.relativeIntensity >= 22 || peak.category === 'molecular') && (
                    <text
                      x={x}
                      y={Math.max(yTop - 7, PAD_TOP + 10)}
                      textAnchor="middle"
                      fill={isSelected || isHovered ? '#fbbf24' : '#cbd5e1'}
                      fontSize={isSelected || isHovered ? '10' : '8.5'}
                      fontWeight={isSelected || isHovered ? '700' : '500'}
                      fontFamily="monospace"
                    >
                      {peak.mz.toFixed(1)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: Ion Assignment Table & Nitrogen Rule / Exact Mass Card */}
        <div className="lg:col-span-4 flex flex-col gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl p-2.5 justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/80 pb-1">
              <span>m/z Peaks ({ms.peaks.length})</span>
              <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3 text-violet-400" />
                Select ion
              </span>
            </div>

            <div className="max-h-[120px] overflow-y-auto divide-y divide-slate-800/60 pr-1">
              {ms.peaks.map((peak) => {
                const isSel = activePeak?.id === peak.id;
                return (
                  <button
                    key={peak.id}
                    onClick={() => setSelectedPeakId(peak.id)}
                    className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between gap-2 text-[11px] ${
                      isSel
                        ? 'bg-violet-500/15 text-white'
                        : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          isSel
                            ? 'text-amber-300'
                            : peak.category === 'molecular'
                            ? 'text-amber-400'
                            : peak.category === 'isotope'
                            ? 'text-sky-300'
                            : 'text-violet-300'
                        }`}
                      >
                        {peak.mz.toFixed(2)}
                      </span>
                      <span className="font-mono text-slate-200 truncate">
                        {peak.ionFormula}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                      {peak.relativeIntensity.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activePeak && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-amber-300 flex items-center gap-1 font-mono">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  m/z {activePeak.mz.toFixed(4)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {activePeak.relativeIntensity.toFixed(1)}% {activePeak.neutralLoss ? `· ${activePeak.neutralLoss}` : ''}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-200 font-medium truncate">
                {activePeak.assignment} — <span className="font-mono text-violet-300">{activePeak.ionFormula}</span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                {activePeak.description}
              </p>
              <div className="text-[9.5px] font-mono text-slate-500 pt-0.5 border-t border-slate-800/60">
                {ms.nitrogenRuleNote}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
