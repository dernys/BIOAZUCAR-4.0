# BIOAZÚCAR 4.0: ESTÁNDAR PERMANENTE DE EVIDENCIA Y AUDITORÍA E2E
**Código Normativo:** BIOAZUCAR-STD-E2E-001  
**Revisión:** 2.0.0  
**Fecha de Emisión:** Marzo 2026  
**Autoridad:** Lead Software Architect, Industrial Systems Engineer & QA/E2E Auditor  
**Ámbito:** Repositorio Completo BioAzúcar 4.0 (Frontend, Backend, Servicios de Dominio, Reglas Firestore, BioAI)

---

## 1. PROPÓSITO Y PRINCIPIO RECTOR

> **"No existe evidencia = no existe funcionalidad demostrada."**  
> **"No optimices el resultado para que parezca que BioAzúcar está más avanzado. Optimízalo para que sea técnicamente verdadero."**

Este estándar establece las 12 reglas obligatorias y permanentes de auditoría técnica, trazabilidad y control de calidad de software industrial para BioAzúcar 4.0. Ninguna auditoría técnica, revisión de código o validación por IA podrá concluir que una funcionalidad existe o está integrada sin satisfacer los criterios de evidencia estipulados en este documento.

---

## 2. LAS 12 REGLAS PERMANENTES DE EVIDENCIA TÉCNICA

### REGLA 1: Tipo TypeScript ≠ Persistencia
- **Principio:** La presencia de una interfaz o tipo en `src/types.ts` o `src/types/agriculture.ts` demuestra únicamente un modelo de datos en memoria / tiempo de compilación.
- **Criterio de Aceptación:** Para considerar que una entidad persiste, se debe evidenciar:
  1. El nombre canónico de la colección Firestore correspondiente (e.g., `COLLECTIONS.CANE_BATCHES`, `AGRO_COLLECTIONS.PLOTS`).
  2. La regla de seguridad en `firestore.rules` que autoriza o restringe su lectura y escritura.
  3. Los métodos CRUD de persistencia en `AgriculturalPersistenceService.ts` o `dbService.ts`.
  4. La clave de almacenamiento en caché fuera de línea (`localStorage` / IndexedDB) para operaciones en contingencia.

### REGLA 2: Código Existente ≠ Flujo Conectado
- **Principio:** Disponer de métodos o módulos no prueba que formen parte de la cadena operacional E2E.
- **Criterio de Aceptación:** Se debe demostrar la propagación real de identificadores de trazabilidad en todo el ciclo de vida:
  $$\text{PDA (Plan ID)} \rightarrow \text{FieldPlot (plotId)} \rightarrow \text{AgroWorkRequirement (reqId)} \rightarrow \text{WorkOrder (woId)} \rightarrow \text{HarvestExecution} \rightarrow \text{Dispatch (dispatchId)} \rightarrow \text{Weighbridge (ticketId)} \rightarrow \text{CaneBatch (batchId)} \rightarrow \text{Yard} \rightarrow \text{Milling} \rightarrow \text{Process} \rightarrow \text{BioAI} \rightarrow \text{Feedback PDA}$$
  Ningún identificador clave puede ser reemplazado por `undefined`, `null` o cadenas genéricas sin advertencia de linaje.

### REGLA 3: Validador Declarado ≠ Validación Ejecutada
- **Principio:** Un servicio de validación (`AgronomicValidationService.ts`) que no sea invocado en los puntos críticos de mutación carece de efectividad operacional.
- **Criterio de Aceptación:** Toda mutación o transición de estado en `saveFieldPlot`, `saveAgroWorkRequirement`, `saveWorkOrder`, `dispatchHarvestPlotToFactory`, `updateCaneBatchInDb` y `updateWorkOrderInDb` debe ejecutar activamente el validador de ciclo de vida correspondiente y lanzar excepciones controladas ante transiciones inválidas.

### REGLA 4: Mock ≠ Producción / Real ≠ Simulado
- **Principio:** Prohibición absoluta de mezclar silenciosamente datos sintéticos/simulados con datos industriales reales de OT.
- **Criterio de Aceptación:** Todo dato relevante debe llevar clasificado explícitamente su origen conforme a la taxonomía canónica:
  - `REAL_OT`: Adquirido de instrumentación de campo, PLC, RTU, SCADA, balanzas electrónicas o LIMS.
  - `REAL_USER`: Ingresado manualmente por un operador autenticado con atribución RBAC.
  - `SIMULATED`: Generado por modelos dinámicos de proceso, Gemelo Digital o emuladores.
  - `CALCULATED`: Derivado por balance de masa, energía o algoritmos deterministas.
  - `DEFAULT`: Valor agronómico o de diseño cargado por configuración de catálogo.
  - `IMPORTED`: Ingestado de sistemas externos ERP, SIGA o archivos de intercambio.

### REGLA 5: Modelo Gemini Declarado ≠ Modelo Utilizado
- **Principio:** No se debe reportar o asumir el uso de un modelo de IA distinto del invocado en el código ejecutable.
- **Criterio de Aceptación:**
  - Se debe verificar la cadena exacta de modelo en `ai.models.generateContent({ model: "gemini-3.7-flash", ... })`.
  - Las respuestas de la API (`/api/bioai/*`) deben registrar explícitamente el campo `isAiGenerated: true` o `false` y `dataOrigin` para mantener la procedencia inalterada.

