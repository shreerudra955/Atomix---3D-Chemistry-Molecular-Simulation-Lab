import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  OrbitControls,
  setupStandardRenderer,
  setupSceneEnvironment,
  isSoftwareGl,
} from '../utils/three-setup';
import {
  QUANTUM_ORBITALS,
  OrbitalDefinition,
  getOrbitalById,
  generateOrbitalPointCloud,
  createOrbitalIsosurfaceGroup,
  getRadialDistributionCurve,
  OrbitalType,
} from '../utils/quantumWavefunctions';
import { ElementData } from '../types/chemistry';
import { soundFx } from '../utils/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  Sliders,
  Scissors,
  Eye,
  Maximize2,
  Atom,
  HelpCircle,
  ChevronDown,
  Info,
} from 'lucide-react';
import { getAufbauConfiguration } from '../utils/aufbau';
import { ELEMENTS, getElement } from '../data/elements';

interface QuantumOrbitalViewerProps {
  currentElement?: ElementData;
  initialOrbitalId?: string;
  theme?: 'dark' | 'light';
  onSelectSubshell?: (subshellName: string) => void;
  onBackToBohr?: () => void;
  onSelectElement?: (element: ElementData) => void;
  className?: string;
}

export type ViewRenderMode = 'cloud' | 'isosurface' | 'hybrid';
export type SliceAxis = 'none' | 'xy' | 'xz' | 'yz';

// Helper to map general subshell names ('2p', '3d', '4f') to specific orbital IDs ('2pz', '3dz2', '4fz3')
function mapSubshellToOrbitalId(name: string): string {
  const clean = name.toLowerCase().trim();
  if (QUANTUM_ORBITALS.some((o) => o.id === clean)) return clean;
  if (clean === '1s') return '1s';
  if (clean === '2s') return '2s';
  if (clean === '2p') return '2pz';
  if (clean === '3s') return '3s';
  if (clean === '3p') return '3pz';
  if (clean === '3d') return '3dz2';
  if (clean === '4s') return '4s';
  if (clean === '4d') return '4dz2';
  if (clean === '4f') return '4fz3';
  return '2pz';
}

