import React, { useMemo } from 'react';
import { MoleculeData } from '../types/chemistry';
import {
  DetectedBondAngle,
  LiveMeasurementSnapshot,
  extractMolecularAngles,
} from '../utils/geometryMeasurement';
import { Ruler, Move, RotateCcw, X, Compass } from 'lucide-react';

interface GeometryMeasurementHUDProps {
  molecule: MoleculeData;
  selectedAtomIds: string[];
  liveMeasurement: LiveMeasurementSnapshot | null;
  interactionMode: 'measure' | 'drag';
  isStructureModified: boolean;
  onSetInteractionMode: (mode: 'measure' | 'drag') => void;
  onSelectPresetAtoms: (atomIds: string[]) => void;
  onClearSelection: () => void;
  onResetGeometry: () => void;
  onClose: () => void;
}

export const GeometryMeasurementHUD: React.FC<GeometryMeasurementHUDProps> = ({
  molecule,
  selectedAtomIds,
  liveMeasurement,
  interactionMode,
  isStructureModified,
  onSetInteractionMode,
  onSelectPresetAtoms,
  onClearSelection,
  onResetGeometry,
  onClose,
}) => {
  const detectedAngles = useMemo(() => extractMolecularAngles(molecule), [molecule]);

  const atomById = useMemo(() => {
    return new Map(molecule.atoms.map((a) => [a.id, a]));
  }, [molecule.atoms]);

  // Quick-pick bonds for 1-click 2-atom length measurement
  const quickBonds = useMemo(() => molecule.bonds.slice(0, 10), [molecule.bonds]);

  const selectedAtomDisplay = selectedAtomIds.map((id) => {
    const atom = atomById.get(id);
    return atom ? `${atom.element}(${atom.id})` : id;
  });

  const eqDelta =
    liveMeasurement?.mode === 'distance' &&
    liveMeasurement.distance &&
    liveMeasurement.equilibriumAngstroms
      ? Number(
          (liveMeasurement.distance.angstroms - liveMeasurement.equilibriumAngstroms).toFixed(3)
        )
      : null;

  const eqStrainPct =
    eqDelta !== null && liveMeasurement?.equilibriumAngstroms
      ? Number(((eqDelta / liveMeasurement.equilibriumAngstroms) * 100).toFixed(1))
      : null;

  return (
    <div className="bg-slate-900/95 border border-slate-700/90 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex flex-col gap-2.5 max-w-sm w-full pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Ruler className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">
              Real-Time Geometry Measurement
            </h4>
            <p className="text-[10px] text-slate-400 truncate">
              Live bond lengths &amp; angles during vibration or drag
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Close Geometry Tool"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Interaction Mode Segmented Toggle */}
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => onSetInteractionMode('measure')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              interactionMode === 'measure'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>Orbit &amp; Pick</span>
          </button>
          <button
            onClick={() => onSetInteractionMode('drag')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              interactionMode === 'drag'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Move className="w-3.5 h-3.5 shrink-0" />
            <span>Drag Atom (3D)</span>
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
          <span>
            {interactionMode === 'drag'
              ? 'Drag any atom in 3D to bend angles & stretch bonds'
              : 'Click 2 atoms for length, 3 for angle · Shift+Drag to move'}
          </span>
        </div>
      </div>

      {/* Active Selection Sequence */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-300">
            {selectedAtomIds.length === 0 && 'No atoms selected'}
            {selectedAtomIds.length === 1 && `Anchor A: ${selectedAtomDisplay[0]}`}
            {selectedAtomIds.length === 2 &&
              `Length: ${selectedAtomDisplay[0]} — ${selectedAtomDisplay[1]}`}
            {selectedAtomIds.length === 3 &&
              `Angle: ${selectedAtomDisplay[0]} — ${selectedAtomDisplay[1]} — ${selectedAtomDisplay[2]}`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isStructureModified && (
              <button
                onClick={onResetGeometry}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 whitespace-nowrap"
                title="Restore Equilibrium VSEPR Coordinates"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
            {selectedAtomIds.length > 0 && (
              <button
                onClick={onClearSelection}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-medium whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Live Readout: 2-Atom Distance */}
        {liveMeasurement?.mode === 'distance' && liveMeasurement.distance && (
          <div className="pt-2 border-t border-slate-800/90 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-slate-400">
                {liveMeasurement.isDirectBond ? 'Live Bond Length' : 'Interatomic Distance'}
              </span>
              <div className="font-mono tabular-nums text-right">
                <span className="text-lg font-bold text-cyan-300">
                  {liveMeasurement.distance.angstroms.toFixed(3)} Å
                </span>
                <span className="text-[11px] text-slate-400 ml-1.5">
                  ({liveMeasurement.distance.picometers.toFixed(1)} pm)
                </span>
              </div>
            </div>

            {liveMeasurement.isDirectBond && liveMeasurement.equilibriumAngstroms && (
              <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                <span>
                  Equilibrium r₀: {liveMeasurement.equilibriumAngstroms.toFixed(2)} Å
                </span>
                {eqDelta !== null && (
                  <span
                    className={
                      Math.abs(eqDelta) < 0.005
                        ? 'text-slate-400'
                        : eqDelta > 0
                        ? 'text-rose-400'
                        : 'text-sky-400'
                    }
                  >
                    Δr {eqDelta >= 0 ? `+${eqDelta.toFixed(3)}` : eqDelta.toFixed(3)} Å (
                    {eqStrainPct !== null && eqStrainPct >= 0 ? `+${eqStrainPct}` : eqStrainPct}%)
                  </span>
                )}
              </div>
            )}

            <p className="text-[10px] text-slate-500">
              Click a 3rd atom to measure the bond angle with {selectedAtomDisplay[1]} as vertex.
            </p>
          </div>
        )}

        {/* Live Readout: 3-Atom Bond Angle + Both Leg Lengths */}
        {liveMeasurement?.mode === 'angle' && liveMeasurement.angle && (
          <div className="pt-2 border-t border-slate-800/90 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">
                  Bond Angle (Vertex {selectedAtomDisplay[1]})
                </span>
                <span className="text-[10px] font-mono tabular-nums text-slate-500">
                  {liveMeasurement.angle.radians.toFixed(3)} rad
                </span>
              </div>
              <div className="font-mono tabular-nums text-right">
                <span className="text-xl font-bold text-amber-300">
                  ∠ {liveMeasurement.angle.degrees.toFixed(1)}°
                </span>
              </div>
            </div>

            {/* Deviation vs Ideal VSEPR Angle */}
            {liveMeasurement.angle.idealDegrees !== null &&
              liveMeasurement.angle.deviationDeg !== null && (
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                  <span>Ideal VSEPR: {liveMeasurement.angle.idealDegrees}°</span>
                  <span
                    className={
                      Math.abs(liveMeasurement.angle.deviationDeg) < 0.5
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }
                  >
                    Δ{' '}
                    {liveMeasurement.angle.deviationDeg >= 0
                      ? `+${liveMeasurement.angle.deviationDeg.toFixed(1)}`
                      : liveMeasurement.angle.deviationDeg.toFixed(1)}
                    °
                  </span>
                </div>
              )}

            {/* Live Leg Bond Lengths */}
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono tabular-nums">
              <div className="flex flex-col">
                <span className="text-slate-500 truncate">
                  {selectedAtomDisplay[0]}—{selectedAtomDisplay[1]}
                </span>
                <span className="text-cyan-300 font-semibold">
                  {liveMeasurement.angle.leg1Angstroms.toFixed(3)} Å (
                  {(liveMeasurement.angle.leg1Angstroms * 100).toFixed(1)} pm)
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-slate-500 truncate">
                  {selectedAtomDisplay[1]}—{selectedAtomDisplay[2]}
                </span>
                <span className="text-cyan-300 font-semibold">
                  {liveMeasurement.angle.leg2Angstroms.toFixed(3)} Å (
                  {(liveMeasurement.angle.leg2Angstroms * 100).toFixed(1)} pm)
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedAtomIds.length === 1 && (
          <p className="text-[10px] text-slate-400">
            Click a second atom in the 3D scene to measure live distance, then a third for bond angle.
          </p>
        )}
      </div>

      {/* Quick-Pick Detected Angles & Bonds */}
      {(detectedAngles.length > 0 || quickBonds.length > 0) && (
        <div className="flex flex-col gap-2 pt-1">
          {detectedAngles.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-slate-400">
                Quick-Pick Bond Angles ({detectedAngles.length})
              </span>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                {detectedAngles.map((ang: DetectedBondAngle) => {
                  const isActive =
                    selectedAtomIds.length === 3 &&
                    selectedAtomIds[0] === ang.atomIds[0] &&
                    selectedAtomIds[1] === ang.atomIds[1] &&
                    selectedAtomIds[2] === ang.atomIds[2];
                  return (
                    <button
                      key={ang.id}
                      onClick={() => onSelectPresetAtoms(ang.atomIds)}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono tabular-nums transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`Measure ${ang.detailLabel} (Eq: ${ang.equilibriumDegrees}°)`}
                    >
                      {ang.detailLabel} · {ang.equilibriumDegrees}°
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {quickBonds.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-slate-400">
                Quick-Pick Bond Lengths
              </span>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-0.5">
                {quickBonds.map((b) => {
                  const isActive =
                    selectedAtomIds.length === 2 &&
                    ((selectedAtomIds[0] === b.from && selectedAtomIds[1] === b.to) ||
                      (selectedAtomIds[0] === b.to && selectedAtomIds[1] === b.from));
                  const orderSym = b.order === 3 ? '≡' : b.order === 2 ? '=' : '—';
                  return (
                    <button
                      key={b.id}
                      onClick={() => onSelectPresetAtoms([b.from, b.to])}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono tabular-nums transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {b.from}
                      {orderSym}
                      {b.to}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