### REGLA 6: Multi-Tenancy Conceptual ≠ Aislamiento Probado
- **Principio:** Un campo `tenantId` en un objeto JSON no constituye aislamiento de seguridad si no está forzado a nivel de protocolo y almacenamiento.
- **Criterio de Aceptación:**
  - En backend: Middleware `requireTenantIsolation` y `requireResourceTenantOwnership` en `src/server/authMiddleware.ts` validan tokens y pertenencia a la empresa.
  - En base de datos: `firestore.rules` prohíbe explícitamente lecturas cruzadas entre inquilinos (`resource.data.tenantId == request.auth.token.tenantId`). Intentos de lectura entre tenants deben resultar en `DENIED`.

### REGLA 7: Estado Declarado ≠ Máquina de Estados Real
- **Principio:** Los estados de ciclo de vida no son campos de texto libre; obedecen a máquinas de estado finito (FSM) dirigidas y deterministas.
- **Criterio de Aceptación:**
  - `PlotStatus`: `PLANIFICADO` $\rightarrow$ `PREPARACION_SUELO` $\rightarrow$ `SIEMBRA` $\rightarrow$ `CRECIMIENTO_VEGETATIVO` $\rightarrow$ `MADURACION` $\rightarrow$ `ESTIMACION_RENDIMIENTO` $\rightarrow$ `PROGRAMADO_COSECHA` $\rightarrow$ `EN_CORTE` $\rightarrow$ `COSECHADO` $\rightarrow$ `SOCA_REBROTE`.
  - `CaneBatchStatus`: `RECEPCIONADO` $\rightarrow$ `EN_BASCULA` $\rightarrow$ `EN_PATIO` $\rightarrow$ `EN_MUESTREO` $\rightarrow$ `EN_MOLIENDA` $\rightarrow$ `PROCESADO` (o `RECHAZADO`).
  - Saltos ilícitos (ej. de `EN_PATIO` directamente a `PROCESADO` sin pasar por `EN_MOLIENDA`) deben ser rechazados por `AgronomicValidationService.validateCaneBatchLifecycleTransition`.

### REGLA 8: Cálculo Hipotético ≠ Resultado Comprobado
- **Principio:** Ecuaciones de ingeniería azucarera (fórmula de extracción de Hugot, pérdidas de Spencer-Meade, ASME PTC 4) deben operar sobre parámetros medidos o calculados con balance de masa cerrado.
- **Criterio de Aceptación:**
  - Ningún balance puede crear o destruir materia o energía. Las pérdidas en bagazo, cachaza, melaza final e indeterminadas deben sumar el 100% de la masa de pol ingresada.
  - Las pruebas unitarias o de integración deben validar los resultados contra rangos físicos de tolerancia estricta.

### REGLA 9: AI sin Contexto de Proveniencia = Riesgo Industrial Crítico
- **Principio:** El motor de IA BioAI no debe emitir diagnósticos de causa raíz (RCA) ni predicciones energéticas sin saber si los datos provienen de un Gemelo Digital o de una línea viva.
- **Criterio de Aceptación:**
  - El payload enviado a los endpoints de BioAI debe incluir `isSimulated` y `dataOrigin`.
  - Si los datos son simulados, el prompt y la respuesta deben indicar explícitamente que las conclusiones corresponden a un entorno de simulación / Gemelo Digital y no a eventos en tiempo real de planta física.

### REGLA 10: Control IEC 62443 ≠ Certificación Formal IEC 62443
- **Principio:** Prohibido declarar que el sistema cuenta con "certificación formal IEC 62443" a menos que haya sido auditado y certificado por un organismo acreditado internacionalmente (ej. TÜV Rheinland, ISA Secure).
- **Criterio de Aceptación:** Se utilizará siempre la denominación formal: *"Arquitectura con controles alineados con los principios de ciberseguridad industrial IEC 62443-3-3 e IEC 62443-4-2"* (segmentación en Zonas y Conductos, control de acceso basado en roles RBAC, no repudio con pista de auditoría inmutable en `audit_logs`).

### REGLA 11: Cierre de Ciclo Real vs PDA
- **Principio:** Un sistema de gestión agroindustrial inteligente debe retroalimentar la ejecución real de molienda y fábrica hacia el Plan de Desarrollo Agrícola (PDA).
- **Criterio de Aceptación:**
  - Existencia del tipo `ClosedLoopFeedbackSummary` y de los métodos `saveClosedLoopFeedback`, `getClosedLoopFeedback` y `applyClosedLoopFeedbackToCampaign` en `AgriculturalPersistenceService.ts`.
  - El tonelaje real procesado, el rendimiento industrial real y las desviaciones OPEX deben calcularse y guardarse para recalibrar los TCH nominales y costos de la zafra siguiente.

