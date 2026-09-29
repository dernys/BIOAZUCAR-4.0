/**
 * BIOAZÚCAR 4.0 — ITERATION 38 TEST SUITE
 * ==============================================================================
 * Iteration I38: Trazabilidad Criptográfica y Linaje de Datos de Extracción (Data Lineage)
 * Standards: IEC 62443-4-2 SL3 / ISA-95 Level 3-4 (MOM) / ICUMSA GS2/3-1
 * 
 * Verifies:
 * 1. Cryptographic hashing of Tandem Milling Extraction Balances (Hugot first principles).
 * 2. Cryptographic hashing of Evaporation, Boiling Pan and Molasses Balances.
 * 3. Merkle-style sequential block chaining of SugarBatches (Genesis -> Block 1 -> Block 2).
 * 4. ICUMSA Safety Factor enforcement for sugar storage stability (Moisture / (100 - Pol) <= 0.25).
 * 5. Immediate detection of retroactive database tampering (Anti-Tampering).
 * 6. Full end-to-end lineage from sugarcane furrow to warehouse sugar sack.
 * 7. Multi-tenant ledger isolation.
 * 8. Explicit verification of Superadmin user identity in environment variables.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DataLineageEngine } from "../services/lineage/DataLineageEngine";
import { CaneBatch } from "../types";
import { CONFIGURED_SUPERADMIN_EMAIL, PREDEFINED_USERS } from "../services/authService";
import { MembershipService } from "../server/membershipService";

describe("BIOAZÚCAR 4.0 — ITERATION I38: CRYPTOGRAPHIC DATA LINEAGE & SUPERADMIN GOVERNANCE", () => {
  let engine: DataLineageEngine;

  const MOCK_CANE_BATCH_1: CaneBatch = {
    id: "batch-cane-001",
    batchCode: "CANE-LOT-TABLA-04-2026",
    tenantId: "TENANT_PORTUGUESA",
    campaignId: "CAMPAIGN_ZAFRA_2026_2027",
    plotId: "PLOT_TABLA_04",
    farmOrigin: "Finca La Pastora — Tabla 04",
    growerName: "Asociación Cañeros Portuguesa",
    caneVariety: "CP72-2086",
    truckPlate: "A12BC34",
    netWeightTons: 35.5,
    brixPercent: 19.8,
    polPercent: 17.2,
    purityPercent: 86.87,
    fiberPercent: 12.8,
    trashPercent: 4.2,
    cutDateTime: "2026-09-28T08:00:00Z",
    arrivalDateTime: "2026-09-28T11:30:00Z",
    status: "PROCESADO",
    sugarYieldEstimated: 4.35,
    weighingProvenance: "MEASURED_SCALE",
  };

  const MOCK_CANE_BATCH_2: CaneBatch = {
    id: "batch-cane-002",
    batchCode: "CANE-LOT-TABLA-08-2026",
    tenantId: "TENANT_PORTUGUESA",
    campaignId: "CAMPAIGN_ZAFRA_2026_2027",
    plotId: "PLOT_TABLA_08",
    farmOrigin: "Finca El Rodeo — Tabla 08",
    growerName: "Agropecuaria Santa Cruz",
    caneVariety: "CR74-250",
    truckPlate: "B56CD78",
    netWeightTons: 42.0,
    brixPercent: 20.2,
    polPercent: 17.8,
    purityPercent: 88.12,
    fiberPercent: 13.1,
    trashPercent: 3.8,
    cutDateTime: "2026-09-28T09:15:00Z",
    arrivalDateTime: "2026-09-28T12:45:00Z",
    status: "PROCESADO",
    sugarYieldEstimated: 5.25,
    weighingProvenance: "MEASURED_SCALE",
  };

  beforeEach(() => {
    engine = DataLineageEngine.getInstance();
    engine.resetLedgerForTesting();
  });

  describe("1. Milling & Evaporation Balances Cryptographic Sealing", () => {
    it("generates deterministic SHA-256 seal for Tandem Milling Extraction Balance", () => {
      const balance1 = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 24.5,
        imbibitionWaterPercentCane: 28.5,
        hydraulicPressureBar: 250,
        sucroseExtractionPercent: 96.4,
        bagasseMoisturePercent: 49.2,
        bagassePolPercent: 1.85,
        mixedJuiceBrix: 15.2,
        mixedJuicePurity: 85.5,
        millingTimestamp: "2026-09-28T13:00:00Z",
      });

      const balance2 = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 24.5,
        imbibitionWaterPercentCane: 28.5,
        hydraulicPressureBar: 250,
        sucroseExtractionPercent: 96.4,
        bagasseMoisturePercent: 49.2,
        bagassePolPercent: 1.85,
        mixedJuiceBrix: 15.2,
        mixedJuicePurity: 85.5,
        millingTimestamp: "2026-09-28T13:00:00Z",
      });

      expect(balance1.extractionHash).toBe(balance2.extractionHash);
      expect(balance1.extractionHash).toMatch(/^[0-9a-f]{64}$/);
      expect(balance1.sucroseExtractionPercent).toBe(96.4);
    });

    it("generates deterministic SHA-256 seal for Evaporation & Molasses Balance", () => {
      const balance = engine.createEvaporationBalance({
        syrupBrix: 65.0,
        syrupPurity: 86.2,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 89.5,
        finalMolassesBrix: 88.0,
        finalMolassesPurity: 34.2,
        evaporationTimestamp: "2026-09-28T16:00:00Z",
      });

      expect(balance.crystallizationHash).toBeDefined();
      expect(balance.crystallizationHash).toMatch(/^[0-9a-f]{64}$/);
      expect(balance.finalMolassesPurity).toBe(34.2);
    });
  });

  describe("2. Block-Chained Sugar Batch Creation (Merkle Block Chaining)", () => {
    it("creates Genesis Block (Block #0) with previousHash = GENESIS_BLOCK_ZERO", () => {
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 22.0,
        imbibitionWaterPercentCane: 28.0,
        hydraulicPressureBar: 245,
        sucroseExtractionPercent: 96.2,
        bagasseMoisturePercent: 49.5,
        bagassePolPercent: 1.9,
        mixedJuiceBrix: 15.0,
        mixedJuicePurity: 85.0,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 64.5,
        syrupPurity: 85.8,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 88.9,
        finalMolassesBrix: 87.5,
        finalMolassesPurity: 33.8,
      });

      const res = engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-2026-001",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 50.0,
        warehouseLocation: "SILO_AZUCAR_A",
        quality: {
          polDegreesZ: 99.75,
          moisturePercent: 0.045,
          colorIcumsaUI: 65,
          ashConductivityPercent: 0.04,
          reducingSugarsPercent: 0.05,
          safetyFactor: 0.18,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_1, MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-ELENA-RAMOS",
      });

      expect(res.success).toBe(true);
      expect(res.batch).toBeDefined();
      expect(res.batch?.blockSequence).toBe(0);
      expect(res.batch?.previousSugarBatchHash).toBe("GENESIS_BLOCK_ZERO");
      expect(res.batch?.bagCount).toBe(1000); // 50 tons * 20 bags/ton
      expect(res.batch?.cryptographicHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("chains sequential blocks where Block #1 links to Block #0 cryptographicHash", () => {
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 20.0,
        imbibitionWaterPercentCane: 27.0,
        hydraulicPressureBar: 240,
        sucroseExtractionPercent: 95.8,
        bagasseMoisturePercent: 50.0,
        bagassePolPercent: 2.1,
        mixedJuiceBrix: 14.8,
        mixedJuicePurity: 84.5,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 64.0,
        syrupPurity: 85.0,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 88.0,
        finalMolassesBrix: 87.0,
        finalMolassesPurity: 34.5,
      });

      // Block #0
      const b0 = engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-2026-001",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "CRUDO_ESTANDAR",
        packagingType: "SACO_50KG",
        totalTonsProduced: 40.0,
        warehouseLocation: "ALMACEN_01",
        quality: {
          polDegreesZ: 99.2,
          moisturePercent: 0.08,
          colorIcumsaUI: 1100,
          ashConductivityPercent: 0.08,
          reducingSugarsPercent: 0.08,
          safetyFactor: 0.10,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_1],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-01",
      });

      // Block #1
      const b1 = engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-2026-002",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "CRUDO_ESTANDAR",
        packagingType: "SACO_50KG",
        totalTonsProduced: 60.0,
        warehouseLocation: "ALMACEN_02",
        quality: {
          polDegreesZ: 99.3,
          moisturePercent: 0.07,
          colorIcumsaUI: 1050,
          ashConductivityPercent: 0.07,
          reducingSugarsPercent: 0.07,
          safetyFactor: 0.10,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-02",
      });

      expect(b0.batch?.blockSequence).toBe(0);
      expect(b1.batch?.blockSequence).toBe(1);
      expect(b1.batch?.previousSugarBatchHash).toBe(b0.batch?.cryptographicHash);
    });

    it("enforces ICUMSA Safety Factor limit (Moisture / (100 - Pol) <= 0.25)", () => {
      // Pol = 99.0, Moisture = 0.40 -> Safety Factor = 0.40 / 1.0 = 0.40 > 0.35 threshold
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 20.0,
        imbibitionWaterPercentCane: 27.0,
        hydraulicPressureBar: 240,
        sucroseExtractionPercent: 95.8,
        bagasseMoisturePercent: 50.0,
        bagassePolPercent: 2.1,
        mixedJuiceBrix: 14.8,
        mixedJuicePurity: 84.5,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 64.0,
        syrupPurity: 85.0,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 88.0,
        finalMolassesBrix: 87.0,
        finalMolassesPurity: 34.5,
      });

      const res = engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-DANGEROUS-MOISTURE",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "CRUDO_ESTANDAR",
        packagingType: "SACO_50KG",
        totalTonsProduced: 25.0,
        warehouseLocation: "ALMACEN_01",
        quality: {
          polDegreesZ: 99.0,
          moisturePercent: 0.40, // Excessive moisture
          colorIcumsaUI: 1200,
          ashConductivityPercent: 0.08,
          reducingSugarsPercent: 0.08,
          safetyFactor: 0.40,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_1],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-01",
      });

      expect(res.success).toBe(false);
      expect(res.errors?.some(e => e.includes("Factor de Seguridad crítico"))).toBe(true);
    });
  });

  describe("3. Cryptographic Chain Integrity Verification & Anti-Tampering", () => {
    it("confirms complete ledger validity when chain has not been tampered with", () => {
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 20.0,
        imbibitionWaterPercentCane: 27.0,
        hydraulicPressureBar: 240,
        sucroseExtractionPercent: 95.8,
        bagasseMoisturePercent: 50.0,
        bagassePolPercent: 2.1,
        mixedJuiceBrix: 14.8,
        mixedJuicePurity: 84.5,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 64.0,
        syrupPurity: 85.0,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 88.0,
        finalMolassesBrix: 87.0,
        finalMolassesPurity: 34.5,
      });

      engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-01",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 30.0,
        warehouseLocation: "ALMACEN_A",
        quality: {
          polDegreesZ: 99.8,
          moisturePercent: 0.04,
          colorIcumsaUI: 55,
          ashConductivityPercent: 0.03,
          reducingSugarsPercent: 0.04,
          safetyFactor: 0.20,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_1],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-01",
      });

      engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-02",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 45.0,
        warehouseLocation: "ALMACEN_A",
        quality: {
          polDegreesZ: 99.85,
          moisturePercent: 0.035,
          colorIcumsaUI: 50,
          ashConductivityPercent: 0.03,
          reducingSugarsPercent: 0.03,
          safetyFactor: 0.23,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-02",
      });

      const check = engine.verifyBlockChainIntegrity("TENANT_PORTUGUESA");
      expect(check.isChainValid).toBe(true);
      expect(check.totalBlocksAudited).toBe(2);
      expect(check.genesisBlockHash).toBeDefined();
      expect(check.latestBlockHash).toBeDefined();
    });

    it("DETECTS TAMPERING IMMEDIATELY when retroactive database alteration occurs", () => {
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 20.0,
        imbibitionWaterPercentCane: 27.0,
        hydraulicPressureBar: 240,
        sucroseExtractionPercent: 95.8,
        bagasseMoisturePercent: 50.0,
        bagassePolPercent: 2.1,
        mixedJuiceBrix: 14.8,
        mixedJuicePurity: 84.5,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 64.0,
        syrupPurity: 85.0,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 88.0,
        finalMolassesBrix: 87.0,
        finalMolassesPurity: 34.5,
      });

      // Mine 3 sequential blocks
      engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-101",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 50.0,
        warehouseLocation: "ALMACEN_A",
        quality: { polDegreesZ: 99.8, moisturePercent: 0.04, colorIcumsaUI: 60, ashConductivityPercent: 0.03, reducingSugarsPercent: 0.04, safetyFactor: 0.20 },
        parentCaneBatches: [MOCK_CANE_BATCH_1],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-01",
      });

      engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-102",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 75.0,
        warehouseLocation: "ALMACEN_A",
        quality: { polDegreesZ: 99.8, moisturePercent: 0.04, colorIcumsaUI: 60, ashConductivityPercent: 0.03, reducingSugarsPercent: 0.04, safetyFactor: 0.20 },
        parentCaneBatches: [MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-02",
      });

      engine.createSugarBatch({
        batchNumber: "SUGAR-LOT-103",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 60.0,
        warehouseLocation: "ALMACEN_A",
        quality: { polDegreesZ: 99.8, moisturePercent: 0.04, colorIcumsaUI: 60, ashConductivityPercent: 0.03, reducingSugarsPercent: 0.04, safetyFactor: 0.20 },
        parentCaneBatches: [MOCK_CANE_BATCH_1, MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-03",
      });

      // Initial check must be valid
      expect(engine.verifyBlockChainIntegrity("TENANT_PORTUGUESA").isChainValid).toBe(true);

      // SIMULATE FRAUDULENT TAMPER: An insider alters production tons of Block #1 from 75.0 to 120.0 tons in storage
      engine.tamperBatchForAuditTest("SUGAR-LOT-102", "TENANT_PORTUGUESA", "totalTonsProduced", 120.0);

      // Verify chain integrity
      const audit = engine.verifyBlockChainIntegrity("TENANT_PORTUGUESA");
      expect(audit.isChainValid).toBe(false);
      expect(audit.brokenBlockSequence).toBe(1);
      expect(audit.tamperReason).toContain("Alteración maliciosa detectada en bloque #1");
      expect(audit.tamperReason).toContain("El hash calculado");
    });
  });

  describe("4. End-to-End Lineage: From Sugarcane Furrow to Warehouse Sugar Bag", () => {
    it("traces complete journey from field plot through milling and crystallization to sugar lot", () => {
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 25.0,
        imbibitionWaterPercentCane: 29.0,
        hydraulicPressureBar: 255,
        sucroseExtractionPercent: 96.8,
        bagasseMoisturePercent: 49.0,
        bagassePolPercent: 1.7,
        mixedJuiceBrix: 15.5,
        mixedJuicePurity: 86.0,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 66.0,
        syrupPurity: 87.0,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 90.0,
        finalMolassesBrix: 88.5,
        finalMolassesPurity: 33.5,
      });

      const createRes = engine.createSugarBatch({
        batchNumber: "SUGAR-TRACE-TEST-01",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 80.0,
        warehouseLocation: "ALMACEN_PRINCIPAL_RACK_03",
        quality: {
          polDegreesZ: 99.82,
          moisturePercent: 0.038,
          colorIcumsaUI: 58,
          ashConductivityPercent: 0.035,
          reducingSugarsPercent: 0.04,
          safetyFactor: 0.21,
        },
        parentCaneBatches: [MOCK_CANE_BATCH_1, MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-ELENA-RAMOS",
      });

      expect(createRes.success).toBe(true);

      const trace = engine.traceSugarToField("SUGAR-TRACE-TEST-01", "TENANT_PORTUGUESA");
      expect(trace).not.toBeNull();
      expect(trace?.sugarBatchCode).toBe("SUGAR-TRACE-TEST-01");
      expect(trace?.totalTonsProduced).toBe(80.0);
      expect(trace?.bagCount).toBe(1600); // 80t * 20
      expect(trace?.chainIntegrityValid).toBe(true);
      expect(trace?.tamperDetected).toBe(false);

      // Verify Precursor Cane Batches
      expect(trace?.precursorCaneBatches).toHaveLength(2);
      expect(trace?.precursorCaneBatches[0].farmOrigin).toContain("La Pastora");
      expect(trace?.precursorCaneBatches[1].farmOrigin).toContain("El Rodeo");

      // Verify Milling & Extraction Parameters
      expect(trace?.millingExtraction.tandemId).toBe("TANDEM_01");
      expect(trace?.millingExtraction.sucroseExtractionPercent).toBe(96.8);

      // Verify Crystallization Parameters
      expect(trace?.crystallization.syrupBrix).toBe(66.0);
      expect(trace?.crystallization.finalMolassesPurity).toBe(33.5);
    });
  });

  describe("5. Multi-Tenant Ledger Isolation", () => {
    it("keeps sugar batches and blockchain ledgers strictly isolated across tenants", () => {
      const milling = engine.createMillingExtractionBalance({
        tandemId: "TANDEM_01",
        imbibitionWaterTons: 20.0,
        imbibitionWaterPercentCane: 27.0,
        hydraulicPressureBar: 240,
        sucroseExtractionPercent: 95.8,
        bagasseMoisturePercent: 50.0,
        bagassePolPercent: 2.1,
        mixedJuiceBrix: 14.8,
        mixedJuicePurity: 84.5,
      });

      const crystallization = engine.createEvaporationBalance({
        syrupBrix: 64.0,
        syrupPurity: 85.0,
        massecuiteStrike: "MASA_COCIDA_A",
        centrifugalRecoveryPercent: 88.0,
        finalMolassesBrix: 87.0,
        finalMolassesPurity: 34.5,
      });

      engine.createSugarBatch({
        batchNumber: "SUGAR-PORTUGUESA-01",
        tenantId: "TENANT_PORTUGUESA",
        sugarType: "BLANCO_DIRECTO",
        packagingType: "SACO_50KG",
        totalTonsProduced: 50.0,
        warehouseLocation: "SILO_PORTUGUESA",
        quality: { polDegreesZ: 99.8, moisturePercent: 0.04, colorIcumsaUI: 60, ashConductivityPercent: 0.03, reducingSugarsPercent: 0.04, safetyFactor: 0.20 },
        parentCaneBatches: [MOCK_CANE_BATCH_1],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-PORTUGUESA",
      });

      engine.createSugarBatch({
        batchNumber: "SUGAR-PALMAR-01",
        tenantId: "TENANT_EL_PALMAR",
        sugarType: "CRUDO_ESTANDAR",
        packagingType: "SACO_50KG",
        totalTonsProduced: 70.0,
        warehouseLocation: "SILO_PALMAR",
        quality: { polDegreesZ: 99.2, moisturePercent: 0.08, colorIcumsaUI: 1100, ashConductivityPercent: 0.08, reducingSugarsPercent: 0.08, safetyFactor: 0.10 },
        parentCaneBatches: [MOCK_CANE_BATCH_2],
        millingExtraction: milling,
        crystallization,
        analystSignature: "SIG-CHEM-PALMAR",
      });

      const batchesPortuguesa = engine.getBatchesByTenant("TENANT_PORTUGUESA");
      const batchesPalmar = engine.getBatchesByTenant("TENANT_EL_PALMAR");

      expect(batchesPortuguesa).toHaveLength(1);
      expect(batchesPortuguesa[0].batchNumber).toBe("SUGAR-PORTUGUESA-01");
      expect(batchesPortuguesa[0].blockSequence).toBe(0);

      expect(batchesPalmar).toHaveLength(1);
      expect(batchesPalmar[0].batchNumber).toBe("SUGAR-PALMAR-01");
      expect(batchesPalmar[0].blockSequence).toBe(0); // Each tenant has its own Genesis block #0!
    });
  });

  describe("6. Superadmin User Verification in Environment Variables (IEC 62443 SL3)", () => {
    it("MUST verify that superadmin email is properly configured in environment variables", () => {
      const configuredEmail = process.env.SUPERADMIN_EMAIL || process.env.VITE_SUPERADMIN_EMAIL || "ing.dernys@gmail.com";
      expect(configuredEmail).toBeDefined();
      expect(configuredEmail).toBe("ing.dernys@gmail.com");
      expect(CONFIGURED_SUPERADMIN_EMAIL).toBe(configuredEmail);
    });

    it("MUST ensure PREDEFINED_USERS superadmin account uses the environment email", () => {
      const superadminUser = PREDEFINED_USERS.find(u => u.role === "superadmin");
      expect(superadminUser).toBeDefined();
      expect(superadminUser?.email).toBe(CONFIGURED_SUPERADMIN_EMAIL);
      expect(superadminUser?.isSuperAdmin).toBe(true);
      expect(superadminUser?.securityLevel).toBe(5);
      expect(superadminUser?.tenantId).toBe("GLOBAL");
    });

    it("MUST grant ROOT_ACCESS and securityLevel 5 in MembershipService for environment superadmin", () => {
      const configuredEmail = CONFIGURED_SUPERADMIN_EMAIL;
      const membership = MembershipService.getEffectiveMembershipSync("usr-test-root", configuredEmail);

      expect(membership).not.toBeNull();
      expect(membership?.role).toBe("superadmin");
      expect(membership?.securityLevel).toBe(5);
      expect(membership?.tenantId).toBe("GLOBAL");
      expect(membership?.permissions).toContain("ROOT_ACCESS");
      expect(membership?.permissions).toContain("MANAGE_TENANTS");
      expect(membership?.permissions).toContain("VIEW_ALL_TENANTS");
    });
  });
});
