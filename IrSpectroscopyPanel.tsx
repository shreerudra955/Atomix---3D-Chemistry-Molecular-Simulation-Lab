import React, { useMemo, useState, useRef } from 'react';
import { MoleculeData } from '../types/chemistry';
import {
  predictIrSpectrum,
  IR_REGIONS,
  IrPeak,
  IrSpectrumPoint,
} from '../utils/irSpectroscopy';
import { Activity, Info, Layers, MousePointerClick } from 'lucide-react';

interface IrSpectroscopyPanelProps {
  molecule: MoleculeData;
  temperatureK: number;
  onSelectBondIndex?: (bondIndex: number) => void;
}

const SVG_WIDTH = 720;
const SVG_HEIGHT = 230;
const PAD_LEFT = 46;
const PAD_RIGHT = 16;
const PAD_TOP = 24;
const PAD_BOTTOM = 34;

const PLOT_W = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Standard IR convention: 4000 cm⁻¹ on left -> 400 cm⁻¹ on right
function wnToX(wn: number): number {
  const ratio = (4000 - wn) / (4000 - 400);
  return PAD_LEFT + ratio * PLOT_W;
}

function xToWn(x: number): number {
  const ratio = Math.min(Math.max((x - PAD_LEFT) / PLOT_W, 0), 1);
  return Math.round((4000 - ratio * (4000 - 400)) / 5) * 5;
}

