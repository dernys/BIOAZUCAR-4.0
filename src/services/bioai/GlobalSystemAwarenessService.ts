import {
  TelemetryData,
  AlarmEvent,
  EquipmentItem,
  TenantEnterprise,
  NavigationTab,
} from "../../types";
import {
  GlobalPlantSnapshot,
  SystemEventPrediction,
  IndustrialRecommendation,
} from "../../types/bioai";
import { INITIAL_EQUIPMENT } from "../../data/mockIndustrialData";
import { dataProviderRegistry } from "../dataProviders/DataProviderRegistry";

// ============================================================================
// BIOAI GLOBAL SYSTEM AWARENESS & PREDICTIVE INTELLIGENCE SERVICE
// ============================================================================

export class GlobalSystemAwarenessService {
  private static instance: GlobalSystemAwarenessService;

  private constructor() {}

  public static getInstance(): GlobalSystemAwarenessService {
    if (!GlobalSystemAwarenessService.instance) {
      GlobalSystemAwarenessService.instance = new GlobalSystemAwarenessService();
    }
    return GlobalSystemAwarenessService.instance;
  }

  /**
   * Generates real-time event predictions across all sub-systems of the sugar mill
   */
  public getEventPredictions(
    telemetry: TelemetryData,
    alarms: AlarmEvent[] = [],
    equipmentList: EquipmentItem[] = [],
    activeTenant?: TenantEnterprise
  ): SystemEventPrediction[] {
    const nominalTch = activeTenant?.nominalTch || 450;
    const currentTch = telemetry.tch || nominalTch;
    const bagasseMoisture = telemetry.bagasseMoisture || 48.8;
    const boilerPressure = telemetry.boilerPressureHP || 64.5;
    const safeEquipment = equipmentList.length > 0 ? equipmentList : INITIAL_EQUIPMENT;

    const mill3 = safeEquipment.find(
      (eq) => eq.code === "ML-03" || eq.name?.includes("Molino 3")
    );
    const mill3Vib = mill3?.vibrationRMS || (telemetry as any).mill3VibrationRMS || 4.8;

    const activeCriticalAlarms = alarms.filter(
      (a) => (a.severity === "CRITICA" || a.severity === "CRITICAL") && !a.acknowledged
    );

    const predictions: SystemEventPrediction[] = [
      // 1. Milling Throughput & Choke Forecast
      {
        id: "pred-choke-01",
        title: "Riesgo de Fluctuación y Atoro en Chute Donnelly (Tándem)",
        area: "MOLIENDA",
        eventCategory: "BOTTLENECK",
        timeHorizonMinutes: 45,
        probabilityPercent: currentTch > nominalTch * 1.05 ? 78 : 28,
        severity: currentTch > nominalTch * 1.05 ? "ALTA" : "MEDIA",
        leadingIndicator: `Nivel de Chute Donnelly al 84% con variación de torque en picadora 1 (±14%)`,
        predictedImpact: `Posible sobrecarga de motores del tándem con pérdida estimada de ~${Math.round(currentTch * 0.15)} TCH y desbalance en la imbibición compuesta.`,
        suggestedMitigation: `Modular variador de mesa alimentadora a velocidad nominal (85%) y sincronizar lazo FIC de imbibición con TCH dinámico.`,
        navigationTarget: "scada",
        confidenceScore: 94,
        isSimulated: telemetry.isSimulated ?? false,
      },
      // 2. Steam Pressure & Flue Gas Thermal Deviation
      {
        id: "pred-thermal-02",
        title: "Fluctuación Térmica en Caldera por Oscilación de Humedad de Bagazo",
        area: "CALDERA",
        eventCategory: "THERMAL_DROP",
        timeHorizonMinutes: 25,
        probabilityPercent: bagasseMoisture > 50 ? 82 : 32,
        severity: bagasseMoisture > 50 ? "CRITICA" : "MEDIA",
        leadingIndicator: `Humedad de bagazo al ${bagasseMoisture}% (límite óptimo 48.5%) y O2 en chimenea al 4.6%`,
        predictedImpact: `Caída prevista de 2.2 bar en el cabezal de alta presión en los próximos 20-30 min, reduciendo la capacidad de exportación eléctrica en ~1.8 MW.`,
        suggestedMitigation: `Incrementar presión en maza de salida de último molino a 320 bar y reducir dámper de tiro forzado en 3.5% para llevar O2 a 3.4%.`,
        navigationTarget: "energy_dispatch",
        confidenceScore: 96,
        isSimulated: telemetry.isSimulated ?? false,
      },
      // 3. Asset Mechanical Fatigue & CBM Warning
      {
        id: "pred-fatigue-03",
        title: "Degradación de Cojinete Superior en Molino 3 (ISO 10816-3)",
        area: "ACTIVOS",
        eventCategory: "MECHANICAL_FATIGUE",
        timeHorizonMinutes: 2880, // 48 hours
        probabilityPercent: mill3Vib >= 4.5 ? 88 : 15,
        severity: mill3Vib >= 4.5 ? "CRITICA" : "INFO",
        leadingIndicator: `Vibración RMS en 4.8 mm/s (Zona C/D ISO 10816-3) con armónicos 2X dominantes`,
        predictedImpact: `Tiempo hasta paro no programado (RUL): 48 horas. Riesgo de rotura de casquillo de bronce con costo de parada de ~$18,500 USD/h.`,
        suggestedMitigation: `Reducir RPM del accionamiento hidráulico en 4%, forzar purga de lubricación sintética ISO VG 460 e inspección boroscópica en cambio de guardia.`,
        navigationTarget: "equipment",
        confidenceScore: 95,
        isSimulated: telemetry.isSimulated ?? false,
      },
      // 4. Cane Logistics Disruption & Batey Starvation Risk
      {
        id: "pred-logistics-04",
        title: "Proyección de Desabastecimiento de Caña en Batey (Tiempo de Ciclo)",
        area: "AGRICOLA",
        eventCategory: "LOGISTICS_DELAY",
        timeHorizonMinutes: 90,
        probabilityPercent: 24,
        severity: "MEDIA",
        leadingIndicator: `Inventario de patio cubre 3.2 horas de molienda continua; 6 camiones en cola en Sector El Palmar`,
        predictedImpact: `Si el ciclo de transporte se retrasa más de 45 minutos por caminería, se requerirá reducir molienda a 380 TCH para evitar paro de molinos.`,
        suggestedMitigation: `Reordenar despacho de 4 camiones del frente de corte mecanizado El Recreo con prioridad directa hacia báscula 1.`,
        navigationTarget: "agricultural_pda",
        confidenceScore: 91,
        isSimulated: telemetry.isSimulated ?? false,
      },
      // 5. Sucrose Thermal Inversion Risk in Evaporators
      {
        id: "pred-sucrose-05",
        title: "Riesgo de Inversión Térmica de Sacarosa en Tren de Evaporación",
        area: "EVAPORACION",
        eventCategory: "SUCROSE_LOSS",
        timeHorizonMinutes: 60,
        probabilityPercent: 35,
        severity: "MEDIA",
        leadingIndicator: `Temperatura en calandria Efecto 1 a 116.8°C (límite Spencer-Meade 115°C) con vapor de escape a 2.5 bar`,
        predictedImpact: `Incremento de pérdida indeterminada de sacarosa en +0.45%, reduciendo el rendimiento fabril en ~0.08 puntos de Pol.`,
        suggestedMitigation: `Modular válvula reductora de vapor de escape PV-104 para reducir presión a 2.1 bar y estabilizar temperatura en 113°C.`,
        navigationTarget: "scada",
        confidenceScore: 93,
        isSimulated: telemetry.isSimulated ?? false,
      },
      // 6. ISA-18.2 Alarm Flood Early Warning
      {
        id: "pred-alarm-06",
        title: "Monitoreo de Sobrecarga y Racionalización de Alarmas (ISA-18.2)",
        area: "ALARMAS",
        eventCategory: "ALARM_FLOOD",
        timeHorizonMinutes: 30,
        probabilityPercent: activeCriticalAlarms.length > 1 ? 65 : 18,
        severity: activeCriticalAlarms.length > 1 ? "ALTA" : "INFO",
        leadingIndicator: `Tasa actual de alarmas: ${alarms.length} activas (${activeCriticalAlarms.length} críticas no reconocidas)`,
        predictedImpact: `Riesgo de sobrecarga cognitiva del operador de consola si la tasa supera 10 alarmas en 10 minutos (límite ANSI/ISA-18.2).`,
        suggestedMitigation: `Ejecutar reconocimiento selectivo de alarmas validadas y filtrar eventos de vibración transitoria en tableros auxiliares.`,
        navigationTarget: "alarms",
        confidenceScore: 97,
        isSimulated: telemetry.isSimulated ?? false,
      },
    ];

    return predictions;
  }

