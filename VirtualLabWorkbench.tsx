import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FlaskConical,
  Flame,
  Thermometer,
  Scale,
  Droplets,
  Trash2,
  RotateCcw,
  Sparkles,
  Plus,
  Search,
  BookOpen,
  FileText,
  AlertTriangle,
  Info,
  ArrowRight,
  Wind,
  Check,
  Share2,
  Copy,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  Lock,
  Unlock,
  Layers,
  Atom,
  Activity,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  Timer,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  ChemicalCategory,
  ChemicalItem,
  DissolvedChemical,
  ExperimentPreset,
  LabLogEntry,
  VesselState,
  VesselType,
  ReactionParticipant,
  DetailedReactionInfo,
} from '../types/virtualLab';
import {
  ALL_CHEMICALS,
  GUIDED_EXPERIMENTS,
  VESSEL_SPECS,
  calculateChemicalMoles,
  getChemicalMetadata,
} from '../data/virtualLabData';
import { evaluateVesselState } from '../utils/virtualLabEngine';
import { soundFx } from '../utils/audio';

interface VirtualLabWorkbenchProps {
  theme?: 'dark' | 'light';
}

export const VirtualLabWorkbench: React.FC<VirtualLabWorkbenchProps> = ({
  theme = 'dark',
}) => {
  // Navigation tabs in the stockroom drawer
  const [drawerTab, setDrawerTab] = useState<'chemicals' | 'glassware' | 'experiments'>('chemicals');
  const [selectedChemicalCategory, setSelectedChemicalCategory] = useState<ChemicalCategory | 'all'>('all');
  const [chemicalSearchQuery, setChemicalSearchQuery] = useState<string>('');
  // Responsive mobile panel switcher: 'bench' | 'drawer' | 'hud'
  const [mobilePanel, setMobilePanel] = useState<'bench' | 'drawer' | 'hud'>('bench');

  // Active vessels on the laboratory bench: Clean empty beaker initialized
  const [vessels, setVessels] = useState<VesselState[]>([
    {
      id: 'v_1',
      name: '250 mL Beaker',
      type: 'beaker_250_open',
      maxVolumeMl: 250,
      currentVolumeMl: 0,
      contents: [],
      color: 'rgba(255, 255, 255, 0.05)',
      temperatureC: 22.0,
      pH: 7.0,
      precipitate: null,
      gasEvolving: null,
      activeIndicator: null,
      isStirring: false,
      isHeating: false,
      isClosed: false,
      escapedGasMassG: 0,
      trappedGasMassG: 0,
      internalPressureAtm: 1.0,
    },
  ]);

  // Selected active vessel on bench
  const [activeVesselId, setActiveVesselId] = useState<string>('v_1');

  // Transfer / Pouring Modal state
  const [transferModal, setTransferModal] = useState<{
    sourceVesselId: string;
    targetVesselId: string;
    volumeToTransfer: number;
  } | null>(null);

  // Chemical Addition Volume selector
  const [addAmountMl, setAddAmountMl] = useState<number>(10);

  // Chemistry Notebook / Lab Log
  const [labLogs, setLabLogs] = useState<LabLogEntry[]>([
    {
      id: 'log_init',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: 'Lab Session Initialized',
      details: 'Clean, empty 250 mL beaker placed on the workbench. Ready for reagent addition and experimental reactions.',
      type: 'addition',
    },
  ]);

  // Student user notebook text
  const [userNotes, setUserNotes] = useState<string>(
    'Observations:\n- Placed empty 250 mL beaker on workbench.\n- Ready to add chemicals, test reactions, measure pH, and monitor temperature changes.'
  );

  // Tare scale state
  const [scaleTareG, setScaleTareG] = useState<number>(0);
  const [copiedNotes, setCopiedNotes] = useState<boolean>(false);

  // Right sidebar HUD tabs & scroll control state
  const [hudTab, setHudTab] = useState<'all' | 'sensors' | 'notebook'>('all');
  const [notebookExpanded, setNotebookExpanded] = useState<boolean>(false);
  const hudScrollContainerRef = useRef<HTMLDivElement>(null);
  const sensorsTopRef = useRef<HTMLDivElement>(null);
  const thermoSectionRef = useRef<HTMLDivElement>(null);
  const speciesSectionRef = useRef<HTMLDivElement>(null);
  const notebookSectionRef = useRef<HTMLDivElement>(null);
  const journalSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToSensorsTop = () => {
    if (hudScrollContainerRef.current) {
      hudScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToNotebookBottom = () => {
    if (notebookSectionRef.current) {
      notebookSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (hudScrollContainerRef.current) {
      hudScrollContainerRef.current.scrollTo({
        top: hudScrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Active vessel object
  const activeVessel = useMemo(() => {
    return vessels.find((v) => v.id === activeVesselId) || vessels[0] || null;
  }, [vessels, activeVesselId]);

  // Thermal physics loop: Bunsen heating & ambient cooling
  useEffect(() => {
    const timer = setInterval(() => {
      setVessels((prev) =>
        prev.map((v) => {
          let nextTemp = v.temperatureC;
          let changed = false;

          if (v.isHeating) {
            // Heating with Bunsen burner: rise ~1.8 C per tick up to 105C (boiling)
            if (nextTemp < 105) {
              nextTemp = Math.min(105, nextTemp + 1.8);
              changed = true;
            }
          } else {
            // Passive ambient cooling towards 22.0 C
            if (nextTemp > 22.2) {
              nextTemp = Math.max(22.0, nextTemp - 0.35);
              changed = true;
            } else if (nextTemp < 21.8) {
              nextTemp = Math.min(22.0, nextTemp + 0.35);
              changed = true;
            }
          }

          if (!changed) return v;

          // Re-evaluate reaction state on temperature shift (e.g. thermal decomposition)
          const outcome = evaluateVesselState(v.contents, nextTemp, v.isHeating);
          const isNewThermalRx = !!(outcome.activeReactionName && outcome.activeReactionName !== v.activeReactionName);
          const thermalDuration = outcome.detailedReaction?.reactionTimeLengthSec || 6.0;

          // If a reaction is currently running in this vessel, preserve its active kinetics state!
          if (v.isReactionActive && !isNewThermalRx) {
            return {
              ...v,
              temperatureC: Number(nextTemp.toFixed(1)),
              color: outcome.color,
              pH: outcome.pH,
              foamHeightPercent: outcome.foamHeightPercent,
              activeReactionName: outcome.activeReactionName || v.activeReactionName,
              activeReactionEquation: outcome.activeReactionEquation || v.activeReactionEquation,
              reactionType: outcome.activeReactionType || v.reactionType,
              detailedReaction: outcome.detailedReaction || v.detailedReaction,
              allReactions: outcome.allReactions || v.allReactions,
            };
          }

          const now = Date.now();
          return {
            ...v,
            temperatureC: Number(nextTemp.toFixed(1)),
            color: outcome.color,
            pH: outcome.pH,
            precipitate: outcome.precipitate,
            gasEvolving: outcome.gasEvolving,
            foamHeightPercent: outcome.foamHeightPercent,
            activeReactionName: outcome.activeReactionName,
            activeReactionEquation: outcome.activeReactionEquation,
            reactionType: outcome.activeReactionType,
            detailedReaction: outcome.detailedReaction,
            allReactions: outcome.allReactions,
            reactionPulse: outcome.reactionPulse,
            reactionDurationSec: thermalDuration,
            reactionElapsedSec: isNewThermalRx ? 0.0 : (v.reactionElapsedSec ?? thermalDuration),
            reactionProgress: isNewThermalRx ? 0.0 : (v.reactionProgress ?? 1.0),
            reactionStartTimeMs: isNewThermalRx ? now : v.reactionStartTimeMs,
            isReactionActive: isNewThermalRx,
            isReactionComplete: !isNewThermalRx && !!outcome.detailedReaction,
          };
        })
      );
    }, 500);

    return () => clearInterval(timer);
  }, []);

  // Continuous Reaction Kinetics Loop: Uses wall-clock time so reaction runs smoothly for exactly its duration without glitches or premature completion
  useEffect(() => {
    const timer = setInterval(() => {
      setVessels((prev) => {
        const hasActive = prev.some((v) => v.isReactionActive && (v.reactionDurationSec ?? 0) > 0);
        if (!hasActive) return prev;

        const now = Date.now();
        let anyCompleted = false;

        const nextVessels = prev.map((v) => {
          if (!v.isReactionActive || !v.reactionDurationSec) return v;

          // Wall-clock elapsed time
          const startMs = v.reactionStartTimeMs || (now - (v.reactionElapsedSec || 0) * 1000);
          const actualElapsedSec = Math.max(0, (now - startMs) / 1000);
          const nextProgress = Math.min(1.0, actualElapsedSec / v.reactionDurationSec);
          const reachedEnd = actualElapsedSec >= v.reactionDurationSec;

          if (reachedEnd && !v.isReactionComplete) {
            anyCompleted = true;
          }

          return {
            ...v,
            reactionStartTimeMs: startMs,
            reactionElapsedSec: Number(Math.min(v.reactionDurationSec, actualElapsedSec).toFixed(2)),
            reactionProgress: Number(nextProgress.toFixed(3)),
            isReactionActive: !reachedEnd, // Stops continuous flow when reached 100% (NO LOOP!)
            isReactionComplete: reachedEnd,
          };
        });

        if (anyCompleted) {
          soundFx.playQuizChime(true);
        }

        return nextVessels;
      });
    }, 50);

    return () => clearInterval(timer);
  }, []);

  // Action: Replay reaction continuous kinetics from 0% to 100% over its time length
  const handleReplayReaction = (vesselId: string) => {
    soundFx.playReactionStep();
    const now = Date.now();
    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== vesselId) return v;
        const duration = v.detailedReaction?.reactionTimeLengthSec || 4.5;
        return {
          ...v,
          reactionDurationSec: duration,
          reactionElapsedSec: 0.0,
          reactionProgress: 0.0,
          reactionStartTimeMs: now,
          isReactionActive: true,
          isReactionComplete: false,
        };
      })
    );
  };

  // Filtered chemicals in drawer
  const filteredChemicals = useMemo(() => {
    return ALL_CHEMICALS.filter((chem) => {
      const matchCat = selectedChemicalCategory === 'all' || chem.category === selectedChemicalCategory;
      const matchQuery =
        !chemicalSearchQuery.trim() ||
        chem.name.toLowerCase().includes(chemicalSearchQuery.toLowerCase()) ||
        chem.formula.toLowerCase().includes(chemicalSearchQuery.toLowerCase()) ||
        chem.description.toLowerCase().includes(chemicalSearchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [selectedChemicalCategory, chemicalSearchQuery]);

  // Helper: Append log entry
  const appendLog = (entry: Omit<LabLogEntry, 'id' | 'timestamp'>) => {
    const newLog: LabLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...entry,
    };
    setLabLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  };

  // Action: Add new vessel to bench
  const handleAddVessel = (type: VesselType) => {
    soundFx.playReactionStep();
    const spec = VESSEL_SPECS[type];
    const count = vessels.length + 1;
    const newId = `v_${Date.now()}`;
    const isClosed = type === 'beaker_250_closed';
    const newVessel: VesselState = {
      id: newId,
      name: `${isClosed ? 'Closed Beaker' : type === 'beaker_250_open' ? 'Open Beaker' : spec.name.split(' ')[0]} ${count} (${spec.capacityMl} mL)`,
      type,
      maxVolumeMl: spec.capacityMl,
      currentVolumeMl: 0,
      contents: [],
      color: 'rgba(255, 255, 255, 0.05)',
      temperatureC: 22.0,
      pH: 7.0,
      precipitate: null,
      gasEvolving: null,
      activeIndicator: null,
      isStirring: false,
      isHeating: false,
      isClosed,
      escapedGasMassG: 0,
      trappedGasMassG: 0,
      internalPressureAtm: 1.0,
    };

    setVessels([...vessels, newVessel]);
    setActiveVesselId(newId);
    appendLog({
      title: `Added ${spec.name}`,
      details: isClosed
        ? `Placed 250 mL Closed Beaker with airtight seal on bench. Closed system: mass will remain constant even if gas is evolved (Conservation of Mass).`
        : `Placed 250 mL Open Beaker on bench. Open system: any gas evolved will escape into the atmosphere, causing mass to decrease.`,
      type: 'addition',
    });
  };

  // Action: Toggle airtight lid on vessel (Open System vs Closed System)
  const handleToggleVesselSealed = (vesselId: string) => {
    soundFx.playReactionStep();
    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== vesselId) return v;
        const willBeClosed = !v.isClosed;
        if (!willBeClosed) {
          // Unsealing: trapped gas escapes!
          const gasEscaped = v.trappedGasMassG || 0;
          appendLog({
            title: `Unsealed ${v.name} (Lid Removed)`,
            details:
              gasEscaped > 0
                ? `Airtight lid removed! Trapped gas (${v.gasEvolving?.formula || 'gas'}) rushed out into the atmosphere. Total system mass decreased by -${gasEscaped.toFixed(2)} g.`
                : `Airtight lid removed. Vessel is now an open system (gas will escape to air).`,
            type: 'measurement',
          });
          return {
            ...v,
            isClosed: false,
            escapedGasMassG: Number(((v.escapedGasMassG || 0) + gasEscaped).toFixed(2)),
            trappedGasMassG: 0,
            internalPressureAtm: 1.0,
          };
        } else {
          // Sealing: airtight lid applied!
          appendLog({
            title: `Sealed ${v.name} (Airtight Lid Applied)`,
            details: `Airtight lid applied. Vessel is now a closed system. Any evolved gases will be trapped inside and total mass will remain strictly constant (Law of Conservation of Mass).`,
            type: 'measurement',
          });
          return {
            ...v,
            isClosed: true,
            internalPressureAtm: 1.0,
          };
        }
      })
    );
  };

  // Action: Add chemical into active vessel
  const handleAddChemicalToActive = (chem: ChemicalItem, amount: number = addAmountMl) => {
    if (!activeVessel) return;

    if (activeVessel.currentVolumeMl + amount > activeVessel.maxVolumeMl) {
      soundFx.playQuizChime(false);
      appendLog({
        title: 'Vessel Overflow Warning',
        details: `Cannot add ${amount} mL of ${chem.name}: vessel capacity (${activeVessel.maxVolumeMl} mL) exceeded!`,
        type: 'measurement',
      });
      return;
    }

    soundFx.playBondSnap();

    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== activeVessel.id) return v;

        const nextContents: DissolvedChemical[] = [...v.contents];
        const existingIdx = nextContents.findIndex((c) => c.chemicalId === chem.id);

        if (existingIdx >= 0) {
          nextContents[existingIdx] = {
            ...nextContents[existingIdx],
            amountMl: nextContents[existingIdx].amountMl + amount,
          };
        } else {
          nextContents.push({
            chemicalId: chem.id,
            formula: chem.formula,
            name: chem.name,
            amountMl: amount,
            concentration: chem.concentration,
          });
        }

        const newTotalVol = nextContents.reduce((sum, c) => sum + c.amountMl, 0);
        const outcome = evaluateVesselState(nextContents, v.temperatureC, v.isHeating);

        const newTemp = Math.min(100, v.temperatureC + outcome.temperatureChange);

        if (outcome.reactionPulse) {
          soundFx.playQuizChime(true);
        }

        // Calculate gas mass evolution for Open vs Closed system
        const gasEvolved = outcome.gasEvolving;
        const gasMass = gasEvolved?.gasMassG || (gasEvolved ? 0.6 : 0);
        const isClosed = v.isClosed ?? false;
        const newEscapedGas = !isClosed ? (v.escapedGasMassG || 0) + gasMass : (v.escapedGasMassG || 0);
        const newTrappedGas = isClosed ? (v.trappedGasMassG || 0) + gasMass : (v.trappedGasMassG || 0);
        const newPressure = isClosed ? Number((1.0 + newTrappedGas * 0.35).toFixed(2)) : 1.0;

        // Create log event explaining mass conservation vs loss
        appendLog({
          title: outcome.activeReactionName || `Added ${amount} mL ${chem.formula} to ${v.name}`,
          reactionType: outcome.activeReactionType || undefined,
          detailedReaction: outcome.detailedReaction,
          allReactions: outcome.allReactions,
          reactants: outcome.detailedReaction?.reactants,
          products: outcome.detailedReaction?.products,
          details: `Reagent: ${chem.name}. Volume: ${newTotalVol} mL. Resulting pH: ${outcome.pH}. ${
            outcome.activeReactionType ? `Reaction Classification: [${outcome.activeReactionType}]. ` : ''
          }${outcome.temperatureChange > 0 ? `Exothermic heat release: +${outcome.temperatureChange.toFixed(1)}°C. ` : ''}${
            outcome.precipitate ? `Precipitate formed: ${outcome.precipitate.name} (${outcome.precipitate.texture}, ${outcome.precipitate.moles ? (outcome.precipitate.moles * 1000).toFixed(1) + ' mmol' : ''}). ` : ''
          }${
            gasEvolved
              ? isClosed
                ? `Gas formed: ${gasEvolved.name} (${gasMass.toFixed(2)} g, ${gasEvolved.moles ? (gasEvolved.moles * 1000).toFixed(1) + ' mmol' : ''}). Trapped in CLOSED beaker: mass remains strictly CONSTANT (Law of Conservation of Mass).`
                : `Gas formed: ${gasEvolved.name} (${gasMass.toFixed(2)} g, ${gasEvolved.moles ? (gasEvolved.moles * 1000).toFixed(1) + ' mmol' : ''}). Escaped from OPEN beaker: system mass DECREASED by -${gasMass.toFixed(2)} g.`
              : ''
          }`,
          equation: outcome.activeReactionEquation || undefined,
          type: outcome.precipitate || outcome.gasEvolving || outcome.reactionPulse ? 'reaction' : 'addition',
        });

        const isReactionTriggered = !!outcome.activeReactionName;
        const reactionDuration = outcome.detailedReaction?.reactionTimeLengthSec || 4.5;
        const now = Date.now();

        return {
          ...v,
          currentVolumeMl: newTotalVol,
          contents: nextContents,
          color: outcome.color,
          pH: outcome.pH,
          temperatureC: Number(newTemp.toFixed(1)),
          precipitate: outcome.precipitate,
          gasEvolving: outcome.gasEvolving,
          foamHeightPercent: outcome.foamHeightPercent,
          activeIndicator: outcome.activeIndicator,
          activeReactionName: outcome.activeReactionName,
          activeReactionEquation: outcome.activeReactionEquation,
          reactionType: outcome.activeReactionType,
          detailedReaction: outcome.detailedReaction,
          allReactions: outcome.allReactions,
          reactionPulse: outcome.reactionPulse,
          escapedGasMassG: Number(newEscapedGas.toFixed(2)),
          trappedGasMassG: Number(newTrappedGas.toFixed(2)),
          internalPressureAtm: newPressure,
          reactionDurationSec: reactionDuration,
          reactionElapsedSec: isReactionTriggered ? 0.0 : (v.reactionElapsedSec ?? reactionDuration),
          reactionProgress: isReactionTriggered ? 0.0 : (v.reactionProgress ?? 1.0),
          reactionStartTimeMs: isReactionTriggered ? now : v.reactionStartTimeMs,
          isReactionActive: isReactionTriggered,
          isReactionComplete: false,
        };
      })
    );
  };

  // Action: Toggle Bunsen Burner heating under vessel
  const handleToggleBunsen = (vesselId: string) => {
    soundFx.playReactionStep();
    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== vesselId) return v;
        const nextHeating = !v.isHeating;
        appendLog({
          title: `${nextHeating ? 'Bunsen Burner Ignited' : 'Bunsen Burner Extinguished'} under ${v.name}`,
          details: nextHeating
            ? 'Adjusted roaring blue flame. Vessel is heating rapidly towards boiling point.'
            : 'Flame turned off. Vessel will passively cool towards room temperature (22.0°C).',
          type: 'heat',
        });
        return { ...v, isHeating: nextHeating };
      })
    );
  };

  // Action: Stir solution
  const handleStir = (vesselId: string) => {
    soundFx.playReactionStep();
    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== vesselId) return v;
        return { ...v, isStirring: true };
      })
    );
    appendLog({
      title: `Stirred ${activeVessel?.name || 'Vessel'}`,
      details: 'Used glass stirring rod to thoroughly homogenize solution and promote reaction kinetics.',
      type: 'measurement',
    });
    setTimeout(() => {
      setVessels((prev) =>
        prev.map((v) => (v.id === vesselId ? { ...v, isStirring: false } : v))
      );
    }, 1200);
  };

  // Action: Empty / Clean vessel
  const handleEmptyVessel = (vesselId: string) => {
    soundFx.playReactionStep();
    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== vesselId) return v;
        return {
          ...v,
          currentVolumeMl: 0,
          contents: [],
          color: 'rgba(255, 255, 255, 0.05)',
          temperatureC: 22.0,
          pH: 7.0,
          precipitate: null,
          gasEvolving: null,
          foamHeightPercent: 0,
          activeIndicator: null,
          activeReactionName: null,
          activeReactionEquation: null,
          reactionType: null,
          detailedReaction: null,
          allReactions: [],
          reactionPulse: false,
          isHeating: false,
          isStirring: false,
          escapedGasMassG: 0,
          trappedGasMassG: 0,
          internalPressureAtm: 1.0,
          reactionDurationSec: undefined,
          reactionElapsedSec: 0,
          reactionProgress: 0,
          isReactionActive: false,
          isReactionComplete: false,
        };
      })
    );
    appendLog({
      title: 'Emptied and Cleaned Vessel',
      details: 'Rinsed with pure distilled water and wiped clean. All chemicals and active reactions cleared.',
      type: 'addition',
    });
  };

  // Action: Remove an individual chemical species from a vessel
  const handleRemoveChemical = (vesselId: string, chemicalId: string) => {
    soundFx.playReactionStep();
    const targetVessel = vessels.find((v) => v.id === vesselId);
    const removedChem = targetVessel?.contents.find((c) => c.chemicalId === chemicalId);

    setVessels((prev) =>
      prev.map((v) => {
        if (v.id !== vesselId) return v;
        const nextContents = v.contents.filter((c) => c.chemicalId !== chemicalId);
        const newTotalVol = nextContents.reduce((sum, c) => sum + c.amountMl, 0);

        if (nextContents.length === 0 || newTotalVol <= 0) {
          return {
            ...v,
            currentVolumeMl: 0,
            contents: [],
            color: 'rgba(255, 255, 255, 0.05)',
            temperatureC: 22.0,
            pH: 7.0,
            precipitate: null,
            gasEvolving: null,
            foamHeightPercent: 0,
            activeIndicator: null,
            activeReactionName: null,
            activeReactionEquation: null,
            reactionType: null,
            detailedReaction: null,
            allReactions: [],
            reactionPulse: false,
            isHeating: false,
            isStirring: false,
            escapedGasMassG: 0,
            trappedGasMassG: 0,
            internalPressureAtm: 1.0,
            reactionDurationSec: undefined,
            reactionElapsedSec: 0,
            reactionProgress: 0,
            isReactionActive: false,
            isReactionComplete: false,
          };
        }

        const outcome = evaluateVesselState(nextContents, v.temperatureC, v.isHeating);
        const hasReactionRemaining = !!outcome.activeReactionName;
        const dur = outcome.detailedReaction?.reactionTimeLengthSec || 4.5;
        return {
          ...v,
          currentVolumeMl: newTotalVol,
          contents: nextContents,
          color: outcome.color,
          pH: outcome.pH,
          precipitate: outcome.precipitate,
          gasEvolving: outcome.gasEvolving,
          foamHeightPercent: outcome.foamHeightPercent,
          activeIndicator: outcome.activeIndicator,
          activeReactionName: outcome.activeReactionName,
          activeReactionEquation: outcome.activeReactionEquation,
          reactionType: outcome.activeReactionType,
          detailedReaction: outcome.detailedReaction,
          allReactions: outcome.allReactions,
          reactionPulse: outcome.reactionPulse,
          reactionDurationSec: hasReactionRemaining ? dur : undefined,
          reactionElapsedSec: hasReactionRemaining ? dur : 0,
          reactionProgress: hasReactionRemaining ? 1.0 : 0,
          isReactionActive: false,
          isReactionComplete: hasReactionRemaining,
        };
      })
    );

    appendLog({
      title: `Removed ${removedChem?.formula || 'Chemical'} from ${targetVessel?.name || 'Vessel'}`,
      details: removedChem
        ? `Withdrew ${removedChem.amountMl} mL of ${removedChem.name} (${removedChem.formula}). Chemical inventory and reaction kinetics recalculated.`
        : 'Removed chemical species from vessel.',
      type: 'addition',
    });
  };

  // Action: Delete vessel from bench
  const handleDeleteVessel = (vesselId: string) => {
    soundFx.playReactionStep();
    setVessels((prev) => prev.filter((v) => v.id !== vesselId));
    if (activeVesselId === vesselId) {
      const remaining = vessels.filter((v) => v.id !== vesselId);
      setActiveVesselId(remaining[0]?.id || '');
    }
  };

  // Action: Complete liquid transfer / pouring from one vessel to another
  const handleExecuteTransfer = () => {
    if (!transferModal) return;
    const { sourceVesselId, targetVesselId, volumeToTransfer } = transferModal;

    const source = vessels.find((v) => v.id === sourceVesselId);
    const target = vessels.find((v) => v.id === targetVesselId);

    if (!source || !target || volumeToTransfer <= 0) return;

    const actualTransfer = Math.min(volumeToTransfer, source.currentVolumeMl);
    if (actualTransfer <= 0) return;

    if (target.currentVolumeMl + actualTransfer > target.maxVolumeMl) {
      soundFx.playQuizChime(false);
      appendLog({
        title: 'Pouring Failed',
        details: `Cannot transfer ${actualTransfer} mL into ${target.name}: would overflow max capacity!`,
        type: 'measurement',
      });
      setTransferModal(null);
      return;
    }

    soundFx.playBondSnap();

    // Proportionally transfer chemicals
    const ratio = actualTransfer / source.currentVolumeMl;
    const transferredChemicals: DissolvedChemical[] = source.contents.map((c) => ({
      ...c,
      amountMl: Number((c.amountMl * ratio).toFixed(2)),
    }));

    const remainingSourceContents: DissolvedChemical[] = source.contents.map((c) => ({
      ...c,
      amountMl: Number((c.amountMl * (1 - ratio)).toFixed(2)),
    })).filter((c) => c.amountMl > 0.05);

    const nextTargetContents: DissolvedChemical[] = [...target.contents];
    transferredChemicals.forEach((tc) => {
      const existing = nextTargetContents.find((c) => c.chemicalId === tc.chemicalId);
      if (existing) {
        existing.amountMl += tc.amountMl;
      } else {
        nextTargetContents.push({ ...tc });
      }
    });

    const targetOutcome = evaluateVesselState(nextTargetContents, target.temperatureC, target.isHeating);
    const sourceOutcome = evaluateVesselState(remainingSourceContents, source.temperatureC, source.isHeating);

    if (targetOutcome.reactionPulse) {
      soundFx.playQuizChime(true);
    }

    setVessels((prev) =>
      prev.map((v) => {
        if (v.id === source.id) {
          const remainingVol = Math.max(0, v.currentVolumeMl - actualTransfer);
          if (remainingVol <= 0 || remainingSourceContents.length === 0) {
            return {
              ...v,
              currentVolumeMl: 0,
              contents: [],
              color: 'rgba(255, 255, 255, 0.05)',
              temperatureC: 22.0,
              pH: 7.0,
              precipitate: null,
              gasEvolving: null,
              foamHeightPercent: 0,
              activeIndicator: null,
              activeReactionName: null,
              activeReactionEquation: null,
              reactionType: null,
              detailedReaction: null,
              allReactions: [],
              reactionPulse: false,
              escapedGasMassG: 0,
              trappedGasMassG: 0,
              internalPressureAtm: 1.0,
            };
          }
          return {
            ...v,
            currentVolumeMl: remainingVol,
            contents: remainingSourceContents,
            color: sourceOutcome.color,
            pH: sourceOutcome.pH,
            precipitate: sourceOutcome.precipitate,
            gasEvolving: sourceOutcome.gasEvolving,
            foamHeightPercent: sourceOutcome.foamHeightPercent,
            activeIndicator: sourceOutcome.activeIndicator,
            activeReactionName: sourceOutcome.activeReactionName,
            activeReactionEquation: sourceOutcome.activeReactionEquation,
            reactionType: sourceOutcome.activeReactionType,
            detailedReaction: sourceOutcome.detailedReaction,
            allReactions: sourceOutcome.allReactions,
            reactionPulse: false,
          };
        }
        if (v.id === target.id) {
          const newTemp = Math.min(100, v.temperatureC + targetOutcome.temperatureChange);
          const gasEvolved = targetOutcome.gasEvolving;
          const gasMass = gasEvolved?.gasMassG || (gasEvolved ? 0.6 : 0);
          const isClosed = v.isClosed ?? false;
          const newEscapedGas = !isClosed ? (v.escapedGasMassG || 0) + gasMass : (v.escapedGasMassG || 0);
          const newTrappedGas = isClosed ? (v.trappedGasMassG || 0) + gasMass : (v.trappedGasMassG || 0);
          const newPressure = isClosed ? Number((1.0 + newTrappedGas * 0.35).toFixed(2)) : 1.0;

          return {
            ...v,
            currentVolumeMl: v.currentVolumeMl + actualTransfer,
            contents: nextTargetContents,
            color: targetOutcome.color,
            pH: targetOutcome.pH,
            temperatureC: Number(newTemp.toFixed(1)),
            precipitate: targetOutcome.precipitate,
            gasEvolving: targetOutcome.gasEvolving,
            foamHeightPercent: targetOutcome.foamHeightPercent,
            activeIndicator: targetOutcome.activeIndicator,
            activeReactionName: targetOutcome.activeReactionName,
            activeReactionEquation: targetOutcome.activeReactionEquation,
            reactionType: targetOutcome.activeReactionType,
            detailedReaction: targetOutcome.detailedReaction,
            allReactions: targetOutcome.allReactions,
            reactionPulse: targetOutcome.reactionPulse,
            escapedGasMassG: Number(newEscapedGas.toFixed(2)),
            trappedGasMassG: Number(newTrappedGas.toFixed(2)),
            internalPressureAtm: newPressure,
            reactionDurationSec: targetOutcome.detailedReaction?.reactionTimeLengthSec || 4.5,
            reactionElapsedSec: targetOutcome.activeReactionName ? 0.0 : (v.reactionElapsedSec ?? 4.5),
            reactionProgress: targetOutcome.activeReactionName ? 0.0 : (v.reactionProgress ?? 1.0),
            reactionStartTimeMs: targetOutcome.activeReactionName ? Date.now() : v.reactionStartTimeMs,
            isReactionActive: !!targetOutcome.activeReactionName,
            isReactionComplete: false,
          };
        }
        return v;
      })
    );

    appendLog({
      title: targetOutcome.activeReactionName || `Poured ${actualTransfer} mL from ${source.name} ➔ ${target.name}`,
      reactionType: targetOutcome.activeReactionType || undefined,
      detailedReaction: targetOutcome.detailedReaction,
      allReactions: targetOutcome.allReactions,
      reactants: targetOutcome.detailedReaction?.reactants,
      products: targetOutcome.detailedReaction?.products,
      details: `Transferred solutions. Combined volume in ${target.name} is now ${
        target.currentVolumeMl + actualTransfer
      } mL. New pH: ${targetOutcome.pH}. ${
        targetOutcome.activeReactionType ? `Reaction Classification: [${targetOutcome.activeReactionType}]. ` : ''
      }${
        targetOutcome.detailedReaction?.deltaHKjPerMol !== undefined
          ? `[Thermodynamics: ΔH = ${targetOutcome.detailedReaction.deltaHKjPerMol > 0 ? '+' : ''}${targetOutcome.detailedReaction.deltaHKjPerMol} kJ/mol, ΔS = ${targetOutcome.detailedReaction.deltaSJoulesPerMolK && targetOutcome.detailedReaction.deltaSJoulesPerMolK > 0 ? '+' : ''}${targetOutcome.detailedReaction.deltaSJoulesPerMolK} J/(mol·K)]. `
          : ''
      }${
        targetOutcome.precipitate ? `Precipitated: ${targetOutcome.precipitate.name} (${targetOutcome.precipitate.texture})! ` : ''
      }${targetOutcome.gasEvolving ? `Gas evolved: ${targetOutcome.gasEvolving.name}!` : ''}`,
      equation: targetOutcome.activeReactionEquation || undefined,
      type: targetOutcome.precipitate || targetOutcome.gasEvolving || targetOutcome.reactionPulse ? 'reaction' : 'addition',
    });

    setTransferModal(null);
  };

  // Action: Load an entire guided experiment preset
  const handleLoadExperiment = (preset: ExperimentPreset) => {
    soundFx.playBondSnap();
    const newVessels: VesselState[] = preset.initialVessels.map((vSpec, idx) => {
      const spec = VESSEL_SPECS[vSpec.type];
      const isClosed = vSpec.type === 'beaker_250_closed';
      const contents: DissolvedChemical[] = vSpec.chemicals.map((c) => {
        const chem = ALL_CHEMICALS.find((x) => x.id === c.chemicalId)!;
        return {
          chemicalId: chem.id,
          formula: chem.formula,
          name: chem.name,
          amountMl: c.amountMl,
          concentration: chem.concentration,
        };
      });

      const totalVol = contents.reduce((s, c) => s + c.amountMl, 0);
      const outcome = evaluateVesselState(contents, 22.0, false);

      return {
        id: `v_exp_${idx}_${Date.now()}`,
        name: vSpec.name,
        type: vSpec.type,
        maxVolumeMl: spec.capacityMl,
        currentVolumeMl: totalVol,
        contents,
        color: outcome.color,
        temperatureC: 22.0,
        pH: outcome.pH,
        precipitate: outcome.precipitate,
        gasEvolving: outcome.gasEvolving,
        foamHeightPercent: outcome.foamHeightPercent,
        activeIndicator: outcome.activeIndicator,
        activeReactionName: outcome.activeReactionName,
        activeReactionEquation: outcome.activeReactionEquation,
        reactionType: outcome.activeReactionType,
        detailedReaction: outcome.detailedReaction,
        allReactions: outcome.allReactions,
        reactionPulse: outcome.reactionPulse,
        isStirring: false,
        isHeating: false,
        isClosed,
        escapedGasMassG: 0,
        trappedGasMassG: 0,
        internalPressureAtm: 1.0,
        reactionDurationSec: outcome.detailedReaction?.reactionTimeLengthSec || 4.5,
        reactionElapsedSec: outcome.detailedReaction ? (outcome.detailedReaction.reactionTimeLengthSec || 4.5) : 0,
        reactionProgress: outcome.detailedReaction ? 1.0 : 0.0,
        isReactionActive: false,
        isReactionComplete: !!outcome.detailedReaction,
      };
    });

    setVessels(newVessels);
    if (newVessels[0]) setActiveVesselId(newVessels[0].id);

    appendLog({
      title: `Loaded Experiment: ${preset.title}`,
      reactionType: newVessels[0]?.reactionType || undefined,
      detailedReaction: newVessels[0]?.detailedReaction,
      allReactions: newVessels[0]?.allReactions,
      reactants: newVessels[0]?.detailedReaction?.reactants,
      products: newVessels[0]?.detailedReaction?.products,
      details: `Ready to run "${preset.title}". Expected reaction: ${preset.expectedEquation}`,
      type: 'addition',
    });

    setUserNotes(
      `Experiment: ${preset.title}\nCategory: ${preset.category}\nDifficulty: ${preset.difficulty}\n\nEquation: ${preset.expectedEquation}\n\nProtocol Steps:\n${preset.suggestedSteps
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n')}\n\nObservations:\n- Labware set up on workbench.\n- `
    );
  };

  // Copy user notes to clipboard
  const handleCopyNotes = () => {
    navigator.clipboard.writeText(userNotes);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  // Insert complete stoichiometry, moles, and properties into user's notebook
  const handleInsertReactionToNotes = () => {
    if (!activeVessel) return;

    if (activeVessel.contents.length === 0 || activeVessel.currentVolumeMl === 0) {
      const emptyNote = `\n\n═══════════════════════════════════════════
VESSEL STATUS: ${activeVessel.name.toUpperCase()} (CLEAN & EMPTY)
═══════════════════════════════════════════
Vessel is clean and empty (0 mL). No chemical reagents or active reactions present.
Tare Balance Reading: ${grossMassG} g
Temperature: ${activeVessel.temperatureC.toFixed(1)}°C
System Configuration: ${activeVessel.isClosed ? 'Closed Beaker (Airtight Lid)' : 'Open Beaker (Open Atmosphere)'}
Status: Laboratory glassware rinsed and wiped clean.\n`;
      setUserNotes((prev) => prev + emptyNote);
      soundFx.playReactionStep();
      return;
    }

    const rxn = activeVessel.detailedReaction;
    let textToInsert = '';

    if (rxn && activeVessel.activeReactionName) {
      const isMulti = rxn.reactants.length > 2 || rxn.isMultiReactant;
      textToInsert = `\n\n═══════════════════════════════════════════
${isMulti ? `MULTI-REACTANT REACTION STOICHIOMETRY & KINETICS REPORT (${rxn.reactants.length} REACTANTS)` : 'REACTION STOICHIOMETRY & KINETICS REPORT'}
═══════════════════════════════════════════
Reaction Name: ${rxn.reactionName}
Reaction Classification: ${rxn.reactionType}
Category: [${rxn.typeCategory.toUpperCase()}]
${isMulti ? `System Configuration: Multi-Reactant System (${rxn.reactants.length} Active Reactants / Reagents Present)\nTotal Products Formed: ${rxn.products.length} Distinct Products\n` : ''}Balanced Equation:
${rxn.balancedEquation}
Thermochemistry: ${rxn.thermochemistry}
${rxn.deltaHKjPerMol !== undefined ? `• Enthalpy Change (ΔH): ${rxn.deltaHKjPerMol > 0 ? '+' : ''}${rxn.deltaHKjPerMol} kJ/mol (${rxn.deltaHKjPerMol < 0 ? 'Exothermic: releases heat energy' : 'Endothermic: absorbs thermal energy'})` : ''}
${rxn.deltaSJoulesPerMolK !== undefined ? `• Entropy Change (ΔS): ${rxn.deltaSJoulesPerMolK > 0 ? '+' : ''}${rxn.deltaSJoulesPerMolK} J/(mol·K) (${rxn.deltaSJoulesPerMolK > 0 ? 'Entropy increases / System increases disorder & dispersal' : 'Entropy decreases / System increases molecular order'})` : ''}
${rxn.deltaGKjPerMol !== undefined ? `• Gibbs Free Energy (ΔG at ${activeVessel.temperatureC.toFixed(1)}°C / ${(activeVessel.temperatureC + 273.15).toFixed(1)} K): ${rxn.deltaGKjPerMol > 0 ? '+' : ''}${rxn.deltaGKjPerMol} kJ/mol [${rxn.spontaneity === 'spontaneous' ? 'SPONTANEOUS (Thermodynamically Favored)' : rxn.spontaneity === 'non_spontaneous' ? 'NON-SPONTANEOUS (Energy Input Required)' : 'DYNAMIC EQUILIBRIUM'}]` : ''}
${rxn.thermoInterpretation ? `• Thermodynamic Analysis: ${rxn.thermoInterpretation}` : ''}

${rxn.subReactions && rxn.subReactions.length > 1 ? `[REACTION STAGES & MECHANISMS]\n${rxn.subReactions.map((s, idx) => `Stage ${idx + 1}: ${s.name} [${s.type}]\n• Equation: ${s.equation}`).join('\n\n')}\n\n` : ''}[ALL REACTANTS IN VESSEL (${rxn.reactants.length} SPECIES)]
${rxn.reactants
  .map(
    (r, i) =>
      `${i + 1}. ${r.formula} — ${r.name} [Role: ${r.role.toUpperCase()}]
   • Moles: ${r.moles.toFixed(4)} mol (${(r.moles * 1000).toFixed(1)} mmol)
   • Mass: ${r.massG} g (Molar Mass: ${r.molarMassGPerMol} g/mol) [State: (${r.state})]
   • Appearance: ${r.appearance}
   • Chemical Properties: ${r.properties.join('; ')}`
  )
  .join('\n')}

[ALL PRODUCTS FORMED BY REACTIONS (${rxn.products.length} SPECIES)]
${rxn.products.length > 0 ? rxn.products
  .map(
    (p, i) =>
      `${i + 1}. ${p.formula} — ${p.name}
   • Moles: ${p.moles.toFixed(4)} mol (${(p.moles * 1000).toFixed(1)} mmol)
   • Mass: ${p.massG} g (Molar Mass: ${p.molarMassGPerMol} g/mol) [State: (${p.state})]
   • Appearance: ${p.appearance}
   • Chemical Properties: ${p.properties.join('; ')}`
  )
  .join('\n') : '• Homogeneous dynamic solution equilibrium (no separate insoluble precipitate or gas evolved)'}

[THERMODYNAMIC SYSTEM & MASS CONSERVATION]
• Vessel: ${activeVessel.name} (${activeVessel.isClosed ? 'CLOSED / Sealed Beaker' : 'OPEN Beaker'})
• Measured Balance Reading: ${grossMassG} g
• ${
        activeVessel.isClosed
          ? `Trapped Gas Mass: +${activeVessel.trappedGasMassG || 0} g (Mass is Strictly Constant | Δm = 0.00 g)`
          : `Escaped Gas Mass: -${activeVessel.escapedGasMassG || 0} g (Mass Decreased due to atmospheric escape | Δm = -${activeVessel.escapedGasMassG || 0} g)`
      }
• Principle: ${rxn.conservationNote || 'Antoine Lavoisier Law of Conservation of Mass'}\n`;
    } else {
      textToInsert = `\n\n═══════════════════════════════════════════
VESSEL CHEMICAL INVENTORY: ${activeVessel.name}
═══════════════════════════════════════════
Total Volume: ${activeVessel.currentVolumeMl} mL | Gross Mass: ${grossMassG} g | pH: ${activeVessel.pH.toFixed(2)} | Temp: ${activeVessel.temperatureC.toFixed(1)}°C
System Type: ${activeVessel.isClosed ? 'Closed Beaker (Airtight Lid)' : 'Open Beaker (Open Atmosphere)'}

SPECIES & MOLES:
${activeVessel.contents
  .map((c, i) => {
    const { moles, massG } = calculateChemicalMoles(c.chemicalId, c.amountMl);
    const meta = getChemicalMetadata(c.chemicalId);
    return `${i + 1}. ${c.formula} — ${c.name}
   • Amount: ${c.amountMl} mL / g
   • Moles: ${moles.toFixed(4)} mol (${(moles * 1000).toFixed(1)} mmol)
   • Mass: ${massG} g | Molar Mass: ${meta.molarMass} g/mol [${meta.state}]
   • Properties: ${meta.properties.join('; ')}`;
  })
  .join('\n')}\n`;
    }

    setUserNotes((prev) => prev + textToInsert);
    soundFx.playReactionStep();
  };

  // Calculate gross mass on analytical scale for active vessel
  const grossMassG = useMemo(() => {
    if (!activeVessel) return 0;
    // Tare weight of glassware: ~110g for beaker, ~125g for flask, ~25g for test tube, +15g for sealed watch glass lid
    const baseGlassTare =
      activeVessel.type === 'test_tube_50'
        ? 25.0
        : activeVessel.type === 'erlenmeyer_250'
        ? 125.0
        : activeVessel.type === 'burette_50'
        ? 85.0
        : 110.0;
    const lidTare = activeVessel.isClosed ? 15.0 : 0.0;
    const glassTare = baseGlassTare + lidTare;

    const liquidMass = activeVessel.contents.reduce((sum, c) => {
      const chem = ALL_CHEMICALS.find((x) => x.id === c.chemicalId);
      const density = chem?.densityGPerMl || 1.0;
      return sum + c.amountMl * density;
    }, 0);

    // In Open Beaker: Mass decreases as gas escapes into the room!
    // In Closed Beaker: Mass remains strictly constant (Conservation of Mass)!
    const massReduction = !activeVessel.isClosed && activeVessel.escapedGasMassG ? activeVessel.escapedGasMassG : 0;

    const total = glassTare + liquidMass - massReduction - scaleTareG;
    return Number(Math.max(0, total).toFixed(2));
  }, [activeVessel, scaleTareG]);

  // Universal indicator color strip generator for active pH
  const getPHColor = (ph: number) => {
    if (ph < 3.0) return '#ef4444'; // red
    if (ph < 5.0) return '#f97316'; // orange
    if (ph < 6.5) return '#eab308'; // yellow
    if (ph < 7.5) return '#22c55e'; // green (neutral)
    if (ph < 9.0) return '#06b6d4'; // cyan
    if (ph < 11.5) return '#3b82f6'; // sapphire blue
    return '#8b5cf6'; // violet
  };

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Mobile Mode Switcher Bar (Visible only on small devices < md) */}
      <div className="md:hidden flex items-center justify-between p-1.5 bg-slate-900 border-b border-slate-800 z-30 shrink-0">
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full text-xs font-semibold gap-1">
          <button
            onClick={() => setMobilePanel('drawer')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mobilePanel === 'drawer' ? 'bg-sky-500 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Chemicals</span>
          </button>
          <button
            onClick={() => setMobilePanel('bench')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mobilePanel === 'bench' ? 'bg-sky-500 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Workbench</span>
          </button>
          <button
            onClick={() => setMobilePanel('hud')}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mobilePanel === 'hud' ? 'bg-sky-500 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sensors & Notes</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LEFT COLUMN: CHEMICAL STOCKROOM & EQUIPMENT DRAWER        */}
      {/* ========================================================= */}
      <aside className={`w-full md:w-80 lg:w-96 flex-col border-r border-slate-800 bg-slate-900/95 z-20 flex-shrink-0 h-full ${
        mobilePanel === 'drawer' ? 'flex flex-1' : 'hidden md:flex'
      }`}>
        {/* Drawer Header Tabs */}
        <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full">
            <button
              onClick={() => setDrawerTab('chemicals')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                drawerTab === 'chemicals'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Chemicals</span>
            </button>
            <button
              onClick={() => setDrawerTab('glassware')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                drawerTab === 'glassware'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Labware</span>
            </button>
            <button
              onClick={() => setDrawerTab('experiments')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                drawerTab === 'experiments'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Presets</span>
            </button>
          </div>
        </div>

        {/* Tab Content 1: CHEMICAL STOCKROOM */}
        {drawerTab === 'chemicals' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar & Dispense Volume selector */}
            <div className="p-3 border-b border-slate-800 flex flex-col gap-2 bg-slate-950/30">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search chemicals (HCl, NaOH, CuSO₄)..."
                  value={chemicalSearchQuery}
                  onChange={(e) => setChemicalSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'acids', label: 'Acids' },
                    { id: 'bases', label: 'Bases' },
                    { id: 'salts', label: 'Salts' },
                    { id: 'metals', label: 'Metals' },
                    { id: 'indicators', label: 'Indicators' },
                    { id: 'solvents', label: 'Solvents' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedChemicalCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedChemicalCategory === cat.id
                        ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 font-bold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Dispense Dose Selector */}
              <div className="flex items-center justify-between bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80 text-xs">
                <span className="text-slate-400 font-medium">Add Dose:</span>
                <div className="flex items-center gap-1">
                  {[2, 5, 10, 25, 50].map((dose) => (
                    <button
                      key={dose}
                      onClick={() => setAddAmountMl(dose)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                        addAmountMl === dose
                          ? 'bg-sky-500 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dose}mL
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chemical Item Cards List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredChemicals.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No chemicals matching "{chemicalSearchQuery}"
                </div>
              ) : (
                filteredChemicals.map((chem) => (
                  <div
                    key={chem.id}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: chem.color }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-xs">{chem.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-sky-400 font-semibold">
                            {chem.formula}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-400 border border-slate-700">
                        {chem.category}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-tight">
                      {chem.description}
                    </p>

                    {chem.hazardNote && (
                      <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                        <span>{chem.hazardNote}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 mt-0.5">
                      <span className="text-[10px] text-slate-500">
                        Target: <span className="text-slate-300 font-medium">{activeVessel?.name || 'No vessel selected'}</span>
                      </span>
                      <button
                        onClick={() => handleAddChemicalToActive(chem)}
                        disabled={!activeVessel}
                        className="px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-500 text-sky-200 hover:text-white border border-sky-500/40 text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40 transition-all"
                        title={`Add ${addAmountMl} mL of ${chem.name} into ${activeVessel?.name}`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add +{addAmountMl}mL</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: GLASSWARE & INSTRUMENTS */}
        {drawerTab === 'glassware' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Beaker Options Highlight Box */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-sky-500/30 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
                <span>Beaker Options (Conservation of Mass)</span>
              </span>
              <p className="text-[10px] text-slate-400">
                Choose between an Open Beaker (gas escapes, mass decreases) or a Closed Beaker with an airtight seal (gas trapped, mass constant).
              </p>
            </div>

            {/* Option 1: Open Beaker */}
            <div className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-amber-500/40 hover:border-amber-400 transition-all flex flex-col gap-2 group shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <Unlock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>250 mL Open Beaker</span>
                    </h4>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      Mass Changes (Open System)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddVessel('beaker_250_open')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                  title="Add Open Beaker to workbench"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Open to room atmosphere. Any gaseous products evolved (CO₂, H₂, O₂) escape freely into the air, causing the total mass to decrease on the analytical balance.
              </p>
            </div>

            {/* Option 2: Closed Beaker */}
            <div className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-emerald-500/40 hover:border-emerald-400 transition-all flex flex-col gap-2 group shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>250 mL Closed Beaker</span>
                    </h4>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Mass Constant (Airtight Sealed)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddVessel('beaker_250_closed')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                  title="Add Closed Beaker with airtight lid to workbench"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Sealed with an airtight watch-glass lid. Gaseous products remain trapped inside the vessel. Demonstrates Antoine Lavoisier's Law of Conservation of Mass (mass remains constant).
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Other Laboratory Glassware
              </span>
              {(['erlenmeyer_250', 'test_tube_50', 'graduated_100', 'burette_50', 'evaporating_dish'] as VesselType[]).map((vType) => {
                const spec = VESSEL_SPECS[vType];
                return (
                  <div
                    key={vType}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all flex items-center justify-between group mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                        <FlaskConical className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{spec.name}</h4>
                        <p className="text-[9px] text-slate-400">
                          {spec.capacityMl} mL • {spec.shape.split('•')[0]}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddVessel(vType)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500 text-slate-200 hover:text-white transition-all shadow-sm"
                      title={`Place ${spec.name} on workbench`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content 3: GUIDED EXPERIMENTS PRESETS */}
        {drawerTab === 'experiments' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Select Guided Lab Protocol
            </span>
            {GUIDED_EXPERIMENTS.map((exp) => (
              <div
                key={exp.id}
                className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col gap-2 group"
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                      {exp.title}
                    </h4>
                    <span className="text-[10px] text-slate-400">{exp.category}</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      exp.difficulty === 'Beginner'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {exp.difficulty}
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  {exp.summary}
                </p>

                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 font-mono text-[9px] text-sky-300">
                  {exp.expectedEquation}
                </div>

                <button
                  onClick={() => handleLoadExperiment(exp)}
                  className="w-full mt-1 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-500 text-sky-200 hover:text-white border border-sky-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Load Protocol on Workbench</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* ========================================================= */}
      {/* CENTER: INTERACTIVE LABORATORY WORKBENCH BENCHTOP         */}
      {/* ========================================================= */}
      <section className={`flex-1 flex-col overflow-hidden relative h-full ${
        mobilePanel === 'bench' ? 'flex' : 'hidden md:flex'
      }`}>
        {/* Bench Top Bar */}
        <div className="h-11 border-b border-slate-800 bg-slate-950/70 px-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">
              Workbench • {vessels.length} vessel{vessels.length !== 1 ? 's' : ''} on bench
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Active Vessel:</span>
            <select
              value={activeVesselId}
              onChange={(e) => setActiveVesselId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-sky-500"
            >
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.currentVolumeMl} mL)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Workbench Area with Grid Pattern */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
          {vessels.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-900/60 rounded-3xl border border-slate-800 border-dashed max-w-md">
              <FlaskConical className="w-12 h-12 text-slate-600 mb-3 animate-bounce" />
              <h3 className="text-sm font-bold text-slate-300">Workbench is Empty</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Select glassware from the Labware drawer on the left, or load a guided experiment preset.
              </p>
              <button
                onClick={() => handleAddVessel('beaker_250')}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Place 250 mL Beaker</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end justify-center gap-8 py-8 w-full max-w-5xl">
              {vessels.map((v) => {
                const isSelected = v.id === activeVesselId;
                const spec = VESSEL_SPECS[v.type];
                const fillPercent = Math.min(100, Math.max(0, (v.currentVolumeMl / v.maxVolumeMl) * 100));

                return (
                  <div
                    key={v.id}
                    onClick={() => setActiveVesselId(v.id)}
                    className={`flex flex-col items-center group cursor-pointer transition-all ${
                      isSelected ? 'scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Vessel Label Badge */}
                    <div
                      className={`px-3 py-1 rounded-xl text-xs font-semibold mb-3 flex items-center gap-1.5 transition-all shadow-md ${
                        isSelected
                          ? 'bg-sky-500 text-white shadow-sky-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{v.name}</span>
                      <span className="font-mono text-[10px] text-white/80">
                        {v.currentVolumeMl} / {v.maxVolumeMl} mL
                      </span>
                    </div>

                    {/* Glassware Container SVG / Realistic Graphic */}
                    <div
                      className="relative flex items-end justify-center"
                      style={{
                        width: v.type === 'test_tube_50' ? '68px' : v.type === 'burette_50' ? '56px' : '160px',
                        height: `${spec.defaultHeightPx}px`,
                      }}
                    >
                      {/* Floating Reaction Pill */}
                      {v.activeReactionName && (
                        <div className="absolute -top-11 z-20 flex flex-col items-center pointer-events-none animate-bounce">
                          <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] shadow-lg flex items-center gap-1.5 whitespace-nowrap border border-amber-300">
                            <Sparkles className="w-3 h-3 fill-current text-white animate-spin" />
                            <span>{v.activeReactionName}</span>
                          </div>
                        </div>
                      )}

                      {/* Airtight Sealed Watch Glass Lid (for Closed Beakers) */}
                      {v.isClosed && (
                        <div className="absolute -top-3 inset-x-0 h-4 flex items-center justify-center z-30 pointer-events-none">
                          <div className="w-[96%] h-3 bg-gradient-to-b from-sky-100/70 via-white/50 to-slate-400/80 rounded-t-full border border-sky-300 shadow-md backdrop-blur-xs flex items-center justify-center">
                            <div className="w-5 h-1.5 bg-slate-700/90 rounded-full border border-slate-500 shadow-xs" />
                          </div>
                          {/* Rubber seal clamps on left and right */}
                          <div className="absolute left-0 top-1.5 w-1.5 h-3 bg-slate-600 rounded-xs shadow-xs" />
                          <div className="absolute right-0 top-1.5 w-1.5 h-3 bg-slate-600 rounded-xs shadow-xs" />
                        </div>
                      )}

                      {/* Top Status Tag: Open vs Closed with Click to Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVesselSealed(v.id);
                        }}
                        className={`absolute -top-7 right-0 z-30 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold shadow-md transition-all cursor-pointer ${
                          v.isClosed
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                        title={
                          v.isClosed
                            ? 'Closed Beaker (Airtight Lid): Gas trapped, mass constant. Click to unseal lid.'
                            : 'Open Beaker: Gas escapes to air, mass decreases. Click to seal airtight lid.'
                        }
                      >
                        {v.isClosed ? (
                          <>
                            <Lock className="w-2.5 h-2.5" />
                            <span>Closed (Constant)</span>
                            {v.internalPressureAtm && v.internalPressureAtm > 1.0 && (
                              <span className="font-mono text-[8px] bg-slate-950 text-emerald-300 px-1 rounded">
                                {v.internalPressureAtm}atm
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Unlock className="w-2.5 h-2.5" />
                            <span>Open (Mass Drops)</span>
                          </>
                        )}
                      </button>

                      {/* Vessel Glass Shell */}
                      <div
                        className={`absolute inset-0 border-2 transition-all overflow-hidden ${
                          v.type === 'erlenmeyer_250'
                            ? 'rounded-t-sm rounded-b-2xl'
                            : v.type === 'test_tube_50'
                            ? 'rounded-b-full rounded-t-sm'
                            : 'rounded-b-2xl rounded-t-sm'
                        } ${
                          v.reactionPulse
                            ? 'border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-pulse'
                            : isSelected
                            ? 'border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.4)]'
                            : 'border-slate-500/60'
                        } bg-gradient-to-b from-white/10 via-slate-900/30 to-slate-900/60 backdrop-blur-xs`}
                      >
                        {/* Lip / Rim highlight at top */}
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                        {/* Graduation marks on side */}
                        <div className="absolute right-1.5 inset-y-3 flex flex-col justify-between items-end opacity-50 text-[8px] font-mono select-none pointer-events-none">
                          <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-white/70" /><span>{v.maxVolumeMl}</span></div>
                          <div className="flex items-center gap-1"><span className="w-1.5 h-0.5 bg-white/50" /><span>{Math.round(v.maxVolumeMl * 0.75)}</span></div>
                          <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-white/70" /><span>{Math.round(v.maxVolumeMl * 0.5)}</span></div>
                          <div className="flex items-center gap-1"><span className="w-1.5 h-0.5 bg-white/50" /><span>{Math.round(v.maxVolumeMl * 0.25)}</span></div>
                          <div className="flex items-center gap-1"><span className="w-2 h-0.5 bg-white/70" /><span>0</span></div>
                        </div>

                        {/* Liquid Body */}
                        <div
                          className="absolute bottom-0 left-0 right-0 transition-all duration-500 flex flex-col justify-end"
                          style={{
                            height: `${fillPercent}%`,
                            backgroundColor: v.color,
                            opacity: 0.92,
                          }}
                        >
                          {/* Curved Meniscus surface with fluid gloss highlight */}
                          {fillPercent > 0 && (
                            <div className="w-full h-2.5 bg-gradient-to-r from-white/30 via-white/50 to-white/30 rounded-full blur-[0.5px] -mt-1 shadow-sm" />
                          )}

                          {/* Foam / Froth Head on top of liquid */}
                          {v.foamHeightPercent && v.foamHeightPercent > 0 && (
                            <div
                              className="w-full relative overflow-hidden flex items-center justify-around border-b border-white/60 shadow-md"
                              style={{
                                height: `${Math.min(42, v.foamHeightPercent * 0.9)}px`,
                                background: 'linear-gradient(to top, rgba(255,255,255,0.7), rgba(255,255,255,0.95))',
                              }}
                            >
                              {[1, 2, 3, 4, 5, 6, 7].map((fb) => (
                                <span
                                  key={fb}
                                  className="rounded-full bg-white border border-slate-300 animate-ping inline-block"
                                  style={{
                                    width: `${4 + (fb % 4) * 2}px`,
                                    height: `${4 + (fb % 4) * 2}px`,
                                    animationDuration: `${0.4 + (fb % 3) * 0.25}s`,
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Dynamic Rising Bubbles (Effervescence) */}
                          {v.gasEvolving && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((b) => (
                                <span
                                  key={b}
                                  className="absolute rounded-full bg-white/80 border border-white animate-bubble shadow-sm"
                                  style={{
                                    width: `${3 + (b % 5) * 1.5}px`,
                                    height: `${3 + (b % 5) * 1.5}px`,
                                    left: `${10 + b * 11}%`,
                                    bottom: '0px',
                                    animationDuration: `${0.6 + (b % 4) * 0.25}s`,
                                    animationDelay: `${b * 0.12}s`,
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Colloidal Suspension Cloud (if precipitate is colloidal) */}
                          {v.precipitate && v.precipitate.texture === 'colloidal' && (
                            <div
                              className="absolute inset-0 pointer-events-none opacity-80 backdrop-blur-[1px]"
                              style={{
                                background: `radial-gradient(circle, ${v.precipitate.color}90 0%, ${v.precipitate.color}40 70%, transparent 100%)`,
                              }}
                            />
                          )}

                          {/* Solid Precipitate settled at bottom with distinct textures */}
                          {v.precipitate && (
                            <div
                              className="relative w-full border-t border-black/30 transition-all overflow-hidden flex items-center justify-center"
                              style={{
                                height: `${Math.min(28, 10 + v.precipitate.amountG * 35)}px`,
                                backgroundColor: v.precipitate.color,
                              }}
                              title={`Precipitate: ${v.precipitate.name} (${v.precipitate.texture})`}
                            >
                              {/* Crystalline Golden Sparkles (Golden Rain) */}
                              {v.precipitate.texture === 'crystalline' && (
                                <div className="absolute inset-0 flex items-center justify-around pointer-events-none">
                                  <span className="text-[10px] animate-pulse">✨</span>
                                  <span className="text-[8px] animate-bounce">⭐</span>
                                  <span className="text-[10px] animate-pulse">✨</span>
                                </div>
                              )}

                              {/* Curdy or Gelatinous Textured Waves */}
                              {(v.precipitate.texture === 'gelatinous' || v.precipitate.texture === 'curdy') && (
                                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle,#ffffff_1px,transparent_1px)] [background-size:6px_6px]" />
                              )}

                              {/* Granular black sediment */}
                              {v.precipitate.texture === 'granular' && (
                                <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle,#334155_1px,transparent_1px)] [background-size:4px_4px]" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Glass surface reflections and vertical specular highlight */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-transparent to-white/5 pointer-events-none" />
                        <div className="absolute left-2 inset-y-0 w-1 bg-gradient-to-b from-white/30 via-white/10 to-transparent pointer-events-none rounded-full" />
                      </div>

                      {/* Rising Steam Puffs when heated (> 80C) */}
                      {v.temperatureC >= 80 && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none">
                          <span className="text-slate-300 animate-pulse text-xs">💨</span>
                          <span className="text-slate-400 animate-bounce text-sm">💨</span>
                          <span className="text-slate-300 animate-pulse text-xs">💨</span>
                        </div>
                      )}
                    </div>

                    {/* Realistic Bunsen Burner */}
                    <div className="relative mt-2 flex flex-col items-center">
                      {v.isHeating ? (
                        <div className="flex flex-col items-center">
                          {/* Multi-layered roaring blue and gold flame */}
                          <div className="relative flex items-center justify-center">
                            {/* Outer glowing cyan sheath */}
                            <div className="w-5 h-9 bg-gradient-to-t from-sky-400 via-amber-300 to-transparent rounded-full blur-[2px] animate-bounce" />
                            {/* Inner roaring electric blue cone */}
                            <div className="absolute bottom-0 w-2.5 h-5 bg-gradient-to-t from-sky-300 to-sky-500 rounded-full blur-[1px] animate-pulse" />
                          </div>
                          {/* Burner Chimney & Base */}
                          <div className="w-5 h-4 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-700 rounded-t-sm border border-slate-600" />
                          <div className="w-8 h-1.5 bg-slate-800 rounded-sm" />
                          <div className="w-12 h-1 bg-slate-900 rounded-full" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="h-5 flex items-center justify-center text-[10px] text-slate-500 font-mono">
                            Wire Gauze Stand
                          </div>
                          <div className="w-12 h-0.5 bg-slate-800 rounded-full" />
                        </div>
                      )}
                    </div>

                    {/* Real-Time Live Status Tags on Vessel */}
                    <div className="mt-2 flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <span
                          className="px-1.5 py-0.2 rounded font-bold"
                          style={{
                            backgroundColor: `${getPHColor(v.pH)}25`,
                            color: getPHColor(v.pH),
                            border: `1px solid ${getPHColor(v.pH)}50`,
                          }}
                        >
                          pH {v.pH.toFixed(1)}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-semibold ${
                            v.temperatureC > 30
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {v.temperatureC.toFixed(1)}°C
                        </span>
                      </div>

                      {v.contents.length > 0 && v.precipitate && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded truncate max-w-[160px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.precipitate.color }} />
                          <span>{v.precipitate.formula}</span>
                          <span className="text-[8px] text-slate-400">({v.precipitate.texture})</span>
                        </span>
                      )}

                      {v.contents.length > 0 && v.gasEvolving && (
                        <span className="text-[10px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping inline-block" />
                          {v.gasEvolving.formula}
                        </span>
                      )}

                      {/* Active Reaction Kinetics Status & Progress */}
                      {v.contents.length > 0 && v.activeReactionEquation && v.isReactionActive && (
                        <div className="mt-1 w-full max-w-[215px] p-1.5 rounded-lg bg-slate-950 border border-amber-500/60 flex flex-col gap-1 shadow-sm">
                          <div className="flex items-center justify-between text-[8px] font-mono font-bold text-amber-300">
                            <span className="flex items-center gap-1">
                              <Timer className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                              <span>{(v.reactionElapsedSec ?? 0).toFixed(1)}s / {(v.reactionDurationSec ?? 4.0).toFixed(1)}s</span>
                            </span>
                            <span className="text-amber-400 font-bold">{Math.round((v.reactionProgress ?? 0) * 100)}%</span>
                          </div>
                          {/* Live Reaction Progress Bar */}
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400 h-full transition-all duration-75"
                              style={{ width: `${Math.round((v.reactionProgress ?? 0) * 100)}%` }}
                            />
                          </div>
                          <div className="text-[8px] font-mono text-slate-300 truncate text-center">
                            {v.activeReactionEquation}
                          </div>
                        </div>
                      )}

                      {/* Completed Reaction Pill with Time Length & Replay Button */}
                      {v.contents.length > 0 && v.activeReactionEquation && !v.isReactionActive && (
                        <div
                          className="mt-1 px-2 py-1 rounded-lg bg-slate-900 border border-emerald-500/50 text-[9px] font-mono text-emerald-300 w-full max-w-[215px] shadow-sm flex items-center justify-between gap-1"
                          title={`Reaction Complete in ${(v.reactionDurationSec ?? 4.0).toFixed(1)}s: ${v.activeReactionEquation}`}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span className="text-[8px] uppercase font-bold text-emerald-400 flex-shrink-0">Complete:</span>
                            <span className="text-[8px] text-sky-300 font-bold flex-shrink-0">{(v.reactionDurationSec ?? 4.0).toFixed(1)}s</span>
                            <span className="truncate text-slate-300 text-[8px]">{v.activeReactionEquation.split('➔')[0]}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplayReaction(v.id);
                            }}
                            className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[8px] font-bold border border-sky-500/40 flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                            title="Replay continuous reaction over time length"
                          >
                            <RotateCcw className="w-2 h-2" /> Replay
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick Vessel Interactive Control Bar */}
                    <div className="mt-3 flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-md">
                      {/* Pour / Transfer button */}
                      {vessels.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const other = vessels.find((x) => x.id !== v.id);
                            if (other) {
                              setTransferModal({
                                sourceVesselId: v.id,
                                targetVesselId: other.id,
                                volumeToTransfer: Math.min(25, v.currentVolumeMl),
                              });
                            }
                          }}
                          disabled={v.currentVolumeMl === 0}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all"
                          title="Pour liquid into another vessel on bench"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Airtight Lid Toggle Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVesselSealed(v.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          v.isClosed
                            ? 'bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                        }`}
                        title={
                          v.isClosed
                            ? 'Unseal lid: Allow trapped gases to escape (Mass will decrease)'
                            : 'Seal beaker with airtight lid: Trap gases (Mass will remain constant)'
                        }
                      >
                        {v.isClosed ? <Lock className="w-3.5 h-3.5 text-emerald-400" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>

                      {/* Bunsen Burner toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBunsen(v.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          v.isHeating
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                        }`}
                        title={v.isHeating ? 'Extinguish Bunsen Burner flame' : 'Light Bunsen Burner under vessel'}
                      >
                        <Flame className="w-3.5 h-3.5" />
                      </button>

                      {/* Stir rod */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStir(v.id);
                        }}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-all ${
                          v.isStirring ? 'rotate-45 text-sky-400' : ''
                        }`}
                        title="Stir solution with glass rod"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Empty vessel */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmptyVessel(v.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all"
                        title="Wash and empty vessel"
                      >
                        <Droplets className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete vessel */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVessel(v.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
                        title="Remove vessel from workbench"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile floating quick jump dock on workbench */}
        <div className="md:hidden absolute bottom-2 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <button
            onClick={() => setMobilePanel('drawer')}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900/95 border border-slate-700 text-sky-400 text-xs font-bold shadow-xl flex items-center justify-center gap-1.5 pointer-events-auto backdrop-blur-md hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Add Chemicals</span>
          </button>
          <button
            onClick={() => setMobilePanel('hud')}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900/95 border border-slate-700 text-amber-300 text-xs font-bold shadow-xl flex items-center justify-center gap-1.5 pointer-events-auto backdrop-blur-md hover:bg-slate-800"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Sensors & Notes</span>
          </button>
        </div>
      </section>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: DIGITAL SENSORS & CHEMISTRY NOTEBOOK        */}
      {/* ========================================================= */}
      <aside className={`w-full md:w-80 lg:w-96 flex-col border-l border-slate-800 bg-slate-900/95 z-20 flex-shrink-0 h-full min-h-0 overflow-hidden ${
        mobilePanel === 'hud' ? 'flex flex-1' : 'hidden md:flex'
      }`}>
        {/* Top Header & View Mode Switcher */}
        <div className="p-2.5 border-b border-slate-800 bg-slate-950/85 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                Notebook & Sensor HUD
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-300 truncate max-w-[130px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              {activeVessel?.name || 'No Vessel'}
            </span>
          </div>

          {/* View Tab Selector: All View, Sensors HUD, Lab Notebook */}
          <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full text-xs">
            <button
              onClick={() => setHudTab('all')}
              className={`flex-1 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all ${
                hudTab === 'all'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Unified continuous scroll view of all sensors, reactions, logs, and notebook"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All View</span>
            </button>
            <button
              onClick={() => setHudTab('sensors')}
              className={`flex-1 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all ${
                hudTab === 'sensors'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Dedicated scrollable view of digital probes, conservation of mass, and thermodynamics"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Sensors HUD</span>
            </button>
            <button
              onClick={() => setHudTab('notebook')}
              className={`flex-1 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all ${
                hudTab === 'notebook'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Dedicated view of Student Lab Notebook and Automated Journal Logs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notebook</span>
              {labLogs.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-sky-950 text-sky-300 font-mono border border-sky-700/60">
                  {labLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Jump Bar (Sticky in All View for instant navigation in landscape orientation) */}
        {hudTab === 'all' && (
          <div className="px-2.5 py-1.5 bg-slate-950/95 border-b border-slate-800 text-[10px] text-slate-400 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] text-slate-400 font-medium">Quick Jump:</span>
            <div className="flex items-center gap-1 font-mono text-[9px]">
              <button
                onClick={scrollToSensorsTop}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-white border border-slate-800 transition-colors flex items-center gap-0.5"
                title="Scroll to Top / Sensors"
              >
                <ArrowUp className="w-2.5 h-2.5" />
                <span>Sensors</span>
              </button>
              {activeVessel && activeVessel.contents.length > 0 && activeVessel.activeReactionName && activeVessel.detailedReaction && (
                <button
                  onClick={() => scrollToSection(thermoSectionRef)}
                  className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-white border border-slate-800 transition-colors"
                  title="Scroll to Thermodynamics & Stoichiometry"
                >
                  <span>Thermodynamics</span>
                </button>
              )}
              <button
                onClick={() => scrollToSection(speciesSectionRef)}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white border border-slate-800 transition-colors"
                title="Scroll to Chemical Species"
              >
                <span>Species</span>
              </button>
              <button
                onClick={scrollToNotebookBottom}
                className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-amber-300 hover:text-white border border-sky-500/30 transition-colors flex items-center gap-0.5 font-bold"
                title="Scroll directly down to Student Lab Notebook"
              >
                <ArrowDown className="w-2.5 h-2.5" />
                <span>Notebook</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Container - Scrolls smoothly up and down across all screen heights in landscape */}
        <div
          ref={hudScrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-0 space-y-0 scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-950 hover:scrollbar-thumb-slate-600 divide-y divide-slate-800/80"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* ========================================================= */}
          {/* SENSOR HUD SECTIONS (Rendered in 'all' and 'sensors' tabs) */}
          {/* ========================================================= */}
          {(hudTab === 'all' || hudTab === 'sensors') && (
            <div ref={sensorsTopRef} className="flex flex-col divide-y divide-slate-800/80">
              {/* Sensor Readouts Grid */}
              <div className="p-3 grid grid-cols-3 gap-2 bg-slate-950/40">
                {/* Digital pH Meter Readout */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>pH Probe</span>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getPHColor(activeVessel?.pH || 7) }} />
                  </div>
                  <div className="text-base font-black font-mono mt-1" style={{ color: getPHColor(activeVessel?.pH || 7) }}>
                    {activeVessel ? activeVessel.pH.toFixed(2) : '--'}
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium truncate">
                    {activeVessel ? (activeVessel.pH < 6.8 ? 'Acidic' : activeVessel.pH > 7.2 ? 'Basic / Alkali' : 'Neutral') : '--'}
                  </span>
                </div>

                {/* Digital Thermometer Readout */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <Thermometer className="w-3 h-3 text-rose-400" />
                    <span>Temp</span>
                  </div>
                  <div
                    className={`text-base font-black font-mono mt-1 ${
                      (activeVessel?.temperatureC || 22) > 30 ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {activeVessel ? `${activeVessel.temperatureC.toFixed(1)}°C` : '--'}
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium truncate">
                    {activeVessel && activeVessel.temperatureC > 25 ? 'Exothermic' : 'Ambient'}
                  </span>
                </div>

                {/* Digital Analytical Balance Readout */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <Scale className="w-3 h-3 text-amber-400" />
                    <button
                      onClick={() => setScaleTareG(grossMassG + scaleTareG)}
                      className="text-[9px] text-amber-300 hover:underline"
                      title="Tare scale to 0.00 g"
                    >
                      Tare
                    </button>
                  </div>
                  <div className="text-base font-black font-mono text-amber-300 mt-1">
                    {activeVessel ? `${grossMassG}g` : '--'}
                  </div>
                  <span className="text-[9px] font-medium truncate">
                    {activeVessel?.isClosed ? (
                      <span className="text-emerald-400 font-semibold">Constant</span>
                    ) : activeVessel?.escapedGasMassG && activeVessel.escapedGasMassG > 0 ? (
                      <span className="text-rose-400 font-bold">-{activeVessel.escapedGasMassG.toFixed(2)}g</span>
                    ) : (
                      <span className="text-slate-500">Open Scale</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Law of Conservation of Mass System Inspector Card */}
              {activeVessel && (
                <div
                  className={`p-3 flex flex-col gap-2 ${
                    activeVessel.isClosed
                      ? 'bg-emerald-950/25 border-l-4 border-l-emerald-400'
                      : 'bg-amber-950/25 border-l-4 border-l-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      {activeVessel.isClosed ? (
                        <>
                          <Lock className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Closed Beaker (Airtight Lid)</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300">Open Beaker (Open Atmosphere)</span>
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => handleToggleVesselSealed(activeVessel.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1 ${
                        activeVessel.isClosed
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {activeVessel.isClosed ? (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Open Lid 🔓</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Seal Lid 🔒</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 leading-relaxed">
                    {activeVessel.isClosed ? (
                      <div className="flex flex-col gap-1">
                        <p>
                          <span className="font-semibold text-emerald-300">Law of Conservation of Mass:</span> In this closed system, all reactants and products (including evolved gases like CO₂, H₂, or O₂) remain sealed inside the container.
                        </p>
                        <p className="font-mono text-[10px] text-emerald-200 bg-slate-950/60 p-1.5 rounded border border-emerald-500/20">
                          Total Mass = <span className="font-bold">{grossMassG} g</span> [STRICTLY CONSTANT]
                          {activeVessel.trappedGasMassG && activeVessel.trappedGasMassG > 0 ? (
                            <span className="ml-2 text-sky-300">• Gas Trapped: +{activeVessel.trappedGasMassG.toFixed(2)} g (Pressure: {activeVessel.internalPressureAtm || 1.0} atm)</span>
                          ) : null}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p>
                          <span className="font-semibold text-amber-300">Open System Mass Loss:</span> Because the beaker has an open mouth, any gas produced during chemical reactions escapes into the surroundings.
                        </p>
                        <p className="font-mono text-[10px] text-amber-200 bg-slate-950/60 p-1.5 rounded border border-amber-500/20">
                          Total Mass = <span className="font-bold">{grossMassG} g</span>
                          {activeVessel.escapedGasMassG && activeVessel.escapedGasMassG > 0 ? (
                            <span className="ml-2 text-rose-300 font-bold">• Lost to air: -{activeVessel.escapedGasMassG.toFixed(2)} g gas</span>
                          ) : (
                            <span className="ml-2 text-slate-400">(Mass will decrease if gas evolves)</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Clean & Empty Vessel Status Card in HUD */}
              {activeVessel && activeVessel.contents.length === 0 && (
                <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-300">Vessel is Clean and Empty</h4>
                      <p className="text-[10px] text-slate-500">0 mL volume • No active chemical reactions or species</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    Tare: {grossMassG} g
                  </span>
                </div>
              )}

              {/* Active Chemical Reaction Callout Card & Stoichiometry Inspector */}
              {activeVessel && activeVessel.contents.length > 0 && activeVessel.activeReactionName && activeVessel.detailedReaction && (
                <div ref={thermoSectionRef} className="p-3 bg-amber-500/10 border-l-4 border-l-amber-400 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reaction Type:</span>
                      </span>
                      <span className="text-xs font-black text-amber-200">
                        {activeVessel.reactionType || activeVessel.detailedReaction?.reactionType || 'Chemical Reaction'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex items-center gap-1 ${
                        activeVessel.isReactionActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${activeVessel.isReactionActive ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
                        {activeVessel.isReactionActive ? 'REACTING IN PROGRESS' : 'REACTION COMPLETE'}
                      </span>
                      {activeVessel.detailedReaction?.typeCategory && (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold whitespace-nowrap">
                          [{activeVessel.detailedReaction.typeCategory.toUpperCase()}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                    <span className="text-amber-400">Name:</span> {activeVessel.activeReactionName}
                  </div>

                  {activeVessel.activeReactionEquation && (
                    <div className="p-2 rounded-xl bg-slate-950 border border-amber-500/30 font-mono text-[10px] text-amber-200 leading-relaxed shadow-inner">
                      {activeVessel.activeReactionEquation}
                    </div>
                  )}

                  {/* Reaction Kinetics & Time Length Card */}
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-2 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="flex items-center gap-1.5 text-sky-300">
                        <Timer className="w-3.5 h-3.5 text-sky-400" />
                        <span>Reaction Kinetics & Time Length</span>
                      </span>
                      <span className="font-mono text-[9px]">
                        {activeVessel.isReactionActive ? (
                          <span className="text-amber-300 font-bold animate-pulse">
                            ⏱ Running: {(activeVessel.reactionElapsedSec ?? 0).toFixed(1)}s / {(activeVessel.reactionDurationSec ?? 4.0).toFixed(1)}s
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Completed in {(activeVessel.reactionDurationSec ?? 4.0).toFixed(1)}s
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Progress Bar with Continuous Kinetics */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-400">
                          {activeVessel.isReactionActive ? 'Continuous Conversion Progress:' : 'Reaction Status:'}
                        </span>
                        <span className={`font-bold ${activeVessel.isReactionActive ? 'text-amber-300' : 'text-emerald-400'}`}>
                          {activeVessel.isReactionActive
                            ? `${Math.round((activeVessel.reactionProgress ?? 0) * 100)}% (${(activeVessel.reactionElapsedSec ?? 0).toFixed(1)}s / ${(activeVessel.reactionDurationSec ?? 4.0).toFixed(1)}s)`
                            : `100% Converted (${(activeVessel.reactionDurationSec ?? 4.0).toFixed(1)}s duration)`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-75 ${
                            activeVessel.isReactionActive
                              ? 'bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.round((activeVessel.isReactionActive ? (activeVessel.reactionProgress ?? 0) : 1) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Kinetics Parameters Grid */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[8px] text-slate-400 uppercase">Reaction Time Length</span>
                        <span className="font-bold text-xs text-sky-300">
                          {(activeVessel.reactionDurationSec ?? activeVessel.detailedReaction.reactionTimeLengthSec ?? 4.0).toFixed(1)} seconds
                        </span>
                        <span className="text-[8px] text-slate-500 truncate">
                          {activeVessel.detailedReaction.kineticsType || 'Kinetics Duration'}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[8px] text-slate-400 uppercase">Kinetic Mechanism</span>
                        <span className="font-bold text-[10px] text-amber-300 truncate" title={activeVessel.detailedReaction.kineticsType}>
                          {activeVessel.detailedReaction.kineticsType?.split(' ')[0] || 'Solution'} Kinetics
                        </span>
                        <span className="text-[8px] text-slate-500">
                          Half-life t½ ≈ {(((activeVessel.reactionDurationSec ?? 4.0) * 0.35)).toFixed(1)}s
                        </span>
                      </div>
                    </div>

                    {/* Replay Kinetics Action Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-[9px] text-slate-400">
                        {activeVessel.isReactionActive ? 'Reaction running from 0s to completion...' : 'Replay to observe continuous reaction over time length:'}
                      </span>
                      <button
                        onClick={() => handleReplayReaction(activeVessel.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer ${
                          activeVessel.isReactionActive
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                            : 'bg-sky-500 hover:bg-sky-400 text-white'
                        }`}
                        title="Replay continuous reaction from 0% to 100% over reaction time length"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {activeVessel.isReactionActive ? 'Restart ↺' : 'Replay Reaction ↺'}
                      </button>
                    </div>
                  </div>

                  {/* Thermodynamics Dashboard: Enthalpy (ΔH) & Entropy (ΔS) Readout */}
                  {activeVessel.detailedReaction && (
                    <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5 shadow-sm">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1 text-amber-300">
                          <Activity className="w-3 h-3 text-amber-400" />
                          <span>Thermodynamics & Spontaneity</span>
                        </span>
                        <span
                          className={`font-mono text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                            (activeVessel.detailedReaction.deltaGKjPerMol ?? 0) < 0
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {(activeVessel.detailedReaction.deltaGKjPerMol ?? 0) < 0
                            ? 'Spontaneous (ΔG < 0)'
                            : 'Non-spontaneous (ΔG > 0)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                        {/* Enthalpy ΔH */}
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase">Enthalpy ΔH</span>
                          <span
                            className={`font-black text-xs ${
                              (activeVessel.detailedReaction.deltaHKjPerMol ?? 0) < 0 ? 'text-amber-400' : 'text-cyan-400'
                            }`}
                          >
                            {activeVessel.detailedReaction.deltaHKjPerMol !== undefined
                              ? `${activeVessel.detailedReaction.deltaHKjPerMol > 0 ? '+' : ''}${activeVessel.detailedReaction.deltaHKjPerMol}`
                              : '--'}{' '}
                            <span className="text-[8px] font-normal text-slate-400">kJ/mol</span>
                          </span>
                          <span className="text-[8px] text-slate-500">
                            {(activeVessel.detailedReaction.deltaHKjPerMol ?? 0) < 0 ? 'Exothermic' : 'Endothermic'}
                          </span>
                        </div>

                        {/* Entropy ΔS */}
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase">Entropy ΔS</span>
                          <span
                            className={`font-black text-xs ${
                              (activeVessel.detailedReaction.deltaSJoulesPerMolK ?? 0) > 0 ? 'text-emerald-400' : 'text-indigo-300'
                            }`}
                          >
                            {activeVessel.detailedReaction.deltaSJoulesPerMolK !== undefined
                              ? `${activeVessel.detailedReaction.deltaSJoulesPerMolK > 0 ? '+' : ''}${activeVessel.detailedReaction.deltaSJoulesPerMolK}`
                              : '--'}{' '}
                            <span className="text-[8px] font-normal text-slate-400">J/(mol·K)</span>
                          </span>
                          <span className="text-[8px] text-slate-500">
                            {(activeVessel.detailedReaction.deltaSJoulesPerMolK ?? 0) > 0 ? 'ΔS > 0 (Disorder)' : 'ΔS < 0 (Order)'}
                          </span>
                        </div>

                        {/* Gibbs Free Energy ΔG */}
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase">Gibbs ΔG ({activeVessel.temperatureC.toFixed(0)}°C)</span>
                          <span
                            className={`font-black text-xs ${
                              (activeVessel.detailedReaction.deltaGKjPerMol ?? 0) < 0 ? 'text-emerald-300' : 'text-rose-400'
                            }`}
                          >
                            {activeVessel.detailedReaction.deltaGKjPerMol !== undefined
                              ? `${activeVessel.detailedReaction.deltaGKjPerMol > 0 ? '+' : ''}${activeVessel.detailedReaction.deltaGKjPerMol}`
                              : '--'}{' '}
                            <span className="text-[8px] font-normal text-slate-400">kJ/mol</span>
                          </span>
                          <span className="text-[8px] text-slate-500 truncate">
                            ΔG = ΔH - T·ΔS
                          </span>
                        </div>
                      </div>

                      {activeVessel.detailedReaction.thermoInterpretation && (
                        <p className="text-[9px] font-mono text-slate-400 bg-slate-900/50 p-1.5 rounded border border-slate-800/60 leading-tight">
                          {activeVessel.detailedReaction.thermoInterpretation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Stoichiometric Moles & Properties Table */}
                  {activeVessel.detailedReaction && (
                    <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-amber-500/20">
                      {/* Reactants Consumed / In Vessel */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-sky-300">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-sky-400" />
                            <span>Reactants ({activeVessel.detailedReaction.reactants.length} Species)</span>
                            {activeVessel.detailedReaction.reactants.length > 2 && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono text-[8px] font-bold border border-sky-500/30">
                                Multi-Reactant System
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 font-mono text-[9px]">Moles Consumed</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {activeVessel.detailedReaction.reactants.map((r, idx) => (
                            <div
                              key={`react_${idx}`}
                              className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] flex flex-col gap-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sky-300 font-mono flex items-center gap-1.5">
                                  <span>{r.formula}</span>
                                  <span className="text-[9px] text-slate-400 font-normal">({r.name})</span>
                                  <span
                                    className={`px-1 py-0.2 rounded text-[7px] font-mono uppercase border ${
                                      r.role === 'catalyst'
                                        ? 'bg-purple-950 text-purple-300 border-purple-800'
                                        : r.role === 'spectator'
                                        ? 'bg-slate-900 text-slate-400 border-slate-800'
                                        : 'bg-sky-950 text-sky-300 border-sky-800'
                                    }`}
                                  >
                                    {r.role}
                                  </span>
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-sky-950 text-sky-200 font-mono font-bold text-[10px] border border-sky-800/60">
                                  {r.moles.toFixed(4)} mol
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                                <span>Mass: {r.massG} g (M = {r.molarMassGPerMol} g/mol)</span>
                                <span className="text-slate-500 uppercase">State: [{r.state}]</span>
                              </div>
                              {r.properties && r.properties.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {r.properties.map((prop, pIdx) => (
                                    <span
                                      key={`r_prop_${pIdx}`}
                                      className="px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-[8px] text-slate-300"
                                    >
                                      {prop}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Reaction Transformation Divider */}
                      <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-amber-400/80 my-0.5">
                        <span className="h-px bg-amber-500/30 flex-1" />
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-amber-500/30 text-amber-300 text-center font-bold">
                          ➔ {activeVessel.detailedReaction.reactionType}
                        </span>
                        <span className="h-px bg-amber-500/30 flex-1" />
                      </div>

                      {/* Products Formed */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                          <span className="flex items-center gap-1">
                            <Atom className="w-3 h-3 text-emerald-400" />
                            <span>Products ({activeVessel.detailedReaction.products.length} Species)</span>
                            {activeVessel.detailedReaction.reactants.length > 2 && activeVessel.detailedReaction.products.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[8px] font-bold border border-emerald-500/30">
                                All Reaction Products
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 font-mono text-[9px]">Moles Formed</span>
                        </div>
                        {activeVessel.detailedReaction.products.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {activeVessel.detailedReaction.products.map((p, idx) => (
                              <div
                                key={`prod_${idx}`}
                                className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] flex flex-col gap-0.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-300 font-mono">
                                    {p.formula} <span className="text-[9px] text-slate-400 font-normal">({p.name})</span>
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-200 font-mono font-bold text-[10px] border border-emerald-800/60">
                                    {p.moles.toFixed(4)} mol
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                                  <span>Mass: {p.massG} g (M = {p.molarMassGPerMol} g/mol)</span>
                                  <span className="text-slate-500 uppercase">State: [{p.state}]</span>
                                </div>
                                {p.properties && p.properties.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {p.properties.map((prop, pIdx) => (
                                      <span
                                        key={`p_prop_${pIdx}`}
                                        className="px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-[8px] text-slate-300"
                                      >
                                        {prop}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 italic">
                            Homogeneous dynamic solution equilibrium (no separate precipitate or gas evolved).
                          </div>
                        )}
                      </div>

                      {/* Sub-Reaction Stages Breakdown if multi-stage */}
                      {activeVessel.detailedReaction.subReactions && activeVessel.detailedReaction.subReactions.length > 1 && (
                        <div className="p-2 rounded-xl bg-slate-950/90 border border-amber-500/25 flex flex-col gap-1.5 shadow-sm">
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Reaction Stages & Mechanisms ({activeVessel.detailedReaction.subReactions.length} Steps)</span>
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">Step-by-Step</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {activeVessel.detailedReaction.subReactions.map((sub, sIdx) => (
                              <div
                                key={`sub_step_${sIdx}`}
                                className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[9px] font-mono flex flex-col gap-0.5"
                              >
                                <div className="flex items-center justify-between text-amber-300 font-bold">
                                  <span>Stage {sIdx + 1}: {sub.name}</span>
                                  <span className="text-slate-400 text-[8px]">[{sub.type}]</span>
                                </div>
                                <div className="text-slate-200 text-[9px] bg-slate-950/60 p-1 rounded border border-slate-800/60 break-words leading-relaxed">
                                  {sub.equation}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mass Conservation Note */}
                      <div className="p-1.5 rounded-lg bg-slate-950/90 border border-amber-500/20 text-[9px] font-mono text-amber-200/90 leading-tight">
                        <span className="font-bold text-amber-300">Law of Conservation: </span>
                        {activeVessel.detailedReaction.conservationNote ||
                          'Reactant mass equals product mass. Closed beaker keeps mass constant; open beaker loses evolved gas.'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Universal Indicator Color Scale Bar */}
              <div className="px-3 py-2 bg-slate-950/20">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Universal pH Indicator Color Chart:</span>
                  <span className="font-mono text-sky-400 font-bold">pH {activeVessel?.pH.toFixed(1)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex shadow-inner border border-slate-700">
                  <div className="flex-1 bg-red-500" title="pH 1-2 Strong Acid" />
                  <div className="flex-1 bg-orange-500" title="pH 3-4 Moderate Acid" />
                  <div className="flex-1 bg-yellow-400" title="pH 5-6 Weak Acid" />
                  <div className="flex-1 bg-green-500" title="pH 7 Neutral Water" />
                  <div className="flex-1 bg-cyan-500" title="pH 8-9 Weak Base" />
                  <div className="flex-1 bg-blue-600" title="pH 10-11 Base" />
                  <div className="flex-1 bg-purple-600" title="pH 12-14 Strong Alkali" />
                </div>
              </div>

              {/* Vessel Chemical Contents Inspector with Moles & Properties */}
              <div ref={speciesSectionRef} className="p-3 bg-slate-950/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
                    <span>Chemical Species & Moles in {activeVessel?.name}:</span>
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                    {activeVessel?.contents.length || 0} Species
                  </span>
                </div>
                {activeVessel && activeVessel.contents.length > 0 ? (
                  <div className="flex flex-col gap-1.5 pr-0.5">
                    {activeVessel.contents.map((item, idx) => {
                      const { moles, massG } = calculateChemicalMoles(item.chemicalId, item.amountMl);
                      const meta = getChemicalMetadata(item.chemicalId);
                      return (
                        <div
                          key={`${item.chemicalId}_${idx}`}
                          className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sky-400 font-mono flex items-center gap-1">
                              <span>{item.formula}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({item.name})</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-sky-950 text-sky-200 font-mono font-bold text-[10px] border border-sky-800/60">
                                {moles.toFixed(4)} mol
                              </span>
                              <button
                                onClick={() => handleRemoveChemical(activeVessel.id, item.chemicalId)}
                                className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                                title={`Remove ${item.name} (${item.formula}) from ${activeVessel.name}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                            <span>
                              Amount: {item.amountMl} mL ({massG} g)
                            </span>
                            <span>M: {meta.molarMass} g/mol [{meta.state}]</span>
                          </div>
                          {meta.properties && meta.properties.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {meta.properties.slice(0, 3).map((p, pIdx) => (
                                <span
                                  key={`prop_${pIdx}`}
                                  className="px-1 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[8px]"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Vessel is currently empty.</span>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* NOTEBOOK & LOGS (Rendered in 'all' and 'notebook' tabs)    */}
          {/* ========================================================= */}
          {(hudTab === 'all' || hudTab === 'notebook') && (
            <div className="flex flex-col divide-y divide-slate-800/80 bg-slate-950/30">
              {/* Student Editable Lab Notebook Card */}
              <div ref={notebookSectionRef} className="p-3 bg-slate-950/70 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Student Lab Notebook</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleInsertReactionToNotes}
                      className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm"
                      title="Insert current reaction stoichiometry, moles, properties and thermodynamics into notebook"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Insert Data</span>
                    </button>
                    <button
                      onClick={handleCopyNotes}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                      title="Copy notebook report to clipboard"
                    >
                      {copiedNotes ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setNotebookExpanded((exp) => !exp)}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                      title={notebookExpanded ? 'Collapse Notebook Height' : 'Expand Notebook Height'}
                    >
                      {notebookExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setUserNotes('')}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="Clear Notebook text"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Vertically Scrollable and Resizable Notebook Text Area */}
                <div className="relative flex flex-col">
                  <textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Record your hypothesis, measurements, reaction observations, stoichiometry calculations, and conclusions here..."
                    className={`w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-sky-500 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 leading-relaxed resize-y ${
                      notebookExpanded
                        ? 'min-h-[380px]'
                        : hudTab === 'notebook'
                        ? 'min-h-[280px]'
                        : 'min-h-[170px]'
                    }`}
                  />
                  <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500 px-1">
                    <span>
                      {userNotes.trim() ? userNotes.trim().split(/\s+/).length : 0} words • {userNotes.split('\n').length} lines • {userNotes.length} chars
                    </span>
                    <span className="text-slate-500 italic">Scrollable up & down (Drag corner to resize)</span>
                  </div>
                </div>
              </div>

              {/* Automated Lab Journal Log Feed */}
              <div ref={journalSectionRef} className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Automated Lab Journal Log</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                      {labLogs.length} entries
                    </span>
                    {labLogs.length > 1 && (
                      <button
                        onClick={() => setLabLogs([labLogs[0]])}
                        className="text-[9px] text-slate-500 hover:text-slate-300 underline"
                        title="Clear log history"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {labLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex flex-col gap-1 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex flex-col">
                          <span className="font-bold text-sky-300 text-[11px]">{log.title}</span>
                          {log.reactionType && (
                            <span className="text-[9px] font-mono font-semibold text-amber-400">
                              Reaction Type: {log.reactionType}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">{log.details}</p>
                      {log.equation && (
                        <div className="mt-0.5 p-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[9px] text-amber-300">
                          {log.equation}
                        </div>
                      )}
                      {/* Reactant & Product Moles summary pill in log */}
                      {log.detailedReaction && (
                        <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800/90 flex flex-col gap-0.5 text-[9px] font-mono">
                          <div className="text-sky-300 break-words">
                            <span className="font-bold text-slate-400">Reactants ({log.detailedReaction.reactants.length}): </span>
                            {log.detailedReaction.reactants.map((r) => `${r.moles.toFixed(3)} mol ${r.formula}`).join(' + ')}
                          </div>
                          <div className="text-emerald-300 break-words">
                            <span className="font-bold text-slate-400">Products ({log.detailedReaction.products.length}): </span>
                            {log.detailedReaction.products.length > 0
                              ? log.detailedReaction.products.map((p) => `${p.moles.toFixed(3)} mol ${p.formula}`).join(' + ')
                              : 'Dynamic solution equilibrium'}
                          </div>
                          {log.detailedReaction.deltaHKjPerMol !== undefined && (
                            <div className="text-amber-300/90 flex flex-wrap items-center gap-2 pt-0.5 border-t border-slate-800">
                              <span>ΔH: {log.detailedReaction.deltaHKjPerMol > 0 ? `+${log.detailedReaction.deltaHKjPerMol}` : log.detailedReaction.deltaHKjPerMol} kJ/mol</span>
                              {log.detailedReaction.deltaSJoulesPerMolK !== undefined && (
                                <span>• ΔS: {log.detailedReaction.deltaSJoulesPerMolK > 0 ? `+${log.detailedReaction.deltaSJoulesPerMolK}` : log.detailedReaction.deltaSJoulesPerMolK} J/(mol·K)</span>
                              )}
                              {log.detailedReaction.deltaGKjPerMol !== undefined && (
                                <span className={log.detailedReaction.deltaGKjPerMol < 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                  • ΔG: {log.detailedReaction.deltaGKjPerMol > 0 ? `+${log.detailedReaction.deltaGKjPerMol}` : log.detailedReaction.deltaGKjPerMol} kJ/mol
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MODAL: POUR / TRANSFER LIQUID BETWEEN VESSELS             */}
      {/* ========================================================= */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-2xl flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-sky-400" />
              <span>Pour Liquid Between Vessels</span>
            </h3>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-medium">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Source:</span>
                <span className="text-white font-bold">
                  {vessels.find((v) => v.id === transferModal.sourceVesselId)?.name}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500">Target:</span>
                <select
                  value={transferModal.targetVesselId}
                  onChange={(e) =>
                    setTransferModal({ ...transferModal, targetVesselId: e.target.value })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-sky-300 font-semibold"
                >
                  {vessels
                    .filter((v) => v.id !== transferModal.sourceVesselId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Volume slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Transfer Volume:</span>
                <span className="font-mono text-sky-300 font-bold">
                  {transferModal.volumeToTransfer} mL
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={
                  vessels.find((v) => v.id === transferModal.sourceVesselId)?.currentVolumeMl || 25
                }
                value={transferModal.volumeToTransfer}
                onChange={(e) =>
                  setTransferModal({
                    ...transferModal,
                    volumeToTransfer: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTransferModal(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTransfer}
                className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md"
              >
                Pour Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
