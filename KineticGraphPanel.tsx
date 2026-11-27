import React, { useMemo, useRef, useState } from 'react';
import { ChemicalReaction } from '../types/chemistry';
import {
  KineticOrderMode,
  KineticSimulationResult,
  sampleKineticsAtProgress,
} from '../utils/reactionKinetics';
import { Activity, Flame, RotateCcw, Zap } from 'lucide-react';
import { FormattedChemText } from './FormattedChemText';

interface KineticGraphPanelProps {
  reaction: ChemicalReaction;
  progress: number;
  simulation: KineticSimulationResult;
  temperatureK: number;
  onTemperatureChange: (nextTempK: number) => void;
  hasCatalyst: boolean;
  onToggleCatalyst: () => void;
  orderMode: KineticOrderMode;
  onOrderModeChange: (nextOrder: KineticOrderMode) => void;
  onSeekProgress: (nextProgress: number) => void;
  onReplay?: () => void;
}

export const KineticGraphPanel: React.FC<KineticGraphPanelProps> = React.memo(({
  progress,
  simulation,
  temperatureK,
  onTemperatureChange,
  hasCatalyst,
  onToggleCatalyst,
  orderMode,
  onOrderModeChange,
  onSeekProgress,
  onReplay,
}) => {
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const displayProgress = hoverProgress !== null ? hoverProgress : progress;
  const liveSnapshot = useMemo(
    () => sampleKineticsAtProgress(simulation, displayProgress),
    [simulation, displayProgress]
  );

  const currentSnapshot = useMemo(
    () => sampleKineticsAtProgress(simulation, progress),
    [simulation, progress]
  );

  // SVG plot geometry
  const svgW = 540;
  const svgH = 210;
  const pad = { top: 16, right: 16, bottom: 30, left: 42 };
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const maxConc = useMemo(() => {
    let peak = 1.0;
    for (const sp of simulation.species) {
      for (const v of sp.valuesM) {
        if (v > peak) peak = v;
      }
    }
    return Math.ceil(peak * 2) / 2; // round up cleanly to nearest 0.5 M
  }, [simulation]);

  const toX = (tSec: number) => pad.left + (tSec / simulation.tMaxSec) * plotW;
  const toY = (concM: number) =>
    pad.top + plotH - (Math.max(0, Math.min(maxConc, concM)) / maxConc) * plotH;

  const yTicks = useMemo(() => {
    const steps = 4;
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) {
      out.push(Number(((maxConc / steps) * i).toFixed(2)));
    }
    return out;
  }, [maxConc]);

  const xTicks = [0, 5, 10, 15, 20];

  // Precompute static full dashed SVG path strings only when kinetic parameters change
  const projectedPaths = useMemo(() => {
    const map = new Map<string, string>();
    for (const sp of simulation.species) {
      const fullD = sp.valuesM
        .map((val, idx) => {
          const x = pad.left + (simulation.timePointsSec[idx] / simulation.tMaxSec) * plotW;
          const y =
            pad.top + plotH - (Math.max(0, Math.min(maxConc, val)) / maxConc) * plotH;
          return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
      map.set(sp.id, fullD);
    }
    return map;
  }, [simulation, maxConc, pad.left, pad.top, plotW, plotH]);

  const activeTimeX = toX(progress * simulation.tMaxSec);
  const hoverTimeX = hoverProgress !== null ? toX(hoverProgress * simulation.tMaxSec) : null;

  const handlePointerEvent = (clientX: number, seek: boolean) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * svgW;
    const norm = Math.max(0, Math.min(1, (relX - pad.left) / plotW));
    if (seek) {
      onSeekProgress(Number(norm.toFixed(3)));
    } else {
      setHoverProgress(norm);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 text-slate-100">
      {/* Top Calibration Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/90 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-semibold text-slate-200 whitespace-nowrap">
            Concentration vs. Time Profile
          </span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <span className="font-mono tabular-nums text-cyan-300 hidden sm:inline whitespace-nowrap">
            {simulation.rateLawLabel}
          </span>
          <span className="text-slate-500 hidden md:inline">·</span>
          <span className="font-mono tabular-nums text-slate-400 hidden md:inline whitespace-nowrap">
            k = {simulation.rateConstantValue} {simulation.rateConstantUnit}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
          <span className="text-slate-400 whitespace-nowrap">
            t½ ={' '}
            <strong className="text-amber-300">
              {simulation.halfLifeSec !== null ? `${simulation.halfLifeSec.toFixed(2)} s` : '--'}
            </strong>
          </span>
          <span className="text-slate-400 whitespace-nowrap">
            r(t) ={' '}
            <strong className="text-emerald-300">
              {liveSnapshot.rateMPerSec.toFixed(3)} M/s
            </strong>
          </span>
        </div>
      </div>

      {/* Main Split: Interactive SVG Plot + Live Species & Parameter Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left: Real-Time Kinetic Chart */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1 px-1 text-[10px] font-mono tabular-nums">
            <span className="text-slate-400">
              {hoverProgress !== null
                ? `Probe t = ${liveSnapshot.timeSec.toFixed(2)} s (Click chart to seek)`
                : `Elapsed t = ${currentSnapshot.timeSec.toFixed(2)} s / ${simulation.tMaxSec} s`}
            </span>
            <span className="text-slate-400">
              Conversion: <strong className="text-sky-300">{Math.round(liveSnapshot.extent * 100)}%</strong>
              {simulation.isReversible && (
                <span className="text-amber-300 ml-1.5">
                  (Eq. {Math.round(simulation.equilibriumExtent * 100)}%)
                </span>
              )}
            </span>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-44 sm:h-48 cursor-crosshair select-none overflow-visible"
            onMouseMove={(e) => handlePointerEvent(e.clientX, false)}
            onMouseLeave={() => setHoverProgress(null)}
            onClick={(e) => handlePointerEvent(e.clientX, true)}
          >
            {/* Horizontal Concentration Gridlines */}
            {yTicks.map((tick) => {
              const y = toY(tick);
              return (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={pad.left + plotW}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                  <text
                    x={pad.left - 6}
                    y={y + 3}
                    fill="#94a3b8"
                    fontSize="9.5"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {tick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Time Gridlines */}
            {xTicks.map((tSec) => {
              const x = toX(tSec);
              return (
                <g key={tSec}>
                  <line
                    x1={x}
                    y1={pad.top}
                    x2={x}
                    y2={pad.top + plotH}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={pad.top + plotH + 13}
                    fill="#94a3b8"
                    fontSize="9.5"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {tSec}s
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={pad.left}
              y1={pad.top}
              x2={pad.left}
              y2={pad.top + plotH}
              stroke="#475569"
              strokeWidth="1.2"
            />
            <line
              x1={pad.left}
              y1={pad.top + plotH}
              x2={pad.left + plotW}
              y2={pad.top + plotH}
              stroke="#475569"
              strokeWidth="1.2"
            />

            {/* Axis Labels */}
            <text
              x={11}
              y={pad.top + plotH / 2}
              fill="#64748b"
              fontSize="9"
              textAnchor="middle"
              fontFamily="monospace"
              transform={`rotate(-90 11 ${pad.top + plotH / 2})`}
            >
              [C] (mol/L)
            </text>
            <text
              x={pad.left + plotW / 2}
              y={svgH - 2}
              fill="#64748b"
              fontSize="9"
              textAnchor="middle"
              fontFamily="monospace"
            >
              Reaction Time t (seconds)
            </text>

            {/* Half-life t_{1/2} guide */}
            {simulation.halfLifeSec !== null && (
              <g>
                <line
                  x1={toX(simulation.halfLifeSec)}
                  y1={pad.top}
                  x2={toX(simulation.halfLifeSec)}
                  y2={pad.top + plotH}
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.45"
                />
                <text
                  x={toX(simulation.halfLifeSec) + 3}
                  y={pad.top + 10}
                  fill="#fbbf24"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  t½={simulation.halfLifeSec.toFixed(1)}s
                </text>
              </g>
            )}

            {/* Theoretical Future Trajectory (Dashed) + Live Active History (Solid) */}
            {simulation.species.map((sp) => {
              const fullD = projectedPaths.get(sp.id) || '';

              // Active path up to current simulation progress
              const activePoints: string[] = [];
              const exactIdx = progress * (simulation.timePointsSec.length - 1);
              const maxWhole = Math.floor(exactIdx);
              for (let i = 0; i <= maxWhole; i++) {
                const x = toX(simulation.timePointsSec[i]);
                const y = toY(sp.valuesM[i]);
                activePoints.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
              }
              // Append exact interpolated endpoint at current progress
              const curEntry = currentSnapshot.concentrations.find((c) => c.id === sp.id);
              if (curEntry) {
                const endX = toX(currentSnapshot.timeSec);
                const endY = toY(curEntry.concM);
                activePoints.push(`L ${endX.toFixed(1)} ${endY.toFixed(1)}`);
              }

              return (
                <g key={sp.id}>
                  {/* Full projected path */}
                  <path
                    d={fullD}
                    fill="none"
                    stroke={sp.color}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.3"
                  />
                  {/* Real-time drawn curve up to elapsed progress */}
                  <path
                    d={activePoints.join(' ')}
                    fill="none"
                    stroke={sp.color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Live Elapsed Time Cursor */}
            <line
              x1={activeTimeX}
              y1={pad.top}
              x2={activeTimeX}
              y2={pad.top + plotH}
              stroke="#38bdf8"
              strokeWidth="1.2"
              opacity="0.75"
            />

            {/* Hover Probe Hairline */}
            {hoverTimeX !== null && (
              <line
                x1={hoverTimeX}
                y1={pad.top}
                x2={hoverTimeX}
                y2={pad.top + plotH}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
            )}

            {/* Live Data Dots on each Curve at active/hover time */}
            {liveSnapshot.concentrations.map((c) => {
              const cx = toX(liveSnapshot.timeSec);
              const cy = toY(c.concM);
              return (
                <circle
                  key={c.id}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill={c.color}
                  stroke="#020617"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>

        {/* Right: Live Species Concentrations & Kinetic Controls */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-2">
          {/* Live Species Concentration Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pb-1 border-b border-slate-800/80">
              <span>Species</span>
              <span className="font-mono tabular-nums">[C] (M) · d[C]/dt</span>
            </div>
            <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-0.5">
              {liveSnapshot.concentrations.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-semibold text-slate-200 truncate py-0.5 leading-normal" title={c.name}>
                      <FormattedChemText text={c.formula} />
                    </span>
                    <span className="text-[9px] text-slate-500 font-sans shrink-0">
                      {c.role === 'reactant' ? 'Reactant' : 'Product'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-white">{c.concM.toFixed(2)} M</span>
                    <span
                      className={`text-[9.5px] w-14 text-right ${
                        Math.abs(c.rateMPerSec) < 0.002
                          ? 'text-slate-500'
                          : c.rateMPerSec < 0
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {c.rateMPerSec >= 0 ? `+${c.rateMPerSec.toFixed(2)}` : c.rateMPerSec.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kinetic Parameter Controls (Temperature, Catalyst, Reaction Order) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            {/* Temperature Scrubber */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  Temperature (T)
                </span>
                <span className="font-mono tabular-nums text-amber-300 font-semibold">
                  {temperatureK} K ({Math.round(temperatureK - 273.15)} °C) · {simulation.arrheniusMultiplier}×
                </span>
              </div>
              <input
                type="range"
                min={250}
                max={1200}
                step={10}
                value={temperatureK}
                onChange={(e) => onTemperatureChange(Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Order Segmented Selector + Catalyst Toggle + Replay */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(['auto', 'zero', 'first', 'second'] as KineticOrderMode[]).map((ord) => (
                  <button
                    key={ord}
                    onClick={() => onOrderModeChange(ord)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      orderMode === ord
                        ? 'bg-sky-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ord === 'auto' ? 'Auto' : ord === 'zero' ? '0th' : ord === 'first' ? '1st' : '2nd'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleCatalyst}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    hasCatalyst
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle Catalyst (−35% Activation Energy Ea)"
                >
                  <Zap className="w-3 h-3" />
                  <span>{hasCatalyst ? 'Catalyst On' : 'Add Catalyst'}</span>
                </button>
                {onReplay && (
                  <button
                    onClick={onReplay}
                    className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-300 transition-colors shrink-0 cursor-pointer"
                    title="Replay 3D Reaction from t = 0s with current kinetic settings"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
