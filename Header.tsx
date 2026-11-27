import React, { useState, useEffect, useCallback } from 'react';
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
  Maximize2,
  Minimize2,
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);

  const getFullscreenElement = (): Element | null => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      mozFullScreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };
    return (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      null
    );
  };

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    document.addEventListener('mozfullscreenchange', syncFullscreen);
    document.addEventListener('MSFullscreenChange', syncFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      document.removeEventListener('mozfullscreenchange', syncFullscreen);
      document.removeEventListener('MSFullscreenChange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!fullscreenNotice) return;
    const timer = window.setTimeout(() => setFullscreenNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [fullscreenNotice]);

  const handleToggleFullscreen = useCallback(async () => {
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      mozRequestFullScreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      mozCancelFullScreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    try {
      if (!getFullscreenElement()) {
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen();
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
        } else if (rootEl.mozRequestFullScreen) {
          await rootEl.mozRequestFullScreen();
        } else if (rootEl.msRequestFullscreen) {
          await rootEl.msRequestFullscreen();
        } else {
          setFullscreenNotice('Fullscreen mode is not supported by this browser.');
          return;
        }
        soundFx.playReactionStep();
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        soundFx.playReactionStep();
      }
    } catch {
      setFullscreenNotice('Fullscreen is blocked in this embedded view. Open in a standalone tab for fullscreen.');
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleFullscreen]);

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

        {/* Right Tools (Sound, Theme, Fullscreen, Help) */}
        <div className="flex items-center gap-1.5 relative">
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
            onClick={() => void handleToggleFullscreen()}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen Mode' : 'Enter Fullscreen Mode'}
            className={`flex items-center gap-1.5 px-2 py-2 xl:px-2.5 rounded-xl text-xs font-medium transition-colors border ${
              isFullscreen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (F or Esc)' : 'Show Website in Fullscreen (F)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-sky-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-sky-400" />
            )}
            <span className="hidden xl:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
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

          {fullscreenNotice && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-amber-500/40 bg-slate-900/95 px-3 py-2 text-[11px] text-amber-200 shadow-xl backdrop-blur-md">
              {fullscreenNotice}
            </div>
          )}
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
                  <p className="text-[11px] text-slate-400">Up-to-date guide to all 6 laboratory modules, tools &amp; spectroscopy panels</p>
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
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="font-bold text-sky-400 text-sm flex items-center gap-1.5">
                        <Atom className="w-4 h-4 text-sky-400" />
                        1. Atom Studio (Default Home Screen)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        Bohr, Quantum Orbitals &amp; Isotopes
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Build any atom from protons, neutrons, and electrons, or explore all 118 elements with interactive nuclear and quantum views:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Bohr Model &amp; Emission Photons</strong>: Concentric electron shells (K, L, M, N...) with orbital velocity, shell toggles, and quantum energy emission transitions (Balmer series H-alpha 656 nm, H-beta 486 nm).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Quantum Orbital Mode</strong>: Real 3D electron probability clouds (|Ψ|²), boundary surfaces, and hybrid views for s, p, d, and f orbitals with wave phase coloring (+Ψ cyan, -Ψ rose).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Isotopes &amp; Quantum Numbers HUD</strong>: Standard IUPAC nuclide notation (ᴬ_Z X) with isotope stability &amp; half-life inspection, plus live (n, l, mₗ, mₛ) quantum numbers and orbital box diagrams (↑↓).</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 2: Molecule Explorer */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-cyan-400" />
                        2. Molecule Explorer &amp; Spectroscopy Suite
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        Morse Potential, IR, NMR &amp; MS
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Inspect 25 3D molecules (Water, Methane, Caffeine, Aspirin, Ethanol, Benzene, and more) in Ball-and-Stick, Space-Filling CPK, and Wireframe modes:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400">•</span>
                        <span><strong>Real-Time Bond Strength Indicator</strong>: Click any bond to view live oscillating bond length r(t), Morse potential curve V(r), Bond Dissociation Energy (BDE), equilibrium length rₑ, and force constant k.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400">•</span>
                        <span><strong>IR, NMR &amp; Mass Spectrometry Panels</strong>: Analyze predicted IR vibrational peaks, ¹H/¹³C NMR chemical shifts &amp; multiplicity, and Mass Spec m/z fragmentation patterns directly for the active molecule.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-cyan-400">•</span>
                        <span><strong>3D Geometry Measurement</strong>: Click 2 atoms to measure interatomic distance (Å/pm), or click 3 atoms for exact 3D bond angle calculations.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 3: Reaction Sandbox */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-400" />
                        3. Reaction Sandbox (27 Mechanisms)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Kinetics ODE &amp; Bond Energy
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Explore 27 animated 3D reaction mechanisms from reactants through transition-state complexes to products:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-400">•</span>
                        <span><strong>Energy Profile &amp; Bond Energy D3 Panel</strong>: Scrub the reaction coordinate with live enthalpy (ΔH), activation energy (Eₐ), and real-time bond breaking/forming energy tracking.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-400">•</span>
                        <span><strong>Live Kinetic ODE Graph</strong>: Tune temperature and catalyst settings to observe dynamic reactant/product concentration curves and Arrhenius rate constants.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 4: Virtual Lab Workbench */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                        <FlaskConical className="w-4 h-4 text-emerald-400" />
                        4. Virtual Lab Workbench
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Wet, Solid &amp; Gas Chemistry
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Full interactive benchtop starting with a clean empty beaker and 68+ liquid, solid, and gaseous reagents:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span><strong>Expanded Labware &amp; Precision Glassware</strong>: Choose from Open/Closed Beakers (250–500 mL), Synthesis Flasks (Erlenmeyer, Round-Bottom, Florence), Porcelain Crucibles &amp; Dishes, plus Precision Volumetric &amp; Titration Ware (Volumetric Flask, Graduated Cylinder, Burette, Separatory Funnel, Test Tube — automatically sealed precision systems).</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span><strong>Liquids, Solids &amp; Gaseous Elements/Molecules</strong>: Dispense 37 aqueous solutions, 20 solid strips &amp; powders (with <strong>n× addition counters</strong> and <strong>mass-scaled solid visuals</strong>), and 11 gases (with <strong>quantity-based gas cloud density</strong>). Use the unified <strong>Remove</strong> menu on any vessel to selectively clear liquids, solids, gases, or everything.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span><strong>Product Physical Properties &amp; Instruments</strong>: Inspect detailed physical property cards for every reaction product (molar mass, state, melting/boiling points, density, solubility, appearance, odor, hazards), plus Bunsen burner heating, magnetic stirrer, digital pH &amp; temperature probes, Law of Conservation of Mass analytical scale, and spatial audio + haptic feedback.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Module 5: Molecule Builder */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="font-bold text-purple-400 text-sm flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-purple-400" />
                        5. Molecule Builder
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        VSEPR 3D &amp; IUPAC PIN
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300">
                      Construct custom molecules atom-by-atom in 3D space with <strong>real-time official IUPAC name determination</strong> (with online PubChem verification), Hill formulas, molar masses, one-click Hydrogen saturation, automatic VSEPR bond-angle snapping &amp; force-directed 3D relaxation, and valence octet checks.
                    </p>
                  </div>

                  {/* Module 6: Periodic Table Explorer */}
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                      <span className="font-bold text-sky-400 text-sm flex items-center gap-1.5">
                        <Table className="w-4 h-4 text-sky-400" />
                        6. Periodic Table Explorer
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        118 Elements, Blocks &amp; Trends
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-slate-300 mb-2">
                      Interactive periodic table with 1-click Atom Studio &amp; Molecule Explorer launch:
                    </p>
                    <ul className="space-y-1 text-[11px] text-slate-300 pl-2">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Orbital Block Coloring</strong>: Color-coded borders and filters for <strong>s-block</strong> (Sky Blue), <strong>d-block</strong> (Amber Gold), <strong>p-block</strong> (Emerald Mint), and <strong>f-block</strong> (Purple Violet) with Period numbers 1–7.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Periodic Trend Overlays</strong>: Switch color overlays between Element Category, Electronegativity, Atomic Radius, and Standard Phase, or search by name, symbol, or atomic number.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Responsive Scrolling</strong>: Dedicated Scroll Left / Scroll Right buttons and touch swipe across all 18 groups and lanthanide/actinide rows.</span>
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
                      3D Viewport Controls (Mouse &amp; Touch)
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
                      Navigation, Virtual Lab &amp; Mobile Usability
                    </h4>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Header Module Switcher</strong>: Use the center tab bar on desktop or the compact header dropdown on mobile for 1-tap switching across all 6 lab modules.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Virtual Lab Vessel Controls</strong>: Use the unified <strong>Remove</strong> button on a vessel to remove liquids, solids, gases, or clear everything; pour between vessels, toggle airtight lids on beakers/flasks, or switch between Workbench, Stockroom, and Inspector tabs on mobile.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span><strong>Periodic Table Horizontal Scroll</strong>: Use Scroll Left / Scroll Right buttons or swipe horizontally to browse all 18 groups.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      Spatial Audio, Haptics, Theme &amp; Fullscreen Settings
                    </h4>
                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <p>• <strong>Audio &amp; Spatial Lab Sound (Speaker Icon)</strong>: Enables or mutes Web Audio feedback across modules, including spatial stereo panning, chemical pouring, bubbling gases, glassware clinks, and subtle haptic pulse feedback in the Virtual Lab.</p>
                      <p>• <strong>Theme Toggle (Sun/Moon Icon)</strong>: Switch instantly between Dark Laboratory Mode (ideal for quantum clouds and glowing reactions) and Light Lab Mode.</p>
                      <p>• <strong>Fullscreen Mode (Expand Icon or F key)</strong>: Expand the entire Atomix website to fill your monitor screen; press <strong>Esc</strong>, <strong>F</strong>, or click <strong>Exit Fullscreen</strong> to return.</p>
                    </div>
                  </div>
                </div>
              )}

              {guideTab === 'reference' && (
                <div className="space-y-3">
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-sky-400" />
                      Orbital Blocks &amp; Electron Capacities
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
                      Morse Potential, Bond Energy &amp; Arrhenius Kinetics
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-1.5">
                      The Morse potential models anharmonic bond stretching while the Arrhenius equation governs temperature- and catalyst-dependent reaction rates:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1.5">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300 text-center">
                        V(r) = Dₑ · (1 - e^(-a·(r - rₑ)))²
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300 text-center">
                        k = A · e^(-Eₐ / (R·T))
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Where <strong>Dₑ</strong> is bond dissociation energy, <strong>rₑ</strong> is equilibrium bond length, <strong>Eₐ</strong> is activation energy, and <strong>T</strong> is absolute temperature (K).
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs mb-1.5 flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-emerald-400" />
                      Conservation of Mass &amp; Sealed vs. Open Systems
                    </h4>
                    <div className="space-y-1 text-[11px] text-slate-300">
                      <p>• <strong>Open Vessels</strong>: Evolved gases (CO₂, H₂, O₂) escape to the atmosphere, causing apparent mass on the analytical scale to drop by the exact mass of escaped gas.</p>
                      <p>• <strong>Closed &amp; Precision Volumetric Ware</strong>: Airtight stoppered vessels and precision volumetric/titration glassware retain all gaseous products inside, keeping total system mass strictly constant (Δm = 0).</p>
                    </div>
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
