import React, { useMemo, useState, useRef } from 'react';
import { MoleculeData } from '../types/chemistry';
import {
  predict1HNmrSpectrum,
  NMR_REGIONS,
  NmrPeak,
  NmrSpectrumPoint,
} from '../utils/nmrSpectroscopy';
import { AudioWaveform, Info, Layers, MousePointerClick, TrendingUp } from 'lucide-react';

interface NmrSpectroscopyPanelProps {
  molecule: MoleculeData;
  onSelectBondIndex?: (bondIndex: number) => void;
}

const SVG_WIDTH = 720;
const SVG_HEIGHT = 230;
const PAD_LEFT = 40;
const PAD_RIGHT = 18;
const PAD_TOP = 24;
const PAD_BOTTOM = 34;

const PLOT_W = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Standard 1H-NMR convention: 12.5 ppm (downfield) on left -> 0.0 ppm (TMS upfield) on right
function ppmToX(ppm: number): number {
  const ratio = (12.5 - ppm) / 12.5;
  return PAD_LEFT + ratio * PLOT_W;
}

function xToPpm(x: number): number {
  const ratio = Math.min(Math.max((x - PAD_LEFT) / PLOT_W, 0), 1);
  return Number((12.5 - ratio * 12.5).toFixed(2));
}

export const NmrSpectroscopyPanel: React.FC<NmrSpectroscopyPanelProps> = ({
  molecule,
  onSelectBondIndex,
}) => {
  const [showRegions, setShowRegions] = useState<boolean>(true);
  const [showIntegral, setShowIntegral] = useState<boolean>(true);
  const [selectedPeakId, setSelectedPeakId] = useState<string | null>(null);
  const [hoverPpm, setHoverPpm] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const nmr = useMemo(() => predict1HNmrSpectrum(molecule), [molecule]);

  const activePeak: NmrPeak | null = useMemo(() => {
    if (nmr.peaks.length === 0) return null;
    if (selectedPeakId) {
      const found = nmr.peaks.find((p) => p.id === selectedPeakId);
      if (found) return found;
    }
    return nmr.peaks[0];
  }, [nmr.peaks, selectedPeakId]);

  const hoverPoint: NmrSpectrumPoint | null = useMemo(() => {
    if (hoverPpm === null || nmr.curve.length === 0) return null;
    const idx = Math.round((12.5 - hoverPpm) / 0.015);
    return nmr.curve[Math.min(Math.max(idx, 0), nmr.curve.length - 1)] || null;
  }, [hoverPpm, nmr.curve]);

  const yForSignal = (intensity: number): number => {
    return PAD_TOP + (1 - Math.min(Math.max(intensity, 0), 1.0)) * PLOT_H;
  };

  const yForIntegral = (integral: number): number => {
    // Render stepped integral smoothly across top 82% of plot height above baseline
    return PAD_TOP + (1 - Math.min(Math.max(integral, 0), 1.0) * 0.85) * PLOT_H;
  };

  const signalPath = useMemo(() => {
    if (nmr.curve.length === 0) return '';
    return nmr.curve
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${ppmToX(pt.ppm).toFixed(1)} ${yForSignal(pt.intensity).toFixed(1)}`)
      .join(' ');
  }, [nmr.curve]);

  const areaPath = useMemo(() => {
    if (nmr.curve.length === 0) return '';
    const baseY = PAD_TOP + PLOT_H;
    const firstX = ppmToX(nmr.curve[0].ppm).toFixed(1);
    const lastX = ppmToX(nmr.curve[nmr.curve.length - 1].ppm).toFixed(1);
    return `${signalPath} L ${lastX} ${baseY.toFixed(1)} L ${firstX} ${baseY.toFixed(1)} Z`;
  }, [signalPath, nmr.curve]);

  const integralPath = useMemo(() => {
    if (nmr.curve.length === 0 || !nmr.hasProtons) return '';
    return nmr.curve
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${ppmToX(pt.ppm).toFixed(1)} ${yForIntegral(pt.integral).toFixed(1)}`)
      .join(' ');
  }, [nmr.curve, nmr.hasProtons]);

  const handleSelectPeak = (peak: NmrPeak) => {
    setSelectedPeakId(peak.id);
    if (onSelectBondIndex && peak.matchingBondIndices.length > 0) {
      onSelectBondIndex(peak.matchingBondIndices[0]);
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;
    if (localX < PAD_LEFT || localX > SVG_WIDTH - PAD_RIGHT) {
      setHoverPpm(null);
      return;
    }
    setHoverPpm(xToPpm(localX));
  };

  const ppmTicks = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="flex flex-col gap-3 text-slate-200">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <AudioWaveform className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
              Predicted ¹H-NMR Spectrum — {molecule.name} ({molecule.formula})
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {nmr.summaryNote}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowIntegral(!showIntegral)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              showIntegral
                ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle stepped proton integration curve"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Integral</span>
          </button>

          <button
            onClick={() => setShowRegions(!showRegions)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              showRegions
                ? 'bg-slate-800 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle chemical shift diagnostic zones"
          >
            <Layers className="w-3 h-3" />
            <span>Regions</span>
          </button>
        </div>
      </div>

      {/* Main Split: Interactive 1H-NMR SVG Plot + Chemical Shift Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left: Interactive 1H-NMR Spectrum Plot */}
        <div className="lg:col-span-8 bg-slate-950/90 border border-slate-800/90 rounded-xl p-2 flex flex-col justify-between relative">
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums px-1.5 pb-1 text-slate-400">
            <span>{nmr.solventNote} · 12.5 → 0.0 ppm</span>
            {hoverPoint ? (
              <span className="text-emerald-300 font-semibold">
                δ {hoverPoint.ppm.toFixed(2)} ppm · Rel. Signal {(hoverPoint.intensity * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="text-slate-500 hidden sm:inline">Hover to measure δ (ppm) · Click peak to highlight 3D bond</span>
            )}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto max-h-[210px] select-none cursor-crosshair overflow-visible"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHoverPpm(null)}
          >
            <defs>
              <linearGradient id="nmrSignalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {/* Chemical Shift Region Bands */}
            {showRegions &&
              NMR_REGIONS.map((reg) => {
                const x1 = ppmToX(reg.maxPpm);
                const x2 = ppmToX(reg.minPpm);
                const w = x2 - x1;
                return (
                  <g key={reg.id}>
                    <rect
                      x={x1}
                      y={PAD_TOP}
                      width={w}
                      height={PLOT_H}
                      fill={reg.color}
                      fillOpacity={0.055}
                    />
                    <text
                      x={x1 + w / 2}
                      y={PAD_TOP - 7}
                      textAnchor="middle"
                      fill={reg.color}
                      fillOpacity={0.8}
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {reg.shortLabel}
                    </text>
                  </g>
                );
              })}

            {/* Vertical ppm Gridlines */}
            {ppmTicks.map((ppm) => {
              const x = ppmToX(ppm);
              return (
                <g key={ppm}>
                  <line
                    x1={x}
                    y1={PAD_TOP}
                    x2={x}
                    y2={PAD_TOP + PLOT_H}
                    stroke={ppm === 0 ? '#334155' : '#1e293b'}
                    strokeDasharray={ppm === 0 ? undefined : '2 3'}
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
                    {ppm}
                  </text>
                </g>
              );
            })}

            {/* Baseline & Frame */}
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={PLOT_W}
              height={PLOT_H}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Axis Labels */}
            <text
              x={PAD_LEFT + PLOT_W / 2}
              y={SVG_HEIGHT - 4}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              fontFamily="sans-serif"
            >
              Chemical Shift δ (ppm)
            </text>
            <text
              x={13}
              y={PAD_TOP + PLOT_H / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              transform={`rotate(-90 13 ${PAD_TOP + PLOT_H / 2})`}
            >
              Intensity
            </text>

            {/* Stepped Integration Curve */}
            {showIntegral && integralPath && (
              <path
                d={integralPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.25"
                strokeOpacity="0.65"
                strokeDasharray="4 2"
              />
            )}

            {/* Main 1H-NMR Spectrum Curve */}
            {areaPath && <path d={areaPath} fill="url(#nmrSignalGrad)" />}
            {signalPath && (
              <path
                d={signalPath}
                fill="none"
                stroke="#34d399"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Hover Crosshair */}
            {hoverPoint && (
              <g pointerEvents="none">
                <line
                  x1={ppmToX(hoverPoint.ppm)}
                  y1={PAD_TOP}
                  x2={ppmToX(hoverPoint.ppm)}
                  y2={PAD_TOP + PLOT_H}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <circle
                  cx={ppmToX(hoverPoint.ppm)}
                  cy={yForSignal(hoverPoint.intensity)}
                  r={3.5}
                  fill="#34d399"
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Interactive Peak Labels & Markers */}
            {nmr.peaks.map((peak) => {
              const x = ppmToX(peak.shiftPpm);
              const idx = Math.round((12.5 - peak.shiftPpm) / 0.015);
              const pt = nmr.curve[Math.min(Math.max(idx, 0), nmr.curve.length - 1)];
              const y = pt ? yForSignal(pt.intensity) : PAD_TOP + PLOT_H / 2;
              const isSelected = activePeak?.id === peak.id;

              return (
                <g
                  key={peak.id}
                  className="cursor-pointer"
                  onClick={() => handleSelectPeak(peak)}
                >
                  {isSelected && (
                    <line
                      x1={x}
                      y1={PAD_TOP}
                      x2={x}
                      y2={PAD_TOP + PLOT_H}
                      stroke="#f59e0b"
                      strokeDasharray="3 2"
                      strokeWidth="1.2"
                    />
                  )}
                  <circle cx={x} cy={y} r={10} fill="transparent" />
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 4.2 : 2.8}
                    fill={isSelected ? '#f59e0b' : '#34d399'}
                    stroke="#020617"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={Math.max(y - 8, PAD_TOP + 11)}
                    textAnchor="middle"
                    fill={isSelected ? '#fbbf24' : '#cbd5e1'}
                    fontSize={isSelected ? '9.5' : '8.5'}
                    fontWeight={isSelected ? '700' : '500'}
                    fontFamily="monospace"
                  >
                    {peak.shiftPpm.toFixed(2)} ({peak.protonCount}H)
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: Chemical Shift Assignment List & Selected Multiplet Details */}
        <div className="lg:col-span-4 flex flex-col gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl p-2.5 justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/80 pb-1">
              <span>Chemical Shifts ({nmr.totalProtons}H Total)</span>
              <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3 text-emerald-400" />
                Select peak
              </span>
            </div>

            {!nmr.hasProtons ? (
              <div className="py-5 px-2 text-center text-xs text-slate-400 leading-relaxed">
                No hydrogen atoms in {molecule.formula}. ¹H-NMR is silent for proton-free compounds.
              </div>
            ) : (
              <div className="max-h-[125px] overflow-y-auto divide-y divide-slate-800/60 pr-1">
                {nmr.peaks.map((peak) => {
                  const isSel = activePeak?.id === peak.id;
                  return (
                    <button
                      key={peak.id}
                      onClick={() => handleSelectPeak(peak)}
                      className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between gap-2 text-[11px] ${
                        isSel
                          ? 'bg-emerald-500/15 text-white'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono font-bold tabular-nums shrink-0 ${isSel ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {peak.shiftPpm.toFixed(2)}
                        </span>
                        <span className="font-mono text-slate-200 font-semibold shrink-0">
                          {peak.groupLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {peak.multiplicity}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                        {peak.protonCount}H
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {activePeak && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-amber-300 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  δ {activePeak.shiftPpm.toFixed(2)} ppm · {activePeak.groupLabel}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {activePeak.multiplicity} · {activePeak.protonCount}H
                  {activePeak.jCouplingHz ? ` · J=${activePeak.jCouplingHz} Hz` : ''}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-300 font-medium">
                {activePeak.environment}
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                {activePeak.description}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>{activePeak.isExchangeable ? 'D₂O Exchangeable Proton' : 'Spin-Coupled Carbon Proton'}</span>
                {activePeak.matchingBondIndices.length > 0 && (
                  <span className="text-emerald-400">
                    Highlighted bond #{activePeak.matchingBondIndices[0] + 1} in 3D
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
