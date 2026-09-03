import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
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
} from "lucide-react";
import { TelemetryData, EquipmentItem } from "../types";

interface DigitalTwin3DProps {
  telemetry: TelemetryData;
  equipmentList: EquipmentItem[];
}

interface EquipmentCameraTarget {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  telemetry,
  equipmentList = [],
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedEqId, setSelectedEqId] = useState<string>("eq-molino-3");
  const [viewMode, setViewMode] = useState<"STANDARD" | "THERMAL" | "ENERGY" | "HEALTH">("STANDARD");
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [hoveredEqName, setHoveredEqName] = useState<string | null>(null);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const interactiveObjectsRef = useRef<{ [key: string]: THREE.Object3D }>({});
  const animationFrameIdRef = useRef<number | null>(null);

  // Camera animation target
  const cameraTargetRef = useRef<EquipmentCameraTarget>({
    pos: new THREE.Vector3(45, 35, 55),
    target: new THREE.Vector3(0, 5, 0),
  });

  const safeEquipmentList = Array.isArray(equipmentList) ? equipmentList : [];
  const selectedEquipment =
    safeEquipmentList.find((e) => e.id === selectedEqId) ||
    safeEquipmentList[0] ||
    ({} as EquipmentItem);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  // Camera Presets dictionary
  const cameraPresets: { [key: string]: EquipmentCameraTarget } = {
    overview: {
      pos: new THREE.Vector3(50, 40, 60),
      target: new THREE.Vector3(0, 5, 0),
    },
    "eq-molino-3": {
      pos: new THREE.Vector3(-18, 14, 32),
      target: new THREE.Vector3(-18, 4, 14),
    },
    "eq-caldera-1": {
      pos: new THREE.Vector3(-18, 22, 14),
      target: new THREE.Vector3(-18, 10, -8),
    },
    "eq-turbina-1": {
      pos: new THREE.Vector3(12, 16, 12),
      target: new THREE.Vector3(12, 6, -8),
    },
    "eq-evaporadores": {
      pos: new THREE.Vector3(12, 16, 32),
      target: new THREE.Vector3(12, 6, 14),
    },
    "eq-secador-ensacado": {
      pos: new THREE.Vector3(32, 16, 32),
      target: new THREE.Vector3(30, 6, 14),
    },
  };

  const handleSelectEquipment = (eqId: string) => {
    setSelectedEqId(eqId);
    if (cameraPresets[eqId]) {
      cameraTargetRef.current = cameraPresets[eqId];
      setIsRotating(false);
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 560;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.012);

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
    renderer.toneMappingExposure = 1.1;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Industrial Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    sunLight.position.set(40, 60, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Dynamic point lights for furnace & power generator
    const boilerFurnaceLight = new THREE.PointLight(0xff6b00, 3.5, 35, 1.2);
    boilerFurnaceLight.position.set(-18, 8, -8);
    scene.add(boilerFurnaceLight);

    const turbinePlasmaLight = new THREE.PointLight(0x06b6d4, 2.5, 30, 1.2);
    turbinePlasmaLight.position.set(12, 6, -8);
    scene.add(turbinePlasmaLight);

    // 5. Factory Concrete Floor & Cybernetic Ground Grid
    const gridHelper = new THREE.GridHelper(100, 50, 0x10b981, 0x1e293b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      roughness: 0.85,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Factory Safety Lines (Yellow/Black striped edge markers)
    const safetyLineGeo = new THREE.RingGeometry(35, 35.6, 64);
    const safetyLineMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true });
    const safetyRing = new THREE.Mesh(safetyLineGeo, safetyLineMat);
    safetyRing.rotation.x = -Math.PI / 2;
    safetyRing.position.y = 0.03;
    scene.add(safetyRing);

    const interactiveObjects: { [key: string]: THREE.Object3D } = {};

    // ==========================================
    // UNIT 1: TANDEM MILLING TRAIN (5 ROLLING MILLS)
    // ==========================================
    const millsGroup = new THREE.Group();
    millsGroup.position.set(-18, 0, 14);
    millsGroup.name = "eq-molino-3";

    // Structural Base Frame
    const baseBedGeo = new THREE.BoxGeometry(32, 1.2, 8);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const baseBed = new THREE.Mesh(baseBedGeo, steelMat);
    baseBed.position.y = 0.6;
    baseBed.receiveShadow = true;
    millsGroup.add(baseBed);

    const millStands: THREE.Mesh[] = [];
    const rollers: THREE.Mesh[] = [];

    // 5 Mills in Tandem
    for (let i = 0; i < 5; i++) {
      const xPos = i * 6 - 12;
      const isFaultedMill = i === 2; // Molino 3

      // Housing Chumacera
      const standGeo = new THREE.BoxGeometry(4.2, 5.5, 4.8);
      const standMat = new THREE.MeshStandardMaterial({
        color: isFaultedMill ? 0xd97706 : 0x047857,
        metalness: 0.65,
        roughness: 0.35,
      });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(xPos, 3.2, 0);
      stand.castShadow = true;
      stand.receiveShadow = true;
      stand.name = `mill-stand-${i}`;
      millsGroup.add(stand);
      millStands.push(stand);

      // Grooved Top Roller (Steel Maza)
      const rollerGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.4, 24);
      const rollerMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.15,
      });
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(xPos, 4.2, 0);
      roller.name = `roller-${i}`;
      millsGroup.add(roller);
      rollers.push(roller);

      // Hydraulic Top Ram Cap
      const ramGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
      const ramMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 });
      const ram = new THREE.Mesh(ramGeo, ramMat);
      ram.position.set(xPos, 6.4, 0);
      millsGroup.add(ram);
    }

    // Overhead Cane Donnelly Chute & Intermediate Carriers
    const chuteGeo = new THREE.BoxGeometry(34, 1.2, 3.2);
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 });
    const chute = new THREE.Mesh(chuteGeo, chuteMat);
    chute.position.set(0, 6.2, 0);
    chute.castShadow = true;
    millsGroup.add(chute);

    // Juice Collection Pan (Bandeja de Jugos)
    const juicePanGeo = new THREE.BoxGeometry(30, 0.8, 6);
    const juicePanMat = new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.3, roughness: 0.6 });
    const juicePan = new THREE.Mesh(juicePanGeo, juicePanMat);
    juicePan.position.set(0, 1.4, 0);
    millsGroup.add(juicePan);

    scene.add(millsGroup);
    interactiveObjects["eq-molino-1"] = millsGroup;
    interactiveObjects["eq-molino-3"] = millsGroup;
    interactiveObjects["eq-molino-5"] = millsGroup;

    // ==========================================
    // UNIT 2: HIGH PRESSURE BIOMASS BOILER (ASME PTC 4)
    // ==========================================
    const boilerGroup = new THREE.Group();
    boilerGroup.position.set(-18, 0, -8);
    boilerGroup.name = "eq-caldera-1";

    // Main Waterwall Furnace (Hogar de Biomasa)
    const boilerBodyGeo = new THREE.BoxGeometry(12, 18, 14);
    const boilerMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3,
    });
    const boilerBody = new THREE.Mesh(boilerBodyGeo, boilerMat);
    boilerBody.position.y = 9;
    boilerBody.castShadow = true;
    boilerBody.receiveShadow = true;
    boilerGroup.add(boilerBody);

    // Steam Drum on top (Domo de Vapor Alta Presión)
    const drumGeo = new THREE.CylinderGeometry(2.0, 2.0, 13, 32);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.2 });
    const steamDrum = new THREE.Mesh(drumGeo, drumMat);
    steamDrum.rotation.z = Math.PI / 2;
    steamDrum.position.set(0, 19, 0);
    steamDrum.castShadow = true;
    boilerGroup.add(steamDrum);

    // Superheater & Economizer Bank Headers
    const ecoBankGeo = new THREE.BoxGeometry(6, 12, 8);
    const ecoMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
    const ecoBank = new THREE.Mesh(ecoBankGeo, ecoMat);
    ecoBank.position.set(9, 6, 0);
    boilerGroup.add(ecoBank);

    // Tall Chimney Stack (Chimenea con tiro inducido)
    const chimneyGeo = new THREE.CylinderGeometry(1.6, 2.4, 28, 32);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(13, 14, 0);
    chimney.castShadow = true;
    boilerGroup.add(chimney);

    // Boiler Furnace Window Glow (Mirilla de llama)
    const flameWindowGeo = new THREE.PlaneGeometry(3, 4);
    const flameWindowMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const flameWindow = new THREE.Mesh(flameWindowGeo, flameWindowMat);
    flameWindow.position.set(-6.05, 5, 0);
    flameWindow.rotation.y = -Math.PI / 2;
    boilerGroup.add(flameWindow);

    scene.add(boilerGroup);
    interactiveObjects["eq-caldera-1"] = boilerGroup;

    // ==========================================
    // UNIT 3: TURBOGENERATOR & SUBSTATION (35 MVA / 138 kV)
    // ==========================================
    const turbineGroup = new THREE.Group();
    turbineGroup.position.set(12, 0, -8);
    turbineGroup.name = "eq-turbina-1";

    // Turbine Hall Enclosure Structure (Transparent Glass/Steel)
    const turbHallGeo = new THREE.BoxGeometry(18, 10, 16);
    const turbHallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.65,
      metalness: 0.8,
      roughness: 0.2,
    });
    const turbHall = new THREE.Mesh(turbHallGeo, turbHallMat);
    turbHall.position.y = 5;
    turbineGroup.add(turbHall);

    // Steam Turbine Casing (High Pressure + Low Pressure Multistage)
    const turbCasingGeo = new THREE.CylinderGeometry(2.4, 2.8, 8, 32);
    const turbMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.2 });
    const turbCasing = new THREE.Mesh(turbCasingGeo, turbMat);
    turbCasing.rotation.z = Math.PI / 2;
    turbCasing.position.set(-4, 4, 0);
    turbCasing.castShadow = true;
    turbineGroup.add(turbCasing);

    // 35 MVA Synchronous Generator Stator Body
    const genStatorGeo = new THREE.CylinderGeometry(2.8, 2.8, 7, 32);
    const genMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
    const genStator = new THREE.Mesh(genStatorGeo, genMat);
    genStator.rotation.z = Math.PI / 2;
    genStator.position.set(4, 4, 0);
    genStator.castShadow = true;
    turbineGroup.add(genStator);

    // High Voltage Step-Up Transformer (13.8 kV -> 138 kV)
    const transformerGeo = new THREE.BoxGeometry(6, 6, 6);
    const transformerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    const transformer = new THREE.Mesh(transformerGeo, transformerMat);
    transformer.position.set(15, 3, 0);
    transformer.castShadow = true;
    turbineGroup.add(transformer);

    // Transformer Bushings & Insulators
    for (let b = 0; b < 3; b++) {
      const bushGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.5, 16);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 });
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.set(13.5 + b * 1.5, 7.2, 0);
      turbineGroup.add(bush);
    }

    scene.add(turbineGroup);
    interactiveObjects["eq-turbina-1"] = turbineGroup;

    // ==========================================
    // UNIT 4: EVAPORATORS, JUICE CLARIFIER & VACUUM PANS
    // ==========================================
    const factoryGroup = new THREE.Group();
    factoryGroup.position.set(12, 0, 14);
    factoryGroup.name = "eq-evaporadores";

    // Quadruple Effect Falling Film Evaporators
    for (let j = 0; j < 4; j++) {
      const evapVesselGeo = new THREE.CylinderGeometry(2.4, 2.4, 9, 32);
      const evapMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        metalness: 0.8,
        roughness: 0.2,
      });
      const evapVessel = new THREE.Mesh(evapVesselGeo, evapMat);
      evapVessel.position.set(j * 5.2 - 7.8, 5, 0);
      evapVessel.castShadow = true;
      factoryGroup.add(evapVessel);

      // Top Dome
      const domeGeo = new THREE.SphereGeometry(2.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, evapMat);
      dome.position.set(j * 5.2 - 7.8, 9.5, 0);
      factoryGroup.add(dome);

      // Vapor Interconnecting Duct
      if (j < 3) {
        const ductGeo = new THREE.CylinderGeometry(0.6, 0.6, 5.2, 16);
        const ductMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
        const duct = new THREE.Mesh(ductGeo, ductMat);
        duct.rotation.z = Math.PI / 2;
        duct.position.set(j * 5.2 - 5.2, 10.5, 0);
        factoryGroup.add(duct);
      }
    }

    // Continuous Juice Clarifier (Dorr-Oliver Type Tank)
    const clarifierGeo = new THREE.CylinderGeometry(5.0, 4.0, 7, 32);
    const clarifierMat = new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.6, roughness: 0.4 });
    const clarifier = new THREE.Mesh(clarifierGeo, clarifierMat);
    clarifier.position.set(-15, 4, 0);
    clarifier.castShadow = true;
    factoryGroup.add(clarifier);

    scene.add(factoryGroup);
    interactiveObjects["eq-evaporadores"] = factoryGroup;
    interactiveObjects["eq-clarificador"] = factoryGroup;

    // ==========================================
    // UNIT 5: SUGAR DRYING, SILOS & AUTOMATIC PACKAGING
    // ==========================================
    const packGroup = new THREE.Group();
    packGroup.position.set(32, 0, 14);
    packGroup.name = "eq-secador-ensacado";

    // 2 Sugar Storage Silos (White Food-Grade Steel)
    for (let s = 0; s < 2; s++) {
      const siloGeo = new THREE.CylinderGeometry(3.6, 3.6, 14, 32);
      const siloMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5, roughness: 0.3 });
      const silo = new THREE.Mesh(siloGeo, siloMat);
      silo.position.set(s * 8 - 4, 7.5, 0);
      silo.castShadow = true;
      packGroup.add(silo);

      const siloConeGeo = new THREE.ConeGeometry(3.6, 3.0, 32);
      const siloCone = new THREE.Mesh(siloConeGeo, siloMat);
      siloCone.position.set(s * 8 - 4, 16.0, 0);
      packGroup.add(siloCone);
    }

    scene.add(packGroup);
    interactiveObjects["eq-secador-ensacado"] = packGroup;

    // ==========================================
    // CONNECTING OVERHEAD PIPELINE NETWORK IN 3D
    // ==========================================
    // 1. High Pressure Steam Pipeline (Boiler 65 bar -> Turbine 35 MVA)
    const hpSteamGeo = new THREE.CylinderGeometry(0.6, 0.6, 30, 16);
    const hpSteamMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x083344,
    });
    const hpSteamPipe = new THREE.Mesh(hpSteamGeo, hpSteamMat);
    hpSteamPipe.rotation.z = Math.PI / 2;
    hpSteamPipe.position.set(-3, 16, -8);
    scene.add(hpSteamPipe);

    // 2. Bagasse Belt Conveyor (Mills -> Boiler & Yard)
    const bagasseConveyorGeo = new THREE.BoxGeometry(2, 0.6, 26);
    const bagasseConveyorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6 });
    const bagasseConveyor = new THREE.Mesh(bagasseConveyorGeo, bagasseConveyorMat);
    bagasseConveyor.position.set(-18, 5.5, 3);
    scene.add(bagasseConveyor);

    // 3. Raw Juice Pipe (Mills -> Clarifier)
    const juicePipeGeo = new THREE.CylinderGeometry(0.5, 0.5, 30, 16);
    const juicePipeMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.7 });
    const juicePipe = new THREE.Mesh(juicePipeGeo, juicePipeMat);
    juicePipe.rotation.z = Math.PI / 2;
    juicePipe.position.set(-3, 2.5, 14);
    scene.add(juicePipe);

    // ==========================================
    // PARTICLE SYSTEMS: SMOKE & ELECTRICAL ENERGY
    // ==========================================
    // Chimney Smoke Particles
    const smokeCount = 120;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities: { x: number; y: number; z: number }[] = [];

    for (let p = 0; p < smokeCount; p++) {
      smokePositions[p * 3] = -5 + (Math.random() - 0.5) * 1.5; // Chimney X (-18 + 13)
      smokePositions[p * 3 + 1] = 28 + Math.random() * 15;
      smokePositions[p * 3 + 2] = -8 + (Math.random() - 0.5) * 1.5;
      smokeVelocities.push({
        x: 0.05 + Math.random() * 0.05,
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
      pulse.position.set(-18 + k * 5, 16, -8);
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

    const onPointerDown = (event: MouseEvent) => {
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
    renderer.domElement.addEventListener("click", onPointerDown);

    // 8. Main 60-FPS Real-time Animation Loop with Physical Mechanical Vibration & Particles
    let orbitAngle = 0;
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

        if (positions[p * 3 + 1] > 48) {
          positions[p * 3] = -5 + (Math.random() - 0.5) * 1.5;
          positions[p * 3 + 1] = 28;
          positions[p * 3 + 2] = -8 + (Math.random() - 0.5) * 1.5;
        }
      }
      smokeGeo.attributes.position.needsUpdate = true;

      // Animate Energy Pulses along HP Steam Line
      energyPulses.forEach((pulse) => {
        pulse.position.x += 0.18;
        if (pulse.position.x > 12) {
          pulse.position.x = -18;
        }
      });

      // Smooth Camera Interpolation (Lerp to selected focus target)
      if (isRotating) {
        orbitAngle += 0.0025;
        camera.position.x = 55 * Math.cos(orbitAngle);
        camera.position.z = 55 * Math.sin(orbitAngle);
        camera.position.y = 36;
        camera.lookAt(0, 5, 0);
      } else {
        camera.position.lerp(cameraTargetRef.current.pos, 0.05);
        camera.lookAt(cameraTargetRef.current.target);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousemove", onPointerMove);
      renderer.domElement.removeEventListener("click", onPointerDown);
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
    <div ref={containerRef} className="space-y-4">
      {/* 3D Viewport Controls & HUD Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white font-tech tracking-wider uppercase">
              Gemelo Digital 3D • Central Azucarero & Cogeneración
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              60 FPS WebGL PBR
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Renderizado tridimensional acelerado por GPU con vibración física en tiempo real y vinculación a instrumentación de campo
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
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Flujo Energía</span>
            </button>

            <button
              onClick={() => setViewMode("HEALTH")}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                viewMode === "HEALTH"
                  ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Salud ISO 10816</span>
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
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRotating ? "Órbita Activa" : "Órbita Pausada"}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 3D Canvas Area with Floating Telemetry HUD */}
      <div className="relative w-full h-[580px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top-Left Telemetry Badge & Performance Indicator */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>GPU WebGL Render: <strong className="text-emerald-300">{fps} FPS</strong></span>
          <span className="text-slate-600">|</span>
          <span>Molienda: <strong className="text-cyan-300">{telemetry.tch} TCH</strong></span>
          <span className="text-slate-600">|</span>
          <span>Generación: <strong className="text-amber-300">{telemetry.powerGeneratedMW} MW</strong></span>
        </div>

        {/* Hover Equipment Tooltip */}
        {hoveredEqName && (
          <div className="absolute top-14 left-4 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/40 text-xs font-mono text-cyan-300 flex items-center gap-2 animate-fadeIn">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Haz clic para enfocar: <strong>{hoveredEqName.toUpperCase()}</strong></span>
          </div>
        )}

        {/* Floating Equipment Quick Selector Buttons (Bottom left) */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-1.5 z-10 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800 max-w-lg shadow-xl">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block w-full px-1 font-mono">
            Cámaras & Activos Críticos:
          </span>
          {[
            { id: "overview", label: "Vista General Planta" },
            { id: "eq-molino-3", label: "Molino 3 (Tándem)", alert: telemetry.mill3Vibration > 4.5 },
            { id: "eq-caldera-1", label: "Caldera 65 bar (ASME)" },
            { id: "eq-turbina-1", label: "Turbogenerador 35 MVA" },
            { id: "eq-evaporadores", label: "Evaporadores & Clarificador" },
            { id: "eq-secador-ensacado", label: "Silos & Ensacado" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectEquipment(item.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-mono transition flex items-center gap-1.5 ${
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
          <div className="absolute bottom-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5">
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
          <div className="absolute top-4 right-4 w-84 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl z-10 animate-fadeIn">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 block font-bold">
                  {selectedEquipment.code || "TAG-001"}
                </span>
                <h3 className="text-sm font-bold text-white font-tech leading-tight">
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

            <div className="grid grid-cols-2 gap-2 my-3 font-mono">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Health Index</span>
                <span className="text-base font-bold text-emerald-400">
                  {selectedEquipment.healthIndex}%
                </span>
                <span className="text-[9px] text-slate-500 block">ISO 10816 Clase II</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Vibración RMS</span>
                <span
                  className={`text-base font-bold ${
                    selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold
                      ? "text-amber-400"
                      : "text-white"
                  }`}
                >
                  {selectedEquipment.vibrationRMS} mm/s
                </span>
                <span className="text-[9px] text-slate-500 block">Límite: {selectedEquipment.vibrationThreshold} mm/s</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Temperatura</span>
                <span className="text-base font-bold text-white">
                  {selectedEquipment.temperatureC} °C
                </span>
                <span className="text-[9px] text-slate-500 block">Sonda PT100</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Carga Motor</span>
                <span className="text-base font-bold text-cyan-400">
                  {selectedEquipment.loadPercentage}%
                </span>
                <span className="text-[9px] text-slate-500 block">Corriente nominal</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Tag PLC / UNS:</span>
                <span className="text-cyan-300 font-bold">{selectedEquipment.plcTag}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Último Servicio:</span>
                <span className="text-slate-300">{selectedEquipment.lastMaintenance}</span>
              </div>
              {selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold && (
                <div className="p-2 mt-2 bg-amber-950/50 rounded-lg border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Alerta de vibración armónica 1X/BPFO detectada en chumacera.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
