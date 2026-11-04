import React, { useState, useMemo, useRef } from 'react';
import { ElementData, ElementCategory } from '../types/chemistry';
import { ELEMENTS, ELEMENT_CATEGORIES } from '../data/elements';
import { soundFx } from '../utils/audio';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Atom,
  Table,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface PeriodicTableExplorerProps {
  onSimulateAtom: (element: ElementData) => void;
  onExploreMolecules: () => void;
}

export const BLOCK_METADATA: Record<'s' | 'p' | 'd' | 'f', {
  name: string;
  label: string;
  sublabel: string;
  orbitalType: string;
  capacity: string;
  borderColor: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  description: string;
}> = {
  s: {
    name: 's-block',
    label: 's-block',
    sublabel: 'Groups 1 & 2 + H/He',
    orbitalType: 's-orbital (Sharp)',
    capacity: '2 electrons (1 pair)',
    borderColor: '#38bdf8', // Sky Blue
    borderClass: 'border-sky-400',
    bgClass: 'bg-sky-500/10',
    textClass: 'text-sky-400',
    description: 'Valence electrons occupy s-orbitals. Encompasses hydrogen, helium, alkali metals, and alkaline earth metals.',
  },
  d: {
    name: 'd-block',
    label: 'd-block',
    sublabel: 'Groups 3–12 (Transition Metals)',
    orbitalType: 'd-orbital (Diffuse)',
    capacity: '10 electrons (5 pairs)',
    borderColor: '#f59e0b', // Amber / Gold
    borderClass: 'border-amber-400',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    description: 'Valence electrons occupy d-sublevels. Known for metallic luster, high melting points, variable oxidation states, and colored coordination compounds.',
  },
  p: {
    name: 'p-block',
    label: 'p-block',
    sublabel: 'Groups 13–18 (Main Group)',
    orbitalType: 'p-orbital (Principal)',
    capacity: '6 electrons (3 pairs)',
    borderColor: '#10b981', // Emerald Mint
    borderClass: 'border-emerald-400',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    description: 'Valence electrons occupy p-sublevels. Encompasses post-transition metals, metalloids, reactive nonmetals, halogens, and noble gases.',
  },
  f: {
    name: 'f-block',
    label: 'f-block',
    sublabel: 'Lanthanides & Actinides',
    orbitalType: 'f-orbital (Fundamental)',
    capacity: '14 electrons (7 pairs)',
    borderColor: '#c084fc', // Purple / Violet
    borderClass: 'border-purple-400',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
    description: 'Inner transition elements with filling 4f (Lanthanides) and 5f (Actinides) subshells. Characterized by high magnetic moments and actinide radioactivity.',
  },
};