export const IrSpectroscopyPanel: React.FC<IrSpectroscopyPanelProps> = ({
  molecule,
  temperatureK,
  onSelectBondIndex,
}) => {
  const [yMode, setYMode] = useState<'absorbance' | 'transmittance'>('absorbance');
  const [showRegions, setShowRegions] = useState<boolean>(true);
  const [selectedPeakId, setSelectedPeakId] = useState<string | null>(null);
  const [hoverWn, setHoverWn] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const spectrum = useMemo(() => {
    return predictIrSpectrum(molecule, temperatureK);
  }, [molecule, temperatureK]);

  const activePeak: IrPeak | null = useMemo(() => {
    if (spectrum.peaks.length === 0) return null;
    if (selectedPeakId) {
      const found = spectrum.peaks.find((p) => p.id === selectedPeakId);
      if (found) return found;
    }
    return spectrum.peaks[0];
  }, [spectrum.peaks, selectedPeakId]);

  const hoverPoint: IrSpectrumPoint | null = useMemo(() => {
    if (hoverWn === null || spectrum.curve.length === 0) return null;
    const idx = Math.round((4000 - hoverWn) / 5);
    return spectrum.curve[Math.min(Math.max(idx, 0), spectrum.curve.length - 1)] || null;
  }, [hoverWn, spectrum.curve]);

  const yForPoint = (pt: IrSpectrumPoint): number => {
    if (yMode === 'absorbance') {
      // Absorbance 0.0 at bottom -> 1.0 at top
      return PAD_TOP + (1 - Math.min(Math.max(pt.absorbance, 0), 1.05)) * PLOT_H;
    }
    // Transmittance 100% at top -> 0% at bottom
    const norm = Math.min(Math.max(pt.transmittance / 100, 0), 1);
    return PAD_TOP + (1 - norm) * PLOT_H;
  };

  const linePath = useMemo(() => {
    if (spectrum.curve.length === 0) return '';
    return spectrum.curve
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${wnToX(pt.wavenumber).toFixed(1)} ${yForPoint(pt).toFixed(1)}`)
      .join(' ');
  }, [spectrum.curve, yMode]);

  const areaPath = useMemo(() => {
    if (spectrum.curve.length === 0) return '';
    const baseY = yMode === 'absorbance' ? PAD_TOP + PLOT_H : PAD_TOP;
    const firstX = wnToX(spectrum.curve[0].wavenumber).toFixed(1);
    const lastX = wnToX(spectrum.curve[spectrum.curve.length - 1].wavenumber).toFixed(1);
    return `${linePath} L ${lastX} ${baseY.toFixed(1)} L ${firstX} ${baseY.toFixed(1)} Z`;
  }, [linePath, spectrum.curve, yMode]);

  const handleSelectPeak = (peak: IrPeak) => {
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
      setHoverWn(null);
      return;
    }
    setHoverWn(xToWn(localX));
  };

  const wnTicks = [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500];
  const yTicks =
    yMode === 'absorbance'
      ? [
          { val: 1.0, label: '1.0' },
          { val: 0.75, label: '0.75' },
          { val: 0.5, label: '0.50' },
          { val: 0.25, label: '0.25' },
          { val: 0.0, label: '0.0' },
        ]
      : [
          { val: 100, label: '100%' },
          { val: 75, label: '75%' },
          { val: 50, label: '50%' },
          { val: 25, label: '25%' },
          { val: 0, label: '0%' },
        ];

  return (
    <div className="flex flex-col gap-3 text-slate-200">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
              Predicted FT-IR Spectrum — {molecule.name} ({molecule.formula})
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {spectrum.summaryNote}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Diagnostic Region Overlay Toggle */}
          <button
            onClick={() => setShowRegions(!showRegions)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
              showRegions
                ? 'bg-slate-800 text-sky-300 border-sky-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle functional group wavenumber regions"
          >
            <Layers className="w-3 h-3" />
            <span>Regions</span>
          </button>

          {/* Absorbance vs Transmittance Segmented Control */}
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setYMode('absorbance')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                yMode === 'absorbance'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Absorbance
            </button>
            <button
              onClick={() => setYMode('transmittance')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                yMode === 'transmittance'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              % Transmittance
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Interactive SVG Plot + Peak Assignment & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left/Center: Interactive FT-IR SVG Chart */}
        <div className="lg:col-span-8 bg-slate-950/90 border border-slate-800/90 rounded-xl p-2 flex flex-col justify-between relative">
          {/* Live Readout Bar */}
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums px-1.5 pb-1 text-slate-400">
            <span>Mid-IR Scan: 4000 → 400 cm⁻¹ • T = {temperatureK} K</span>
            {hoverPoint ? (
              <span className="text-cyan-300 font-semibold">
                {hoverPoint.wavenumber} cm⁻¹ · {hoverPoint.absorbance.toFixed(2)} AU ({hoverPoint.transmittance.toFixed(0)}%T)
              </span>
            ) : (
              <span className="text-slate-500 hidden sm:inline">Hover spectrum to measure · Click peak to highlight bond</span>
            )}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto max-h-[210px] select-none cursor-crosshair overflow-visible"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHoverWn(null)}
          >
            <defs>
              <linearGradient id="irAbsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.03" />
              </linearGradient>
              <linearGradient id="irTransGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* Diagnostic Regions Shading */}
            {showRegions &&
              IR_REGIONS.map((reg) => {
                const x1 = wnToX(reg.maxCm1);
                const x2 = wnToX(reg.minCm1);
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
                      fillOpacity={0.78}
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {reg.id === 'xh_stretch'
                        ? 'X–H Stretch'
                        : reg.id === 'triple_bond'
                        ? 'Triple'
                        : reg.id === 'double_bond'
                        ? 'C=O / C=C'
                        : 'Fingerprint'}
                    </text>
                  </g>
                );
              })}

            {/* Horizontal Y-Gridlines */}
            {yTicks.map((tick) => {
              const y =
                yMode === 'absorbance'
                  ? PAD_TOP + (1 - tick.val) * PLOT_H
                  : PAD_TOP + (1 - tick.val / 100) * PLOT_H;
              return (
                <g key={tick.label}>
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
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Vertical Wavenumber Gridlines */}
            {wnTicks.map((wn) => {
              const x = wnToX(wn);
              return (
                <g key={wn}>
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
                    {wn}
                  </text>
                </g>
              );
            })}

            {/* Axes Frame */}
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
              Wavenumber (cm⁻¹)
            </text>
            <text
              x={12}
              y={PAD_TOP + PLOT_H / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              transform={`rotate(-90 12 ${PAD_TOP + PLOT_H / 2})`}
            >
              {yMode === 'absorbance' ? 'Absorbance (AU)' : 'Transmittance (%)'}
            </text>

            {/* Filled Area & Spectrum Curve */}
            {areaPath && (
              <path
                d={areaPath}
                fill={yMode === 'absorbance' ? 'url(#irAbsGradient)' : 'url(#irTransGradient)'}
              />
            )}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Hover Crosshair */}
            {hoverPoint && (
              <g pointerEvents="none">
                <line
                  x1={wnToX(hoverPoint.wavenumber)}
                  y1={PAD_TOP}
                  x2={wnToX(hoverPoint.wavenumber)}
                  y2={PAD_TOP + PLOT_H}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <circle
                  cx={wnToX(hoverPoint.wavenumber)}
                  cy={yForPoint(hoverPoint)}
                  r={3.5}
                  fill="#22d3ee"
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Interactive Peak Markers */}
            {spectrum.peaks.map((peak) => {
              const x = wnToX(peak.wavenumberCm1);
              const idx = Math.round((4000 - peak.wavenumberCm1) / 5);
              const pt = spectrum.curve[Math.min(Math.max(idx, 0), spectrum.curve.length - 1)];
              const y = pt ? yForPoint(pt) : PAD_TOP + PLOT_H / 2;
              const isSelected = activePeak?.id === peak.id;

              return (
                <g
                  key={peak.id}
                  className="cursor-pointer"
                  onClick={() => handleSelectPeak(peak)}
                >
                  {/* Vertical leader line when selected */}
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
                  {/* Invisible wider click target */}
                  <circle cx={x} cy={y} r={10} fill="transparent" />
                  {/* Visible marker */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 4.5 : 3}
                    fill={isSelected ? '#f59e0b' : '#38bdf8'}
                    stroke="#020617"
                    strokeWidth="1.5"
                  />
                  {/* Wavenumber & Bond Tag for strongest or selected peaks */}
                  {(isSelected || peak.absorbance >= 0.65) && (
                    <text
                      x={x}
                      y={yMode === 'absorbance' ? Math.max(y - 8, PAD_TOP + 10) : Math.min(y + 13, PAD_TOP + PLOT_H - 4)}
                      textAnchor="middle"
                      fill={isSelected ? '#fbbf24' : '#cbd5e1'}
                      fontSize={isSelected ? '10' : '8.5'}
                      fontWeight={isSelected ? '700' : '500'}
                      fontFamily="monospace"
                    >
                      {peak.wavenumberCm1}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right: Peak Assignment Table & Selected Band Details */}
        <div className="lg:col-span-4 flex flex-col gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl p-2.5 justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/80 pb-1">
              <span>Absorbance Peaks ({spectrum.peaks.length})</span>
              <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3 text-sky-400" />
                Select to inspect
              </span>
            </div>

            {spectrum.peaks.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No IR-active vibrational dipole transitions predicted (Δμ = 0).
              </div>
            ) : (
              <div className="max-h-[125px] overflow-y-auto divide-y divide-slate-800/60 pr-1">
                {spectrum.peaks.map((peak) => {
                  const isSel = activePeak?.id === peak.id;
                  return (
                    <button
                      key={peak.id}
                      onClick={() => handleSelectPeak(peak)}
                      className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between gap-2 text-[11px] ${
                        isSel
                          ? 'bg-sky-500/15 text-white'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono font-bold tabular-nums shrink-0 ${isSel ? 'text-amber-300' : 'text-sky-300'}`}>
                          {peak.wavenumberCm1}
                        </span>
                        <span className="font-mono text-slate-200 font-semibold shrink-0">
                          {peak.bondLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {peak.mode}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] tabular-nums text-slate-400 shrink-0">
                        {peak.absorbance.toFixed(2)} AU
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Peak Detailed Explanation */}
          {activePeak && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-amber-300 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  {activePeak.bondLabel} · {activePeak.wavenumberCm1} cm⁻¹
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {activePeak.intensity} · {activePeak.shape}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-300 font-medium">
                {activePeak.functionalGroup} — {activePeak.mode}
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                {activePeak.description}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>Diagnostic Window: {activePeak.rangeCm1[0]}–{activePeak.rangeCm1[1]} cm⁻¹</span>
                {activePeak.matchingBondIndices.length > 0 && (
                  <span className="text-sky-400">
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