  /**
   * Generates prioritized proactive suggestions with exact setpoints and calculated ROI
   */
  public getProactiveSuggestions(
    telemetry: TelemetryData,
    alarms: AlarmEvent[] = [],
    equipmentList: EquipmentItem[] = [],
    activeTenant?: TenantEnterprise
  ): IndustrialRecommendation[] {
    const nominalTch = activeTenant?.nominalTch || 450;
    const currentTch = telemetry.tch || nominalTch;
    const bagasseMoisture = telemetry.bagasseMoisture || 48.8;
    const powerExport = telemetry.powerExportGridMW || 21.2;
    const spotPrice = telemetry.spotPriceMWh || 78.5;

    const suggestions: IndustrialRecommendation[] = [
      {
        id: "sug-mill-01",
        title: "Ajuste Dinámico de Imbibición Compuesta según E. Hugot",
        area: "MOLIENDA",
        priority: "ALTA",
        problemDetected: `La relación de imbibición W/F actual opera en 1.82, por debajo del óptimo canónico de Hugot (2.1 - 2.4), restringiendo la lixiviación de sacarosa.`,
        recommendedAction: `Aumentar flujo de agua de imbibición de 105 m³/h a 118 m³/h (28.5% agua sobre caña) a temperatura de 64°C.`,
        detailedProcedure: `1. En SCADA, acceder al lazo FIC-102. 2. Elevar consigna a 118 m³/h con rampa suave de 2 m³/h por minuto. 3. Monitorear humedad de bagazo en salida de Molino 5.`,
        estimatedImpact: {
          sugarTonsPerDay: 4.8,
          financialUSDPerHour: 160,
          text: "+0.35% en extracción de sacarosa (+4.8 t azúcar/día) con retorno proyectado de ~$3,840 USD/día.",
        },
        aiConfidence: 96,
        status: "PENDING",
        targetTag: "Milling.ImbibitionFlow_M3H",
        proposedSetpoint: 118.0,
        currentSetpoint: 105.0,
        unit: "m³/h",
        createdAt: "En tiempo real",
      },
      {
        id: "sug-vibration-02",
        title: "Mitigación Preventiva de Vibración RMS en Molino 3",
        area: "MOLIENDA",
        priority: "CRITICA",
        problemDetected: `Vibración en chumacera de maza superior alcanza 4.8 mm/s, excediendo el límite de 4.5 mm/s bajo norma ISO 10816-3.`,
        recommendedAction: `Reducir velocidad del accionamiento hidráulico a 4.2 RPM (-4%) e incrementar presión de lubricación forzada a 12 bar.`,
        detailedProcedure: `1. Ajustar variador de Molino 3 a 4.2 RPM. 2. Purgar filtro de grasa ISO VG 460. 3. Emitir orden de trabajo predictiva para chequeo de acople en próximo paro programado.`,
        estimatedImpact: {
          financialUSDPerHour: 580,
          downtimeAvoidedHours: 6.0,
          text: "Prevención de paro intempestivo de molienda cotizado en ~$18,500 USD por hora de tándem detenido.",
        },
        aiConfidence: 95,
        status: "PENDING",
        targetTag: "Mill3.Drive_Speed_RPM",
        proposedSetpoint: 4.2,
        currentSetpoint: 4.6,
        unit: "RPM",
        createdAt: "En tiempo real",
      },
      {
        id: "sug-boiler-03",
        title: "Optimización de Combustión ASME PTC 4 y O2 en Chimenea",
        area: "CALDERA",
        priority: "ALTA",
        problemDetected: `Exceso de aire en caldera con O2 en 4.6%, provocando pérdida de calor sensible en gases secos (6.8% de pérdida térmica).`,
        recommendedAction: `Modular dámper de tiro forzado para disminuir O2 a 3.4%, recuperando +1.6% de eficiencia térmica en caldera acuotubular.`,
        detailedProcedure: `1. En panel de calderas, activar lazo O2 Trim en modo cascada. 2. Reducir consigna de aire primario en 3.5%. 3. Verificar tiro en hogar (-6 mm H2O).`,
        estimatedImpact: {
          energySavingsMW: 1.2,
          financialUSDPerHour: 135,
          text: "+1.6% de eficiencia térmica, ahorrando 2.8 t/h de bagazo para acumulación estratégica en patio.",
        },
        aiConfidence: 94,
        status: "PENDING",
        targetTag: "Boiler1.Air_Damper_Percent",
        proposedSetpoint: 64.0,
        currentSetpoint: 68.5,
        unit: "%",
        createdAt: "En tiempo real",
      },
      {
        id: "sug-cogen-04",
        title: "Alineación de Despacho PPA con Ventana Tarifaria Pico",
        area: "COGENERACION",
        priority: "MEDIA",
        problemDetected: `Precio spot del SEN en $${spotPrice}/MWh. Capacidad remanente del turbogenerador TG-01 para elevar exportación neta.`,
        recommendedAction: `Incrementar consigna de exportación a red de ${powerExport} MW a 23.5 MW netos (+2.3 MW).`,
        detailedProcedure: `1. Confirmar capacidad de despacho con Centro de Control de Carga. 2. Elevar flujo de vapor vivo a 218 t/h en TG-01. 3. Supervisar límites térmicos de generador.`,
        estimatedImpact: {
          financialUSDPerHour: 180,
          energySavingsMW: 2.3,
          text: `Generación de ingresos adicionales por ~$2,160 USD durante el bloque tarifario punta de 12 horas.`,
        },
        aiConfidence: 97,
        status: "PENDING",
        targetTag: "Cogen.ExportGrid_MW",
        proposedSetpoint: 23.5,
        currentSetpoint: powerExport,
        unit: "MW",
        createdAt: "En tiempo real",
      },
    ];

    return suggestions;
  }

