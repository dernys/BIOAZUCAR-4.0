/**
 * BioAzúcar 4.0 — P0-03 Semantic Industrial Model & ISA-95 Context Resolution Test Suite
 * 
 * Tests 8-level ISA-95 operational hierarchy, contextual resolution, equipment queries,
 * and deterministic upstream/downstream impact analysis across sugar mill mass/energy flows.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SemanticIndustrialModel } from "../services/semantic/SemanticIndustrialModel";
import { SemanticIndustrialContextResolver } from "../services/semantic/SemanticIndustrialContextResolver";

describe("P0-03: Semantic Industrial Model & ISA-95 Context Resolution", () => {
  let model: SemanticIndustrialModel;
  let resolver: SemanticIndustrialContextResolver;

  beforeEach(() => {
    SemanticIndustrialModel.resetInstance();
    SemanticIndustrialContextResolver.resetInstance();
    model = SemanticIndustrialModel.getInstance();
    resolver = SemanticIndustrialContextResolver.getInstance();
  });

  it("should assemble a complete 8-level ISA-95 hierarchy for the sugar mill", () => {
    expect(model.enterprise).toBeDefined();
    expect(model.enterprise.name).toContain("Corporación Agroindustrial Azucarera");
    expect(model.site.name).toContain("Jesús Menéndez");
    expect(model.site.nominalGrindingCapacityTcd).toBe(8500);

    expect(model.areas.size).toBeGreaterThanOrEqual(7);
    expect(model.areas.has("AREA_MOLIENDA")).toBe(true);
    expect(model.areas.has("AREA_CALDERAS")).toBe(true);
    expect(model.areas.has("AREA_TURBOGENERACION")).toBe(true);
    expect(model.areas.has("AREA_EVAPORACION")).toBe(true);
    expect(model.areas.has("AREA_TACHOS")).toBe(true);

    expect(model.processCells.size).toBeGreaterThanOrEqual(6);
    expect(model.processes.size).toBeGreaterThanOrEqual(6);
    expect(model.equipments.size).toBeGreaterThanOrEqual(8);
    expect(model.devices.size).toBeGreaterThanOrEqual(6);
  });

  it("should resolve contextual lineage for arbitrary industrial addresses (Spec Example)", () => {
    // Spec Requirement:
    // "DB10.DBW14 -> Boiler 01 -> Steam System -> Main Steam Pressure -> 280.5 bar -> GOOD -> OPC UA -> PLC-01"
    const context = resolver.resolveContext("DB10.DBW14", 280.5, "GOOD");

    expect(context).toBeDefined();
    expect(context.originalAddress).toBe("DB10.DBW14");
    expect(context.value).toBe(280.5);
    expect(context.quality).toBe("GOOD");
    expect(context.protocol).toBeDefined();

    // Verify ISA-95 hierarchy resolution
    expect(context.enterprise.id).toBe("ENT_BIOAZUCAR_HOLDING");
    expect(context.site.id).toBe("SITE_CENTRAL_01");
    expect(context.equipment.name).toContain("Caldera");
    expect(context.device.name).toBeDefined();
    expect(context.breadcrumbPath).toContain("Central Azucarero");
    expect(context.breadcrumbPath).toContain("Caldera");
  });

  it("should answer: 'Which tags belong to this boiler / equipment?'", () => {
    const boilerTags = resolver.getEquipmentTags("EQ_CALDERA_01");
    expect(boilerTags.length).toBeGreaterThanOrEqual(1);

    const pressureTag = boilerTags.find((t) => t.tagId === "tag-boiler1-steam-pressure");
    expect(pressureTag).toBeDefined();
    expect(pressureTag?.variable).toBe("Main_Steam_Pressure");
    expect(pressureTag?.criticality).toBe("SAFETY_CRITICAL");
  });

  it("should answer: 'Which equipment constitutes this process?'", () => {
    const millingEquipment = resolver.getProcessEquipment("PROC_EXTRACCION_JUGO");
    expect(millingEquipment.length).toBeGreaterThanOrEqual(2);

    const names = millingEquipment.map((e) => e.name);
    expect(names.some((n) => n.includes("Molino"))).toBe(true);
    expect(names.some((n) => n.includes("Picadora"))).toBe(true);
  });

  it("should answer: 'What upstream and downstream processes are impacted by this tag?'", () => {
    // When boiler steam pressure fluctuates, it downstream impacts TG (Turbine) and Evaporators
    const impact = resolver.getImpactAnalysis("tag-boiler1-steam-pressure");

    expect(impact.triggerEquipmentId).toBe("EQ_CALDERA_01");
    expect(impact.severity).toBe("CATASTROPHIC");
    expect(impact.recommendedInterventions.length).toBeGreaterThanOrEqual(2);

    // Check downstream propagation: Boiler -> Turbine -> Evaporator -> Vacuum Pan
    const downstreamIds = impact.affectedDownstreamEquipment.map((e) => e.id);
    expect(downstreamIds).toContain("EQ_TURBINA_TG01");
    expect(downstreamIds).toContain("EQ_EVAPORADOR_01");

    // Check upstream: Molino (provides bagasse)
    const upstreamIds = impact.affectedUpstreamEquipment.map((e) => e.id);
    expect(upstreamIds).toContain("EQ_MOLINO_01");
  });
});
