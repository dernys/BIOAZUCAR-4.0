/**
 * BioAzúcar 4.0 — Agricultural Persistence & Industrial Flow Service
 * Real-time synchronization with Firestore and Local Cache fallback.
 * 
 * Bridges Field Operations with Industrial Infrastructure:
 * Harvest → CCT → CaneBatch → Industry → CMMS WorkOrders → Economics → BioAI
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { COLLECTIONS } from "../dbService";
import {
  AgriculturalParameter,
  FieldPlot,
  AgriculturalCampaign,
  CaneVarietyYieldMaster,
  AgroOperationMaster,
  AgriculturalEquipmentAsset,
  AgriculturalInputMaster,
  AgriculturalScenario,
  AgriculturalAuditChangeRecord,
  AgronomicAlert,
  AgroPlanExecutionMetric,
} from "../../types/agriculture";
import { CaneBatch, WorkOrder } from "../../types";
import {
  AgriculturalParameterRegistry,
  CANONICAL_AGRICULTURAL_PARAMETERS,
} from "./AgriculturalParameterRegistry";
import {
  INITIAL_FIELD_PLOTS,
  INITIAL_AGRICULTURAL_CAMPAIGN,
} from "../../data/mockAgriculturalData";
import { STANDARD_AGRO_OPERATIONS } from "./AgriculturalPlanningService";

export const AGRO_COLLECTIONS = {
  PARAMETERS: "agricultural_parameters",
  CAMPAIGNS: "agricultural_campaigns",
  PLOTS: "agricultural_plots",
  VARIETIES: "agricultural_varieties",
  OPERATIONS: "agricultural_operations",
  EQUIPMENT: "agricultural_equipment",
  INPUTS: "agricultural_inputs",
  SCENARIOS: "agricultural_scenarios",
  AUDIT: "agricultural_audit_trail",
} as const;

// Local storage cache keys
const STORAGE_KEYS = {
  PARAMS: "bioazucar_agricultural_parameters",
  PLOTS: "bioazucar_agricultural_plots",
  CAMPAIGN: "bioazucar_agricultural_campaign",
  CAMPAIGNS_LIST: "bioazucar_agricultural_campaigns_list",
  OPERATIONS: "bioazucar_agricultural_operations",
  VARIETIES: "bioazucar_agricultural_varieties",
  EQUIPMENT: "bioazucar_agricultural_equipment",
  INPUTS: "bioazucar_agricultural_inputs",
  SCENARIOS: "bioazucar_agricultural_scenarios",
  AUDIT: "bioazucar_agricultural_audit_trail",
};

export function normalizeCampaign(camp: any): AgriculturalCampaign {
  if (!camp) return INITIAL_AGRICULTURAL_CAMPAIGN;
  const milling = Number(camp.targetMillingTons ?? camp.projectedTotalCaneTons ?? 1045250);
  const sugar = Number(camp.targetSugarTons ?? camp.sugarTargetTons ?? 118000);
  const harvestDays = Math.max(1, Number(camp.effectiveHarvestDays ?? 155));
  const renovation = Number(camp.plannedRenovationRatePercent ?? camp.renewalTargetPercent ?? 16.5);
  const dailyRequirement = harvestDays > 0 ? milling / harvestDays : 0;

  return {
    id: String(camp.id || `camp-${Date.now()}`),
    tenantId: String(camp.tenantId || "TENANT_AZUCAR_01"),
    name: String(camp.name || "Zafra BioAzúcar"),
    calendarDays: Number(camp.calendarDays || harvestDays + 25),
    effectiveHarvestDays: harvestDays,
    totalAreaHectares: Number(camp.totalAreaHectares || 12500),
    renewalTargetPercent: renovation,
    projectedTotalCaneTons: milling,
    dailyHarvestRequirementTons: Number(camp.dailyHarvestRequirementTons || dailyRequirement),
    averageTchCampaign: Number(camp.averageTchCampaign || 83.62),
    sugarTargetTons: sugar,
    status: (camp.status === "ACTIVA" ? "ACTIVE" : camp.status === "PLANIFICADA" ? "DRAFT" : camp.status === "ARCHIVADA" ? "ARCHIVED" : (camp.status || "ACTIVE")),
    createdAt: String(camp.createdAt || new Date().toISOString()),
    updatedAt: String(camp.updatedAt || new Date().toISOString()),
    targetMillingTons: milling,
    targetSugarTons: sugar,
    plannedRenovationRatePercent: renovation,
    startDate: camp.startDate || "15 Nov 2026",
    endDate: camp.endDate || "18 Abr 2027",
    description: camp.description || "",
  };
}

export const INITIAL_AGRICULTURAL_CAMPAIGNS_LIST: AgriculturalCampaign[] = [
  INITIAL_AGRICULTURAL_CAMPAIGN,
  {
    id: "camp-2025-2026",
    tenantId: "TENANT_AZUCAR_01",
    name: "Zafra Histórica 2025/2026 — Balance Final Consolidado",
    calendarDays: 175,
    effectiveHarvestDays: 148,
    totalAreaHectares: 12200.0,
    renewalTargetPercent: 15.8,
    projectedTotalCaneTons: 980000.0,
    dailyHarvestRequirementTons: 6621.6,
    averageTchCampaign: 80.33,
    sugarTargetTons: 110500.0,
    status: "ARCHIVED",
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: "2026-05-30T12:00:00.000Z",
    targetMillingTons: 980000.0,
    targetSugarTons: 110500.0,
    plannedRenovationRatePercent: 15.8,
    startDate: "10 Nov 2025",
    endDate: "07 Abr 2026",
    description: "Zafra histórica consolidada con balance fabril verificado.",
  },
  {
    id: "camp-2027-2028-draft",
    tenantId: "TENANT_AZUCAR_01",
    name: "Zafra Proyectada 2027/2028 — Expansión & Nuevos Regadíos",
    calendarDays: 185,
    effectiveHarvestDays: 160,
    totalAreaHectares: 13800.0,
    renewalTargetPercent: 18.0,
    projectedTotalCaneTons: 1180000.0,
    dailyHarvestRequirementTons: 7375.0,
    averageTchCampaign: 85.5,
    sugarTargetTons: 135000.0,
    status: "DRAFT",
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    targetMillingTons: 1180000.0,
    targetSugarTons: 135000.0,
    plannedRenovationRatePercent: 18.0,
    startDate: "15 Nov 2027",
    endDate: "24 Abr 2028",
    description: "Zafra proyectada plurianual con plan de expansión a 13,800 ha.",
  },
];

export const INITIAL_EQUIPMENT_ASSETS: AgriculturalEquipmentAsset[] = [
  {
    id: "eq-tr-01",
    tenantId: "TENANT_AZUCAR_01",
    code: "TR-210-01",
    name: "Tractor Pesado John Deere 8320R (210 HP)",
    category: "TRACTOR_PESADO",
    powerHp: 210,
    acquisitionYear: 2022,
    estimatedUsefulLifeYears: 10,
    accumulatedEngineHours: 3420,
    mechanicalAvailabilityPercent: 88.5,
    hourlyOperatingCostUSD: 42.5,
    status: "OPERATIONAL",
  },
  {
    id: "eq-tr-02",
    tenantId: "TENANT_AZUCAR_01",
    code: "TR-210-02",
    name: "Tractor Pesado Case IH Magnum 220 (210 HP)",
    category: "TRACTOR_PESADO",
    powerHp: 210,
    acquisitionYear: 2021,
    estimatedUsefulLifeYears: 10,
    accumulatedEngineHours: 4180,
    mechanicalAvailabilityPercent: 84.0,
    hourlyOperatingCostUSD: 45.0,
    status: "OPERATIONAL",
  },
  {
    id: "eq-tr-03",
    tenantId: "TENANT_AZUCAR_01",
    code: "TR-140-01",
    name: "Tractor Medio New Holland T6.175 (140 HP)",
    category: "TRACTOR_MEDIO",
    powerHp: 140,
    acquisitionYear: 2023,
    estimatedUsefulLifeYears: 10,
    accumulatedEngineHours: 2150,
    mechanicalAvailabilityPercent: 91.0,
    hourlyOperatingCostUSD: 31.0,
    status: "OPERATIONAL",
  },
  {
    id: "eq-tr-04",
    tenantId: "TENANT_AZUCAR_01",
    code: "TR-090-01",
    name: "Tractor Ligero Massey Ferguson 4709 (90 HP)",
    category: "TRACTOR_LIGERO",
    powerHp: 90,
    acquisitionYear: 2020,
    estimatedUsefulLifeYears: 8,
    accumulatedEngineHours: 5100,
    mechanicalAvailabilityPercent: 82.0,
    hourlyOperatingCostUSD: 22.0,
    status: "OPERATIONAL",
  },
  {
    id: "eq-ch-01",
    tenantId: "TENANT_AZUCAR_01",
    code: "CH-350-01",
    name: "Cosechadora Combinada Case IH Austoft 8810",
    category: "COSECHADORA_COMBINADA",
    powerHp: 350,
    acquisitionYear: 2022,
    estimatedUsefulLifeYears: 7,
    accumulatedEngineHours: 2890,
    mechanicalAvailabilityPercent: 86.0,
    hourlyOperatingCostUSD: 95.0,
    status: "OPERATIONAL",
  },
  {
    id: "eq-ch-02",
    tenantId: "TENANT_AZUCAR_01",
    code: "CH-350-02",
    name: "Cosechadora Combinada John Deere CH570",
    category: "COSECHADORA_COMBINADA",
    powerHp: 350,
    acquisitionYear: 2023,
    estimatedUsefulLifeYears: 7,
    accumulatedEngineHours: 1940,
    mechanicalAvailabilityPercent: 89.5,
    hourlyOperatingCostUSD: 92.0,
    status: "OPERATIONAL",
  },
  {
    id: "eq-tb-01",
    tenantId: "TENANT_AZUCAR_01",
    code: "TB-180-01",
    name: "Tractor Transbordo Valtra BH180 + Vagón 14t Santal",
    category: "TRACTOR_TRANSBORDO",
    powerHp: 180,
    acquisitionYear: 2022,
    estimatedUsefulLifeYears: 8,
    accumulatedEngineHours: 3100,
    mechanicalAvailabilityPercent: 87.0,
    hourlyOperatingCostUSD: 38.0,
    status: "OPERATIONAL",
  },
  {
    id: "eq-cm-01",
    tenantId: "TENANT_AZUCAR_01",
    code: "CM-ROD-01",
    name: "Camión Articulado Scania G480 6x4 Bi-tren Cañero (45t)",
    category: "CAMION_CANERO_RODOVIARIO",
    powerHp: 480,
    acquisitionYear: 2021,
    estimatedUsefulLifeYears: 8,
    accumulatedEngineHours: 6200,
    mechanicalAvailabilityPercent: 85.0,
    hourlyOperatingCostUSD: 55.0,
    status: "OPERATIONAL",
  },
];

export const INITIAL_AGRICULTURAL_INPUTS: AgriculturalInputMaster[] = [
  {
    id: "inp-01",
    tenantId: "TENANT_AZUCAR_01",
    code: "FERT-NPK-15-05-30",
    name: "Fertilizante Químico Basal NPK 15-05-30",
    category: "FERTILIZANTE",
    standardDosePerHa: 400.0,
    unit: "kg/ha",
    unitCostUSD: 0.62,
    targetCycle: "PLANTACION",
    status: "ACTIVO",
    description: "Formulación balanceada para fondo de surco en plantío de caña nueva.",
    supplier: "Fertilizantes del Caribe S.A.",
  },
  {
    id: "inp-02",
    tenantId: "TENANT_AZUCAR_01",
    code: "FERT-UREA-46",
    name: "Urea Granulada 46% N (Cobertura)",
    category: "FERTILIZANTE",
    standardDosePerHa: 180.0,
    unit: "kg/ha",
    unitCostUSD: 0.55,
    targetCycle: "TRATOS_SOCA",
    status: "ACTIVO",
    description: "Aporte de nitrógeno para estimulación de rebrote en socas y retoños.",
    supplier: "Fertilizantes del Caribe S.A.",
  },
  {
    id: "inp-03",
    tenantId: "TENANT_AZUCAR_01",
    code: "ENM-CAL-AGRICOLA",
    name: "Enmienda Calcárea / Cal Dolomítica",
    category: "ENMIENDA",
    standardDosePerHa: 2000.0,
    unit: "kg/ha",
    unitCostUSD: 0.045,
    targetCycle: "PREPARACION",
    status: "ACTIVO",
    description: "Corrector de acidez edáfica y neutralizador de aluminio tóxico.",
    supplier: "Cantera Central BioAzúcar",
  },
  {
    id: "inp-04",
    tenantId: "TENANT_AZUCAR_01",
    code: "HERB-PRE-AMETRINA",
    name: "Herbicida Pre-emergente Ametrina + Atrazina 500 SC",
    category: "HERBICIDA",
    standardDosePerHa: 4.5,
    unit: "L/ha",
    unitCostUSD: 8.5,
    targetCycle: "TRATOS_PLANTA",
    status: "ACTIVO",
    description: "Control de malezas gramíneas y de hoja ancha en pre-emergencia temprana.",
    supplier: "AgroQuímica Internacional",
  },
  {
    id: "inp-05",
    tenantId: "TENANT_AZUCAR_01",
    code: "SUB-VINAZA-REC",
    name: "Vinaza Industrial Reciclada de Destilería",
    category: "SUBPRODUCTO",
    standardDosePerHa: 150.0,
    unit: "m3/ha",
    unitCostUSD: 0.0,
    targetCycle: "TRATOS_SOCA",
    status: "ACTIVO",
    description: "Fertirrigación orgánica rica en potasio y materia orgánica, reciclada 100% de fábrica.",
    supplier: "BioAzúcar Destilería Anexa",
  },
  {
    id: "inp-06",
    tenantId: "TENANT_AZUCAR_01",
    code: "SUB-CACHAZA-FILT",
    name: "Cachaza / Torta de Filtro de Clarificación",
    category: "SUBPRODUCTO",
    standardDosePerHa: 30.0,
    unit: "t/ha",
    unitCostUSD: 0.0,
    targetCycle: "PREPARACION",
    status: "ACTIVO",
    description: "Enmienda orgánica rica en fósforo disponible, residuo circular de la clarificación.",
    supplier: "BioAzúcar Fábrica de Azúcar",
  },
  {
    id: "inp-07",
    tenantId: "TENANT_AZUCAR_01",
    code: "COMB-DIESEL-AGRO",
    name: "Combustible Diésel B-10 Agrícola",
    category: "COMBUSTIBLE",
    standardDosePerHa: 0.0,
    unit: "L/h",
    unitCostUSD: 0.95,
    targetCycle: "GENERAL",
    status: "ACTIVO",
    description: "Carburante para la flota de tracción pesada, combinadas y logística rodoviaria.",
    supplier: "Distribuidora Nacional de Combustibles",
  },
];

export const INITIAL_AGRICULTURAL_SCENARIOS: AgriculturalScenario[] = [
  {
    id: "scen-base",
    tenantId: "TENANT_AZUCAR_01",
    campaignId: "camp-2026-2027",
    name: "Escenario 1: Plan Oficial Canónico",
    description: "Parámetros de referencia del Plan de Desarrollo Agrícola con clima medio histórico y diésel $0.95/L.",
    climateFactor: 1.0,
    dieselPriceUSD: 0.95,
    cctDistanceKm: 16.5,
    renewalTargetPercent: 16.5,
    tchVariationPercent: 0.0,
    areaVariationPercent: 0.0,
    status: "ACTIVO",
    createdAt: "2026-06-01T00:00:00.000Z",
    projectedTch: 83.62,
    projectedProductionTons: 1045250,
    projectedCostPerTonUSD: 24.8,
    projectedTrucksRequired: 16,
  },
  {
    id: "scen-drought",
    tenantId: "TENANT_AZUCAR_01",
    campaignId: "camp-2026-2027",
    name: "Escenario 2: Estrés Hídrico Severo (Sequía)",
    description: "Simulación de déficit pluviométrico (-15% biomasa), encarecimiento del diésel a $1.15/L y reducción de renovación a 14%.",
    climateFactor: 0.85,
    dieselPriceUSD: 1.15,
    cctDistanceKm: 18.0,
    renewalTargetPercent: 14.0,
    tchVariationPercent: -15.0,
    areaVariationPercent: -5.0,
    status: "ACTIVO",
    createdAt: "2026-07-15T00:00:00.000Z",
    projectedTch: 71.08,
    projectedProductionTons: 844039,
    projectedCostPerTonUSD: 28.9,
    projectedTrucksRequired: 14,
  },
  {
    id: "scen-optimal",
    tenantId: "TENANT_AZUCAR_01",
    campaignId: "camp-2026-2027",
    name: "Escenario 3: Régimen Hídrico Óptimo & Expansión",
    description: "Temporada favorable con riego suplementario (+10% TCH), incremento de plantío al 18% y diésel estable en $0.90/L.",
    climateFactor: 1.1,
    dieselPriceUSD: 0.9,
    cctDistanceKm: 15.5,
    renewalTargetPercent: 18.0,
    tchVariationPercent: 10.0,
    areaVariationPercent: 4.0,
    status: "ACTIVO",
    createdAt: "2026-08-01T00:00:00.000Z",
    projectedTch: 91.98,
    projectedProductionTons: 1195766,
    projectedCostPerTonUSD: 22.4,
    projectedTrucksRequired: 18,
  },
];

export class AgriculturalPersistenceService {
  /**
   * 1. PARAMETERS SYNCHRONIZATION
   * Subscribes to parameters in Firestore; on permission error or offline, falls back to localStorage/memory.
   */
  public static subscribeToParameters(
    tenantId: string,
    onUpdate: (params: AgriculturalParameter[]) => void
  ): () => void {
    // 1. Emit baseline/cached parameters immediately for instant UI availability
    const cached = this.getLocalCachedParameters();
    if (cached.length > 0) {
      AgriculturalParameterRegistry.loadParameters(cached);
      onUpdate(AgriculturalParameterRegistry.getAllParameters());
    } else {
      AgriculturalParameterRegistry.resetToCanonical();
      onUpdate(AgriculturalParameterRegistry.getAllParameters());
    }

    let firestoreUnsub: (() => void) | null = null;

    const setupListener = () => {
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }

      // If user is not yet authenticated, defer Firestore snapshot to prevent PERMISSION_DENIED
      if (!auth.currentUser) {
        return;
      }

      try {
        const paramsCol = collection(db, AGRO_COLLECTIONS.PARAMETERS);
        const q = query(paramsCol, where("tenantId", "==", tenantId));

        firestoreUnsub = onSnapshot(
          q,
          (snapshot) => {
            if (!snapshot.empty) {
              const remoteParams: AgriculturalParameter[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as AgriculturalParameter;
                remoteParams.push({ ...data, id: docSnap.id });
              });

              if (remoteParams.length > 0) {
                AgriculturalParameterRegistry.loadParameters(remoteParams);
                this.setLocalCachedParameters(AgriculturalParameterRegistry.getAllParameters());
                onUpdate(AgriculturalParameterRegistry.getAllParameters());
              }
            }
          },
          (error) => {
            console.info("[AgroPersistence] Firestore parameters sync deferred:", error.message);
            onUpdate(AgriculturalParameterRegistry.getAllParameters());
          }
        );
      } catch (err) {
        console.info("[AgroPersistence] Parameters subscription deferred:", err);
      }
    };

    setupListener();

    const authUnsub = onAuthStateChanged(auth, () => {
      setupListener();
    });

    return () => {
      if (firestoreUnsub) firestoreUnsub();
      authUnsub();
    };
  }

  /**
   * Save or update an agricultural parameter (persists to Firestore + Local Storage)
   */
  public static async saveParameter(param: AgriculturalParameter): Promise<void> {
    const updatedParam: AgriculturalParameter = {
      ...param,
      updatedAt: new Date().toISOString(),
    };

    // Update in-memory registry immediately (Instant UI reactivity)
    AgriculturalParameterRegistry.registerParameter(updatedParam);

    // Save to local cache
    const currentLocal = this.getLocalCachedParameters();
    const idx = currentLocal.findIndex((p) => p.key === updatedParam.key);
    if (idx >= 0) {
      currentLocal[idx] = updatedParam;
    } else {
      currentLocal.push(updatedParam);
    }
    this.setLocalCachedParameters(currentLocal);

    // Attempt Firestore persistence
    try {
      const docRef = doc(db, AGRO_COLLECTIONS.PARAMETERS, updatedParam.id || `param-${updatedParam.key.toLowerCase()}`);
      await setDoc(docRef, updatedParam, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Firestore write deferred for param:", updatedParam.key, err);
    }
  }

  /**
   * Reset parameters to Canonical Baseline
   */
  public static async resetParametersToCanonical(tenantId: string): Promise<void> {
    AgriculturalParameterRegistry.resetToCanonical();
    const canonical = AgriculturalParameterRegistry.getAllParameters();
    this.setLocalCachedParameters(canonical);

    try {
      for (const p of CANONICAL_AGRICULTURAL_PARAMETERS) {
        const docRef = doc(db, AGRO_COLLECTIONS.PARAMETERS, p.id);
        await setDoc(docRef, { ...p, tenantId }, { merge: true });
      }
    } catch (err) {
      console.warn("[AgroPersistence] Firestore reset deferred to local cache:", err);
    }
  }

  /**
   * 2. FIELD PLOTS SYNCHRONIZATION
   */
  public static subscribeToFieldPlots(
    tenantId: string,
    onUpdate: (plots: FieldPlot[]) => void
  ): () => void {
    const localPlots = this.getLocalCachedPlots();
    if (localPlots.length > 0) {
      onUpdate(localPlots);
    } else {
      onUpdate(INITIAL_FIELD_PLOTS);
    }

    let firestoreUnsub: (() => void) | null = null;

    const setupListener = () => {
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }

      // If unauthenticated, defer Firestore snapshot to prevent PERMISSION_DENIED
      if (!auth.currentUser) {
        return;
      }

      try {
        const plotsCol = collection(db, AGRO_COLLECTIONS.PLOTS);
        const q = query(plotsCol, where("tenantId", "==", tenantId));

        firestoreUnsub = onSnapshot(
          q,
          (snapshot) => {
            if (!snapshot.empty) {
              const remotePlots: FieldPlot[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as FieldPlot;
                remotePlots.push({ ...data, id: docSnap.id });
              });
              if (remotePlots.length > 0) {
                this.setLocalCachedPlots(remotePlots);
                onUpdate(remotePlots);
              }
            }
          },
          (error) => {
            console.info("[AgroPersistence] Firestore plots sync deferred:", error.message);
            onUpdate(this.getLocalCachedPlots().length > 0 ? this.getLocalCachedPlots() : INITIAL_FIELD_PLOTS);
          }
        );
      } catch (err) {
        console.info("[AgroPersistence] Plots subscription deferred:", err);
      }
    };

    setupListener();

    const authUnsub = onAuthStateChanged(auth, () => {
      setupListener();
    });

    return () => {
      if (firestoreUnsub) firestoreUnsub();
      authUnsub();
    };
  }

  /**
   * 2b. CAMPAIGNS SUBSCRIPTION
   */
  public static subscribeToCampaigns(
    tenantId: string,
    onUpdate: (campaigns: AgriculturalCampaign[]) => void
  ): () => void {
    const localList = this.getCampaignsList(tenantId);
    onUpdate(localList);

    let firestoreUnsub: (() => void) | null = null;

    const setupListener = () => {
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }

      if (!auth.currentUser) {
        return;
      }

      try {
        const campaignsCol = collection(db, AGRO_COLLECTIONS.CAMPAIGNS);
        const q = query(campaignsCol, where("tenantId", "==", tenantId));

        firestoreUnsub = onSnapshot(
          q,
          (snapshot) => {
            if (!snapshot.empty) {
              const remoteList: AgriculturalCampaign[] = [];
              snapshot.forEach((docSnap) => {
                remoteList.push(normalizeCampaign({ ...docSnap.data(), id: docSnap.id }));
              });
              if (remoteList.length > 0) {
                this.setLocalCachedCampaignsList(remoteList);
                onUpdate(remoteList);
              }
            }
          },
          (error) => {
            console.info("[AgroPersistence] Firestore campaigns sync deferred:", error.message);
            onUpdate(this.getCampaignsList(tenantId));
          }
        );
      } catch (err) {
        console.info("[AgroPersistence] Campaigns subscription deferred:", err);
      }
    };

    setupListener();

    const authUnsub = onAuthStateChanged(auth, () => {
      setupListener();
    });

    return () => {
      if (firestoreUnsub) firestoreUnsub();
      authUnsub();
    };
  }

  public static async saveFieldPlot(plot: FieldPlot): Promise<void> {
    const current = this.getLocalCachedPlots();
    const idx = current.findIndex((p) => p.id === plot.id);
    if (idx >= 0) {
      current[idx] = plot;
    } else {
      current.push(plot);
    }
    this.setLocalCachedPlots(current);

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.PLOTS, plot.id);
      await setDoc(docRef, plot, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Firestore plot save fallback:", err);
    }
  }

  public static async deleteFieldPlot(plotId: string): Promise<void> {
    const current = this.getLocalCachedPlots().filter((p) => p.id !== plotId);
    this.setLocalCachedPlots(current);

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.PLOTS, plotId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("[AgroPersistence] Firestore plot delete fallback:", err);
    }
  }

  /**
   * 3. INDUSTRIAL INTEGRATION: DISPATCH HARVEST PLOT TO SUGAR MILL (GENERATE CANEBATCH)
   * Converts a harvested cane plot into an operational CaneBatch entering factory reception / weighbridge.
   */
  public static async dispatchHarvestPlotToFactory(
    plot: FieldPlot,
    harvestTons: number,
    currentUser: string = "agronomo_campo"
  ): Promise<CaneBatch> {
    const varietyCatalog = AgriculturalParameterRegistry.getVarietyCatalog();
    const variety = varietyCatalog[plot.varietyCode];

    const pol = variety ? variety.polPercent : 14.5;
    const fiber = variety ? variety.fiberPercent : 12.8;
    const purity = variety ? variety.purityPercent : 88.0;
    const brix = Number((pol / (purity / 100)).toFixed(2));

    const timestamp = new Date().toISOString();
    const batchId = `batch-agro-${Date.now()}`;
    const batchCode = `CANABATCH-${plot.code}-${new Date().toISOString().slice(5, 10).replace("-", "")}`;

    const newCaneBatch: CaneBatch = {
      id: batchId,
      batchCode,
      truckPlate: `BIO-${Math.floor(100 + Math.random() * 900)}`,
      farmOrigin: `${plot.uebName} — ${plot.code}`,
      growerName: "Administración Central / UEB",
      caneVariety: plot.varietyCode,
      grossWeightTons: Number((harvestTons + 17.5).toFixed(2)), // Gross with truck tare
      tareWeightTons: 17.5,
      netWeightTons: Number(harvestTons.toFixed(2)),
      brixPercent: brix,
      polPercent: pol,
      purityPercent: purity,
      fiberPercent: fiber,
      trashPercent: 5.2, // ~5% foreign matter
      cutDateTime: timestamp,
      arrivalDateTime: timestamp,
      status: "EN_PATIO",
      sugarYieldEstimated: Number((harvestTons * (pol / 100) * 0.88).toFixed(2)),
      tenantId: plot.tenantId || "TENANT_AZUCAR_01",
    };

    // Save CaneBatch to Firestore in the canonical cane_batches collection
    try {
      const batchRef = doc(db, COLLECTIONS.CANE_BATCHES, batchId);
      await setDoc(batchRef, newCaneBatch);
    } catch (err) {
      console.warn("[AgroPersistence] Direct CaneBatch save fallback to local:", err);
    }

    // Update Plot status to COSECHADO
    const updatedPlot: FieldPlot = {
      ...plot,
      status: "COSECHADO",
    };
    await this.saveFieldPlot(updatedPlot);

    return newCaneBatch;
  }

  /**
   * 4. INDUSTRIAL INTEGRATION: GENERATE CMMS WORK ORDERS FOR AGRICULTURAL FLEET
   * Translates agricultural plans into real Maintenance & Field Work Orders.
   */
  public static async generateAgriculturalWorkOrders(
    campaignId: string,
    operationType: "PREPARACION_SUELO" | "SIEMBRA" | "TRATOS_CULTURALES",
    description: string,
    assignedTechnician: string,
    tenantId: string
  ): Promise<WorkOrder> {
    const woId = `wo-agro-${Date.now()}`;
    const newWorkOrder: WorkOrder = {
      id: woId,
      code: `OT-AGRO-${Date.now().toString().slice(-4)}`,
      equipmentId: operationType === "PREPARACION_SUELO" ? "TR-210-01" : "PL-02-01",
      equipmentName: operationType === "PREPARACION_SUELO" ? "TRACTOR-PESADO-210" : "PLANTADORA-MEC-02",
      title: `Operación Agrícola: ${operationType.replace("_", " ")} — ${description}`,
      description: `Orden de servicio mecanizada emitida desde el Plan de Desarrollo Agrícola (PDA). Campaña: ${campaignId}. Mantenimiento preventivo previo a jornada y registro de horómetro.`,
      priority: "MEDIA",
      status: "PENDIENTE",
      type: "PREVENTIVO",
      assignedTo: assignedTechnician,
      createdDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      estimatedHours: 4.0,
      tasks: [
        { id: "task-1", text: "Inspección de niveles de aceite y refrigerante motor", done: false },
        { id: "task-2", text: "Engrase de crucetas, cojinetes y puntos de articulación", done: false },
        { id: "task-3", text: "Revisión de presión y desgaste de neumáticos / orugas", done: false },
        { id: "task-4", text: "Verificación de implemento agrícola y calibración de discos", done: false },
      ],
      tenantId,
    };

    try {
      const woRef = doc(db, COLLECTIONS.WORK_ORDERS, woId);
      await setDoc(woRef, newWorkOrder);
    } catch (err) {
      console.warn("[AgroPersistence] WorkOrder save fallback to local:", err);
    }

    return newWorkOrder;
  }

  // Local Storage Helper Methods
  private static getLocalCachedParameters(): AgriculturalParameter[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PARAMS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  private static setLocalCachedParameters(params: AgriculturalParameter[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PARAMS, JSON.stringify(params));
    } catch {}
  }

  private static getLocalCachedPlots(): FieldPlot[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLOTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  private static setLocalCachedPlots(plots: FieldPlot[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PLOTS, JSON.stringify(plots));
    } catch {}
  }

  /**
   * 5. CAMPAIGN PERSISTENCE
   */
  public static async saveCampaign(
    campaign: AgriculturalCampaign,
    user: string = "agronomo_planificador",
    reason: string = "Actualización de campaña agrícola"
  ): Promise<void> {
    const normalized = normalizeCampaign(campaign);
    this.setLocalCachedCampaign(normalized);
    await this.saveCampaignToList(normalized, user, reason);
  }

  public static getLocalCachedCampaign(): AgriculturalCampaign | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGN);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) return normalizeCampaign(parsed);
      }
    } catch {}
    return null;
  }

  public static setLocalCachedCampaign(campaign: AgriculturalCampaign): void {
    try {
      const normalized = normalizeCampaign(campaign);
      localStorage.setItem(STORAGE_KEYS.CAMPAIGN, JSON.stringify(normalized));
    } catch {}
  }

  public static saveLocalCachedCampaign(campaign: AgriculturalCampaign): void {
    this.setLocalCachedCampaign(campaign);
  }

  /**
   * 6. VARIETIES PERSISTENCE
   */
  public static async saveVariety(variety: CaneVarietyYieldMaster, tenantId: string): Promise<void> {
    const paramKey = `VARIETY_MASTER_${variety.varietyCode.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
    const param: AgriculturalParameter = {
      id: `param-var-${variety.varietyCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      tenantId: tenantId || "DEFAULT",
      category: "VARIETY_DECAY",
      name: `Variedad ${variety.varietyCode} (${variety.name})`,
      key: paramKey,
      value: variety,
      unit: "object",
      source: "Catálogo Dinámico Agronómico",
      provenanceDoc: "Catálogo Varietal BioAzúcar",
      version: "1.0.0",
      effectiveFrom: new Date().toISOString(),
      status: "CONFIRMADO",
      validationStatus: "CONFIRMADO",
      description: `Variedad de caña ${variety.varietyCode} con TCH base ${variety.baseYieldTch} y Pol ${variety.polPercent}%.`,
      updatedAt: new Date().toISOString(),
    };

    await this.saveParameter(param);

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.VARIETIES, variety.varietyCode);
      await setDoc(docRef, { ...variety, tenantId }, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Variety save fallback:", err);
    }
  }

  public static async deleteVariety(varietyCode: string, tenantId: string): Promise<void> {
    const paramKey = `VARIETY_MASTER_${varietyCode.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
    const all = this.getLocalCachedParameters().filter((p) => p.key !== paramKey);
    this.setLocalCachedParameters(all);
    AgriculturalParameterRegistry.loadParameters(all);

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.VARIETIES, varietyCode);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("[AgroPersistence] Variety delete fallback:", err);
    }
  }

  /**
   * 7. CAMPAIGNS FULL CRUD & MULTI-CAMPAIGN MANAGEMENT
   */
  public static getCampaigns(tenantId: string = "TENANT_AZUCAR_01"): AgriculturalCampaign[] {
    return this.getCampaignsList(tenantId);
  }

  public static getCampaignsList(tenantId: string = "TENANT_AZUCAR_01"): AgriculturalCampaign[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS_LIST);
      if (raw) {
        const parsed = JSON.parse(raw) as AgriculturalCampaign[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeCampaign);
        }
      }
    } catch {}
    this.setLocalCachedCampaignsList(INITIAL_AGRICULTURAL_CAMPAIGNS_LIST);
    return INITIAL_AGRICULTURAL_CAMPAIGNS_LIST.map(normalizeCampaign);
  }

  public static setLocalCachedCampaignsList(list: AgriculturalCampaign[]): void {
    try {
      const normalized = list.map(normalizeCampaign);
      localStorage.setItem(STORAGE_KEYS.CAMPAIGNS_LIST, JSON.stringify(normalized));
    } catch {}
  }

  public static async saveCampaignToList(
    campaign: AgriculturalCampaign,
    user: string = "agronomo_planificador",
    reason: string = "Actualización de campaña agrícola"
  ): Promise<void> {
    const normalized = normalizeCampaign(campaign);
    const list = this.getCampaignsList(normalized.tenantId);
    const idx = list.findIndex((c) => c.id === normalized.id);
    const prev = idx >= 0 ? list[idx] : null;

    const updatedCampaign: AgriculturalCampaign = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      list[idx] = updatedCampaign;
    } else {
      list.push(updatedCampaign);
    }
    this.setLocalCachedCampaignsList(list);

    // If marked ACTIVE, update current active campaign cache
    if (updatedCampaign.status === "ACTIVE") {
      this.setLocalCachedCampaign(updatedCampaign);
    }

    // Record audit log
    await this.recordAuditChange({
      tenantId: normalized.tenantId,
      campaignId: normalized.id,
      entityType: "CAMPAIGN",
      entityId: normalized.id,
      entityName: normalized.name,
      fieldChanged: prev ? "ACTUALIZACION_CAMPANA" : "CREACION_CAMPANA",
      previousValue: prev ? { status: prev.status, totalArea: prev.totalAreaHectares, sugarTarget: prev.sugarTargetTons } : null,
      newValue: { status: updatedCampaign.status, totalArea: updatedCampaign.totalAreaHectares, sugarTarget: updatedCampaign.sugarTargetTons },
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.CAMPAIGNS, normalized.id);
      await setDoc(docRef, updatedCampaign, { merge: true });
    } catch (err) {
      console.info("[AgroPersistence] Campaign Firestore sync deferred:", err);
    }
  }

  public static async archiveCampaign(
    campaignId: string,
    tenantId: string,
    user: string = "agronomo_planificador",
    reason: string = "Cierre de zafra y archivado histórico"
  ): Promise<void> {
    const list = this.getCampaignsList(tenantId);
    const target = list.find((c) => c.id === campaignId);
    if (!target) return;

    target.status = "ARCHIVED";
    target.updatedAt = new Date().toISOString();
    this.setLocalCachedCampaignsList(list);

    await this.recordAuditChange({
      tenantId,
      campaignId,
      entityType: "CAMPAIGN",
      entityId: campaignId,
      entityName: target.name,
      fieldChanged: "STATUS_ARCHIVED",
      previousValue: "ACTIVE",
      newValue: "ARCHIVED",
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.CAMPAIGNS, campaignId);
      await setDoc(docRef, target, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Campaign archive fallback:", err);
    }
  }

  public static async deleteCampaignSafely(
    campaignId: string,
    tenantId: string,
    user: string = "agronomo_planificador",
    reason: string = "Eliminación segura o archivado de campaña"
  ): Promise<{ archived: boolean; message: string }> {
    const list = this.getCampaignsList(tenantId);
    const target = list.find((c) => c.id === campaignId);
    if (!target) return { archived: false, message: "Campaña no encontrada" };

    // Critical protection: active campaign or campaigns with data must be archived, not erased
    if (target.status === "ACTIVE" || target.id === "camp-2026-2027") {
      target.status = "ARCHIVED";
      this.setLocalCachedCampaignsList(list);
      await this.recordAuditChange({
        tenantId,
        campaignId,
        entityType: "CAMPAIGN",
        entityId: campaignId,
        entityName: target.name,
        fieldChanged: "ARCHIVED_PROTECTED",
        previousValue: "ACTIVE",
        newValue: "ARCHIVED",
        user,
        reason: `Protección de datos históricos: ${reason}`,
        version: "1.0",
      });
      return { archived: true, message: "La campaña contenía registros activos; fue archivada de forma segura para preservar la trazabilidad." };
    }

    const filtered = list.filter((c) => c.id !== campaignId);
    this.setLocalCachedCampaignsList(filtered);

    await this.recordAuditChange({
      tenantId,
      campaignId,
      entityType: "CAMPAIGN",
      entityId: campaignId,
      entityName: target.name,
      fieldChanged: "ELIMINACION_DEFINITIVA",
      previousValue: target,
      newValue: null,
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.CAMPAIGNS, campaignId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("[AgroPersistence] Campaign delete fallback:", err);
    }

    return { archived: false, message: "Campaña eliminada correctamente." };
  }

  /**
   * 8. OPERATIONS CATALOG CRUD
   */
  public static getOperations(tenantId: string = "TENANT_AZUCAR_01"): AgroOperationMaster[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OPERATIONS);
      if (raw) {
        const parsed = JSON.parse(raw) as AgroOperationMaster[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    this.setLocalCachedOperations(STANDARD_AGRO_OPERATIONS);
    return STANDARD_AGRO_OPERATIONS;
  }

  public static setLocalCachedOperations(ops: AgroOperationMaster[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.OPERATIONS, JSON.stringify(ops));
    } catch {}
  }

  public static async saveOperation(
    operation: AgroOperationMaster,
    user: string = "agronomo_maquinaria",
    reason: string = "Configuración de labor mecanizada"
  ): Promise<void> {
    const list = this.getOperations(operation.tenantId);
    const idx = list.findIndex((o) => o.id === operation.id);
    const prev = idx >= 0 ? list[idx] : null;

    const opToSave: AgroOperationMaster = {
      ...operation,
      status: operation.status || "ACTIVO",
    };

    if (idx >= 0) {
      list[idx] = opToSave;
    } else {
      list.push(opToSave);
    }
    this.setLocalCachedOperations(list);

    await this.recordAuditChange({
      tenantId: operation.tenantId || "TENANT_AZUCAR_01",
      entityType: "OPERATION",
      entityId: operation.id,
      entityName: operation.name,
      fieldChanged: prev ? "ACTUALIZACION_OPERACION" : "ALTA_OPERACION",
      previousValue: prev ? { cap: prev.effectiveCapacityHaPerHour, fuel: prev.fuelConsumptionLitersPerHour } : null,
      newValue: { cap: opToSave.effectiveCapacityHaPerHour, fuel: opToSave.fuelConsumptionLitersPerHour },
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.OPERATIONS, operation.id);
      await setDoc(docRef, opToSave, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Operation save fallback:", err);
    }
  }

  public static async deleteOperationSafely(
    operationId: string,
    tenantId: string = "TENANT_AZUCAR_01",
    user: string = "agronomo_maquinaria",
    reason: string = "Desactivación de operación"
  ): Promise<void> {
    const list = this.getOperations(tenantId);
    const target = list.find((o) => o.id === operationId);
    if (!target) return;

    // Soft delete / archive to maintain formula and planning lineage
    target.status = "ARCHIVADO";
    this.setLocalCachedOperations(list);

    await this.recordAuditChange({
      tenantId,
      entityType: "OPERATION",
      entityId: operationId,
      entityName: target.name,
      fieldChanged: "ARCHIVADO_OPERACION",
      previousValue: "ACTIVO",
      newValue: "ARCHIVADO",
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.OPERATIONS, operationId);
      await setDoc(docRef, target, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Operation archive fallback:", err);
    }
  }

  public static async deleteOperation(
    operationId: string,
    tenantId: string = "TENANT_AZUCAR_01"
  ): Promise<void> {
    return this.deleteOperationSafely(operationId, tenantId);
  }

  /**
   * 9. MACHINERY & EQUIPMENT ASSETS CRUD
   */
  public static getEquipmentAssets(tenantId: string = "TENANT_AZUCAR_01"): AgriculturalEquipmentAsset[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
      if (raw) {
        const parsed = JSON.parse(raw) as AgriculturalEquipmentAsset[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    this.setLocalCachedEquipment(INITIAL_EQUIPMENT_ASSETS);
    return INITIAL_EQUIPMENT_ASSETS;
  }

  public static setLocalCachedEquipment(assets: AgriculturalEquipmentAsset[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(assets));
    } catch {}
  }

  public static async saveEquipmentAsset(
    asset: AgriculturalEquipmentAsset,
    user: string = "jefe_taller_mecanizado",
    reason: string = "Actualización de ficha técnica de maquinaria"
  ): Promise<void> {
    const list = this.getEquipmentAssets(asset.tenantId);
    const idx = list.findIndex((e) => e.id === asset.id);
    const prev = idx >= 0 ? list[idx] : null;

    if (idx >= 0) {
      list[idx] = asset;
    } else {
      list.push(asset);
    }
    this.setLocalCachedEquipment(list);

    await this.recordAuditChange({
      tenantId: asset.tenantId,
      entityType: "EQUIPMENT",
      entityId: asset.id,
      entityName: `${asset.code} - ${asset.name}`,
      fieldChanged: prev ? "ACTUALIZACION_ACTIVO" : "ALTA_ACTIVO",
      previousValue: prev ? { status: prev.status, avail: prev.mechanicalAvailabilityPercent, hours: prev.accumulatedEngineHours } : null,
      newValue: { status: asset.status, avail: asset.mechanicalAvailabilityPercent, hours: asset.accumulatedEngineHours },
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.EQUIPMENT, asset.id);
      await setDoc(docRef, asset, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Equipment save fallback:", err);
    }
  }

  public static async deleteEquipmentAssetSafely(
    assetId: string,
    tenantId: string = "TENANT_AZUCAR_01",
    user: string = "jefe_taller_mecanizado",
    reason: string = "Desincorporación / Baja de activo mecánico"
  ): Promise<void> {
    const list = this.getEquipmentAssets(tenantId);
    const target = list.find((e) => e.id === assetId);
    if (!target) return;

    target.status = "ARCHIVED";
    this.setLocalCachedEquipment(list);

    await this.recordAuditChange({
      tenantId,
      entityType: "EQUIPMENT",
      entityId: assetId,
      entityName: `${target.code} - ${target.name}`,
      fieldChanged: "ESTADO_DECOMISION",
      previousValue: "OPERATIONAL",
      newValue: "ARCHIVED",
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.EQUIPMENT, assetId);
      await setDoc(docRef, target, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Equipment delete fallback:", err);
    }
  }

  public static async deleteEquipmentAsset(
    assetId: string,
    tenantId: string = "TENANT_AZUCAR_01"
  ): Promise<void> {
    return this.deleteEquipmentAssetSafely(assetId, tenantId);
  }

  /**
   * 10. INPUTS & DOSAGES CRUD
   */
  public static getInputs(tenantId: string = "TENANT_AZUCAR_01"): AgriculturalInputMaster[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INPUTS);
      if (raw) {
        const parsed = JSON.parse(raw) as AgriculturalInputMaster[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    this.setLocalCachedInputs(INITIAL_AGRICULTURAL_INPUTS);
    return INITIAL_AGRICULTURAL_INPUTS;
  }

  public static setLocalCachedInputs(inputs: AgriculturalInputMaster[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INPUTS, JSON.stringify(inputs));
    } catch {}
  }

  public static async saveInput(
    input: AgriculturalInputMaster,
    user: string = "encargado_insumos",
    reason: string = "Calibración de dosis agronómica"
  ): Promise<void> {
    const list = this.getInputs(input.tenantId);
    const idx = list.findIndex((i) => i.id === input.id);
    const prev = idx >= 0 ? list[idx] : null;

    const inputToSave: AgriculturalInputMaster = {
      ...input,
      status: input.status || "ACTIVO",
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      list[idx] = inputToSave;
    } else {
      list.push(inputToSave);
    }
    this.setLocalCachedInputs(list);

    await this.recordAuditChange({
      tenantId: input.tenantId,
      entityType: "INPUT",
      entityId: input.id,
      entityName: `${input.code} - ${input.name}`,
      fieldChanged: prev ? "ACTUALIZACION_INSUMO" : "ALTA_INSUMO",
      previousValue: prev ? { dose: prev.standardDosePerHa, price: prev.unitCostUSD } : null,
      newValue: { dose: inputToSave.standardDosePerHa, price: inputToSave.unitCostUSD },
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.INPUTS, input.id);
      await setDoc(docRef, inputToSave, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Input save fallback:", err);
    }
  }

  public static async deleteInputSafely(
    inputId: string,
    tenantId: string = "TENANT_AZUCAR_01",
    user: string = "encargado_insumos",
    reason: string = "Inactivación de formulación de insumo"
  ): Promise<void> {
    const list = this.getInputs(tenantId);
    const target = list.find((i) => i.id === inputId);
    if (!target) return;

    target.status = "ARCHIVADO";
    this.setLocalCachedInputs(list);

    await this.recordAuditChange({
      tenantId,
      entityType: "INPUT",
      entityId: inputId,
      entityName: target.name,
      fieldChanged: "INACTIVACION_INSUMO",
      previousValue: "ACTIVO",
      newValue: "ARCHIVADO",
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.INPUTS, inputId);
      await setDoc(docRef, target, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Input delete fallback:", err);
    }
  }

  public static async deleteInput(
    inputId: string,
    tenantId: string = "TENANT_AZUCAR_01"
  ): Promise<void> {
    return this.deleteInputSafely(inputId, tenantId);
  }

  /**
   * 11. AGRICULTURAL SCENARIOS CRUD (WHAT-IF SENSITIVITY)
   */
  public static getScenarios(tenantId: string = "TENANT_AZUCAR_01", campaignId?: string): AgriculturalScenario[] {
    let list = INITIAL_AGRICULTURAL_SCENARIOS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SCENARIOS);
      if (raw) {
        const parsed = JSON.parse(raw) as AgriculturalScenario[];
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch {}
    if (campaignId) {
      const forCampaign = list.filter((s) => !s.campaignId || s.campaignId === campaignId);
      return forCampaign.length > 0 ? forCampaign : list;
    }
    return list;
  }

  public static setLocalCachedScenarios(scenarios: AgriculturalScenario[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SCENARIOS, JSON.stringify(scenarios));
    } catch {}
  }

  public static async saveScenario(
    scenario: AgriculturalScenario,
    user: string = "analista_agronomo",
    reason: string = "Ajuste de variables de simulación What-If"
  ): Promise<void> {
    const list = this.getScenarios(scenario.tenantId);
    const idx = list.findIndex((s) => s.id === scenario.id);
    const prev = idx >= 0 ? list[idx] : null;

    const scenToSave: AgriculturalScenario = {
      ...scenario,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      list[idx] = scenToSave;
    } else {
      list.push(scenToSave);
    }
    this.setLocalCachedScenarios(list);

    await this.recordAuditChange({
      tenantId: scenario.tenantId,
      campaignId: scenario.campaignId,
      entityType: "SCENARIO",
      entityId: scenario.id,
      entityName: scenario.name,
      fieldChanged: prev ? "MODIFICACION_ESCENARIO" : "NUEVO_ESCENARIO",
      previousValue: prev ? { climate: prev.climateFactor, diesel: prev.dieselPriceUSD, tch: prev.projectedTch } : null,
      newValue: { climate: scenToSave.climateFactor, diesel: scenToSave.dieselPriceUSD, tch: scenToSave.projectedTch },
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.SCENARIOS, scenario.id);
      await setDoc(docRef, scenToSave, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Scenario save fallback:", err);
    }
  }

  public static async deleteScenario(
    scenarioId: string,
    tenantId: string = "TENANT_AZUCAR_01",
    user: string = "analista_agronomo",
    reason: string = "Eliminación de escenario de simulación"
  ): Promise<void> {
    const list = this.getScenarios(tenantId);
    const target = list.find((s) => s.id === scenarioId);
    if (!target) return;

    const filtered = list.filter((s) => s.id !== scenarioId);
    this.setLocalCachedScenarios(filtered);

    await this.recordAuditChange({
      tenantId,
      campaignId: target.campaignId,
      entityType: "SCENARIO",
      entityId: scenarioId,
      entityName: target.name,
      fieldChanged: "ELIMINACION_ESCENARIO",
      previousValue: target,
      newValue: null,
      user,
      reason,
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.SCENARIOS, scenarioId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("[AgroPersistence] Scenario delete fallback:", err);
    }
  }

  public static async setScenarioAsBaseline(
    scenarioId: string,
    tenantId: string = "TENANT_AZUCAR_01",
    campaignId?: string
  ): Promise<void> {
    const list = this.getScenarios(tenantId);
    const target = list.find((s) => s.id === scenarioId);
    if (!target) return;

    const updated = list.map((s) => {
      if (campaignId && s.campaignId && s.campaignId !== campaignId) return s;
      return {
        ...s,
        isBaseline: s.id === scenarioId,
      };
    });

    this.setLocalCachedScenarios(updated);

    await this.recordAuditChange({
      tenantId,
      campaignId: campaignId || target.campaignId,
      entityType: "SCENARIO",
      entityId: scenarioId,
      entityName: target.name,
      fieldChanged: "LINEA_BASE_OFICIAL",
      previousValue: false,
      newValue: true,
      user: "Ing. Agrónomo / Planificador",
      reason: "Establecido como Escenario Línea Base Oficial de Zafra",
      version: "1.0",
    });

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.SCENARIOS, scenarioId);
      await setDoc(docRef, { ...target, isBaseline: true }, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Scenario baseline fallback:", err);
    }
  }

  /**
   * 12. AUDIT TRAIL LOGGING (ISA-95 Level 4 Enterprise Traceability)
   */
  public static getLocalCachedAuditTrail(): AgriculturalAuditChangeRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public static setLocalCachedAuditTrail(list: AgriculturalAuditChangeRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(list));
    } catch {}
  }

  public static async recordAuditChange(
    change: Omit<AgriculturalAuditChangeRecord, "id" | "timestamp">
  ): Promise<AgriculturalAuditChangeRecord> {
    const record: AgriculturalAuditChangeRecord = {
      ...change,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    const currentList = this.getLocalCachedAuditTrail();
    currentList.unshift(record);
    if (currentList.length > 500) {
      currentList.pop();
    }
    this.setLocalCachedAuditTrail(currentList);

    try {
      const docRef = doc(db, AGRO_COLLECTIONS.AUDIT, record.id);
      await setDoc(docRef, record);
    } catch (err) {
      console.warn("[AgroPersistence] Audit record save fallback:", err);
    }

    return record;
  }

  public static getAuditHistory(tenantId: string = "TENANT_AZUCAR_01"): AgriculturalAuditChangeRecord[] {
    const list = this.getLocalCachedAuditTrail();
    if (list.length === 0) {
      // Create initial seed audit trail entries demonstrating traceability
      const initialAudit: AgriculturalAuditChangeRecord[] = [
        {
          id: "audit-init-01",
          tenantId,
          campaignId: "camp-2026-2027",
          entityType: "CAMPAIGN",
          entityId: "camp-2026-2027",
          entityName: "Zafra Oficial 2026/2027",
          fieldChanged: "CREACION_CANONICA",
          previousValue: null,
          newValue: { status: "ACTIVE", totalAreaHa: 12500, sugarTargetTons: 118000 },
          user: "direccion_agricola",
          timestamp: "2026-06-01T08:00:00.000Z",
          reason: "Apertura oficial del Plan de Desarrollo Agrícola (PDA) 2026/2027",
          version: "1.0",
        },
        {
          id: "audit-init-02",
          tenantId,
          campaignId: "camp-2026-2027",
          entityType: "PARAMETER",
          entityId: "param-diesel",
          entityName: "Precio Referencial Diésel B-10",
          fieldChanged: "DIESEL_PRICE_USD",
          previousValue: 0.88,
          newValue: 0.95,
          user: "control_gestion",
          timestamp: "2026-08-10T14:30:00.000Z",
          reason: "Ajuste por cotización de importación de combustibles en refinería",
          version: "1.1",
        },
        {
          id: "audit-init-03",
          tenantId,
          campaignId: "camp-2026-2027",
          entityType: "FORMULA",
          entityId: "TCH_PROYECTADO_V1",
          entityName: "Fórmula TCH Proyectado Multivariante",
          fieldChanged: "CALIBRACION_BIOAZUCAR",
          previousValue: "Modelo Canónico ODS 2014",
          newValue: "Modelo BioAzúcar 4.0 con calibración NDVI espectral",
          user: "ing_agronomo_bi",
          timestamp: "2026-09-02T10:15:00.000Z",
          reason: "Incorporación de factor de vigor vegetativo satelital Sentinel-2",
          version: "2.1",
        },
      ];
      this.setLocalCachedAuditTrail(initialAudit);
      return initialAudit;
    }
    return list;
  }

  /**
   * 13. FIELD INTELLIGENCE 4.0: AUTOMATED AGRONOMIC ALERTS ENGINE
   */
  public static generateAgronomicAlerts(params: {
    plots: FieldPlot[];
    campaign: AgriculturalCampaign;
    fleetDeficit?: number;
    totalDieselConsumed?: number;
  }): AgronomicAlert[] {
    const alerts: AgronomicAlert[] = [];
    const { plots, campaign, fleetDeficit = 0 } = params;

    // Rule 1: High Renewal Age / Low TCH (Demolition check)
    const lowYieldPlots = plots.filter((p) => (p.projectedTch || 0) < 55 && p.currentStage !== "DEMOLICION");
    if (lowYieldPlots.length > 0) {
      alerts.push({
        id: `alert-yield-${Date.now()}`,
        type: "WARNING",
        category: "RENDIMIENTO",
        title: `${lowYieldPlots.length} parcelas con TCH crítico (<55 t/ha)`,
        description: `Se detectaron parcelas con rendimientos por debajo del umbral de viabilidad económica (ej. ${lowYieldPlots.map((p) => p.code).slice(0, 3).join(", ")}).`,
        metricValue: `${lowYieldPlots.length} parcelas`,
        threshold: "< 55.0 t/ha",
        recommendation: "Programar rotación y renovación anticipada hacia caña planta en el plan de siembra.",
        timestamp: new Date().toISOString(),
      });
    }

    // Rule 2: Machinery Fleet Deficit
    if (fleetDeficit > 0) {
      alerts.push({
        id: `alert-fleet-${Date.now()}`,
        type: "CRITICAL",
        category: "MAQUINARIA",
        title: `Déficit crítico de parque de tracción (${fleetDeficit} unidades)`,
        description: "El requerimiento de horas de labor en el calendario supera la capacidad disponible de la flota actual.",
        metricValue: `${fleetDeficit} máquinas faltantes`,
        threshold: "0 déficit",
        recommendation: "Activar plan de inversión CAPEX de maquinaria o contratar tercerización para no comprometer el calendario de preparación.",
        timestamp: new Date().toISOString(),
      });
    }

    // Rule 3: Cane Variety Monoculture Risk (>45% of total area in one variety)
    const totalArea = plots.reduce((acc, p) => acc + p.areaHectares, 0);
    if (totalArea > 0) {
      const varietyDistribution = plots.reduce((acc, p) => {
        acc[p.varietyCode] = (acc[p.varietyCode] || 0) + p.areaHectares;
        return acc;
      }, {} as Record<string, number>);

      for (const [vCode, vArea] of Object.entries(varietyDistribution)) {
        const share = (vArea / totalArea) * 100;
        if (share > 45.0) {
          alerts.push({
            id: `alert-var-${vCode}-${Date.now()}`,
            type: "WARNING",
            category: "GOBERNANZA",
            title: `Concentración varietal excesiva: ${vCode} (${share.toFixed(1)}%)`,
            description: `El cultivar ${vCode} ocupa más del 45% del área arable total, elevando la vulnerabilidad fitopatológica a royas o carbón.`,
            metricValue: `${share.toFixed(1)}% área`,
            threshold: "Máximo 40%",
            recommendation: "Diversificar el plan de renovación introduciendo cultivares contrastantes (ej. CTC-4 o SP80-3280).",
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }
    }

    // Rule 4: High Transport Distance / Logistics Bottleneck (>20 km)
    const distantPlots = plots.filter((p) => p.distanceToMillKm > 20.0);
    if (distantPlots.length > 0) {
      alerts.push({
        id: `alert-logistics-${Date.now()}`,
        type: "INFO",
        category: "LOGISTICA",
        title: `${distantPlots.length} parcelas en radio logístico extendido (>20 km)`,
        description: `Las parcelas lejanas incrementan el ciclo CCT rodoviario a más de 3.2 horas por viaje.`,
        metricValue: `${distantPlots.length} parcelas`,
        threshold: "> 20 km",
        recommendation: "Concentrar camiones bi-trenes de alta carga (45t) y optimizar turnos de carga continua para minimizar colas en báscula.",
        timestamp: new Date().toISOString(),
      });
    }

    // Rule 5: Positive Progress / Optimal Operations
    alerts.push({
      id: `alert-opt-${Date.now()}`,
      type: "SUCCESS",
      category: "SUELO",
      title: "Uso de Subproductos Circulares (Vinaza & Cachaza) Activo",
      description: "El plan de fertilización incorpora 100% de la vinaza y torta de filtro generadas por el ingenio, reduciendo la compra de fertilizante químico.",
      recommendation: "Mantener monitoreo de conductividad eléctrica y pH en suelos receptores.",
      timestamp: new Date().toISOString(),
    });

    return alerts;
  }

  /**
   * 14. OPERATIONAL EXECUTION METRICS (PLAN VS REAL EXECUTION)
   */
  public static getPlanExecutionMetrics(params: {
    plots: FieldPlot[];
    campaign: AgriculturalCampaign;
    totalDieselConsumed: number;
    totalOpexUSD: number;
  }): AgroPlanExecutionMetric[] {
    const totalAreaPlanned = params.campaign.totalAreaHectares || 12500;
    const totalAreaCatalogued = params.plots.reduce((acc, p) => acc + p.areaHectares, 0);

    const harvestedPlots = params.plots.filter((p) => p.status === "COSECHADO");
    const harvestedArea = harvestedPlots.reduce((acc, p) => acc + p.areaHectares, 0);
    const plannedHarvestArea = totalAreaPlanned * (1 - (params.campaign.renewalTargetPercent || 16.5) / 100);

    const prepArea = params.plots.filter((p) => p.status === "EN_PREPARACION").reduce((acc, p) => acc + p.areaHectares, 0);
    const plannedPrepArea = totalAreaPlanned * ((params.campaign.renewalTargetPercent || 16.5) / 100);

    return [
      {
        category: "AREAS",
        concept: "Área Arable Catastrada",
        plannedValue: totalAreaPlanned,
        executedValue: totalAreaCatalogued,
        unit: "ha",
        deviationPercent: Number((((totalAreaCatalogued - totalAreaPlanned) / totalAreaPlanned) * 100).toFixed(1)),
        status: totalAreaCatalogued >= totalAreaPlanned * 0.95 ? "OPTIMO" : "ATENCION",
      },
      {
        category: "PREPARACION",
        concept: "Preparación de Suelos & Renovación",
        plannedValue: plannedPrepArea,
        executedValue: prepArea,
        unit: "ha",
        deviationPercent: Number((((prepArea - plannedPrepArea) / plannedPrepArea) * 100).toFixed(1)),
        status: Math.abs(prepArea - plannedPrepArea) < 150 ? "OPTIMO" : "ATENCION",
      },
      {
        category: "COSECHA",
        concept: "Superficie Cosechada",
        plannedValue: plannedHarvestArea,
        executedValue: harvestedArea,
        unit: "ha",
        deviationPercent: Number((((harvestedArea - plannedHarvestArea) / plannedHarvestArea) * 100).toFixed(1)),
        status: harvestedArea >= plannedHarvestArea * 0.7 ? "OPTIMO" : "ATENCION",
      },
      {
        category: "COMBUSTIBLE",
        concept: "Consumo de Diésel Agrícola Consolidado",
        plannedValue: 4600000,
        executedValue: params.totalDieselConsumed,
        unit: "Litros",
        deviationPercent: Number((((params.totalDieselConsumed - 4600000) / 4600000) * 100).toFixed(1)),
        status: params.totalDieselConsumed <= 4800000 ? "OPTIMO" : "CRITICO",
      },
      {
        category: "COSTES",
        concept: "Presupuesto Operativo Agrícola (OPEX)",
        plannedValue: 26000000,
        executedValue: params.totalOpexUSD,
        unit: "USD",
        deviationPercent: Number((((params.totalOpexUSD - 26000000) / 26000000) * 100).toFixed(1)),
        status: params.totalOpexUSD <= 27500000 ? "OPTIMO" : "ATENCION",
      },
    ];
  }
}

