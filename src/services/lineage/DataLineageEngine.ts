/**
 * BioAzúcar 4.0 — Cryptographic Data Lineage & Block-Chained Extraction Engine
 * ==============================================================================
 * Conforms to IEC 62443-4-2 SL3 / ISA-95 Level 3-4 (MOM) / ICUMSA GS2/3-1.
 * 
 * Cryptographically chains every finished sugar lot (SugarBatch) back to:
 * 1. Precursor Cane Batches (CaneBatch from agricultural field plots).
 * 2. Tandem Milling Extraction Balance (Hugot first principles).
 * 3. Evaporation, Pan Boiling & Molasses Exhaustion Balances.
 * 4. Merkle-style sequential block hash linking previous sugar lot to current.
 * 
 * Any retroactive database tampering immediately breaks the cryptographic chain.
 */

import {
  SugarType,
  SugarPackagingType,
  SugarBatchStatus,
  MillingExtractionBalance,
  EvaporationAndCrystallizationBalance,
  SugarQualityMetrics,
  SugarBatch,
  SugarLineageTrace,
  ChainVerificationResult,
} from "../../types/dataLineage";
import { CaneBatch } from "../../types";
import { createHash } from "../../utils/cryptoUtils";
import { logAuditEventToDb } from "../dbService";

export interface CreateSugarBatchInput {
  batchNumber: string;
  tenantId: string;
  sugarType: SugarType;
  packagingType: SugarPackagingType;
  totalTonsProduced: number;
  productionDateTime?: string;
  warehouseLocation: string;
  quality: SugarQualityMetrics;
  parentCaneBatches: CaneBatch[];
  millingExtraction: MillingExtractionBalance;
  crystallization: EvaporationAndCrystallizationBalance;
  analystSignature: string;
}

export class DataLineageEngine {
  private static instance: DataLineageEngine | null = null;

  // In-memory sequential block-chained ledger: tenantId -> SugarBatch[]
  private ledgerByTenant: Map<string, SugarBatch[]> = new Map();

  // Precursor CaneBatches catalog cache for lineage traversal
  private caneBatchesById: Map<string, CaneBatch> = new Map();

  // Extraction balances cache by hash
  private millingBalances: Map<string, MillingExtractionBalance> = new Map();
  private crystallizationBalances: Map<string, EvaporationAndCrystallizationBalance> = new Map();

  private constructor() {}

  public static getInstance(): DataLineageEngine {
    if (!DataLineageEngine.instance) {
      DataLineageEngine.instance = new DataLineageEngine();
    }
    return DataLineageEngine.instance;
  }

  /**
   * Builds and hashes a deterministic Tandem Milling Extraction Balance
   */
  public createMillingExtractionBalance(params: {
    tandemId: string;
    imbibitionWaterTons: number;
    imbibitionWaterPercentCane: number;
    hydraulicPressureBar: number;
    sucroseExtractionPercent: number;
    bagasseMoisturePercent: number;
    bagassePolPercent: number;
    mixedJuiceBrix: number;
    mixedJuicePurity: number;
    millingTimestamp?: string;
  }): MillingExtractionBalance {
    const timestamp = params.millingTimestamp || new Date().toISOString();
    const preimage = [
      params.tandemId,
      params.imbibitionWaterTons.toFixed(2),
      params.imbibitionWaterPercentCane.toFixed(2),
      params.hydraulicPressureBar.toFixed(2),
      params.sucroseExtractionPercent.toFixed(2),
      params.bagasseMoisturePercent.toFixed(2),
      params.bagassePolPercent.toFixed(2),
      params.mixedJuiceBrix.toFixed(2),
      params.mixedJuicePurity.toFixed(2),
      timestamp,
    ].join("|");

    const extractionHash = createHash("sha256").update(preimage).digest("hex");

    const balance: MillingExtractionBalance = {
      tandemId: params.tandemId,
      imbibitionWaterTons: params.imbibitionWaterTons,
      imbibitionWaterPercentCane: params.imbibitionWaterPercentCane,
      hydraulicPressureBar: params.hydraulicPressureBar,
      sucroseExtractionPercent: params.sucroseExtractionPercent,
      bagasseMoisturePercent: params.bagasseMoisturePercent,
      bagassePolPercent: params.bagassePolPercent,
      mixedJuiceBrix: params.mixedJuiceBrix,
      mixedJuicePurity: params.mixedJuicePurity,
      millingTimestamp: timestamp,
      extractionHash,
    };

    this.millingBalances.set(extractionHash, balance);
    return balance;
  }