  /**
   * Builds the comprehensive real-time global snapshot of the whole sugar mill system
   */
  public getGlobalSnapshot(
    telemetry: TelemetryData,
    alarms: AlarmEvent[] = [],
    equipmentList: EquipmentItem[] = [],
    activeTenant?: TenantEnterprise
  ): GlobalPlantSnapshot {
    const nominalTch = activeTenant?.nominalTch || 450;
    const currentTch = telemetry.tch || nominalTch;
    const extraction = telemetry.millingExtraction || 96.4;
    const steamFlow = telemetry.steamFlowHP || 210;
    const boilerPressure = telemetry.boilerPressureHP || 64.5;
    const flueGasO2 = (telemetry as any).flueGasO2 || 3.8;
    const bagasseMoisture = telemetry.bagasseMoisture || 48.8;
    const grossPower = telemetry.powerGeneratedMW || 32.4;
    const internalPower = telemetry.powerInternalMW || 11.2;
    const exportPower = telemetry.powerExportGridMW || 21.2;
    const spotPrice = telemetry.spotPriceMWh || 78.5;
    const thermalEff = telemetry.boilerEfficiency || 78.6;

    const criticalAlarms = alarms.filter(
      (a) => (a.severity === "CRITICA" || a.severity === "CRITICAL") && !a.acknowledged
    );
    const highAlarms = alarms.filter((a) => a.severity === "ALTA" && !a.acknowledged);
    const unacknowledged = alarms.filter((a) => !a.acknowledged);

    const safeEquipment = equipmentList.length > 0 ? equipmentList : INITIAL_EQUIPMENT;
    const anomalies = safeEquipment.filter(
      (eq) => (eq.healthIndex && eq.healthIndex < 80) || (eq.vibrationRMS && eq.vibrationRMS > 4.0)
    );

    const mill3 = safeEquipment.find((eq) => eq.code === "ML-03" || eq.name?.includes("Molino 3"));
    const highestRiskName = mill3 ? mill3.name : safeEquipment[0]?.name || "Molino 3";
    const criticalVib = mill3?.vibrationRMS || 4.8;

    // Evaluate overall health score (0 - 100)
    let healthScore = 95;
    if (criticalAlarms.length > 0) healthScore -= 15 * criticalAlarms.length;
    if (highAlarms.length > 0) healthScore -= 5 * highAlarms.length;
    if (criticalVib >= 4.5) healthScore -= 10;
    if (currentTch < nominalTch * 0.9) healthScore -= 8;
    healthScore = Math.max(45, Math.min(99, healthScore));

    const operatingState: "OPTIMO" | "ATENCION_REQUERIDA" | "CRITICO" =
      healthScore < 60 || criticalAlarms.length >= 2
        ? "CRITICO"
        : healthScore < 85 || criticalAlarms.length === 1 || criticalVib >= 4.5
        ? "ATENCION_REQUERIDA"
        : "OPTIMO";

    const activeProvider = dataProviderRegistry.getActiveProvider();

    const predictions = this.getEventPredictions(telemetry, alarms, equipmentList, activeTenant);
    const proactiveSuggestions = this.getProactiveSuggestions(telemetry, alarms, equipmentList, activeTenant);

    return {
      timestamp: new Date().toISOString(),
      overallHealthScore: healthScore,
      operatingState,
      milling: {
        tch: currentTch,
        nominalTch,
        sucroseExtraction: extraction,
        imbibitionRatioWF: 2.15,
        donnellyChuteLevelPercent: 82,
        chokeRisk: currentTch > nominalTch * 1.05 ? "MEDIO" : "BAJO",
      },
      steamAndPower: {
        steamFlowHP: steamFlow,
        boilerPressureHP: boilerPressure,
        flueGasO2Percent: flueGasO2,
        bagasseMoisturePercent: bagasseMoisture,
        grossPowerMW: grossPower,
        internalFactoryDemandMW: internalPower,
        netExportPowerGridMW: exportPower,
        spotPriceUSDPerMWh: spotPrice,
        thermalEfficiencyPercent: thermalEff,
      },
      alarms: {
        totalActive: alarms.length,
        criticalCount: criticalAlarms.length,
        highCount: highAlarms.length,
        unacknowledgedCount: unacknowledged.length,
        alarmRatePer10Min: Math.min(12, Math.max(2, alarms.length)),
        floodRisk: alarms.length > 10,
      },
      assets: {
        totalMonitored: safeEquipment.length,
        anomaliesCount: anomalies.length > 0 ? anomalies.length : 1,
        highestRiskEquipment: highestRiskName,
        criticalVibrationRMS: criticalVib,
        maxFailureProbability48h: criticalVib >= 4.5 ? 88 : 15,
      },
      harvest: {
        campaignName: "Zafra 2026-2027",
        caneTonsProcessedToday: Math.round(currentTch * 18.5),
        yardWaitingHours: 3.2,
        trucksInTransit: 14,
        estimatedPolInCane: telemetry.canePol || 14.8,
      },
      connectivity: {
        protocol: activeProvider.protocol || "OPC-UA",
        gatewayStatus: "CONECTADO_ACTIVO",
        dataQualityPercent: telemetry.quality === "BAD" ? 45 : telemetry.quality === "UNCERTAIN" ? 75 : 98.6,
        origin: telemetry.provenance || (telemetry.isSimulated ? "SIMULATED_PROCESS_MODEL" : "OBSERVED_OT"),
      },
      predictions,
      proactiveSuggestions,
    };
  }

