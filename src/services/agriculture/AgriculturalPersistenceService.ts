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
import { db } from "../firebase";
import { COLLECTIONS } from "../dbService";
import {
  AgriculturalParameter,
  FieldPlot,
  AgriculturalCampaign,
  CaneVarietyYieldMaster,
  AgroOperationMaster,
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

export const AGRO_COLLECTIONS = {
  PARAMETERS: "agricultural_parameters",
  CAMPAIGNS: "agricultural_campaigns",
  PLOTS: "agricultural_plots",
  VARIETIES: "agricultural_varieties",
  OPERATIONS: "agricultural_operations",
} as const;

// Local storage cache keys
const STORAGE_KEYS = {
  PARAMS: "bioazucar_agricultural_parameters",
  PLOTS: "bioazucar_agricultural_plots",
  CAMPAIGN: "bioazucar_agricultural_campaign",
  OPERATIONS: "bioazucar_agricultural_operations",
  VARIETIES: "bioazucar_agricultural_varieties",
};

export class AgriculturalPersistenceService {
  /**
   * 1. PARAMETERS SYNCHRONIZATION
   * Subscribes to parameters in Firestore; on permission error or offline, falls back to localStorage/memory.
   */
  public static subscribeToParameters(
    tenantId: string,
    onUpdate: (params: AgriculturalParameter[]) => void
  ): () => void {
    // Load local cached first for zero-latency initial render
    const cached = this.getLocalCachedParameters();
    if (cached.length > 0) {
      AgriculturalParameterRegistry.loadParameters(cached);
      onUpdate(AgriculturalParameterRegistry.getAllParameters());
    } else {
      AgriculturalParameterRegistry.resetToCanonical();
      onUpdate(AgriculturalParameterRegistry.getAllParameters());
    }

    try {
      const paramsCol = collection(db, AGRO_COLLECTIONS.PARAMETERS);
      const q = query(paramsCol);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteParams: AgriculturalParameter[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as AgriculturalParameter;
              if (data.tenantId === tenantId || data.tenantId === "DEFAULT" || data.tenantId === "GLOBAL") {
                remoteParams.push({ ...data, id: docSnap.id });
              }
            });

            if (remoteParams.length > 0) {
              AgriculturalParameterRegistry.loadParameters(remoteParams);
              this.setLocalCachedParameters(AgriculturalParameterRegistry.getAllParameters());
              onUpdate(AgriculturalParameterRegistry.getAllParameters());
            }
          }
        },
        (error) => {
          // Fallback gracefully without crashing
          console.warn("[AgroPersistence] Firestore parameters snapshot deferred to local cache:", error.message);
          onUpdate(AgriculturalParameterRegistry.getAllParameters());
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn("[AgroPersistence] Firestore setup error for parameters:", err);
      return () => {};
    }
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

    try {
      const plotsCol = collection(db, AGRO_COLLECTIONS.PLOTS);
      const q = query(plotsCol);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const remotePlots: FieldPlot[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as FieldPlot;
              if (!data.tenantId || data.tenantId === tenantId || data.tenantId === "TENANT_AZUCAR_01") {
                remotePlots.push({ ...data, id: docSnap.id });
              }
            });
            if (remotePlots.length > 0) {
              this.setLocalCachedPlots(remotePlots);
              onUpdate(remotePlots);
            }
          }
        },
        (error) => {
          console.warn("[AgroPersistence] Firestore plots snapshot fallback:", error.message);
          onUpdate(this.getLocalCachedPlots().length > 0 ? this.getLocalCachedPlots() : INITIAL_FIELD_PLOTS);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn("[AgroPersistence] Firestore plots error:", err);
      return () => {};
    }
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
  public static async saveCampaign(campaign: AgriculturalCampaign): Promise<void> {
    this.setLocalCachedCampaign(campaign);
    try {
      const docRef = doc(db, AGRO_COLLECTIONS.CAMPAIGNS, campaign.id || "campaign-active");
      await setDoc(docRef, campaign, { merge: true });
    } catch (err) {
      console.warn("[AgroPersistence] Campaign save fallback to local cache:", err);
    }
  }

  public static getLocalCachedCampaign(): AgriculturalCampaign | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGN);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  public static setLocalCachedCampaign(campaign: AgriculturalCampaign): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CAMPAIGN, JSON.stringify(campaign));
    } catch {}
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
      sourceSheet: "VARIEDADES",
      version: "1.0.0",
      effectiveFrom: new Date().toISOString(),
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
}