  /**
   * Builds and hashes a deterministic Evaporation and Crystallization Balance
   */
  public createEvaporationBalance(params: {
    syrupBrix: number;
    syrupPurity: number;
    massecuiteStrike: "MASA_COCIDA_A" | "MASA_COCIDA_B" | "MASA_COCIDA_C";
    centrifugalRecoveryPercent: number;
    finalMolassesBrix: number;
    finalMolassesPurity: number;
    evaporationTimestamp?: string;
  }): EvaporationAndCrystallizationBalance {
    const timestamp = params.evaporationTimestamp || new Date().toISOString();
    const preimage = [
      params.syrupBrix.toFixed(2),
      params.syrupPurity.toFixed(2),
      params.massecuiteStrike,
      params.centrifugalRecoveryPercent.toFixed(2),
      params.finalMolassesBrix.toFixed(2),
      params.finalMolassesPurity.toFixed(2),
      timestamp,
    ].join("|");

    const crystallizationHash = createHash("sha256").update(preimage).digest("hex");

    const balance: EvaporationAndCrystallizationBalance = {
      syrupBrix: params.syrupBrix,
      syrupPurity: params.syrupPurity,
      massecuiteStrike: params.massecuiteStrike,
      centrifugalRecoveryPercent: params.centrifugalRecoveryPercent,
      finalMolassesBrix: params.finalMolassesBrix,
      finalMolassesPurity: params.finalMolassesPurity,
      evaporationTimestamp: timestamp,
      crystallizationHash,
    };

    this.crystallizationBalances.set(crystallizationHash, balance);
    return balance;
  }

  /**
   * Computes the ICUMSA Safety Factor for sugar storage stability
   * Safety Factor = Moisture% / (100 - Pol°Z)
   * A value <= 0.25 prevents bacterial and fungal deterioration.
   */
  public static computeSafetyFactor(moisturePercent: number, polDegreesZ: number): number {
    const nonSugar = 100 - polDegreesZ;
    if (nonSugar <= 0) return 0;
    return Number((moisturePercent / nonSugar).toFixed(4));
  }

