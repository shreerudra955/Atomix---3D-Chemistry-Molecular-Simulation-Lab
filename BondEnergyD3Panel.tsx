import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ChemicalReaction } from '../types/chemistry';
import {
  BondEnergyComponent,
  BondEnergyProfile,
  BondEnergyTrajectoryPoint,
  formatBondEnergyValue,
  sampleBondEnergyAtExtent,
} from '../utils/bondEnergies';
import { Flame, Layers, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { FormattedChemText } from './FormattedChemText';

interface BondEnergyD3PanelProps {
  reaction: ChemicalReaction;
  profile: BondEnergyProfile;
  kineticExtent: number;
  hasCatalyst: boolean;
  onSeekExtent?: (nextExtent: number) => void;
}

interface WaterfallDatum {
  id: 'broken' | 'formed' | 'net';
  label: string;
  startDisplay: number;
  endDisplay: number;
  liveStartDisplay: number;
  liveEndDisplay: number;
  totalKj: number;
  liveKj: number;
  color: string;
  mutedColor: string;
  bonds: BondEnergyComponent[];
  progressPct: number;
}

/**
 * Compact real-time D3 energy-delta HUD + hover tooltip embedded in the 3D sandbox overlay.
 * Updates smoothly as molecules react without obscuring the 3D molecular viewport.
 */
export const BondEnergyLiveBadge: React.FC<{
  profile: BondEnergyProfile;
  kineticExtent: number;
  isActiveTab: boolean;
  onOpenFullPanel: () => void;
}> = React.memo(({ profile, kineticExtent, isActiveTab, onOpenFullPanel }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const sample = useMemo(
    () => sampleBondEnergyAtExtent(profile, kineticExtent),
    [profile, kineticExtent]
  );

  // D3 diverging bar geometry (SVG 220 x 34)
  const w = 220;
  const h = 34;
  const padX = 6;

  const { xScale, zeroX, brokenX1, brokenX2, formedX1, formedX2, netX1, netX2 } = useMemo(() => {
    const scaleFactor = profile.scaleFactor;
    const maxAbs = Math.max(
      10,
      profile.totalBrokenKj / scaleFactor,
      profile.totalFormedKj / scaleFactor,
      Math.abs(profile.enthalpyDeltaHKj) / scaleFactor
    );
    const scale = d3
      .scaleLinear()
      .domain([-maxAbs * 1.08, maxAbs * 1.08])
      .range([padX, w - padX]);

    const zX = scale(0);
    const brkVal = sample.brokenAbsorbedKj / scaleFactor;
    const frmVal = sample.formedReleasedKj / scaleFactor; // <= 0
    const netVal = sample.netBondDeltaKj / scaleFactor;

    return {
      xScale: scale,
      zeroX: zX,
      brokenX1: zX,
      brokenX2: scale(brkVal),
      formedX1: scale(frmVal),
      formedX2: zX,
      netX1: Math.min(zX, scale(netVal)),
      netX2: Math.max(zX, scale(netVal)),
    };
  }, [profile, sample]);

  const targetBrokenX = xScale(profile.totalBrokenKj / profile.scaleFactor);
  const targetFormedX = xScale(-profile.totalFormedKj / profile.scaleFactor);

  return (
    <div
      className="relative mt-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={onOpenFullPanel}
        className={`w-full p-2 rounded-lg border text-left transition-colors cursor-pointer ${
          isActiveTab
            ? 'bg-amber-500/15 border-amber-500/45 text-slate-100'
            : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5 text-[10px]">
          <span className="flex items-center gap-1 font-semibold text-amber-300 whitespace-nowrap">
            <Layers className="w-3 h-3 shrink-0" />
            <span>Bond Energy ΔE(t)</span>
          </span>
          <span
            className={`font-mono tabular-nums font-bold whitespace-nowrap ${
              sample.netBondDeltaKj > 1
                ? 'text-amber-300'
                : sample.netBondDeltaKj < -1
                ? 'text-emerald-300'
                : 'text-slate-300'
            }`}
          >
            {formatBondEnergyValue(sample.netBondDeltaKj, profile)}
          </span>
        </div>

        {/* Mini D3 Diverging Energy Delta Bar */}
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 mt-1 overflow-visible">
          {/* Reference targets */}
          <line
            x1={targetFormedX}
            y1={3}
            x2={targetFormedX}
            y2={h - 3}
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.45"
          />
          <line
            x1={targetBrokenX}
            y1={3}
            x2={targetBrokenX}
            y2={h - 3}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.45"
          />

          {/* Track */}
          <rect x={padX} y={7} width={w - padX * 2} height={10} rx={2} fill="#0f172a" />

          {/* Formed (- exothermic, left of 0) */}
          <rect
            x={formedX1}
            y={7}
            width={Math.max(0, formedX2 - formedX1)}
            height={10}
            rx={2}
            fill="#10b981"
            opacity="0.85"
          />
          {/* Broken (+ endothermic, right of 0) */}
          <rect
            x={brokenX1}
            y={7}
            width={Math.max(0, brokenX2 - brokenX1)}
            height={10}
            rx={2}
            fill="#f59e0b"
            opacity="0.85"
          />

          {/* Net delta indicator bar below */}
          <rect
            x={netX1}
            y={21}
            width={Math.max(1.5, netX2 - netX1)}
            height={5}
            rx={2}
            fill={sample.netBondDeltaKj >= 0 ? '#fb7185' : '#38bdf8'}
          />

          {/* Zero baseline */}
          <line x1={zeroX} y1={3} x2={zeroX} y2={h - 3} stroke="#94a3b8" strokeWidth="1.2" />
        </svg>

        <div className="flex items-center justify-between text-[9.5px] font-mono tabular-nums mt-0.5">
          <span className="text-emerald-400">
            Form {formatBondEnergyValue(sample.formedReleasedKj, profile)}
          </span>
          <span className="text-amber-400">
            Brk {formatBondEnergyValue(sample.brokenAbsorbedKj, profile)}
          </span>
        </div>
      </button>

      {/* Real-time Floating Bond Energy Hover Tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute right-full top-0 mr-2.5 w-64 bg-slate-950 border border-slate-700 rounded-xl p-2.5 shadow-2xl z-40 pointer-events-none text-[10.5px]"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <span className="font-semibold text-white">Live Bond Energy Balance</span>
            <span className="font-mono tabular-nums text-sky-300">
              ξ = {Math.round(sample.extent * 100)}%
            </span>
          </div>
          <div className="text-[10px] text-amber-300/90 font-medium mb-1.5 truncate py-0.5 leading-normal">
            <FormattedChemText text={sample.phase} />
          </div>

          <div className="space-y-1 font-mono tabular-nums text-[10px]">
            <div className="flex items-center justify-between text-amber-300">
              <span>Σ Broken ({Math.round(sample.breakFraction * 100)}%)</span>
              <span>{formatBondEnergyValue(sample.brokenAbsorbedKj, profile)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-300">
              <span>Σ Formed ({Math.round(sample.formFraction * 100)}%)</span>
              <span>{formatBondEnergyValue(sample.formedReleasedKj, profile)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold text-white">
              <span>Instant ΔE(t)</span>
              <span className={sample.netBondDeltaKj <= 0 ? 'text-sky-300' : 'text-rose-300'}>
                {formatBondEnergyValue(sample.netBondDeltaKj, profile)}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-800/80 grid grid-cols-2 gap-1.5 text-[9.5px] text-slate-400">
            <div>
              <span className="text-amber-400 font-semibold block mb-0.5">Cleaving:</span>
              {profile.brokenBonds.slice(0, 3).map((b) => (
                <div key={b.id} className="truncate font-mono py-0.5 leading-normal">
                  {b.count}×<FormattedChemText text={b.label} />
                </div>
              ))}
            </div>
            <div>
              <span className="text-emerald-400 font-semibold block mb-0.5">Forming:</span>
              {profile.formedBonds.slice(0, 3).map((b) => (
                <div key={b.id} className="truncate font-mono py-0.5 leading-normal">
                  {b.count}×<FormattedChemText text={b.label} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-1.5 text-[9px] text-slate-500">
            Click card to open full D3 Waterfall & Delta Curve
          </div>
        </div>
      )}
    </div>
  );
});

export const BondEnergyD3Panel: React.FC<BondEnergyD3PanelProps> = React.memo(({
  profile,
  kineticExtent,
  hasCatalyst,
  onSeekExtent,
}) => {
  const [hoveredBar, setHoveredBar] = useState<'broken' | 'formed' | 'net' | null>(null);
  const [hoverExtent, setHoverExtent] = useState<number | null>(null);
  const [barTooltipPos, setBarTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const waterfallAxisLeftRef = useRef<SVGGElement | null>(null);
  const waterfallAxisBottomRef = useRef<SVGGElement | null>(null);
  const curveAxisLeftRef = useRef<SVGGElement | null>(null);
  const curveAxisBottomRef = useRef<SVGGElement | null>(null);
  const curveSvgRef = useRef<SVGSVGElement | null>(null);

  const displayExtent = hoverExtent !== null ? hoverExtent : kineticExtent;

  const liveSample = useMemo(
    () => sampleBondEnergyAtExtent(profile, displayExtent),
    [profile, displayExtent]
  );

  // =========================================================================
  // 1. D3 WATERFALL CHART GEOMETRY & SCALES
  // =========================================================================
  const wfW = 300;
  const wfH = 200;
  const wfMargin = { top: 18, right: 14, bottom: 28, left: 48 };
  const wfInnerW = wfW - wfMargin.left - wfMargin.right;
  const wfInnerH = wfH - wfMargin.top - wfMargin.bottom;

  const { wfXScale, wfYScale, wfZeroY } = useMemo(() => {
    const sf = profile.scaleFactor;
    const brk = profile.totalBrokenKj / sf;
    const frm = profile.totalFormedKj / sf;
    const net = profile.enthalpyDeltaHKj / sf;

    const yMin = Math.min(0, net, brk - frm) - Math.max(brk, frm) * 0.14;
    const yMax = Math.max(0, brk, net) + Math.max(brk, frm) * 0.14;

    const xScale = d3
      .scaleBand<'broken' | 'formed' | 'net'>()
      .domain(['broken', 'formed', 'net'])
      .range([0, wfInnerW])
      .padding(0.32);

    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .nice(5)
      .range([wfInnerH, 0]);

    return {
      wfXScale: xScale,
      wfYScale: yScale,
      wfZeroY: yScale(0),
    };
  }, [profile, wfInnerW, wfInnerH]);

  // Render D3 Waterfall axes only when scales/profile change (not at 60fps)
  useEffect(() => {
    if (waterfallAxisLeftRef.current) {
      const axisLeft = d3
        .axisLeft(wfYScale)
        .ticks(5)
        .tickFormat((d) => {
          const val = Number(d);
          if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
          return `${val}`;
        });
      const sel = d3.select(waterfallAxisLeftRef.current);
      sel.call(axisLeft);
      sel.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '9').attr('font-family', 'monospace');
      sel.selectAll('line').attr('stroke', '#334155');
      sel.selectAll('path').attr('stroke', '#475569');
    }

    if (waterfallAxisBottomRef.current) {
      const labelMap: Record<string, string> = {
        broken: '+Broken',
        formed: '−Formed',
        net: 'Net ΔH',
      };
      const axisBottom = d3
        .axisBottom(wfXScale)
        .tickFormat((d) => labelMap[String(d)] ?? String(d));
      const sel = d3.select(waterfallAxisBottomRef.current);
      sel.call(axisBottom);
      sel.selectAll('text').attr('fill', '#cbd5e1').attr('font-size', '9.5').attr('font-family', 'monospace');
      sel.selectAll('line').attr('stroke', '#334155');
      sel.selectAll('path').attr('stroke', '#475569');
    }
  }, [wfXScale, wfYScale]);

  const waterfallData: WaterfallDatum[] = useMemo(() => {
    const sf = profile.scaleFactor;
    const targetBrk = profile.totalBrokenKj / sf;
    const targetNet = profile.enthalpyDeltaHKj / sf;

    const liveBrk = liveSample.brokenAbsorbedKj / sf;
    const liveFrm = liveSample.formedReleasedKj / sf; // negative
    const liveNet = liveSample.netBondDeltaKj / sf;

    return [
      {
        id: 'broken',
        label: 'Bonds Broken (+)',
        startDisplay: 0,
        endDisplay: targetBrk,
        liveStartDisplay: 0,
        liveEndDisplay: liveBrk,
        totalKj: profile.totalBrokenKj,
        liveKj: liveSample.brokenAbsorbedKj,
        color: '#f59e0b',
        mutedColor: 'rgba(245, 158, 11, 0.22)',
        bonds: profile.brokenBonds,
        progressPct: Math.round(liveSample.breakFraction * 100),
      },
      {
        id: 'formed',
        label: 'Bonds Formed (−)',
        startDisplay: targetBrk,
        endDisplay: targetNet,
        liveStartDisplay: liveBrk,
        liveEndDisplay: liveBrk + liveFrm,
        totalKj: -profile.totalFormedKj,
        liveKj: liveSample.formedReleasedKj,
        color: '#10b981',
        mutedColor: 'rgba(16, 185, 129, 0.22)',
        bonds: profile.formedBonds,
        progressPct: Math.round(liveSample.formFraction * 100),
      },
      {
        id: 'net',
        label: 'Net Enthalpy ΔH',
        startDisplay: 0,
        endDisplay: targetNet,
        liveStartDisplay: 0,
        liveEndDisplay: liveNet,
        totalKj: profile.enthalpyDeltaHKj,
        liveKj: liveSample.netBondDeltaKj,
        color: targetNet <= 0 ? '#38bdf8' : '#fb7185',
        mutedColor: targetNet <= 0 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(251, 113, 133, 0.22)',
        bonds: targetNet <= 0 ? profile.formedBonds : profile.brokenBonds,
        progressPct: Math.round(liveSample.extent * 100),
      },
    ];
  }, [profile, liveSample]);

  // =========================================================================
  // 2. D3 CONTINUOUS ENERGY DELTA TRAJECTORY CURVE (0% -> 100%)
  // =========================================================================
  const cvW = 460;
  const cvH = 200;
  const cvMargin = { top: 18, right: 16, bottom: 28, left: 50 };
  const cvInnerW = cvW - cvMargin.left - cvMargin.right;
  const cvInnerH = cvH - cvMargin.top - cvMargin.bottom;

  const {
    cvXScale,
    cvYScale,
    cvZeroY,
    brokenAreaPath,
    formedAreaPath,
    netLinePath,
    pesLinePath,
  } = useMemo(() => {
    const sf = profile.scaleFactor;
    const pts = profile.trajectory;

    let minY = 0;
    let maxY = 0;
    for (const p of pts) {
      const brk = p.brokenAbsorbedKj / sf;
      const frm = p.formedReleasedKj / sf;
      const net = p.netBondDeltaKj / sf;
      const pes = p.potentialSurfaceKj / sf;
      if (brk > maxY) maxY = brk;
      if (pes > maxY) maxY = pes;
      if (net > maxY) maxY = net;
      if (frm < minY) minY = frm;
      if (net < minY) minY = net;
    }
    const span = Math.max(10, maxY - minY);

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, cvInnerW]);
    const yScale = d3
      .scaleLinear()
      .domain([minY - span * 0.08, maxY + span * 0.1])
      .nice(5)
      .range([cvInnerH, 0]);

    const brokenAreaGen = d3
      .area<BondEnergyTrajectoryPoint>()
      .x((d) => xScale(d.extent * 100))
      .y0(() => yScale(0))
      .y1((d) => yScale(d.brokenAbsorbedKj / sf))
      .curve(d3.curveMonotoneX);

    const formedAreaGen = d3
      .area<BondEnergyTrajectoryPoint>()
      .x((d) => xScale(d.extent * 100))
      .y0(() => yScale(0))
      .y1((d) => yScale(d.formedReleasedKj / sf))
      .curve(d3.curveMonotoneX);

    const netLineGen = d3
      .line<BondEnergyTrajectoryPoint>()
      .x((d) => xScale(d.extent * 100))
      .y((d) => yScale(d.netBondDeltaKj / sf))
      .curve(d3.curveMonotoneX);

    const pesLineGen = d3
      .line<BondEnergyTrajectoryPoint>()
      .x((d) => xScale(d.extent * 100))
      .y((d) => yScale(d.potentialSurfaceKj / sf))
      .curve(d3.curveMonotoneX);

    return {
      cvXScale: xScale,
      cvYScale: yScale,
      cvZeroY: yScale(0),
      brokenAreaPath: brokenAreaGen(pts) || '',
      formedAreaPath: formedAreaGen(pts) || '',
      netLinePath: netLineGen(pts) || '',
      pesLinePath: pesLineGen(pts) || '',
    };
  }, [profile, cvInnerW, cvInnerH]);

  useEffect(() => {
    if (curveAxisLeftRef.current) {
      const axisLeft = d3
        .axisLeft(cvYScale)
        .ticks(5)
        .tickFormat((d) => {
          const val = Number(d);
          if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
          return `${val}`;
        });
      const sel = d3.select(curveAxisLeftRef.current);
      sel.call(axisLeft);
      sel.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '9').attr('font-family', 'monospace');
      sel.selectAll('line').attr('stroke', '#334155');
      sel.selectAll('path').attr('stroke', '#475569');
    }

    if (curveAxisBottomRef.current) {
      const axisBottom = d3
        .axisBottom(cvXScale)
        .tickValues([0, 25, 50, 75, 100])
        .tickFormat((d) => `${d}%`);
      const sel = d3.select(curveAxisBottomRef.current);
      sel.call(axisBottom);
      sel.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '9').attr('font-family', 'monospace');
      sel.selectAll('line').attr('stroke', '#334155');
      sel.selectAll('path').attr('stroke', '#475569');
    }
  }, [cvXScale, cvYScale]);

  const handleCurvePointer = (clientX: number, seek: boolean) => {
    if (!curveSvgRef.current) return;
    const rect = curveSvgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * cvW;
    const norm = Math.max(0, Math.min(1, (svgX - cvMargin.left) / cvInnerW));
    if (seek && onSeekExtent) {
      onSeekExtent(Number(norm.toFixed(3)));
    } else {
      setHoverExtent(norm);
    }
  };

  const activeCurveX = cvXScale(kineticExtent * 100);
  const displayCurveX = cvXScale(displayExtent * 100);
  const displayNetY = cvYScale(liveSample.netBondDeltaKj / profile.scaleFactor);
  const displayBrkY = cvYScale(liveSample.brokenAbsorbedKj / profile.scaleFactor);
  const displayFrmY = cvYScale(liveSample.formedReleasedKj / profile.scaleFactor);

  const hoveredBarObj = hoveredBar
    ? waterfallData.find((d) => d.id === hoveredBar) ?? null
    : null;

  return (
    <div className="flex flex-col gap-2.5 text-slate-100">
      {/* Calibration Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/90 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-200 whitespace-nowrap">
            Real-Time Bond Energy Delta (D3)
          </span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <span className="font-mono tabular-nums text-amber-300 hidden sm:inline whitespace-nowrap leading-normal">
            <FormattedChemText text={liveSample.phase} />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
          <span className="text-slate-400 whitespace-nowrap">
            Broken (+):{' '}
            <strong className="text-amber-300">
              {formatBondEnergyValue(liveSample.brokenAbsorbedKj, profile)}
            </strong>
          </span>
          <span className="text-slate-400 whitespace-nowrap">
            Formed (−):{' '}
            <strong className="text-emerald-300">
              {formatBondEnergyValue(liveSample.formedReleasedKj, profile)}
            </strong>
          </span>
          <span className="text-slate-400 whitespace-nowrap">
            Net ΔE(t):{' '}
            <strong className={liveSample.netBondDeltaKj <= 0 ? 'text-sky-300' : 'text-rose-300'}>
              {formatBondEnergyValue(liveSample.netBondDeltaKj, profile)}
            </strong>
          </span>
          {hasCatalyst && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
              Cat. Ea = {profile.effectiveEaKj} kJ
            </span>
          )}
        </div>
      </div>

      {/* Main Split: D3 Waterfall + D3 Continuous Trajectory + Per-Bond Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        {/* Left: D3 Waterfall Energy Balance */}
        <div className="lg:col-span-4 relative bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-slate-300 font-semibold">
              Waterfall Balance ({profile.unitLabel})
            </span>
            <span className="text-slate-500">Hover bars for bonds</span>
          </div>

          <svg viewBox={`0 0 ${wfW} ${wfH}`} className="w-full h-44 sm:h-48 overflow-visible select-none">
            <g transform={`translate(${wfMargin.left}, ${wfMargin.top})`}>
              {/* D3 Y-Grid */}
              {wfYScale.ticks(5).map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={wfInnerW}
                  y1={wfYScale(t)}
                  y2={wfYScale(t)}
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              ))}

              {/* Zero Baseline */}
              <line
                x1={0}
                x2={wfInnerW}
                y1={wfZeroY}
                y2={wfZeroY}
                stroke="#64748b"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              {/* Waterfall Connector Lines */}
              {(() => {
                const bx = (wfXScale('broken') ?? 0) + wfXScale.bandwidth();
                const fx = wfXScale('formed') ?? 0;
                const fxEnd = fx + wfXScale.bandwidth();
                const nx = wfXScale('net') ?? 0;
                const topY = wfYScale(profile.totalBrokenKj / profile.scaleFactor);
                const netY = wfYScale(profile.enthalpyDeltaHKj / profile.scaleFactor);
                return (
                  <g stroke="#475569" strokeWidth="1" strokeDasharray="2 2" opacity="0.75">
                    <line x1={bx} y1={topY} x2={fx} y2={topY} />
                    <line x1={fxEnd} y1={netY} x2={nx} y2={netY} />
                  </g>
                );
              })()}

              {/* Target Ghost Bars + Live Progress Bars */}
              {waterfallData.map((d) => {
                const x = wfXScale(d.id) ?? 0;
                const bw = wfXScale.bandwidth();

                const targetY1 = wfYScale(Math.max(d.startDisplay, d.endDisplay));
                const targetY2 = wfYScale(Math.min(d.startDisplay, d.endDisplay));
                const targetH = Math.max(2, targetY2 - targetY1);

                const liveY1 = wfYScale(Math.max(d.liveStartDisplay, d.liveEndDisplay));
                const liveY2 = wfYScale(Math.min(d.liveStartDisplay, d.liveEndDisplay));
                const liveH = Math.max(1.5, liveY2 - liveY1);

                const isHovered = hoveredBar === d.id;

                return (
                  <g
                    key={d.id}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredBar(d.id);
                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (rect) {
                        setBarTooltipPos({
                          x: Math.min(rect.width - 170, Math.max(8, e.clientX - rect.left)),
                          y: 8,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredBar(null);
                      setBarTooltipPos(null);
                    }}
                  >
                    {/* Target stoichiometric envelope */}
                    <rect
                      x={x}
                      y={targetY1}
                      width={bw}
                      height={targetH}
                      rx={3}
                      fill={d.mutedColor}
                      stroke={d.color}
                      strokeWidth={isHovered ? 1.5 : 0.9}
                      strokeDasharray="3 2"
                    />
                    {/* Live animated energy bar */}
                    <rect
                      x={x + 2}
                      y={liveY1}
                      width={Math.max(4, bw - 4)}
                      height={liveH}
                      rx={2.5}
                      fill={d.color}
                      opacity={0.92}
                    />
                    {/* Live value label */}
                    <text
                      x={x + bw / 2}
                      y={liveY1 - 5}
                      textAnchor="middle"
                      fill={d.color}
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {formatBondEnergyValue(d.liveKj, profile).replace(` ${profile.unitLabel}`, '')}
                    </text>
                  </g>
                );
              })}

              {/* D3 Axis Containers */}
              <g ref={waterfallAxisLeftRef} />
              <g ref={waterfallAxisBottomRef} transform={`translate(0, ${wfInnerH})`} />
            </g>
          </svg>

          {/* Interactive Waterfall Tooltip */}
          {hoveredBarObj && barTooltipPos && (
            <div
              className="absolute z-30 w-44 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-xl pointer-events-none text-[10px]"
              style={{ left: barTooltipPos.x, top: barTooltipPos.y }}
            >
              <div className="flex items-center justify-between font-semibold text-white pb-1 border-b border-slate-800">
                <span>{hoveredBarObj.label}</span>
                <span className="font-mono text-slate-400">{hoveredBarObj.progressPct}%</span>
              </div>
              <div className="font-mono tabular-nums mt-1 text-slate-200">
                Live: <strong>{formatBondEnergyValue(hoveredBarObj.liveKj, profile)}</strong>
              </div>
              <div className="font-mono tabular-nums text-[9.5px] text-slate-400 mb-1">
                Full: {formatBondEnergyValue(hoveredBarObj.totalKj, profile)}
              </div>
              <div className="space-y-0.5 pt-1 border-t border-slate-800/80 max-h-20 overflow-hidden">
                {hoveredBarObj.bonds.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex justify-between font-mono text-[9px] text-slate-300">
                    <span className="truncate py-0.5 leading-normal">
                      {b.count}×<FormattedChemText text={b.label} />
                    </span>
                    <span>{b.totalKj >= 1e6 ? `${(b.totalKj / 1e6).toFixed(1)}G` : b.totalKj}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: D3 Continuous Energy-Delta Curve */}
        <div className="lg:col-span-5 relative bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums mb-1">
            <span className="text-slate-300 font-semibold">
              Energy Delta Trajectory ΔE(ξ)
            </span>
            <span className="text-slate-400">
              {hoverExtent !== null
                ? `Probe ξ=${Math.round(hoverExtent * 100)}% (Click to seek)`
                : `Live ξ=${Math.round(kineticExtent * 100)}%`}
            </span>
          </div>

          <svg
            ref={curveSvgRef}
            viewBox={`0 0 ${cvW} ${cvH}`}
            className="w-full h-44 sm:h-48 cursor-crosshair overflow-visible select-none"
            onMouseMove={(e) => handleCurvePointer(e.clientX, false)}
            onMouseLeave={() => setHoverExtent(null)}
            onClick={(e) => handleCurvePointer(e.clientX, true)}
          >
            <g transform={`translate(${cvMargin.left}, ${cvMargin.top})`}>
              {/* Horizontal grid */}
              {cvYScale.ticks(5).map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={cvInnerW}
                  y1={cvYScale(t)}
                  y2={cvYScale(t)}
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              ))}

              {/* Zero baseline */}
              <line
                x1={0}
                x2={cvInnerW}
                y1={cvZeroY}
                y2={cvZeroY}
                stroke="#64748b"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />

              {/* Transition State marker (50%) */}
              <line
                x1={cvXScale(50)}
                x2={cvXScale(50)}
                y1={0}
                y2={cvInnerH}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity="0.35"
              />

              {/* D3 Shaded Areas: +Broken (Endothermic) & -Formed (Exothermic) */}
              <path d={brokenAreaPath} fill="#f59e0b" opacity="0.16" />
              <path d={formedAreaPath} fill="#10b981" opacity="0.16" />

              {/* Border strokes for Broken & Formed envelopes */}
              <path d={pesLinePath} fill="none" stroke="#a855f7" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.55" />
              <path d={netLinePath} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />

              {/* Live playback hairline */}
              <line
                x1={activeCurveX}
                x2={activeCurveX}
                y1={0}
                y2={cvInnerH}
                stroke="#38bdf8"
                strokeWidth="1.2"
                opacity="0.8"
              />

              {/* Hover hairline */}
              {hoverExtent !== null && (
                <line
                  x1={displayCurveX}
                  x2={displayCurveX}
                  y1={0}
                  y2={cvInnerH}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* Live Data Points on Broken, Formed & Net Curves */}
              <circle cx={displayCurveX} cy={displayBrkY} r="3.2" fill="#f59e0b" stroke="#020617" strokeWidth="1.2" />
              <circle cx={displayCurveX} cy={displayFrmY} r="3.2" fill="#10b981" stroke="#020617" strokeWidth="1.2" />
              <circle cx={displayCurveX} cy={displayNetY} r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />

              {/* Legend */}
              <g transform="translate(6, 4)" fontSize="8.5" fontFamily="monospace">
                <rect x={0} y={0} width={7} height={7} rx={1.5} fill="#f59e0b" opacity="0.85" />
                <text x={10} y={6.5} fill="#fcd34d">+Broken</text>

                <rect x={58} y={0} width={7} height={7} rx={1.5} fill="#10b981" opacity="0.85" />
                <text x={68} y={6.5} fill="#6ee7b7">−Formed</text>

                <line x1={120} y1={3.5} x2={132} y2={3.5} stroke="#38bdf8" strokeWidth="2.2" />
                <text x={136} y={6.5} fill="#7dd3fc">Net ΔE(ξ)</text>

                <line x1={194} y1={3.5} x2={206} y2={3.5} stroke="#a855f7" strokeWidth="1.4" strokeDasharray="3 2" />
                <text x={210} y={6.5} fill="#d8b4fe">PES (Ea)</text>
              </g>

              {/* D3 Axis Containers */}
              <g ref={curveAxisLeftRef} />
              <g ref={curveAxisBottomRef} transform={`translate(0, ${cvInnerH})`} />
            </g>
          </svg>

          {/* Real-Time Trajectory Hover Tooltip */}
          {hoverExtent !== null && (
            <div className="pointer-events-none absolute top-9 right-3 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-xl text-[10px] font-mono tabular-nums z-30">
              <div className="text-slate-300 font-semibold mb-0.5">
                Coord ξ = {Math.round(hoverExtent * 100)}%
              </div>
              <div className="text-amber-300">
                Brk: {formatBondEnergyValue(liveSample.brokenAbsorbedKj, profile)}
              </div>
              <div className="text-emerald-300">
                Frm: {formatBondEnergyValue(liveSample.formedReleasedKj, profile)}
              </div>
              <div className="text-sky-300 font-bold border-t border-slate-800 mt-0.5 pt-0.5">
                ΔE: {formatBondEnergyValue(liveSample.netBondDeltaKj, profile)}
              </div>
            </div>
          )}
        </div>

        {/* Right: Per-Bond Breakdown & Stoichiometric Ledger */}
        <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2 text-[10.5px]">
          {/* Bonds Broken List */}
          <div>
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800/80">
              <span className="font-semibold text-amber-300 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Bonds Broken (+)
              </span>
              <span className="font-mono tabular-nums text-[10px] text-amber-300 font-bold">
                {formatBondEnergyValue(profile.totalBrokenKj, profile)}
              </span>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto pr-0.5">
              {profile.brokenBonds.map((b) => (
                <div key={b.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-1 font-mono tabular-nums text-[10px]">
                    <span className="text-slate-200 truncate py-0.5 leading-normal" title={`${b.speciesFormula} (${b.bondOrderLabel})`}>
                      {b.count}× <FormattedChemText text={b.label} />
                    </span>
                    <span className="text-amber-300/90 shrink-0">
                      +{formatBondEnergyValue(b.totalKj * liveSample.breakFraction, profile, false).replace(` ${profile.unitLabel}`, '')}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.round(liveSample.breakFraction * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bonds Formed List */}
          <div>
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800/80">
              <span className="font-semibold text-emerald-300 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Bonds Formed (−)
              </span>
              <span className="font-mono tabular-nums text-[10px] text-emerald-300 font-bold">
                {formatBondEnergyValue(-profile.totalFormedKj, profile)}
              </span>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto pr-0.5">
              {profile.formedBonds.map((b) => (
                <div key={b.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-1 font-mono tabular-nums text-[10px]">
                    <span className="text-slate-200 truncate py-0.5 leading-normal" title={`${b.speciesFormula} (${b.bondOrderLabel})`}>
                      {b.count}× <FormattedChemText text={b.label} />
                    </span>
                    <span className="text-emerald-300/90 shrink-0">
                      −{formatBondEnergyValue(b.totalKj * liveSample.formFraction, profile, false).replace(` ${profile.unitLabel}`, '')}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${Math.round(liveSample.formFraction * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Net Enthalpy Reconciliation Footer */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between font-mono tabular-nums text-[10px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-400" />
              ΔH = ΣBrk − ΣFrm
            </span>
            <span className={`font-bold ${profile.enthalpyDeltaHKj <= 0 ? 'text-sky-300' : 'text-rose-300'}`}>
              {formatBondEnergyValue(profile.enthalpyDeltaHKj, profile)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
