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
  ChevronRight
} from "lucide-react";
import { TelemetryData, EquipmentItem } from "../types";

interface DigitalTwin3DProps {
  telemetry: TelemetryData;
  equipmentList: EquipmentItem[];
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  telemetry,
  equipmentList = [],
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedEqId, setSelectedEqId] = useState<string>("eq-caldera-1");
  const [viewMode, setViewMode] = useState<"STANDARD" | "THERMAL" | "ENERGY" | "HEALTH">("STANDARD");
  const [isRotating, setIsRotating] = useState<boolean>(true);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const interactiveObjectsRef = useRef<{ [key: string]: THREE.Object3D }>({});
  const animationFrameIdRef = useRef<number | null>(null);

  const safeEquipmentList = Array.isArray(equipmentList) ? equipmentList : [];
  const selectedEquipment =
    safeEquipmentList.find((e) => e.id === selectedEqId) ||
    safeEquipmentList[0] ||
    ({} as EquipmentItem);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 550;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060a14);
    scene.fog = new THREE.FogExp2(0x060a14, 0.015);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(45, 35, 55);
    camera.lookAt(0, 5, 0);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(30, 50, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Boiler fiery glow light
    const boilerLight = new THREE.PointLight(0xff7700, 2.5, 30);
    boilerLight.position.set(-15, 8, -5);
    scene.add(boilerLight);

    // Cogeneration electrical blue/yellow light
    const turbineLight = new THREE.PointLight(0x00d4ff, 2.0, 25);
    turbineLight.position.set(10, 6, -10);
    scene.add(turbineLight);

    // 5. Floor & Industrial Grid
    const gridHelper = new THREE.GridHelper(90, 45, 0x10b981, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090e1c,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 6. BUILD INDUSTRIAL 3D UNITS
    const interactiveObjects: { [key: string]: THREE.Object3D } = {};

    // Group 1: Biomass Boiler (Caldera Acuotubular 65 bar)
    const boilerGroup = new THREE.Group();
    boilerGroup.position.set(-18, 0, -8);
    boilerGroup.name = "eq-caldera-1";

    // Main Boiler Structure
    const boilerBodyGeo = new THREE.BoxGeometry(10, 16, 12);
    const boilerMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.3,
    });
    const boilerBody = new THREE.Mesh(boilerBodyGeo, boilerMat);
    boilerBody.position.y = 8;
    boilerBody.castShadow = true;
    boilerBody.receiveShadow = true;
    boilerGroup.add(boilerBody);

    // Steam Drum on top
    const drumGeo = new THREE.CylinderGeometry(1.8, 1.8, 12, 24);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8, roughness: 0.2 });
    const steamDrum = new THREE.Mesh(drumGeo, drumMat);
    steamDrum.rotation.z = Math.PI / 2;
    steamDrum.position.set(0, 17, 0);
    boilerGroup.add(steamDrum);

    // Tall Chimney
    const chimneyGeo = new THREE.CylinderGeometry(1.4, 2.0, 24, 20);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(6, 12, 4);
    chimney.castShadow = true;
    boilerGroup.add(chimney);

    scene.add(boilerGroup);
    interactiveObjects["eq-caldera-1"] = boilerGroup;
    interactiveObjects["eq-caldera-2"] = boilerGroup;

    // Group 2: Tandem Milling Train (5 Rolling Mills)
    const millsGroup = new THREE.Group();
    millsGroup.position.set(-18, 0, 14);
    millsGroup.name = "eq-molino-3";

    // 5 Mill Stands
    for (let i = 0; i < 5; i++) {
      const millStandGeo = new THREE.BoxGeometry(4, 5, 4);
      const millMat = new THREE.MeshStandardMaterial({
        color: i === 2 ? 0xd97706 : 0x10b981, // Mill 3 is amber in anomaly
        metalness: 0.7,
        roughness: 0.3,
      });
      const millStand = new THREE.Mesh(millStandGeo, millMat);
      millStand.position.set(i * 6 - 12, 2.5, 0);
      millStand.castShadow = true;
      millsGroup.add(millStand);

      // Top roller
      const rollerGeo = new THREE.CylinderGeometry(1.0, 1.0, 3.8, 16);
      const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(i * 6 - 12, 3.8, 0);
      roller.name = `roller-${i}`;
      millsGroup.add(roller);
    }

    // Cane Chute / Bridge
    const chuteGeo = new THREE.BoxGeometry(32, 1, 3);
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const chute = new THREE.Mesh(chuteGeo, chuteMat);
    chute.position.set(0, 5.2, 0);
    millsGroup.add(chute);

    scene.add(millsGroup);
    interactiveObjects["eq-molino-1"] = millsGroup;
    interactiveObjects["eq-molino-3"] = millsGroup;
    interactiveObjects["eq-molino-5"] = millsGroup;

    // Group 3: Turbogenerator & Power House (35 MVA)
    const turbineGroup = new THREE.Group();
    turbineGroup.position.set(12, 0, -8);
    turbineGroup.name = "eq-turbina-1";

    const turbHallGeo = new THREE.BoxGeometry(16, 8, 14);
    const turbHallMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.6,
      wireframe: false,
    });
    const turbHall = new THREE.Mesh(turbHallGeo, turbHallMat);
    turbHall.position.y = 4;
    turbineGroup.add(turbHall);

    // Turbine Rotor & Generator Body
    const turbBodyGeo = new THREE.CylinderGeometry(2.2, 2.2, 11, 24);
    const turbBodyMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      metalness: 0.8,
      roughness: 0.2,
    });
    const turbBody = new THREE.Mesh(turbBodyGeo, turbBodyMat);
    turbBody.rotation.z = Math.PI / 2;
    turbBody.position.set(0, 3.5, 0);
    turbBody.castShadow = true;
    turbineGroup.add(turbBody);

    // High Voltage Transformer Yard
    const transfGeo = new THREE.BoxGeometry(5, 5, 5);
    const transfMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const transf = new THREE.Mesh(transfGeo, transfMat);
    transf.position.set(12, 2.5, 0);
    turbineGroup.add(transf);

    scene.add(turbineGroup);
    interactiveObjects["eq-turbina-1"] = turbineGroup;

    // Group 4: Evaporator Station & Vacuum Pans
    const evapGroup = new THREE.Group();
    evapGroup.position.set(12, 0, 14);
    evapGroup.name = "eq-evaporadores";

    for (let j = 0; j < 4; j++) {
      const vesselGeo = new THREE.CylinderGeometry(2.2, 2.2, 8, 20);
      const vesselMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        metalness: 0.7,
        roughness: 0.2,
      });
      const vessel = new THREE.Mesh(vesselGeo, vesselMat);
      vessel.position.set(j * 5 - 7.5, 4.5, 0);
      vessel.castShadow = true;
      evapGroup.add(vessel);

      // Top Dome
      const domeGeo = new THREE.SphereGeometry(2.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, vesselMat);
      dome.position.set(j * 5 - 7.5, 8.5, 0);
      evapGroup.add(dome);
    }

    scene.add(evapGroup);
    interactiveObjects["eq-evaporadores"] = evapGroup;
    interactiveObjects["eq-tachos"] = evapGroup;
    interactiveObjects["eq-clarificador"] = evapGroup;

    // Group 5: Sugar Packaging & Silos
    const packGroup = new THREE.Group();
    packGroup.position.set(30, 0, 14);
    packGroup.name = "eq-secador-ensacado";

    const siloGeo = new THREE.CylinderGeometry(3.5, 3.5, 12, 24);
    const siloMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.2 });
    const silo = new THREE.Mesh(siloGeo, siloMat);
    silo.position.set(0, 6, 0);
    silo.castShadow = true;
    packGroup.add(silo);

    scene.add(packGroup);
    interactiveObjects["eq-secador-ensacado"] = packGroup;

    // Connecting Pipe Lines in 3D
    // Bagasse conveyor: Mills to Boiler
    const bagassePipeGeo = new THREE.CylinderGeometry(0.5, 0.5, 24, 12);
    const bagassePipeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 });
    const bagassePipe = new THREE.Mesh(bagassePipeGeo, bagassePipeMat);
    bagassePipe.rotation.x = Math.PI / 2;
    bagassePipe.position.set(-18, 5, 3);
    scene.add(bagassePipe);

    // Steam Line: Boiler to Turbine
    const steamPipeGeo = new THREE.CylinderGeometry(0.6, 0.6, 30, 12);
    const steamPipeMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8 });
    const steamPipe = new THREE.Mesh(steamPipeGeo, steamPipeMat);
    steamPipe.rotation.z = Math.PI / 2;
    steamPipe.position.set(-3, 10, -8);
    scene.add(steamPipe);

    interactiveObjectsRef.current = interactiveObjects;

    // 7. Raycaster for 3D selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

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
          setSelectedEqId(current.name);
        }
      }
    };

    renderer.domElement.addEventListener("click", onPointerDown);

    // 8. Animation Loop
    let angle = 0;
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      // Rotate rollers in mills
      millsGroup.children.forEach((child) => {
        if (child.name && child.name.startsWith("roller")) {
          child.rotation.y += 0.05;
        }
      });

      // Slow orbit if enabled
      if (isRotating) {
        angle += 0.002;
        camera.position.x = 55 * Math.cos(angle);
        camera.position.z = 55 * Math.sin(angle);
        camera.lookAt(0, 5, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 550;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
    };
  }, [isRotating]);

  // Adjust material colors based on View Mode
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (viewMode === "THERMAL") {
          // Heatmap: Boilers & steam pipes red/amber, cold blue
          if (obj.parent?.name?.includes("caldera") || obj.name?.includes("caldera")) {
            mat.color.setHex(0xef4444);
            mat.emissive.setHex(0x7f1d1d);
          } else if (obj.parent?.name?.includes("turbina")) {
            mat.color.setHex(0xf59e0b);
            mat.emissive.setHex(0x78350f);
          } else {
            mat.color.setHex(0x0284c7);
            mat.emissive.setHex(0x082f49);
          }
        } else if (viewMode === "ENERGY") {
          // Energy flow
          if (obj.parent?.name?.includes("turbina") || obj.name?.includes("turbina")) {
            mat.color.setHex(0xfacc15);
            mat.emissive.setHex(0x713f12);
          } else {
            mat.color.setHex(0x1e293b);
            mat.emissive.setHex(0x000000);
          }
        } else if (viewMode === "HEALTH") {
          // Health status
          if (obj.parent?.name?.includes("molino")) {
            mat.color.setHex(0xf59e0b); // Warning
            mat.emissive.setHex(0x451a03);
          } else {
            mat.color.setHex(0x10b981); // Good
            mat.emissive.setHex(0x064e3b);
          }
        } else {
          // Standard
          mat.emissive.setHex(0x000000);
        }
      }
    });
  }, [viewMode]);

  return (
    <div className="space-y-4">
      {/* 3D Viewport Controls & HUD Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            Gemelo Digital 3D de Central Azucarero & Planta de Biomasa
          </h2>
          <p className="text-xs text-slate-400">
            Renderizado WebGL interactivo en tiempo real con vinculación a tags de instrumentación
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode("STANDARD")}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              viewMode === "STANDARD"
                ? "bg-slate-800 text-cyan-400 font-semibold"
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
                ? "bg-rose-950/80 text-rose-300 font-semibold border border-rose-500/40"
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
                ? "bg-yellow-950/80 text-yellow-300 font-semibold border border-yellow-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Flujo Eléctrico</span>
          </button>

          <button
            onClick={() => setViewMode("HEALTH")}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              viewMode === "HEALTH"
                ? "bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Salud & Alarmas</span>
          </button>
        </div>

        {/* Orbit auto-rotate toggle */}
        <button
          onClick={() => setIsRotating((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs transition ${
            isRotating
              ? "bg-slate-800 border-slate-700 text-emerald-400"
              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isRotating ? "Rotación Activa" : "Pausar Cámara"}</span>
        </button>
      </div>

      {/* 3D Canvas Area with Floating Telemetry HUD */}
      <div className="relative w-full h-[540px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Equipment Quick Selector Buttons (Overlay bottom left) */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-10 bg-slate-900/80 backdrop-blur p-2 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block w-full px-1">
            Enfocar Equipo:
          </span>
          {[
            { id: "eq-caldera-1", label: "Caldera 65 bar" },
            { id: "eq-molino-3", label: "Molinos (Tándem)" },
            { id: "eq-turbina-1", label: "Turbina 35 MVA" },
            { id: "eq-evaporadores", label: "Evaporadores" },
            { id: "eq-secador-ensacado", label: "Ensacado" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedEqId(item.id)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                selectedEqId === item.id
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Floating Machine Telemetry HUD (Overlay top right) */}
        {selectedEquipment && (
          <div className="absolute top-4 right-4 w-80 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-4 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 block">
                  {selectedEquipment.code}
                </span>
                <h3 className="text-sm font-bold text-white font-tech leading-tight">
                  {selectedEquipment.name}
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  selectedEquipment.status === "WARNING"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {selectedEquipment.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Health Index</span>
                <span className="text-base font-bold font-tech text-emerald-400">
                  {selectedEquipment.healthIndex}%
                </span>
              </div>

              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Vibración RMS</span>
                <span
                  className={`text-base font-bold font-tech ${
                    selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold
                      ? "text-amber-400"
                      : "text-white"
                  }`}
                >
                  {selectedEquipment.vibrationRMS} mm/s
                </span>
              </div>

              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Temperatura</span>
                <span className="text-base font-bold font-tech text-white">
                  {selectedEquipment.temperatureC} °C
                </span>
              </div>

              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Carga Motor</span>
                <span className="text-base font-bold font-tech text-cyan-400">
                  {selectedEquipment.loadPercentage}%
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Tag PLC:</span>
                <span className="font-mono text-cyan-300">{selectedEquipment.plcTag}</span>
              </div>
              <div className="flex justify-between">
                <span>Último Mantenimiento:</span>
                <span className="font-mono text-slate-300">{selectedEquipment.lastMaintenance}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