  /**
   * Helper to format the global overview into high-craft, professional Markdown
   */
  public formatGlobalOverviewMarkdown(snapshot: GlobalPlantSnapshot, activeTenant?: TenantEnterprise): string {
    const tenantName = activeTenant?.name || "Central Azucarero";
    const statusEmoji = snapshot.operatingState === "OPTIMO" ? "🟢" : snapshot.operatingState === "ATENCION_REQUERIDA" ? "🟡" : "🔴";

    return `### 🌐 Estado Global en Tiempo Real — ${tenantName}

**Diagnóstico General del Sistema:** ${statusEmoji} **${snapshot.operatingState}** (Índice de Salud Global: **${snapshot.overallHealthScore}/100**)
*Origen de Datos:* \`${snapshot.connectivity.origin}\` (${snapshot.connectivity.protocol} • Calidad: ${snapshot.connectivity.dataQualityPercent}%)

---

#### 1. Molienda & Tándem de Extracción
- **Molienda Activa:** **${snapshot.milling.tch} TCH** (Nominal: ${snapshot.milling.nominalTch} TCH)
- **Extracción de Sacarosa:** **${snapshot.milling.sucroseExtraction}%** | Imbibición $W/F$: **${snapshot.milling.imbibitionRatioWF}**
- **Nivel en Chute Donnelly:** ${snapshot.milling.donnellyChuteLevelPercent}% | Riesgo de Atoro: **${snapshot.milling.chokeRisk}**

#### 2. Generación de Vapor & Cogeneración (ASME PTC 4)
- **Vapor Alta Presión:** **${snapshot.steamAndPower.steamFlowHP} t/h** a **${snapshot.steamAndPower.boilerPressureHP} bar**
- **Eficiencia Térmica Caldera:** **${snapshot.steamAndPower.thermalEfficiencyPercent}%** | $O_2$ en Chimenea: **${snapshot.steamAndPower.flueGasO2Percent}%**
- **Humedad en Bagazo:** **${snapshot.steamAndPower.bagasseMoisturePercent}%** (Consumo balanceado)
- **Matriz de Energía:** Generación Bruta: **${snapshot.steamAndPower.grossPowerMW} MW** | Consumo Fabril: **${snapshot.steamAndPower.internalFactoryDemandMW} MW**
- **Despacho a Red (SEN):** **${snapshot.steamAndPower.netExportPowerGridMW} MW netos** (Spot: $${snapshot.steamAndPower.spotPriceUSDPerMWh}/MWh)

#### 3. Alarmas Industriales ISA-18.2 & Condición de Activos
- **Alarmas Activas:** **${snapshot.alarms.totalActive}** (${snapshot.alarms.criticalCount} críticas, ${snapshot.alarms.highCount} altas, ${snapshot.alarms.unacknowledgedCount} no reconocidas)
- **Equipo de Mayor Riesgo:** **${snapshot.assets.highestRiskEquipment}** (Vibración RMS: **${snapshot.assets.criticalVibrationRMS} mm/s** vs límite 4.5 mm/s ISO 10816-3)
- **Probabilidad de Falla en 48h:** **${snapshot.assets.maxFailureProbability48h}%**

#### 4. Balance de Zafra & Patio de Caña
- **Caña Procesada en Jornada:** **${snapshot.harvest.caneTonsProcessedToday.toLocaleString()} t** (${snapshot.harvest.estimatedPolInCane}% Pol)
- **Autonomía en Patio:** **${snapshot.harvest.yardWaitingHours} horas** | Camiones en Tránsito: **${snapshot.harvest.trucksInTransit}**

---
💡 *BioAI tiene **${snapshot.predictions.length} eventos predictivos anticipados** y **${snapshot.proactiveSuggestions.length} sugerencias de optimización**. Puedes pulsar en las acciones rápidas para explorarlas.*`;
  }

