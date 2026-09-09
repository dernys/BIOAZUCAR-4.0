import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Eye,
  Layers,
  Thermometer,
  Zap,
  Activity,
  Cpu,
  Info,
  ChevronRight,
  Sparkles,
  Flame,
  Gauge,
  Compass,
  Crosshair,
  Volume2,
  AlertTriangle,
  Scale,
  Sliders,
  Wrench,
  Radio,
  Wifi,
  WifiOff,
  Scan,
} from "lucide-react";
import { TelemetryData, EquipmentItem } from "../types";
import { MassEnergyTwinView } from "./digitaltwin/MassEnergyTwinView";
import { WhatIfSandboxView } from "./digitaltwin/WhatIfSandboxView";
import { DegradationRulView } from "./digitaltwin/DegradationRulView";
import { OtSyncTwinView } from "./digitaltwin/OtSyncTwinView";

export type TwinDimension = "3D_SPATIAL" | "MASS_ENERGY" | "WHAT_IF" | "DEGRADATION_RUL" | "OT_SYNC";

interface DigitalTwin3DProps {
  telemetry: TelemetryData;
  equipmentList: EquipmentItem[];
  theme?: "dark" | "light";
}

interface EquipmentCameraTarget {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  telemetry,
  equipmentList = [],
  theme = "dark",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTwinDimension, setActiveTwinDimension] = useState<TwinDimension>("3D_SPATIAL");
  const [selectedEqId, setSelectedEqId] = useState<string>("eq-molino-3");
  const [viewMode, setViewMode] = useState<"STANDARD" | "THERMAL" | "ENERGY" | "HEALTH">("STANDARD");
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [hoveredEqName, setHoveredEqName] = useState<string | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const interactiveObjectsRef = useRef<{ [key: string]: THREE.Object3D }>({});
  const animationFrameIdRef = useRef<number | null>(null);

  // Dynamic theme update for Three.js 3D WebGL scene with high-brightness industrial lighting
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const isLight = theme === "light";
    const bgCol = isLight ? 0xf8fafc : 0x0a1329;
    scene.background = new THREE.Color(bgCol);
    scene.fog = new THREE.Fog(bgCol, isLight ? 90 : 80, isLight ? 320 : 280);

    if (floorMeshRef.current && floorMeshRef.current.material) {
      (floorMeshRef.current.material as THREE.MeshStandardMaterial).color.setHex(
        isLight ? 0xe2e8f0 : 0x1e293b
      );
      (floorMeshRef.current.material as THREE.MeshStandardMaterial).roughness = isLight ? 0.65 : 0.55;
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(isLight ? 0xffffff : 0xdbeafe);
      ambientLightRef.current.intensity = isLight ? 1.2 : 1.05;
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.color.setHex(isLight ? 0xffffff : 0xdbeafe);
      hemiLightRef.current.groundColor.setHex(isLight ? 0xcbd5e1 : 0x334155);
      hemiLightRef.current.intensity = isLight ? 1.3 : 1.15;
    }
    if (sunLightRef.current) {
      sunLightRef.current.intensity = isLight ? 2.2 : 2.0;
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = isLight ? 0.9 : 0.95;
    }
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = isLight ? 1.15 : 1.35;
    }
  }, [theme]);

  // Camera animation target
  const cameraTargetRef = useRef<EquipmentCameraTarget>({
    pos: new THREE.Vector3(55, 46, 68),
    target: new THREE.Vector3(0, 5, 0),
  });

  const safeEquipmentList = Array.isArray(equipmentList) ? equipmentList : [];

  // Rich fallback profiles for all specific units of the sugar mill digital twin
  const defaultUnitProfiles: { [key: string]: Partial<EquipmentItem> } = {
    "eq-patio-cana": {
      id: "eq-patio-cana",
      name: "Básculas, Patio de Caña & Mesa Alimentadora",
      code: "REC-PAT-001",
      status: "RUNNING",
      healthIndex: 98,
      vibrationRMS: 1.1,
      vibrationThreshold: 3.5,
      temperatureC: 32,
      loadPercentage: 78,
      plcTag: "PLC00_PAT_WT001.WEIGHT",
      lastMaintenance: "2026-02-14",
    },
    "eq-preparacion": {
      id: "eq-preparacion",
      name: "Picadoras & Desfibradora Pesada (Heavy Duty)",
      code: "PREP-SHR-002",
      status: "RUNNING",
      healthIndex: 94,
      vibrationRMS: 2.8,
      vibrationThreshold: 4.5,
      temperatureC: 58,
      loadPercentage: 88,
      plcTag: "PLC00_PREP_SHR_KW.VAL",
      lastMaintenance: "2026-02-10",
    },
    "eq-subestacion": {
      id: "eq-subestacion",
      name: "Subestación Elevadora 138 kV & Transformador 40 MVA",
      code: "ELEC-SUB-138",
      status: "RUNNING",
      healthIndex: 99,
      vibrationRMS: 0.4,
      vibrationThreshold: 1.8,
      temperatureC: 44,
      loadPercentage: 72,
      plcTag: "SWGR_138KV_MVA.ACT",
      lastMaintenance: "2026-01-20",
    },
  };

  const selectedEquipment =
    safeEquipmentList.find((e) => e.id === selectedEqId) ||
    defaultUnitProfiles[selectedEqId] ||
    safeEquipmentList[0] ||
    ({
      id: selectedEqId,
      name: "Unidad de Proceso Industrial",
      code: "TAG-001",
      status: "RUNNING",
      healthIndex: 95,
      vibrationRMS: 1.8,
      vibrationThreshold: 4.0,
      temperatureC: 45,
      loadPercentage: 80,
      plcTag: "UNS_TAG.PV",
      lastMaintenance: "2026-02-01",
    } as EquipmentItem);

  // Dual Maximize / Fullscreen handling with iframe resilience
  const toggleFullscreen = () => {
    if (!isMaximized) {
      setIsMaximized(true);
      if (containerRef.current && !document.fullscreenElement && containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          // Handled smoothly by isMaximized overlay if iframe blocks HTML5 fullscreen
        });
      }
    } else {
      setIsMaximized(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Sync fullscreen state & ESC key listener
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs && isMaximized) {
        setIsMaximized(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMaximized) {
        setIsMaximized(false);
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMaximized]);

  // Camera Presets dictionary for specific sugar mill stations
  const cameraPresets: { [key: string]: EquipmentCameraTarget } = {
    overview: {
      pos: new THREE.Vector3(55, 46, 68),
      target: new THREE.Vector3(0, 5, 0),
    },
    "eq-patio-cana": {
      pos: new THREE.Vector3(-42, 18, 38),
      target: new THREE.Vector3(-42, 5, 14),
    },
    "eq-preparacion": {
      pos: new THREE.Vector3(-28, 16, 36),
      target: new THREE.Vector3(-28, 5, 14),
    },
    "eq-molino-3": {
      pos: new THREE.Vector3(-12, 16, 34),
      target: new THREE.Vector3(-12, 5, 14),
    },
    "eq-caldera-1": {
      pos: new THREE.Vector3(-20, 24, 12),
      target: new THREE.Vector3(-20, 12, -14),
    },
    "eq-turbina-1": {
      pos: new THREE.Vector3(10, 18, 10),
      target: new THREE.Vector3(10, 6, -14),
    },
    "eq-subestacion": {
      pos: new THREE.Vector3(26, 16, 10),
      target: new THREE.Vector3(24, 6, -14),
    },
    "eq-evaporadores": {
      pos: new THREE.Vector3(10, 18, 34),
      target: new THREE.Vector3(10, 6, 14),
    },
    "eq-secador-ensacado": {
      pos: new THREE.Vector3(32, 18, 34),
      target: new THREE.Vector3(32, 6, 14),
    },
  };

  const handleSelectEquipment = (eqId: string) => {
    setSelectedEqId(eqId);
    if (cameraPresets[eqId]) {
      cameraTargetRef.current = cameraPresets[eqId];
      setIsRotating(false);
      isTransitioningRef.current = true;
    }
  };

  const handleZoomIn = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dir = new THREE.Vector3();
    cameraRef.current.getWorldDirection(dir);
    cameraRef.current.position.addScaledVector(dir, 10);
    controlsRef.current.update();
  };

  const handleZoomOut = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dir = new THREE.Vector3();
    cameraRef.current.getWorldDirection(dir);
    cameraRef.current.position.addScaledVector(dir, -10);
    controlsRef.current.update();
  };

  const handleResetCamera = () => {
    handleSelectEquipment("overview");
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 560;

    // 1. Scene Setup - High Visibility Industrial Ambience
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const isLightMode = theme === "light";
    const bgCol = isLightMode ? 0xf8fafc : 0x0a1329;
    scene.background = new THREE.Color(bgCol);
    scene.fog = new THREE.Fog(bgCol, isLightMode ? 90 : 80, isLightMode ? 320 : 280);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.copy(cameraTargetRef.current.pos);
    camera.lookAt(cameraTargetRef.current.target);

    // 3. WebGL Renderer with High Precision & Shadows
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      stencil: false,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLightMode ? 1.15 : 1.35;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Industrial Ambient, Hemisphere & Directional Lighting (Eliminates Pitch-Black Void)
    // 4.1 Hemisphere Light for uniform mechanical soft illumination
    const hemiLight = new THREE.HemisphereLight(
      isLightMode ? 0xffffff : 0xdbeafe,
      isLightMode ? 0xcbd5e1 : 0x1e293b,
      isLightMode ? 1.3 : 1.15
    );
    hemiLightRef.current = hemiLight;
    scene.add(hemiLight);

    // 4.2 Base Ambient Light
    const ambientLight = new THREE.AmbientLight(
      isLightMode ? 0xffffff : 0xdbeafe,
      isLightMode ? 1.2 : 1.05
    );
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    // 4.3 Primary Sun Light (Warm daylight, high-resolution soft shadows)
    const sunLight = new THREE.DirectionalLight(0xfffaf0, isLightMode ? 2.2 : 2.0);
    sunLightRef.current = sunLight;
    sunLight.position.set(45, 65, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 250;
    sunLight.shadow.camera.left = -70;
    sunLight.shadow.camera.right = 70;
    sunLight.shadow.camera.top = 70;
    sunLight.shadow.camera.bottom = -70;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // 4.4 Secondary Fill Light (Cool sky tint from opposite angle, eliminates black cast shadows)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, isLightMode ? 0.9 : 0.95);
    fillLightRef.current = fillLight;
    fillLight.position.set(-50, 45, -35);
    scene.add(fillLight);

    // Dynamic point lights for furnace & power generator
    const boilerFurnaceLight = new THREE.PointLight(0xff6b00, 3.8, 40, 1.2);
    boilerFurnaceLight.position.set(-18, 8, -8);
    scene.add(boilerFurnaceLight);

    const turbinePlasmaLight = new THREE.PointLight(0x06b6d4, 2.8, 35, 1.2);
    turbinePlasmaLight.position.set(12, 6, -8);
    scene.add(turbinePlasmaLight);

    // 5. Factory Concrete Floor & Cybernetic Ground Grid
    const gridHelper = new THREE.GridHelper(
      140,
      70,
      isLightMode ? 0x0284c7 : 0x10b981,
      isLightMode ? 0xcbd5e1 : 0x334155
    );
    gridHelper.position.y = 0.02;
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(160, 160);
    const floorMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? 0xe2e8f0 : 0x1e293b,
      roughness: isLightMode ? 0.65 : 0.55,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floorMeshRef.current = floor;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 6. OrbitControls (Full 360° Orbit, Panning across entire 120m site, and smooth Zoom)
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 6;
    controls.maxDistance = 220;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // Keeps camera above concrete foundation
    controls.target.copy(cameraTargetRef.current.target);

    controls.addEventListener("start", () => {
      setIsRotating(false);
      isTransitioningRef.current = false;
    });

    // Factory Safety Lines (Yellow/Black striped edge markers)
    const safetyLineGeo = new THREE.RingGeometry(35, 35.6, 64);
    const safetyLineMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true });
    const safetyRing = new THREE.Mesh(safetyLineGeo, safetyLineMat);
    safetyRing.rotation.x = -Math.PI / 2;
    safetyRing.position.y = 0.03;
    scene.add(safetyRing);

    const interactiveObjects: { [key: string]: THREE.Object3D } = {};

    // Common Industrial Materials
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const industrialGreenMat = new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.7, roughness: 0.35 });
    const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.4 });
    const safetyOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.6, roughness: 0.3 });
    const galvanizedMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const polishedSteelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const highPressureCyanMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.2 });

    // ==========================================
    // STATION 0: BÁSCULAS, PATIO DE CAÑA & MESA ALIMENTADORA
    // ==========================================
    const caneYardGroup = new THREE.Group();
    caneYardGroup.position.set(-42, 0, 14);
    caneYardGroup.name = "eq-patio-cana";

    // 1. Truck Scale Platform (Báscula Camionera)
    const scalePlatformGeo = new THREE.BoxGeometry(14, 0.4, 6);
    const scalePlatform = new THREE.Mesh(scalePlatformGeo, darkSteelMat);
    scalePlatform.position.set(0, 0.2, 8);
    scalePlatform.receiveShadow = true;
    caneYardGroup.add(scalePlatform);

    // Scale Approach Ramps
    const rampGeo = new THREE.BoxGeometry(3, 0.3, 6);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const ramp1 = new THREE.Mesh(rampGeo, rampMat);
    ramp1.position.set(-8.5, 0.15, 8);
    caneYardGroup.add(ramp1);
    const ramp2 = new THREE.Mesh(rampGeo, rampMat);
    ramp2.position.set(8.5, 0.15, 8);
    caneYardGroup.add(ramp2);

    // Weight Scale Operator Cabin
    const cabinGeo = new THREE.BoxGeometry(3.5, 3.2, 3);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.6, 12);
    caneYardGroup.add(cabin);

    // Traffic Signal Post on Scale
    const trafficPoleGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.5, 12);
    const trafficPole = new THREE.Mesh(trafficPoleGeo, darkSteelMat);
    trafficPole.position.set(6, 1.75, 11.5);
    caneYardGroup.add(trafficPole);

    const greenLightGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const greenLight = new THREE.Mesh(greenLightGeo, greenLightMat);
    greenLight.position.set(6, 3.2, 11.5);
    caneYardGroup.add(greenLight);

    // 2. Sugar Cane Truck with Cage Trailer (Camión Cañero Jaula)
    const truckCabGeo = new THREE.BoxGeometry(3.2, 2.8, 3.2);
    const truckCabMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const truckCab = new THREE.Mesh(truckCabGeo, truckCabMat);
    truckCab.position.set(3.5, 1.8, 8);
    truckCab.castShadow = true;
    caneYardGroup.add(truckCab);

    // Cane Trailer Cage
    const cageGeo = new THREE.BoxGeometry(8, 3.2, 3.4);
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, wireframe: false });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    cage.position.set(-2.5, 2.2, 8);
    cage.castShadow = true;
    caneYardGroup.add(cage);

    // Loaded Cane Stalks in Cage
    const caneStalksGeo = new THREE.BoxGeometry(7.6, 2.8, 3.0);
    const caneStalksMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
    const caneStalks = new THREE.Mesh(caneStalksGeo, caneStalksMat);
    caneStalks.position.set(-2.5, 2.2, 8);
    caneYardGroup.add(caneStalks);

    // 3. Cane Feeder Table (Mesa Alimentadora Inclinada)
    const feederTableGeo = new THREE.BoxGeometry(10, 1.0, 8);
    const feederTable = new THREE.Mesh(feederTableGeo, darkSteelMat);
    feederTable.rotation.z = -0.35;
    feederTable.position.set(0, 3.2, 0);
    feederTable.castShadow = true;
    caneYardGroup.add(feederTable);

    // Rotating Cane Kicker / Leveler Drum on Feeder Table
    const kickerDrumGeo = new THREE.CylinderGeometry(0.8, 0.8, 8.2, 16);
    const kickerDrum = new THREE.Mesh(kickerDrumGeo, safetyYellowMat);
    kickerDrum.rotation.x = Math.PI / 2;
    kickerDrum.position.set(2.5, 4.8, 0);
    kickerDrum.castShadow = true;
    caneYardGroup.add(kickerDrum);

    // 4. Truck Unloader Overhead Gantry (Grúa Volcadora Hilo)
    const gantryLegGeo = new THREE.BoxGeometry(0.6, 10, 0.6);
    const gantryBeamGeo = new THREE.BoxGeometry(0.8, 0.8, 12);
    for (let g = 0; g < 2; g++) {
      const xG = g === 0 ? -4 : 4;
      const leg1 = new THREE.Mesh(gantryLegGeo, safetyYellowMat);
      leg1.position.set(xG, 5, -5);
      caneYardGroup.add(leg1);
      const leg2 = new THREE.Mesh(gantryLegGeo, safetyYellowMat);
      leg2.position.set(xG, 5, 5);
      caneYardGroup.add(leg2);
    }
    const gantryBeam = new THREE.Mesh(gantryBeamGeo, safetyYellowMat);
    gantryBeam.position.set(0, 10, 0);
    caneYardGroup.add(gantryBeam);

    // Inclined Main Cane Carrier (Conductor Principal a Preparación)
    const mainCarrierGeo = new THREE.BoxGeometry(12, 1.2, 3.6);
    const mainCarrier = new THREE.Mesh(mainCarrierGeo, darkSteelMat);
    mainCarrier.position.set(6, 2.5, 0);
    mainCarrier.rotation.z = 0.2;
    caneYardGroup.add(mainCarrier);

    scene.add(caneYardGroup);
    interactiveObjects["eq-patio-cana"] = caneYardGroup;

    // ==========================================
    // STATION 1: PREPARACIÓN DE CAÑA & DESFIBRADORA PESADA
    // ==========================================
    const canePrepGroup = new THREE.Group();
    canePrepGroup.position.set(-28, 0, 14);
    canePrepGroup.name = "eq-preparacion";

    // Structural Tower for Cane Preparation
    const prepFrameGeo = new THREE.BoxGeometry(10, 8, 6);
    const prepFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, wireframe: true });
    const prepFrame = new THREE.Mesh(prepFrameGeo, prepFrameMat);
    prepFrame.position.y = 4;
    canePrepGroup.add(prepFrame);

    // Cane Knives #1 (Picadora 1)
    const knife1Geo = new THREE.CylinderGeometry(1.6, 1.6, 4.4, 24);
    const knife1 = new THREE.Mesh(knife1Geo, safetyOrangeMat);
    knife1.rotation.x = Math.PI / 2;
    knife1.position.set(-3, 5, 0);
    knife1.castShadow = true;
    canePrepGroup.add(knife1);

    // Knife 1 Drive Motor & Flywheel
    const motor1Geo = new THREE.CylinderGeometry(0.9, 0.9, 2.2, 16);
    const motor1 = new THREE.Mesh(motor1Geo, darkSteelMat);
    motor1.position.set(-3, 5, -3.2);
    canePrepGroup.add(motor1);

    const flywheel1Geo = new THREE.CylinderGeometry(1.5, 1.5, 0.4, 24);
    const flywheel1 = new THREE.Mesh(flywheel1Geo, polishedSteelMat);
    flywheel1.position.set(-3, 5, -2.0);
    canePrepGroup.add(flywheel1);

    // Cane Knives #2 (Picadora 2)
    const knife2Geo = new THREE.CylinderGeometry(1.7, 1.7, 4.4, 24);
    const knife2 = new THREE.Mesh(knife2Geo, safetyOrangeMat);
    knife2.rotation.x = Math.PI / 2;
    knife2.position.set(0, 5.2, 0);
    knife2.castShadow = true;
    canePrepGroup.add(knife2);

    // Heavy Duty Shredder (Desfibradora Pesada con Rotor de Martillos)
    const shredderCasingGeo = new THREE.CylinderGeometry(2.4, 2.4, 4.6, 32);
    const shredderMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
    const shredderCasing = new THREE.Mesh(shredderCasingGeo, shredderMat);
    shredderCasing.rotation.x = Math.PI / 2;
    shredderCasing.position.set(3.5, 4.8, 0);
    shredderCasing.castShadow = true;
    canePrepGroup.add(shredderCasing);

    // Shredder 2,500 HP Electric Motor
    const shredderMotorGeo = new THREE.BoxGeometry(2.8, 2.8, 3.4);
    const shredderMotor = new THREE.Mesh(shredderMotorGeo, darkSteelMat);
    shredderMotor.position.set(3.5, 4.8, -4.0);
    canePrepGroup.add(shredderMotor);

    // Tramp Iron Suspended Electromagnet (Separador Magnético Overband)
    const magnetGeo = new THREE.BoxGeometry(2.2, 1.4, 3.2);
    const magnetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 });
    const magnet = new THREE.Mesh(magnetGeo, magnetMat);
    magnet.position.set(1.5, 7.8, 0);
    canePrepGroup.add(magnet);

    scene.add(canePrepGroup);
    interactiveObjects["eq-preparacion"] = canePrepGroup;

    // ==========================================
    // STATION 2: TÁNDEM DE MOLIENDA DE 5 MOLINOS DE 4 MAZAS
    // ==========================================
    const millsGroup = new THREE.Group();
    millsGroup.position.set(-12, 0, 14);
    millsGroup.name = "eq-molino-3";

    // Reinforced Continuous Heavy Bedframe (34m Base)
    const baseBedGeo = new THREE.BoxGeometry(34, 1.2, 8);
    const baseBed = new THREE.Mesh(baseBedGeo, darkSteelMat);
    baseBed.position.y = 0.6;
    baseBed.receiveShadow = true;
    millsGroup.add(baseBed);

    const millStands: THREE.Mesh[] = [];
    const rollers: THREE.Mesh[] = [];

    // 5 Mills in Tandem with 4 Rollers, Donnelly Chutes & Edwards Accumulators
    for (let i = 0; i < 5; i++) {
      const xPos = i * 6 - 12;
      const isFaultedMill = i === 2; // Molino 3 in warning scenario

      // Mill Stand Housing (Cast Steel Arch Structure)
      const standGeo = new THREE.BoxGeometry(4.2, 5.8, 5.0);
      const standMat = new THREE.MeshStandardMaterial({
        color: isFaultedMill ? 0xd97706 : 0x047857,
        metalness: 0.7,
        roughness: 0.3,
      });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(xPos, 3.4, 0);
      stand.castShadow = true;
      stand.receiveShadow = true;
      stand.name = `mill-stand-${i}`;
      millsGroup.add(stand);
      millStands.push(stand);

      // Grooved Top Roller (Maza Superior de 42" x 84")
      const rollerGeo = new THREE.CylinderGeometry(1.25, 1.25, 4.4, 28);
      const roller = new THREE.Mesh(rollerGeo, polishedSteelMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(xPos, 4.4, 0);
      roller.name = `roller-${i}`;
      millsGroup.add(roller);
      rollers.push(roller);

      // Feed & Discharge Bottom Rollers (Mazas Inferiores)
      const feedRollGeo = new THREE.CylinderGeometry(1.0, 1.0, 4.4, 24);
      const feedRoll = new THREE.Mesh(feedRollGeo, polishedSteelMat);
      feedRoll.rotation.x = Math.PI / 2;
      feedRoll.position.set(xPos - 0.85, 2.6, 0);
      millsGroup.add(feedRoll);

      const dischargeRoll = new THREE.Mesh(feedRollGeo, polishedSteelMat);
      dischargeRoll.rotation.x = Math.PI / 2;
      dischargeRoll.position.set(xPos + 0.85, 2.6, 0);
      millsGroup.add(dischargeRoll);

      // Vertical Donnelly Chute with Level Sensor Window
      const chuteGeo = new THREE.BoxGeometry(2.6, 3.6, 3.6);
      const chuteMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
      const chute = new THREE.Mesh(chuteGeo, chuteMat);
      chute.position.set(xPos, 7.8, 0);
      millsGroup.add(chute);

      // Edwards Hydraulic Nitrogen Accumulator Top Cap (Botella de Nitrógeno Azul)
      const accumGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16);
      const accumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85 });
      const accumulator = new THREE.Mesh(accumGeo, accumMat);
      accumulator.position.set(xPos, 6.7, -1.8);
      millsGroup.add(accumulator);

      // Planetary Gearbox & Electric Drive Motor
      const gearBoxGeo = new THREE.BoxGeometry(2.0, 2.4, 2.0);
      const gearBox = new THREE.Mesh(gearBoxGeo, darkSteelMat);
      gearBox.position.set(xPos, 3.0, 3.6);
      millsGroup.add(gearBox);

      const motorGeo = new THREE.CylinderGeometry(0.8, 0.8, 2.2, 16);
      const motor = new THREE.Mesh(motorGeo, darkSteelMat);
      motor.position.set(xPos, 3.0, 5.8);
      millsGroup.add(motor);
    }

    // Intermediate Bagasse Rake Conveyors between Mills
    for (let c = 0; c < 4; c++) {
      const cX = c * 6 - 9;
      const convGeo = new THREE.BoxGeometry(3.6, 0.8, 2.8);
      const conv = new THREE.Mesh(convGeo, darkSteelMat);
      conv.position.set(cX, 4.8, 0);
      conv.rotation.z = 0.25;
      millsGroup.add(conv);
    }

    // Compound Imbibition Spray Header Pipe (Aspersores de Imbibición)
    const imbibitionPipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 30, 16);
    const imbibitionPipe = new THREE.Mesh(imbibitionPipeGeo, highPressureCyanMat);
    imbibitionPipe.rotation.z = Math.PI / 2;
    imbibitionPipe.position.set(0, 9.6, 0);
    millsGroup.add(imbibitionPipe);

    // Juice Collection Tray (Bandeja de Jugo Mixto)
    const juiceTrayGeo = new THREE.BoxGeometry(32, 0.8, 6.5);
    const juiceTray = new THREE.Mesh(juiceTrayGeo, industrialGreenMat);
    juiceTray.position.set(0, 1.4, 0);
    millsGroup.add(juiceTray);

    // Rotary DSM Screen (Colador Rotativo de Bagacillo)
    const dsmGeo = new THREE.CylinderGeometry(1.6, 1.6, 4.0, 24);
    const dsmMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, wireframe: true });
    const dsmScreen = new THREE.Mesh(dsmGeo, dsmMat);
    dsmScreen.rotation.x = Math.PI / 2;
    dsmScreen.position.set(-15, 3.6, 4.2);
    millsGroup.add(dsmScreen);

    scene.add(millsGroup);
    interactiveObjects["eq-molino-1"] = millsGroup;
    interactiveObjects["eq-molino-3"] = millsGroup;
    interactiveObjects["eq-molino-5"] = millsGroup;

    // ==========================================
    // STATION 3: GENERACIÓN DE VAPOR - CALDERA ASME PTC 4 (65 BAR)
    // ==========================================
    const boilerGroup = new THREE.Group();
    boilerGroup.position.set(-20, 0, -14);
    boilerGroup.name = "eq-caldera-1";

    // Heavy Structural Steel Framework (IPN Columns & Girders)
    const boilerTowerGeo = new THREE.BoxGeometry(16, 24, 18);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, wireframe: true });
    const boilerTower = new THREE.Mesh(boilerTowerGeo, towerMat);
    boilerTower.position.y = 12;
    boilerGroup.add(boilerTower);

    // 4 Catwalk Walkway Platforms with OSHA Safety Yellow Handrails
    for (let lvl = 1; lvl <= 4; lvl++) {
      const yLvl = lvl * 5.2;
      const walkGeo = new THREE.BoxGeometry(17, 0.4, 19);
      const walkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.position.y = yLvl;
      boilerGroup.add(walk);

      const railGeo = new THREE.BoxGeometry(17, 1.0, 19);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xeab308, wireframe: true });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.y = yLvl + 0.6;
      boilerGroup.add(rail);
    }

    // Furnace Waterwalls (Hogar de Paredes de Agua de Membrana)
    const furnaceBodyGeo = new THREE.BoxGeometry(12, 18, 14);
    const furnaceBody = new THREE.Mesh(furnaceBodyGeo, darkSteelMat);
    furnaceBody.position.set(0, 10, 0);
    furnaceBody.castShadow = true;
    furnaceBody.receiveShadow = true;
    boilerGroup.add(furnaceBody);

    // Bagasse Spreader Stokers (Alimentadores Neumáticos de Bagazo en Frente)
    for (let stk = 0; stk < 3; stk++) {
      const stokerGeo = new THREE.BoxGeometry(1.8, 1.6, 2.2);
      const stoker = new THREE.Mesh(stokerGeo, safetyYellowMat);
      stoker.position.set(-3.5 + stk * 3.5, 3.5, 7.5);
      boilerGroup.add(stoker);
    }

    // Steam Drum on Top (Domo Superior de Vapor de Alta Presión)
    const steamDrumGeo = new THREE.CylinderGeometry(2.0, 2.0, 14, 32);
    const steamDrum = new THREE.Mesh(steamDrumGeo, highPressureCyanMat);
    steamDrum.rotation.z = Math.PI / 2;
    steamDrum.position.set(0, 21.5, 0);
    steamDrum.castShadow = true;
    boilerGroup.add(steamDrum);

    // Mud Drum on Bottom (Domo Inferior de Lodos)
    const mudDrumGeo = new THREE.CylinderGeometry(1.4, 1.4, 12, 24);
    const mudDrum = new THREE.Mesh(mudDrumGeo, darkSteelMat);
    mudDrum.rotation.z = Math.PI / 2;
    mudDrum.position.set(0, 3.5, -3);
    boilerGroup.add(mudDrum);

    // Downcomer Pipes (Tubos Descendentes de Gran Diámetro)
    for (let dc = 0; dc < 2; dc++) {
      const dcGeo = new THREE.CylinderGeometry(0.6, 0.6, 17, 16);
      const downcomer = new THREE.Mesh(dcGeo, highPressureCyanMat);
      downcomer.position.set(dc === 0 ? -6.2 : 6.2, 12.5, -2);
      boilerGroup.add(downcomer);
    }

    // Economizer & Air Preheater Bank
    const ecoBankGeo = new THREE.BoxGeometry(6, 10, 8);
    const ecoBank = new THREE.Mesh(ecoBankGeo, darkSteelMat);
    ecoBank.position.set(8.5, 8, 0);
    boilerGroup.add(ecoBank);

    // Flue-Gas Wet Scrubber (Lavador Húmedo de Gases / Despolvoreador)
    const scrubberGeo = new THREE.CylinderGeometry(2.8, 2.8, 12, 32);
    const scrubber = new THREE.Mesh(scrubberGeo, darkSteelMat);
    scrubber.position.set(11, 7, -6);
    boilerGroup.add(scrubber);

    // Induced Draft Fan (Ventilador de Tiro Inducido ID Fan con Motor 1,200 kW)
    const idFanCasingGeo = new THREE.CylinderGeometry(2.2, 2.2, 2.0, 24);
    const idFanCasing = new THREE.Mesh(idFanCasingGeo, industrialGreenMat);
    idFanCasing.rotation.x = Math.PI / 2;
    idFanCasing.position.set(13, 2.5, -6);
    boilerGroup.add(idFanCasing);

    // Industrial Chimney Stack (Chimenea de 45m de Acero)
    const chimneyGeo = new THREE.CylinderGeometry(1.6, 2.4, 30, 32);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(15, 15, -6);
    chimney.castShadow = true;
    boilerGroup.add(chimney);

    // Aviation Red/White Warning Bands on Chimney Top
    const redBandGeo = new THREE.CylinderGeometry(1.65, 1.75, 4, 32);
    const redBandMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const redBand = new THREE.Mesh(redBandGeo, redBandMat);
    redBand.position.set(15, 27, -6);
    boilerGroup.add(redBand);

    // Chimney Strobe Beacon
    const strobeGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strobe = new THREE.Mesh(strobeGeo, strobeMat);
    strobe.position.set(15, 30.2, -6);
    boilerGroup.add(strobe);

    // Furnace Observation Port Glow (Mirilla de Fuego)
    const flamePortGeo = new THREE.PlaneGeometry(2.5, 3.5);
    const flamePortMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const flamePort = new THREE.Mesh(flamePortGeo, flamePortMat);
    flamePort.position.set(-6.05, 5, 0);
    flamePort.rotation.y = -Math.PI / 2;
    boilerGroup.add(flamePort);

    scene.add(boilerGroup);
    interactiveObjects["eq-caldera-1"] = boilerGroup;

    // ==========================================
    // STATION 4: COGENERACIÓN & TURBOGENERADOR 35 MVA
    // ==========================================
    const turbineGroup = new THREE.Group();
    turbineGroup.position.set(10, 0, -14);
    turbineGroup.name = "eq-turbina-1";

    // Turbine Hall Industrial Enclosure (Acoustic Glass/Steel)
    const turbHallGeo = new THREE.BoxGeometry(18, 10, 16);
    const turbHallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.65,
      metalness: 0.8,
    });
    const turbHall = new THREE.Mesh(turbHallGeo, turbHallMat);
    turbHall.position.y = 5;
    turbineGroup.add(turbHall);

    // Overhead Travelling Crane Inside Turbine Hall (Puente Grúa 40t)
    const craneBeamGeo = new THREE.BoxGeometry(17, 0.8, 1.2);
    const craneBeam = new THREE.Mesh(craneBeamGeo, safetyYellowMat);
    craneBeam.position.set(0, 8.8, 0);
    turbineGroup.add(craneBeam);

    // Multistage High Pressure Steam Turbine Casing
    const turbCasingGeo = new THREE.CylinderGeometry(2.4, 2.8, 7.5, 32);
    const turbCasing = new THREE.Mesh(turbCasingGeo, highPressureCyanMat);
    turbCasing.rotation.z = Math.PI / 2;
    turbCasing.position.set(-4, 3.8, 0);
    turbCasing.castShadow = true;
    turbineGroup.add(turbCasing);

    // Woodward Electronic Governor Valve Block
    const govValveGeo = new THREE.BoxGeometry(1.8, 2.2, 1.8);
    const govValve = new THREE.Mesh(govValveGeo, safetyYellowMat);
    govValve.position.set(-7.5, 4.5, 0);
    turbineGroup.add(govValve);

    // 35 MVA Synchronous Generator Stator Body (13.8 kV, 60 Hz)
    const genStatorGeo = new THREE.CylinderGeometry(2.8, 2.8, 7.0, 32);
    const genMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
    const genStator = new THREE.Mesh(genStatorGeo, genMat);
    genStator.rotation.z = Math.PI / 2;
    genStator.position.set(3.5, 3.8, 0);
    genStator.castShadow = true;
    turbineGroup.add(genStator);

    // Brushless Exciter Housing
    const exciterGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.2, 24);
    const exciter = new THREE.Mesh(exciterGeo, darkSteelMat);
    exciter.rotation.z = Math.PI / 2;
    exciter.position.set(7.5, 3.8, 0);
    turbineGroup.add(exciter);

    // 13.8 kV Metal-Clad Switchgear Cabinets
    const switchgearGeo = new THREE.BoxGeometry(12, 3.2, 2.0);
    const switchgear = new THREE.Mesh(switchgearGeo, darkSteelMat);
    switchgear.position.set(0, 1.6, -6);
    turbineGroup.add(switchgear);

    scene.add(turbineGroup);
    interactiveObjects["eq-turbina-1"] = turbineGroup;

    // ==========================================
    // STATION 4B: SUBESTACIÓN ELÉCTRICA EXTERIOR 138 kV
    // ==========================================
    const subStationGroup = new THREE.Group();
    subStationGroup.position.set(24, 0, -14);
    subStationGroup.name = "eq-subestacion";

    // 40 MVA Step-Up Power Transformer (13.8 kV -> 138 kV)
    const transTankGeo = new THREE.BoxGeometry(6.5, 5.5, 5.5);
    const transTank = new THREE.Mesh(transTankGeo, darkSteelMat);
    transTank.position.set(0, 2.8, 0);
    transTank.castShadow = true;
    subStationGroup.add(transTank);

    // Oil Conservator Tank on Top
    const conservatorGeo = new THREE.CylinderGeometry(0.9, 0.9, 5.0, 16);
    const conservator = new THREE.Mesh(conservatorGeo, darkSteelMat);
    conservator.rotation.z = Math.PI / 2;
    conservator.position.set(0, 6.2, -1.8);
    subStationGroup.add(conservator);

    // Oil Cooling Radiator Banks with Fans
    for (let r = 0; r < 2; r++) {
      const radGeo = new THREE.BoxGeometry(0.6, 4.2, 4.8);
      const rad = new THREE.Mesh(radGeo, galvanizedMat);
      rad.position.set(r === 0 ? -3.8 : 3.8, 2.8, 0);
      subStationGroup.add(rad);
    }

    // High Voltage 138 kV Porcelain Bushings
    for (let b = 0; b < 3; b++) {
      const bushGeo = new THREE.CylinderGeometry(0.25, 0.45, 3.2, 16);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x92400e, metalness: 0.8 });
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.set(-1.8 + b * 1.8, 7.0, 1.2);
      subStationGroup.add(bush);
    }

    // Galvanized Lattice Overhead Gantry (Pórtico 138 kV)
    const gantryFrameGeo = new THREE.BoxGeometry(10, 11, 4);
    const gantryFrameMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, wireframe: true });
    const gantryFrame = new THREE.Mesh(gantryFrameGeo, gantryFrameMat);
    gantryFrame.position.set(0, 5.5, 6);
    subStationGroup.add(gantryFrame);

    // SF6 Circuit Breaker Columns
    for (let sf = 0; sf < 3; sf++) {
      const sf6Geo = new THREE.CylinderGeometry(0.3, 0.3, 3.8, 16);
      const sf6Breaker = new THREE.Mesh(sf6Geo, darkSteelMat);
      sf6Breaker.position.set(-2.2 + sf * 2.2, 2.0, 6);
      subStationGroup.add(sf6Breaker);
    }

    scene.add(subStationGroup);
    interactiveObjects["eq-subestacion"] = subStationGroup;

    // ==========================================
    // STATION 5: CASA DE FABRICACIÓN - CLARIFICACIÓN & EVAPORADORES
    // ==========================================
    const factoryGroup = new THREE.Group();
    factoryGroup.position.set(10, 0, 14);
    factoryGroup.name = "eq-evaporadores";

    // Liming Tanks (Tanques de Encalado con Agitadores)
    for (let lm = 0; lm < 2; lm++) {
      const limeGeo = new THREE.CylinderGeometry(1.8, 1.8, 4.8, 24);
      const limeTank = new THREE.Mesh(limeGeo, galvanizedMat);
      limeTank.position.set(-18 + lm * 4.2, 2.4, -4);
      factoryGroup.add(limeTank);
    }

    // Tubular Juice Heaters (Calentadores de Jugo)
    for (let jh = 0; jh < 3; jh++) {
      const heaterGeo = new THREE.CylinderGeometry(1.1, 1.1, 5.4, 20);
      const heater = new THREE.Mesh(heaterGeo, highPressureCyanMat);
      heater.rotation.z = Math.PI / 2;
      heater.position.set(-18 + jh * 3.6, 6.2, -4);
      factoryGroup.add(heater);
    }

    // Continuous SRI / Dorr-Oliver Rapid Juice Clarifier (32' Diameter Tank)
    const clarifierBodyGeo = new THREE.CylinderGeometry(5.4, 4.4, 7.5, 32);
    const clarifier = new THREE.Mesh(clarifierBodyGeo, industrialGreenMat);
    clarifier.position.set(-10, 4.2, 0);
    clarifier.castShadow = true;
    factoryGroup.add(clarifier);

    // Clarifier Top Diametral Walkway & Center Rake Motor
    const clarWalkGeo = new THREE.BoxGeometry(11.5, 0.4, 1.2);
    const clarWalk = new THREE.Mesh(clarWalkGeo, darkSteelMat);
    clarWalk.position.set(-10, 8.2, 0);
    factoryGroup.add(clarWalk);

    const clarMotorGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.4, 16);
    const clarMotor = new THREE.Mesh(clarMotorGeo, safetyYellowMat);
    clarMotor.position.set(-10, 9.2, 0);
    factoryGroup.add(clarMotor);

    // 2 Rotary Vacuum Mud Filters (Filtros de Cachaza al Vacío con Tambor Giratorio)
    for (let vf = 0; vf < 2; vf++) {
      const drumGeo = new THREE.CylinderGeometry(1.8, 1.8, 4.2, 24);
      const drumMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, wireframe: false });
      const vacDrum = new THREE.Mesh(drumGeo, drumMat);
      vacDrum.rotation.z = Math.PI / 2;
      vacDrum.position.set(-10 + vf * 5.2, 3.2, 7);
      factoryGroup.add(vacDrum);
    }

    // Quintuple-Effect Falling Film Evaporators (Batería de 5 Evaporadores)
    for (let j = 0; j < 5; j++) {
      const evapX = j * 4.4 - 1.0;
      const evapVesselGeo = new THREE.CylinderGeometry(2.1, 2.1, 9.5, 32);
      const evapVessel = new THREE.Mesh(evapVesselGeo, highPressureCyanMat);
      evapVessel.position.set(evapX, 5.2, 0);
      evapVessel.castShadow = true;
      factoryGroup.add(evapVessel);

      // Top Dome
      const domeGeo = new THREE.SphereGeometry(2.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, highPressureCyanMat);
      dome.position.set(evapX, 10.0, 0);
      factoryGroup.add(dome);

      // Interconnecting Vapor Ducts
      if (j < 4) {
        const ductGeo = new THREE.CylinderGeometry(0.55, 0.55, 4.4, 16);
        const duct = new THREE.Mesh(ductGeo, galvanizedMat);
        duct.rotation.z = Math.PI / 2;
        duct.position.set(evapX + 2.2, 11.0, 0);
        factoryGroup.add(duct);
      }
    }

    // 3 Vacuum Crystallization Strike Pans (Tachos al Vacío de Masa Cocida)
    for (let vp = 0; vp < 3; vp++) {
      const panGeo = new THREE.CylinderGeometry(2.4, 2.0, 6.5, 28);
      const panMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.75 });
      const pan = new THREE.Mesh(panGeo, panMat);
      pan.position.set(1.0 + vp * 5.2, 4.5, -6);
      factoryGroup.add(pan);
    }

    scene.add(factoryGroup);
    interactiveObjects["eq-evaporadores"] = factoryGroup;
    interactiveObjects["eq-clarificador"] = factoryGroup;

    // ==========================================
    // STATION 6: SECADO, SILOS & PLANTA DE ENSACADO
    // ==========================================
    const packGroup = new THREE.Group();
    packGroup.position.set(32, 0, 14);
    packGroup.name = "eq-secador-ensacado";

    // Battery of 4 Sugar Centrifuges (Centrífugas Continuas & Discontinuas)
    for (let cf = 0; cf < 4; cf++) {
      const centGeo = new THREE.CylinderGeometry(1.2, 1.0, 2.8, 20);
      const centMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const centrifuge = new THREE.Mesh(centGeo, centMat);
      centrifuge.position.set(-8 + cf * 2.8, 2.2, -5);
      packGroup.add(centrifuge);
    }

    // Horizontal Rotary Drum Sugar Dryer / Cooler (Secador Rotativo)
    const dryerGeo = new THREE.CylinderGeometry(1.6, 1.6, 9.5, 24);
    const dryer = new THREE.Mesh(dryerGeo, galvanizedMat);
    dryer.rotation.z = 1.45; // slight tilt for gravity flow
    dryer.position.set(-4, 3.5, 2);
    packGroup.add(dryer);

    // 2 Sugar Storage Silos (Blancos Grado Alimentario, 5,000 t)
    for (let s = 0; s < 2; s++) {
      const siloGeo = new THREE.CylinderGeometry(3.8, 3.8, 15, 32);
      const siloMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.25 });
      const silo = new THREE.Mesh(siloGeo, siloMat);
      silo.position.set(s * 9 + 4, 8.0, 0);
      silo.castShadow = true;
      packGroup.add(silo);

      const siloConeGeo = new THREE.ConeGeometry(3.8, 3.2, 32);
      const siloCone = new THREE.Mesh(siloConeGeo, siloMat);
      siloCone.position.set(s * 9 + 4, 17.1, 0);
      packGroup.add(siloCone);
    }

    // Automated 50kg Bagging Line Building (Nave de Ensacado)
    const baggingBldgGeo = new THREE.BoxGeometry(12, 4.5, 8);
    const baggingBldgMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
    const baggingBldg = new THREE.Mesh(baggingBldgGeo, baggingBldgMat);
    baggingBldg.position.set(8.5, 2.25, 8);
    packGroup.add(baggingBldg);

    scene.add(packGroup);
    interactiveObjects["eq-secador-ensacado"] = packGroup;

    // ==========================================
    // INTERCONNECTED INDUSTRIAL PIPELINE NETWORK
    // ==========================================
    // 1. High Pressure Steam Pipeline (Boiler 65 bar -> Turbine 35 MVA)
    const hpSteamGeo = new THREE.CylinderGeometry(0.65, 0.65, 32, 16);
    const hpSteamMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x083344,
    });
    const hpSteamPipe = new THREE.Mesh(hpSteamGeo, hpSteamMat);
    hpSteamPipe.rotation.z = Math.PI / 2;
    hpSteamPipe.position.set(-5, 17, -14);
    scene.add(hpSteamPipe);

    // 2. Overhead Bagasse Belt Conveyor (Mills -> Boiler & Bagasse Yard)
    const bagasseConveyorGeo = new THREE.BoxGeometry(2.4, 0.8, 30);
    const bagasseConveyorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6 });
    const bagasseConveyor = new THREE.Mesh(bagasseConveyorGeo, bagasseConveyorMat);
    bagasseConveyor.position.set(-18, 6.5, 0);
    scene.add(bagasseConveyor);

    // 3. Raw Juice Pipeline (Mills -> Heaters -> Clarifier)
    const juicePipeGeo = new THREE.CylinderGeometry(0.5, 0.5, 26, 16);
    const juicePipeMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.7 });
    const juicePipe = new THREE.Mesh(juicePipeGeo, juicePipeMat);
    juicePipe.rotation.z = Math.PI / 2;
    juicePipe.position.set(-1, 2.5, 14);
    scene.add(juicePipe);

    // 4. Exhaust Steam to Factory (Turbine 2.2 bar -> Evaporators)
    const lpSteamGeo = new THREE.CylinderGeometry(0.8, 0.8, 28, 16);
    const lpSteamMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8 });
    const lpSteamPipe = new THREE.Mesh(lpSteamGeo, lpSteamMat);
    lpSteamPipe.rotation.x = Math.PI / 2;
    lpSteamPipe.position.set(10, 8, 0);
    scene.add(lpSteamPipe);

    // ==========================================
    // PARTICLE SYSTEMS: SMOKE & ELECTRICAL ENERGY
    // ==========================================
    // Chimney Smoke Particles
    const smokeCount = 120;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities: { x: number; y: number; z: number }[] = [];

    for (let p = 0; p < smokeCount; p++) {
      smokePositions[p * 3] = -5 + (Math.random() - 0.5) * 1.5; // Chimney X (-20 + 15)
      smokePositions[p * 3 + 1] = 30 + Math.random() * 15;
      smokePositions[p * 3 + 2] = -20 + (Math.random() - 0.5) * 1.5; // Chimney Z (-14 - 6)
      smokeVelocities.push({
        x: 0.04 + Math.random() * 0.04,
        y: 0.15 + Math.random() * 0.1,
        z: (Math.random() - 0.5) * 0.04,
      });
    }

    smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.8,
      transparent: true,
      opacity: 0.45,
    });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokeParticles);

    // Energy Flow Pulsing Particles along HP Steam Line
    const energyPulseGeo = new THREE.SphereGeometry(0.4, 12, 12);
    const energyPulseMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const energyPulses: THREE.Mesh[] = [];
    for (let k = 0; k < 6; k++) {
      const pulse = new THREE.Mesh(energyPulseGeo, energyPulseMat);
      pulse.position.set(-20 + k * 5, 17, -14);
      scene.add(pulse);
      energyPulses.push(pulse);
    }

    interactiveObjectsRef.current = interactiveObjects;

    // 7. Raycaster for Interactive 3D Selection & Hover Tooltips
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const objectsToCheck = Object.values(interactiveObjects);
      const intersects = raycaster.intersectObjects(objectsToCheck, true);

      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current && !current.name && current.parent) {
          current = current.parent;
        }
        if (current && current.name && current.name.startsWith("eq-")) {
          setHoveredEqName(current.name);
          renderer.domElement.style.cursor = "pointer";
          return;
        }
      }
      setHoveredEqName(null);
      renderer.domElement.style.cursor = "grab";
    };

    // Pointer down & up distinction so user can click to focus, but drag to pan/rotate
    let pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (event: MouseEvent) => {
      pointerDownPos = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: MouseEvent) => {
      const dx = Math.abs(event.clientX - pointerDownPos.x);
      const dy = Math.abs(event.clientY - pointerDownPos.y);
      if (dx > 6 || dy > 6) return; // User was panning or orbiting, not a pure click!

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const objectsToCheck = Object.values(interactiveObjects);
      const intersects = raycaster.intersectObjects(objectsToCheck, true);

      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current && !current.name && current.parent) {
          current = current.parent;
        }
        if (current && current.name && current.name.startsWith("eq-")) {
          handleSelectEquipment(current.name);
        }
      }
    };

    renderer.domElement.addEventListener("mousemove", onPointerMove);
    renderer.domElement.addEventListener("mousedown", onPointerDown);
    renderer.domElement.addEventListener("mouseup", onPointerUp);

    // 8. Main 60-FPS Real-time Animation Loop with Physical Mechanical Vibration & Particles
    let frameCounter = 0;
    let lastTime = performance.now();

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaSec = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      frameCounter++;
      if (frameCounter % 30 === 0) {
        setFps(Math.round(1 / deltaSec) || 60);
      }

      // Continuous Roller Rotation
      rollers.forEach((r) => {
        r.rotation.y += 0.06;
      });

      // PHYSICAL MECHANICAL VIBRATION SHAKING SIMULATION
      // When Molino 3 is in warning (vibration > 4.5 mm/s), physically shake the 3D stand!
      const mill3Vib = telemetry.mill3Vibration || 4.8;
      if (mill3Vib > 4.0 && millStands[2]) {
        const shakeAmp = (mill3Vib / 10.0) * 0.08;
        millStands[2].position.x = (2 * 6 - 12) + (Math.random() - 0.5) * shakeAmp;
        millStands[2].position.z = (Math.random() - 0.5) * shakeAmp;
        rollers[2].position.x = (2 * 6 - 12) + (Math.random() - 0.5) * shakeAmp;
      } else if (millStands[2]) {
        millStands[2].position.x = 2 * 6 - 12;
        millStands[2].position.z = 0;
        rollers[2].position.x = 2 * 6 - 12;
      }

      // Animate Chimney Smoke Particles
      const positions = smokeGeo.attributes.position.array as Float32Array;
      for (let p = 0; p < smokeCount; p++) {
        positions[p * 3] += smokeVelocities[p].x;
        positions[p * 3 + 1] += smokeVelocities[p].y;
        positions[p * 3 + 2] += smokeVelocities[p].z;

        if (positions[p * 3 + 1] > 50) {
          positions[p * 3] = -5 + (Math.random() - 0.5) * 1.5;
          positions[p * 3 + 1] = 30;
          positions[p * 3 + 2] = -20 + (Math.random() - 0.5) * 1.5;
        }
      }
      smokeGeo.attributes.position.needsUpdate = true;

      // Animate Energy Pulses along HP Steam Line (-20 to +10, Y=17, Z=-14)
      energyPulses.forEach((pulse) => {
        pulse.position.x += 0.18;
        if (pulse.position.x > 10) {
          pulse.position.x = -20;
        }
      });

      // Smooth Camera Lerp to Station Target or OrbitControls handling
      if (isTransitioningRef.current && controlsRef.current) {
        camera.position.lerp(cameraTargetRef.current.pos, 0.06);
        controlsRef.current.target.lerp(cameraTargetRef.current.target, 0.06);
        controlsRef.current.update();

        if (
          camera.position.distanceTo(cameraTargetRef.current.pos) < 0.25 &&
          controlsRef.current.target.distanceTo(cameraTargetRef.current.target) < 0.25
        ) {
          camera.position.copy(cameraTargetRef.current.pos);
          controlsRef.current.target.copy(cameraTargetRef.current.target);
          isTransitioningRef.current = false;
        }
      } else if (controlsRef.current) {
        controlsRef.current.autoRotate = isRotating;
        controlsRef.current.autoRotateSpeed = 0.8;
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer for instant full-bleed re-render when maximized or resized
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 560;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("mousemove", onPointerMove);
      renderer.domElement.removeEventListener("mousedown", onPointerDown);
      renderer.domElement.removeEventListener("mouseup", onPointerUp);
      controls.dispose();
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
    };
  }, [isRotating]);

  // Adjust material colors based on View Mode (THERMAL, ENERGY, HEALTH, STANDARD)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat: any) => {
          if (!mat) return;
          const parentName = obj.parent?.name || obj.name || "";

          const setMaterialColors = (colorHex: number, emissiveHex?: number) => {
            if (mat.color && typeof mat.color.setHex === "function") {
              mat.color.setHex(colorHex);
            }
            if (mat.emissive && typeof mat.emissive.setHex === "function") {
              mat.emissive.setHex(emissiveHex !== undefined ? emissiveHex : 0x000000);
            }
          };

          if (viewMode === "THERMAL") {
            // Heatmap: Boiler (485°C) -> Red/White, Turbine (440°C) -> Amber, Evaporators (125°C) -> Warm Orange, Mills (42°C) -> Cool Blue
            if (parentName.includes("caldera")) {
              setMaterialColors(0xef4444, 0x991b1b);
            } else if (parentName.includes("turbina")) {
              setMaterialColors(0xf59e0b, 0x78350f);
            } else if (parentName.includes("evaporadores") || parentName.includes("clarificador")) {
              setMaterialColors(0xf97316, 0x7c2d12);
            } else if (parentName.startsWith("eq-")) {
              setMaterialColors(0x0284c7, 0x082f49);
            }
          } else if (viewMode === "ENERGY") {
            // Electric MW & Steam flow highlighting
            if (parentName.includes("turbina")) {
              setMaterialColors(0xfacc15, 0x854d0e);
            } else if (parentName.includes("caldera")) {
              setMaterialColors(0x06b6d4, 0x164e63);
            } else if (parentName.startsWith("eq-")) {
              setMaterialColors(0x1e293b, 0x000000);
            }
          } else if (viewMode === "HEALTH") {
            // ISO 10816 Health status
            if (parentName.includes("molino")) {
              setMaterialColors(0xf59e0b, 0x451a03); // Molino 3 in warning
            } else if (parentName.includes("caldera") && telemetry.boilerPressureHP < 58) {
              setMaterialColors(0xf43f5e, 0x881337);
            } else if (parentName.startsWith("eq-")) {
              setMaterialColors(0x10b981, 0x064e3b); // Normal Good
            }
          } else {
            // Standard PBR Appearance
            if (mat.emissive && typeof mat.emissive.setHex === "function") {
              mat.emissive.setHex(0x000000);
            }
            if (parentName.includes("caldera")) {
              setMaterialColors(0x1e293b);
            } else if (parentName.includes("turbina")) {
              setMaterialColors(0x0284c7);
            } else if (parentName.includes("molino")) {
              setMaterialColors(0x047857);
            }
          }
        });
      }
    });
  }, [viewMode, telemetry]);

  return (
    <div
      ref={containerRef}
      className={
        isMaximized
          ? "fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-2xl flex flex-col p-2.5 sm:p-3.5 w-screen h-screen overflow-hidden"
          : "space-y-4"
      }
    >
      {/* Top Level Industry 4.0 Dimension Selector Banner (Hidden in Maximized mode for full viewport focus) */}
      {!isMaximized && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                  RAMI 4.0 / ISO 23247 ARCHITECTURE
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Ecosistema Integral de Gemelos Digitales de Planta Azucarera
                </span>
              </div>
              <h2 className="text-lg font-bold text-white font-tech flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                Gemelo Digital Inteligente BioAzúcar 4.0
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cinemática 3D de alta fidelidad, balances termodinámicos multifísicos, simulación prescriptiva 'What-If' y pronóstico de degradación de activos.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Molienda: <strong className="text-cyan-400">{telemetry.tch} TCH</strong></span>
              <span className="text-slate-600">|</span>
              <span>Vapor HP: <strong className="text-amber-400">{telemetry.steamFlowHP || 211.5} t/h</strong></span>
              <span className="text-slate-600">|</span>
              <span>SEN: <strong className="text-emerald-400">{telemetry.powerExportGridMW || 21.2} MW</strong></span>
            </div>
          </div>

          {/* 5 Dimensional Pillar Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4 pt-3 border-t border-slate-800/80">
            {[
              {
                id: "3D_SPATIAL",
                label: "1. Cinemática 3D",
                desc: "WebGL espacial PBR",
                icon: Cpu,
              },
              {
                id: "MASS_ENERGY",
                label: "2. Balance Masa & Vapor",
                desc: "Termodinámica ASME",
                icon: Scale,
              },
              {
                id: "WHAT_IF",
                label: "3. Simulador 'What-If'",
                desc: "Sandbox prescriptivo",
                icon: Sliders,
              },
              {
                id: "DEGRADATION_RUL",
                label: "4. Degradación & RUL",
                desc: "Fatiga y vida remanente",
                icon: Wrench,
              },
              {
                id: "OT_SYNC",
                label: "5. Sincronismo OT (ISO)",
                desc: "Discrepancia física-virtual",
                icon: Radio,
              },
            ].map((dim) => {
              const Icon = dim.icon;
              const isActive = activeTwinDimension === dim.id;
              return (
                <button
                  key={dim.id}
                  onClick={() => setActiveTwinDimension(dim.id as TwinDimension)}
                  className={`text-left p-2.5 rounded-xl border transition flex flex-col justify-between ${
                    isActive
                      ? "bg-emerald-500/15 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/30 text-white"
                      : "bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                    <span className={`text-xs font-bold font-mono truncate ${isActive ? "text-emerald-300" : "text-slate-300"}`}>
                      {dim.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block pl-6">
                    {dim.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Viewport for Dimension 1: 3D Spatial WebGL (kept in DOM to preserve Three.js context) */}
      <div className={activeTwinDimension === "3D_SPATIAL" ? (isMaximized ? "flex-1 flex flex-col min-h-0 w-full" : "space-y-4") : "hidden"}>
        {/* 3D Viewport Controls & HUD Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white font-tech tracking-wider uppercase">
                Gemelo Digital 3D • {isMaximized ? "Vista Inmersiva Planta Completa" : "Central Azucarero & Cogeneración"}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                60 FPS WebGL PBR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Navegación espacial 360°: Arrastra con clic derecho para desplazarte (Pan), clic izquierdo para rotar y rueda para zoom.
            </p>
          </div>

          {/* View Modes & Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setViewMode("STANDARD")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  viewMode === "STANDARD"
                    ? "bg-slate-800 text-cyan-400 font-bold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Modo Estándar PBR"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Estándar</span>
              </button>

              <button
                onClick={() => setViewMode("THERMAL")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  viewMode === "THERMAL"
                    ? "bg-rose-950 text-rose-300 font-bold border border-rose-500/40 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Inspección Termográfica"
              >
                <Thermometer className="w-3.5 h-3.5" />
                <span>Termografía</span>
              </button>

              <button
                onClick={() => setViewMode("ENERGY")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  viewMode === "ENERGY"
                    ? "bg-amber-950 text-amber-300 font-bold border border-amber-500/40 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Flujo de Energía y Vapor HP"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Energía</span>
              </button>

              <button
                onClick={() => setViewMode("HEALTH")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  viewMode === "HEALTH"
                    ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Salud Mecánica ISO 10816"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Salud ISO</span>
              </button>
            </div>

            {/* Quick Zoom In / Zoom Out Controls */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={handleZoomIn}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Acercar Zoom (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Alejar Zoom (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetCamera}
                className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
                title="Vista General Planta"
              >
                <Scan className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Orbit auto-rotate toggle */}
            <button
              onClick={() => setIsRotating((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition ${
                isRotating
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
              title="Alternar rotación orbital automática"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRotating ? "Órbita Activa" : "Órbita Pausada"}</span>
            </button>

            {/* Maximize / Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition ${
                isMaximized
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
              title={isMaximized ? "Minimizar (ESC)" : "Maximizar Pantalla Completa"}
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Salir (ESC)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Maximizar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3D Canvas Area with Floating Telemetry HUD and Full Panning/Zoom Support */}
        <div
          className={`relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl transition-all duration-300 ${
            isMaximized ? "flex-1 h-full min-h-0" : "h-[600px]"
          }`}
        >
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Top-Left Telemetry Badge & Performance Indicator with Strict Provenance */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>GPU: <strong className="text-emerald-300">{fps} FPS</strong></span>
            <span className="text-slate-600">|</span>
            <span>Molienda: <strong className="text-cyan-300">{telemetry.tch} TCH</strong></span>
            <span className="text-slate-600">|</span>
            <span>Generación: <strong className="text-amber-300">{telemetry.powerGeneratedMW} MW</strong></span>
            <span className="text-slate-600">|</span>
            {/* Explicit Data Source Provenance Badge */}
            {telemetry.isSimulated ? (
              <span className="px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>DATOS SIMULADOS (Hugot & ASME)</span>
              </span>
            ) : telemetry.quality !== "BAD" ? (
              <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 text-[11px]">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>DATOS REALES OT (PLC/DCS)</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 text-[11px]">
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>OT DESCONECTADO</span>
              </span>
            )}
          </div>

          {/* Interactive Navigation Helper Guide (Bottom Center) */}
          <div className="absolute top-3 right-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 font-mono text-[11px] text-slate-400 hidden md:flex items-center gap-2 shadow-lg">
            <Move className="w-3 h-3 text-cyan-400" />
            <span>🖱️ <strong>Clic Der</strong>: Desplazar (Pan)</span>
            <span className="text-slate-600">•</span>
            <span>🖱️ <strong>Clic Izq</strong>: Rotar 360°</span>
            <span className="text-slate-600">•</span>
            <span>⚙️ <strong>Rueda</strong>: Zoom</span>
          </div>

          {/* Hover Equipment Tooltip */}
          {hoveredEqName && (
            <div className="absolute top-14 left-3 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/40 text-xs font-mono text-cyan-300 flex items-center gap-2 animate-fadeIn shadow-lg">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Haz clic para enfocar: <strong>{hoveredEqName.toUpperCase()}</strong></span>
            </div>
          )}

          {/* Floating Equipment Quick Selector Buttons (Bottom left) */}
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto flex flex-wrap gap-1.5 z-10 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800 max-w-2xl shadow-2xl overflow-x-auto max-h-36 sm:max-h-none">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block w-full px-1 font-mono">
              Cámaras & Activos Críticos del Central Azucarero:
            </span>
            {[
              { id: "overview", label: "Vista General Planta" },
              { id: "eq-patio-cana", label: "Patio Caña & Báscula" },
              { id: "eq-preparacion", label: "Preparación & Desfibradora" },
              { id: "eq-molino-3", label: "Molino 3 (Tándem)", alert: telemetry.mill3Vibration > 4.5 },
              { id: "eq-caldera-1", label: "Caldera 65 bar (ASME)" },
              { id: "eq-turbina-1", label: "Turbogenerador 35 MVA" },
              { id: "eq-subestacion", label: "Subestación 138 kV" },
              { id: "eq-evaporadores", label: "Evaporadores & Clarificador" },
              { id: "eq-secador-ensacado", label: "Silos & Ensacado" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectEquipment(item.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition flex items-center gap-1.5 whitespace-nowrap ${
                  selectedEqId === item.id
                    ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                    : "bg-slate-950/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {item.alert && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Thermal Legend (When in THERMAL mode) */}
          {viewMode === "THERMAL" && (
            <div className="absolute bottom-3 right-3 z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5 shadow-xl">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Escala Termográfica (°C):</span>
              <div className="w-48 h-3 rounded-full bg-gradient-to-r from-cyan-600 via-amber-500 to-rose-600 border border-slate-700"></div>
              <div className="flex justify-between text-[10px] text-slate-300">
                <span>25°C (Ambiente)</span>
                <span>150°C</span>
                <span>485°C (Vapor HP)</span>
              </div>
            </div>
          )}

          {/* Floating Machine Telemetry HUD (Overlay top right) */}
          {selectedEquipment && viewMode !== "THERMAL" && (
            <div className="absolute top-14 right-3 w-72 sm:w-80 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-2xl z-10 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 block font-bold">
                    {selectedEquipment.code || "TAG-001"}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white font-tech leading-tight">
                    {selectedEquipment.name}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    selectedEquipment.status === "WARNING"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {selectedEquipment.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-2.5 font-mono">
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Health Index</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {selectedEquipment.healthIndex}%
                  </span>
                  <span className="text-[8px] text-slate-500 block">ISO 10816-3</span>
                </div>

                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Vibración RMS</span>
                  <span
                    className={`text-sm font-bold ${
                      selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold
                        ? "text-amber-400"
                        : "text-white"
                    }`}
                  >
                    {selectedEquipment.vibrationRMS} mm/s
                  </span>
                  <span className="text-[8px] text-slate-500 block">Límite: {selectedEquipment.vibrationThreshold} mm/s</span>
                </div>

                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Temperatura</span>
                  <span className="text-sm font-bold text-white">
                    {selectedEquipment.temperatureC} °C
                  </span>
                  <span className="text-[8px] text-slate-500 block">Sonda PT100</span>
                </div>

                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Carga Motor</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {selectedEquipment.loadPercentage}%
                  </span>
                  <span className="text-[8px] text-slate-500 block">Corriente</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tag PLC:</span>
                  <span className="text-cyan-300 font-bold">{selectedEquipment.plcTag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Servicio:</span>
                  <span className="text-slate-300">{selectedEquipment.lastMaintenance}</span>
                </div>
                {selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold && (
                  <div className="p-1.5 mt-1.5 bg-amber-950/50 rounded-lg border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>Alerta armónica en chumacera.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dimension 2: Multi-Physics Mass & Energy Balance */}
      {activeTwinDimension === "MASS_ENERGY" && (
        <MassEnergyTwinView telemetry={telemetry} theme={theme} />
      )}

      {/* Dimension 3: Prescriptive What-If Sandbox */}
      {activeTwinDimension === "WHAT_IF" && (
        <WhatIfSandboxView telemetry={telemetry} theme={theme} />
      )}

      {/* Dimension 4: Prognostics & Remaining Useful Life (RUL) */}
      {activeTwinDimension === "DEGRADATION_RUL" && (
        <DegradationRulView
          telemetry={telemetry}
          equipmentList={safeEquipmentList}
          theme={theme}
        />
      )}

      {/* Dimension 5: Physical-Virtual Synchronization & Lineage (ISO 23247) */}
      {activeTwinDimension === "OT_SYNC" && (
        <OtSyncTwinView telemetry={telemetry} theme={theme} />
      )}
    </div>
  );
};
