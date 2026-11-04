import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls, setupStandardRenderer, setupSceneEnvironment, isSoftwareGl } from '../utils/three-setup';
import { MoleculeData, MolecularAtom, MolecularBond } from '../types/chemistry';
import { MOLECULES } from '../data/molecules';
import { getElement } from '../data/elements';
import { soundFx } from '../utils/audio';
import { searchPubChem, fetchPubChem3D, PubChemSearchResult } from '../services/pubchem';
import {
  RotateCcw,
  Play,
  Pause,
  Thermometer,
  Layers,
  Compass,
  Ruler,
  Eye,
  Sliders,
  Search,
  Globe,
  Loader2,
  ExternalLink,
  Sparkles,
  Filter,
  X,
  ChevronDown,
  Zap,
  Activity,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { BondStrengthIndicator } from './BondStrengthIndicator';
import { getBondPhysics, BondPhysicsData } from '../utils/bondPhysics';

interface MoleculeSimulator3DProps {
  initialMoleculeId?: string;
  theme?: 'dark' | 'light';
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Molecules' },
  { id: 'simple_inorganic', label: 'Inorganic & VSEPR' },
  { id: 'neurotransmitter', label: 'Neurotransmitters' },
  { id: 'pharmaceutical', label: 'Pharmaceuticals' },
  { id: 'biomolecule', label: 'Biomolecules' },
  { id: 'organic', label: 'Organics' },
  { id: 'acid_base', label: 'Acids & Bases' },
];

const POPULAR_SEARCH_PRESETS = [
  'Dopamine',
  'Serotonin',
  'Ibuprofen',
  'Penicillin',
  'Caffeine',
  'Cholesterol',
  'Melatonin',
  'Capsaicin',
  'Citric acid',
  'Morphine',
  'Epinephrine',
  'Vanillin',
  'Paracetamol',
  'Nicotine',
  'Glucose',
];

export const MoleculeSimulator3D: React.FC<MoleculeSimulator3DProps> = ({
  initialMoleculeId = 'water',
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dynamic list of molecules (curated + user-searched from PubChem)
  const [customMolecules, setCustomMolecules] = useState<MoleculeData[]>([]);
  const allMolecules = useMemo(() => [...MOLECULES, ...customMolecules], [customMolecules]);

  // Active molecule
  const [selectedMolecule, setSelectedMolecule] = useState<MoleculeData>(() => {
    return MOLECULES.find((m) => m.id === initialMoleculeId) || MOLECULES[0];
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [renderStyle, setRenderStyle] = useState<'ball_and_stick' | 'space_filling'>('ball_and_stick');
  const [showDipole, setShowDipole] = useState<boolean>(true);
  const [showPartialCharges, setShowPartialCharges] = useState<boolean>(true);
  const [temperatureK, setTemperatureK] = useState<number>(298); // Room temp 298 K
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [sceneReady, setSceneReady] = useState<number>(0);

  // Dynamic refs to avoid tearing down the WebGL scene when controls change
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const autoRotateRef = useRef<boolean>(autoRotate);
  autoRotateRef.current = autoRotate;

  const temperatureKRef = useRef<number>(temperatureK);
  temperatureKRef.current = temperatureK;

  const selectedMoleculeRef = useRef<MoleculeData>(selectedMolecule);
  selectedMoleculeRef.current = selectedMolecule;

  // PubChem Search Modal state
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<PubChemSearchResult[]>([]);
  const [loadingCid, setLoadingCid] = useState<number | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // Measurement tool state: clicking atoms to measure distance (2 atoms) or angle (3 atoms)
  const [selectedAtomIds, setSelectedAtomIds] = useState<string[]>([]);
  const [measurementResult, setMeasurementResult] = useState<{
    type: 'distance' | 'angle';
    value: number;
    text: string;
  } | null>(null);

  // Hovered atom
  const [hoveredAtom, setHoveredAtom] = useState<MolecularAtom | null>(null);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const moleculeGroupRef = useRef<THREE.Group | null>(null);
  const dipoleArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const atomMeshesRef = useRef<Map<string, { mesh: THREE.Mesh; atom: MolecularAtom; basePos: THREE.Vector3 }>>(new Map());
  const bondHitMeshesRef = useRef<THREE.Mesh[]>([]);
  const lastLiveLengthUpdateRef = useRef<number>(0);

  // Real-time Bond selection & strength indicator state
  const [selectedBondIndex, setSelectedBondIndex] = useState<number | null>(() => {
    return selectedMolecule.bonds.length > 0 ? 0 : null;
  });
  const [liveBondLength, setLiveBondLength] = useState<number>(0);
  const [showBondInspector, setShowBondInspector] = useState<boolean>(true);

  const selectedBondIndexRef = useRef<number | null>(selectedBondIndex);
  selectedBondIndexRef.current = selectedBondIndex;

  // Active selected bond
  const selectedBond = useMemo(() => {
    if (selectedBondIndex === null || !selectedMolecule.bonds[selectedBondIndex]) return null;
    return selectedMolecule.bonds[selectedBondIndex];
  }, [selectedMolecule, selectedBondIndex]);

  // Chemical and physical properties of the selected bond
  const selectedBondPhysics = useMemo(() => {
    if (!selectedBond) return null;
    const a1 = selectedMolecule.atoms.find((a) => a.id === selectedBond.from);
    const a2 = selectedMolecule.atoms.find((a) => a.id === selectedBond.to);
    if (!a1 || !a2) return null;
    return getBondPhysics(a1.element, a2.element, selectedBond.order);
  }, [selectedBond, selectedMolecule]);

  // Filter molecules by category and instant search query
  const filteredMolecules = useMemo(() => {
    let list = activeCategory === 'all' ? allMolecules : allMolecules.filter((m) => m.category === activeCategory);
    if (librarySearch.trim()) {
      const q = librarySearch.trim().toLowerCase();
      const qNoSub = q.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 8320));
      list = list.filter((m) => {
        const nameMatch = m.name.toLowerCase().includes(q);
        const formulaNorm = m.formula.toLowerCase().replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 8320));
        const formulaMatch = formulaNorm.includes(qNoSub) || m.formula.toLowerCase().includes(q);
        const iupacMatch = m.iupacName?.toLowerCase().includes(q);
        return nameMatch || formulaMatch || iupacMatch;
      });
    }
    return list;
  }, [allMolecules, activeCategory, librarySearch]);

  // Setup Three.js scene (Only runs once on mount or theme change; never tears down on controls)
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x050814 : 0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 11);
    cameraRef.current = camera;

    const renderer = setupStandardRenderer(canvas);
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 45;
    controls.minDistance = 2;
    controlsRef.current = controls;

    const disposeEnv = setupSceneEnvironment(renderer, scene);

    // Studio 3-point lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(8, 12, 10);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    fillLight.position.set(-8, -4, -6);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.1);
    scene.add(hemiLight);

    // Molecule root group
    const molGroup = new THREE.Group();
    scene.add(molGroup);
    moleculeGroupRef.current = molGroup;

    // Soft contact shadow disc
    const shadowGeo = new THREE.PlaneGeometry(18, 18);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x000000 : 0x94a3b8,
      transparent: true,
      opacity: theme === 'dark' ? 0.35 : 0.12,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -3.5;
    scene.add(shadowMesh);

    // Signal that scene is ready to populate molecules
    setSceneReady((prev) => prev + 1);

    // Raycasting for atom selection / measurement tool
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      if (!canvasRef.current || !cameraRef.current || !moleculeGroupRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const atomMeshObjects = Array.from(atomMeshesRef.current.values()).map((v) => v.mesh);
      const bondHitObjects = bondHitMeshesRef.current;
      const intersects = raycaster.intersectObjects([...atomMeshObjects, ...bondHitObjects], false);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hit.userData.type === 'bond' && typeof hit.userData.bondIndex === 'number') {
          soundFx.playBondSnap();
          setSelectedBondIndex(hit.userData.bondIndex);
          setShowBondInspector(true);
          setSelectedAtomIds([]);
          setMeasurementResult(null);
          return;
        }
        const atomId = hit.userData.atomId;
        if (atomId) {
          handleAtomClick(atomId);
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!canvasRef.current || !cameraRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const atomMeshObjects = Array.from(atomMeshesRef.current.values()).map((v) => v.mesh);
      const bondHitObjects = bondHitMeshesRef.current;
      const intersects = raycaster.intersectObjects([...atomMeshObjects, ...bondHitObjects], false);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hit.userData.type === 'bond') {
          setHoveredAtom(null);
          if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
          return;
        }
        const atomData = hit.userData.atomData as MolecularAtom;
        if (atomData) {
          setHoveredAtom(atomData);
          if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredAtom(null);
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    };

    canvas.addEventListener('click', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current;
        controlsRef.current.update();
      }

      // Thermal vibration simulation (harmonic atomic oscillation proportional to Temperature)
      if (moleculeGroupRef.current) {
        if (isPlayingRef.current && temperatureKRef.current > 0) {
          const thermalAmp = (temperatureKRef.current / 600) * 0.055; // vibration amplitude in Ångströms
          atomMeshesRef.current.forEach(({ mesh, basePos }, id) => {
            const charCode = id.charCodeAt(id.length - 1) || 1;
            const freq = 12 + (charCode % 5);
            const dx = Math.sin(elapsed * freq + charCode) * thermalAmp;
            const dy = Math.cos(elapsed * (freq * 1.1) + charCode * 2) * thermalAmp;
            const dz = Math.sin(elapsed * (freq * 0.9) + charCode * 3) * thermalAmp;
            mesh.position.set(basePos.x + dx, basePos.y + dy, basePos.z + dz);
          });
        } else {
          // When paused or at 0K, snap atoms firmly to resting base positions
          atomMeshesRef.current.forEach(({ mesh, basePos }) => {
            mesh.position.copy(basePos);
          });
        }

        // Live bond length calculation for dynamic strength & potential indicator
        if (selectedBondIndexRef.current !== null) {
          const curMol = selectedMoleculeRef.current;
          const activeBond = curMol?.bonds[selectedBondIndexRef.current];
          if (activeBond) {
            const a1 = atomMeshesRef.current.get(activeBond.from);
            const a2 = atomMeshesRef.current.get(activeBond.to);
            if (a1 && a2) {
              const liveDist = a1.mesh.position.distanceTo(a2.mesh.position);
              const now = performance.now();
              if (now - lastLiveLengthUpdateRef.current > 40) {
                lastLiveLengthUpdateRef.current = now;
                setLiveBondLength(Number(liveDist.toFixed(4)));
              }
            }
          }
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
      canvas.removeEventListener('click', handlePointerDown);
      canvas.removeEventListener('mousemove', handlePointerMove);
      disposeEnv();
      renderer.dispose();
    };
  }, [theme]);

  // Atom selection and angle/distance measurement handler
  const handleAtomClick = (atomId: string) => {
    soundFx.playBondSnap();
    setSelectedAtomIds((prev) => {
      let updated: string[];
      if (prev.includes(atomId)) {
        updated = prev.filter((id) => id !== atomId);
      } else {
        if (prev.length >= 3) {
          updated = [atomId];
        } else {
          updated = [...prev, atomId];
        }
      }

      // Calculate measurements
      const mol = selectedMoleculeRef.current;
      if (updated.length === 2) {
        const a1 = mol.atoms.find((a) => a.id === updated[0]);
        const a2 = mol.atoms.find((a) => a.id === updated[1]);
        if (a1 && a2) {
          const v1 = new THREE.Vector3(...a1.position);
          const v2 = new THREE.Vector3(...a2.position);
          const distAngstrom = v1.distanceTo(v2);
          const distPm = Math.round(distAngstrom * 100);
          setMeasurementResult({
            type: 'distance',
            value: Number(distAngstrom.toFixed(3)),
            text: `Distance between ${a1.element}(${a1.id}) and ${a2.element}(${a2.id}): ${distAngstrom.toFixed(2)} Å (${distPm} pm)`,
          });
        }
      } else if (updated.length === 3) {
        const a1 = mol.atoms.find((a) => a.id === updated[0]);
        const a2 = mol.atoms.find((a) => a.id === updated[1]); // Vertex
        const a3 = mol.atoms.find((a) => a.id === updated[2]);
        if (a1 && a2 && a3) {
          const v1 = new THREE.Vector3(...a1.position).sub(new THREE.Vector3(...a2.position));
          const v3 = new THREE.Vector3(...a3.position).sub(new THREE.Vector3(...a2.position));
          const angleRad = v1.angleTo(v3);
          const angleDeg = Number(((angleRad * 180) / Math.PI).toFixed(1));
          setMeasurementResult({
            type: 'angle',
            value: angleDeg,
            text: `Bond Angle ∠ ${a1.element}-${a2.element}-${a3.element}: ${angleDeg}° (Ideal: ${mol.idealBondAngle})`,
          });
        }
      } else {
        setMeasurementResult(null);
      }

      return updated;
    });
  };

  // Rebuild 3D Molecule Mesh (Atoms, Bonds, Dipole Vector)
  useEffect(() => {
    const group = moleculeGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      group.remove(child);
    }
    atomMeshesRef.current.clear();

    // Compute center of mass to center the molecule at (0, 0, 0)
    const com = new THREE.Vector3(0, 0, 0);
    selectedMolecule.atoms.forEach((a) => {
      com.add(new THREE.Vector3(...a.position));
    });
    com.divideScalar(Math.max(selectedMolecule.atoms.length, 1));

    const isSpaceFilling = renderStyle === 'space_filling';
    const atomRadiusMap: Record<string, number> = {
      H: isSpaceFilling ? 1.1 : 0.32,
      C: isSpaceFilling ? 1.7 : 0.52,
      N: isSpaceFilling ? 1.55 : 0.48,
      O: isSpaceFilling ? 1.52 : 0.46,
      F: isSpaceFilling ? 1.47 : 0.42,
      B: isSpaceFilling ? 1.65 : 0.50,
      Na: isSpaceFilling ? 2.27 : 0.65,
      Mg: isSpaceFilling ? 1.73 : 0.58,
      P: isSpaceFilling ? 1.8 : 0.56,
      S: isSpaceFilling ? 1.8 : 0.56,
      Cl: isSpaceFilling ? 1.75 : 0.55,
      Br: isSpaceFilling ? 1.85 : 0.60,
      I: isSpaceFilling ? 1.98 : 0.68,
    };

    // 1. Render Atoms
    selectedMolecule.atoms.forEach((atom) => {
      const el = getElement(atom.element);
      const colorHex = el ? el.cpkColor : '#cccccc';
      const radius = atomRadiusMap[atom.element] || (isSpaceFilling ? 1.6 : 0.5);

      const sphereGeo = new THREE.SphereGeometry(radius, 32, 32);
      const sphereMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.25,
        metalness: 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
      });

      // Highlight if selected in measurement tool or connected to the selected bond
      const isSelected = selectedAtomIds.includes(atom.id);
      const isBondParticipant = selectedBond && (selectedBond.from === atom.id || selectedBond.to === atom.id);
      if (isSelected) {
        sphereMat.emissive = new THREE.Color(0xf59e0b);
        sphereMat.emissiveIntensity = 0.55;
      } else if (isBondParticipant) {
        sphereMat.emissive = new THREE.Color(0x06b6d4);
        sphereMat.emissiveIntensity = 0.45;
      }

      const atomMesh = new THREE.Mesh(sphereGeo, sphereMat);
      const centeredPos = new THREE.Vector3(...atom.position).sub(com);
      atomMesh.position.copy(centeredPos);
      atomMesh.castShadow = true;
      atomMesh.receiveShadow = true;

      atomMesh.userData = {
        atomId: atom.id,
        atomData: atom,
      };

      // Add partial charge indicator ring or aura if enabled
      if (showPartialCharges && (atom.partialCharge || atom.formalCharge)) {
        const chargeVal = atom.formalCharge || atom.partialCharge || 0;
        const isNegative = chargeVal < 0;
        const chargeColor = isNegative ? 0xef4444 : 0x38bdf8;
        const auraGeo = new THREE.SphereGeometry(radius * 1.18, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({
          color: chargeColor,
          transparent: true,
          opacity: Math.min(Math.abs(chargeVal) * 0.45, 0.4),
          wireframe: true,
        });
        atomMesh.add(new THREE.Mesh(auraGeo, auraMat));
      }

      group.add(atomMesh);
      atomMeshesRef.current.set(atom.id, {
        mesh: atomMesh,
        atom,
        basePos: centeredPos.clone(),
      });
    });

    // 2. Render Bonds (Only in Ball-and-Stick Mode)
    bondHitMeshesRef.current = [];

    if (!isSpaceFilling) {
      const defaultBondMat = new THREE.MeshPhysicalMaterial({
        color: 0x94a3b8,
        roughness: 0.35,
        metalness: 0.2,
      });

      const selectedBondMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.2,
      });

      const ionicMat = new THREE.MeshBasicMaterial({
        color: 0xcbd5e1,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });

      selectedMolecule.bonds.forEach((bond, bondIndex) => {
        const a1 = selectedMolecule.atoms.find((a) => a.id === bond.from);
        const a2 = selectedMolecule.atoms.find((a) => a.id === bond.to);
        if (!a1 || !a2) return;

        const p1 = new THREE.Vector3(...a1.position).sub(com);
        const p2 = new THREE.Vector3(...a2.position).sub(com);
        const dist = p1.distanceTo(p2);
        const midPoint = p1.clone().add(p2).multiplyScalar(0.5);

        const dir = p2.clone().sub(p1).normalize();
        const isIonic = bond.type === 'ionic';
        const isSelectedBond = selectedBondIndex === bondIndex;
        const activeMat = isSelectedBond ? selectedBondMat : isIonic ? ionicMat : defaultBondMat;

        // Hit-test cylinder proxy with wider radius for easy mouse/touch picking
        const hitGeo = new THREE.CylinderGeometry(0.26, 0.26, dist, 8);
        const hitMat = new THREE.MeshBasicMaterial({
          visible: false,
          depthWrite: false,
        });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.copy(midPoint);
        hitMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        hitMesh.userData = { type: 'bond', bondIndex, bondId: bond.id };
        group.add(hitMesh);
        bondHitMeshesRef.current.push(hitMesh);

        if (bond.order === 1 || isIonic) {
          const r = isIonic ? 0.04 : isSelectedBond ? 0.11 : 0.09;
          const bondGeo = new THREE.CylinderGeometry(r, r, dist, 16);
          const bMesh = new THREE.Mesh(bondGeo, activeMat);
          bMesh.position.copy(midPoint);
          bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          group.add(bMesh);
        } else if (bond.order === 2) {
          const offset = 0.11;
          let perp = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
          if (perp.lengthSq() < 0.01) {
            perp = new THREE.Vector3(1, 0, 0).cross(dir).normalize();
          }

          const r = isSelectedBond ? 0.08 : 0.065;
          [-1, 1].forEach((sign) => {
            const bondGeo = new THREE.CylinderGeometry(r, r, dist, 12);
            const bMesh = new THREE.Mesh(bondGeo, activeMat);
            const shiftedMid = midPoint.clone().addScaledVector(perp, sign * offset);
            bMesh.position.copy(shiftedMid);
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            group.add(bMesh);
          });
        } else if (bond.order === 3) {
          const offset = 0.12;
          const perp1 = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
          const perp2 = dir.clone().cross(perp1).normalize();
          const r = isSelectedBond ? 0.07 : 0.055;

          [
            new THREE.Vector3(0, 0, 0),
            perp1.clone().multiplyScalar(offset),
            perp2.clone().multiplyScalar(offset),
          ].forEach((shift) => {
            const bondGeo = new THREE.CylinderGeometry(r, r, dist, 12);
            const bMesh = new THREE.Mesh(bondGeo, activeMat);
            bMesh.position.copy(midPoint.clone().add(shift));
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            group.add(bMesh);
          });
        }

        // Glowing outer halo cylinder when bond is selected
        if (isSelectedBond) {
          const haloGeo = new THREE.CylinderGeometry(0.18, 0.18, dist * 0.96, 16);
          const haloMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.65,
            wireframe: true,
          });
          const haloMesh = new THREE.Mesh(haloGeo, haloMat);
          haloMesh.position.copy(midPoint);
          haloMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          group.add(haloMesh);
        }
      });
    }

    // 3. Render Net Molecular Dipole Vector (Arrow)
    if (showDipole && selectedMolecule.isPolar && selectedMolecule.dipoleMomentDebye > 0) {
      const netDipoleVec = new THREE.Vector3(0, 0, 0);
      selectedMolecule.atoms.forEach((a) => {
        const q = a.formalCharge || a.partialCharge || 0;
        const pos = new THREE.Vector3(...a.position).sub(com);
        netDipoleVec.add(pos.multiplyScalar(q));
      });

      if (netDipoleVec.lengthSq() > 0.01) {
        const dir = netDipoleVec.clone().normalize();
        const length = Math.min(Math.max(selectedMolecule.dipoleMomentDebye * 1.1, 1.8), 4.2);
        const origin = new THREE.Vector3(0, 1.8, 0);
        const arrow = new THREE.ArrowHelper(dir, origin, length, 0xf59e0b, 0.5, 0.35);
        group.add(arrow);
        dipoleArrowRef.current = arrow;
      }
    }
  }, [selectedMolecule, renderStyle, showDipole, showPartialCharges, selectedAtomIds, selectedBondIndex, sceneReady]);

  const handleSelectMolecule = (mol: MoleculeData) => {
    setSelectedMolecule(mol);
    setSelectedAtomIds([]);
    setMeasurementResult(null);
    setSelectedBondIndex(mol.bonds.length > 0 ? 0 : null);
    setLiveBondLength(0);
    soundFx.playReactionStep();
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 3, 11);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Perform PubChem search
  const handlePerformPubChemSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setSearchStatus(null);
    setSearchResults([]);

    try {
      const results = await searchPubChem(q);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchStatus(`No exact chemical matching "${q}" found in PubChem. Try a common synonym or drug name (e.g. Paracetamol, Caffeine, Aspirin).`);
      }
    } catch {
      setSearchStatus('PubChem query failed. Please check network connection.');
    } finally {
      setIsSearching(false);
    }
  };

  // Load 3D conformer from PubChem result into simulator
  const handleLoadPubChemCompound = async (item: PubChemSearchResult) => {
    setLoadingCid(item.cid);
    setSearchStatus(`Retrieving 3D spatial conformer for ${item.title}...`);

    try {
      const molData = await fetchPubChem3D(item);
      if (molData && molData.atoms.length > 0) {
        setCustomMolecules((prev) => {
          const filtered = prev.filter((m) => m.pubchemCid !== item.cid && m.id !== molData.id);
          return [molData, ...filtered];
        });
        setSelectedMolecule(molData);
        setSelectedAtomIds([]);
        setMeasurementResult(null);
        setSelectedBondIndex(molData.bonds.length > 0 ? 0 : null);
        setLiveBondLength(0);
        setShowSearchModal(false);
        soundFx.playQuizChime(true);
      } else {
        setSearchStatus(`Could not construct 3D conformer coordinates for ${item.title}.`);
      }
    } catch {
      setSearchStatus('Error downloading 3D conformer coordinates.');
    } finally {
      setLoadingCid(null);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-slate-950 text-slate-100">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="relative flex-1 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing outline-none" />

        {/* Minimal Spec Badge (Top-Left) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-md pointer-events-auto">
          <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800 rounded-xl p-3 shadow-xl flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-sky-950/80 border border-sky-500/30 flex flex-col items-center justify-center font-bold text-sky-300 shadow-md flex-shrink-0">
              <span className="text-xs font-black font-mono text-center px-1 truncate max-w-full">
                {selectedMolecule.formula}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white truncate">{selectedMolecule.name}</h2>
                {selectedMolecule.source === 'pubchem' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    PubChem CID: {selectedMolecule.pubchemCid}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      selectedMolecule.isPolar
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedMolecule.isPolar ? `Polar (${selectedMolecule.dipoleMomentDebye} D)` : 'Non-Polar (0 D)'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                VSEPR: {selectedMolecule.vseprGeometry} • {selectedMolecule.idealBondAngle}
              </p>
            </div>
          </div>

          {/* Category Filter Pills & Search Trigger */}
          <div className="flex flex-col gap-1.5 backdrop-blur-md bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 shadow-md max-w-md">
            {/* Top row: PubChem Search Button & Filter Title */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400">
                Library: {filteredMolecules.length} {filteredMolecules.length === 1 ? 'Molecule' : 'Molecules'}
              </span>
              <button
                onClick={() => {
                  setShowSearchModal(true);
                  if (librarySearch.trim()) {
                    setSearchQuery(librarySearch);
                    handlePerformPubChemSearch(librarySearch);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-semibold shadow-sm transition-all"
              >
                <Globe className="w-3 h-3" />
                <span>Search PubChem NCBI</span>
              </button>
            </div>

            {/* Instant In-Library Search Input */}
            <div className="relative my-0.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or formula (e.g. Water, Caffeine, CO2, Aspirin)..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              {librarySearch && (
                <button
                  onClick={() => setLibrarySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1">
              {CATEGORY_TABS.map((cat) => (
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

            {/* Molecule Selector Chips */}
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1 mt-0.5">
              {filteredMolecules.map((m) => {
                const isSelected = selectedMolecule.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMolecule(m)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-sky-500 text-white font-bold shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                    title={`${m.name} (${m.formula})`}
                  >
                    <span>{m.formula}</span>
                    <span className="text-[10px] opacity-75 font-sans">{m.name}</span>
                  </button>
                );
              })}
            </div>

            {filteredMolecules.length === 0 && (
              <div className="p-2 text-center text-xs text-slate-400 bg-slate-950/50 rounded-lg border border-slate-800/60 mt-1">
                <p>No local molecule matching "{librarySearch}"</p>
                <button
                  onClick={() => {
                    setSearchQuery(librarySearch);
                    setShowSearchModal(true);
                    handlePerformPubChemSearch(librarySearch);
                  }}
                  className="mt-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline flex items-center justify-center gap-1 mx-auto"
                >
                  <Search className="w-3 h-3" />
                  Search PubChem global database for "{librarySearch}" ➔
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right Rendering & Bond/Measurement Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 pointer-events-auto max-w-[calc(100vw-2rem)] sm:max-w-md">
          {/* Style switch and Bond Inspector trigger */}
          <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-lg">
            <button
              onClick={() => setRenderStyle('ball_and_stick')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                renderStyle === 'ball_and_stick'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Ball & Stick
            </button>
            <button
              onClick={() => setRenderStyle('space_filling')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                renderStyle === 'space_filling'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Space-Filling
            </button>
            {selectedMolecule.bonds.length > 0 && (
              <button
                onClick={() => {
                  setShowBondInspector((prev) => !prev);
                  if (!showBondInspector && selectedBondIndex === null) {
                    setSelectedBondIndex(0);
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  showBondInspector && selectedBondIndex !== null
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800'
                }`}
                title="Toggle Bond Strength & Energy Inspector"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Bond Inspector</span>
              </button>
            )}
          </div>

          {/* Quick Bond Selector Pills Bar */}
          {selectedMolecule.bonds.length > 0 && (
            <div className="backdrop-blur-md bg-slate-900/85 border border-slate-800/80 rounded-xl px-2.5 py-1.5 shadow-md flex items-center gap-1.5 max-w-full overflow-x-auto">
              <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Bonds:
              </span>
              <div className="flex items-center gap-1">
                {selectedMolecule.bonds.map((b, idx) => {
                  const a1 = selectedMolecule.atoms.find((a) => a.id === b.from);
                  const a2 = selectedMolecule.atoms.find((a) => a.id === b.to);
                  const orderSym = b.order === 3 ? '≡' : b.order === 2 ? '=' : '—';
                  const isSel = selectedBondIndex === idx;
                  return (
                    <button
                      key={b.id || idx}
                      onClick={() => {
                        setSelectedBondIndex(idx);
                        setShowBondInspector(true);
                        soundFx.playBondSnap();
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all whitespace-nowrap ${
                        isSel
                          ? 'bg-sky-500 text-white font-bold shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {a1?.element || b.from}{orderSym}{a2?.element || b.to}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Real-time Bond Strength Indicator HUD */}
          {showBondInspector && selectedBond && selectedBondPhysics && (
            <BondStrengthIndicator
              bond={selectedBond}
              allBonds={selectedMolecule.bonds}
              atoms={selectedMolecule.atoms}
              bondPhysics={selectedBondPhysics}
              instantaneousLength={liveBondLength}
              temperatureK={temperatureK}
              onSelectBondIndex={(idx) => {
                setSelectedBondIndex(idx);
                soundFx.playBondSnap();
              }}
              onClose={() => {
                setShowBondInspector(false);
              }}
            />
          )}

          {/* Interactive Measurement HUD Card (when atoms are selected) */}
          {(selectedAtomIds.length > 0 || !showBondInspector) && (
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl max-w-xs shadow-md text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-sky-400 font-medium mb-1">
                <Ruler className="w-3.5 h-3.5" />
                <span>3D Geometry Measurement Tool</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {selectedAtomIds.length === 0 && 'Click any 2 atoms for distance, or 3 for bond angle.'}
                {selectedAtomIds.length === 1 && `Selected atom ${selectedAtomIds[0]}. Click a second atom.`}
                {selectedAtomIds.length >= 2 && measurementResult?.text}
              </p>
              {selectedAtomIds.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedAtomIds([]);
                    setMeasurementResult(null);
                  }}
                  className="text-[10px] text-rose-400 hover:underline mt-1 inline-block"
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}

          {/* Hovered Atom Tooltip */}
          {hoveredAtom && (
            <div className="bg-slate-900/90 backdrop-blur-md border border-sky-500/40 p-2 rounded-lg text-xs text-left shadow-lg">
              <span className="font-bold text-sky-300">
                {hoveredAtom.element} ({hoveredAtom.id})
              </span>
              <span className="text-slate-400 font-mono block text-[11px]">
                Coord: [{hoveredAtom.position.map((v) => v.toFixed(2)).join(', ')}] Å
              </span>
              {hoveredAtom.hybridization && (
                <span className="text-[10px] text-amber-400 font-mono block">Hybridization: {hoveredAtom.hybridization}</span>
              )}
            </div>
          )}
        </div>

        {/* Floating Viewport Controls (Right Middle) */}
        <div className="absolute right-2 sm:right-4 bottom-14 sm:bottom-24 z-10 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2.5 rounded-xl border border-slate-800 shadow-lg transition-all ${
              autoRotate ? 'bg-sky-500 text-white' : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200'
            }`}
            title="Auto-Rotate Camera"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 shadow-lg transition-all"
            title={isPlaying ? 'Pause Thermal Vibrations' : 'Play Vibrations'}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-sky-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* PubChem Chemical Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-slate-200 max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-white text-base">NCBI PubChem 3D Chemical Search</h3>
                  <p className="text-[11px] text-slate-400">Search millions of chemical conformers & drugs</p>
                </div>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter chemical or drug name (e.g. Dopamine, Penicillin, Ibuprofen, Morphine)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePerformPubChemSearch();
                  }}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
              <button
                onClick={() => handlePerformPubChemSearch()}
                disabled={isSearching}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all flex-shrink-0"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Popular quick presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Quick suggestions:</span>
              {POPULAR_SEARCH_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setSearchQuery(preset);
                    handlePerformPubChemSearch(preset);
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Status / Error Message */}
            {searchStatus && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                {loadingCid && <Loader2 className="w-4 h-4 animate-spin text-sky-400" />}
                <span>{searchStatus}</span>
              </div>
            )}

            {/* Results list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              {searchResults.map((item) => {
                const isLoadingThis = loadingCid === item.cid;
                return (
                  <div
                    key={item.cid}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-sky-500/50 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{item.title}</span>
                        <span className="font-mono text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                          {item.molecularFormula}
                        </span>
                        {item.isCurated ? (
                          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Curated 3D
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                            PubChem CID {item.cid}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        {item.iupacName || (item.isCurated ? 'Lab Curated Molecular Structure' : `PubChem CID ${item.cid}`)}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                        <span>Mass: {item.molecularWeight ? item.molecularWeight.toFixed(2) : 'N/A'} g/mol</span>
                        {item.xLogP !== undefined && <span>LogP: {item.xLogP}</span>}
                        {item.tpsa !== undefined && <span>TPSA: {item.tpsa} Å²</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!item.isCurated && (
                        <a
                          href={`https://pubchem.ncbi.nlm.nih.gov/compound/${item.cid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                          title="View Official Record on NCBI PubChem"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleLoadPubChemCompound(item)}
                        disabled={isLoadingThis}
                        className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all"
                      >
                        {isLoadingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Compass className="w-3.5 h-3.5" />
                            Simulate 3D
                          </>
                        )}
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
              <span className="truncate">Molecular Dynamics & VSEPR Inspector</span>
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                [{selectedMolecule.name} • {selectedMolecule.molarMass} g/mol]
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-medium text-sky-300">
              <span>{dockCollapsed ? '▴ Expand Controls' : '▾ Collapse Controls'}</span>
            </div>
          </div>

          {/* Dock Body */}
          <div className="p-2.5 sm:p-3.5 flex flex-col gap-3 overflow-y-auto max-h-[calc(100dvh-7.5rem)] sm:max-h-[55dvh] scrollbar-thin scrollbar-thumb-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Thermal Vibration Slider */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                    Thermal Energy (Temperature)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-200">{temperatureK} K</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Simulates molecular harmonic stretching and bending</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">0K</span>
                  <input
                    type="range"
                    min={0}
                    max={800}
                    step={10}
                    value={temperatureK}
                    onChange={(e) => setTemperatureK(Number(e.target.value))}
                    className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">800K</span>
                </div>
              </div>

              {/* Polarity & Dipole Overlay Toggle */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
                <span className="text-xs font-semibold text-sky-400 mb-1 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  Visual Overlays
                </span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDipole}
                      onChange={(e) => setShowDipole(e.target.checked)}
                      className="rounded border-slate-700 text-sky-500"
                    />
                    <span>Net Dipole Vector (Arrow)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPartialCharges}
                      onChange={(e) => setShowPartialCharges(e.target.checked)}
                      className="rounded border-slate-700 text-sky-500"
                    />
                    <span>Partial Charge Aura (δ+/δ-)</span>
                  </label>
                </div>
              </div>

              {/* Physical Constants Card */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200">Thermochemical Properties</span>
                  {selectedMolecule.pubchemCid && (
                    <a
                      href={`https://pubchem.ncbi.nlm.nih.gov/compound/${selectedMolecule.pubchemCid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
                    >
                      PubChem CID {selectedMolecule.pubchemCid}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-300">
                  <span>Molar Mass:</span>
                  <span className="text-right text-sky-300">{selectedMolecule.molarMass} g/mol</span>
                  <span>Boiling Point:</span>
                  <span className="text-right text-amber-300">{selectedMolecule.boilingPointC ?? 'N/A'} °C</span>
                  <span>Melting Point:</span>
                  <span className="text-right text-cyan-300">{selectedMolecule.meltingPointC ?? 'N/A'} °C</span>
                  <span>Dipole Moment:</span>
                  <span className="text-right text-rose-300">{selectedMolecule.dipoleMomentDebye} D</span>
                </div>
              </div>
            </div>

            {/* Atomic Bonds & Dissociation Energy Matrix */}
            {selectedMolecule.bonds.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-sky-400" />
                    Atomic Bonds & Dissociation Energy Matrix ({selectedMolecule.bonds.length} Bonds)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    Click any bond to inspect live 3D length & potential well
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedMolecule.bonds.map((b, idx) => {
                    const a1 = selectedMolecule.atoms.find((a) => a.id === b.from);
                    const a2 = selectedMolecule.atoms.find((a) => a.id === b.to);
                    const phys = a1 && a2 ? getBondPhysics(a1.element, a2.element, b.order) : null;
                    const isSelected = selectedBondIndex === idx;
                    const orderSym = b.order === 3 ? '≡' : b.order === 2 ? '=' : '—';
                    return (
                      <button
                        key={b.id || idx}
                        onClick={() => {
                          setSelectedBondIndex(idx);
                          setShowBondInspector(true);
                          soundFx.playBondSnap();
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 border transition-all ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-500 text-white font-bold shadow-sm ring-1 ring-sky-500/50'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="font-sans font-bold text-sky-300">#{idx + 1}</span>
                        <span>
                          {a1?.element || b.from} {orderSym} {a2?.element || b.to}
                        </span>
                        {phys && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded font-semibold text-white ml-auto"
                            style={{ backgroundColor: phys.categoryColor }}
                          >
                            {phys.bondEnergyKj} kJ/mol
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Educational Key Facts Bar */}
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs text-slate-300">
              <span className="font-medium text-slate-200 block mb-1">Key Chemical Insights:</span>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside text-[11px] text-slate-400">
                {selectedMolecule.keyFacts.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
