import React, { useState } from 'react';
import {
  Atom,
  ChevronDown,
  ChevronUp,
  Layers,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SHELL_NAMES } from '../data/elements';

export type ElectronViewMode = 'bohr' | 'orbitals' | 'both';

interface ElectronViewControlPanelProps {
  modelMode: ElectronViewMode;
  onChangeModelMode: (mode: ElectronViewMode) => void;
  // Bohr options
  showRings: boolean;
  onToggleRings: () => void;
  currentShells: number[];
  electrons: number;
  activeOrbitalLabel: string;
}

export const ElectronViewControlPanel: React.FC<ElectronViewControlPanelProps> = React.memo(({
  modelMode,
  onChangeModelMode,
  showRings,
  onToggleRings,
  currentShells,
  electrons,
  activeOrbitalLabel,
}) => {
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const isBohrActive = modelMode === 'bohr' || modelMode === 'both';

  return (
    <div className="w-80 sm:w-96 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/70 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate">
            Electron Representation
          </span>
          <span
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${
              modelMode === 'bohr'
                ? 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                : modelMode === 'orbitals'
                ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
            }`}
          >
            {modelMode === 'bohr'
              ? 'Bohr Model'
              : modelMode === 'orbitals'
              ? 'Quantum Cloud'
              : 'Overlay Compare'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setPanelCollapsed((prev) => !prev)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors cursor-pointer shrink-0"
          title={panelCollapsed ? 'Expand Electron Control Panel' : 'Collapse Electron Control Panel'}
        >
          {panelCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Primary Segmented Mode Switcher (Always Visible) */}
      <div className="p-2 border-b border-slate-800/80 bg-slate-950/60">
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onChangeModelMode('bohr')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              modelMode === 'bohr'
                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Classical Bohr model with quantized circular shell orbits"
          >
            <Atom className="w-3.5 h-3.5 shrink-0" />
            <span>Bohr</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeModelMode('orbitals')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              modelMode === 'orbitals'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Quantum mechanical electron probability density cloud |Ψ|²"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Quantum Cloud</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeModelMode('both')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              modelMode === 'both'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Superimpose Bohr shells over the Quantum Probability Cloud to compare"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Compare</span>
          </button>
        </div>
      </div>

      {/* Collapsible Controls Body */}
      {!panelCollapsed && (
        <div className="p-2.5 flex flex-col gap-2.5 text-xs">
          {/* Model Physics Summary */}
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800/90 text-[10.5px] text-slate-300 leading-snug">
            {modelMode === 'bohr' ? (
              <span>
                <strong className="text-sky-300">Bohr Shell Model:</strong> Discrete electrons orbit at quantized radii{' '}
                <span className="font-mono text-sky-200">rₙ = n²a₀</span> with fixed angular momentum.
              </span>
            ) : modelMode === 'orbitals' ? (
              <span>
                <strong className="text-cyan-300">Quantum Cloud (|Ψ|²):</strong> Probabilistic 3D wavefunction density{' '}
                <span className="font-mono text-cyan-200">{activeOrbitalLabel}</span> replacing fixed paths.
              </span>
            ) : (
              <span>
                <strong className="text-amber-300">Dual Overlay Mode:</strong> Compare fixed Bohr shell radii directly against the{' '}
                <span className="font-mono text-cyan-200">|Ψ|²</span> probability cloud.
              </span>
            )}
          </div>

          {/* Bohr Controls Section */}
          {isBohrActive && (
            <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-sky-300 flex items-center gap-1.5">
                  <Atom className="w-3 h-3" />
                  Bohr Shell Parameters ({electrons} e⁻)
                </span>
                <button
                  type="button"
                  onClick={onToggleRings}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showRings
                      ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {showRings ? 'Orbit Rings: On' : 'Orbit Rings: Off'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1 font-mono tabular-nums text-[10px]">
                {currentShells.map((cnt, idx) => (
                  <span
                    key={idx}
                    className={`px-1.5 py-0.5 rounded border ${
                      idx === currentShells.length - 1
                        ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                    title={idx === currentShells.length - 1 ? 'Valence Shell' : 'Core Shell'}
                  >
                    {SHELL_NAMES[idx] || `n${idx + 1}`}:{cnt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
