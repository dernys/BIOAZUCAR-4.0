/**
 * BioAzúcar 4.0 — Cryptographic Data Lineage & Block-Chained Sugar Batch Types
 * ==============================================================================
 * Conforms to IEC 62443-4-2 SL3 / ISA-95 Level 3-4 / ICUMSA Sugar Quality Standards.
 * 
 * Enforces:
 * 1. Cryptographic block chaining from field sugarcane to warehouse sugar sack.
 * 2. Immutable SHA-256 links combining CaneBatches, Milling Extraction Balances,
 *    and Evaporation/Crystallization/Molasses Balances.
 * 3. ICUMSA quality specifications and Safety Factor enforcement.
 */

export type SugarType =
  | "BLANCO_DIRECTO"
  | "CRUDO_ESTANDAR"
  | "REFINADO"
  | "ORGANICO";

export type SugarPackagingType =
  | "SACO_50KG"
  | "BIG_BAG_1000KG"
  | "GRANEL_SILO";

export type SugarBatchStatus =
  | "PRODUCED"
  | "QUARANTINE"
  | "RELEASED"
  | "SHIPPED"
  | "REJECTED";

/**
 * MillingExtractionBalance
 * Canonical extraction metrics from Tandem mills (Hugot first principles)
 */
export interface MillingExtractionBalance {
  tandemId: string;
  imbibitionWaterTons: number;
  imbibitionWaterPercentCane: number; // typically 25% - 35%
  hydraulicPressureBar: number;       // typically 220 - 280 bar
  sucroseExtractionPercent: number;   // typically 94.0% - 97.5%
  bagasseMoisturePercent: number;     // typically 48.0% - 51.5%
  bagassePolPercent: number;          // typically 1.6% - 2.5%
  mixedJuiceBrix: number;             // typically 13.0 - 17.0 °Bx
  mixedJuicePurity: number;           // typically 82.0% - 88.5%
  millingTimestamp: string;
  extractionHash: string;             // SHA-256 of canonical milling balance
}

/**
 * EvaporationAndCrystallizationBalance
 * Mass balance for evaporation, pan boiling strikes, and molasses exhaustion
 */
export interface EvaporationAndCrystallizationBalance {
  syrupBrix: number;                  // Meladura °Bx (typically 60° - 68°)
  syrupPurity: number;                // typically 83% - 89%
  massecuiteStrike: "MASA_COCIDA_A" | "MASA_COCIDA_B" | "MASA_COCIDA_C";
  centrifugalRecoveryPercent: number; // typically 86% - 92%
  finalMolassesBrix: number;          // typically 85° - 90°
  finalMolassesPurity: number;        // Pureza de Melaza final (typically 30% - 38%)
  evaporationTimestamp: string;
  crystallizationHash: string;        // SHA-256 of crystallization parameters
}

/**
 * SugarQualityMetrics
 * ICUMSA physical-chemical quality parameters
 */
export interface SugarQualityMetrics {
  polDegreesZ: number;                // Sucrose purity (°Z, e.g. 99.2 for raw, 99.8 for white)
  moisturePercent: number;            // Moisture % (e.g. 0.04% - 0.15%)
  colorIcumsaUI: number;              // Color ICUMSA (e.g. 45-80 white, 800-1500 raw)
  ashConductivityPercent: number;     // Conductometric ash % (e.g. 0.03% - 0.10%)
  reducingSugarsPercent: number;      // Invert sugar % (e.g. 0.04% - 0.12%)
  safetyFactor: number;               // Safety Factor = moisture / (100 - pol) <= 0.25
}

/**
 * SugarBatch
 * Finished sugar production block with cryptographic chaining (Block Sequence)
 */
export interface SugarBatch {
  id: string;                         // Unique ID (e.g. sugar-batch-2026-001)
  batchNumber: string;                // External batch code (e.g. SUGAR-LOT-2026-001)
  tenantId: string;                   // Multi-tenant partition
  sugarType: SugarType;
  packagingType: SugarPackagingType;
  totalTonsProduced: number;
  bagCount: number;                   // e.g. tons * 20 for 50kg bags
  productionDateTime: string;
  warehouseLocation: string;
  quality: SugarQualityMetrics;
  // Precursor lineage links
  parentCaneBatchIds: string[];       // Precursor cane batch IDs
  parentCaneBatchCodes: string[];     // Precursor cane batch codes for human audit
  millingBalanceHash: string;         // SHA-256 of extraction balance
  crystallizationBalanceHash: string; // SHA-256 of evaporation/crystallization balance
  // Cryptographic Block Chaining (Merkle-style sequential ledger)
  blockSequence: number;              // 0 for Genesis, 1, 2, 3...
  previousSugarBatchHash: string;     // Hash of block sequence - 1 (or "GENESIS_BLOCK_ZERO")
  cryptographicHash: string;          // Infallible SHA-256 seal of this block
  analystSignature: string;           // LIMS Chemist / Quality Assurance Lead signature
  status: SugarBatchStatus;
  rejectionReason?: string;
  dataClassification: "OPERATIONAL_DATA" | "AUDIT_RECORD";
  dataOrigin: "LIMS" | "SCADA";
  dataQuality: "VALIDATED" | "UNVERIFIED" | "INCOMPLETE";
  createdAt: string;
  updatedAt: string;
  version: string;
}

/**
 * SugarLineageTrace
 * Complete traceability tree from farm furrow to warehouse bag
 */
export interface SugarLineageTrace {
  sugarBatchId: string;
  sugarBatchCode: string;
  tenantId: string;
  sugarType: SugarType;
  totalTonsProduced: number;
  bagCount: number;
  qualityMetrics: SugarQualityMetrics;
  cryptographicSeal: string;
  blockSequence: number;
  precursorCaneBatches: {
    id: string;
    code: string;
    plotId?: string;
    farmOrigin: string;
    growerName: string;
    caneVariety: string;
    netWeightTons: number;
    brixPercent: number;
    polPercent: number;
    purityPercent: number;
    fiberPercent: number;
    trashPercent: number;
  }[];
  millingExtraction: MillingExtractionBalance;
  crystallization: EvaporationAndCrystallizationBalance;
  chainIntegrityValid: boolean;
  tamperDetected: boolean;
  traceTimestamp: string;
}

/**
 * ChainVerificationResult
 * Ledger audit result for cryptographic block chaining
 */
export interface ChainVerificationResult {
  tenantId: string;
  totalBlocksAudited: number;
  isChainValid: boolean;
  genesisBlockHash: string;
  latestBlockHash: string;
  brokenBlockSequence?: number;
  brokenBatchId?: string;
  expectedPreviousHash?: string;
  actualPreviousHash?: string;
  tamperReason?: string;
  verificationTimestamp: string;
}
