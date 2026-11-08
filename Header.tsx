import React, { useState } from 'react';
import {
  Atom,
  Compass,
  Flame,
  Wand2,
  Table,
  FlaskConical,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Info,
  X,
  Layers,
  Sparkles,
  Activity,
  BookOpen,
  Smartphone,
  MousePointer,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { soundFx } from '../utils/audio';

export type LabTab = 'atoms' | 'molecules' | 'reactions' | 'builder' | 'virtual_lab' | 'periodic_table';

interface HeaderProps {
  currentTab: LabTab;
  onTabChange: (tab: LabTab) => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  theme,
  onThemeToggle,
}) => {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [guideTab, setGuideTab] = useState<'modules' | 'controls' | 'reference'>('modules');

  const handleAudioToggle = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    soundFx.enabled = next;
    if (next) soundFx.playReactionStep();
  };

  const navItems: Array<{ id: LabTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'atoms', label: 'Atom Studio', icon: Atom },
    { id: 'molecules', label: 'Molecule Explorer', icon: Compass },
    { id: 'reactions', label: 'Reaction Sandbox', icon: Flame },
    { id: 'virtual_lab', label: 'Virtual Lab', icon: FlaskConical },
    { id: 'builder', label: 'Molecule Builder', icon: Wand2 },
    { id: 'periodic_table', label: 'Periodic Table', icon: Table },
  ];

  return (
    <>
      <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between z-30 select-none">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Atom className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-white tracking-tight">Atomix</h1>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                LAB 3D
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Chemistry & Molecular Simulation</p>
          </div>
        </div>

        {/* Mobile Tab Dropdown for instant 1-tap access on small screens */}
        <div className="relative md:hidden flex items-center mx-1 shrink-0">
          <select
            value={currentTab}
            aria-label="Select Chemistry Lab Tool"
            onChange={(e) => {
              onTabChange(e.target.value as LabTab);
              soundFx.playReactionStep();
            }}
            className="bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer shadow-sm max-w-[135px] truncate"
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.id} className="bg-slate-900 text-white font-medium">
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Center Nav Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto max-w-xl py-1 px-1 bg-slate-950/70 border border-slate-800/80 rounded-xl scrollbar-none shrink">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  soundFx.playReactionStep();
                }}
                title={item.label}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-sky-500 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Tools (Sound, Theme, Help) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAudioToggle}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={audioEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
          <button
            onClick={onThemeToggle}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Lab Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
          <button
            onClick={() => {
              setShowInfoModal(true);
              soundFx.playReactionStep();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Lab Guide & Chemistry Reference"
          >
            <Info className="w-4 h-4 text-sky-400" />
          </button>
        </div>
      </header>

      {/* Lab Guide Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col text-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Atom className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Atomix Chemistry Lab Guide</h3>
                  <p className="text-[11px] text-slate-400">Comprehensive guide to all 6 laboratory modules & tools</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close Guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Category Tabs */}
            <div className="flex items-center gap-1.5 pt-3 pb-2 border-b border-slate-800/80 shrink-0">
              <button
                onClick={() => setGuideTab('modules')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  guideTab === 'modules'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lab Modules (6)</span>
              </button>
              <button
                onClick={() => setGuideTab('controls')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  guideTab === 'controls'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Controls & Devices</span>
              </button>
              <button
                onClick={() => setGuideTab('reference')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  guideTab === 'reference'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Chemistry Reference</span>
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3.5 text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-700">
              {guideTab === 'modules' && (
                <div className="space-y-3">
                  {/* Module 1: Atom Studio */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sky-400 text-sm flex items-center gap-1.5">
                        <Atom className="w-4 h-4 text-sky-400" />
                        1. Atom Studio (Default Home Screen)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        Bohr & Quantum Orbitals
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Build any atom from fundamental particles (protons, neutrons, electrons) or select any of the 118 elements. Explore dual visualization modes:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Bohr Model</strong>: Concentric electron shells (K, L, M, N...) with live orbital velocity and quantum energy photon emission triggers (Balmer series H-alpha 656nm, H-beta 486nm).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Quantum Orbital Mode</strong>: Real 3D electron probability clouds (|Ψ|²) and boundary lobe surfaces for s, p, d, and f orbitals with wave phase coloring (+Ψ cyan, -Ψ rose).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Quantum Numbers HUD</strong>: Real-time Principal (n), Azimuthal (l), Magnetic (mₗ), and Spin (mₛ) values with Hund&apos;s rule orbital box diagrams (↑↓).</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 2: Molecule Explorer */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-cyan-400" />
                        2. Molecule Explorer & Real-Time Bond Strength Indicator
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        Morse Potential & 3D Geometry
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Inspect 3D molecular conformations (Water, Methane, Caffeine, Aspirin, Ethanol, Benzene, and more) in Ball-and-Stick or Space-Filling CPK modes:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400">•</span>
                        <span><strong>Real-Time Bond Strength Indicator</strong>: Click any bond to dynamically display live oscillating bond length r(t) in Å/pm, Morse potential diagram V(r), Bond Dissociation Energy (BDE in kJ/mol), equilibrium distance rₑ, and force constant k.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400">•</span>
                        <span><strong>Geometry Measurement</strong>: Click any 2 atoms to measure interatomic distance, or click 3 atoms for exact 3D bond angle calculations.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 3: Reaction Sandbox */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-400" />
                        3. Reaction Sandbox
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Kinetics & Thermodynamics
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Experience 3D animated molecular reaction mechanisms. Scrub through the continuous reaction coordinate from reactants, through high-energy transition state activated complexes, into final products with live enthalpy (ΔH) and activation energy (Eₐ) energy profiles.
                    </p>
                  </div>

                  {/* Module 4: Virtual Lab Workbench */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                        <FlaskConical className="w-4 h-4 text-emerald-400" />
                        4. Virtual Lab Workbench
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Wet Chemistry Simulation
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Realistic laboratory bench starting with a <strong>clean empty beaker</strong> ready for pouring:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span><strong>Glassware & Reagents</strong>: Add Beakers, Erlenmeyer flasks, test tubes, and cylinders. Dispense acids, bases, salts, redox agents, indicators, and solvents from the stockroom drawer.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span><strong>Real Chemistry Engine</strong>: Simulates precipitation (Prussian Blue, Lead Iodide, Silver Chloride), vigorous gas evolution (CO₂, H₂, O₂), indicator transitions, and thermal changes.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span><strong>Benchtop Instruments</strong>: Bunsen burner for heating, digital pH meter, temperature probe, magnetic stirrer, and closed gas collection stoppers.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 5: Molecule Builder */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-purple-400" />
                        5. Molecule Builder
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        VSEPR 3D Synthesis
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300">
                      Construct custom molecules atom-by-atom in full 3D space with <strong>real-time official IUPAC name determination</strong>, Hill formulas, molar masses, force-directed VSEPR geometry relaxation toward equilibrium bond angles, and valence octet verification.
                    </p>
                  </div>

                  {/* Module 6: Periodic Table Explorer */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sky-400 text-sm flex items-center gap-1.5">
                        <Table className="w-4 h-4 text-sky-400" />
                        6. Periodic Table Explorer
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        118 Elements & Orbital Blocks
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Comprehensive interactive periodic table optimized for desktop, tablets, and phones:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Colored Orbital Block Borders & Names</strong>: Thin 1px borders color-coded by electron subshell: <strong>s-block</strong> (Sky Blue), <strong>d-block</strong> (Amber Gold), <strong>p-block</strong> (Emerald Mint), and <strong>f-block</strong> (Purple Violet), with visible block badges on each element.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Period Numbers 1–7</strong>: Period numbers clearly displayed down the left column for intuitive quantum level navigation.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Central Bay Orbital Breakdown</strong>: Central options card for 1-tap filtering and highlighting elements by s, p, d, or f block.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Small-Screen Responsive Scrolling</strong>: Dedicated Scroll Left and Scroll Right buttons plus smooth touch swipe across all 18 groups.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {guideTab === 'controls' && (
                <div className="space-y-3">
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                      <MousePointer className="w-4 h-4 text-sky-400" />
                      3D Viewport Controls (Mouse & Touch)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="font-semibold text-sky-400 block mb-0.5">Orbit / Rotate</span>
                        <p className="text-slate-400">Left-click and drag (or one-finger drag on mobile) to rotate the 3D scene around the center.</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="font-semibold text-amber-400 block mb-0.5">Zoom In / Out</span>
                        <p className="text-slate-400">Scroll mouse wheel (or two-finger pinch gesture) to zoom smoothly into atomic details.</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="font-semibold text-emerald-400 block mb-0.5">Pan Camera</span>
                        <p className="text-slate-400">Right-click and drag (or two-finger drag) to pan the camera across the workspace.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-sky-400" />
                      Mobile & Device Usability
                    </h4>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Header Dropdown</strong>: On mobile devices, a quick selector dropdown sits directly in the top header for instant 1-tap switching between any of the 6 lab modules.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Periodic Table Horizontal Scroll</strong>: Use the dedicated &quot;Scroll Left&quot; and &quot;Scroll Right&quot; buttons or touch swipe horizontally to examine all 18 groups and lanthanide/actinide rows.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Virtual Lab Drawer</strong>: Switch seamlessly between the Workbench, Stockroom Drawer, and Analytics HUD using mobile bottom tabs.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      Audio & Theme Settings
                    </h4>
                    <div className="space-y-1 text-[11px] text-slate-300">
                      <p>• <strong>Audio Toggle (Speaker Icon)</strong>: Enables or mutes sound effects for reactions, bubbling gases, glassware handling, and quantum state jumps.</p>
                      <p>• <strong>Theme Toggle (Sun/Moon Icon)</strong>: Switch instantly between Dark Laboratory Mode (optimal for quantum clouds and glows) and Light Lab Mode.</p>
                    </div>
                  </div>
                </div>
              )}

              {guideTab === 'reference' && (
                <div className="space-y-3">
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-sky-400" />
                      Orbital Blocks & Electron Capacities
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl border border-sky-400/40 bg-sky-500/10">
                        <span className="font-bold text-sky-400 block">s-block</span>
                        <span className="text-[10px] text-slate-300 block">Groups 1–2 + H/He</span>
                        <span className="text-[11px] font-mono text-sky-300 mt-1 block">Max 2 e⁻ (1 pair)</span>
                      </div>
                      <div className="p-2 rounded-xl border border-amber-400/40 bg-amber-500/10">
                        <span className="font-bold text-amber-400 block">d-block</span>
                        <span className="text-[10px] text-slate-300 block">Groups 3–12</span>
                        <span className="text-[11px] font-mono text-amber-300 mt-1 block">Max 10 e⁻ (5 pairs)</span>
                      </div>
                      <div className="p-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10">
                        <span className="font-bold text-emerald-400 block">p-block</span>
                        <span className="text-[10px] text-slate-300 block">Groups 13–18</span>
                        <span className="text-[11px] font-mono text-emerald-300 mt-1 block">Max 6 e⁻ (3 pairs)</span>
                      </div>
                      <div className="p-2 rounded-xl border border-purple-400/40 bg-purple-500/10">
                        <span className="font-bold text-purple-400 block">f-block</span>
                        <span className="text-[10px] text-slate-300 block">Lanthanides/Actinides</span>
                        <span className="text-[11px] font-mono text-purple-300 mt-1 block">Max 14 e⁻ (7 pairs)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-1.5 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      Morse Potential & Bond Energy
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-1.5">
                      The Morse potential models the anharmonic potential energy of a diatomic bond as a function of internuclear distance r:
                    </p>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300 text-center mb-1.5">
                      V(r) = Dₑ · (1 - e^(-a·(r - rₑ)))²
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Where <strong>Dₑ</strong> is the well depth (bond dissociation energy), <strong>rₑ</strong> is the equilibrium bond length, and <strong>a</strong> controls the well width (force constant k = 2 · Dₑ · a²).
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Quantum Mechanical Postulates (n, l, mₗ, mₛ)
                    </h4>
                    <div className="space-y-1 text-[11px] text-slate-300">
                      <p>• <strong>n (Principal, n ≥ 1)</strong>: Determines overall electron energy eigenvalue Eₙ = -13.6/n² eV and radial shell distance.</p>
                      <p>• <strong>l (Azimuthal, 0 ≤ l &lt; n)</strong>: Determines orbital angular momentum |L| and 3D nodal geometry (0=s, 1=p, 2=d, 3=f).</p>
                      <p>• <strong>mₗ (Magnetic, -l ≤ mₗ ≤ +l)</strong>: Quantizes spatial orientation and z-axis angular momentum projection.</p>
                      <p>• <strong>mₛ (Spin, ±½)</strong>: Pauli exclusion enforces that no two electrons in an atom can share the identical set of 4 quantum numbers.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Atomix 3D Chemistry Simulation Suite
              </span>
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-md transition-all ml-auto"
              >
                Close & Continue Lab
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