### REGLA 12: Determinismo en Auditoría y Testing E2E
- **Principio:** Una auditoría técnica se sustenta en pruebas ejecutables, reproducibles y deterministas, nunca en suposiciones heurísticas.
- **Criterio de Aceptación:**
  - La suite de pruebas E2E debe ejecutar cada eslabón de la cadena de forma determinista.
  - Debe verificar el rechazo formal de mutaciones inválidas y lecturas no autorizadas entre inquilinos.

---

## 3. MATRIZ DE TRAZABILIDAD DEL FLUJO E2E BIOAZÚCAR 4.0

| Paso | Etapa Operacional | Entidad de Dominio | Colección / Persistencia | Validación de Ciclo de Vida | Proveniencia del Dato |
|---|---|---|---|---|---|
| 1 | Master Data | `AgriculturalCampaign`, `AgriculturalParameter` | `agricultural_campaigns`, `agricultural_parameters` | `validateAgriculturalCampaign` | `DEFAULT` / `ERP` |
| 2 | PDA / Agricultural Plan | `FieldPlot`, `AgriculturalScenario` | `agricultural_plots`, `agricultural_scenarios` | `validateFieldPlot`, `validatePlotLifecycleTransition` | `REAL_USER` / `CALCULATED` |
| 3 | Work Requirement | `AgroWorkRequirement` | `agricultural_audit_trail` (metadata) / Cache | `validateAgroWorkRequirement` | `REAL_USER` |
| 4 | Resource Allocation | `AgriculturalEquipmentAsset`, `AgriculturalInputMaster` | `agricultural_equipment`, `agricultural_inputs` | `AgriculturalParameterRegistry` | `ERP` / `REAL_USER` |
| 5 | Work Order | `WorkOrder` | `work_orders` | `validateWorkOrderLifecycleTransition` | `REAL_USER` |
| 6 | Harvest Execution | `FieldPlot` (status `EN_CORTE`) | `agricultural_plots` | `validatePlotLifecycleTransition` | `REAL_OT` / `REAL_USER` |
| 7 | CCT & Transport | `FieldPlot` (dispatch), `truckPlate` | `agricultural_plots`, `cane_batches` | `dispatchHarvestPlotToFactory` | `REAL_USER` / `FIELD_MEASUREMENT` |
| 8 | Factory Reception | `CaneBatch` (status `RECEPCIONADO`) | `cane_batches` | `validateCaneBatchLifecycleTransition` | `REAL_OT` / `LIMS` |
| 9 | Weighing | `CaneBatch` (status `EN_BASCULA`) | `cane_batches` | `weighingProvenance: MEASURED_SCALE` | `REAL_OT` / `SCADA` |
| 10 | Cane Batch & Yard | `CaneBatch` (status `EN_PATIO`) | `cane_batches` | `validateCaneBatchLifecycleTransition` | `REAL_OT` / `CALCULATED` |
| 11 | Milling | `CaneBatch` (status `EN_MOLIENDA`), `TelemetryData` | `cane_batches`, `telemetry` | `validateCaneBatchLifecycleTransition` | `REAL_OT` / `SCADA` |
| 12 | Industrial Process | `TelemetryData` (Brix, Pol, pH, Flow) | `telemetry`, `HistorianService` | `IndustrialDataQualityGate` | `REAL_OT` / `SIMULATED` |
| 13 | Quality & LIMS | `CaneBatch` (`polPercent`, `purityPercent`, etc.) | `cane_batches`, `lims_samples` | `IndustrialDataQualityGate` | `LIMS` / `REAL_OT` |
| 14 | Energy & Cogeneration | `TelemetryData` (HP Steam, MW, Bagasse) | `telemetry`, Historian | ASME PTC 4 Mass Balance | `REAL_OT` / `CALCULATED` |
| 15 | Economics | OPEX, MWh Revenue, Sugar Ton Margin | `economics`, `telemetry` | Algoritmos de Margen Bruto | `CALCULATED` |
| 16 | BioAI Predictions | `ProductionPrediction`, `EnergyPrediction` | Cache / Server API | Provenance Guard: `isSimulated` | `CALCULATED` / `BioAI` |
| 17 | BioAI RCA | `RootCauseAnalysisResult` | Server API (`gemini-3.7-flash`) | Expert Rule Engine + Hugot/Spencer | `BioAI` (`gemini-3.7-flash`) |
| 18 | Decision & Execution | `WorkOrder` / Operational Setpoint | `work_orders`, `telemetry` | RBAC + Approval Workflow | `REAL_USER` |
| 19 | Closed Loop Feedback | `ClosedLoopFeedbackSummary` | `agricultural_audit_trail`, Cache | `saveClosedLoopFeedback` | `CALCULATED` / `REAL_OT` |
| 20 | PDA Recalibration | `AgriculturalCampaign` | `agricultural_campaigns` | `applyClosedLoopFeedbackToCampaign` | `CALCULATED` |

---

## 4. VIGENCIA Y ENFORCEMENT
Este estándar rige para todo commit, pull request, auditoría interna y desarrollo automatizado. Cualquier discrepancia entre la documentación y la implementación ejecutable constituye una no conformidad que debe ser subsanada de inmediato.