export const PeriodicTableExplorer: React.FC<PeriodicTableExplorerProps> = ({
  onSimulateAtom,
  onExploreMolecules,
}) => {
  const [selectedElement, setSelectedElement] = useState<ElementData>(ELEMENTS[5]); // Carbon
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<ElementCategory | 'all'>('all');
  const [blockFilter, setBlockFilter] = useState<'all' | 's' | 'p' | 'd' | 'f'>('all');
  const [colorMode, setColorMode] = useState<'category' | 'electronegativity' | 'radius' | 'phase'>('category');
  const [mobileView, setMobileView] = useState<'table' | 'details'>('table');

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Filter elements by search, category, and block
  const filteredElements = useMemo(() => {
    return ELEMENTS.filter((el) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        el.name.toLowerCase().includes(q) ||
        el.symbol.toLowerCase().includes(q) ||
        el.atomicNumber.toString() === q;
      const matchesCat = categoryFilter === 'all' || el.category === categoryFilter;
      const matchesBlock = blockFilter === 'all' || el.block === blockFilter;
      return matchesSearch && matchesCat && matchesBlock;
    });
  }, [searchQuery, categoryFilter, blockFilter]);

  // Periodic grid placement:
  // Column 1: Period Numbers (1-7) & Series (6*, 7*)
  // Columns 2-19: Groups 1-18
  // Row 1: Group Column Numbers (1-18) & Block Identifiers
  // Rows 2-8: Periods 1-7
  // Row 9: Visual Separator
  // Row 10: Lanthanides (57-71, 4f)
  // Row 11: Actinides (89-103, 5f)
  const getGridStyle = (el: ElementData) => {
    if (el.atomicNumber >= 57 && el.atomicNumber <= 71) {
      return {
        gridRow: 10,
        gridColumn: 5 + (el.atomicNumber - 57),
      };
    }
    if (el.atomicNumber >= 89 && el.atomicNumber <= 103) {
      return {
        gridRow: 11,
        gridColumn: 5 + (el.atomicNumber - 89),
      };
    }
    return {
      gridRow: el.period + 1,
      gridColumn: el.group + 1,
    };
  };

  // Compute element background color based on active colorMode
  const getElementBgColor = (el: ElementData) => {
    if (colorMode === 'category') {
      return ELEMENT_CATEGORIES[el.category]?.color || '#64748b';
    } else if (colorMode === 'electronegativity') {
      if (!el.electronegativity) return '#334155';
      const ratio = (el.electronegativity - 0.7) / 3.3;
      const r = Math.round(ratio * 240);
      const b = Math.round((1 - ratio) * 240);
      return `rgb(${r}, 120, ${b})`;
    } else if (colorMode === 'radius') {
      const ratio = Math.min(Math.max((el.atomicRadius - 30) / 220, 0), 1);
      const g = Math.round(ratio * 200);
      return `rgb(50, ${g}, 220)`;
    } else if (colorMode === 'phase') {
      if (el.phaseAtSTP === 'gas') return '#38bdf8';
      if (el.phaseAtSTP === 'liquid') return '#f59e0b';
      return '#64748b';
    }
    return '#64748b';
  };

  const handleSelectElement = (el: ElementData) => {
    setSelectedElement(el);
    soundFx.playReactionStep();
  };

  // Smooth horizontal scroll helper
  const scrollTable = (direction: 'left' | 'right', distance = 280) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const selectedBlockInfo = BLOCK_METADATA[selectedElement.block];

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-slate-950 text-slate-100 overflow-hidden">
      {/* Mobile Top View Switcher (Table vs Inspector) */}
      <div className="md:hidden flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full">
          <button
            onClick={() => setMobileView('table')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mobileView === 'table'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Periodic Table (118)</span>
          </button>
          <button
            onClick={() => setMobileView('details')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mobileView === 'details'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Atom className="w-3.5 h-3.5" />
            <span>{selectedElement.symbol} Details</span>
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 md:h-full md:overflow-y-auto p-2 sm:p-4 md:p-6 md:border-r border-slate-800 shrink-0 ${
          mobileView === 'table' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Search Bar & Color Mode */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 mb-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search elements by name, symbol, or atomic number (e.g. Gold, Au, 79)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 whitespace-nowrap">
              {filteredElements.length} / {ELEMENTS.length} elements
            </span>

            {/* Color Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs shrink-0">
              <span className="text-[10px] text-slate-400 px-1.5 font-medium flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                Color:
              </span>
              {(['category', 'electronegativity', 'radius', 'phase'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  className={`px-2 py-1 rounded-lg capitalize transition-all text-[10px] sm:text-[11px] font-medium ${
                    colorMode === mode
                      ? 'bg-sky-500 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal Scroll Controls Bar */}
        <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-slate-900/90 border border-slate-800 rounded-xl mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollTable('left', 260)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
              title="Scroll table left"
            >
              <ChevronLeft className="w-4 h-4 text-sky-400" />
              <span className="text-[11px]">Scroll Left</span>
            </button>
            <button
              onClick={() => scrollTable('right', 260)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
              title="Scroll table right"
            >
              <span className="text-[11px]">Scroll Right</span>
              <ChevronRight className="w-4 h-4 text-sky-400" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono">
            <span className="text-slate-400 hidden sm:inline">
              Scroll left & right ↔ to view all 18 groups
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                s-block
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                d-block
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                p-block
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                f-block
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Periodic Grid Viewport (Scroll Left & Right) */}
        <div
          ref={tableScrollRef}
          className="w-full flex-1 min-w-0 overflow-x-auto overflow-y-auto p-2 sm:p-3 bg-slate-900/40 rounded-2xl border border-slate-800/80 scrollbar-thin scrollbar-thumb-slate-700 scroll-smooth touch-pan-x"
        >
          <div
            className="grid gap-1.5 p-2 inline-grid min-w-[990px] max-w-none"
            style={{
              gridTemplateColumns: '32px repeat(18, minmax(46px, 1fr))',
              gridTemplateRows: '24px repeat(7, minmax(48px, 1fr)) 12px repeat(2, minmax(48px, 1fr))',
            }}
          >
            {/* Row 1, Column 1: Period Header Label */}
            <div
              style={{ gridRow: 1, gridColumn: 1 }}
              className="text-center font-mono text-[9px] text-slate-500 font-bold select-none py-0.5 flex flex-col justify-end"
              title="Period Number (Rows 1–7)"
            >
              <span>Per.</span>
            </div>

            {/* Row 1, Columns 2-19: Group Column Numbers Header with Block Border Accents */}
            {Array.from({ length: 18 }, (_, i) => i + 1).map((groupNum) => {
              // Determine block for group header
              const groupBlock: 's' | 'd' | 'p' =
                groupNum <= 2 ? 's' : groupNum <= 12 ? 'd' : 'p';
              const blockData = BLOCK_METADATA[groupBlock];

              return (
                <div
                  key={`group-header-${groupNum}`}
                  style={{
                    gridRow: 1,
                    gridColumn: groupNum + 1,
                    borderTop: `2px solid ${blockData.borderColor}`,
                  }}
                  className="text-center font-mono text-[10px] font-bold select-none py-0.5 flex flex-col justify-end"
                  title={`Group ${groupNum} (${blockData.name})`}
                >
                  <span style={{ color: blockData.borderColor }}>{groupNum}</span>
                </div>
              );
            })}

            {/* Column 1, Rows 2-8: Period Numbers 1 through 7 */}
            {Array.from({ length: 7 }, (_, i) => i + 1).map((periodNum) => (
              <div
                key={`period-label-${periodNum}`}
                style={{ gridRow: periodNum + 1, gridColumn: 1 }}
                className="flex flex-col items-center justify-center rounded-lg bg-slate-900/95 border border-slate-800 text-sky-400 font-mono text-xs font-bold select-none shadow-sm hover:border-sky-500/50 hover:bg-slate-850 hover:text-sky-300 transition-colors"
                title={`Period ${periodNum} (Principal Quantum Level n=${periodNum})`}
              >
                <span>{periodNum}</span>
              </div>
            ))}

            {/* Column 1, Rows 10 & 11: Period 6* (Lanthanides) & 7* (Actinides) */}
            <div
              style={{ gridRow: 10, gridColumn: 1 }}
              onClick={() => setCategoryFilter(categoryFilter === 'lanthanide' ? 'all' : 'lanthanide')}
              className="flex flex-col items-center justify-center rounded-lg bg-pink-950/30 border border-pink-500/40 text-pink-400 font-mono text-[10px] font-bold select-none cursor-pointer shadow-sm hover:bg-pink-900/40 transition-colors"
              title="Period 6: Lanthanide Series (4f inner transition)"
            >
              <span>6*</span>
            </div>

            <div
              style={{ gridRow: 11, gridColumn: 1 }}
              onClick={() => setCategoryFilter(categoryFilter === 'actinide' ? 'all' : 'actinide')}
              className="flex flex-col items-center justify-center rounded-lg bg-fuchsia-950/30 border border-fuchsia-500/40 text-fuchsia-400 font-mono text-[10px] font-bold select-none cursor-pointer shadow-sm hover:bg-fuchsia-900/40 transition-colors"
              title="Period 7: Actinide Series (5f inner transition)"
            >
              <span>7*</span>
            </div>

            {/* Central Bay: Orbital Blocks Options in Center (in rows 2 & 3, columns 4 to 13) */}
            <div
              style={{ gridRow: '2 / span 2', gridColumn: '4 / span 10' }}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-md select-none pointer-events-auto"
            >
              <div className="flex items-center justify-between w-full px-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                    Orbital Blocks
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono hidden lg:inline">
                    (s, p, d, f Electron Subshells)
                  </span>
                </div>
                {blockFilter !== 'all' && (
                  <button
                    onClick={() => setBlockFilter('all')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 font-semibold transition-colors"
                  >
                    Reset (Show All)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 w-full">
                {(['s', 'd', 'p', 'f'] as const).map((bKey) => {
                  const bMeta = BLOCK_METADATA[bKey];
                  const isFiltered = blockFilter === bKey;

                  return (
                    <button
                      key={bKey}
                      onClick={() => setBlockFilter(blockFilter === bKey ? 'all' : bKey)}
                      className={`p-1.5 rounded-xl border text-center transition-all ${
                        isFiltered
                          ? 'ring-2 ring-white scale-102 shadow-md'
                          : 'hover:brightness-125'
                      }`}
                      style={{
                        borderColor: bMeta.borderColor,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        backgroundColor: isFiltered ? `${bMeta.borderColor}25` : `${bMeta.borderColor}0c`,
                      }}
                      title={`Click to filter elements in ${bMeta.name}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: bMeta.borderColor }}
                        />
                        <span
                          className="text-xs font-black font-mono"
                          style={{ color: bMeta.borderColor }}
                        >
                          {bMeta.name}
                        </span>
                      </div>
                      <span className="text-[8.5px] text-slate-300 block truncate font-medium mt-0.5">
                        {bKey === 's'
                          ? 'Groups 1–2'
                          : bKey === 'd'
                          ? 'Groups 3–12'
                          : bKey === 'p'
                          ? 'Groups 13–18'
                          : 'Lanthanides/Actinides'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period 6, Group 3 Placeholder: Lanthanides Series */}
            <div
              onClick={() => {
                setCategoryFilter(categoryFilter === 'lanthanide' ? 'all' : 'lanthanide');
                const la = ELEMENTS.find((e) => e.atomicNumber === 57);
                if (la) setSelectedElement(la);
              }}
              className={`p-1 rounded-lg flex flex-col justify-center items-center text-center cursor-pointer transition-all border select-none ${
                categoryFilter === 'lanthanide' ? 'ring-2 ring-pink-400' : ''
              }`}
              style={{
                gridRow: 7,
                gridColumn: 4,
                borderColor: BLOCK_METADATA.f.borderColor,
                borderWidth: '1px',
                borderStyle: 'solid',
                backgroundColor: 'rgba(217, 70, 239, 0.1)',
              }}
              title="Click to highlight Lanthanide Series (57–71, 4f)"
            >
              <span className="text-[9px] text-pink-300 font-mono font-bold leading-tight">57–71</span>
              <span className="text-[11px] text-pink-400 font-black font-mono leading-tight">La–Lu</span>
              <span className="text-[7px] text-pink-300/80 uppercase tracking-tighter mt-0.5">Lanthanides (f)</span>
            </div>

            {/* Period 7, Group 3 Placeholder: Actinides Series */}
            <div
              onClick={() => {
                setCategoryFilter(categoryFilter === 'actinide' ? 'all' : 'actinide');
                const ac = ELEMENTS.find((e) => e.atomicNumber === 89);
                if (ac) setSelectedElement(ac);
              }}
              className={`p-1 rounded-lg flex flex-col justify-center items-center text-center cursor-pointer transition-all border select-none ${
                categoryFilter === 'actinide' ? 'ring-2 ring-fuchsia-400' : ''
              }`}
              style={{
                gridRow: 8,
                gridColumn: 4,
                borderColor: BLOCK_METADATA.f.borderColor,
                borderWidth: '1px',
                borderStyle: 'solid',
                backgroundColor: 'rgba(232, 121, 249, 0.1)',
              }}
              title="Click to highlight Actinide Series (89–103, 5f)"
            >
              <span className="text-[9px] text-fuchsia-300 font-mono font-bold leading-tight">89–103</span>
              <span className="text-[11px] text-fuchsia-400 font-black font-mono leading-tight">Ac–Lr</span>
              <span className="text-[7px] text-fuchsia-300/80 uppercase tracking-tighter mt-0.5">Actinides (f)</span>
            </div>

            {/* Row 9 Separator between d-block and f-block */}
            <div
              style={{ gridRow: 9, gridColumn: '1 / span 19' }}
              className="flex items-center justify-center opacity-40"
            >
              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent w-full" />
            </div>

            {/* Row 10 Lanthanides Title */}
            <div
              style={{
                gridRow: 10,
                gridColumn: '2 / span 3',
                borderLeft: `3px solid ${BLOCK_METADATA.f.borderColor}`,
              }}
              onClick={() => setCategoryFilter(categoryFilter === 'lanthanide' ? 'all' : 'lanthanide')}
              className="flex items-center justify-end pr-2 text-right cursor-pointer hover:opacity-100 transition-opacity select-none pl-2"
            >
              <div>
                <span className="text-[10px] font-bold text-pink-400 font-mono block">
                  Lanthanides <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">f-block</span>
                </span>
                <span className="text-[8px] text-pink-300/70 font-mono block">57 – 71 (4f)</span>
              </div>
            </div>

            {/* Row 11 Actinides Title */}
            <div
              style={{
                gridRow: 11,
                gridColumn: '2 / span 3',
                borderLeft: `3px solid ${BLOCK_METADATA.f.borderColor}`,
              }}
              onClick={() => setCategoryFilter(categoryFilter === 'actinide' ? 'all' : 'actinide')}
              className="flex items-center justify-end pr-2 text-right cursor-pointer hover:opacity-100 transition-opacity select-none pl-2"
            >
              <div>
                <span className="text-[10px] font-bold text-fuchsia-400 font-mono block">
                  Actinides <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">f-block</span>
                </span>
                <span className="text-[8px] text-fuchsia-300/70 font-mono block">89 – 103 (5f)</span>
              </div>
            </div>

            {/* All 118 Elements with Thin Block-Colored Borders */}
            {ELEMENTS.map((el) => {
              const isSelected = selectedElement.atomicNumber === el.atomicNumber;
              const matchesFilter = filteredElements.some((fe) => fe.atomicNumber === el.atomicNumber);
              const color = getElementBgColor(el);
              const blockData = BLOCK_METADATA[el.block];

              return (
                <div
                  key={el.atomicNumber}
                  onClick={() => handleSelectElement(el)}
                  className={`relative p-1 rounded-lg flex flex-col justify-between cursor-pointer transition-all duration-150 select-none ${
                    isSelected
                      ? 'ring-2 ring-white scale-105 z-20 shadow-lg'
                      : 'hover:scale-105 hover:z-10 shadow-sm'
                  } ${matchesFilter ? 'opacity-100' : 'opacity-20'}`}
                  style={{
                    ...getGridStyle(el),
                    backgroundColor: isSelected ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.88)',
                    borderColor: isSelected ? '#ffffff' : blockData.borderColor,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    boxShadow: isSelected ? `0 0 10px ${blockData.borderColor}80` : undefined,
                  }}
                  title={`${el.name} (${el.symbol}) • Atomic #${el.atomicNumber} • ${blockData.name}`}
                >
                  {/* Top Bar: Atomic Number & Block Name Badge */}
                  <div className="flex items-center justify-between text-[9px] font-mono leading-none gap-0.5">
                    <span className="text-slate-400 font-semibold">{el.atomicNumber}</span>
                    <span
                      className="text-[7px] font-mono font-bold px-1 py-0.2 rounded border leading-none"
                      style={{
                        borderColor: `${blockData.borderColor}60`,
                        color: blockData.borderColor,
                        backgroundColor: `${blockData.borderColor}20`,
                      }}
                      title={`${blockData.name}: ${blockData.orbitalType}`}
                    >
                      {blockData.name}
                    </span>
                  </div>

                  {/* Element Symbol */}
                  <div className="text-center my-0.5">
                    <span
                      className="text-base font-black font-mono leading-none block tracking-tight"
                      style={{ color }}
                    >
                      {el.symbol}
                    </span>
                  </div>

                  {/* Element Name */}
                  <span className="text-[7.5px] text-slate-300 truncate text-center leading-none">
                    {el.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile floating quick selection banner */}
        <div className="md:hidden mt-2 p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white border"
              style={{
                backgroundColor: selectedElement.cpkColor === '#FFFFFF' ? '#475569' : selectedElement.cpkColor,
                borderColor: selectedBlockInfo.borderColor,
                borderWidth: '1px',
              }}
            >
              {selectedElement.symbol}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white block">
                  {selectedElement.name} (#{selectedElement.atomicNumber})
                </span>
                <span
                  className="text-[9px] font-mono px-1 py-0.2 rounded border font-semibold"
                  style={{
                    borderColor: selectedBlockInfo.borderColor,
                    color: selectedBlockInfo.borderColor,
                  }}
                >
                  {selectedBlockInfo.name}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedElement.atomicMass} u • {ELEMENT_CATEGORIES[selectedElement.category]?.label}
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileView('details')}
            className="px-2.5 py-1.5 rounded-lg bg-sky-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm"
          >
            <span>Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Detailed Element Inspector Panel */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col min-h-0 min-w-0 md:h-full md:overflow-y-auto p-4 md:p-6 bg-slate-900/60 shrink-0 ${
          mobileView === 'details' ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Atom className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white">Element Details</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              Period {selectedElement.period}, Group {selectedElement.group}
            </span>
            <button
              onClick={() => setMobileView('table')}
              className="md:hidden text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              Back to Table
            </button>
          </div>
        </div>

        {/* Hero Card */}
        <div className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div
            className="w-16 h-16 rounded-xl flex flex-col items-center justify-center font-bold text-white shadow-lg border"
            style={{
              backgroundColor: selectedElement.cpkColor === '#FFFFFF' ? '#475569' : selectedElement.cpkColor,
              borderColor: selectedBlockInfo.borderColor,
              borderWidth: '2px',
            }}
          >
            <span className="text-xs leading-none opacity-80">{selectedElement.atomicNumber}</span>
            <span className="text-2xl leading-none font-black">{selectedElement.symbol}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-lg font-bold text-white leading-tight">{selectedElement.name}</h2>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: selectedBlockInfo.borderColor,
                  color: selectedBlockInfo.borderColor,
                  backgroundColor: `${selectedBlockInfo.borderColor}15`,
                }}
              >
                {selectedBlockInfo.name}
              </span>
            </div>
            <span className="text-xs text-sky-400 font-medium block mt-0.5">
              {ELEMENT_CATEGORIES[selectedElement.category]?.label}
            </span>
            <span className="text-xs text-slate-400 font-mono mt-0.5 block">
              Standard Mass: {selectedElement.atomicMass} u
            </span>
          </div>
        </div>

        {/* Direct Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => onSimulateAtom(selectedElement)}
            className="py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Atom className="w-4 h-4" />
            Simulate Atom 3D
          </button>
          <button
            onClick={onExploreMolecules}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
          >
            <Compass className="w-4 h-4" />
            View Molecules
          </button>
        </div>

        {/* Orbital Block Details Card */}
        <div
          className="p-3 rounded-xl border mb-3 text-xs"
          style={{
            borderColor: selectedBlockInfo.borderColor,
            borderWidth: '1px',
            backgroundColor: `${selectedBlockInfo.borderColor}0c`,
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="font-bold flex items-center gap-1.5"
              style={{ color: selectedBlockInfo.borderColor }}
            >
              <Layers className="w-3.5 h-3.5" />
              {selectedBlockInfo.name} ({selectedBlockInfo.orbitalType})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Cap: {selectedBlockInfo.capacity}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {selectedBlockInfo.description}
          </p>
        </div>

        {/* Property Grid */}
        <div className="space-y-3 text-xs overflow-y-auto">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">Electronic Structure</span>
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Configuration:</span>
                <span className="text-sky-300 font-bold">{selectedElement.electronConfiguration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valence Electrons:</span>
                <span className="text-amber-300">{selectedElement.valenceElectrons}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Orbital Block:</span>
                <span
                  className="font-bold uppercase"
                  style={{ color: selectedBlockInfo.borderColor }}
                >
                  {selectedElement.block}-block ({selectedBlockInfo.sublabel})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shells (K,L,M...):</span>
                <span className="text-slate-300">{selectedElement.shells.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Electronegativity:</span>
                <span className="text-cyan-300">{selectedElement.electronegativity ?? 'None (Inert)'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">Physical Constants</span>
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Atomic Radius:</span>
                <span className="text-slate-200">{selectedElement.atomicRadius} pm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">1st Ionization Energy:</span>
                <span className="text-slate-200">{selectedElement.ionizationEnergy} kJ/mol</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Melting Point:</span>
                <span className="text-slate-200">
                  {selectedElement.meltingPointK ? `${selectedElement.meltingPointK} K (${(selectedElement.meltingPointK - 273.15).toFixed(0)} °C)` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Boiling Point:</span>
                <span className="text-slate-200">
                  {selectedElement.boilingPointK ? `${selectedElement.boilingPointK} K (${(selectedElement.boilingPointK - 273.15).toFixed(0)} °C)` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Description & Applications */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">Scientific Summary</span>
            <p className="text-slate-300 text-[12px] leading-relaxed mb-2">{selectedElement.summary}</p>

            <span className="text-[11px] font-semibold text-slate-400 block mb-1">Everyday Applications</span>
            <ul className="space-y-1 text-slate-300 text-[11px]">
              {selectedElement.realWorldUses.map((use, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-sky-400 mt-0.5">•</span>
                  <span>{use}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
