import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls, setupStandardRenderer, setupSceneEnvironment, isSoftwareGl } from '../utils/three-setup';
import { ChemicalReaction } from '../types/chemistry';
import { REACTIONS } from '../data/reactions';
import { soundFx } from '../utils/audio';
import {
  KineticOrderMode,
  KineticSimulationResult,
  sampleExtentAndRateAtProgress,
  sampleKineticsAtProgress,
  simulateReactionKinetics,
} from '../utils/reactionKinetics';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Flame,
  Activity,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Info,
  Sliders,
  Search,
  BookOpen,
  Filter,
  X,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  LineChart,
  Layers,
  Thermometer,
} from 'lucide-react';
import { KineticGraphPanel } from './KineticGraphPanel';
import { BondEnergyD3Panel, BondEnergyLiveBadge } from './BondEnergyD3Panel';
import { computeBondEnergyProfile } from '../utils/bondEnergies';
import { FormattedChemText } from './FormattedChemText';

interface ReactionSimulator3DProps {
  theme?: 'dark' | 'light';
}

const REACTION_CATEGORIES = [
  { id: 'all', label: 'All Reactions' },
  { id: 'nuclear_fission', label: 'Nuclear Fission ⚛️' },
  { id: 'nuclear_fusion', label: 'Nuclear Fusion ☀️' },
  { id: 'precipitation', label: 'Precipitation ⚗️' },
  { id: 'displacement', label: 'Displacement 🔄' },
  { id: 'combustion', label: 'Combustion 🔥' },
  { id: 'synthesis', label: 'Synthesis 🧪' },
  { id: 'decomposition', label: 'Decomposition 💥' },
  { id: 'redox', label: 'Redox ⚡' },
  { id: 'biochemical', label: 'Biochemical 🧬' },
  { id: 'neutralization', label: 'Acid-Base 💧' },
];

