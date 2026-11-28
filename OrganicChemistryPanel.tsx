import React from 'react';
import {
  Activity,
  AlertTriangle,
  Atom,
  CheckCircle,
  Droplets,
  Flame,
  FlaskConical,
  GitBranch,
  Layers,
  ShieldCheck,
  Sparkles,
  Zap,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { OrganicChemistryReport, ResonanceContributor } from '../utils/organicChemistryAnalysis';

export type ChemPanelTab = 'properties' | 'resonance' | 'organic';

interface OrganicChemistryPanelProps {
  report: OrganicChemistryReport;
  activeTab: ChemPanelTab;
  onTabChange: (tab: ChemPanelTab) => void;
  onHighlightAtoms?: (atomIds: string[]) => void;
  contributors?: ResonanceContributor[];
  isResonancePlaying?: boolean;
  activeContributorIdx?: number;
  resonanceSpeedMs?: number;
  onToggleResonancePlay?: () => void;
  onStopResonance?: () => void;
  onStepContributor?: (delta: -1 | 1) => void;
  onSelectContributor?: (idx: number) => void;
  onChangeSpeedMs?: (ms: number) => void;
}

export const OrganicChemistryPanel: React.FC<OrganicChemistryPanelProps> = ({
  report,
  activeTab,
  onTabChange,
  onHighlightAtoms,
  contributors = [],
  isResonancePlaying = false,
  activeContributorIdx = 0,
  resonanceSpeedMs = 1150,
  onToggleResonancePlay,
  onStopResonance,
  onStepContributor,
  onSelectContributor,
  onChangeSpeedMs,
}) => {
  const currentContributor =
    contributors.length > 0 ? contributors[activeContributorIdx % contributors.length] : null;
  if (report.isEmpty) {
    return (
      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400">
        Add atoms in the Molecule Builder to compute chemical properties, resonance structures, and organic chemistry analysis.
      </div>
    );
  }

  const polarityBadgeStyle =
    report.polarityClass === 'Charged Ion'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : report.polarityClass === 'Polar Molecule'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      : report.polarityClass === 'Moderately Polar'
      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  return (
    <div className="rounded-xl bg-slate-950/95 border border-slate-800/90 shadow-xl overflow-hidden flex flex-col">
      {/* Segmented Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/90 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('properties')}
          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'properties'
              ? 'bg-sky-500/25 text-sky-200 border border-sky-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">Properties</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('resonance')}
          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'resonance'
              ? 'bg-violet-500/25 text-violet-200 border border-violet-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="truncate">Resonance</span>
          {report.hasResonance && (
            <span className="px-1.5 py-0.2 rounded-full bg-violet-500/30 border border-violet-400/50 text-[9px] font-mono font-bold text-violet-200">
              {report.resonanceSystems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('organic')}
          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'organic'
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <Atom className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">Organic</span>
          {report.functionalGroups.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[9px] font-mono font-bold text-emerald-200">
              {report.functionalGroups.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-2.5 space-y-2.5 text-[11px] text-slate-200 overflow-y-auto max-h-[38dvh] md:max-h-[44dvh] scrollbar-thin scrollbar-thumb-slate-700">
        {/* ================= TAB 1: CHEMICAL PROPERTIES ================= */}
        {activeTab === 'properties' && (
          <div className="space-y-2.5">
            {/* Quick Quantitative Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-[9.5px] uppercase tracking-wider text-slate-400 font-mono block">
                  Unsaturation (IHD)
                </span>
                <span className="text-sm font-black font-mono text-amber-300">
                  {report.ihd}
                </span>
                <span className="text-[9px] text-slate-400 block truncate" title={report.ihdBreakdown}>
                  {report.ihdBreakdown}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-[9.5px] uppercase tracking-wider text-slate-400 font-mono block">
                  Bonds (σ / π)
                </span>
                <span className="text-sm font-black font-mono text-sky-300">
                  {report.sigmaBondCount}σ • {report.piBondCount}π
                </span>
                <span className="text-[9px] text-slate-400 block truncate">
                  {report.ringCount} cycle{report.ringCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-[9.5px] uppercase tracking-wider text-slate-400 font-mono block">
                  Valence e⁻ / LP
                </span>
                <span className="text-sm font-black font-mono text-cyan-300">
                  {report.totalValenceElectrons}e⁻ • {report.totalLonePairs}lp
                </span>
                <span className="text-[9px] text-slate-400 block truncate">
                  Charge: {report.netCharge > 0 ? `+${report.netCharge}` : report.netCharge}
                </span>
              </div>
            </div>

            {/* Polarity & 3D Dipole Moment */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  Molecular Polarity &amp; 3D Dipole
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${polarityBadgeStyle}`}>
                  {report.polarityClass}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300 leading-relaxed">{report.polarityReason}</p>
              <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Max Bond ΔEN: {report.maxBondDeltaEN.toFixed(2)}</span>
                <span>Net Vector μ_est: {report.dipoleMagnitudeEstimate.toFixed(2)}</span>
              </div>
            </div>

            {/* Intermolecular Forces & Solubility */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  Intermolecular Forces &amp; Solubility
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-mono text-[9.5px] font-semibold">
                  {report.dominantIMF}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">H-Bond Donors:</span>
                  <strong className="text-cyan-300">{report.hBondDonors}</strong>
                </div>
                <div className="px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">H-Bond Acceptors:</span>
                  <strong className="text-cyan-300">{report.hBondAcceptors}</strong>
                </div>
              </div>
              <p className="text-[10.5px] text-slate-300 leading-snug">
                <span className="text-slate-400 font-semibold">Solubility:</span> {report.solubilityEstimate}
              </p>
            </div>

            {/* Acid-Base Character */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Acid–Base Behavior
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-300 font-semibold text-[9.5px]">
                  {report.acidBaseCharacter}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-300 leading-relaxed">{report.acidBaseDetails}</p>
            </div>

            {/* Octet / Duet Compliance */}
            <div
              className={`p-2 rounded-xl border flex items-start gap-2 ${
                report.octetSummary.allSatisfied
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              }`}
            >
              {report.octetSummary.allSatisfied ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="text-[10px] leading-snug space-y-0.5">
                {report.octetSummary.allSatisfied ? (
                  <span>All atoms satisfy the Octet / Duet valence rule.</span>
                ) : (
                  <>
                    {report.octetSummary.deficientAtoms.length > 0 && (
                      <div>
                        <strong>Electron-Deficient (&lt;8e⁻):</strong> {report.octetSummary.deficientAtoms.join(', ')}
                      </div>
                    )}
                    {report.octetSummary.expandedAtoms.length > 0 && (
                      <div>
                        <strong>Expanded Octet (&gt;8e⁻):</strong> {report.octetSummary.expandedAtoms.join(', ')}
                      </div>
                    )}
                    {report.octetSummary.radicalAtoms.length > 0 && (
                      <div>
                        <strong>Unpaired Radical e⁻:</strong> {report.octetSummary.radicalAtoms.join(', ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: RESONANCE & CONJUGATION ================= */}
        {activeTab === 'resonance' && (
          <div className="space-y-2.5">
            {/* Status Header */}
            <div
              className={`p-2.5 rounded-xl border ${
                report.hasResonance
                  ? 'bg-gradient-to-r from-violet-950/70 via-slate-900 to-fuchsia-950/60 border-violet-500/50'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                  <Sparkles className={`w-3.5 h-3.5 ${report.hasResonance ? 'text-violet-400' : 'text-slate-400'}`} />
                  {report.hasResonance ? 'Resonance Exhibited (Delocalized π / n)' : 'No π-Resonance (Localized Structure)'}
                </span>
                {report.hasResonance ? (
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/25 border border-violet-400/50 text-violet-200 font-mono text-[9.5px] font-bold">
                    {report.resonanceSystems.length} System{report.resonanceSystems.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[9.5px]">
                    Localized
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-300 mt-1 leading-relaxed">{report.resonanceSummary}</p>

              {/* Summary chips of Resonance Types */}
              {report.resonanceTypesPresent.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-violet-500/20">
                  {report.resonanceTypesPresent.map((rType) => (
                    <span
                      key={rType}
                      className="px-2 py-0.5 rounded-md bg-violet-900/50 border border-violet-500/40 text-violet-200 text-[9.5px] font-semibold"
                    >
                      {rType}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Continuous Resonance Animator */}
            {report.hasResonance && contributors.length >= 2 && (
              <div className="p-2.5 rounded-xl bg-slate-900/95 border border-fuchsia-500/45 shadow-lg space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-fuchsia-200 flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isResonancePlaying ? 'bg-emerald-400 animate-ping' : 'bg-fuchsia-400'
                      }`}
                    />
                    Continuous Resonance Animator
                  </span>

                  <div className="flex items-center gap-1">
                    {([
                      { label: 'Slow', ms: 1650 },
                      { label: '1x', ms: 1150 },
                      { label: 'Fast', ms: 650 },
                    ] as const).map((sp) => (
                      <button
                        key={sp.label}
                        type="button"
                        onClick={() => onChangeSpeedMs && onChangeSpeedMs(sp.ms)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                          resonanceSpeedMs === sp.ms
                            ? 'bg-fuchsia-500/30 border-fuchsia-400 text-fuchsia-100 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Play / Pause / Step / Stop Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleResonancePlay && onToggleResonancePlay()}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all shadow-sm ${
                      isResonancePlaying
                        ? 'bg-amber-500/25 hover:bg-amber-500/35 border-amber-400/60 text-amber-200'
                        : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-fuchsia-400/60 text-white'
                    }`}
                  >
                    {isResonancePlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Resonance</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Resonance</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onStepContributor && onStepContributor(-1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                    title="Previous Resonance Structure"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStepContributor && onStepContributor(1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                    title="Next Resonance Structure"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStopResonance && onStopResonance()}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200"
                    title="Reset to Form 1"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                </div>

                {/* Contributor Selector Pills */}
                <div className="flex flex-wrap gap-1">
                  {contributors.map((c, idx) => (
                    <button
                      key={c.index}
                      type="button"
                      onClick={() => onSelectContributor && onSelectContributor(idx)}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono border transition-all ${
                        idx === activeContributorIdx
                          ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100 font-bold shadow-sm'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Form {idx + 1}
                    </button>
                  ))}
                </div>

                {/* Live Active Contributor Readout */}
                {currentContributor && (
                  <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-[10.5px]">
                        Form {currentContributor.index + 1}/{contributors.length}: {currentContributor.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-violet-950 border border-violet-500/40 text-violet-200 text-[9px] font-mono">
                        {currentContributor.weightTag}
                      </span>
                    </div>
                    <p className="text-[10px] text-cyan-200 leading-snug">{currentContributor.description}</p>
                    <p className="text-[9.5px] text-fuchsia-300/90 font-mono leading-snug">
                      {currentContributor.arrowSummary}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Individual Resonance Systems */}
            {report.hasResonance ? (
              <div className="space-y-2">
                {report.resonanceSystems.map((sys) => {
                  const cardBorder =
                    sys.severity === 'warning'
                      ? 'border-amber-500/50 bg-amber-950/20'
                      : sys.severity === 'equivalent'
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : sys.severity === 'primary'
                      ? 'border-violet-500/40 bg-violet-950/20'
                      : 'border-sky-500/35 bg-sky-950/20';

                  const badgeColors =
                    sys.severity === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : sys.severity === 'equivalent'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : sys.severity === 'primary'
                      ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40';

                  return (
                    <div key={sys.id} className={`p-2.5 rounded-xl border space-y-1.5 ${cardBorder}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-[11.5px] leading-tight">{sys.title}</div>
                          <div className="text-[9.5px] font-mono text-violet-300 mt-0.5">Type: {sys.type}</div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${badgeColors}`}>
                          {sys.categoryBadge}
                        </span>
                      </div>

                      {/* Conjugated Path & Metrics */}
                      <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono">
                        <button
                          type="button"
                          onClick={() => onHighlightAtoms && sys.atomIds[0] && onHighlightAtoms(sys.atomIds)}
                          className="text-left px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-violet-500/50 transition-colors"
                          title="Click to select first conjugated atom in 3D"
                        >
                          <span className="text-slate-400 block text-[8.5px]">Conjugated Path:</span>
                          <span className="text-cyan-300 font-bold truncate block">{sys.pathNotation}</span>
                        </button>
                        <div className="px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800">
                          <span className="text-slate-400 block text-[8.5px]">Contributors &amp; π e⁻:</span>
                          <span className="text-amber-300 font-bold">
                            {sys.contributingStructuresCount} forms • {sys.delocalizedElectrons} e⁻
                          </span>
                        </div>
                      </div>

                      <div className="px-2 py-1 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[10px] font-mono text-emerald-300">
                        <span className="text-slate-400">Hybrid Bond Order: </span>
                        <strong>{sys.effectiveBondOrder}</strong>
                      </div>

                      <p className="text-[10px] text-sky-200 leading-snug">
                        <strong className="text-sky-300">Curved-Arrow Flow:</strong> {sys.electronFlowSummary}
                      </p>
                      <p className="text-[10px] text-slate-300 leading-snug">{sys.explanation}</p>
                      <p className="text-[10px] text-emerald-300/95 leading-snug pt-1 border-t border-slate-800/70">
                        <strong className="text-emerald-300">Chemical Effect:</strong> {sys.stabilityEffect}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5 text-[10.5px] text-slate-300">
                <div className="font-semibold text-slate-200">Why is there no resonance here?</div>
                <p className="leading-relaxed">
                  Resonance requires overlapping parallel <em>p</em> orbitals — such as alternating multiple bonds (<code>π–σ–π</code>), a lone pair next to a <code>π</code> bond (<code>n–π</code>), or a vacant <em>p</em> orbital (like <code>C⁺</code> or <code>B</code>) next to a <code>π</code> bond or lone pair.
                </p>
                <p className="text-[10px] text-sky-300/90">
                  Tip: Try building <strong>Benzene</strong>, <strong>Acetate (–COO⁻)</strong>, <strong>Acetamide</strong>, or <strong>1,3-Butadiene</strong> from the Organic &amp; Resonance presets below!
                </p>
              </div>
            )}

            {/* Hyperconjugation Note (distinguished from true π resonance) */}
            {report.hyperconjugationNote && (
              <div className="p-2 rounded-xl bg-indigo-950/35 border border-indigo-500/30 text-[10px] text-indigo-200 leading-snug">
                <strong className="text-indigo-300">Secondary Delocalization — </strong>
                {report.hyperconjugationNote}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: ORGANIC CHEMISTRY INFO ================= */}
        {activeTab === 'organic' && (
          <div className="space-y-2.5">
            {/* Aromaticity & Hückel Status */}
            <div className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Aromaticity (Hückel 4n + 2)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                    report.aromaticityStatus === 'Aromatic (4n+2 π)'
                      ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                      : report.aromaticityStatus === 'Antiaromatic (4n π)'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {report.aromaticityStatus}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-snug">{report.aromaticityDetails}</p>
            </div>

            {/* Functional Groups */}
            <div className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Functional Groups Detected
                </span>
                <span className="text-[9.5px] font-mono text-slate-400">
                  {report.functionalGroups.length} type{report.functionalGroups.length === 1 ? '' : 's'}
                </span>
              </div>

              {report.functionalGroups.length > 0 ? (
                <div className="space-y-1.5">
                  {report.functionalGroups.map((fg) => (
                    <div
                      key={fg.name}
                      className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-mono text-[9.5px] font-bold">
                            {fg.symbol}
                          </span>
                          <span className="font-bold text-white text-[10.5px]">
                            {fg.name}
                            {fg.count > 1 ? ` (×${fg.count})` : ''}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {fg.polarity}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-snug">{fg.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  {report.isOrganic
                    ? 'Saturated hydrocarbon / alkane C–C and C–H framework (no heteroatom or π functional groups).'
                    : 'Inorganic system — add Carbon (C) atoms to analyze organic functional groups.'}
                </p>
              )}
            </div>

            {/* Carbon Hybridization & Substitution Degrees */}
            {report.isOrganic && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1">
                  <span className="text-[9.5px] font-semibold text-slate-300 block">Carbon Hybridization</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[9.5px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-300">
                      sp³: {report.carbonHybridizationCounts.sp3}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-violet-300">
                      sp²: {report.carbonHybridizationCounts.sp2}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300">
                      sp: {report.carbonHybridizationCounts.sp}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1">
                  <span className="text-[9.5px] font-semibold text-slate-300 block">Carbon Degree (C–C)</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[9.5px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-300">
                      1°: {report.carbonDegrees.primary}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-300">
                      2°: {report.carbonDegrees.secondary}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-300">
                      3°: {report.carbonDegrees.tertiary}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-300">
                      4°: {report.carbonDegrees.quaternary}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Inductive Effects & Reactivity */}
            <div className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Electronic Effects &amp; Reactivity
              </div>
              <p className="text-[10px] text-slate-300 leading-snug">
                <strong className="text-sky-300">Inductive (±I):</strong> {report.inductiveSummary}
              </p>
              {report.reactivityHighlights.length > 0 && (
                <ul className="space-y-0.5 pt-1 border-t border-slate-800/80 text-[10px] text-slate-300 list-disc pl-4">
                  {report.reactivityHighlights.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Heavy Atom Hybridization & Lone Pair Roster */}
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[9.5px] font-semibold text-slate-300 block">
                Atom Hybridization &amp; Lone Pairs
              </span>
              <div className="flex flex-wrap gap-1">
                {report.atomProfiles
                  .filter((p) => p.element !== 'H')
                  .slice(0, 18)
                  .map((p) => (
                    <button
                      key={p.atomId}
                      type="button"
                      onClick={() => onHighlightAtoms && onHighlightAtoms([p.atomId])}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                        p.resonanceAdjusted
                          ? 'bg-violet-950/60 border-violet-500/40 text-violet-200'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-sky-500/40'
                      }`}
                      title={
                        p.resonanceAdjusted
                          ? `Steric ${p.stericHybridization} → Resonance-adjusted ${p.effectiveHybridization} (lone pair delocalized)`
                          : `${p.atomId}: ${p.effectiveHybridization}, ${p.lonePairs} lone pair(s)`
                      }
                    >
                      <strong>{p.atomId}</strong>:{p.effectiveHybridization}
                      {p.lonePairs > 0 ? `(${p.lonePairs}lp)` : ''}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