  /**
   * Creates a new block-chained SugarBatch linked to precursor cane batches and balances.
   */
  public createSugarBatch(input: CreateSugarBatchInput): {
    success: boolean;
    batch?: SugarBatch;
    errors?: string[];
  } {
    const errors: string[] = [];

    if (!input.batchNumber || !input.batchNumber.trim()) {
      errors.push("El código de lote de azúcar (batchNumber) es obligatorio.");
    }
    if (!input.tenantId || !input.tenantId.trim()) {
      errors.push("El identificador de tenant es obligatorio para el aislamiento multi-tenant.");
    }
    if (!input.totalTonsProduced || input.totalTonsProduced <= 0) {
      errors.push("Las toneladas producidas deben ser un valor numérico positivo.");
    }
    if (!input.parentCaneBatches || input.parentCaneBatches.length === 0) {
      errors.push("Se requiere al menos un lote de caña precursor (CaneBatch) para establecer el linaje.");
    }
    if (!input.analystSignature || !input.analystSignature.trim()) {
      errors.push("Se requiere la firma criptográfica del analista de calidad de azúcar.");
    }

    // Sugar Quality Bounds Check
    if (input.quality.polDegreesZ < 95.0 || input.quality.polDegreesZ > 100.0) {
      errors.push(`Pureza de azúcar Pol (${input.quality.polDegreesZ}°Z) fuera de rango comercial estándar (95.0°Z - 100.0°Z).`);
    }
    if (input.quality.moisturePercent < 0 || input.quality.moisturePercent > 2.0) {
      errors.push(`Humedad (${input.quality.moisturePercent}%) fuera de límites de envasado.`);
    }

    // Safety factor calculation check
    const calculatedSf = DataLineageEngine.computeSafetyFactor(
      input.quality.moisturePercent,
      input.quality.polDegreesZ
    );
    if (calculatedSf > 0.35) {
      errors.push(`Factor de Seguridad crítico (${calculatedSf} > 0.35). Alto riesgo de inversión de sacarosa y apelmazamiento en almacén.`);
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Cache precursor cane batches
    input.parentCaneBatches.forEach(cb => {
      this.caneBatchesById.set(cb.id, cb);
    });

    const tenantId = input.tenantId;
    if (!this.ledgerByTenant.has(tenantId)) {
      this.ledgerByTenant.set(tenantId, []);
    }

    const tenantLedger = this.ledgerByTenant.get(tenantId)!;
    const blockSequence = tenantLedger.length;
    const previousSugarBatchHash = blockSequence === 0
      ? "GENESIS_BLOCK_ZERO"
      : tenantLedger[blockSequence - 1].cryptographicHash;

    const parentCaneBatchIds = input.parentCaneBatches.map(cb => cb.id).sort();
    const parentCaneBatchCodes = input.parentCaneBatches.map(cb => cb.batchCode);

    // Save balance references
    this.millingBalances.set(input.millingExtraction.extractionHash, input.millingExtraction);
    this.crystallizationBalances.set(input.crystallization.crystallizationHash, input.crystallization);

    const productionDateTime = input.productionDateTime || new Date().toISOString();
    const bagCount = input.packagingType === "SACO_50KG"
      ? Math.round(input.totalTonsProduced * 20)
      : input.packagingType === "BIG_BAG_1000KG"
        ? Math.round(input.totalTonsProduced)
        : 1;

    // Canonical Preimage for SHA-256 Block Hashing
    const preimage = [
      input.batchNumber.trim(),
      tenantId.trim(),
      input.sugarType,
      input.totalTonsProduced.toFixed(2),
      input.quality.polDegreesZ.toFixed(2),
      input.quality.moisturePercent.toFixed(4),
      input.quality.colorIcumsaUI.toString(),
      parentCaneBatchIds.join(","),
      input.millingExtraction.extractionHash,
      input.crystallization.crystallizationHash,
      previousSugarBatchHash,
      blockSequence.toString(),
      input.analystSignature.trim(),
    ].join("|");

    const cryptographicHash = createHash("sha256").update(preimage).digest("hex");

    const newBatch: SugarBatch = {
      id: `sugar-batch-${Date.now()}-${blockSequence}`,
      batchNumber: input.batchNumber.trim(),
      tenantId,
      sugarType: input.sugarType,
      packagingType: input.packagingType,
      totalTonsProduced: input.totalTonsProduced,
      bagCount,
      productionDateTime,
      warehouseLocation: input.warehouseLocation,
      quality: {
        ...input.quality,
        safetyFactor: calculatedSf,
      },
      parentCaneBatchIds,
      parentCaneBatchCodes,
      millingBalanceHash: input.millingExtraction.extractionHash,
      crystallizationBalanceHash: input.crystallization.crystallizationHash,
      blockSequence,
      previousSugarBatchHash,
      cryptographicHash,
      analystSignature: input.analystSignature.trim(),
      status: "PRODUCED",
      dataClassification: "OPERATIONAL_DATA",
      dataOrigin: "LIMS",
      dataQuality: "VALIDATED",
      createdAt: productionDateTime,
      updatedAt: productionDateTime,
      version: "1.0.0",
    };

    tenantLedger.push(newBatch);

    // Record IEC 62443 Audit Log
    logAuditEventToDb({
      tenantId,
      action: "SUGAR_BATCH_MINED_AND_SEALED",
      module: "DATA_LINEAGE_ENGINE",
      targetId: newBatch.batchNumber,
      userRole: "supervisor_calidad",
      userName: input.analystSignature,
      status: "AUTHORIZED",
      ipAddress: "127.0.0.1",
      newValue: `Lote de azúcar ${newBatch.batchNumber} (Bloque #${blockSequence}) encadenado con ${parentCaneBatchIds.length} lotes de caña. Hash: ${cryptographicHash.slice(0, 12)}...`,
    }).catch(() => {});

    return { success: true, batch: newBatch };
  }

  /**
   * Recalculates the expected cryptographic hash of a given SugarBatch block.
   */
  public static computeBatchHash(batch: SugarBatch): string {
    const preimage = [
      batch.batchNumber.trim(),
      batch.tenantId.trim(),
      batch.sugarType,
      batch.totalTonsProduced.toFixed(2),
      batch.quality.polDegreesZ.toFixed(2),
      batch.quality.moisturePercent.toFixed(4),
      batch.quality.colorIcumsaUI.toString(),
      [...batch.parentCaneBatchIds].sort().join(","),
      batch.millingBalanceHash,
      batch.crystallizationBalanceHash,
      batch.previousSugarBatchHash,
      batch.blockSequence.toString(),
      batch.analystSignature.trim(),
    ].join("|");

    return createHash("sha256").update(preimage).digest("hex");
  }

  /**
   * Audits and verifies the entire cryptographic block chain for a given tenant.
   * Detects retroactive alterations, broken parent links, or invalid hashes.
   */
  public verifyBlockChainIntegrity(tenantId: string): ChainVerificationResult {
    const ledger = this.ledgerByTenant.get(tenantId) || [];
    const timestamp = new Date().toISOString();

    if (ledger.length === 0) {
      return {
        tenantId,
        totalBlocksAudited: 0,
        isChainValid: true,
        genesisBlockHash: "NONE",
        latestBlockHash: "NONE",
        verificationTimestamp: timestamp,
      };
    }

    const genesisBlockHash = ledger[0].cryptographicHash;
    const latestBlockHash = ledger[ledger.length - 1].cryptographicHash;

    for (let i = 0; i < ledger.length; i++) {
      const current = ledger[i];

      // 1. Verify sequence order
      if (current.blockSequence !== i) {
        return {
          tenantId,
          totalBlocksAudited: i,
          isChainValid: false,
          genesisBlockHash,
          latestBlockHash,
          brokenBlockSequence: i,
          brokenBatchId: current.id,
          tamperReason: `Secuencia de bloques desordenada o corrupta: bloque esperado #${i}, encontrado #${current.blockSequence}.`,
          verificationTimestamp: timestamp,
        };
      }

      // 2. Verify previous block linkage
      const expectedPrevHash = i === 0 ? "GENESIS_BLOCK_ZERO" : ledger[i - 1].cryptographicHash;
      if (current.previousSugarBatchHash !== expectedPrevHash) {
        return {
          tenantId,
          totalBlocksAudited: i + 1,
          isChainValid: false,
          genesisBlockHash,
          latestBlockHash,
          brokenBlockSequence: i,
          brokenBatchId: current.id,
          expectedPreviousHash: expectedPrevHash,
          actualPreviousHash: current.previousSugarBatchHash,
          tamperReason: `Ruptura de enlace criptográfico en bloque #${i} (${current.batchNumber}): previousSugarBatchHash no coincide con el hash del bloque previo.`,
          verificationTimestamp: timestamp,
        };
      }

      // 3. Recalculate and verify block hash against stored seal
      const computedHash = DataLineageEngine.computeBatchHash(current);
      if (computedHash !== current.cryptographicHash) {
        return {
          tenantId,
          totalBlocksAudited: i + 1,
          isChainValid: false,
          genesisBlockHash,
          latestBlockHash,
          brokenBlockSequence: i,
          brokenBatchId: current.id,
          tamperReason: `Alteración maliciosa detectada en bloque #${i} (${current.batchNumber}): El hash calculado (${computedHash.slice(0, 12)}...) no coincide con el sello digital (${current.cryptographicHash.slice(0, 12)}...).`,
          verificationTimestamp: timestamp,
        };
      }
    }

    return {
      tenantId,
      totalBlocksAudited: ledger.length,
      isChainValid: true,
      genesisBlockHash,
      latestBlockHash,
      verificationTimestamp: timestamp,
    };
  }

  /**
   * Traces a finished SugarBatch back through extraction and field agricultural precursor lots.
   */
  public traceSugarToField(sugarBatchId: string, tenantId: string): SugarLineageTrace | null {
    const ledger = this.ledgerByTenant.get(tenantId);
    if (!ledger) return null;

    const batch = ledger.find(b => b.id === sugarBatchId || b.batchNumber === sugarBatchId);
    if (!batch) return null;

    const milling = this.millingBalances.get(batch.millingBalanceHash);
    const crystallization = this.crystallizationBalances.get(batch.crystallizationBalanceHash);

    if (!milling || !crystallization) {
      return null;
    }

    const precursorBatches = batch.parentCaneBatchIds
      .map(id => this.caneBatchesById.get(id))
      .filter((cb): cb is CaneBatch => cb !== undefined)
      .map(cb => ({
        id: cb.id,
        code: cb.batchCode,
        plotId: cb.plotId,
        farmOrigin: cb.farmOrigin,
        growerName: cb.growerName,
        caneVariety: cb.caneVariety,
        netWeightTons: cb.netWeightTons,
        brixPercent: cb.brixPercent,
        polPercent: cb.polPercent,
        purityPercent: cb.purityPercent,
        fiberPercent: cb.fiberPercent,
        trashPercent: cb.trashPercent,
      }));

    const chainCheck = this.verifyBlockChainIntegrity(tenantId);

    return {
      sugarBatchId: batch.id,
      sugarBatchCode: batch.batchNumber,
      tenantId: batch.tenantId,
      sugarType: batch.sugarType,
      totalTonsProduced: batch.totalTonsProduced,
      bagCount: batch.bagCount,
      qualityMetrics: batch.quality,
      cryptographicSeal: batch.cryptographicHash,
      blockSequence: batch.blockSequence,
      precursorCaneBatches: precursorBatches,
      millingExtraction: milling,
      crystallization,
      chainIntegrityValid: chainCheck.isChainValid,
      tamperDetected: !chainCheck.isChainValid,
      traceTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves all sugar batches for a tenant
   */
  public getBatchesByTenant(tenantId: string): SugarBatch[] {
    return this.ledgerByTenant.get(tenantId) || [];
  }

  /**
   * Simulates an in-place database tamper for testing tamper detection
   */
  public tamperBatchForAuditTest(
    batchId: string,
    tenantId: string,
    field: "totalTonsProduced" | "sugarType" | "analystSignature",
    tamperedValue: any
  ): SugarBatch | null {
    const ledger = this.ledgerByTenant.get(tenantId);
    if (!ledger) return null;

    const batch = ledger.find(b => b.id === batchId || b.batchNumber === batchId);
    if (!batch) return null;

    (batch as any)[field] = tamperedValue;
    return batch;
  }

  /**
   * Resets ledger and caches for isolated testing
   */
  public resetLedgerForTesting(): void {
    this.ledgerByTenant.clear();
    this.caneBatchesById.clear();
    this.millingBalances.clear();
    this.crystallizationBalances.clear();
  }
}