const formatEnergy = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  if (abs >= 1e9) {
    return `${sign}${(abs / 1e9).toFixed(2)}B kJ`;
  }
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toFixed(1)}M kJ`;
  }
  if (abs >= 1e4) {
    return `${sign}${abs.toLocaleString()} kJ`;
  }
  return `${val > 0 ? '+' : ''}${val} kJ`;
};

export const ReactionSimulator3D: React.FC<ReactionSimulator3DProps> = ({
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedReaction, setSelectedReaction] = useState<ChemicalReaction>(REACTIONS[0]);
  const [progress, setProgress] = useState<number>(0); // 0.0 to 1.0
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playSpeed, setPlaySpeed] = useState<number>(0.15); // Progress delta per sec
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [dockTab, setDockTab] = useState<'kinetics' | 'bond_energy' | 'mechanism'>('kinetics');
  const [temperatureK, setTemperatureK] = useState<number>(298);
  const [hasCatalyst, setHasCatalyst] = useState<boolean>(false);
  const [orderMode, setOrderMode] = useState<KineticOrderMode>('auto');
  const [showHeatMap, setShowHeatMap] = useState<boolean>(true);
  const [sceneReady, setSceneReady] = useState<number>(0);

  const showHeatMapRef = useRef<boolean>(showHeatMap);
  showHeatMapRef.current = showHeatMap;

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const playSpeedRef = useRef<number>(playSpeed);
  playSpeedRef.current = playSpeed;

  const progressRef = useRef<number>(progress);
  if (!isPlaying) {
    progressRef.current = progress;
  }

  const setSyncedProgress = (nextP: number) => {
    progressRef.current = nextP;
    setProgress(nextP);
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [enthalpyFilter, setEnthalpyFilter] = useState<'all' | 'exothermic' | 'endothermic'>('all');
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);

  // Reaction completion overlay state
  const [completedBannerDismissed, setCompletedBannerDismissed] = useState<boolean>(false);
  const completionSoundFiredRef = useRef<boolean>(false);

  // Real-time kinetic ODE simulation shared between KineticGraphPanel and 3D chamber
  const kineticSimulation = useMemo(
    () => simulateReactionKinetics(selectedReaction, temperatureK, hasCatalyst, orderMode),
    [selectedReaction, temperatureK, hasCatalyst, orderMode]
  );

  // Real-time bond energy profile & D3 trajectory synchronized with kineticExtent
  const bondEnergyProfile = useMemo(
    () => computeBondEnergyProfile(selectedReaction, hasCatalyst),
    [selectedReaction, hasCatalyst]
  );

  const kineticSimulationRef = useRef<KineticSimulationResult>(kineticSimulation);
  kineticSimulationRef.current = kineticSimulation;

  const selectedReactionRef = useRef<ChemicalReaction>(selectedReaction);
  selectedReactionRef.current = selectedReaction;

  const sceneDirtyRef = useRef<boolean>(true);

  const kineticSnapshot = useMemo(
    () => sampleKineticsAtProgress(kineticSimulation, progress),
    [kineticSimulation, progress]
  );

  const kineticExtent = kineticSnapshot.extent;

  const kineticLiveRef = useRef({
    temperatureK,
    hasCatalyst,
    rateMPerSec: kineticSnapshot.rateMPerSec,
    isExothermic: selectedReaction.isExothermic,
    extent: kineticExtent,
  });
  kineticLiveRef.current = {
    temperatureK,
    hasCatalyst,
    rateMPerSec: kineticSnapshot.rateMPerSec,
    isExothermic: selectedReaction.isExothermic,
    extent: kineticExtent,
  };

  // Reaction completion lifecycle: stops playback at 1.0 (no loop) and signals completion
  useEffect(() => {
    if (progress >= 0.999) {
      if (isPlaying) {
        setIsPlaying(false);
      }
      if (!completionSoundFiredRef.current) {
        soundFx.playQuizChime(true);
        completionSoundFiredRef.current = true;
      }
    } else {
      completionSoundFiredRef.current = false;
      setCompletedBannerDismissed(false);
    }
  }, [progress, isPlaying]);

  // Three.js scene refs & pooled GPU assets (zero per-frame mesh/shader/geometry allocations)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reactionGroupRef = useRef<THREE.Group | null>(null);
  const energyParticlesRef = useRef<Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }>>([]);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const heatMapRefs = useRef<{
    floorMesh: THREE.Mesh;
    midMesh: THREE.Mesh;
    floorMat: THREE.ShaderMaterial;
    midMat: THREE.ShaderMaterial;
  } | null>(null);
  const renderReactionMoleculesRef = useRef<
    ((rx: ChemicalReaction, extent: number, tempK: number, hasCat: boolean) => void) | null
  >(null);
  const threeAssetsRef = useRef<{
    unitSphereGeo: THREE.SphereGeometry;
    unitCylinderGeo: THREE.CylinderGeometry;
    unitRingGeo: THREE.RingGeometry;
    heaterRingGeo: THREE.RingGeometry;
    catRingGeo: THREE.RingGeometry;
    barrierUnitGeo: THREE.SphereGeometry;
    sparkUnitGeo: THREE.SphereGeometry;
    electrolysisBoxGeo: THREE.BoxGeometry;
    znPlateGeo: THREE.BoxGeometry;
    waterPlaneGeo: THREE.PlaneGeometry;
    tokamakTorusGeo: THREE.TorusGeometry;
    sharedGeos: Set<THREE.BufferGeometry>;
    sharedMats: Set<THREE.Material>;
    mats: Record<string, THREE.Material>;
    sparkMats: { emerald: THREE.MeshBasicMaterial; amber: THREE.MeshBasicMaterial; cyan: THREE.MeshBasicMaterial };
    heaterRingMat: THREE.MeshBasicMaterial;
    catRingMat: THREE.MeshBasicMaterial;
    barrierMat: THREE.MeshBasicMaterial;
    haloRingMats: Map<number, THREE.MeshBasicMaterial>;
    dashedLineMats: Map<number, THREE.LineDashedMaterial>;
    // Persistent grow-only scene mesh pools (toggled via .visible with zero allocs)
    spherePool: THREE.Mesh[];
    cylPool: THREE.Mesh[];
    ringPool: THREE.Mesh[];
    linePool: THREE.Line[];
    heaterRingMesh: THREE.Mesh;
    catRingMesh: THREE.Mesh;
    barrierMesh: THREE.Mesh;
    cathodeBoxMesh: THREE.Mesh;
    anodeBoxMesh: THREE.Mesh;
    znPlateMesh: THREE.Mesh;
    waterMesh: THREE.Mesh;
    tokamakMeshes: THREE.Mesh[];
  } | null>(null);

  // Filtered reactions list
  const filteredReactions = useMemo(() => {
    return REACTIONS.filter((rx) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rx.name.toLowerCase().includes(q) ||
        rx.equation.toLowerCase().includes(q) ||
        rx.description.toLowerCase().includes(q) ||
        rx.reactants.some((r) => r.formula.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) ||
        rx.products.some((p) => p.formula.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));

      const matchesCat = activeCategory === 'all' || rx.type === activeCategory;
      const matchesEnthalpy =
        enthalpyFilter === 'all' ||
        (enthalpyFilter === 'exothermic' && rx.isExothermic) ||
        (enthalpyFilter === 'endothermic' && !rx.isExothermic);

      return matchesSearch && matchesCat && matchesEnthalpy;
    });
  }, [searchQuery, activeCategory, enthalpyFilter]);

  // Setup Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 4, 15);
    cameraRef.current = camera;

    const renderer = setupStandardRenderer(canvas);
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const disposeEnv = setupSceneEnvironment(renderer, scene);

    // Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(8, 12, 10);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
    scene.add(hemiLight);

    const rGroup = new THREE.Group();
    scene.add(rGroup);
    reactionGroupRef.current = rGroup;

    // Soft floor
    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x000000 : 0x94a3b8,
      transparent: true,
      opacity: theme === 'dark' ? 0.35 : 0.12,
      depthWrite: false,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -3.5;
    scene.add(floorMesh);
    floorMeshRef.current = floorMesh;

    // 3D Exothermic / Endothermic Potential Heat Map Overlay (Basal Workspace + Equatorial Plane)
    const heatMapHotspots = Array.from({ length: 12 }, () => new THREE.Vector3(0, 0, 0));
    const heatMapVert = `
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;
    const heatMapFrag = `
      precision highp float;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      uniform float uTime;
      uniform float uExtent;
      uniform float uExothermic;
      uniform float uEnthalpyNorm;
      uniform float uTempNorm;
      uniform float uLayerWeight;
      uniform float uIsLightTheme;
      uniform int uHotspotCount;
      uniform vec3 uHotspots[12];

      vec3 rampExothermic(float x) {
        vec3 c0 = mix(vec3(0.06, 0.09, 0.22), vec3(0.95, 0.85, 0.78), uIsLightTheme * 0.35);
        vec3 c1 = vec3(0.76, 0.12, 0.28); // crimson
        vec3 c2 = vec3(0.98, 0.45, 0.09); // fiery orange
        vec3 c3 = vec3(0.99, 0.88, 0.35); // incandescent amber-gold
        vec3 c4 = vec3(1.00, 0.98, 0.86); // white-hot peak
        vec3 col = mix(c0, c1, smoothstep(0.04, 0.30, x));
        col = mix(col, c2, smoothstep(0.28, 0.58, x));
        col = mix(col, c3, smoothstep(0.56, 0.84, x));
        col = mix(col, c4, smoothstep(0.84, 1.00, x));
        return col;
      }

      vec3 rampEndothermic(float x) {
        vec3 c0 = mix(vec3(0.05, 0.10, 0.22), vec3(0.82, 0.92, 0.98), uIsLightTheme * 0.35);
        vec3 c1 = vec3(0.06, 0.46, 0.46); // deep teal sink
        vec3 c2 = vec3(0.02, 0.72, 0.85); // electric cyan
        vec3 c3 = vec3(0.49, 0.83, 0.99); // sky ice
        vec3 c4 = vec3(0.90, 0.97, 1.00); // frost peak
        vec3 col = mix(c0, c1, smoothstep(0.04, 0.30, x));
        col = mix(col, c2, smoothstep(0.28, 0.58, x));
        col = mix(col, c3, smoothstep(0.56, 0.84, x));
        col = mix(col, c4, smoothstep(0.84, 1.00, x));
        return col;
      }

      void main() {
        float rCenter = length(vWorldPos.xz);
        float radialMask = 1.0 - smoothstep(8.2, 11.8, rCenter);
        if (radialMask <= 0.001) discard;

        float sigmaSq = 2.2 + 5.8 * uExtent * uEnthalpyNorm;
        float fieldSum = 0.0;
        for (int i = 0; i < 12; i++) {
          if (i >= uHotspotCount) break;
          vec2 d = vWorldPos.xz - uHotspots[i].xy;
          float distSq = dot(d, d);
          fieldSum += uHotspots[i].z * exp(-distSq / sigmaSq);
        }

        // Reaction-center potential wave (peaks around transition state & builds through reaction)
        float reactionActive = 0.28 + 0.72 * smoothstep(0.0, 0.85, uExtent);
        float corePotential = reactionActive * exp(-(rCenter * rCenter) / (3.8 + 7.5 * uExtent));
        float localField = 1.0 - exp(-(fieldSum * 0.55 + corePotential * 1.15));

        // Ambient kinetic thermal baseline across chamber
        float ambientWarmth = uTempNorm * 0.24 * exp(-(rCenter * rCenter) * 0.012);
        float potentialMag = clamp(localField * (0.42 + 0.68 * uEnthalpyNorm) + ambientWarmth, 0.0, 1.0);

        vec3 baseCol = uExothermic > 0.0
          ? rampExothermic(potentialMag)
          : rampEndothermic(potentialMag);

        // Animated isothermal contour lines flowing outward (exo) or inward (endo)
        float isBaseLayer = step(0.5, uLayerWeight);
        float flowDir = uExothermic > 0.0 ? -1.0 : 1.0;
        float contourPhase = potentialMag * 6.5 + flowDir * uTime * 0.55;
        float isoDist = abs(fract(contourPhase) - 0.5);
        float isoLine = (1.0 - smoothstep(0.0, 0.065, isoDist)) * smoothstep(0.12, 0.45, potentialMag);

        // Subtle spatial reference grid on workspace base layer
        vec2 gridCoord = abs(fract(vWorldPos.xz * 0.5 - 0.5) - 0.5);
        float gridDist = min(gridCoord.x, gridCoord.y);
        float gridLine = (1.0 - smoothstep(0.0, 0.025, gridDist)) * 0.18;

        vec3 isoTint = uExothermic > 0.0 ? vec3(1.0, 0.94, 0.68) : vec3(0.75, 0.96, 1.0);
        vec3 finalCol = baseCol + isoTint * (isoLine * 0.34 * isBaseLayer) + vec3(0.55, 0.72, 0.90) * (gridLine * isBaseLayer);

        float baseAlpha = (0.14 + potentialMag * 0.68 + isoLine * 0.16 + gridLine * 0.25) * radialMask;
        float midAlpha = (potentialMag * 0.24) * radialMask;
        float alpha = mix(midAlpha, baseAlpha, isBaseLayer);

        gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 0.86));
      }
    `;

    const createHeatMapUniforms = (layerWeight: number) => ({
      uTime: { value: 0 },
      uExtent: { value: 0 },
      uExothermic: { value: selectedReaction.isExothermic ? 1.0 : -1.0 },
      uEnthalpyNorm: { value: 0.65 },
      uTempNorm: { value: 0.05 },
      uLayerWeight: { value: layerWeight },
      uIsLightTheme: { value: theme === 'light' ? 1.0 : 0.0 },
      uHotspotCount: { value: 0 },
      uHotspots: { value: heatMapHotspots },
    });

    const heatGeo = new THREE.PlaneGeometry(24, 24, 1, 1);
    const heatFloorMat = new THREE.ShaderMaterial({
      uniforms: createHeatMapUniforms(1.0),
      vertexShader: heatMapVert,
      fragmentShader: heatMapFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const heatMidMat = new THREE.ShaderMaterial({
      uniforms: createHeatMapUniforms(0.35),
      vertexShader: heatMapVert,
      fragmentShader: heatMapFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const heatFloorMesh = new THREE.Mesh(heatGeo, heatFloorMat);
    heatFloorMesh.rotation.x = -Math.PI / 2;
    heatFloorMesh.position.y = -3.45;
    heatFloorMesh.renderOrder = 1;
    heatFloorMesh.visible = showHeatMapRef.current;
    scene.add(heatFloorMesh);

    const heatMidMesh = new THREE.Mesh(heatGeo, heatMidMat);
    heatMidMesh.rotation.x = -Math.PI / 2;
    heatMidMesh.position.y = -0.15;
    heatMidMesh.renderOrder = 2;
    heatMidMesh.visible = showHeatMapRef.current;
    scene.add(heatMidMesh);

    heatMapRefs.current = {
      floorMesh: heatFloorMesh,
      midMesh: heatMidMesh,
      floorMat: heatFloorMat,
      midMat: heatMidMat,
    };

    // Initialize pooled Three.js geometries and materials once per WebGL context
    const mkPbr = (params: THREE.MeshPhysicalMaterialParameters) =>
      isSoftwareGl
        ? new THREE.MeshStandardMaterial({
            color: params.color,
            roughness: params.roughness ?? 0.3,
            metalness: params.metalness ?? 0.0,
            emissive: params.emissive,
            emissiveIntensity: params.emissiveIntensity,
            transparent: params.transparent,
            opacity: params.opacity,
          })
        : new THREE.MeshPhysicalMaterial(params);

    const unitSphereGeo = new THREE.SphereGeometry(1, isSoftwareGl ? 14 : 20, isSoftwareGl ? 12 : 20);
    const unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, isSoftwareGl ? 8 : 12);
    const unitRingGeo = new THREE.RingGeometry(0.95, 1.05, isSoftwareGl ? 24 : 32);
    const heaterRingGeo = new THREE.RingGeometry(4.2, 4.45, 40);
    const catRingGeo = new THREE.RingGeometry(2.1, 2.32, 32);
    const barrierUnitGeo = new THREE.SphereGeometry(1, 14, 14);
    const sparkUnitGeo = new THREE.SphereGeometry(1, 8, 8);
    const electrolysisBoxGeo = new THREE.BoxGeometry(0.3, 4.5, 3.0);
    const znPlateGeo = new THREE.BoxGeometry(0.5, 4.0, 2.5);
    const waterPlaneGeo = new THREE.PlaneGeometry(8, 6);
    const tokamakTorusGeo = new THREE.TorusGeometry(3.6, 0.04, 8, 32);

    const mats: Record<string, THREE.Material> = {
      carbonMat: mkPbr({ color: 0x334155, roughness: 0.3, clearcoat: 0.8 }),
      oxygenMat: mkPbr({ color: 0xef4444, roughness: 0.2, clearcoat: 0.8 }),
      hydrogenMat: mkPbr({ color: 0xf8fafc, roughness: 0.2, clearcoat: 0.8 }),
      nitrogenMat: mkPbr({ color: 0x3b82f6, roughness: 0.2, clearcoat: 0.8 }),
      sodiumMat: mkPbr({ color: 0xab5cf2, roughness: 0.3, clearcoat: 0.8 }),
      chlorineMat: mkPbr({ color: 0x22c55e, roughness: 0.2, clearcoat: 0.8 }),
      ironMat: mkPbr({ color: 0xe06633, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 }),
      aluminiumMat: mkPbr({ color: 0xbfa6a6, roughness: 0.3, metalness: 0.5, clearcoat: 0.8 }),
      calciumMat: mkPbr({ color: 0x10b981, roughness: 0.3, clearcoat: 0.8 }),
      bondMat: mkPbr({ color: 0x94a3b8, roughness: 0.4 }),
      electronMat: new THREE.MeshBasicMaterial({ color: 0xfde047 }),
      atpMat: mkPbr({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.6, roughness: 0.2 }),
      cathodeMat: mkPbr({ color: 0x1d4ed8, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.8 }),
      anodeMat: mkPbr({ color: 0xb91c1c, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.8 }),
      uraniumMat: mkPbr({ color: 0x10b981, roughness: 0.25, metalness: 0.7, clearcoat: 1.0, emissive: 0x059669, emissiveIntensity: 0.4 }),
      bariumMat: mkPbr({ color: 0x06b6d4, roughness: 0.3, metalness: 0.6, clearcoat: 0.8 }),
      kryptonMat: mkPbr({ color: 0xa855f7, roughness: 0.2, metalness: 0.2, emissive: 0x7c3aed, emissiveIntensity: 0.4 }),
      neutronMat: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      protonMat: mkPbr({ color: 0xef4444, roughness: 0.2, clearcoat: 0.8, emissive: 0xb91c1c, emissiveIntensity: 0.25 }),
      alphaMat: mkPbr({ color: 0xf59e0b, roughness: 0.2, clearcoat: 0.9, emissive: 0xd97706, emissiveIntensity: 0.5 }),
      leadMat: mkPbr({ color: 0x64748b, roughness: 0.4, metalness: 0.7 }),
      iodineMat: mkPbr({ color: 0xeab308, roughness: 0.2, clearcoat: 0.9, emissive: 0xca8a04, emissiveIntensity: 0.35 }),
      silverMat: mkPbr({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95, clearcoat: 1.0 }),
      copperMat: mkPbr({ color: 0xb45309, roughness: 0.25, metalness: 0.8, clearcoat: 0.8 }),
      zincMat: mkPbr({ color: 0x94a3b8, roughness: 0.3, metalness: 0.7 }),
      plasmaMat: new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true, transparent: true, opacity: 0.4 }),
      moltenMat: mkPbr({ color: 0xffaa00, emissive: 0xff4400, emissiveIntensity: 0.9 }),
      plutoniumCoreMat: mkPbr({ color: 0xd946ef, roughness: 0.25, metalness: 0.8, emissive: 0xa21caf, emissiveIntensity: 0.5 }),
      xenonFragMat: mkPbr({ color: 0x38bdf8, roughness: 0.2, metalness: 0.6 }),
      zirconiumFragMat: mkPbr({ color: 0xec4899, roughness: 0.2, metalness: 0.6 }),
      cuCationMat: mkPbr({ color: 0x0284c7, roughness: 0.2, metalness: 0.7 }),
      waterPlaneMat: mkPbr({ color: 0x0284c7, transparent: true, opacity: 0.35, roughness: 0.1 }),
      rustMat: mkPbr({ color: 0x9a3412, roughness: 0.9, clearcoat: 0.1 }),
      catNodeMat: mkPbr({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.65, metalness: 0.6, roughness: 0.2 }),
    };

    const sparkMats = {
      emerald: new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 }),
      amber: new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 }),
      cyan: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
    };
    const heaterRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
    });
    const catRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const barrierMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });

    const sharedGeos = new Set<THREE.BufferGeometry>([
      unitSphereGeo,
      unitCylinderGeo,
      unitRingGeo,
      heaterRingGeo,
      catRingGeo,
      barrierUnitGeo,
      sparkUnitGeo,
      electrolysisBoxGeo,
      znPlateGeo,
      waterPlaneGeo,
      tokamakTorusGeo,
    ]);
    const sharedMats = new Set<THREE.Material>([
      ...Object.values(mats),
      sparkMats.emerald,
      sparkMats.amber,
      sparkMats.cyan,
      heaterRingMat,
      catRingMat,
      barrierMat,
    ]);
    const haloRingMats = new Map<number, THREE.MeshBasicMaterial>();
    const dashedLineMats = new Map<number, THREE.LineDashedMaterial>();

    // Pre-create persistent singleton chamber meshes attached once to rGroup
    const heaterRingMesh = new THREE.Mesh(heaterRingGeo, heaterRingMat);
    heaterRingMesh.position.set(0, -3.35, 0);
    heaterRingMesh.rotation.x = -Math.PI / 2;
    rGroup.add(heaterRingMesh);

    const catRingMesh = new THREE.Mesh(catRingGeo, catRingMat);
    catRingMesh.position.set(0, -2.4, 0);
    catRingMesh.rotation.x = -Math.PI / 2;
    catRingMesh.visible = false;
    rGroup.add(catRingMesh);

    const barrierMesh = new THREE.Mesh(barrierUnitGeo, barrierMat);
    barrierMesh.visible = false;
    rGroup.add(barrierMesh);

    const cathodeBoxMesh = new THREE.Mesh(electrolysisBoxGeo, mats.cathodeMat);
    cathodeBoxMesh.position.set(-5.0, 0, 0);
    cathodeBoxMesh.visible = false;
    rGroup.add(cathodeBoxMesh);

    const anodeBoxMesh = new THREE.Mesh(electrolysisBoxGeo, mats.anodeMat);
    anodeBoxMesh.position.set(5.0, 0, 0);
    anodeBoxMesh.visible = false;
    rGroup.add(anodeBoxMesh);

    const znPlateMesh = new THREE.Mesh(znPlateGeo, mats.zincMat);
    znPlateMesh.position.set(-3.2, 0, 0);
    znPlateMesh.visible = false;
    rGroup.add(znPlateMesh);

    const waterMesh = new THREE.Mesh(waterPlaneGeo, mats.waterPlaneMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.visible = false;
    rGroup.add(waterMesh);

    const tokamakMeshes = [-1.2, 0, 1.2].map((z) => {
      const m = new THREE.Mesh(tokamakTorusGeo, mats.plasmaMat);
      m.position.set(0, 0, z);
      m.visible = false;
      rGroup.add(m);
      return m;
    });

    const spherePool: THREE.Mesh[] = [];
    const cylPool: THREE.Mesh[] = [];
    const ringPool: THREE.Mesh[] = [];
    const linePool: THREE.Line[] = [];

    threeAssetsRef.current = {
      unitSphereGeo,
      unitCylinderGeo,
      unitRingGeo,
      heaterRingGeo,
      catRingGeo,
      barrierUnitGeo,
      sparkUnitGeo,
      electrolysisBoxGeo,
      znPlateGeo,
      waterPlaneGeo,
      tokamakTorusGeo,
      sharedGeos,
      sharedMats,
      mats,
      sparkMats,
      heaterRingMat,
      catRingMat,
      barrierMat,
      haloRingMats,
      dashedLineMats,
      spherePool,
      cylPool,
      ringPool,
      linePool,
      heaterRingMesh,
      catRingMesh,
      barrierMesh,
      cathodeBoxMesh,
      anodeBoxMesh,
      znPlateMesh,
      waterMesh,
      tokamakMeshes,
    };

    setSceneReady((prev) => prev + 1);

    let animationFrameId: number;
    const clock = new THREE.Clock();
    let lastUiSyncMs = 0;

    const animate = (nowMs: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      const liveKin = kineticLiveRef.current;

      // Advance reaction playback and update 3D molecular geometry at full native 60fps
      if (isPlayingRef.current) {
        const nextP = Math.min(1, progressRef.current + delta * playSpeedRef.current);
        progressRef.current = nextP;
        const fastSample = sampleExtentAndRateAtProgress(kineticSimulationRef.current, nextP);
        liveKin.extent = fastSample.extent;
        liveKin.rateMPerSec = fastSample.rateMPerSec;
        renderReactionMoleculesRef.current?.(
          selectedReactionRef.current,
          fastSample.extent,
          liveKin.temperatureK,
          liveKin.hasCatalyst
        );
        sceneDirtyRef.current = false;

        // Throttle React UI/SVG cursor commits (~22 fps) so 3D motion never stalls on React reconciliation
        if (nextP >= 1 || nowMs - lastUiSyncMs >= 45) {
          lastUiSyncMs = nowMs;
          setProgress(nextP);
        }
      } else if (sceneDirtyRef.current) {
        renderReactionMoleculesRef.current?.(
          selectedReactionRef.current,
          liveKin.extent,
          liveKin.temperatureK,
          liveKin.hasCatalyst
        );
        sceneDirtyRef.current = false;
      }

      const tempNorm = Math.max(0, Math.min(1, (liveKin.temperatureK - 250) / 950));

      // Rotate reaction chamber + apply subtle thermal agitation scaled by temperature
      if (reactionGroupRef.current) {
        reactionGroupRef.current.rotation.y += delta * (0.14 + tempNorm * 0.25);
        const freq = 5 + tempNorm * 14;
        const amp = 0.01 + tempNorm * 0.065;
        reactionGroupRef.current.position.y = Math.sin(clock.elapsedTime * freq) * amp;
        reactionGroupRef.current.position.x = Math.cos(clock.elapsedTime * freq * 0.85) * (amp * 0.6);
      }

      // Emit kinetic energy / thermal sparks reusing pooled spark geometry & materials
      const assets = threeAssetsRef.current;
      if (
        assets &&
        isPlayingRef.current &&
        liveKin.rateMPerSec > 0.025 &&
        energyParticlesRef.current.length < 22 &&
        Math.random() < Math.min(0.4, liveKin.rateMPerSec * 1.3 + tempNorm * 0.1)
      ) {
        const sparkMat = liveKin.hasCatalyst
          ? assets.sparkMats.emerald
          : liveKin.isExothermic
          ? assets.sparkMats.amber
          : assets.sparkMats.cyan;
        const spark = new THREE.Mesh(assets.sparkUnitGeo, sparkMat);
        spark.scale.setScalar(0.08 + tempNorm * 0.05);
        spark.position.set(
          (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 2.4
        );
        scene.add(spark);
        energyParticlesRef.current.push({
          mesh: spark,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * (0.6 + tempNorm),
            0.35 + tempNorm * 0.8,
            (Math.random() - 0.5) * (0.6 + tempNorm)
          ),
          life: 0.7 + Math.random() * 0.5,
        });
      }

      // Animate heat particles when transitioning
      for (let i = energyParticlesRef.current.length - 1; i >= 0; i--) {
        const p = energyParticlesRef.current[i];
        p.mesh.position.addScaledVector(p.vel, delta * 3);
        p.life -= delta;
        p.mesh.scale.multiplyScalar(0.96);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          energyParticlesRef.current.splice(i, 1);
        }
      }

      // Update 3D Exothermic / Endothermic Potential Heat Map Uniforms (zero-alloc)
      const hm = heatMapRefs.current;
      if (hm) {
        const hmVisible = showHeatMapRef.current;
        hm.floorMesh.visible = hmVisible;
        hm.midMesh.visible = hmVisible;
        if (hmVisible) {
          const rx = selectedReactionRef.current;
          const absH = Math.abs(rx.enthalpyDeltaH || 100);
          const enthalpyNorm = Math.max(0.32, Math.min(1.0, Math.log10(1 + absH) / 6.0));
          const exoSign = rx.isExothermic ? 1.0 : -1.0;

          let hotspotCount = 0;
          if (assets && reactionGroupRef.current) {
            const rotY = reactionGroupRef.current.rotation.y;
            const cosR = Math.cos(rotY);
            const sinR = Math.sin(rotY);
            const offX = reactionGroupRef.current.position.x;
            // Count currently active sphere meshes
            let activeSpheres = 0;
            for (let i = 0; i < assets.spherePool.length; i++) {
              if (assets.spherePool[i].visible) activeSpheres++;
            }
            const stride = Math.max(1, Math.ceil(activeSpheres / 12));
            let seen = 0;
            for (let i = 0; i < assets.spherePool.length && hotspotCount < 12; i++) {
              const s = assets.spherePool[i];
              if (!s.visible) continue;
              if (seen % stride === 0) {
                const lx = s.position.x;
                const lz = s.position.z;
                const wx = lx * cosR + lz * sinR + offX;
                const wz = -lx * sinR + lz * cosR;
                const weight = Math.max(0.55, Math.min(1.35, s.scale.x * 1.8));
                heatMapHotspots[hotspotCount].set(wx, wz, weight);
                hotspotCount++;
              }
              seen++;
            }
          }

          const elapsed = clock.elapsedTime;
          for (let mIdx = 0; mIdx < 2; mIdx++) {
            const u = mIdx === 0 ? hm.floorMat.uniforms : hm.midMat.uniforms;
            u.uTime.value = elapsed;
            u.uExtent.value = liveKin.extent;
            u.uExothermic.value = exoSign;
            u.uEnthalpyNorm.value = enthalpyNorm;
            u.uTempNorm.value = tempNorm;
            u.uHotspotCount.value = hotspotCount;
          }
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      floorGeo.dispose();
      floorMat.dispose();
      heatGeo.dispose();
      heatFloorMat.dispose();
      heatMidMat.dispose();
      heatMapRefs.current = null;
      sharedGeos.forEach((g) => g.dispose());
      sharedMats.forEach((m) => m.dispose());
      haloRingMats.forEach((m) => m.dispose());
      dashedLineMats.forEach((m) => m.dispose());
      linePool.forEach((l) => l.geometry.dispose());
      threeAssetsRef.current = null;
      disposeEnv();
      renderer.dispose();
      floorMeshRef.current = null;
    };
  }, []);

  // Update scene background, floor color, and heat map contrast on theme switch without recreating scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    }
    if (floorMeshRef.current) {
      const mat = floorMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(theme === 'dark' ? 0x000000 : 0x94a3b8);
      mat.opacity = theme === 'dark' ? 0.35 : 0.12;
    }
    if (heatMapRefs.current) {
      const lightFlag = theme === 'light' ? 1.0 : 0.0;
      heatMapRefs.current.floorMat.uniforms.uIsLightTheme.value = lightFlag;
      heatMapRefs.current.midMat.uniforms.uIsLightTheme.value = lightFlag;
    }
  }, [theme]);

  // Zero-allocation pooled 3D reaction builder (invoked at 60fps directly by animate())
  renderReactionMoleculesRef.current = (
    selectedReaction: ChemicalReaction,
    kineticExtent: number,
    temperatureK: number,
    hasCatalyst: boolean
  ) => {
    const group = reactionGroupRef.current;
    const assets = threeAssetsRef.current;
    if (!group || !assets) return;

    const {
      carbonMat,
      oxygenMat,
      hydrogenMat,
      nitrogenMat,
      sodiumMat,
      chlorineMat,
      ironMat,
      aluminiumMat,
      calciumMat,
      bondMat,
      electronMat,
      atpMat,
      cathodeMat,
      anodeMat,
      uraniumMat,
      bariumMat,
      kryptonMat,
      neutronMat,
      protonMat,
      alphaMat,
      leadMat,
      iodineMat,
      silverMat,
      copperMat,
      zincMat,
      moltenMat,
      plutoniumCoreMat,
      xenonFragMat,
      zirconiumFragMat,
      cuCationMat,
      rustMat,
      catNodeMat,
    } = assets.mats;

    // Reset singleton toggles (toggled ON only by the active reaction/state)
    assets.cathodeBoxMesh.visible = false;
    assets.anodeBoxMesh.visible = false;
    assets.znPlateMesh.visible = false;
    assets.waterMesh.visible = false;
    assets.tokamakMeshes[0].visible = false;
    assets.tokamakMeshes[1].visible = false;
    assets.tokamakMeshes[2].visible = false;

    let sIdx = 0;
    let cIdx = 0;
    let rIdx = 0;
    let lIdx = 0;

    const upVec = new THREE.Vector3(0, 1, 0);
    const dirVec = new THREE.Vector3();

    const addAtom = (mat: THREE.Material, pos: THREE.Vector3, radius = 0.45) => {
      let mesh = assets.spherePool[sIdx];
      if (!mesh) {
        mesh = new THREE.Mesh(assets.unitSphereGeo, mat);
        assets.spherePool.push(mesh);
        group.add(mesh);
      } else {
        mesh.material = mat;
      }
      sIdx++;
      mesh.position.copy(pos);
      mesh.scale.setScalar(radius);
      mesh.visible = true;
      return mesh;
    };

    const addBond = (p1: THREE.Vector3, p2: THREE.Vector3, radius = 0.08, mat = bondMat) => {
      const dist = p1.distanceTo(p2);
      if (dist <= 0.01) return;
      let mesh = assets.cylPool[cIdx];
      if (!mesh) {
        mesh = new THREE.Mesh(assets.unitCylinderGeo, mat);
        assets.cylPool.push(mesh);
        group.add(mesh);
      } else {
        mesh.material = mat;
      }
      cIdx++;
      mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
      dirVec.copy(p2).sub(p1).normalize();
      mesh.quaternion.setFromUnitVectors(upVec, dirVec);
      mesh.scale.set(radius, dist, radius);
      mesh.visible = true;
      return mesh;
    };

    const addDoubleBond = (p1: THREE.Vector3, p2: THREE.Vector3, offsetDist = 0.12, radius = 0.06) => {
      const dir = p2.clone().sub(p1).normalize();
      const perp = new THREE.Vector3(-dir.y, dir.x, dir.z).normalize().multiplyScalar(offsetDist);
      addBond(p1.clone().add(perp), p2.clone().add(perp), radius);
      addBond(p1.clone().sub(perp), p2.clone().sub(perp), radius);
    };

    const addTripleBond = (p1: THREE.Vector3, p2: THREE.Vector3, offsetDist = 0.13, radius = 0.05) => {
      addBond(p1, p2, radius);
      const dir = p2.clone().sub(p1).normalize();
      const perp = new THREE.Vector3(0, 0, 1).cross(dir).normalize().multiplyScalar(offsetDist);
      addBond(p1.clone().add(perp), p2.clone().add(perp), radius);
      addBond(p1.clone().sub(perp), p2.clone().sub(perp), radius);
    };

    const addCoulombFieldLine = (p1: THREE.Vector3, p2: THREE.Vector3, color = 0x38bdf8) => {
      let mat = assets.dashedLineMats.get(color);
      if (!mat) {
        mat = new THREE.LineDashedMaterial({
          color,
          dashSize: 0.25,
          gapSize: 0.15,
        });
        assets.dashedLineMats.set(color, mat);
      }
      let line = assets.linePool[lIdx];
      if (!line) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        line = new THREE.Line(geo, mat);
        assets.linePool.push(line);
        group.add(line);
      } else {
        line.material = mat;
      }
      lIdx++;
      const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, p1.x, p1.y, p1.z);
      posAttr.setXYZ(1, p2.x, p2.y, p2.z);
      posAttr.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      line.computeLineDistances();
      line.visible = true;
    };

    const addHaloRing = (center: THREE.Vector3, radius: number, color: number) => {
      let ringMat = assets.haloRingMats.get(color);
      if (!ringMat) {
        ringMat = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
        });
        assets.haloRingMats.set(color, ringMat);
      }
      let ring = assets.ringPool[rIdx];
      if (!ring) {
        ring = new THREE.Mesh(assets.unitRingGeo, ringMat);
        ring.rotation.x = Math.PI / 4;
        assets.ringPool.push(ring);
        group.add(ring);
      } else {
        ring.material = ringMat;
      }
      rIdx++;
      ring.position.copy(center);
      ring.scale.setScalar(radius);
      ring.visible = true;
    };

    // Thermal chamber indicator ring reflecting kinetic temperature (250 K -> 1200 K)
    const tempNorm = Math.max(0, Math.min(1, (temperatureK - 250) / 950));
    const heaterColor =
      temperatureK >= 650 ? 0xf97316 : temperatureK >= 420 ? 0xf59e0b : 0x38bdf8;
    assets.heaterRingMat.color.setHex(heaterColor);
    assets.heaterRingMat.opacity = 0.18 + tempNorm * 0.45;
    assets.heaterRingMesh.visible = true;

    // Catalytic active-site surface / mediator nodes when Catalyst is toggled ON
    if (hasCatalyst) {
      assets.catRingMesh.visible = true;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        addAtom(catNodeMat, new THREE.Vector3(Math.cos(ang) * 2.21, -2.4, Math.sin(ang) * 2.21), 0.16);
      }
    } else {
      assets.catRingMesh.visible = false;
    }

    // Transition State Energy Barrier Glow driven by kinetic extent
    if (kineticExtent > 0.4 && kineticExtent < 0.65) {
      assets.barrierMat.color.setHex(
        hasCatalyst ? 0x34d399 : selectedReaction.isExothermic ? 0xf59e0b : 0x06b6d4
      );
      assets.barrierMat.opacity = (1 - Math.abs(kineticExtent - 0.5) / 0.15) * 0.25;
      assets.barrierMesh.scale.setScalar(1.8 + Math.sin(kineticExtent * Math.PI) * 1.2);
      assets.barrierMesh.visible = true;
    } else {
      assets.barrierMesh.visible = false;
    }

    const t = kineticExtent;
    const approach = t < 0.5 ? t / 0.5 : 1;
    const sep = t >= 0.5 ? (t - 0.5) / 0.5 : 0;

    // =========================================================================
    // 1. METHANE COMBUSTION: CH4 + 2 O2 -> CO2 + 2 H2O
    // =========================================================================
    if (selectedReaction.id === 'methane_combustion') {
      if (t < 0.5) {
        // CH4 Tetrahedral
        const chPos = new THREE.Vector3(-3.8 * (1 - approach), 0, 0);
        addAtom(carbonMat, chPos, 0.55);
        [
          new THREE.Vector3(0.65, 0.65, 0.65),
          new THREE.Vector3(-0.65, -0.65, 0.65),
          new THREE.Vector3(-0.65, 0.65, -0.65),
          new THREE.Vector3(0.65, -0.65, -0.65),
        ].forEach((off) => {
          const hPos = chPos.clone().add(off);
          addAtom(hydrogenMat, hPos, 0.28);
          addBond(chPos, hPos);
        });

        // 2 O2 molecules approaching
        const o2APos = new THREE.Vector3(3.8 * (1 - approach), 1.6, 0);
        const o1 = addAtom(oxygenMat, o2APos.clone().add(new THREE.Vector3(-0.55, 0, 0)), 0.48);
        const o2 = addAtom(oxygenMat, o2APos.clone().add(new THREE.Vector3(0.55, 0, 0)), 0.48);
        addDoubleBond(o1.position, o2.position);

        const o2BPos = new THREE.Vector3(3.8 * (1 - approach), -1.6, 0);
        const o3 = addAtom(oxygenMat, o2BPos.clone().add(new THREE.Vector3(-0.55, 0, 0)), 0.48);
        const o4 = addAtom(oxygenMat, o2BPos.clone().add(new THREE.Vector3(0.55, 0, 0)), 0.48);
        addDoubleBond(o3.position, o4.position);
      } else {
        // Linear CO2 in center departing forward
        const co2Pos = new THREE.Vector3(0, 0, sep * 2.5);
        const c = addAtom(carbonMat, co2Pos, 0.55);
        const oLeft = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(-1.25, 0, 0)), 0.48);
        const oRight = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(1.25, 0, 0)), 0.48);
        addDoubleBond(c.position, oLeft.position);
        addDoubleBond(c.position, oRight.position);

        // 2 H2O molecules departing with 104.5 deg bend
        const h2o1Pos = new THREE.Vector3(-2.4 * sep - 1.2, 2.0 * sep + 1.2, 0);
        const oH2O1 = addAtom(oxygenMat, h2o1Pos, 0.48);
        const h1a = addAtom(hydrogenMat, h2o1Pos.clone().add(new THREE.Vector3(0.7, -0.4, 0)), 0.28);
        const h1b = addAtom(hydrogenMat, h2o1Pos.clone().add(new THREE.Vector3(-0.7, -0.4, 0)), 0.28);
        addBond(oH2O1.position, h1a.position);
        addBond(oH2O1.position, h1b.position);

        const h2o2Pos = new THREE.Vector3(2.4 * sep + 1.2, -2.0 * sep - 1.2, 0);
        const oH2O2 = addAtom(oxygenMat, h2o2Pos, 0.48);
        const h2a = addAtom(hydrogenMat, h2o2Pos.clone().add(new THREE.Vector3(0.7, 0.4, 0)), 0.28);
        const h2b = addAtom(hydrogenMat, h2o2Pos.clone().add(new THREE.Vector3(-0.7, 0.4, 0)), 0.28);
        addBond(oH2O2.position, h2a.position);
        addBond(oH2O2.position, h2b.position);
      }
    }
    // =========================================================================
    // 2. WATER SYNTHESIS: 2 H2 + O2 -> 2 H2O
    // =========================================================================
    else if (selectedReaction.id === 'water_synthesis') {
      if (t < 0.5) {
        // Two H2 diatomic molecules on left
        const h2Pos1 = new THREE.Vector3(-4.0 * (1 - approach), 1.4, 0);
        const h1a = addAtom(hydrogenMat, h2Pos1.clone().add(new THREE.Vector3(-0.38, 0, 0)), 0.3);
        const h1b = addAtom(hydrogenMat, h2Pos1.clone().add(new THREE.Vector3(0.38, 0, 0)), 0.3);
        addBond(h1a.position, h1b.position, 0.08);

        const h2Pos2 = new THREE.Vector3(-4.0 * (1 - approach), -1.4, 0);
        const h2a = addAtom(hydrogenMat, h2Pos2.clone().add(new THREE.Vector3(-0.38, 0, 0)), 0.3);
        const h2b = addAtom(hydrogenMat, h2Pos2.clone().add(new THREE.Vector3(0.38, 0, 0)), 0.3);
        addBond(h2a.position, h2b.position, 0.08);

        // One O2 double-bonded molecule on right
        const o2Pos = new THREE.Vector3(4.0 * (1 - approach), 0, 0);
        const o1 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0.48);
        const o2 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(0, -0.6, 0)), 0.48);
        addDoubleBond(o1.position, o2.position);
      } else {
        // Two stable 104.5 degree bent H2O molecules departing
        const h2oPosA = new THREE.Vector3(-2.8 * (1 + sep), 1.2 * (1 + sep), 0);
        const oxA = addAtom(oxygenMat, h2oPosA, 0.5);
        const ha1 = addAtom(hydrogenMat, h2oPosA.clone().add(new THREE.Vector3(0.72, -0.42, 0)), 0.3);
        const ha2 = addAtom(hydrogenMat, h2oPosA.clone().add(new THREE.Vector3(-0.72, -0.42, 0)), 0.3);
        addBond(oxA.position, ha1.position, 0.09);
        addBond(oxA.position, ha2.position, 0.09);

        const h2oPosB = new THREE.Vector3(2.8 * (1 + sep), -1.2 * (1 + sep), 0);
        const oxB = addAtom(oxygenMat, h2oPosB, 0.5);
        const hb1 = addAtom(hydrogenMat, h2oPosB.clone().add(new THREE.Vector3(0.72, 0.42, 0)), 0.3);
        const hb2 = addAtom(hydrogenMat, h2oPosB.clone().add(new THREE.Vector3(-0.72, 0.42, 0)), 0.3);
        addBond(oxB.position, hb1.position, 0.09);
        addBond(oxB.position, hb2.position, 0.09);
      }
    }
    // =========================================================================
    // 3. HABER-BOSCH AMMONIA SYNTHESIS: N2 + 3 H2 -> 2 NH3
    // =========================================================================
    else if (selectedReaction.id === 'haber_bosch') {
      if (t < 0.5) {
        // N2 molecule in center with triple bond
        const n1 = addAtom(nitrogenMat, new THREE.Vector3(-0.58 * (1 - approach), 0, 0), 0.52);
        const n2 = addAtom(nitrogenMat, new THREE.Vector3(0.58 * (1 - approach), 0, 0), 0.52);
        addTripleBond(n1.position, n2.position);

        // 3 H2 molecules approaching
        [-2.4, 0, 2.4].forEach((y, i) => {
          const hPos = new THREE.Vector3(-4.5 * (1 - approach), y, (i - 1) * 1.5);
          const ha = addAtom(hydrogenMat, hPos.clone().add(new THREE.Vector3(-0.35, 0, 0)), 0.28);
          const hb = addAtom(hydrogenMat, hPos.clone().add(new THREE.Vector3(0.35, 0, 0)), 0.28);
          addBond(ha.position, hb.position);
        });
      } else {
        // Two NH3 trigonal pyramidal molecules formed
        [-2.5 * (1 + sep), 2.5 * (1 + sep)].forEach((x) => {
          const nPos = new THREE.Vector3(x, 0, 0);
          addAtom(nitrogenMat, nPos, 0.52);
          const hOffsets = [
            new THREE.Vector3(0, 0.8, -0.3),
            new THREE.Vector3(0.72, -0.42, -0.3),
            new THREE.Vector3(-0.72, -0.42, -0.3),
          ];
          hOffsets.forEach((off) => {
            const hp = nPos.clone().add(off);
            addAtom(hydrogenMat, hp, 0.28);
            addBond(nPos, hp);
          });
        });
      }
    }
    // =========================================================================
    // 4. PHOTOSYNTHESIS: 6 CO2 + 6 H2O + Photons -> Glucose (C6H12O6) + 6 O2
    // =========================================================================
    else if (selectedReaction.id === 'photosynthesis') {
      if (t < 0.5) {
        // Incoming CO2 and H2O molecules bathed in sunlight photon rays
        [-3.8, 3.8].forEach((x, i) => {
          const co2P = new THREE.Vector3(x * (1 - approach), 1.8, 0);
          const c = addAtom(carbonMat, co2P, 0.48);
          const o1 = addAtom(oxygenMat, co2P.clone().add(new THREE.Vector3(-1.0, 0, 0)), 0.42);
          const o2 = addAtom(oxygenMat, co2P.clone().add(new THREE.Vector3(1.0, 0, 0)), 0.42);
          addDoubleBond(c.position, o1.position);
          addDoubleBond(c.position, o2.position);

          const h2oP = new THREE.Vector3(x * (1 - approach), -1.8, (i - 0.5) * 1.5);
          const ox = addAtom(oxygenMat, h2oP, 0.45);
          const h1 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(0.6, -0.35, 0)), 0.26);
          const h2 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(-0.6, -0.35, 0)), 0.26);
          addBond(ox.position, h1.position);
          addBond(ox.position, h2.position);
        });

        // Golden sunlight photons converging
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const dist = 5.0 * (1 - approach * 0.8);
          const pPos = new THREE.Vector3(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.0);
          addAtom(electronMat, pPos, 0.16);
        }
      } else {
        // Complete Glucose Hexagonal Pyranose Chair Ring formed in center!
        const ringRadius = 1.4;
        const ringAtoms: THREE.Vector3[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const yOff = (i % 2 === 0 ? 0.25 : -0.25);
          const pos = new THREE.Vector3(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius + yOff, 0);
          ringAtoms.push(pos);
          if (i === 5) {
            // Ring Oxygen O5
            addAtom(oxygenMat, pos, 0.46);
          } else {
            // Ring Carbons C1-C5
            addAtom(carbonMat, pos, 0.5);
            // Attach -OH hydroxyl groups to Carbons
            const ohPos = pos.clone().add(new THREE.Vector3(Math.cos(angle) * 0.85, Math.sin(angle) * 0.85, 0.3));
            addAtom(oxygenMat, ohPos, 0.4);
            const hPos = ohPos.clone().add(new THREE.Vector3(0.3, 0.3, 0));
            addAtom(hydrogenMat, hPos, 0.25);
            addBond(pos, ohPos);
            addBond(ohPos, hPos);
          }
        }
        // Connect the 6-membered pyranose ring bonds
        for (let i = 0; i < 6; i++) {
          addBond(ringAtoms[i], ringAtoms[(i + 1) % 6], 0.1);
        }

        // 6 O2 molecules departing into the atmosphere
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const o2Dist = 3.6 * (1 + sep);
          const o2Center = new THREE.Vector3(Math.cos(angle) * o2Dist, Math.sin(angle) * o2Dist, (i % 2 === 0 ? 1 : -1));
          const oA = addAtom(oxygenMat, o2Center.clone().add(new THREE.Vector3(-0.45, 0, 0)), 0.44);
          const oB = addAtom(oxygenMat, o2Center.clone().add(new THREE.Vector3(0.45, 0, 0)), 0.44);
          addDoubleBond(oA.position, oB.position);
        }
      }
    }
    // =========================================================================
    // 5. CELLULAR RESPIRATION: Glucose + 6 O2 -> 6 CO2 + 6 H2O + ATP
    // =========================================================================
    else if (selectedReaction.id === 'cellular_respiration') {
      if (t < 0.5) {
        // Glucose ring in center, O2 approaching
        const ringRadius = 1.3 * (1 - approach * 0.4);
        const ringAtoms: THREE.Vector3[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const pos = new THREE.Vector3(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);
          ringAtoms.push(pos);
          addAtom(i === 5 ? oxygenMat : carbonMat, pos, 0.48);
        }
        for (let i = 0; i < 6; i++) {
          addBond(ringAtoms[i], ringAtoms[(i + 1) % 6], 0.09);
        }

        // Incoming O2 molecules
        [-4.2, 4.2].forEach((x) => {
          const o2Center = new THREE.Vector3(x * (1 - approach), 0, 0);
          const o1 = addAtom(oxygenMat, o2Center.clone().add(new THREE.Vector3(0, 0.5, 0)), 0.44);
          const o2 = addAtom(oxygenMat, o2Center.clone().add(new THREE.Vector3(0, -0.5, 0)), 0.44);
          addDoubleBond(o1.position, o2.position);
        });
      } else {
        // Multiple CO2 + H2O flying outward with ATP energy packets!
        [-3.2 * (1 + sep), 3.2 * (1 + sep)].forEach((x, i) => {
          // CO2 linear
          const co2P = new THREE.Vector3(x, 1.8 * (1 + sep), 0);
          const c = addAtom(carbonMat, co2P, 0.5);
          const o1 = addAtom(oxygenMat, co2P.clone().add(new THREE.Vector3(-1.1, 0, 0)), 0.44);
          const o2 = addAtom(oxygenMat, co2P.clone().add(new THREE.Vector3(1.1, 0, 0)), 0.44);
          addDoubleBond(c.position, o1.position);
          addDoubleBond(c.position, o2.position);

          // H2O bent
          const h2oP = new THREE.Vector3(x * 0.8, -1.8 * (1 + sep), (i - 0.5) * 1.5);
          const ox = addAtom(oxygenMat, h2oP, 0.48);
          const h1 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(0.65, -0.35, 0)), 0.28);
          const h2 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(-0.65, -0.35, 0)), 0.28);
          addBond(ox.position, h1.position);
          addBond(ox.position, h2.position);
        });

        // Golden ATP energy packets radiating
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.5, 1.2), new THREE.Vector3(0, -1.5, -1.2)].forEach((pos) => {
          addAtom(atpMat, pos, 0.45);
          addHaloRing(pos, 0.75, 0xf59e0b);
        });
      }
    }
    // =========================================================================
    // 6. HYDROGEN PEROXIDE DECOMPOSITION: 2 H2O2 -> 2 H2O + O2
    // =========================================================================
    else if (selectedReaction.id === 'h2o2_decomposition') {
      if (t < 0.5) {
        // Two H-O-O-H peroxide molecules
        [-1.8 * (1 - approach), 1.8 * (1 - approach)].forEach((y) => {
          const o1 = addAtom(oxygenMat, new THREE.Vector3(-0.7, y, 0), 0.48);
          const o2 = addAtom(oxygenMat, new THREE.Vector3(0.7, y, 0), 0.48);
          const h1 = addAtom(hydrogenMat, new THREE.Vector3(-1.4, y + 0.5, 0), 0.28);
          const h2 = addAtom(hydrogenMat, new THREE.Vector3(1.4, y - 0.5, 0), 0.28);
          addBond(o1.position, o2.position);
          addBond(o1.position, h1.position);
          addBond(o2.position, h2.position);
        });
      } else {
        // Two H2O departing sides
        const h2oA = new THREE.Vector3(-2.8 * (1 + sep), 0, 0);
        const oA = addAtom(oxygenMat, h2oA, 0.48);
        const ha1 = addAtom(hydrogenMat, h2oA.clone().add(new THREE.Vector3(-0.65, 0.45, 0)), 0.28);
        const ha2 = addAtom(hydrogenMat, h2oA.clone().add(new THREE.Vector3(-0.65, -0.45, 0)), 0.28);
        addBond(oA.position, ha1.position);
        addBond(oA.position, ha2.position);

        const h2oB = new THREE.Vector3(2.8 * (1 + sep), 0, 0);
        const oB = addAtom(oxygenMat, h2oB, 0.48);
        const hb1 = addAtom(hydrogenMat, h2oB.clone().add(new THREE.Vector3(0.65, 0.45, 0)), 0.28);
        const hb2 = addAtom(hydrogenMat, h2oB.clone().add(new THREE.Vector3(0.65, -0.45, 0)), 0.28);
        addBond(oB.position, hb1.position);
        addBond(oB.position, hb2.position);

        // O2 bubble floating up rapidly
        const o2Pos = new THREE.Vector3(0, 2.5 * (1 + sep), 0);
        const o1 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(-0.5, 0, 0)), 0.48);
        const o2 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(0.5, 0, 0)), 0.48);
        addDoubleBond(o1.position, o2.position);
      }
    }
    // =========================================================================
    // 7. THERMITE PYROTECHNIC REDOX: Fe2O3 + 2 Al -> 2 Fe + Al2O3
    // =========================================================================
    else if (selectedReaction.id === 'thermite_redox') {
      if (t < 0.5) {
        // Fe2O3 cluster
        const fePos1 = new THREE.Vector3(-3.5 * (1 - approach) - 0.8, 0, 0);
        const fePos2 = new THREE.Vector3(-3.5 * (1 - approach) + 0.8, 0, 0);
        addAtom(ironMat, fePos1, 0.55);
        addAtom(ironMat, fePos2, 0.55);
        const o1 = addAtom(oxygenMat, fePos1.clone().add(new THREE.Vector3(0, 1.1, 0)), 0.45);
        const o2 = addAtom(oxygenMat, fePos2.clone().add(new THREE.Vector3(0, -1.1, 0)), 0.45);
        addBond(fePos1, o1.position);
        addBond(fePos2, o2.position);

        // 2 Al metal powders approaching
        addAtom(aluminiumMat, new THREE.Vector3(3.5 * (1 - approach), 1.2, 0), 0.58);
        addAtom(aluminiumMat, new THREE.Vector3(3.5 * (1 - approach), -1.2, 0), 0.58);
      } else {
        // Molten white-hot Fe droplets sinking
        addAtom(moltenMat, new THREE.Vector3(-1.6 * (1 + sep), -2.0 * (1 + sep), 0), 0.62);
        addAtom(moltenMat, new THREE.Vector3(1.6 * (1 + sep), -2.0 * (1 + sep), 0), 0.62);

        // Al2O3 corundum slag structure floating
        const alPos = new THREE.Vector3(0, 1.8 * (1 + sep), 0);
        const al1 = addAtom(aluminiumMat, alPos.clone().add(new THREE.Vector3(-1.0, 0, 0)), 0.52);
        const al2 = addAtom(aluminiumMat, alPos.clone().add(new THREE.Vector3(1.0, 0, 0)), 0.52);
        const ox = addAtom(oxygenMat, alPos, 0.46);
        addBond(al1.position, ox.position);
        addBond(al2.position, ox.position);
      }
    }
    // =========================================================================
    // 8. LIMESTONE CALCINATION: CaCO3 -> CaO + CO2
    // =========================================================================
    else if (selectedReaction.id === 'calcium_carbonate_calcination') {
      if (t < 0.5) {
        // Calcite mineral crystal unit: Ca2+ coordinated with planar [CO3]2-
        const caPos = new THREE.Vector3(0, -1.0 * (1 - approach * 0.3), 0);
        addAtom(calciumMat, caPos, 0.65);

        const carbPos = new THREE.Vector3(0, 0.8 * (1 - approach * 0.3), 0);
        const c = addAtom(carbonMat, carbPos, 0.5);
        const o1 = addAtom(oxygenMat, carbPos.clone().add(new THREE.Vector3(0, 1.1, 0)), 0.45);
        const o2 = addAtom(oxygenMat, carbPos.clone().add(new THREE.Vector3(0.95, -0.55, 0)), 0.45);
        const o3 = addAtom(oxygenMat, carbPos.clone().add(new THREE.Vector3(-0.95, -0.55, 0)), 0.45);
        addDoubleBond(c.position, o1.position);
        addBond(c.position, o2.position);
        addBond(c.position, o3.position);

        // Ionic coordination between Ca2+ and carbonate
        addBond(caPos, o2.position, 0.05);
        addBond(caPos, o3.position, 0.05);
      } else {
        // Quicklime CaO residue remaining solid at bottom
        const caPos = new THREE.Vector3(-0.6, -1.8, 0);
        const oPos = new THREE.Vector3(0.6, -1.8, 0);
        const ca = addAtom(calciumMat, caPos, 0.65);
        const ox = addAtom(oxygenMat, oPos, 0.5);
        addDoubleBond(ca.position, ox.position);

        // Linear CO2 gas escaping rapidly upward
        const co2Pos = new THREE.Vector3(0, 1.2 + 3.2 * sep, 0);
        const c = addAtom(carbonMat, co2Pos, 0.5);
        const oL = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(-1.15, 0, 0)), 0.45);
        const oR = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(1.15, 0, 0)), 0.45);
        addDoubleBond(c.position, oL.position);
        addDoubleBond(c.position, oR.position);
      }
    }
    // =========================================================================
    // 9. ETHANOL COMBUSTION: C2H5OH + 3 O2 -> 2 CO2 + 3 H2O
    // =========================================================================
    else if (selectedReaction.id === 'ethanol_combustion') {
      if (t < 0.5) {
        // Full 2-carbon Ethanol molecule (CH3-CH2-OH)
        const c1Pos = new THREE.Vector3(-3.5 * (1 - approach) - 0.75, 0, 0);
        const c2Pos = new THREE.Vector3(-3.5 * (1 - approach) + 0.75, 0, 0);
        addAtom(carbonMat, c1Pos, 0.52);
        addAtom(carbonMat, c2Pos, 0.52);
        addBond(c1Pos, c2Pos, 0.1);

        // C1 Hydrogens (CH3)
        [new THREE.Vector3(-0.65, 0.65, 0), new THREE.Vector3(-0.65, -0.65, 0.5), new THREE.Vector3(-0.65, -0.65, -0.5)].forEach((off) => {
          const hp = c1Pos.clone().add(off);
          addAtom(hydrogenMat, hp, 0.28);
          addBond(c1Pos, hp);
        });

        // C2 Hydrogens (CH2)
        [new THREE.Vector3(0, 0.85, 0.4), new THREE.Vector3(0, -0.85, 0.4)].forEach((off) => {
          const hp = c2Pos.clone().add(off);
          addAtom(hydrogenMat, hp, 0.28);
          addBond(c2Pos, hp);
        });

        // Hydroxyl -OH
        const ohPos = c2Pos.clone().add(new THREE.Vector3(0.9, 0, -0.4));
        const ox = addAtom(oxygenMat, ohPos, 0.46);
        const hPos = ohPos.clone().add(new THREE.Vector3(0.5, 0.5, 0));
        addAtom(hydrogenMat, hPos, 0.28);
        addBond(c2Pos, ox.position);
        addBond(ox.position, hPos);

        // 3 O2 molecules approaching
        [-1.8, 0, 1.8].forEach((y, i) => {
          const o2P = new THREE.Vector3(3.8 * (1 - approach), y, (i - 1) * 1.2);
          const o1 = addAtom(oxygenMat, o2P.clone().add(new THREE.Vector3(-0.5, 0, 0)), 0.46);
          const o2 = addAtom(oxygenMat, o2P.clone().add(new THREE.Vector3(0.5, 0, 0)), 0.46);
          addDoubleBond(o1.position, o2.position);
        });
      } else {
        // 2 CO2 molecules departing
        [-2.0 * (1 + sep), 2.0 * (1 + sep)].forEach((x, i) => {
          const co2P = new THREE.Vector3(x, 1.8 * (1 + sep), (i - 0.5) * 1.5);
          const c = addAtom(carbonMat, co2P, 0.52);
          const oL = addAtom(oxygenMat, co2P.clone().add(new THREE.Vector3(-1.15, 0, 0)), 0.46);
          const oR = addAtom(oxygenMat, co2P.clone().add(new THREE.Vector3(1.15, 0, 0)), 0.46);
          addDoubleBond(c.position, oL.position);
          addDoubleBond(c.position, oR.position);
        });

        // 3 H2O molecules departing
        [-2.5, 0, 2.5].forEach((x, i) => {
          const h2oP = new THREE.Vector3(x * (1 + sep), -2.0 * (1 + sep), (i - 1) * 1.2);
          const ox = addAtom(oxygenMat, h2oP, 0.48);
          const h1 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(0.68, 0.4, 0)), 0.28);
          const h2 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(-0.68, 0.4, 0)), 0.28);
          addBond(ox.position, h1.position);
          addBond(ox.position, h2.position);
        });
      }
    }
    // =========================================================================
    // 10. FISCHER ESTERIFICATION: CH3COOH + C2H5OH <-> Ethyl Acetate + H2O
    // =========================================================================
    else if (selectedReaction.id === 'fischer_esterification') {
      if (t < 0.5) {
        // Left: Acetic acid CH3COOH
        const acP = new THREE.Vector3(-3.2 * (1 - approach), 0, 0);
        const cMethyl = addAtom(carbonMat, acP.clone().add(new THREE.Vector3(-0.8, 0, 0)), 0.5);
        const cCarb = addAtom(carbonMat, acP.clone().add(new THREE.Vector3(0.5, 0, 0)), 0.5);
        addBond(cMethyl.position, cCarb.position);
        const oCarbonyl = addAtom(oxygenMat, acP.clone().add(new THREE.Vector3(0.5, 1.1, 0)), 0.46);
        addDoubleBond(cCarb.position, oCarbonyl.position);
        const oHydroxyl = addAtom(oxygenMat, acP.clone().add(new THREE.Vector3(1.3, -0.6, 0)), 0.46);
        const hHydroxyl = addAtom(hydrogenMat, acP.clone().add(new THREE.Vector3(1.9, -0.6, 0)), 0.26);
        addBond(cCarb.position, oHydroxyl.position);
        addBond(oHydroxyl.position, hHydroxyl.position);

        // Right: Ethanol HO-CH2-CH3
        const etP = new THREE.Vector3(3.2 * (1 - approach), 0, 0);
        const oAlcohol = addAtom(oxygenMat, etP.clone().add(new THREE.Vector3(-1.2, 0, 0)), 0.46);
        const hAlcohol = addAtom(hydrogenMat, etP.clone().add(new THREE.Vector3(-1.8, 0, 0)), 0.26);
        const cEthyl1 = addAtom(carbonMat, etP.clone().add(new THREE.Vector3(-0.3, 0, 0)), 0.5);
        const cEthyl2 = addAtom(carbonMat, etP.clone().add(new THREE.Vector3(1.0, 0, 0)), 0.5);
        addBond(oAlcohol.position, hAlcohol.position);
        addBond(oAlcohol.position, cEthyl1.position);
        addBond(cEthyl1.position, cEthyl2.position);
      } else {
        // Complete Ethyl Acetate Ester: CH3-C(=O)-O-CH2-CH3
        const esterP = new THREE.Vector3(-1.0 * (1 + sep * 0.5), 0, 0);
        const c1 = addAtom(carbonMat, esterP.clone().add(new THREE.Vector3(-1.8, 0, 0)), 0.5);
        const c2 = addAtom(carbonMat, esterP.clone().add(new THREE.Vector3(-0.6, 0, 0)), 0.5);
        addBond(c1.position, c2.position);
        const oCarbonyl = addAtom(oxygenMat, esterP.clone().add(new THREE.Vector3(-0.6, 1.1, 0)), 0.46);
        addDoubleBond(c2.position, oCarbonyl.position);
        const oEster = addAtom(oxygenMat, esterP.clone().add(new THREE.Vector3(0.6, -0.3, 0)), 0.46);
        addBond(c2.position, oEster.position);
        const c3 = addAtom(carbonMat, esterP.clone().add(new THREE.Vector3(1.6, 0, 0)), 0.5);
        const c4 = addAtom(carbonMat, esterP.clone().add(new THREE.Vector3(2.8, 0, 0)), 0.5);
        addBond(oEster.position, c3.position);
        addBond(c3.position, c4.position);

        // Water H2O eliminated and departing
        const h2oP = new THREE.Vector3(3.2 * (1 + sep), 1.8 * (1 + sep), 0);
        const ox = addAtom(oxygenMat, h2oP, 0.48);
        const h1 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(0.65, -0.4, 0)), 0.28);
        const h2 = addAtom(hydrogenMat, h2oP.clone().add(new THREE.Vector3(-0.65, -0.4, 0)), 0.28);
        addBond(ox.position, h1.position);
        addBond(ox.position, h2.position);
      }
    }
    // =========================================================================
    // 11. WATER ELECTROLYSIS: 2 H2O + Electricity -> 2 H2 + O2
    // =========================================================================
    else if (selectedReaction.id === 'water_electrolysis') {
      // Cathode plate (Negative / Blue) at left & Anode plate (Positive / Red) at right
      assets.cathodeBoxMesh.visible = true;
      assets.anodeBoxMesh.visible = true;

      // Electric field flux lines
      [-1.2, 0, 1.2].forEach((y) => {
        addCoulombFieldLine(new THREE.Vector3(-4.8, y, 0), new THREE.Vector3(4.8, y, 0), 0x38bdf8);
      });

      if (t < 0.5) {
        // Two polarized H2O molecules in electric field
        const h2o1 = new THREE.Vector3(-1.5 * (1 - approach), 0.8, 0);
        const ox1 = addAtom(oxygenMat, h2o1, 0.48);
        const h1a = addAtom(hydrogenMat, h2o1.clone().add(new THREE.Vector3(-0.65, 0.4, 0)), 0.28);
        const h1b = addAtom(hydrogenMat, h2o1.clone().add(new THREE.Vector3(-0.65, -0.4, 0)), 0.28);
        addBond(ox1.position, h1a.position);
        addBond(ox1.position, h1b.position);

        const h2o2 = new THREE.Vector3(1.5 * (1 - approach), -0.8, 0);
        const ox2 = addAtom(oxygenMat, h2o2, 0.48);
        const h2a = addAtom(hydrogenMat, h2o2.clone().add(new THREE.Vector3(-0.65, 0.4, 0)), 0.28);
        const h2b = addAtom(hydrogenMat, h2o2.clone().add(new THREE.Vector3(-0.65, -0.4, 0)), 0.28);
        addBond(ox2.position, h2a.position);
        addBond(ox2.position, h2b.position);
      } else {
        // Two H2 gas molecules bubbling up at CATHODE (2:1 volume ratio!)
        [-1.0, 1.0].forEach((yOff, idx) => {
          const h2Pos = new THREE.Vector3(-4.2, yOff + 2.5 * sep, (idx - 0.5) * 1.0);
          const ha = addAtom(hydrogenMat, h2Pos.clone().add(new THREE.Vector3(-0.35, 0, 0)), 0.3);
          const hb = addAtom(hydrogenMat, h2Pos.clone().add(new THREE.Vector3(0.35, 0, 0)), 0.3);
          addBond(ha.position, hb.position);
        });

        // One O2 gas molecule bubbling up at ANODE
        const o2Pos = new THREE.Vector3(4.2, 0 + 2.5 * sep, 0);
        const o1 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(0, 0.55, 0)), 0.48);
        const o2 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(0, -0.55, 0)), 0.48);
        addDoubleBond(o1.position, o2.position);
      }
    }
    // =========================================================================
    // 12. BAKING SODA & VINEGAR: NaHCO3 + CH3COOH -> CH3COONa + H2O + CO2
    // =========================================================================
    else if (selectedReaction.id === 'baking_soda_vinegar') {
      if (t < 0.5) {
        // Left: NaHCO3 (Na+ ion and HCO3- bicarbonate group)
        const nahco3P = new THREE.Vector3(-3.4 * (1 - approach), 0, 0);
        const na = addAtom(sodiumMat, nahco3P.clone().add(new THREE.Vector3(-1.2, 0, 0)), 0.55);
        const c = addAtom(carbonMat, nahco3P.clone().add(new THREE.Vector3(0.4, 0, 0)), 0.5);
        const oCarbonyl = addAtom(oxygenMat, nahco3P.clone().add(new THREE.Vector3(0.4, 1.1, 0)), 0.45);
        addDoubleBond(c.position, oCarbonyl.position);
        const oMinus = addAtom(oxygenMat, nahco3P.clone().add(new THREE.Vector3(-0.3, -0.8, 0)), 0.45);
        addBond(c.position, oMinus.position);
        addBond(na.position, oMinus.position, 0.05);
        const oH = addAtom(oxygenMat, nahco3P.clone().add(new THREE.Vector3(1.2, -0.6, 0)), 0.45);
        const h = addAtom(hydrogenMat, nahco3P.clone().add(new THREE.Vector3(1.8, -0.6, 0)), 0.28);
        addBond(c.position, oH.position);
        addBond(oH.position, h.position);

        // Right: CH3COOH Acetic Acid
        const acP = new THREE.Vector3(3.4 * (1 - approach), 0, 0);
        const cMeth = addAtom(carbonMat, acP.clone().add(new THREE.Vector3(0.8, 0, 0)), 0.5);
        const cCarb = addAtom(carbonMat, acP.clone().add(new THREE.Vector3(-0.4, 0, 0)), 0.5);
        addBond(cMeth.position, cCarb.position);
        const oAc1 = addAtom(oxygenMat, acP.clone().add(new THREE.Vector3(-0.4, 1.1, 0)), 0.45);
        addDoubleBond(cCarb.position, oAc1.position);
        const oAc2 = addAtom(oxygenMat, acP.clone().add(new THREE.Vector3(-1.2, -0.6, 0)), 0.45);
        const hAc = addAtom(hydrogenMat, acP.clone().add(new THREE.Vector3(-1.8, -0.6, 0)), 0.28);
        addBond(cCarb.position, oAc2.position);
        addBond(oAc2.position, hAc.position);
      } else {
        // Vigorous CO2 effervescence shooting straight upward!
        const co2Pos = new THREE.Vector3(0, 1.2 + 3.2 * sep, 0);
        const c = addAtom(carbonMat, co2Pos, 0.5);
        const oL = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(-1.15, 0, 0)), 0.45);
        const oR = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(1.15, 0, 0)), 0.45);
        addDoubleBond(c.position, oL.position);
        addDoubleBond(c.position, oR.position);

        // Water molecule formed
        const h2oPos = new THREE.Vector3(2.5 * (1 + sep), 0, 0);
        const ox = addAtom(oxygenMat, h2oPos, 0.48);
        const h1 = addAtom(hydrogenMat, h2oPos.clone().add(new THREE.Vector3(0.65, 0.4, 0)), 0.28);
        const h2 = addAtom(hydrogenMat, h2oPos.clone().add(new THREE.Vector3(-0.65, 0.4, 0)), 0.28);
        addBond(ox.position, h1.position);
        addBond(ox.position, h2.position);

        // Sodium Acetate solution in beaker base
        const naPos = new THREE.Vector3(-2.8, -1.5, 0);
        addAtom(sodiumMat, naPos, 0.55);
        const acP = new THREE.Vector3(-1.0, -1.5, 0);
        const c1 = addAtom(carbonMat, acP, 0.5);
        const c2 = addAtom(carbonMat, acP.clone().add(new THREE.Vector3(1.1, 0, 0)), 0.5);
        addBond(c1.position, c2.position);
      }
    }
    // =========================================================================
    // 13. IONIC TRANSFER: Na + Cl -> Na+ + Cl- (ΔH = -411 kJ/mol)
    // =========================================================================
    else if (selectedReaction.id === 'ionic_transfer') {
      if (t < 0.5) {
        // Neutral Sodium Atom (large radius, purple) with 3s valence electron
        const naPos = new THREE.Vector3(-3.2 * (1 - approach), 0, 0);
        addAtom(sodiumMat, naPos, 0.65);
        addHaloRing(naPos, 1.2, 0xa855f7);

        // Glowing valence electron on outer orbital ring
        const ePos = naPos.clone().add(new THREE.Vector3(1.2 * Math.cos(t * Math.PI * 6), 1.2 * Math.sin(t * Math.PI * 6), 0));
        addAtom(electronMat, ePos, 0.16);

        // Neutral Chlorine Atom (green) with 7 valence electrons
        const clPos = new THREE.Vector3(3.2 * (1 - approach), 0, 0);
        addAtom(chlorineMat, clPos, 0.55);
        addHaloRing(clPos, 1.1, 0x22c55e);
      } else {
        // Electron transferred! Ionic pair locked by Coulomb force
        const naPos = new THREE.Vector3(-1.3, 0, 0);
        const clPos = new THREE.Vector3(1.3, 0, 0);

        // Shrunk Na+ cation with positive glowing halo
        addAtom(sodiumMat, naPos, 0.45);
        addHaloRing(naPos, 0.85, 0x38bdf8);

        // Expanded Cl- anion with negative glowing halo
        addAtom(chlorineMat, clPos, 0.65);
        addHaloRing(clPos, 1.05, 0xef4444);

        // Multiple bright Coulomb electrostatic attraction lines between them
        [-0.4, 0, 0.4].forEach((zOff) => {
          addCoulombFieldLine(
            naPos.clone().add(new THREE.Vector3(0, 0.3, zOff)),
            clPos.clone().add(new THREE.Vector3(0, 0.3, zOff)),
            0x38bdf8
          );
          addCoulombFieldLine(
            naPos.clone().add(new THREE.Vector3(0, -0.3, zOff)),
            clPos.clone().add(new THREE.Vector3(0, -0.3, zOff)),
            0x38bdf8
          );
        });
      }
    }
    // =========================================================================
    // 14. ACID-BASE NEUTRALIZATION: HCl + NaOH -> NaCl + H2O + 57 kJ
    // =========================================================================
    else if (selectedReaction.id === 'acid_base_neutralization') {
      if (t < 0.5) {
        // HCl on left: Green Cl bonded to white H
        const hclP = new THREE.Vector3(-3.2 * (1 - approach), 0, 0);
        const cl = addAtom(chlorineMat, hclP, 0.55);
        const h = addAtom(hydrogenMat, hclP.clone().add(new THREE.Vector3(0.9, 0, 0)), 0.3);
        addBond(cl.position, h.position);

        // NaOH on right: Purple Na, Red O, White H
        const naohP = new THREE.Vector3(3.2 * (1 - approach), 0, 0);
        const na = addAtom(sodiumMat, naohP.clone().add(new THREE.Vector3(1.0, 0, 0)), 0.55);
        const ox = addAtom(oxygenMat, naohP.clone().add(new THREE.Vector3(-0.3, 0, 0)), 0.48);
        const hOh = addAtom(hydrogenMat, naohP.clone().add(new THREE.Vector3(-1.0, 0, 0)), 0.28);
        addBond(na.position, ox.position, 0.05);
        addBond(ox.position, hOh.position);
      } else {
        // Neutral Water H2O formed in center (104.5 deg bent)
        const ox = addAtom(oxygenMat, new THREE.Vector3(0, 0, 0), 0.5);
        const h1 = addAtom(hydrogenMat, new THREE.Vector3(-0.7, 0.42, 0), 0.3);
        const h2 = addAtom(hydrogenMat, new THREE.Vector3(0.7, 0.42, 0), 0.3);
        addBond(ox.position, h1.position, 0.09);
        addBond(ox.position, h2.position, 0.09);

        // Dissociated hydrated spectator ions Na+ and Cl-
        const naPos = new THREE.Vector3(-3.0 * (1 + sep * 0.5), -1.2, 0);
        addAtom(sodiumMat, naPos, 0.52);
        addHaloRing(naPos, 0.85, 0x38bdf8);

        const clPos = new THREE.Vector3(3.0 * (1 + sep * 0.5), -1.2, 0);
        addAtom(chlorineMat, clPos, 0.58);
        addHaloRing(clPos, 0.95, 0x22c55e);
      }
    }
    // =========================================================================
    // 15. NUCLEAR FISSION: Uranium-235 Thermal Neutron Induced Fission
    // =========================================================================
    else if (selectedReaction.id === 'uranium_fission' || selectedReaction.id === 'plutonium_fission') {
      const isPlutonium = selectedReaction.id === 'plutonium_fission';
      const coreMat = isPlutonium ? plutoniumCoreMat : uraniumMat;
      const frag1Mat = isPlutonium ? xenonFragMat : bariumMat; // Xe or Ba
      const frag2Mat = isPlutonium ? zirconiumFragMat : kryptonMat; // Zr or Kr

      if (t < 0.45) {
        // Heavy compound nucleus at center
        const nucleusPos = new THREE.Vector3(0, 0, 0);
        const osc = t > 0.2 ? Math.sin(t * 30) * 0.15 : 0;
        const mainNucleus = addAtom(coreMat, nucleusPos, 1.35 + osc);

        // Clustered surface nucleons (protons & neutrons) on heavy nucleus
        const nucleonAngles = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6];
        nucleonAngles.forEach((ang, idx) => {
          const r = 1.32;
          const pos = new THREE.Vector3(r * Math.cos(ang), r * Math.sin(ang) * 0.7, r * Math.sin(ang) * 0.7);
          addAtom(idx % 2 === 0 ? protonMat : neutronMat, pos, 0.32);
        });

        // Incoming thermal neutron accelerating toward center
        const nPos = new THREE.Vector3(-5.5 * (1 - approach), 0, 0);
        addAtom(neutronMat, nPos, 0.26);
        addHaloRing(nPos, 0.55, 0x38bdf8);
      } else if (t >= 0.45 && t < 0.62) {
        // Liquid-Drop Model Deformation: Elongation into dumbbell with necking
        const elongation = (t - 0.45) / 0.17;
        const leftLobePos = new THREE.Vector3(-1.2 * elongation, 0, 0);
        const rightLobePos = new THREE.Vector3(1.2 * elongation, 0, 0);
        addAtom(frag1Mat, leftLobePos, 1.05 - elongation * 0.15);
        addAtom(frag2Mat, rightLobePos, 0.95 - elongation * 0.15);

        // Connecting nuclear neck undergoing scission (uses pooled cylinder)
        addBond(leftLobePos, rightLobePos, 0.55 * (1 - elongation * 0.7), coreMat);

        // High-energy fission gamma excitation glow
        addHaloRing(new THREE.Vector3(0, 0, 0), 2.2 + elongation * 1.5, 0xfacc15);
      } else {
        // Nuclear Scission Complete: High kinetic recoil fragments & 3 prompt fast neutrons
        const f1Pos = new THREE.Vector3(-3.2 * (1 + sep * 1.2), 1.8 * (1 + sep * 0.8), 0);
        const f2Pos = new THREE.Vector3(3.2 * (1 + sep * 1.2), -1.8 * (1 + sep * 0.8), 0);
        addAtom(frag1Mat, f1Pos, 1.0); // ¹⁴¹Ba or ¹³⁴Xe
        addHaloRing(f1Pos, 1.4, 0x06b6d4);

        addAtom(frag2Mat, f2Pos, 0.88); // ⁹²Kr or ¹⁰³Zr
        addHaloRing(f2Pos, 1.2, 0xa855f7);

        // 3 Prompt Fast Neutrons ejected radially (boil-off at 2 MeV each)
        const n1Pos = new THREE.Vector3(0, 4.2 * (1 + sep * 1.4), 0);
        const n2Pos = new THREE.Vector3(-1.8 * (1 + sep * 1.4), -3.6 * (1 + sep * 1.4), 1.5 * (1 + sep));
        const n3Pos = new THREE.Vector3(2.5 * (1 + sep * 1.4), -3.2 * (1 + sep * 1.4), -1.5 * (1 + sep));

        [n1Pos, n2Pos, n3Pos].forEach((np) => {
          addAtom(neutronMat, np, 0.22);
          addHaloRing(np, 0.45, 0x38bdf8);
        });

        // Expanding 200 MeV blast shockwave ring
        addHaloRing(new THREE.Vector3(0, 0, 0), 1.5 + sep * 5.0, 0xffffff);
      }
    }
    // =========================================================================
    // 16. NUCLEAR FUSION: Deuterium-Tritium (D-T) & D-D Thermonuclear Fusion
    // =========================================================================
    else if (selectedReaction.id === 'dt_fusion' || selectedReaction.id === 'dd_fusion') {
      const isDT = selectedReaction.id === 'dt_fusion';

      // Tokamak magnetic confinement field loops
      assets.tokamakMeshes[0].visible = true;
      assets.tokamakMeshes[1].visible = true;
      assets.tokamakMeshes[2].visible = true;

      if (t < 0.48) {
        // Left: Deuterium Nucleus (1 proton + 1 neutron) approaching
        const dPos = new THREE.Vector3(-4.2 * (1 - approach), 0, 0);
        const dp = addAtom(protonMat, dPos.clone().add(new THREE.Vector3(-0.35, 0, 0)), 0.38);
        const dn = addAtom(neutronMat, dPos.clone().add(new THREE.Vector3(0.35, 0, 0)), 0.38);
        addBond(dp.position, dn.position, 0.12);
        addHaloRing(dPos, 0.9, 0x3b82f6);

        // Right: Tritium Nucleus (1 proton + 2 neutrons in triangle) or Deuterium
        const tPos = new THREE.Vector3(4.2 * (1 - approach), 0, 0);
        const tp = addAtom(protonMat, tPos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0.38);
        const tn1 = addAtom(neutronMat, tPos.clone().add(new THREE.Vector3(-0.35, -0.25, 0)), 0.38);
        addBond(tp.position, tn1.position, 0.12);
        if (isDT) {
          const tn2 = addAtom(neutronMat, tPos.clone().add(new THREE.Vector3(0.35, -0.25, 0)), 0.38);
          addBond(tp.position, tn2.position, 0.12);
          addBond(tn1.position, tn2.position, 0.12);
        }
        addHaloRing(tPos, 0.9, 0xf43f5e);

        // Coulomb electrostatic repulsion barrier between approaching positive nuclei
        const barrierDist = dPos.distanceTo(tPos);
        if (barrierDist < 3.0) {
          addHaloRing(new THREE.Vector3(0, 0, 0), barrierDist * 0.5, 0xf59e0b);
        }
      } else if (t >= 0.48 && t < 0.62) {
        // Quantum Tunneling & Thermonuclear Fusion Burst (⁵He* or ⁴He* compound)
        const burstRadius = 1.2 + Math.sin(t * 40) * 0.3;
        addAtom(alphaMat, new THREE.Vector3(0, 0, 0), burstRadius);
        addHaloRing(new THREE.Vector3(0, 0, 0), 2.5, 0xffffff);
        addHaloRing(new THREE.Vector3(0, 0, 0), 3.5, 0xfbbf24);
      } else {
        // Ejected Alpha Particle (⁴He) departing left at 3.5 MeV
        const alphaPos = new THREE.Vector3(-3.5 * (1 + sep * 1.3), 0, 0);
        const a1 = addAtom(protonMat, alphaPos.clone().add(new THREE.Vector3(-0.35, 0.35, 0)), 0.38);
        const a2 = addAtom(protonMat, alphaPos.clone().add(new THREE.Vector3(0.35, -0.35, 0)), 0.38);
        const a3 = addAtom(neutronMat, alphaPos.clone().add(new THREE.Vector3(0.35, 0.35, 0)), 0.38);
        const a4 = addAtom(isDT ? neutronMat : protonMat, alphaPos.clone().add(new THREE.Vector3(-0.35, -0.35, 0)), 0.38);
        addBond(a1.position, a3.position, 0.1);
        addBond(a2.position, a4.position, 0.1);
        addBond(a1.position, a4.position, 0.1);
        addBond(a2.position, a3.position, 0.1);
        addHaloRing(alphaPos, 1.2, 0xf59e0b);

        // Energetic Prompt Neutron (14.1 MeV) rocketing right at high velocity
        const nPos = new THREE.Vector3(5.2 * (1 + sep * 1.5), 0, 0);
        addAtom(neutronMat, nPos, 0.28);
        addHaloRing(nPos, 0.6, 0x38bdf8);

        // Thermonuclear photon energy flash rings
        addHaloRing(new THREE.Vector3(0, 0, 0), 1.0 + sep * 4.5, 0xf43f5e);
      }
    }
    // =========================================================================
    // 17. NUCLEAR FUSION: Solar Core Proton-Proton Chain
    // =========================================================================
    else if (selectedReaction.id === 'proton_proton_fusion') {
      if (t < 0.5) {
        // Four protons converging inward from tetrahedral vertices
        const pCoords = [
          new THREE.Vector3(-3.2 * (1 - approach), 1.8 * (1 - approach), 0),
          new THREE.Vector3(3.2 * (1 - approach), 1.8 * (1 - approach), 0),
          new THREE.Vector3(-1.8 * (1 - approach), -2.4 * (1 - approach), 1.5 * (1 - approach)),
          new THREE.Vector3(1.8 * (1 - approach), -2.4 * (1 - approach), -1.5 * (1 - approach)),
        ];
        pCoords.forEach((p) => {
          addAtom(protonMat, p, 0.42);
          addHaloRing(p, 0.75, 0xef4444);
        });
      } else {
        // Central Helium-4 Alpha Nucleus formed
        const heCenter = new THREE.Vector3(0, 0, 0);
        const h1 = addAtom(protonMat, heCenter.clone().add(new THREE.Vector3(-0.32, 0.32, 0.32)), 0.36);
        const h2 = addAtom(protonMat, heCenter.clone().add(new THREE.Vector3(0.32, -0.32, 0.32)), 0.36);
        const h3 = addAtom(neutronMat, heCenter.clone().add(new THREE.Vector3(0.32, 0.32, -0.32)), 0.36);
        const h4 = addAtom(neutronMat, heCenter.clone().add(new THREE.Vector3(-0.32, -0.32, -0.32)), 0.36);
        addBond(h1.position, h2.position, 0.08);
        addBond(h3.position, h4.position, 0.08);
        addBond(h1.position, h3.position, 0.08);
        addBond(h2.position, h4.position, 0.08);
        addHaloRing(heCenter, 1.4, 0xf59e0b);

        // Positrons (e+) and neutrinos (v) flying outward into space
        const pos1 = new THREE.Vector3(-3.8 * (1 + sep), 2.2 * (1 + sep), 0);
        const pos2 = new THREE.Vector3(3.8 * (1 + sep), -2.2 * (1 + sep), 0);
        addAtom(electronMat, pos1, 0.18);
        addHaloRing(pos1, 0.45, 0x38bdf8);
        addAtom(electronMat, pos2, 0.18);
        addHaloRing(pos2, 0.45, 0x38bdf8);

        // Solar radiation gamma photon burst
        addHaloRing(heCenter, 1.8 + sep * 3.5, 0xfde047);
      }
    }
    // =========================================================================
    // 18. PRECIPITATION: Lead(II) Iodide ("Golden Rain")
    // =========================================================================
    else if (selectedReaction.id === 'lead_iodide_precipitation') {
      if (t < 0.5) {
        // Hydrated Pb2+ ion in center (lead grey)
        const pbPos = new THREE.Vector3(-2.8 * (1 - approach), 0, 0);
        addAtom(leadMat, pbPos, 0.65);
        addHaloRing(pbPos, 1.1, 0x94a3b8);

        // Two I- iodide ions approaching from opposite angles (bright yellow-amber)
        const i1Pos = new THREE.Vector3(3.2 * (1 - approach), 1.6 * (1 - approach), 0);
        const i2Pos = new THREE.Vector3(3.2 * (1 - approach), -1.6 * (1 - approach), 0);
        addAtom(iodineMat, i1Pos, 0.58);
        addHaloRing(i1Pos, 0.95, 0xeab308);
        addAtom(iodineMat, i2Pos, 0.58);
        addHaloRing(i2Pos, 0.95, 0xeab308);
      } else {
        // Hexagonal crystalline PbI2 platelet lattice forming & settling downward
        const crystalY = -1.5 - sep * 1.5;
        const crystalCenter = new THREE.Vector3(0, crystalY, 0);

        // Center lead atom
        const pb = addAtom(leadMat, crystalCenter, 0.62);

        // Six iodide atoms arranged in hexagonal coordination ring
        const angles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];
        angles.forEach((ang) => {
          const ip = crystalCenter.clone().add(new THREE.Vector3(1.4 * Math.cos(ang), 0.3 * Math.sin(ang), 1.4 * Math.sin(ang)));
          const iAtom = addAtom(iodineMat, ip, 0.52);
          addBond(pb.position, iAtom.position, 0.08);
        });

        // Golden rain flakes: sparkling yellow platelet crystals drifting downward
        const flakePositions = [
          new THREE.Vector3(-2.2, 1.5 - sep * 2.8, 1.2),
          new THREE.Vector3(2.4, 2.0 - sep * 3.2, -0.8),
          new THREE.Vector3(-1.4, 2.8 - sep * 3.5, -1.5),
          new THREE.Vector3(1.8, 0.8 - sep * 2.5, 1.8),
          new THREE.Vector3(-3.0, -0.2 - sep * 2.0, -0.5),
          new THREE.Vector3(2.8, -0.5 - sep * 2.2, 0.7),
        ];
        flakePositions.forEach((fp) => {
          const flake = addAtom(iodineMat, fp, 0.22);
          addHaloRing(flake.position, 0.4, 0xfde047);
        });

        // Clear spectator potassium and nitrate ions floating above
        const kPos = new THREE.Vector3(-2.5, 2.5, 0);
        addAtom(sodiumMat, kPos, 0.48);
        addHaloRing(kPos, 0.8, 0xa855f7);
      }
    }
    // =========================================================================
    // 19. PRECIPITATION: Silver Chloride & Copper Hydroxide
    // =========================================================================
    else if (selectedReaction.id === 'silver_chloride_precipitation' || selectedReaction.id === 'copper_hydroxide_precipitation') {
      const isAgCl = selectedReaction.id === 'silver_chloride_precipitation';
      const cationMat = isAgCl ? silverMat : cuCationMat;
      const anionMat = isAgCl ? chlorineMat : oxygenMat;

      if (t < 0.5) {
        const catPos = new THREE.Vector3(-3.2 * (1 - approach), 0, 0);
        addAtom(cationMat, catPos, 0.6);
        addHaloRing(catPos, 1.0, isAgCl ? 0xe2e8f0 : 0x0284c7);

        const anPos = new THREE.Vector3(3.2 * (1 - approach), 0, 0);
        addAtom(anionMat, anPos, 0.55);
        addHaloRing(anPos, 0.95, isAgCl ? 0x22c55e : 0xef4444);
      } else {
        // Dense crystalline precipitate block settling downward
        const precY = -1.4 - sep * 1.2;
        [-0.8, 0.8].forEach((x) => {
          [-0.8, 0.8].forEach((yOff) => {
            const isCat = (x > 0 && yOff > 0) || (x < 0 && yOff < 0);
            const p = new THREE.Vector3(x, precY + yOff * 0.7, 0);
            addAtom(isCat ? cationMat : anionMat, p, 0.48);
          });
        });

        // Lattice bonds forming the curdy solid
        addBond(new THREE.Vector3(-0.8, precY + 0.56, 0), new THREE.Vector3(0.8, precY + 0.56, 0), 0.08);
        addBond(new THREE.Vector3(-0.8, precY - 0.56, 0), new THREE.Vector3(0.8, precY - 0.56, 0), 0.08);
        addBond(new THREE.Vector3(-0.8, precY + 0.56, 0), new THREE.Vector3(-0.8, precY - 0.56, 0), 0.08);
        addBond(new THREE.Vector3(0.8, precY + 0.56, 0), new THREE.Vector3(0.8, precY - 0.56, 0), 0.08);

        // Curdy flocculant clouds
        addHaloRing(new THREE.Vector3(0, precY, 0), 1.6, isAgCl ? 0xffffff : 0x0284c7);
      }
    }
    // =========================================================================
    // 20. SINGLE DISPLACEMENT: Zinc in Copper(II) Sulfate
    // =========================================================================
    else if (selectedReaction.id === 'zinc_copper_displacement') {
      // Solid Zinc metal plate on the left
      assets.znPlateMesh.visible = true;

      if (t < 0.5) {
        // Deep blue hydrated Cu2+ ion approaching zinc surface
        const cuPos = new THREE.Vector3(3.2 * (1 - approach), 0, 0);
        addAtom(copperMat, cuPos, 0.62);
        addHaloRing(cuPos, 1.2, 0x0284c7); // Deep blue hydration shell
      } else {
        // Two-electron transfer interface flash
        [-0.6, 0, 0.6].forEach((y) => {
          addCoulombFieldLine(new THREE.Vector3(-3.0, y, 0), new THREE.Vector3(-1.5, y, 0), 0xfde047);
        });

        // Reduced metallic reddish copper crystals plating onto the zinc strip
        const cuDeposits = [
          new THREE.Vector3(-2.8, 1.0, 0.4),
          new THREE.Vector3(-2.8, -0.6, -0.3),
          new THREE.Vector3(-2.8, 0.2, 0.2),
          new THREE.Vector3(-2.8, -1.2, 0.1),
        ];
        cuDeposits.forEach((cp) => {
          addAtom(copperMat, cp, 0.42);
        });

        // Dissolved colorless Zn2+ ions diffusing away into clear solution
        const znIonPos = new THREE.Vector3(2.5 * (1 + sep * 0.8), 0.5, 0);
        addAtom(zincMat, znIonPos, 0.45);
        addHaloRing(znIonPos, 0.85, 0x94a3b8);
      }
    }
    // =========================================================================
    // 21. REDOX: Sodium in Water
    // =========================================================================
    else if (selectedReaction.id === 'sodium_water_reaction') {
      if (t < 0.5) {
        // Silvery sodium metal sphere above water plane
        const naPos = new THREE.Vector3(0, 2.8 * (1 - approach), 0);
        addAtom(sodiumMat, naPos, 0.7);
        addHaloRing(naPos, 1.1, 0xa855f7);

        // Water surface plane at y = 0
        assets.waterMesh.visible = true;
      } else {
        // Molten sodium sphere skittering on water surface with exothermic sparks
        const naPos = new THREE.Vector3(Math.cos(t * 15) * 1.5, 0.2, Math.sin(t * 15) * 1.0);
        addAtom(sodiumMat, naPos, 0.55);
        addHaloRing(naPos, 0.9, 0xf59e0b); // Orange reaction spark glow

        // Bubbling hydrogen gas bubbles rising upward
        const bubbleY = 1.0 + sep * 3.5;
        const h2a = addAtom(hydrogenMat, new THREE.Vector3(-1.0, bubbleY, 0.3), 0.28);
        const h2b = addAtom(hydrogenMat, new THREE.Vector3(-1.0 + 0.45, bubbleY, 0.3), 0.28);
        addBond(h2a.position, h2b.position, 0.08);

        // Dissolved alkaline OH- and Na+ in solution below
        const naIon = addAtom(sodiumMat, new THREE.Vector3(1.2, -1.8, 0), 0.48);
        addHaloRing(naIon.position, 0.8, 0x38bdf8);
        const ohIon = addAtom(oxygenMat, new THREE.Vector3(-1.2, -1.8, 0), 0.45);
        const ohH = addAtom(hydrogenMat, new THREE.Vector3(-1.2 + 0.6, -1.8, 0), 0.28);
        addBond(ohIon.position, ohH.position);
      }
    }
    // =========================================================================
    // 22. PRECIPITATION: Limewater Test (CaCO3 formation)
    // =========================================================================
    else if (selectedReaction.id === 'limewater_carbonation') {
      if (t < 0.5) {
        // Clear Ca(OH)2 solution species
        const caPos = new THREE.Vector3(-2.8 * (1 - approach), 0, 0);
        addAtom(calciumMat, caPos, 0.62);

        // Incoming linear CO2 molecule
        const co2Pos = new THREE.Vector3(3.2 * (1 - approach), 0, 0);
        const c = addAtom(carbonMat, co2Pos, 0.48);
        const o1 = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(-1.1, 0, 0)), 0.42);
        const o2 = addAtom(oxygenMat, co2Pos.clone().add(new THREE.Vector3(1.1, 0, 0)), 0.42);
        addDoubleBond(c.position, o1.position);
        addDoubleBond(c.position, o2.position);
      } else {
        // Insoluble white CaCO3 precipitate creating milky suspension
        const caco3Pos = new THREE.Vector3(0, -1.2, 0);
        const ca = addAtom(calciumMat, caco3Pos.clone().add(new THREE.Vector3(-0.9, 0, 0)), 0.6);
        const c = addAtom(carbonMat, caco3Pos.clone().add(new THREE.Vector3(0.5, 0, 0)), 0.48);
        const o1 = addAtom(oxygenMat, caco3Pos.clone().add(new THREE.Vector3(0.5, 0.9, 0)), 0.42);
        const o2 = addAtom(oxygenMat, caco3Pos.clone().add(new THREE.Vector3(1.2, -0.6, 0)), 0.42);
        addDoubleBond(c.position, o1.position);
        addBond(c.position, o2.position);
        addBond(ca.position, o2.position, 0.06);

        // Milky turbidity white haze rings
        addHaloRing(new THREE.Vector3(0, -1.0, 0), 1.8 + sep * 0.5, 0xffffff);
        addHaloRing(new THREE.Vector3(0, 0.5, 0), 2.2 + sep * 0.5, 0xffffff);
      }
    }
    // =========================================================================
    // 23. DECOMPOSITION: Potassium Chlorate Thermal Decomposition
    // =========================================================================
    else if (selectedReaction.id === 'potassium_chlorate_decomposition') {
      if (t < 0.5) {
        // KClO3 crystal unit
        const kPos = new THREE.Vector3(-1.5 * (1 - approach), 0, 0);
        addAtom(sodiumMat, kPos, 0.58);
        const clPos = new THREE.Vector3(1.0 * (1 - approach), 0, 0);
        const cl = addAtom(chlorineMat, clPos, 0.52);
        const o1 = addAtom(oxygenMat, clPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 0.42);
        const o2 = addAtom(oxygenMat, clPos.clone().add(new THREE.Vector3(0.9, -0.5, 0)), 0.42);
        addDoubleBond(cl.position, o1.position);
        addDoubleBond(cl.position, o2.position);
      } else {
        // KCl solid salt residue at base
        const k = addAtom(sodiumMat, new THREE.Vector3(-0.8, -2.0, 0), 0.58);
        const cl = addAtom(chlorineMat, new THREE.Vector3(0.8, -2.0, 0), 0.52);
        addBond(k.position, cl.position, 0.08);

        // Three O2 gas molecules rapidly bubbling upward
        [-2.0, 0, 2.0].forEach((x, i) => {
          const o2P = new THREE.Vector3(x, 1.0 + 3.2 * sep + i * 0.5, 0);
          const oA = addAtom(oxygenMat, o2P.clone().add(new THREE.Vector3(-0.45, 0, 0)), 0.42);
          const oB = addAtom(oxygenMat, o2P.clone().add(new THREE.Vector3(0.45, 0, 0)), 0.42);
          addDoubleBond(oA.position, oB.position);
        });
      }
    }
    // =========================================================================
    // 24. REDOX: Iron Rusting (Fe + O2 + H2O -> Rust)
    // =========================================================================
    else if (selectedReaction.id === 'iron_rusting') {
      if (t < 0.5) {
        // Clean metallic iron lattice on left
        [-1.2, 0, 1.2].forEach((y) => {
          addAtom(ironMat, new THREE.Vector3(-3.2 * (1 - approach), y, 0), 0.55);
        });

        // O2 and H2O moisture approaching
        const o2Pos = new THREE.Vector3(3.2 * (1 - approach), 1.2, 0);
        const o1 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(-0.45, 0, 0)), 0.42);
        const o2 = addAtom(oxygenMat, o2Pos.clone().add(new THREE.Vector3(0.45, 0, 0)), 0.42);
        addDoubleBond(o1.position, o2.position);

        const h2oPos = new THREE.Vector3(3.2 * (1 - approach), -1.2, 0);
        const ox = addAtom(oxygenMat, h2oPos, 0.45);
        const hA = addAtom(hydrogenMat, h2oPos.clone().add(new THREE.Vector3(0.6, 0.35, 0)), 0.28);
        const hB = addAtom(hydrogenMat, h2oPos.clone().add(new THREE.Vector3(-0.6, 0.35, 0)), 0.28);
        addBond(ox.position, hA.position);
        addBond(ox.position, hB.position);
      } else {
        // Flaky reddish-brown rust lattice (Fe2O3·3H2O)
        [-1.5, 0, 1.5].forEach((x, i) => {
          const fe = addAtom(rustMat, new THREE.Vector3(x, 0, (i - 1) * 0.8), 0.6);
          const ox = addAtom(oxygenMat, new THREE.Vector3(x, 1.0, (i - 1) * 0.8), 0.42);
          addBond(fe.position, ox.position, 0.1);
        });
        addHaloRing(new THREE.Vector3(0, 0, 0), 2.2, 0x9a3412);
      }
    }
    // =========================================================================
    // GENERAL FALLBACK FOR FUTURE REACTIONS
    // =========================================================================
    else {
      if (t < 0.5) {
        const r1 = addAtom(carbonMat, new THREE.Vector3(-3.2 * (1 - approach), 0, 0), 0.55);
        const r2 = addAtom(oxygenMat, new THREE.Vector3(-3.2 * (1 - approach) + 1.1, 0, 0), 0.48);
        addBond(r1.position, r2.position);

        const r3 = addAtom(nitrogenMat, new THREE.Vector3(3.2 * (1 - approach), 0, 0), 0.52);
        const r4 = addAtom(hydrogenMat, new THREE.Vector3(3.2 * (1 - approach) - 0.9, 0, 0), 0.28);
        addBond(r3.position, r4.position);
      } else {
        const p1 = addAtom(carbonMat, new THREE.Vector3(-2.2 * (1 + sep), 1.2 * (1 + sep), 0), 0.55);
        const p2 = addAtom(hydrogenMat, new THREE.Vector3(-2.2 * (1 + sep) - 0.8, 1.2 * (1 + sep), 0), 0.28);
        addBond(p1.position, p2.position);

        const p3 = addAtom(nitrogenMat, new THREE.Vector3(2.2 * (1 + sep), -1.2 * (1 + sep), 0), 0.52);
        const p4 = addAtom(oxygenMat, new THREE.Vector3(2.2 * (1 + sep) + 1.0, -1.2 * (1 + sep), 0), 0.48);
        addBond(p3.position, p4.position);
      }
    }

    // Hide any unused pool slots cleanly with zero allocations or removals
    for (let i = sIdx; i < assets.spherePool.length; i++) assets.spherePool[i].visible = false;
    for (let i = cIdx; i < assets.cylPool.length; i++) assets.cylPool[i].visible = false;
    for (let i = rIdx; i < assets.ringPool.length; i++) assets.ringPool[i].visible = false;
    for (let i = lIdx; i < assets.linePool.length; i++) assets.linePool[i].visible = false;
  };

  // Trigger immediate 3D update when paused/scrubbed/switched or kinetic parameters change
  useEffect(() => {
    sceneDirtyRef.current = true;
    if (!isPlayingRef.current) {
      renderReactionMoleculesRef.current?.(selectedReaction, kineticExtent, temperatureK, hasCatalyst);
      sceneDirtyRef.current = false;
    }
  }, [selectedReaction, kineticExtent, temperatureK, hasCatalyst, sceneReady]);

  // Current stage description driven by kinetic extent
  const currentStage = useMemo(() => {
    if (kineticExtent >= 0.99) {
      return {
        progress: 1.0,
        title: 'Reaction Complete (Products Formed)',
        stateName: 'Final Products',
        description: `Reaction finished! Reactants converted into ${selectedReaction.products
          .map((p) => `${p.count > 1 ? `${p.count} ` : ''}${p.formula} (${p.name})`)
          .join(', ')} at ${temperatureK} K${hasCatalyst ? ' (Catalyzed)' : ''}.`,
      };
    }
    return (
      selectedReaction.stages.find((s, idx) => {
        const next = selectedReaction.stages[idx + 1];
        if (!next) return true;
        return kineticExtent <= next.progress;
      }) || selectedReaction.stages[0]
    );
  }, [selectedReaction, kineticExtent, temperatureK, hasCatalyst]);

  // Live chemical formula & phase state synchronized with 3D atomic rearrangement
  const liveFormulaState = useMemo(() => {
    const isNuclear =
      selectedReaction.type === 'nuclear_fission' || selectedReaction.type === 'nuclear_fusion';
    const tStart = isNuclear ? 0.44 : 0.40;
    const tEnd = isNuclear ? 0.62 : 0.58;

    const reactantsText = selectedReaction.reactants
      .map((r) => `${r.count > 1 ? `${r.count} ` : ''}${r.formula}`)
      .join(' + ');
    const productsText = selectedReaction.products
      .map((p) => `${p.count > 1 ? `${p.count} ` : ''}${p.formula}`)
      .join(' + ');

    const phase: 'reactants' | 'transition' | 'products' =
      kineticExtent < tStart
        ? 'reactants'
        : kineticExtent < tEnd
        ? 'transition'
        : 'products';

    const arrowSymbol = kineticSimulation.isReversible ? '⇌' : '⟶';
    const pctConverted = Math.round(kineticExtent * 100);
    const pctRemaining = Math.max(0, 100 - pctConverted);

    let phaseTitle = 'Reactants Approaching';
    if (phase === 'transition') {
      phaseTitle = hasCatalyst ? 'Catalyzed Rearrangement [‡]' : 'Atomic Rearrangement [‡]';
    } else if (phase === 'products') {
      phaseTitle =
        kineticExtent >= 0.98
          ? kineticSimulation.isReversible
            ? 'Equilibrium Products Formed'
            : 'New Products Formed'
          : 'Molecules Separating into Products';
    }

    return {
      phase,
      phaseTitle,
      reactantsText,
      productsText,
      arrowSymbol,
      pctConverted,
      pctRemaining,
      isNuclear,
    };
  }, [selectedReaction, kineticExtent, kineticSimulation.isReversible, hasCatalyst]);

  const syncPlaybackOnKineticChange = () => {
    if (progress >= 0.999 || (progress === 0 && !isPlaying)) {
      setSyncedProgress(0);
      setIsPlaying(true);
      setCompletedBannerDismissed(false);
      completionSoundFiredRef.current = false;
    }
  };

  const handleTemperatureChange = (nextTempK: number) => {
    setTemperatureK(nextTempK);
    syncPlaybackOnKineticChange();
  };

  const handleToggleCatalyst = () => {
    setHasCatalyst((prev) => !prev);
    syncPlaybackOnKineticChange();
    soundFx.playReactionStep();
  };

  const handleOrderModeChange = (nextOrder: KineticOrderMode) => {
    setOrderMode(nextOrder);
    syncPlaybackOnKineticChange();
    soundFx.playReactionStep();
  };

  const handleSelectReaction = (rx: ChemicalReaction) => {
    setSelectedReaction(rx);
    setSyncedProgress(0);
    setIsPlaying(true);
    setCompletedBannerDismissed(false);
    completionSoundFiredRef.current = false;
    soundFx.playReactionStep();
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 4, 15);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handleTogglePlay = () => {
    if (progress >= 0.999) {
      // Replay continuous from start
      setSyncedProgress(0);
      setIsPlaying(true);
      setCompletedBannerDismissed(false);
      completionSoundFiredRef.current = false;
      soundFx.playReactionStep();
    } else {
      setIsPlaying(!isPlaying);
      soundFx.playReactionStep();
    }
  };

  const handleRestart = () => {
    setSyncedProgress(0);
    setIsPlaying(true);
    setCompletedBannerDismissed(false);
    completionSoundFiredRef.current = false;
    soundFx.playReactionStep();
  };

  const handleReplay = () => {
    setSyncedProgress(0);
    setIsPlaying(true);
    setCompletedBannerDismissed(false);
    completionSoundFiredRef.current = false;
    soundFx.playReactionStep();
  };

  const handleNextReaction = () => {
    const currentIndex = REACTIONS.findIndex((r) => r.id === selectedReaction.id);
    const nextIndex = (currentIndex + 1) % REACTIONS.length;
    handleSelectReaction(REACTIONS[nextIndex]);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-slate-950 text-slate-100">
      {/* 3D Canvas Viewport */}
      <div ref={containerRef} className="relative flex-1 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing outline-none" />

        {/* Reaction Complete Showcase Banner (Appears when progress reaches 100%) */}
        {progress >= 0.999 && !completedBannerDismissed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-lg animate-in fade-in zoom-in-95 duration-300 pointer-events-auto">
            <div className="bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-950/60 text-slate-100 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-sm">
                        {kineticSimulation.isReversible
                          ? `Equilibrium Reached (${Math.round(kineticExtent * 100)}% Yield)`
                          : kineticExtent >= 0.95
                          ? `Reaction Complete (${Math.round(kineticExtent * 100)}% Converted)`
                          : `20s Kinetic Run Ended (${Math.round(kineticExtent * 100)}% Converted)`}
                      </h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                        {selectedReaction.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {temperatureK} K · {kineticSimulation.rateLawLabel}
                      {hasCatalyst ? ' · Catalyzed' : ''} · t = {kineticSnapshot.timeSec.toFixed(1)}s
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCompletedBannerDismissed(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Dismiss banner to inspect 3D molecular structure"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reaction Balanced Equation & Products Summary */}
              <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 flex flex-col gap-1.5">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Balanced Chemical Equation:</span>
                  <span className="text-emerald-400 font-mono text-[10px] font-bold">
                    Conversion: {Math.round(kineticExtent * 100)}%
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 leading-relaxed">
                  <FormattedChemText text={selectedReaction.equation} />
                </div>

                {/* Final Products Formed Badges */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-medium">Final Products Formed:</span>
                  {selectedReaction.products.map((p, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>
                        {p.count > 1 ? `${p.count} ` : ''}
                        <FormattedChemText text={p.formula} />
                      </span>
                      <span className="text-[9px] font-normal text-slate-400">({p.name})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Thermodynamic Outcome Grid */}
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                  <span className="text-slate-400 text-[9px]">Enthalpy ΔH</span>
                  <span className={`text-xs font-bold ${selectedReaction.isExothermic ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {formatEnergy(selectedReaction.enthalpyDeltaH)}
                  </span>
                  <span className="text-[8px] text-slate-500 truncate">
                    {selectedReaction.isExothermic ? 'Heat released' : 'Heat absorbed'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                  <span className="text-slate-400 text-[9px]">Entropy ΔS</span>
                  <span className={`text-xs font-bold ${selectedReaction.entropyDeltaS > 0 ? 'text-emerald-400' : 'text-indigo-300'}`}>
                    {selectedReaction.entropyDeltaS > 0 ? `+${selectedReaction.entropyDeltaS}` : selectedReaction.entropyDeltaS} J/K
                  </span>
                  <span className="text-[8px] text-slate-500 truncate">
                    {selectedReaction.entropyDeltaS > 0 ? 'Disorder increases' : 'Order increases'}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                  <span className="text-slate-400 text-[9px]">Gibbs ΔG°</span>
                  <span className={`text-xs font-bold ${(selectedReaction.gibbsFreeEnergyDeltaG ?? 0) < 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {selectedReaction.gibbsFreeEnergyDeltaG !== undefined ? formatEnergy(selectedReaction.gibbsFreeEnergyDeltaG) : '--'}
                  </span>
                  <span className="text-[8px] text-slate-500 truncate">
                    {(selectedReaction.gibbsFreeEnergyDeltaG ?? 0) < 0 ? 'Spontaneous' : 'Non-spontaneous'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <button
                  onClick={() => setCompletedBannerDismissed(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
                >
                  Inspect 3D Products 🔬
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReplay}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Replay Reaction ↺
                  </button>

                  <button
                    onClick={handleNextReaction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    Next Reaction
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Minimized Reaction Complete Pill (when user dismisses banner to orbit 3D products) */}
        {progress >= 0.999 && completedBannerDismissed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in pointer-events-auto">
            <button
              onClick={() => setCompletedBannerDismissed(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500 text-emerald-300 hover:bg-slate-800 text-xs font-bold shadow-lg transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {kineticSimulation.isReversible
                  ? `Equilibrium (${Math.round(kineticExtent * 100)}%)`
                  : `Kinetic Run (${Math.round(kineticExtent * 100)}%)`}
              </span>
              <span className="text-[10px] text-slate-400 underline">Show Summary</span>
            </button>
          </div>
        )}

        {/* Live Dynamic Chemical Formula Display directly above the 3D molecules */}
        {!(progress >= 0.999 && !completedBannerDismissed) && (
          <div
            className={`hidden sm:flex absolute left-1/2 -translate-x-1/2 z-10 pointer-events-auto transition-all duration-200 ${
              progress >= 0.999 && completedBannerDismissed
                ? 'top-16'
                : 'top-20 xl:top-4'
            }`}
          >
            <div
              className={`bg-slate-900/95 border rounded-2xl px-4 py-2.5 shadow-2xl flex flex-col items-center gap-1.5 min-w-[290px] max-w-[430px] transition-colors ${
                liveFormulaState.phase === 'reactants'
                  ? 'border-sky-500/40'
                  : liveFormulaState.phase === 'transition'
                  ? hasCatalyst
                    ? 'border-emerald-400/60'
                    : 'border-amber-400/65'
                  : 'border-emerald-500/55'
              }`}
            >
              {/* Phase Badge & State Label */}
              <div className="w-full flex items-center justify-between gap-3 text-[10px] font-mono">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border whitespace-nowrap ${
                    liveFormulaState.phase === 'reactants'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                      : liveFormulaState.phase === 'transition'
                      ? hasCatalyst
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                  }`}
                >
                  {liveFormulaState.phaseTitle}
                </span>
                <span className="text-slate-400 tabular-nums font-semibold whitespace-nowrap">
                  ξ = {liveFormulaState.pctConverted}%
                </span>
              </div>

              {/* Primary Live Chemical Formula Transforming with Atoms */}
              <div className="flex items-center justify-center flex-wrap gap-1.5 py-1 font-mono text-center leading-relaxed">
                {liveFormulaState.phase === 'reactants' && (
                  <>
                    <div className="flex items-center flex-wrap justify-center gap-1">
                      {selectedReaction.reactants.map((r, i) => (
                        <React.Fragment key={`${r.formula}-${i}`}>
                          {i > 0 && <span className="text-slate-500 font-bold text-sm">+</span>}
                          <span className="px-2 py-1 rounded-lg bg-sky-500/20 border border-sky-400/45 text-white font-bold text-sm sm:text-base shadow-sm leading-normal">
                            {r.count > 1 ? `${r.count} ` : ''}
                            <FormattedChemText text={r.formula} />
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <ArrowRight className="w-4 h-4 text-sky-400/70 mx-0.5 shrink-0" />
                    <span className="text-xs text-slate-500 font-semibold py-0.5 leading-normal">
                      <FormattedChemText text={liveFormulaState.productsText} />
                    </span>
                  </>
                )}

                {liveFormulaState.phase === 'transition' && (
                  <div
                    className={`flex items-center flex-wrap justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border leading-normal ${
                      hasCatalyst
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                        : 'bg-amber-500/15 border-amber-400/55 text-amber-200'
                    }`}
                  >
                    <span className="font-black text-base opacity-80">[</span>
                    <span className="text-xs sm:text-sm font-semibold text-sky-200/90">
                      <FormattedChemText text={liveFormulaState.reactantsText} />
                    </span>
                    <span className="text-sm font-bold tracking-widest px-1 text-amber-300">
                      ⋯{liveFormulaState.arrowSymbol}⋯
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-200/90">
                      <FormattedChemText text={liveFormulaState.productsText} />
                    </span>
                    <span className="font-black text-base opacity-80">]‡</span>
                  </div>
                )}

                {liveFormulaState.phase === 'products' && (
                  <>
                    <span className="text-xs text-slate-500 line-through decoration-slate-600/80 font-medium py-0.5 leading-normal">
                      <FormattedChemText text={liveFormulaState.reactantsText} />
                    </span>
                    <span className="text-emerald-400 font-bold text-sm mx-0.5">
                      {liveFormulaState.arrowSymbol}
                    </span>
                    <div className="flex items-center flex-wrap justify-center gap-1">
                      {selectedReaction.products.map((p, i) => (
                        <React.Fragment key={`${p.formula}-${i}`}>
                          {i > 0 && <span className="text-emerald-400/70 font-bold text-sm">+</span>}
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-bold text-sm sm:text-base shadow-sm leading-normal">
                            {p.count > 1 ? `${p.count} ` : ''}
                            <FormattedChemText text={p.formula} />
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Active Stage Detail & Live Reactant/Product Molar Mix Bar */}
              <div className="w-full flex flex-col gap-1">
                <div className="w-full h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
                  <div
                    className="h-full bg-sky-400 transition-all duration-75"
                    style={{ width: `${liveFormulaState.pctRemaining}%` }}
                  />
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${liveFormulaState.pctConverted}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[9.5px] font-mono text-slate-400">
                  <span className="text-sky-300 truncate">
                    Reactants: {liveFormulaState.pctRemaining}%
                  </span>
                  <span className="text-slate-300 truncate max-w-[170px] text-center py-0.5 leading-normal">
                    <FormattedChemText text={currentStage.stateName} />
                  </span>
                  <span className="text-emerald-300 truncate">
                    Products: {liveFormulaState.pctConverted}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top-Left Reaction Badge & Quick Browser */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-md pointer-events-auto">
          {/* Active Reaction Card */}
          <div className="bg-slate-900/92 border border-slate-800 rounded-xl p-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className={`w-4 h-4 ${selectedReaction.isExothermic ? 'text-amber-500' : 'text-cyan-400'}`} />
                <h2 className="text-base font-semibold text-white truncate">{selectedReaction.name}</h2>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold whitespace-nowrap ${
                  selectedReaction.isExothermic
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {selectedReaction.isExothermic ? 'Exothermic' : 'Endothermic'}
              </span>
            </div>
            <p className="text-xs font-mono text-sky-300 font-semibold mt-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800 leading-relaxed">
              <FormattedChemText text={selectedReaction.equation} />
            </p>

            {/* Live Thermodynamic State Metrics: ΔH, ΔS, ΔG° */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-mono">Enthalpy ΔH</span>
                <span className={`text-xs font-black font-mono ${selectedReaction.enthalpyDeltaH < 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {formatEnergy(selectedReaction.enthalpyDeltaH)}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-mono">Entropy ΔS</span>
                <span className={`text-xs font-black font-mono ${selectedReaction.entropyDeltaS > 0 ? 'text-emerald-400' : 'text-indigo-300'}`}>
                  {selectedReaction.entropyDeltaS > 0 ? `+${selectedReaction.entropyDeltaS}` : selectedReaction.entropyDeltaS} <span className="text-[9px] font-normal text-slate-400">J/K</span>
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-mono">Gibbs ΔG°</span>
                <span className={`text-xs font-black font-mono ${(selectedReaction.gibbsFreeEnergyDeltaG ?? 0) < 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {selectedReaction.gibbsFreeEnergyDeltaG !== undefined ? formatEnergy(selectedReaction.gibbsFreeEnergyDeltaG) : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Reaction Filter & Search Trigger Bar */}
          <div className="flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800/80 rounded-xl p-2 shadow-md">
            {/* Search Input & Browse Catalog Button */}
            <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reactions (e.g. Fission, Fusion, Golden Rain, Thermite)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
              <button
                onClick={() => setShowCatalogModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-semibold shadow-sm transition-all whitespace-nowrap flex-shrink-0"
              >
                <BookOpen className="w-3 h-3" />
                Browse ({REACTIONS.length})
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1">
              {REACTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Reaction Selector Chips */}
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 mt-0.5">
              {filteredReactions.map((rx) => {
                const isSelected = selectedReaction.id === rx.id;
                return (
                  <button
                    key={rx.id}
                    onClick={() => handleSelectReaction(rx)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all truncate max-w-[200px] ${
                      isSelected
                        ? 'bg-sky-500 text-white font-bold shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                    title={rx.equation}
                  >
                    {rx.name.split('(')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top-Right 3D Thermal Heat Map Toggle + Reaction Coordinate Energy Diagram */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Toggleable 3D Exothermic / Endothermic Potential Heat Map Control */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 shadow-xl w-72 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Thermometer
                  className={`w-3.5 h-3.5 shrink-0 ${
                    !showHeatMap
                      ? 'text-slate-400'
                      : selectedReaction.isExothermic
                      ? 'text-orange-400'
                      : 'text-cyan-400'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-200 truncate">
                  3D Thermal Heat Map
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowHeatMap((prev) => !prev);
                  soundFx.playReactionStep();
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showHeatMap
                    ? selectedReaction.isExothermic
                      ? 'bg-orange-500/20 border-orange-500/45 text-orange-300'
                      : 'bg-cyan-500/20 border-cyan-500/45 text-cyan-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle 3D exothermic/endothermic potential gradient overlay across the workspace"
              >
                {showHeatMap ? 'Overlay: ON' : 'Overlay: OFF'}
              </button>
            </div>

            {showHeatMap && (
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
                <div className="relative h-2.5 w-full rounded-full overflow-hidden border border-slate-700/80">
                  <div
                    className="w-full h-full"
                    style={{
                      background: selectedReaction.isExothermic
                        ? 'linear-gradient(90deg, #0f172a 0%, #c21e47 32%, #f97316 64%, #fde047 88%, #fefce8 100%)'
                        : 'linear-gradient(90deg, #0f172a 0%, #0f766e 32%, #06b6d4 64%, #7dd3fc 88%, #f0f9ff 100%)',
                    }}
                  />
                  {/* Live Reaction Potential Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#fff] transition-all duration-75"
                    style={{
                      left: `${Math.max(
                        4,
                        Math.min(96, Math.round((0.18 + kineticExtent * 0.72) * 100))
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9.5px] font-mono">
                  <span className="text-slate-400">Ambient ({temperatureK}K)</span>
                  <span
                    className={`font-semibold ${
                      selectedReaction.isExothermic ? 'text-orange-300' : 'text-cyan-300'
                    }`}
                  >
                    {selectedReaction.isExothermic
                      ? `Exo Release (${formatEnergy(selectedReaction.enthalpyDeltaH)})`
                      : `Endo Sink (${formatEnergy(selectedReaction.enthalpyDeltaH)})`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900/92 border border-slate-800 rounded-xl p-3 shadow-xl w-72">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1 font-semibold">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Reaction Energy Profile
              </span>
              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                (selectedReaction.gibbsFreeEnergyDeltaG ?? 0) < 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}>
                {(selectedReaction.gibbsFreeEnergyDeltaG ?? 0) < 0 ? 'Spontaneous (ΔG < 0)' : 'Non-spontaneous'}
              </span>
            </div>

            {/* Enthalpy and Entropy Dual Header */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px] font-mono">
              <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">ΔH (Enthalpy):</span>
                <span className={`font-bold ${selectedReaction.isExothermic ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {formatEnergy(selectedReaction.enthalpyDeltaH)}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">ΔS (Entropy):</span>
                <span className={`font-bold ${selectedReaction.entropyDeltaS > 0 ? 'text-emerald-400' : 'text-indigo-300'}`}>
                  {selectedReaction.entropyDeltaS > 0 ? `+${selectedReaction.entropyDeltaS}` : selectedReaction.entropyDeltaS} J/K
                </span>
              </div>
            </div>

            {/* SVG Kinetic Curve with live progress marker */}
            <div className="relative w-full h-24 bg-slate-950 rounded-lg p-2 border border-slate-800">
              <svg viewBox="0 0 240 80" className="w-full h-full overflow-visible">
                {/* Axes */}
                <line x1="15" y1="75" x2="225" y2="75" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="15" y1="10" x2="15" y2="75" stroke="#475569" strokeWidth="1.5" />

                {/* Energy curve according to exothermic vs endothermic */}
                {selectedReaction.isExothermic ? (
                  <path
                    d="M 15 50 C 70 50, 100 15, 120 15 C 140 15, 170 65, 225 65"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={hasCatalyst ? '1.6' : '2.5'}
                    opacity={hasCatalyst ? 0.38 : 1}
                    strokeDasharray={hasCatalyst ? '3 3' : undefined}
                  />
                ) : (
                  <path
                    d="M 15 65 C 70 65, 100 15, 120 15 C 140 15, 170 40, 225 40"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth={hasCatalyst ? '1.6' : '2.5'}
                    opacity={hasCatalyst ? 0.38 : 1}
                    strokeDasharray={hasCatalyst ? '3 3' : undefined}
                  />
                )}

                {/* Lowered Catalyzed Energy Pathway */}
                {hasCatalyst && (
                  selectedReaction.isExothermic ? (
                    <path
                      d="M 15 50 C 70 50, 100 28, 120 28 C 140 28, 170 65, 225 65"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                    />
                  ) : (
                    <path
                      d="M 15 65 C 70 65, 100 28, 120 28 C 140 28, 170 40, 225 40"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                    />
                  )
                )}

                {/* Activation energy barrier line */}
                <line
                  x1="120"
                  y1={hasCatalyst ? 28 : 15}
                  x2="120"
                  y2={selectedReaction.isExothermic ? 50 : 65}
                  stroke={hasCatalyst ? '#34d399' : '#f59e0b'}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text x="124" y={hasCatalyst ? 39 : 32} fill={hasCatalyst ? '#34d399' : '#f59e0b'} fontSize="8" fontFamily="monospace">
                  Ea = {kineticSimulation.effectiveEaKj} kJ{hasCatalyst ? ' (Cat.)' : ''}
                </text>

                {/* Live Kinetic Extent Marker Dot */}
                {(() => {
                  const t = kineticExtent;
                  const peakY = hasCatalyst ? 28 : 15;
                  const x = 15 + t * 210;
                  let y = 50;
                  if (selectedReaction.isExothermic) {
                    if (t < 0.5) {
                      const localT = t / 0.5;
                      y = 50 - Math.sin(localT * (Math.PI / 2)) * (50 - peakY);
                    } else {
                      const localT = (t - 0.5) / 0.5;
                      y = peakY + Math.sin(localT * (Math.PI / 2)) * (65 - peakY);
                    }
                  } else {
                    if (t < 0.5) {
                      const localT = t / 0.5;
                      y = 65 - Math.sin(localT * (Math.PI / 2)) * (65 - peakY);
                    } else {
                      const localT = (t - 0.5) / 0.5;
                      y = peakY + Math.sin(localT * (Math.PI / 2)) * (40 - peakY);
                    }
                  }
                  return (
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  );
                })()}

                <text x="18" y={selectedReaction.isExothermic ? '46' : '61'} fill="#94a3b8" fontSize="8" fontFamily="sans-serif">Reactants</text>
                <text x="190" y={selectedReaction.isExothermic ? '60' : '36'} fill="#94a3b8" fontSize="8" fontFamily="sans-serif">Products</text>
                <text x="95" y="10" fill="#fbbf24" fontSize="8" fontWeight="bold">Transition State</text>
              </svg>
            </div>

            <div className="text-[11px] font-mono text-slate-400 mt-2 flex items-center justify-between gap-2">
              <span className="truncate max-w-[165px] py-0.5 leading-normal">
                {kineticExtent >= 0.99 ? 'Products Formed' : <FormattedChemText text={currentStage.stateName} />}
              </span>
              <span className={`font-bold shrink-0 ${kineticExtent >= 0.95 ? 'text-emerald-400' : 'text-sky-300'}`}>
                {Math.round(kineticExtent * 100)}% ({temperatureK}K)
              </span>
            </div>

            {/* Real-Time D3 Bond Energy Delta HUD & Floating Tooltip */}
            <BondEnergyLiveBadge
              profile={bondEnergyProfile}
              kineticExtent={kineticExtent}
              isActiveTab={!dockCollapsed && dockTab === 'bond_energy'}
              onOpenFullPanel={() => {
                setDockTab('bond_energy');
                setDockCollapsed(false);
              }}
            />

            <button
              onClick={() => {
                setDockTab('kinetics');
                setDockCollapsed(false);
              }}
              className={`mt-1.5 w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                !dockCollapsed && dockTab === 'kinetics'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <LineChart className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Live Kinetics [C](t) Graph</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                {!dockCollapsed && dockTab === 'kinetics' ? 'Active' : 'Open'}
              </span>
            </button>
          </div>
        </div>

        {/* Viewport Play/Reset controls */}
        <div className="absolute right-2 sm:right-4 bottom-14 sm:bottom-24 z-10 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={handleTogglePlay}
            className={`p-2.5 rounded-xl border shadow-lg transition-all ${
              progress >= 0.999
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/60 text-emerald-300 ring-2 ring-emerald-500/40 animate-pulse'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200'
            }`}
            title={
              progress >= 0.999
                ? 'Reaction Complete - Click to Replay Reaction'
                : isPlaying
                ? 'Pause Reaction'
                : 'Play Reaction'
            }
          >
            {progress >= 0.999 ? (
              <RotateCcw className="w-4 h-4 text-emerald-300" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 text-sky-400" />
            ) : (
              <Play className="w-4 h-4 text-emerald-400" />
            )}
          </button>
          <button
            onClick={handleRestart}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all"
            title="Restart Reaction from Beginning (0%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Full-Screen All Reactions Directory Modal */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-slate-200 max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Chemical Reaction Directory & Encyclopedia</h3>
                  <p className="text-[11px] text-slate-400">Search and launch any chemical reaction into the 3D simulator</p>
                </div>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Bar inside Modal */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, equation, reactant, or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Enthalpy filter */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(['all', 'exothermic', 'endothermic'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setEnthalpyFilter(filter)}
                    className={`px-3 py-1 rounded-lg capitalize transition-all ${
                      enthalpyFilter === filter
                        ? 'bg-sky-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Directory Cards Grid */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredReactions.map((rx) => {
                const isCurrent = selectedReaction.id === rx.id;
                return (
                  <div
                    key={rx.id}
                    onClick={() => {
                      handleSelectReaction(rx);
                      setShowCatalogModal(false);
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-600 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{rx.name}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {rx.type}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-sky-400 font-semibold mt-1 leading-relaxed">
                        <FormattedChemText text={rx.equation} />
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        <FormattedChemText text={rx.description} />
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono flex-shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-[10px]">Enthalpy ΔH</span>
                        <span className={rx.isExothermic ? 'text-amber-400 font-bold' : 'text-cyan-400 font-bold'}>
                          {formatEnergy(rx.enthalpyDeltaH)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-[10px]">Entropy ΔS</span>
                        <span className={rx.entropyDeltaS > 0 ? 'text-emerald-400 font-bold' : 'text-indigo-300 font-bold'}>
                          {rx.entropyDeltaS > 0 ? `+${rx.entropyDeltaS}` : rx.entropyDeltaS} J/K
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-[10px]">Gibbs ΔG°</span>
                        <span className={(rx.gibbsFreeEnergyDeltaG ?? 0) < 0 ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                          {rx.gibbsFreeEnergyDeltaG !== undefined ? formatEnergy(rx.gibbsFreeEnergyDeltaG) : '--'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-[10px]">Activation Ea</span>
                        <span className="text-slate-300 font-bold">{rx.activationEnergyEa} kJ</span>
                      </div>
                      <button className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-sm transition-all ml-1">
                        {isCurrent ? 'Active' : 'Simulate'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <div
        className={`absolute bottom-2 sm:bottom-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl transition-all duration-300 pointer-events-auto max-h-[calc(100dvh-4.5rem)] flex flex-col ${
          dockCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
        }`}
      >
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-4.5rem)]">
          {/* Collapse Bar & View Switcher */}
          <div
            onClick={() => setDockCollapsed(!dockCollapsed)}
            className="w-full shrink-0 py-1.5 px-3 sm:px-4 bg-slate-800/80 hover:bg-slate-800 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate hidden sm:inline">Chemical Kinetics & Mechanism Controller</span>
              <span className="truncate sm:hidden">Kinetics Controller</span>
              <span className="text-[11px] text-slate-500 font-mono hidden md:inline whitespace-nowrap">
                [Stage: <FormattedChemText text={currentStage.title} />]
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 bg-slate-950/90 p-0.5 rounded-lg border border-slate-700/80"
              >
                <button
                  onClick={() => {
                    setDockTab('kinetics');
                    setDockCollapsed(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dockTab === 'kinetics'
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <LineChart className="w-3 h-3 shrink-0" />
                  <span>Kinetic Graph [C](t)</span>
                </button>
                <button
                  onClick={() => {
                    setDockTab('bond_energy');
                    setDockCollapsed(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dockTab === 'bond_energy'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3 shrink-0" />
                  <span>Bond Energy ΔE</span>
                </button>
                <button
                  onClick={() => {
                    setDockTab('mechanism');
                    setDockCollapsed(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dockTab === 'mechanism'
                      ? 'bg-sky-500 text-white font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Mechanism & ΔH/ΔS
                </button>
              </div>

              <span className="text-[11px] font-medium text-sky-300 whitespace-nowrap">
                {dockCollapsed ? '▴ Expand' : '▾ Collapse'}
              </span>
            </div>
          </div>

          {/* Controls Body */}
          <div className="p-2.5 sm:p-3.5 flex flex-col gap-3 overflow-y-auto max-h-[calc(100dvh-7.5rem)] sm:max-h-[55dvh] scrollbar-thin scrollbar-thumb-slate-700">
            {/* Interactive Progress Scrubber with Continuous Play & Speed */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {progress >= 0.999 ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {kineticSimulation.isReversible
                        ? `Equilibrium (${Math.round(kineticExtent * 100)}% Yield)`
                        : `Kinetic Run Complete (${Math.round(kineticExtent * 100)}% Converted)`}
                    </span>
                  ) : (
                    <span className="text-slate-300 font-medium">
                      Scrub Time t = <span className="font-mono text-cyan-300">{kineticSnapshot.timeSec.toFixed(1)}s</span>:
                    </span>
                  )}
                  {progress >= 0.999 && (
                    <button
                      onClick={handleReplay}
                      className="px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-400 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Replay ↺
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Speed buttons */}
                  <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                    <span className="text-slate-500 mr-0.5">Speed:</span>
                    {[0.08, 0.15, 0.3].map((spd, i) => (
                      <button
                        key={i}
                        onClick={() => setPlaySpeed(spd)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          Math.abs(playSpeed - spd) < 0.01
                            ? 'bg-sky-500 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {spd === 0.08 ? '0.5x' : spd === 0.15 ? '1x' : '2x'}
                      </button>
                    ))}
                  </div>

                  <span className={`font-mono font-bold text-xs ${kineticExtent >= 0.95 ? 'text-emerald-400' : 'text-sky-300'}`}>
                    {Math.round(kineticExtent * 100)}% Converted
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePlay}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                    progress >= 0.999
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                      : isPlaying
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sm'
                  }`}
                  title={progress >= 0.999 ? 'Replay reaction from start' : isPlaying ? 'Pause reaction' : 'Play reaction continuous to end'}
                >
                  {progress >= 0.999 ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Replay
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Play
                    </>
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.005}
                  value={progress}
                  onChange={(e) => {
                    setSyncedProgress(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-sky-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Real-Time Kinetic Graph, D3 Bond Energy Delta, or Stage Mechanism Details */}
            {dockTab === 'kinetics' ? (
              <KineticGraphPanel
                reaction={selectedReaction}
                progress={progress}
                simulation={kineticSimulation}
                temperatureK={temperatureK}
                onTemperatureChange={handleTemperatureChange}
                hasCatalyst={hasCatalyst}
                onToggleCatalyst={handleToggleCatalyst}
                orderMode={orderMode}
                onOrderModeChange={handleOrderModeChange}
                onSeekProgress={(nextP) => {
                  setSyncedProgress(nextP);
                  setIsPlaying(false);
                }}
                onReplay={handleReplay}
              />
            ) : dockTab === 'bond_energy' ? (
              <BondEnergyD3Panel
                reaction={selectedReaction}
                profile={bondEnergyProfile}
                kineticExtent={kineticExtent}
                hasCatalyst={hasCatalyst}
                onSeekExtent={(targetExtent) => {
                  const arr = kineticSimulation.extentValues;
                  const maxExt = arr[arr.length - 1] || 1;
                  const clampedExt = Math.min(targetExtent, maxExt);
                  let bestIdx = 0;
                  for (let i = 0; i < arr.length; i++) {
                    if (arr[i] >= clampedExt) {
                      bestIdx = i;
                      break;
                    }
                    bestIdx = i;
                  }
                  const nextP = bestIdx / Math.max(1, arr.length - 1);
                  setSyncedProgress(Number(nextP.toFixed(3)));
                  setIsPlaying(false);
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="font-semibold text-sky-300 block mb-1">Current Molecular Mechanism:</span>
                  <p className="text-slate-300 text-[12px] leading-relaxed">
                    <FormattedChemText text={currentStage.description} />
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-amber-300">Thermodynamics: Enthalpy (ΔH) & Entropy (ΔS)</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        (selectedReaction.gibbsFreeEnergyDeltaG ?? 0) < 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}>
                        ΔG° = {selectedReaction.gibbsFreeEnergyDeltaG !== undefined ? `${formatEnergy(selectedReaction.gibbsFreeEnergyDeltaG)}/mol` : '--'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono mb-1.5 bg-slate-900/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-300">
                        ΔH: <b className={selectedReaction.isExothermic ? 'text-amber-400' : 'text-cyan-400'}>
                          {formatEnergy(selectedReaction.enthalpyDeltaH)}/mol
                        </b>
                      </span>
                      <span className="text-slate-300">
                        ΔS: <b className={selectedReaction.entropyDeltaS > 0 ? 'text-emerald-400' : 'text-indigo-300'}>
                          {selectedReaction.entropyDeltaS > 0 ? `+${selectedReaction.entropyDeltaS}` : selectedReaction.entropyDeltaS} J/(mol·K)
                        </b>
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {selectedReaction.entropyDeltaS > 0 ? '(Entropy Increase: Disordered)' : '(Entropy Decrease: Ordered)'}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      <FormattedChemText
                        text={
                          selectedReaction.thermodynamicsSummary ||
                          (selectedReaction.isExothermic
                            ? `Exothermic release of ${Math.abs(selectedReaction.enthalpyDeltaH)} kJ/mol.`
                            : `Endothermic absorption of +${selectedReaction.enthalpyDeltaH} kJ/mol.`)
                        }
                      />
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