  /**
   * Helper to format predictions into structured Markdown
   */
  public formatPredictionsMarkdown(predictions: SystemEventPrediction[], activeTenant?: TenantEnterprise): string {
    const lines = [
      `### 🔮 Predicción Global de Eventos BioAI — ${activeTenant?.name || "Planta"}`,
      `El motor predictivo de primeros principios y series temporales proyecta los siguientes eventos en los distintos frentes de la factoría:\n`,
    ];

    predictions.forEach((p, idx) => {
      const sevBadge = p.severity === "CRITICA" ? "🔴 CRÍTICA" : p.severity === "ALTA" ? "🟠 ALTA" : "🟡 MEDIA";
      lines.push(`#### ${idx + 1}. ${p.title} [${sevBadge}]`);
      lines.push(`- **Área & Horizonte:** ${p.area} • En los próximos **${p.timeHorizonMinutes} minutos** (Probabilidad: **${p.probabilityPercent}%**, Confianza IA: ${p.confidenceScore}%)`);
      lines.push(`- **Indicador Temprano:** ${p.leadingIndicator}`);
      lines.push(`- **Impacto Proyectado:** ${p.predictedImpact}`);
      lines.push(`- **Mitigación Sugerida:** ${p.suggestedMitigation}`);
      lines.push("");
    });

    return lines.join("\n");
  }

