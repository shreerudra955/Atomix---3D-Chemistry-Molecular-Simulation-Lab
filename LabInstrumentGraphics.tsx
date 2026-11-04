import React from 'react';
import { MovableInstrument, VesselState } from '../types/virtualLab';

interface LabInstrumentGraphicProps {
  instrument: MovableInstrument;
  isSelected?: boolean;
}

export const LabInstrumentGraphic: React.FC<LabInstrumentGraphicProps> = ({
  instrument,
  isSelected = false,
}) => {
  const { type, vesselState, isFlameOn, measuredTempC, measuredMassG, heldChemical } = instrument;

  // Render based on instrument type
  switch (type) {
    // ----------------------------------------------------
    // 1. BEAKER
    // ----------------------------------------------------
    case 'beaker': {
      const v = vesselState;
      const fillPct = v ? Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100)) : 0;
      return (
        <div className="relative w-28 h-36 flex items-end justify-center">
          {/* Glass Beaker Body */}
          <div className="relative w-full h-full border-2 border-slate-400/80 rounded-b-xl bg-slate-900/30 backdrop-blur-xs overflow-hidden flex flex-col justify-end shadow-lg">
            {/* Lip Spout */}
            <div className="absolute -top-0.5 -left-1 w-3 h-2 border-t-2 border-l-2 border-slate-400 rotate-45" />

            {/* Graduation lines */}
            <div className="absolute right-1 top-2 bottom-2 flex flex-col justify-between text-[7px] font-mono text-slate-400 opacity-60 pointer-events-none select-none">
              <span>250</span>
              <span>200</span>
              <span>150</span>
              <span>100</span>
              <span>50</span>
            </div>

            {/* Liquid Fill */}
            {fillPct > 0 && v && (
              <div
                className="w-full transition-all duration-300 relative"
                style={{
                  height: `${fillPct}%`,
                  backgroundColor: v.color,
                  opacity: 0.88,
                }}
              >
                {/* Meniscus */}
                <div className="w-full h-1.5 bg-white/30 rounded-full blur-[0.5px]" />

                {/* Precipitate */}
                {v.precipitate && (
                  <div
                    className="absolute bottom-0 inset-x-0 h-3 border-t border-black/30"
                    style={{ backgroundColor: v.precipitate.color }}
                    title={`Precipitate: ${v.precipitate.name}`}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 2. ERLENMEYER FLASK
    // ----------------------------------------------------
    case 'erlenmeyer_flask': {
      const v = vesselState;
      const fillPct = v ? Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100)) : 0;
      return (
        <div className="relative w-28 h-36 flex flex-col items-center justify-end">
          {/* Narrow Neck */}
          <div className="w-7 h-10 border-2 border-b-0 border-slate-400/80 bg-slate-900/20 rounded-t-sm z-10" />
          {/* Conical Body */}
          <div className="relative w-28 h-26 border-2 border-slate-400/80 rounded-b-xl bg-slate-900/30 overflow-hidden flex flex-col justify-end shadow-lg">
            {fillPct > 0 && v && (
              <div
                className="w-full transition-all duration-300 relative"
                style={{
                  height: `${fillPct}%`,
                  backgroundColor: v.color,
                  opacity: 0.88,
                }}
              >
                <div className="w-full h-1.5 bg-white/30 rounded-full" />
                {v.precipitate && (
                  <div
                    className="absolute bottom-0 inset-x-0 h-3 border-t border-black/30"
                    style={{ backgroundColor: v.precipitate.color }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 3. FLORENCE BOILING FLASK
    // ----------------------------------------------------
    case 'florence_flask': {
      const v = vesselState;
      const fillPct = v ? Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100)) : 0;
      return (
        <div className="relative w-28 h-36 flex flex-col items-center justify-end">
          {/* Tall cylindrical neck */}
          <div className="w-6 h-12 border-2 border-b-0 border-slate-400/80 bg-slate-900/20 rounded-t-sm z-10" />
          {/* Spherical round body */}
          <div className="relative w-26 h-24 rounded-full border-2 border-slate-400/80 bg-slate-900/30 overflow-hidden flex flex-col justify-end shadow-lg">
            {fillPct > 0 && v && (
              <div
                className="w-full transition-all duration-300 relative rounded-b-full"
                style={{
                  height: `${fillPct}%`,
                  backgroundColor: v.color,
                  opacity: 0.88,
                }}
              >
                <div className="w-full h-1 bg-white/30 rounded-full" />
              </div>
            )}
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 4. TEST TUBES & RACK
    // ----------------------------------------------------
    case 'test_tubes': {
      const v = vesselState;
      const fillPct = v ? Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100)) : 30;
      return (
        <div className="relative w-32 h-36 flex items-end justify-center">
          {/* Rack Base */}
          <div className="absolute bottom-0 w-32 h-6 bg-amber-900/70 border-2 border-amber-800 rounded-md shadow-md" />
          {/* Rack Backing */}
          <div className="absolute bottom-6 w-30 h-18 border-2 border-dashed border-amber-800/60 flex items-center justify-around px-1">
            {/* Tube 1 */}
            <div className="w-4 h-28 border-2 border-slate-400 rounded-b-full bg-slate-900/40 overflow-hidden flex flex-col justify-end">
              <div className="w-full h-14 bg-sky-500/80" />
            </div>
            {/* Tube 2 (Active Interactive) */}
            <div className="w-4 h-28 border-2 border-sky-400 rounded-b-full bg-slate-900/40 overflow-hidden flex flex-col justify-end shadow-sm">
              <div
                className="w-full transition-all duration-300"
                style={{
                  height: `${fillPct}%`,
                  backgroundColor: v?.color || '#22c55e',
                }}
              />
            </div>
            {/* Tube 3 */}
            <div className="w-4 h-28 border-2 border-slate-400 rounded-b-full bg-slate-900/40 overflow-hidden flex flex-col justify-end">
              <div className="w-full h-10 bg-rose-500/80" />
            </div>
            {/* Tube 4 */}
            <div className="w-4 h-28 border-2 border-slate-400 rounded-b-full bg-slate-900/40 overflow-hidden flex flex-col justify-end">
              <div className="w-full h-16 bg-purple-500/80" />
            </div>
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 5. GRADUATED CYLINDER
    // ----------------------------------------------------
    case 'graduated_cylinder': {
      const v = vesselState;
      const fillPct = v ? Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100)) : 50;
      return (
        <div className="relative w-16 h-40 flex flex-col items-center justify-end">
          {/* Tall Cylinder */}
          <div className="relative w-8 h-36 border-2 border-slate-400/90 rounded-t-sm bg-slate-900/30 overflow-hidden flex flex-col justify-end shadow-md">
            {/* Millimeter lines */}
            <div className="absolute right-0.5 top-2 bottom-2 flex flex-col justify-between text-[6px] font-mono text-slate-400 select-none">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            {/* Liquid */}
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${fillPct}%`,
                backgroundColor: v?.color || '#0284c7',
                opacity: 0.85,
              }}
            />
          </div>
          {/* Hexagonal Yellow Foot Base */}
          <div className="w-14 h-4 bg-amber-400/90 border-2 border-amber-600 rounded-md shadow-md -mt-0.5" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 6. WATCH GLASS
    // ----------------------------------------------------
    case 'watch_glass': {
      return (
        <div className="relative w-28 h-12 flex items-center justify-center">
          <div className="w-26 h-8 border-2 border-slate-400/80 rounded-b-full bg-slate-900/40 backdrop-blur-xs flex items-center justify-center shadow-md">
            <div className="w-12 h-3 bg-amber-200/40 rounded-full blur-[1px]" title="Salt Crystals / Drops" />
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 7. CRUCIBLE AND COVER
    // ----------------------------------------------------
    case 'crucible_cover': {
      const v = vesselState;
      return (
        <div className="relative w-20 h-22 flex flex-col items-center justify-end">
          {/* Porcelain Lid with Knob */}
          <div className="w-3 h-2 bg-slate-200 border border-slate-400 rounded-t-sm" />
          <div className="w-18 h-3 bg-slate-100 border border-slate-400 rounded-t-md shadow-sm -mt-0.5" />
          {/* Porcelain Cup */}
          <div className="w-16 h-16 bg-slate-100 border-2 border-slate-300 rounded-b-2xl shadow-lg flex flex-col justify-end overflow-hidden p-1">
            {v && v.contents.length > 0 && (
              <div
                className="w-full h-6 rounded-b-xl transition-all"
                style={{ backgroundColor: v.color || '#334155' }}
              />
            )}
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 8. MORTAR AND PESTLE
    // ----------------------------------------------------
    case 'mortar_pestle': {
      return (
        <div className="relative w-28 h-22 flex items-end justify-center">
          {/* Mortar Bowl */}
          <div className="w-26 h-18 bg-stone-300 border-2 border-stone-400 rounded-b-full flex items-center justify-center relative shadow-lg">
            <div className="w-20 h-10 bg-stone-400/60 rounded-b-full flex items-center justify-center">
              <div className="w-10 h-4 bg-amber-100/60 rounded-full blur-[1px]" />
            </div>
            {/* Spout */}
            <div className="absolute -top-1 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-stone-400 rotate-45" />
          </div>
          {/* Pestle */}
          <div className="absolute -top-3 right-3 w-5 h-20 bg-stone-200 border-2 border-stone-400 rounded-full rotate-25 shadow-md" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 9. BURET
    // ----------------------------------------------------
    case 'buret': {
      const v = vesselState;
      const fillPct = v ? Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100)) : 80;
      return (
        <div className="relative w-16 h-48 flex flex-col items-center justify-end">
          {/* Top Tube */}
          <div className="relative w-5 h-36 border-2 border-slate-400/90 bg-slate-900/30 overflow-hidden flex flex-col justify-end">
            <div className="absolute right-0.5 inset-y-2 flex flex-col justify-between text-[5px] font-mono text-slate-400">
              <span>0</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
              <span>50</span>
            </div>
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${fillPct}%`,
                backgroundColor: v?.color || '#38bdf8',
                opacity: 0.85,
              }}
            />
          </div>
          {/* Stopcock valve knob */}
          <div className="w-9 h-3.5 bg-amber-500 border border-amber-700 rounded-sm shadow-md flex items-center justify-center">
            <div className="w-1 h-3 bg-white/60" />
          </div>
          {/* Needle Tip */}
          <div className="w-1.5 h-6 bg-slate-300 border border-slate-400 rounded-b-sm" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 10. CONDENSER (LIEBIG)
    // ----------------------------------------------------
    case 'condenser': {
      return (
        <div className="relative w-20 h-44 flex flex-col items-center justify-center">
          {/* Top Funnel / Adapter */}
          <div className="w-8 h-4 border-2 border-slate-400 rounded-t-sm bg-slate-900/30" />
          {/* Outer Water Jacket */}
          <div className="relative w-14 h-32 border-2 border-cyan-400/80 rounded-xl bg-cyan-500/10 backdrop-blur-xs flex items-center justify-center shadow-md">
            {/* Water Hoses Nozzles */}
            <div className="absolute -left-3 top-4 w-3.5 h-2 bg-cyan-400 rounded-l-sm" />
            <div className="absolute -right-3 bottom-4 w-3.5 h-2 bg-cyan-400 rounded-r-sm" />
            {/* Inner Vapor Glass Tube */}
            <div className="w-4 h-32 border-x-2 border-slate-300 bg-white/20 flex flex-col items-center justify-center">
              <span className="w-1 h-1 bg-white rounded-full animate-bounce" />
            </div>
          </div>
          {/* Bottom Drip Tip */}
          <div className="w-3 h-6 border-x-2 border-b-2 border-slate-400 rounded-b-sm" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 11. PIPET BULB
    // ----------------------------------------------------
    case 'pipet_bulb': {
      return (
        <div className="relative w-14 h-18 flex flex-col items-center justify-center">
          {/* Bulb Body */}
          <div className="w-12 h-14 bg-orange-600 border-2 border-orange-700 rounded-full shadow-lg flex items-center justify-center">
            <div className="w-6 h-8 bg-orange-500/50 rounded-full blur-[1px]" />
          </div>
          {/* Attachment Collar */}
          <div className="w-5 h-4 bg-orange-700 rounded-b-sm -mt-1" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 12. VOLUMETRIC PIPET
    // ----------------------------------------------------
    case 'volumetric_pipet': {
      return (
        <div className="relative w-10 h-44 flex flex-col items-center justify-center">
          <div className="w-1.5 h-16 bg-slate-300 border border-slate-400" />
          {/* Expansion Bulb */}
          <div className="w-7 h-14 bg-slate-200/80 border-2 border-slate-400 rounded-full flex items-center justify-center shadow-sm">
            <div className="w-4 h-8 bg-rose-400/50 rounded-full" />
          </div>
          <div className="w-1.5 h-14 bg-slate-300 border border-slate-400 rounded-b-full" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 13. GRADUATED PIPET
    // ----------------------------------------------------
    case 'graduated_pipet': {
      return (
        <div className="relative w-8 h-44 flex flex-col items-center justify-center">
          <div className="w-2.5 h-40 border-2 border-amber-400/90 bg-amber-500/10 rounded-full flex flex-col justify-between py-2 shadow-sm">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="w-full h-0.5 bg-amber-500/80" />
            ))}
          </div>
          <div className="w-1 h-4 bg-amber-400 rounded-b-full" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 14. THERMOMETER
    // ----------------------------------------------------
    case 'thermometer': {
      const temp = measuredTempC ?? 22;
      const heightPct = Math.min(100, Math.max(5, ((temp + 10) / 120) * 100));
      return (
        <div className="relative w-8 h-44 flex flex-col items-center justify-end">
          {/* Glass Stem */}
          <div className="relative w-3 h-36 border-2 border-slate-400 rounded-t-full bg-slate-900/30 flex flex-col justify-end p-0.5 shadow-sm">
            {/* Red alcohol column */}
            <div
              className="w-full bg-rose-600 rounded-t-full transition-all duration-300"
              style={{ height: `${heightPct}%` }}
            />
          </div>
          {/* Red Bulb */}
          <div className="w-6 h-6 bg-rose-600 border-2 border-rose-700 rounded-full shadow-md -mt-2 z-10" />
          <span className="text-[9px] font-mono text-white font-bold bg-slate-900 px-1 rounded shadow -mt-0.5">
            {temp.toFixed(1)}°C
          </span>
        </div>
      );
    }

    // ----------------------------------------------------
    // 15. SCOOPULA
    // ----------------------------------------------------
    case 'scoopula': {
      return (
        <div className="relative w-10 h-36 flex flex-col items-center justify-center rotate-15">
          {/* Purple Handle */}
          <div className="w-4 h-14 bg-purple-600 border-2 border-purple-800 rounded-t-md shadow-md" />
          {/* Metallic curved scoop blade */}
          <div className="w-3.5 h-20 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-400 border border-slate-400 rounded-b-full shadow-sm flex items-end justify-center pb-1">
            <div className="w-2 h-3 bg-amber-300 rounded-full" title="Chemical Powder" />
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 16. RUBBER STOPPERS
    // ----------------------------------------------------
    case 'rubber_stoppers': {
      return (
        <div className="relative w-16 h-14 flex items-center justify-around">
          <div className="w-8 h-7 bg-slate-800 border-2 border-slate-700 rounded-t-sm clip-stopper shadow-md flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-950" title="1-Hole Bore" />
          </div>
          <div className="w-6 h-6 bg-slate-800 border-2 border-slate-700 rounded-t-sm clip-stopper shadow-md" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 17. WIRE GAUZE
    // ----------------------------------------------------
    case 'wire_gauze': {
      return (
        <div className="relative w-24 h-24 border-2 border-slate-500 bg-slate-800/40 rounded-sm shadow-md flex items-center justify-center p-1 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:4px_4px]">
          {/* Ceramic White Center Pad */}
          <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-300 shadow-inner" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 18. CLAY TRIANGLE
    // ----------------------------------------------------
    case 'clay_triangle': {
      return (
        <div className="relative w-26 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-stone-300 fill-none stroke-[6]">
            {/* Twisted iron wire loop corners */}
            <polygon points="50,15 15,80 85,80" className="stroke-amber-800 stroke-[3]" />
            {/* Three white pipeclay sleeves */}
            <line x1="30" y1="48" x2="45" y2="23" className="stroke-slate-100 stroke-[8] stroke-linecap-round" />
            <line x1="55" y1="23" x2="70" y2="48" className="stroke-slate-100 stroke-[8] stroke-linecap-round" />
            <line x1="30" y1="80" x2="70" y2="80" className="stroke-slate-100 stroke-[8] stroke-linecap-round" />
          </svg>
        </div>
      );
    }

    // ----------------------------------------------------
    // 19. FUNNEL
    // ----------------------------------------------------
    case 'funnel': {
      return (
        <div className="relative w-20 h-28 flex flex-col items-center justify-center">
          {/* Glass Conical Cone */}
          <div className="w-18 h-14 border-2 border-slate-300 bg-white/20 clip-funnel rounded-t-sm flex items-center justify-center">
            {/* White folded filter paper */}
            <div className="w-12 h-10 border border-slate-200 bg-white/80 clip-funnel rounded-t-sm shadow-sm" />
          </div>
          {/* Stem */}
          <div className="w-2 h-12 bg-white/30 border-x-2 border-b-2 border-slate-300 rounded-b-sm" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 20. CERAMIC SQUARE
    // ----------------------------------------------------
    case 'ceramic_square': {
      return (
        <div className="relative w-26 h-20 bg-stone-300 border-2 border-stone-400 rounded shadow-md flex items-center justify-center">
          <span className="text-[9px] font-mono font-bold text-stone-600 uppercase tracking-widest">
            Heat Resistant Pad
          </span>
        </div>
      );
    }

    // ----------------------------------------------------
    // 21. CRUCIBLE TONGS
    // ----------------------------------------------------
    case 'crucible_tongs': {
      return (
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-slate-300 fill-none stroke-[4] stroke-linecap-round">
            {/* Scissor finger loops */}
            <circle cx="20" cy="25" r="10" />
            <circle cx="20" cy="75" r="10" />
            {/* Crossing scissor legs */}
            <line x1="28" y1="30" x2="55" y2="50" />
            <line x1="28" y1="70" x2="55" y2="50" />
            <circle cx="55" cy="50" r="3" className="fill-slate-400" />
            {/* Wavy bowed gripping jaws */}
            <path d="M 55,50 Q 75,35 85,45 Q 90,50 85,55 Q 75,65 55,50" />
          </svg>
        </div>
      );
    }

    // ----------------------------------------------------
    // 22. CLAMPS
    // ----------------------------------------------------
    case 'clamps': {
      return (
        <div className="relative w-26 h-16 flex items-center justify-center">
          {/* Cast Iron Collar with screw */}
          <div className="w-6 h-10 bg-amber-500 border border-amber-700 rounded-sm shadow flex items-center justify-center">
            <div className="w-2 h-4 bg-slate-900 rounded-full" />
          </div>
          {/* Rod */}
          <div className="w-10 h-2.5 bg-slate-300 border border-slate-400" />
          {/* 3-Finger Jaws */}
          <div className="flex flex-col gap-1">
            <div className="w-7 h-2 bg-slate-800 rounded-r-md" />
            <div className="w-8 h-2 bg-slate-800 rounded-r-md" />
            <div className="w-7 h-2 bg-slate-800 rounded-r-md" />
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 23. TEST TUBE HOLDER
    // ----------------------------------------------------
    case 'test_tube_holder': {
      return (
        <div className="relative w-26 h-12 flex items-center justify-center">
          {/* Spring Wire Loop */}
          <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
          {/* Shaft */}
          <div className="w-12 h-2 bg-slate-300 border border-slate-400" />
          {/* Cylindrical Jaws */}
          <div className="w-6 h-10 border-2 border-slate-400 rounded bg-slate-700/60 shadow" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 24. PLATFORM BALANCE (TRIPLE BEAM)
    // ----------------------------------------------------
    case 'platform_balance': {
      const mass = measuredMassG ?? 142.5;
      return (
        <div className="relative w-36 h-28 flex flex-col justify-end">
          {/* Left Weighing Pan */}
          <div className="absolute top-2 left-2 w-16 h-3 bg-slate-300 border-2 border-slate-400 rounded-full shadow-md z-10" />
          <div className="absolute top-5 left-8 w-3 h-8 bg-slate-400" />
          {/* Three Beams */}
          <div className="ml-16 w-18 h-10 border border-amber-600 bg-amber-400/90 rounded-sm p-1 flex flex-col justify-around text-[5px] font-mono shadow-sm">
            <div className="w-full h-1 bg-slate-700 flex justify-end">
              <span className="w-2 h-2 bg-white rounded-full -mt-0.5" />
            </div>
            <div className="w-full h-1 bg-slate-700 flex justify-center">
              <span className="w-2 h-2 bg-white rounded-full -mt-0.5" />
            </div>
            <div className="w-full h-1 bg-slate-700" />
          </div>
          {/* Base */}
          <div className="w-36 h-8 bg-amber-500 border-2 border-amber-700 rounded-b-md shadow-lg flex items-center justify-between px-2 text-[9px] font-mono font-bold text-slate-900">
            <span>SCALE</span>
            <span className="bg-slate-900 text-amber-300 px-1 rounded">{mass.toFixed(1)}g</span>
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // 25. RING STAND
    // ----------------------------------------------------
    case 'ring_stand': {
      return (
        <div className="relative w-20 h-48 flex flex-col items-center justify-end">
          {/* Vertical steel rod */}
          <div className="w-2 h-42 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-400 border border-slate-400 shadow-sm" />
          {/* Heavy rectangular blue cast-iron base */}
          <div className="w-20 h-6 bg-sky-900 border-2 border-sky-700 rounded shadow-xl -mt-1" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 26. BUNSEN BURNER
    // ----------------------------------------------------
    case 'burner': {
      return (
        <div className="relative w-16 h-36 flex flex-col items-center justify-end">
          {/* Roaring Blue Flame when lit */}
          {isFlameOn && (
            <div className="flex flex-col items-center animate-bounce -mb-1">
              <div className="w-4 h-10 bg-gradient-to-t from-sky-400 via-amber-300 to-transparent rounded-full blur-[2px]" />
              <div className="w-2 h-4 bg-sky-300 rounded-full blur-[1px] -mt-2" />
            </div>
          )}
          {/* Chimney Barrel */}
          <div className="w-4 h-16 bg-slate-300 border-x-2 border-t-2 border-slate-500 rounded-t-sm shadow-sm" />
          {/* Air Intake Collar */}
          <div className="w-6 h-4 bg-slate-700 border border-slate-800 rounded-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-slate-950 rounded-full" />
          </div>
          {/* Base */}
          <div className="w-16 h-6 bg-slate-800 border-2 border-slate-900 rounded-b-xl shadow-xl" />
        </div>
      );
    }

    // ----------------------------------------------------
    // 27. TEST TUBE BRUSH
    // ----------------------------------------------------
    case 'test_tube_brush': {
      return (
        <div className="relative w-8 h-44 flex flex-col items-center justify-center rotate-12">
          {/* Wire Handle Loop */}
          <div className="w-4 h-4 rounded-full border-2 border-slate-400" />
          <div className="w-1 h-20 bg-slate-400" />
          {/* Radial Bristles Head */}
          <div className="w-6 h-18 bg-amber-300/80 border border-amber-500 rounded-full shadow-md flex items-center justify-center">
            <div className="w-1 h-16 bg-slate-500" />
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="w-16 h-16 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center">
          <span className="text-xs font-bold text-white uppercase">{type}</span>
        </div>
      );
  }
};