export const QuantumOrbitalViewer: React.FC<QuantumOrbitalViewerProps> = ({
  currentElement,
  initialOrbitalId = '2pz',
  theme = 'dark',
  onSelectSubshell,
  onBackToBohr,
  onSelectElement,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Quantum State
  const [selectedOrbitalId, setSelectedOrbitalId] = useState<string>(() =>
    mapSubshellToOrbitalId(initialOrbitalId)
  );
  const [activeN, setActiveN] = useState<number>(2);
  const [activeL, setActiveL] = useState<OrbitalType>('p');
  const [renderMode, setRenderMode] = useState<ViewRenderMode>('hybrid');
  const [pointCount, setPointCount] = useState<number>(isSoftwareGl ? 8000 : 16000);

  // Synchronize when initialOrbitalId changes from parent
  useEffect(() => {
    if (initialOrbitalId) {
      const mapped = mapSubshellToOrbitalId(initialOrbitalId);
      setSelectedOrbitalId(mapped);
    }
  }, [initialOrbitalId]);

  // Slicing Plane State
  const [sliceAxis, setSliceAxis] = useState<SliceAxis>('none');
  const [sliceOffset, setSliceOffset] = useState<number>(0);
  const [sliceInvert, setSliceInvert] = useState<boolean>(false);

  // Visual Overlays
  const [showNodalPlanes, setShowNodalPlanes] = useState<boolean>(false);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showRadialChart, setShowRadialChart] = useState<boolean>(true);

  // Playback & Speed
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);

  // Mutable refs to resolve stale closures in animation loop
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const simSpeedRef = useRef<number>(simSpeed);
  simSpeedRef.current = simSpeed;

  // Selected orbital definition object
  const currentOrbital = useMemo(() => {
    return getOrbitalById(selectedOrbitalId);
  }, [selectedOrbitalId]);

  // Synchronize n & l tabs when orbitalId changes
  useEffect(() => {
    if (currentOrbital) {
      setActiveN(currentOrbital.n);
      setActiveL(currentOrbital.type);
    }
  }, [currentOrbital]);

  // Radial probability distribution curve for 2D chart
  const radialData = useMemo(() => {
    return getRadialDistributionCurve(currentOrbital.n, currentOrbital.l, 100);
  }, [currentOrbital.n, currentOrbital.l]);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const orbitalGroupRef = useRef<THREE.Group | null>(null);
  const slicePlaneHelperRef = useRef<THREE.Mesh | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const [sceneReady, setSceneReady] = useState<number>(0);

  // Initial Three.js Scene Setup
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 7, 20);
    cameraRef.current = camera;

    const renderer = setupStandardRenderer(canvas);
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 50;
    controls.minDistance = 3;
    controlsRef.current = controls;

    const disposeEnv = setupSceneEnvironment(renderer, scene);

    // Studio Lights for PBR Lobes
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(12, 16, 12);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.4);
    dirLight2.position.set(-12, -8, -10);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.0);
    scene.add(hemiLight);

    // Master Orbital Container
    const orbitalGroup = new THREE.Group();
    scene.add(orbitalGroup);
    orbitalGroupRef.current = orbitalGroup;

    // Contact soft shadow disc
    const shadowGeo = new THREE.PlaneGeometry(28, 28);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x000000 : 0x94a3b8,
      transparent: true,
      opacity: theme === 'dark' ? 0.4 : 0.15,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -8;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (isPlayingRef.current && orbitalGroupRef.current) {
        const speed = simSpeedRef.current;
        orbitalGroupRef.current.rotation.y += delta * 0.28 * speed;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    setSceneReady((prev) => prev + 1);

    // Resize Handler
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
      disposeEnv();
      renderer.dispose();
      shadowMeshRef.current = null;
    };
  }, []);

  // Update scene background and shadow mesh color on theme switch without destroying the 3D orbital
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    }
    if (shadowMeshRef.current) {
      const mat = shadowMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(theme === 'dark' ? 0x000000 : 0x94a3b8);
      mat.opacity = theme === 'dark' ? 0.4 : 0.15;
    }
  }, [theme]);

  // Rebuild 3D Orbital Geometry (PointCloud + Isosurface Lobes + Slicing + Axes)
  useEffect(() => {
    const group = orbitalGroupRef.current;
    if (!group) return;

    // Clean previous objects and geometries
    while (group.children.length > 0) {
      const child = group.children[0];
      child.traverse((node) => {
        if ('geometry' in node && (node as THREE.Mesh).geometry) {
          (node as THREE.Mesh).geometry.dispose();
        }
      });
      group.remove(child);
    }

    // 1. Isosurface Lobe Meshes (for 'isosurface' or 'hybrid')
    if (renderMode === 'isosurface' || renderMode === 'hybrid') {
      const lobeGroup = createOrbitalIsosurfaceGroup(
        currentOrbital,
        0.65,
        renderMode === 'hybrid' ? 3.4 : 3.6
      );

      // If hybrid, soften lobe opacity so internal point cloud shines through
      if (renderMode === 'hybrid') {
        lobeGroup.traverse((child) => {
          if ('material' in child && (child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            mat.opacity = 0.38;
            mat.roughness = 0.3;
          }
        });
      }

      group.add(lobeGroup);
    }

    // 2. Quantum Electron Cloud Point Sampling (for 'cloud' or 'hybrid')
    if (renderMode === 'cloud' || renderMode === 'hybrid') {
      const actualPoints = renderMode === 'hybrid' ? Math.round(pointCount * 0.75) : pointCount;
      const cloud = generateOrbitalPointCloud(
        currentOrbital,
        actualPoints,
        1.0,
        sliceAxis,
        sliceOffset,
        sliceInvert
      );

      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3));
      pointGeo.setAttribute('color', new THREE.BufferAttribute(cloud.colors, 3));

      // Luminous particle shader material
      const pointMat = new THREE.PointsMaterial({
        size: renderMode === 'hybrid' ? 0.16 : 0.22,
        vertexColors: true,
        transparent: true,
        opacity: renderMode === 'hybrid' ? 0.85 : 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const pointsMesh = new THREE.Points(pointGeo, pointMat);
      group.add(pointsMesh);
    }

    // 3. Central Nucleus Marker
    const nucleusGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });
    group.add(new THREE.Mesh(nucleusGeo, nucleusMat));

    // 4. Spatial Coordinate Axes Helper
    if (showAxes) {
      const axes = new THREE.AxesHelper(6.5);
      axes.renderOrder = 2;
      group.add(axes);
    }

    // 5. Nodal Planes Overlay
    if (showNodalPlanes) {
      const planeGeo = new THREE.PlaneGeometry(14, 14);
      const nodalMat = new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      // Show relevant nodal planes according to l and m
      if (currentOrbital.l === 1) {
        // p orbital nodal plane
        if (currentOrbital.m === 0) {
          // p_z: XY plane (z = 0)
          group.add(new THREE.Mesh(planeGeo, nodalMat));
        } else if (currentOrbital.m === 1) {
          // p_x: YZ plane (x = 0)
          const yz = new THREE.Mesh(planeGeo, nodalMat);
          yz.rotation.y = Math.PI / 2;
          group.add(yz);
        } else {
          // p_y: XZ plane (y = 0)
          const xz = new THREE.Mesh(planeGeo, nodalMat);
          xz.rotation.x = Math.PI / 2;
          group.add(xz);
        }
      } else if (currentOrbital.l === 2) {
        // d orbital nodal planes
        const xy = new THREE.Mesh(planeGeo, nodalMat);
        const yz = new THREE.Mesh(planeGeo, nodalMat);
        yz.rotation.y = Math.PI / 2;
        group.add(xy, yz);
      } else if (currentOrbital.l === 3) {
        // f orbital 3 nodal planes
        const xy = new THREE.Mesh(planeGeo, nodalMat);
        const yz = new THREE.Mesh(planeGeo, nodalMat);
        yz.rotation.y = Math.PI / 2;
        const xz = new THREE.Mesh(planeGeo, nodalMat);
        xz.rotation.x = Math.PI / 2;
        group.add(xy, yz, xz);
      }
    }

    // 6. Slicing Plane Visual Indicator
    if (sliceAxis !== 'none') {
      const sliceGuideGeo = new THREE.PlaneGeometry(16, 16);
      const sliceGuideMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        wireframe: true,
      });
      const sliceHelper = new THREE.Mesh(sliceGuideGeo, sliceGuideMat);

      if (sliceAxis === 'xy') {
        sliceHelper.position.z = sliceOffset;
      } else if (sliceAxis === 'xz') {
        sliceHelper.rotation.x = Math.PI / 2;
        sliceHelper.position.y = sliceOffset;
      } else if (sliceAxis === 'yz') {
        sliceHelper.rotation.y = Math.PI / 2;
        sliceHelper.position.x = sliceOffset;
      }
      group.add(sliceHelper);
    }
  }, [
    currentOrbital,
    renderMode,
    pointCount,
    sliceAxis,
    sliceOffset,
    sliceInvert,
    showNodalPlanes,
    showAxes,
    sceneReady,
  ]);

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 7, 20);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Filter available orbitals matching selected n and l
  const availableOrbitalsInSubshell = useMemo(() => {
    return QUANTUM_ORBITALS.filter((o) => o.n === activeN && o.type === activeL);
  }, [activeN, activeL]);

  // Aufbau occupied subshells for current element
  const elementSubshells = useMemo(() => {
    if (!currentElement) return [];
    return getAufbauConfiguration(currentElement.atomicNumber);
  }, [currentElement]);

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden bg-slate-950 text-slate-100 ${className}`}>
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="relative flex-1 w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-grab active:cursor-grabbing outline-none"
        />

        {/* Top-Left Quantum Info & Element Subshells Badge */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm pointer-events-auto">
          {/* Element & Occupied Subshells (if element provided) */}
          {currentElement && (
            <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-2.5 shadow-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shadow-sm border border-white/20"
                    style={{
                      backgroundColor: currentElement.cpkColor === '#FFFFFF' ? '#475569' : currentElement.cpkColor,
                    }}
                  >
                    {currentElement.symbol}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white leading-none block">
                      {currentElement.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Z={currentElement.atomicNumber} • {currentElement.atomicNumber} e⁻
                    </span>
                  </div>
                </div>

                {onSelectElement && (
                  <select
                    value={currentElement.atomicNumber}
                    onChange={(e) => {
                      const el = getElement(Number(e.target.value));
                      if (el) onSelectElement(el);
                    }}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 max-w-[125px] cursor-pointer"
                    title="Select any element"
                  >
                    {ELEMENTS.map((el) => (
                      <option key={el.atomicNumber} value={el.atomicNumber}>
                        {el.atomicNumber}. {el.symbol} - {el.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Occupied subshells tags */}
              <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 mr-0.5">Occupied Orbitals:</span>
                {elementSubshells.map((sub) => {
                  const targetOrbId = mapSubshellToOrbitalId(sub.name);
                  const isCurrent = selectedOrbitalId.startsWith(sub.name);
                  return (
                    <button
                      key={sub.name}
                      onClick={() => {
                        setSelectedOrbitalId(targetOrbId);
                        setActiveN(sub.n);
                        setActiveL(sub.type);
                        soundFx.playReactionStep();
                        if (onSelectSubshell) onSelectSubshell(sub.name);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                        isCurrent
                          ? 'bg-cyan-500 text-white font-bold shadow-sm ring-1 ring-cyan-300'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`View ${sub.name} orbital (${sub.electronCount}/${sub.capacity} electrons)`}
                    >
                      {sub.name}
                      <sup className="text-[9px] font-bold text-sky-300 ml-0.5">{sub.electronCount}</sup>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Orbital Info Card */}
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-3 shadow-xl flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-sky-500/20 border border-sky-400/40 flex flex-col items-center justify-center font-bold text-sky-300 shadow-md">
              <span className="text-[10px] leading-none opacity-80">Ψ</span>
              <span className="text-lg leading-none font-black font-mono">{currentOrbital.name}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white truncate">
                  {currentOrbital.type.toUpperCase()} Orbital ({currentOrbital.subLabel})
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {currentOrbital.totalNodes} {currentOrbital.totalNodes === 1 ? 'Node' : 'Nodes'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                n = {currentOrbital.n}, ℓ = {currentOrbital.l}, m = {currentOrbital.m}
              </p>
            </div>
          </div>

          {/* Quick Subshell Selector Pills */}
          <div className="backdrop-blur-md bg-slate-900/80 border border-slate-800 rounded-xl p-2 shadow-lg flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Principal (n):</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((nVal) => (
                  <button
                    key={nVal}
                    onClick={() => {
                      setActiveN(nVal);
                      const firstOrb =
                        QUANTUM_ORBITALS.find((o) => o.n === nVal && o.type === activeL) ||
                        QUANTUM_ORBITALS.find((o) => o.n === nVal);
                      if (firstOrb) {
                        setSelectedOrbitalId(firstOrb.id);
                        setActiveL(firstOrb.type);
                      }
                      soundFx.playReactionStep();
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                      activeN === nVal
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    n={nVal}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Subshell (ℓ):</span>
              <div className="flex gap-1">
                {(['s', 'p', 'd', 'f'] as OrbitalType[])
                  .filter((lType) => {
                    const lNum = lType === 's' ? 0 : lType === 'p' ? 1 : lType === 'd' ? 2 : 3;
                    return lNum < activeN;
                  })
                  .map((lType) => (
                    <button
                      key={lType}
                      onClick={() => {
                        setActiveL(lType);
                        const match = QUANTUM_ORBITALS.find((o) => o.n === activeN && o.type === lType);
                        if (match) setSelectedOrbitalId(match.id);
                        soundFx.playReactionStep();
                      }}
                      className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase transition-all ${
                        activeL === lType
                          ? 'bg-cyan-500 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lType}
                    </button>
                  ))}
              </div>
            </div>

            {/* Specific Degenerate States (m values) */}
            {availableOrbitalsInSubshell.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 mr-1">Orientation:</span>
                {availableOrbitalsInSubshell.map((orb) => (
                  <button
                    key={orb.id}
                    onClick={() => {
                      setSelectedOrbitalId(orb.id);
                      soundFx.playReactionStep();
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                      selectedOrbitalId === orb.id
                        ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50 font-bold'
                        : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {orb.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Rendering & Slicing Control Deck */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2.5 max-w-xs pointer-events-auto">
          {/* Top Model Mode Switcher (Bohr vs Quantum Orbitals) */}
          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-lg">
            {onBackToBohr && (
              <button
                onClick={() => {
                  soundFx.playReactionStep();
                  onBackToBohr();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <Atom className="w-3.5 h-3.5" />
                Bohr Model
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500 text-white shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Quantum Orbitals
            </button>
          </div>

          {/* Render Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-lg">
            <button
              onClick={() => {
                setRenderMode('cloud');
                soundFx.playReactionStep();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                renderMode === 'cloud'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="3D Monte Carlo probability density points |Ψ|²"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Density Cloud
            </button>
            <button
              onClick={() => {
                setRenderMode('isosurface');
                soundFx.playReactionStep();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                renderMode === 'isosurface'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Continuous 3D contour boundary isosurface"
            >
              <Layers className="w-3.5 h-3.5" />
              Isosurface
            </button>
            <button
              onClick={() => {
                setRenderMode('hybrid');
                soundFx.playReactionStep();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                renderMode === 'hybrid'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Combined semi-transparent boundary with dense interior probability cloud"
            >
              <Eye className="w-3.5 h-3.5" />
              Hybrid
            </button>
          </div>

          {/* Slicing & Internal Radial Nodes Tool */}
          <div className="w-full backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-2.5 shadow-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                Internal Cutaway Slicer:
              </span>
              <div className="flex gap-1 text-[10px] font-mono">
                {(['none', 'xy', 'xz', 'yz'] as SliceAxis[]).map((axis) => (
                  <button
                    key={axis}
                    onClick={() => {
                      setSliceAxis(axis);
                      soundFx.playReactionStep();
                    }}
                    className={`px-1.5 py-0.5 rounded uppercase font-bold transition-all ${
                      sliceAxis === axis
                        ? 'bg-cyan-500 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {axis}
                  </button>
                ))}
              </div>
            </div>

            {sliceAxis !== 'none' && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Plane Offset:</span>
                  <span className="text-cyan-300">{sliceOffset.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={0.2}
                  value={sliceOffset}
                  onChange={(e) => setSliceOffset(Number(e.target.value))}
                  className="w-full accent-cyan-500 h-1 bg-slate-800 rounded cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={sliceInvert}
                      onChange={(e) => setSliceInvert(e.target.checked)}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Invert Half</span>
                  </label>
                  <button
                    onClick={() => setSliceOffset(0)}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Center
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Probability Cloud Density Slider (when cloud or hybrid active) */}
          {(renderMode === 'cloud' || renderMode === 'hybrid') && (
            <div className="w-full backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-2.5 shadow-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  Point Sampling:
                </span>
                <span className="font-mono text-sky-300 text-[10px]">
                  {pointCount.toLocaleString()} pts
                </span>
              </div>
              <input
                type="range"
                min={5000}
                max={25000}
                step={2500}
                value={pointCount}
                onChange={(e) => setPointCount(Number(e.target.value))}
                className="w-full accent-sky-500 h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Visual Display Toggles */}
          <div className="w-full backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-2 shadow-xl flex items-center justify-between text-[11px] text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={showNodalPlanes}
                onChange={(e) => setShowNodalPlanes(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <span>Nodal Planes</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => setShowAxes(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <span>XYZ Axes</span>
            </label>
          </div>

          {/* Phase Legend */}
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-lg flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm" />
              +Ψ Phase
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block shadow-sm" />
              −Ψ Phase
            </span>
            <span className="text-slate-500">Node: Ψ = 0</span>
          </div>
        </div>

        {/* Viewport Playback Floating Dock (Right Center) */}
        <div className="absolute right-4 bottom-24 z-10 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              soundFx.playReactionStep();
            }}
            className={`p-2.5 rounded-xl border shadow-lg transition-all flex items-center justify-center ${
              isPlaying
                ? 'bg-slate-900/85 hover:bg-slate-800 border-slate-800 text-sky-400'
                : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
            }`}
            title={isPlaying ? 'Pause Rotation' : 'Resume Rotation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              const speeds = [0.25, 0.5, 1, 2, 4];
              const nextIdx = (speeds.indexOf(simSpeed) + 1) % speeds.length;
              setSimSpeed(speeds[nextIdx]);
              soundFx.playReactionStep();
            }}
            className="px-2 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all text-xs font-mono font-bold"
            title="Cycle Auto-Rotation Speed"
          >
            {simSpeed}x
          </button>
          <button
            onClick={resetCamera}
            className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all"
            title="Reset Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Synchronized 2D Radial Probability Distribution Graph & Quantum Specs (Collapsible Bottom Bar) */}
      <div className="w-full backdrop-blur-xl bg-slate-900/90 border-t border-slate-800 p-3 flex flex-col md:flex-row items-stretch gap-3 z-20">
        {/* Left: 2D Radial Distribution Graph P(r) */}
        <div className="flex-1 min-w-0 bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Radial Probability Distribution P(r) = 4π r² |R_{currentOrbital.n},{currentOrbital.l}(r)|²
            </span>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span>r_peak = <strong className="text-cyan-300">{radialData.rPeak.toFixed(1)} a₀</strong></span>
              {radialData.radialNodes.length > 0 && (
                <span>Nodes at r = [{radialData.radialNodes.join(', ')}] a₀</span>
              )}
            </div>
          </div>

          {/* SVG Graph */}
          <div className="w-full h-20 relative">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 400 80"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="radialGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="75" x2="400" y2="75" stroke="#334155" strokeWidth="1" />
              <line x1="0" y1="40" x2="400" y2="40" stroke="#1e293b" strokeDasharray="2,2" />

              {/* Radial Nodes vertical indicators */}
              {radialData.radialNodes.map((nodeR, idx) => {
                const maxR = radialData.rValues[radialData.rValues.length - 1] || 1;
                const x = (nodeR / maxR) * 400;
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1="10"
                      x2={x}
                      y2="75"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                    />
                    <text x={x} y="8" fill="#f43f5e" fontSize="8" textAnchor="middle" fontFamily="monospace">
                      Node ({nodeR} a₀)
                    </text>
                  </g>
                );
              })}

              {/* Peak Marker */}
              {(() => {
                const maxR = radialData.rValues[radialData.rValues.length - 1] || 1;
                const peakX = (radialData.rPeak / maxR) * 400;
                return (
                  <circle cx={peakX} cy="14" r="3" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                );
              })()}

              {/* Distribution curve area and stroke */}
              {(() => {
                const maxR = radialData.rValues[radialData.rValues.length - 1] || 1;
                const maxP = radialData.maxP || 1e-4;

                const points = radialData.rValues.map((r, i) => {
                  const p = radialData.pValues[i];
                  const x = (r / maxR) * 400;
                  const y = 75 - (p / maxP) * 60;
                  return `${x},${y}`;
                });

                const dArea = `M 0,75 L ${points.join(' L ')} L 400,75 Z`;
                const dLine = `M ${points.join(' L ')}`;

                return (
                  <>
                    <path d={dArea} fill="url(#radialGradient)" />
                    <path d={dLine} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Right: Quantum Numbers & Nodal Topology Summary */}
        <div className="w-full md:w-80 bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between text-xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1.5">
              <span className="font-semibold text-slate-200">Quantum Nodal Topology</span>
              <span className="font-mono text-cyan-300 font-bold">{currentOrbital.formula}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] mb-2">
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px]">Radial Nodes:</span>
                <span className="text-cyan-300 font-bold">{currentOrbital.radialNodes} (n - ℓ - 1)</span>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[9px]">Angular Nodes:</span>
                <span className="text-amber-300 font-bold">{currentOrbital.angularNodes} (ℓ)</span>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px]">Total Nodes:</span>
                <span className="text-emerald-300 font-bold">{currentOrbital.totalNodes} (n - 1)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
              {currentOrbital.description}
            </p>
          </div>

          {currentElement && (
            <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Current Element:</span>
              <span className="font-mono text-sky-300 font-semibold">
                {currentElement.name} ({currentElement.symbol}) • Z={currentElement.atomicNumber}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