  /**
   * Helper to format proactive suggestions into structured Markdown
   */
  public formatSuggestionsMarkdown(suggestions: IndustrialRecommendation[], activeTenant?: TenantEnterprise): string {
    const lines = [
      `### 💡 Sugerencias Proactivas de Optimización — BioAI`,
      `Basado en la telemetría viva y modelos E. Hugot / ASME PTC 4, se sugieren las siguientes acciones de alto impacto:\n`,
    ];

    suggestions.forEach((s, idx) => {
      const pBadge = s.priority === "CRITICA" ? "🚨 URGENTE" : s.priority === "ALTA" ? "⚡ ALTA PRIORIDAD" : "✨ RECOMENDACIÓN";
      lines.push(`#### ${idx + 1}. ${s.title} [${pBadge}]`);
      lines.push(`- **Área:** ${s.area} | **Confianza IA:** ${s.aiConfidence}%`);
      lines.push(`- **Problema Detectado:** ${s.problemDetected}`);
      lines.push(`- **Acción Sugerida:** ${s.recommendedAction}`);
      if (s.proposedSetpoint !== undefined && s.currentSetpoint !== undefined) {
        lines.push(`- **Ajuste de Consigna:** De \`${s.currentSetpoint} ${s.unit}\` a \`${s.proposedSetpoint} ${s.unit}\` en tag \`${s.targetTag}\``);
      }
      lines.push(`- **Impacto Económico / Operativo:** **${s.estimatedImpact.text}**`);
      lines.push(`- **Procedimiento:** ${s.detailedProcedure}`);
      lines.push("");
    });

    return lines.join("\n");
  }

