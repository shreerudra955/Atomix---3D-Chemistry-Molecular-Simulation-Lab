import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls, setupStandardRenderer, setupSceneEnvironment, isSoftwareGl } from '../utils/three-setup';
import { ChemicalReaction } from '../types/chemistry';
import { REACTIONS } from '../data/reactions';
import { soundFx } from '../utils/audio';
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
} from 'lucide-react';

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
  const [sceneReady, setSceneReady] = useState<number>(0);

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const playSpeedRef = useRef<number>(playSpeed);
  playSpeedRef.current = playSpeed;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [enthalpyFilter, setEnthalpyFilter] = useState<'all' | 'exothermic' | 'endothermic'>('all');
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);

  // Reaction completion overlay state
  const [completedBannerDismissed, setCompletedBannerDismissed] = useState<boolean>(false);
  const completionSoundFiredRef = useRef<boolean>(false);

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

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reactionGroupRef = useRef<THREE.Group | null>(null);
  const energyParticlesRef = useRef<Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }>>([]);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);

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

    setSceneReady((prev) => prev + 1);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Reaction playback progress (runs continuously from start to end without looping)
      if (isPlayingRef.current) {
        setProgress((prev) => {
          const next = prev + delta * playSpeedRef.current;
          if (next >= 1) {
            return 1; // Stay at completion (do not loop)
          }
          return next;
        });
      }

      // Rotate reaction chamber slightly for 3D depth
      if (reactionGroupRef.current) {
        reactionGroupRef.current.rotation.y += delta * 0.15;
      }

      // Animate heat particles when transitioning
      for (let i = energyParticlesRef.current.length - 1; i >= 0; i--) {
        const p = energyParticlesRef.current[i];
        p.mesh.position.addScaledVector(p.vel, delta * 3);
        p.life -= delta;
        p.mesh.scale.multiplyScalar(0.98);
        if (p.life <= 0) {
          scene.remove(p.mesh);
          energyParticlesRef.current.splice(i, 1);
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

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
      floorMeshRef.current = null;
    };
  }, []);

  // Update scene background and floor color on theme switch without recreating the reaction scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    }
    if (floorMeshRef.current) {
      const mat = floorMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(theme === 'dark' ? 0x000000 : 0x94a3b8);
      mat.opacity = theme === 'dark' ? 0.35 : 0.12;
    }
  }, [theme]);

  // Rebuild 3D Reaction Molecules depending on progress
  useEffect(() => {
    const group = reactionGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      group.remove(child);
    }

    // Material palette
    const carbonMat = new THREE.MeshPhysicalMaterial({ color: 0x334155, roughness: 0.3, clearcoat: 0.8 });
    const oxygenMat = new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.2, clearcoat: 0.8 });
    const hydrogenMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.2, clearcoat: 0.8 });
    const nitrogenMat = new THREE.MeshPhysicalMaterial({ color: 0x3b82f6, roughness: 0.2, clearcoat: 0.8 });
    const sodiumMat = new THREE.MeshPhysicalMaterial({ color: 0xab5cf2, roughness: 0.3, clearcoat: 0.8 });
    const chlorineMat = new THREE.MeshPhysicalMaterial({ color: 0x22c55e, roughness: 0.2, clearcoat: 0.8 });
    const ironMat = new THREE.MeshPhysicalMaterial({ color: 0xe06633, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 });
    const aluminiumMat = new THREE.MeshPhysicalMaterial({ color: 0xbfa6a6, roughness: 0.3, metalness: 0.5, clearcoat: 0.8 });
    const calciumMat = new THREE.MeshPhysicalMaterial({ color: 0x10b981, roughness: 0.3, clearcoat: 0.8 });
    const bondMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, roughness: 0.4 });
    const electronMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const atpMat = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.6, roughness: 0.2 });
    const cathodeMat = new THREE.MeshPhysicalMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.8 });
    const anodeMat = new THREE.MeshPhysicalMaterial({ color: 0xb91c1c, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.8 });
    // Nuclear, heavy metal & precipitation palette
    const uraniumMat = new THREE.MeshPhysicalMaterial({ color: 0x10b981, roughness: 0.25, metalness: 0.7, clearcoat: 1.0, emissive: 0x059669, emissiveIntensity: 0.4 });
    const bariumMat = new THREE.MeshPhysicalMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.6, clearcoat: 0.8 });
    const kryptonMat = new THREE.MeshPhysicalMaterial({ color: 0xa855f7, roughness: 0.2, metalness: 0.2, emissive: 0x7c3aed, emissiveIntensity: 0.4 });
    const neutronMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const protonMat = new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.2, clearcoat: 0.8, emissive: 0xb91c1c, emissiveIntensity: 0.25 });
    const alphaMat = new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, roughness: 0.2, clearcoat: 0.9, emissive: 0xd97706, emissiveIntensity: 0.5 });
    const leadMat = new THREE.MeshPhysicalMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.7 });
    const iodineMat = new THREE.MeshPhysicalMaterial({ color: 0xeab308, roughness: 0.2, clearcoat: 0.9, emissive: 0xca8a04, emissiveIntensity: 0.35 });
    const silverMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.1, metalness: 0.95, clearcoat: 1.0 });
    const copperMat = new THREE.MeshPhysicalMaterial({ color: 0xb45309, roughness: 0.25, metalness: 0.8, clearcoat: 0.8 });
    const zincMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.7 });
    const plasmaMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true, transparent: true, opacity: 0.4 });

    const addAtom = (mat: THREE.Material, pos: THREE.Vector3, radius = 0.45) => {
      const geo = new THREE.SphereGeometry(radius, 24, 24);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      group.add(mesh);
      return mesh;
    };

    const addBond = (p1: THREE.Vector3, p2: THREE.Vector3, radius = 0.08, mat = bondMat) => {
      const dist = p1.distanceTo(p2);
      if (dist <= 0.01) return;
      const geo = new THREE.CylinderGeometry(radius, radius, dist, 12);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(p1.clone().add(p2).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      group.add(mesh);
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
      const points = [p1, p2];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.25,
        gapSize: 0.15,
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      group.add(line);
    };

    const addHaloRing = (center: THREE.Vector3, radius: number, color: number) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.05, radius + 0.05, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(center);
      ring.rotation.x = Math.PI / 4;
      group.add(ring);
    };

    // Transition State Energy Barrier Glow
    if (progress > 0.4 && progress < 0.65) {
      const barrierGeo = new THREE.SphereGeometry(1.8 + Math.sin(progress * Math.PI) * 1.2, 16, 16);
      const barrierMat = new THREE.MeshBasicMaterial({
        color: selectedReaction.isExothermic ? 0xf59e0b : 0x06b6d4,
        transparent: true,
        opacity: (1 - Math.abs(progress - 0.5) / 0.15) * 0.25,
        wireframe: true,
      });
      group.add(new THREE.Mesh(barrierGeo, barrierMat));
    }

    const t = progress;
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
        const moltenMat = new THREE.MeshPhysicalMaterial({ color: 0xffaa00, emissive: 0xff4400, emissiveIntensity: 0.9 });
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
      // Cathode plate (Negative / Blue) at left
      const cathodeBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 3.0), cathodeMat);
      cathodeBox.position.set(-5.0, 0, 0);
      group.add(cathodeBox);

      // Anode plate (Positive / Red) at right
      const anodeBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 3.0), anodeMat);
      anodeBox.position.set(5.0, 0, 0);
      group.add(anodeBox);

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
      const coreMat = isPlutonium ? new THREE.MeshPhysicalMaterial({ color: 0xd946ef, roughness: 0.25, metalness: 0.8, emissive: 0xa21caf, emissiveIntensity: 0.5 }) : uraniumMat;
      const frag1Mat = isPlutonium ? new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.6 }) : bariumMat; // Xe or Ba
      const frag2Mat = isPlutonium ? new THREE.MeshPhysicalMaterial({ color: 0xec4899, roughness: 0.2, metalness: 0.6 }) : kryptonMat; // Zr or Kr

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

        // Connecting nuclear neck undergoing scission
        const neckDist = leftLobePos.distanceTo(rightLobePos);
        const neckGeo = new THREE.CylinderGeometry(0.55 * (1 - elongation * 0.7), 0.55 * (1 - elongation * 0.7), neckDist, 16);
        const neckMesh = new THREE.Mesh(neckGeo, coreMat);
        neckMesh.position.set(0, 0, 0);
        neckMesh.rotation.z = Math.PI / 2;
        group.add(neckMesh);

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
      [-1.2, 0, 1.2].forEach((z) => {
        const fieldGeo = new THREE.TorusGeometry(3.6, 0.04, 8, 32);
        const fieldMesh = new THREE.Mesh(fieldGeo, plasmaMat);
        fieldMesh.position.set(0, 0, z);
        group.add(fieldMesh);
      });

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
      const cationMat = isAgCl ? silverMat : new THREE.MeshPhysicalMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.7 });
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
      const znPlateGeo = new THREE.BoxGeometry(0.5, 4.0, 2.5);
      const znPlate = new THREE.Mesh(znPlateGeo, zincMat);
      znPlate.position.set(-3.2, 0, 0);
      group.add(znPlate);

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
        const waterPlaneGeo = new THREE.PlaneGeometry(8, 6);
        const waterPlaneMat = new THREE.MeshPhysicalMaterial({ color: 0x0284c7, transparent: true, opacity: 0.35, roughness: 0.1 });
        const waterMesh = new THREE.Mesh(waterPlaneGeo, waterPlaneMat);
        waterMesh.rotation.x = -Math.PI / 2;
        group.add(waterMesh);
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
        const rustMat = new THREE.MeshPhysicalMaterial({ color: 0x9a3412, roughness: 0.9, clearcoat: 0.1 });
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
  }, [selectedReaction, progress, sceneReady]);

  // Current stage description
  const currentStage = useMemo(() => {
    if (progress >= 0.999) {
      return {
        progress: 1.0,
        title: 'Reaction Complete (Products Formed)',
        stateName: 'Final Products',
        description: `Reaction finished! All reactants have reacted to produce ${selectedReaction.products
          .map((p) => `${p.count > 1 ? `${p.count} ` : ''}${p.formula} (${p.name})`)
          .join(', ')}. The reaction has reached completion.`,
      };
    }
    return (
      selectedReaction.stages.find((s, idx) => {
        const next = selectedReaction.stages[idx + 1];
        if (!next) return true;
        return progress <= next.progress;
      }) || selectedReaction.stages[0]
    );
  }, [selectedReaction, progress]);

  const handleSelectReaction = (rx: ChemicalReaction) => {
    setSelectedReaction(rx);
    setProgress(0);
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
      setProgress(0);
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
    setProgress(0);
    setIsPlaying(true);
    setCompletedBannerDismissed(false);
    completionSoundFiredRef.current = false;
    soundFx.playReactionStep();
  };

  const handleReplay = () => {
    setProgress(0);
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
            <div className="backdrop-blur-xl bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-950/60 text-slate-100 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-sm">Reaction Complete! (100% Converted)</h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                        {selectedReaction.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      All reactants transformed into final molecular products
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
                  <span className="text-emerald-400 font-mono text-[10px] font-bold">Yield: 100% Complete</span>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-emerald-500/30">
                  {selectedReaction.equation}
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
                      <span>{p.count > 1 ? `${p.count} ` : ''}{p.formula}</span>
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
              <span>Reaction Complete (100%)</span>
              <span className="text-[10px] text-slate-400 underline">Show Summary</span>
            </button>
          </div>
        )}

        {/* Top-Left Reaction Badge & Quick Browser */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-md pointer-events-auto">
          {/* Active Reaction Card */}
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-3 shadow-xl">
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
            <p className="text-xs font-mono text-sky-300 font-semibold mt-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              {selectedReaction.equation}
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
          <div className="flex flex-col gap-1.5 backdrop-blur-md bg-slate-900/75 border border-slate-800/80 rounded-xl p-2 shadow-md">
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

        {/* Top-Right Reaction Coordinate Energy Diagram */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 pointer-events-auto">
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-3 shadow-xl w-72">
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
                    strokeWidth="2.5"
                  />
                ) : (
                  <path
                    d="M 15 65 C 70 65, 100 15, 120 15 C 140 15, 170 40, 225 40"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                  />
                )}

                {/* Activation energy barrier line */}
                <line x1="120" y1="15" x2="120" y2={selectedReaction.isExothermic ? 50 : 65} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                <text x="125" y="32" fill="#f59e0b" fontSize="8" fontFamily="monospace">
                  Ea = {selectedReaction.activationEnergyEa} kJ
                </text>

                {/* Live Progress Marker Dot */}
                {(() => {
                  const t = progress;
                  const x = 15 + t * 210;
                  let y = 50;
                  if (selectedReaction.isExothermic) {
                    if (t < 0.5) {
                      const localT = t / 0.5;
                      y = 50 - Math.sin(localT * (Math.PI / 2)) * 35;
                    } else {
                      const localT = (t - 0.5) / 0.5;
                      y = 15 + Math.sin(localT * (Math.PI / 2)) * 50;
                    }
                  } else {
                    if (t < 0.5) {
                      const localT = t / 0.5;
                      y = 65 - Math.sin(localT * (Math.PI / 2)) * 50;
                    } else {
                      const localT = (t - 0.5) / 0.5;
                      y = 15 + Math.sin(localT * (Math.PI / 2)) * 25;
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

            <div className="text-[11px] font-mono text-slate-400 mt-2 flex items-center justify-between">
              <span className="truncate max-w-[190px]">
                {progress >= 0.999 ? 'Reaction Complete' : `Current: ${currentStage.stateName}`}
              </span>
              <span className={`font-bold ${progress >= 0.999 ? 'text-emerald-400' : 'text-sky-300'}`}>
                {progress >= 0.999 ? '100% (Done)' : `${Math.round(progress * 100)}%`}
              </span>
            </div>
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
                      <p className="text-xs font-mono text-sky-400 font-semibold mt-1">
                        {rx.equation}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {rx.description}
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
        <div className="backdrop-blur-xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-4.5rem)]">
          {/* Collapse Bar */}
          <div
            onClick={() => setDockCollapsed(!dockCollapsed)}
            className="w-full shrink-0 py-1.5 px-3 sm:px-4 bg-slate-800/80 hover:bg-slate-800 border-b border-slate-800/80 flex items-center justify-between cursor-pointer text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">Chemical Kinetics & Mechanism Controller</span>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                [Stage: {currentStage.title}]
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-medium text-sky-300">
              <span>{dockCollapsed ? '▴ Expand Controls' : '▾ Collapse Controls'}</span>
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
                      Reaction Complete (100% Converted)
                    </span>
                  ) : (
                    <span className="text-slate-300 font-medium">Scrub Reaction Progress:</span>
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

                  <span className={`font-mono font-bold text-xs ${progress >= 0.999 ? 'text-emerald-400' : 'text-sky-300'}`}>
                    {Math.round(progress * 100)}%
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
                    setProgress(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-sky-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Stage Description & Mechanism Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="font-semibold text-sky-300 block mb-1">Current Molecular Mechanism:</span>
                <p className="text-slate-300 text-[12px] leading-relaxed">{currentStage.description}</p>
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
                    {selectedReaction.thermodynamicsSummary || (selectedReaction.isExothermic
                      ? `Exothermic release of ${Math.abs(selectedReaction.enthalpyDeltaH)} kJ/mol.`
                      : `Endothermic absorption of +${selectedReaction.enthalpyDeltaH} kJ/mol.`)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
