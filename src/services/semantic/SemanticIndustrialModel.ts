/**
 * BioAzúcar 4.0 — Semantic Industrial Model (ISA-95 Topology & Process Graph)
 * 
 * Spec Reference: P0-03 (SEMANTIC INDUSTRIAL MODEL)
 * Houses the complete 8-level structural hierarchy:
 * Enterprise -> Site -> Area -> ProcessCell -> Process -> Equipment -> Device -> Tag
 * Maintains topological upstream/downstream flow graph of mass and energy.
 */

import {
  Isa95Enterprise,
  Isa95Site,
  Isa95Area,
  Isa95ProcessCell,
  Isa95Process,
  Isa95Equipment,
  Isa95Device,
} from "./types";

export class SemanticIndustrialModel {
  private static instance: SemanticIndustrialModel | null = null;

  public enterprise!: Isa95Enterprise;
  public site!: Isa95Site;
  public areas: Map<string, Isa95Area> = new Map();
  public processCells: Map<string, Isa95ProcessCell> = new Map();
  public processes: Map<string, Isa95Process> = new Map();
  public equipments: Map<string, Isa95Equipment> = new Map();
  public devices: Map<string, Isa95Device> = new Map();

  // Mappings
  public equipmentToDevice: Map<string, string[]> = new Map();
  public equipmentToProcess: Map<string, string> = new Map();
  public tagToEquipment: Map<string, string> = new Map();
  public addressToTagId: Map<string, string> = new Map();

  private constructor() {
    this.buildSugarMillTopology();
  }

  public static getInstance(): SemanticIndustrialModel {
    if (!SemanticIndustrialModel.instance) {
      SemanticIndustrialModel.instance = new SemanticIndustrialModel();
    }
    return SemanticIndustrialModel.instance;
  }

  public static resetInstance(): void {
    SemanticIndustrialModel.instance = null;
  }

  public linkTagToEquipment(tagId: string, equipmentId: string, originalAddress?: string): void {
    this.tagToEquipment.set(tagId, equipmentId);
    if (originalAddress) {
      this.addressToTagId.set(originalAddress, tagId);
    }
  }

  public getEquipment(equipmentId: string): Isa95Equipment | undefined {
    return this.equipments.get(equipmentId);
  }

  public getAllEquipments(): Isa95Equipment[] {
    return Array.from(this.equipments.values());
  }

  public getProcess(processId: string): Isa95Process | undefined {
    return this.processes.get(processId);
  }

  public getProcessCell(cellId: string): Isa95ProcessCell | undefined {
    return this.processCells.get(cellId);
  }

  public getArea(areaId: string): Isa95Area | undefined {
    return this.areas.get(areaId);
  }

