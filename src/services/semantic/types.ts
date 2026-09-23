/**
 * BioAzúcar 4.0 — Semantic Industrial Model & ISA-95 Hierarchy Types
 * 
 * Spec Reference: P0-03 (SEMANTIC INDUSTRIAL MODEL & ISA-95 CONTEXT RESOLUTION)
 * Implements ISA-88 / ISA-95 Part 1 Equipment Hierarchy and Operational Context:
 * Enterprise -> Site -> Area -> ProcessCell -> Process -> Equipment -> Device -> Tag
 */

import { CanonicalIndustrialTagRecord } from "../../types/canonicalTagRecord";

export type Isa95Level =
  | "ENTERPRISE"
  | "SITE"
  | "AREA"
  | "PROCESS_CELL"
  | "PROCESS"
  | "EQUIPMENT"
  | "DEVICE"
  | "TAG";

export interface Isa95Enterprise {
  id: string;
  name: string;
  code: string;
  headquarters?: string;
  description?: string;
}

export interface Isa95Site {
  id: string;
  enterpriseId: string;
  name: string;
  code: string;
  location: string;
  nominalGrindingCapacityTcd: number; // Toneladas de caña por día
  cogenCapacityMw: number;
}

export interface Isa95Area {
  id: string;
  siteId: string;
  name: string;
  code: string; // e.g. "BATEY", "MOLIENDA", "CALDERAS", "TURBOGENERACION", "EVAPORACION", "TACHOS", "CENTRIFUGAS"
  description: string;
  safetyLevel: string;
}

export interface Isa95ProcessCell {
  id: string;
  areaId: string;
  name: string;
  code: string; // e.g. "TANDEM_MOLINOS_A", "BATERIA_CALDERAS_BIOMASA", "TREN_EVAPORACION_CUADRUPLE"
  capacityUnit: string;
  ratedCapacity: number;
}

export interface Isa95Process {
  id: string;
  processCellId: string;
  name: string;
  code: string; // e.g. "EXTRACCION_SACAROSA", "GENERACION_VAPOR_ALTA", "CONCENTRACION_JARABE"
  processType: "CONTINUOUS" | "BATCH" | "DISCRETE";
  recipeOrStandard?: string;
}

export interface Isa95Equipment {
  id: string;
  processId: string;
  name: string;
  code: string; // e.g. "MOLINO_01", "CALDERA_BAGACERA_01", "TURBOGENERADOR_01", "TACHO_VACIO_01"
  equipmentType: "MILL" | "BOILER" | "TURBINE" | "CLARIFIER" | "EVAPORATOR" | "VACUUM_PAN" | "CENTRIFUGE" | "PUMP" | "FAN" | "SCALE";
  criticality: "A_CRITICAL" | "B_ESSENTIAL" | "C_NORMAL";
  parentEquipmentId?: string;
  subEquipmentIds?: string[];
  operationalStatus: "RUNNING" | "STOPPED" | "STANDBY" | "MAINTENANCE" | "FAULTED";
  upstreamEquipmentIds: string[];   // Flujos de entrada
  downstreamEquipmentIds: string[]; // Flujos de salida
  technicalSpecs?: Record<string, unknown>;
}

export interface Isa95Device {
  id: string;
  equipmentId: string;
  name: string;
  deviceType: "PLC" | "DCS_NODE" | "TRANSMITTER" | "VFD" | "SMART_VALVE" | "GATEWAY";
  ipAddress?: string;
  protocol: string;
  vendor?: string;
  model?: string;
}

/**
 * Resolved operational context for any Tag or Address
 */
export interface ResolvedIndustrialContext {
  tagId: string;
  canonicalName: string;
  originalAddress: string;
  protocol: string;
  value?: number | boolean | string;
  quality?: string;
  engineeringUnit: string;
  
  // ISA-95 Hierarchy chain
  enterprise: Isa95Enterprise;
  site: Isa95Site;
  area: Isa95Area;
  processCell: Isa95ProcessCell;
  process: Isa95Process;
  equipment: Isa95Equipment;
  device: Isa95Device;
  tagRecord?: CanonicalIndustrialTagRecord;

  // Visual human-readable breadcrumb path
  breadcrumbPath: string; // e.g. "Central Azucarero > Ingenio Providencia > Generación Vapor > Caldera 1 > Presión Vapor"
  
  // Topology graph navigation
  upstreamAssets: Isa95Equipment[];
  downstreamAssets: Isa95Equipment[];
}

export interface ProcessImpactAnalysis {
  triggerTagId: string;
  triggerEquipmentId: string;
  triggerEquipmentName: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CATASTROPHIC";
  description: string;
  affectedDirectEquipment: Isa95Equipment[];
  affectedDownstreamEquipment: Isa95Equipment[];
  affectedUpstreamEquipment: Isa95Equipment[];
  recommendedInterventions: string[];
}