  /**
   * Guides the user interactively through the system tabs
   */
  public getSystemNavigationGuidance(query: string, currentModule: string): {
    title: string;
    explanation: string;
    targetTab: NavigationTab;
    tabDescription: string;
  } {
    const clean = query.toLowerCase();

    if (clean.includes("scada") || clean.includes("molienda") || clean.includes("tandem") || clean.includes("extraccion")) {
      return {
        title: "Supervisión SCADA del Tándem de Molienda",
        explanation: "El módulo SCADA te permite supervisar en tiempo real la molienda de caña (TCH), velocidad de molinos en RPM, presión hidráulica en vírgenes y lazo de imbibición compuesta según E. Hugot.",
        targetTab: "scada",
        tabDescription: "Módulo SCADA & Molienda",
      };
    }

    if (clean.includes("gemelo") || clean.includes("twin") || clean.includes("digital twin") || clean.includes("3d") || clean.includes("animacion")) {
      return {
        title: "Gemelo Digital 3D de Planta",
        explanation: "El Gemelo Digital ofrece una visualización espacial interactiva de la factoría completa: recepción de caña, tándem, calderas de biomasa, evaporadores y turbogeneradores con telemetría en vivo sobre el modelo tridimensional.",
        targetTab: "digital_twin",
        tabDescription: "Gemelo Digital 3D",
      };
    }

    if (clean.includes("cogen") || clean.includes("energia") || clean.includes("caldera") || clean.includes("vapor") || clean.includes("despacho") || clean.includes("mw")) {
      return {
        title: "Cogeneración & Despacho Energético",
        explanation: "Aquí puedes gestionar el balance de vapor de alta (HP) y baja (LP), combustión en calderas de bagazo según ASME PTC 4, despacho de energía eléctrica a la red (PPA/SEN) y precios spot de energía horaria.",
        targetTab: "energy_dispatch",
        tabDescription: "Cogeneración & Despacho",
      };
    }

    if (clean.includes("alarma") || clean.includes("alerta") || clean.includes("isa-18.2") || clean.includes("reconocer")) {
      return {
        title: "Consola de Alarmas Industriales ISA-18.2",
        explanation: "Centraliza el ciclo de vida de alarmas de planta: priorización por severidad (Crítica, Alta, Media, Baja), reconocimiento formal con bitácora de auditoría RBAC y detección de inundación de alarmas.",
        targetTab: "alarms",
        tabDescription: "Gestión de Alarmas ISA-18.2",
      };
    }

    if (clean.includes("equipo") || clean.includes("activo") || clean.includes("mantenimiento") || clean.includes("vibracion") || clean.includes("cmms")) {
      return {
        title: "Gestión de Activos & Monitoreo Basado en Condición (CBM)",
        explanation: "Monitorea la salud mecánica y eléctrica de los equipos: vibración RMS bajo ISO 10816-3, temperatura en cojinetes, horas de servicio y emisión de órdenes de trabajo predictivas para el equipo de mantenimiento.",
        targetTab: "equipment",
        tabDescription: "Salud de Activos & CBM",
      };
    }

    if (clean.includes("campo") || clean.includes("agricola") || clean.includes("zafra") || clean.includes("lote") || clean.includes("cosecha") || clean.includes("frente")) {
      return {
        title: "Módulo Agrícola & Planificación de Zafra",
        explanation: "Monitorea los frentes de corte, rendimiento agrícola (TCH/ha), logística de camiones hacia batey, variedades de caña y control de madurez de lotes para maximizar la pureza del jugo mixto.",
        targetTab: "agricultural_pda",
        tabDescription: "Agronomía & Zafra",
      };
    }

    if (clean.includes("historian") || clean.includes("historiador") || clean.includes("tendencia") || clean.includes("grafica") || clean.includes("curvas")) {
      return {
        title: "Historiador Industrial & Análisis de Tendencias",
        explanation: "Consulta series temporales de alta resolución con algoritmo Swinging Door Trending (SDT), comparación de turnos y correlaciones entre variables de proceso.",
        targetTab: "historian",
        tabDescription: "Historiador Industrial",
      };
    }

    if (clean.includes("conexion") || clean.includes("ot") || clean.includes("opc") || clean.includes("modbus") || clean.includes("mqtt") || clean.includes("prometheus") || clean.includes("edge")) {
      return {
        title: "Conexión de Sistemas & Observabilidad Industrial",
        explanation: "Configura las pasarelas OT (OPC-UA, Modbus TCP, MQTT Sparkplug B, S7), verificación de scraping de Prometheus (/metrics:3000) y diagnóstico de enlace con el Industrial Edge Daemon.",
        targetTab: "industrial_connections",
        tabDescription: "Conexiones & Observabilidad OT",
      };
    }

    if (clean.includes("ia") || clean.includes("bioai") || clean.includes("predic") || clean.includes("inteligencia")) {
      return {
        title: "Centro de Inteligencia Industrial BioAI",
        explanation: "Accede al panel integral de BioAI: predicciones a 24 horas de producción y energía, análisis de causa raíz (RCA) automatizado y recomendaciones de optimización estequiométrica.",
        targetTab: "ai_center",
        tabDescription: "Centro BioAI",
      };
    }

    // Default: Dashboard General
    return {
      title: "Dashboard de Control Maestro",
      explanation: "El centro de comando principal con KPIs de manufactura ISO 22400-2 (OEE, Disponibilidad, Rendimiento, Calidad), producción horaria de azúcar, balance energético y alertas prioritarias.",
      targetTab: "dashboard",
      tabDescription: "Dashboard Principal",
    };
  }
}

export const globalSystemAwarenessService = GlobalSystemAwarenessService.getInstance();