  public getDevice(deviceId: string): Isa95Device | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Builds realistic high-fidelity ISA-95 topology for an integrated sugar mill & cogeneration plant
   */
  private buildSugarMillTopology(): void {
    // 1. ENTERPRISE
    this.enterprise = {
      id: "ENT_BIOAZUCAR_HOLDING",
      name: "Corporación Agroindustrial Azucarera de Cuba & El Caribe",
      code: "AZUCAR_HOLDING",
      headquarters: "La Habana, Cuba",
      description: "Operador de ingenios azucareros, cogeneración con bagazo y derivados.",
    };

    // 2. SITE
    this.site = {
      id: "SITE_CENTRAL_01",
      enterpriseId: this.enterprise.id,
      name: "Central Azucarero & Planta de Biomasa 'Jesús Menéndez'",
      code: "CENTRAL_JM_01",
      location: "Las Tunas, Cuba (21.16N, 76.49W)",
      nominalGrindingCapacityTcd: 8500, // 8,500 Toneladas Caña / Día
      cogenCapacityMw: 45.0,           // 45 MW Turbo-generación
    };

    // 3. AREAS
    const areaList: Isa95Area[] = [
      {
        id: "AREA_RECEPCION_BATEY",
        siteId: this.site.id,
        name: "Recepción y Batey de Caña",
        code: "BATEY",
        description: "Básculas de pesaje de camiones/vagones, mesas alimentadoras y conductores de caña entera.",
        safetyLevel: "ZONE_2",
      },
      {
        id: "AREA_MOLIENDA",
        siteId: this.site.id,
        name: "Preparación y Tándem de Molienda",
        code: "MOLIENDA",
        description: "Niveladoras, picadoras de alta velocidad, desfibrador y tándem de 6 molinos 84 pulgadas.",
        safetyLevel: "ZONE_1",
      },
      {
        id: "AREA_CALDERAS",
        siteId: this.site.id,
        name: "Generación de Vapor & Calderas de Bagazo",
        code: "CALDERAS",
        description: "Batería de calderas acuotubulares de biomasa bagacera a 45 bar y 440°C.",
        safetyLevel: "CRITICAL_BOILER_SAFETY",
      },
      {
        id: "AREA_TURBOGENERACION",
        siteId: this.site.id,
        name: "Casa de Fuerza & Turbogeneración",
        code: "TURBOGENERACION",
        description: "Turbinas de vapor de contrapresión y extracción conectadas a red nacional a 60 Hz.",
        safetyLevel: "CRITICAL_ELECTRICAL",
      },
      {
        id: "AREA_CLARIFICACION",
        siteId: this.site.id,
        name: "Tratamiento de Jugo & Clarificación",
        code: "CLARIFICACION",
        description: "Encalado automático con sacarato, calentadores de jugo y clarificadores rápidos SRI.",
        safetyLevel: "ZONE_2",
      },
      {
        id: "AREA_EVAPORACION",
        siteId: this.site.id,
        name: "Concentración & Tren de Evaporación",
        code: "EVAPORACION",
        description: "Pre-evaporador y cuádruple efecto de evaporación para obtención de meladura.",
        safetyLevel: "ZONE_2",
      },
      {
        id: "AREA_TACHOS",
        siteId: this.site.id,
        name: "Cocimiento & Cristalización al Vacío",
        code: "TACHOS",
        description: "Tachos al vacío continuos y discontinuos para masas cocidas A, B y C.",
        safetyLevel: "ZONE_2",
      },
    ];

    for (const a of areaList) {
      this.areas.set(a.id, a);
    }

    // 4. PROCESS CELLS
    const cellList: Isa95ProcessCell[] = [
      {
        id: "CELL_BATEY_RECEPCION",
        areaId: "AREA_RECEPCION_BATEY",
        name: "Batería de Básculas y Mesas Volcadoras",
        code: "CELL_BATEY",
        capacityUnit: "t/h",
        ratedCapacity: 450,
      },
      {
        id: "CELL_TANDEM_MOLINOS",
        areaId: "AREA_MOLIENDA",
        name: "Tándem Principal de Molienda (Molinos 1 a 6)",
        code: "CELL_TANDEM_01",
        capacityUnit: "TCH",
        ratedCapacity: 420,
      },
      {
        id: "CELL_BATERIA_CALDERAS",
        areaId: "AREA_CALDERAS",
        name: "Batería de Calderas Bagaceras",
        code: "CELL_BOILERS",
        capacityUnit: "t_vapor/h",
        ratedCapacity: 250,
      },
      {
        id: "CELL_CASA_FUERZA",
        areaId: "AREA_TURBOGENERACION",
        name: "Turbogeneradores Principales TG1 y TG2",
        code: "CELL_TG",
        capacityUnit: "MW",
        ratedCapacity: 45,
      },
      {
        id: "CELL_TREN_EVAPORACION",
        areaId: "AREA_EVAPORACION",
        name: "Tren de Evaporación Cuádruple Efecto",
        code: "CELL_EVAP_TRAIN",
        capacityUnit: "m3/h",
        ratedCapacity: 220,
      },
      {
        id: "CELL_SALA_TACHOS",
        areaId: "AREA_TACHOS",
        name: "Batería de Tachos al Vacío Masas A y B",
        code: "CELL_PANS",
        capacityUnit: "m3_strike",
        ratedCapacity: 350,
      },
    ];

    for (const c of cellList) {
      this.processCells.set(c.id, c);
    }

    // 5. PROCESSES
    const processList: Isa95Process[] = [
      {
        id: "PROC_PESAJE_BATEY",
        processCellId: "CELL_BATEY_RECEPCION",
        name: "Pesaje y Descarga de Caña",
        code: "PESAJE_DESCARGA",
        processType: "DISCRETE",
      },
      {
        id: "PROC_EXTRACCION_JUGO",
        processCellId: "CELL_TANDEM_MOLINOS",
        name: "Molienda e Imbibición de Caña",
        code: "EXTRACCION_MOLIENDA",
        processType: "CONTINUOUS",
      },
      {
        id: "PROC_GENERACION_VAPOR",
        processCellId: "CELL_BATERIA_CALDERAS",
        name: "Combustión de Bagazo y Generación de Vapor de Alta",
        code: "GENERACION_VAPOR_45BAR",
        processType: "CONTINUOUS",
      },
      {
        id: "PROC_GENERACION_ELECTRICA",
        processCellId: "CELL_CASA_FUERZA",
        name: "Expansión de Vapor en Turbinas y Cogeneración Eléctrica",
        code: "COGENERACION_TG",
        processType: "CONTINUOUS",
      },
      {
        id: "PROC_CONCENTRACION_JUGO",
        processCellId: "CELL_TREN_EVAPORACION",
        name: "Evaporación de Jugo Claro a Meladura (65° Brix)",
        code: "EVAPORACION_MELADURA",
        processType: "CONTINUOUS",
      },
      {
        id: "PROC_CRISTALIZACION_AZUCAR",
        processCellId: "CELL_SALA_TACHOS",
        name: "Cristalización de Sacarosa al Vacío (Masas Cocidas)",
        code: "CRISTALIZACION_MASA",
        processType: "BATCH",
      },
    ];

    for (const p of processList) {
      this.processes.set(p.id, p);
    }

    // 6. EQUIPMENTS & TOPOLOGICAL FLOW GRAPH (Upstream -> Downstream)
    const eqBascula: Isa95Equipment = {
      id: "EQ_BASCULA_01",
      processId: "PROC_PESAJE_BATEY",
      name: "Báscula Camiones Batey Entrada",
      code: "BASCULA_01",
      equipmentType: "SCALE",
      criticality: "B_ESSENTIAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: [],
      downstreamEquipmentIds: ["EQ_CONDUCTOR_CANA_01"],
    };

    const eqConductor: Isa95Equipment = {
      id: "EQ_CONDUCTOR_CANA_01",
      processId: "PROC_PESAJE_BATEY",
      name: "Conductor Principal de Caña Entera a Molinos",
      code: "COND_CANA_01",
      equipmentType: "MILL",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_BASCULA_01"],
      downstreamEquipmentIds: ["EQ_PICADORA_01"],
    };

    const eqPicadora: Isa95Equipment = {
      id: "EQ_PICADORA_01",
      processId: "PROC_EXTRACCION_JUGO",
      name: "Picadora de Caña Primaria 1200 RPM",
      code: "PICADORA_01",
      equipmentType: "MILL",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_CONDUCTOR_CANA_01"],
      downstreamEquipmentIds: ["EQ_MOLINO_01"],
    };

    const eqMolino1: Isa95Equipment = {
      id: "EQ_MOLINO_01",
      processId: "PROC_EXTRACCION_JUGO",
      name: "Molino de Caña #1 (Extracción Primaria)",
      code: "MOLINO_01",
      equipmentType: "MILL",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_PICADORA_01"],
      downstreamEquipmentIds: ["EQ_CALDERA_01"], // Envia bagazo a calderas
    };

    const eqCaldera1: Isa95Equipment = {
      id: "EQ_CALDERA_01",
      processId: "PROC_GENERACION_VAPOR",
      name: "Caldera Bagacera Acuotubular #1 (120 t/h @ 45 bar)",
      code: "CALDERA_01",
      equipmentType: "BOILER",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_MOLINO_01"], // Recibe bagazo
      downstreamEquipmentIds: ["EQ_TURBINA_TG01"], // Entrega vapor de 45 bar
    };

    const eqTurbina1: Isa95Equipment = {
      id: "EQ_TURBINA_TG01",
      processId: "PROC_GENERACION_ELECTRICA",
      name: "Turbogenerador de Vapor TG1 (25 MW Contrapresión)",
      code: "TURBINA_TG1",
      equipmentType: "TURBINE",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_CALDERA_01"],
      downstreamEquipmentIds: ["EQ_EVAPORADOR_01"], // Entrega vapor de escape (1.8 bar)
    };

    const eqEvaporador1: Isa95Equipment = {
      id: "EQ_EVAPORADOR_01",
      processId: "PROC_CONCENTRACION_JUGO",
      name: "Evaporador Primer Efecto (Calandria 3,000 m2)",
      code: "EVAP_EFECTO_1",
      equipmentType: "EVAPORATOR",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_TURBINA_TG01"], // Recibe vapor escape
      downstreamEquipmentIds: ["EQ_TACHO_01"], // Entrega meladura concentrada
    };

    const eqTacho1: Isa95Equipment = {
      id: "EQ_TACHO_01",
      processId: "PROC_CRISTALIZACION_AZUCAR",
      name: "Tacho al Vacío #1 (Masa A - 65 m3)",
      code: "TACHO_VACIO_01",
      equipmentType: "VACUUM_PAN",
      criticality: "A_CRITICAL",
      operationalStatus: "RUNNING",
      upstreamEquipmentIds: ["EQ_EVAPORADOR_01"], // Recibe meladura
      downstreamEquipmentIds: [],
    };

    const equipments = [
      eqBascula,
      eqConductor,
      eqPicadora,
      eqMolino1,
      eqCaldera1,
      eqTurbina1,
      eqEvaporador1,
      eqTacho1,
    ];

    for (const eq of equipments) {
      this.equipments.set(eq.id, eq);
      this.equipmentToProcess.set(eq.id, eq.processId);
    }

    // 7. DEVICES (PLCs / Controllers)
    const devList: Isa95Device[] = [
      {
        id: "DEV_IND780_BASCULA",
        equipmentId: eqBascula.id,
        name: "Terminal Báscula Mettler Toledo IND780",
        deviceType: "GATEWAY",
        protocol: "MODBUS_TCP",
        ipAddress: "192.168.10.21",
      },
      {
        id: "DEV_PLC_MOLIENDA",
        equipmentId: eqMolino1.id,
        name: "PLC Rockwell ControlLogix 5580 Molienda",
        deviceType: "PLC",
        protocol: "OPC_UA",
        ipAddress: "192.168.10.51",
      },
      {
        id: "DEV_PLC_CALDERA_01",
        equipmentId: eqCaldera1.id,
        name: "PLC Siemens S7-1500 Failsafe Caldera 1",
        deviceType: "PLC",
        protocol: "OPC_UA",
        ipAddress: "192.168.10.61",
      },
      {
        id: "DEV_PLC_TURBOGENERACION",
        equipmentId: eqTurbina1.id,
        name: "Controlador Woodward MicroNet Plus TG1",
        deviceType: "PLC",
        protocol: "MODBUS_TCP",
        ipAddress: "192.168.10.71",
      },
      {
        id: "DEV_EROS_DCS_EVAP",
        equipmentId: eqEvaporador1.id,
        name: "Controlador EROS DCS Tren de Evaporación",
        deviceType: "DCS_NODE",
        protocol: "EROS",
        ipAddress: "192.168.10.81",
      },
      {
        id: "DEV_EROS_DCS_PAN1",
        equipmentId: eqTacho1.id,
        name: "Controlador EROS DCS Tacho al Vacío 1",
        deviceType: "DCS_NODE",
        protocol: "EROS",
        ipAddress: "192.168.10.82",
      },
    ];

    for (const d of devList) {
      this.devices.set(d.id, d);
      const existing = this.equipmentToDevice.get(d.equipmentId) || [];
      existing.push(d.id);
      this.equipmentToDevice.set(d.equipmentId, existing);
    }

    // Default Tag to Equipment and Address links
    this.linkTagToEquipment("tag-milling-tch", eqMolino1.id, "ns=2;s=Milling.Tandem.TCH_Actual");
    this.linkTagToEquipment("tag-boiler1-steam-pressure", eqCaldera1.id, "ns=2;s=Boiler1.Main_Steam_Pressure");
    this.linkTagToEquipment("tag-weighbridge-gross-weight", eqBascula.id, "holding:40001:FLOAT32");
    this.linkTagToEquipment("tag-eros-pan1-vacuum", eqTacho1.id, "EROS:PAN1:LOOP_VACUUM:PV");
    this.linkTagToEquipment("tag-eros-pan1-brix", eqTacho1.id, "EROS:PAN1:BRIX_REFRACTOMETER:PV");
    this.linkTagToEquipment("tag-eros-evap4-brix-syrup", eqEvaporador1.id, "EROS:EVAP:EFFECT4_SYRUP_BRIX:PV");
  }
}
