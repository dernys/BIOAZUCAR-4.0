# BIOAZÚCAR 4.0 — PLAN MAESTRO DE IMPLEMENTACIÓN (MASTER IMPLEMENTATION PLAN)
**Arquitectura de Verdad de Datos Industrial, Gemelo Digital Agrícola y Motor de Contexto**
**Fecha de Emisión:** 2026-09-20  
**Versión:** 4.0.0-PROD-PLAN  
**Alcance:** Fases P0-00 a P0-25 con enfoque de despliegue progresivo y verificación matemática.

---

## ESTRUCTURA METODOLÓGICA DE FASES

Cada fase del Plan Maestro cumple rigurosamente con los 12 ejes mandatados:
1. **PHASE**: Identificador único de fase.
2. **OBJECTIVE**: Meta técnica e industrial verificable.
3. **FILES**: Archivos afectados, creados o refactorizados.
4. **SERVICES**: Servicios, motores y adaptadores involucrados.
5. **DATA CONTRACTS**: Esquemas de tipos y contratos canónicos.
6. **DEPENDENCIES**: Módulos y fases precedentes requeridas.
7. **IMPLEMENTATION**: Pasos de desarrollo y lógica industrial.
8. **TESTS**: Plan de pruebas automatizadas (unitarias, integración, E2E).
9. **ACCEPTANCE CRITERIA**: Criterios de aceptación no negociables.
10. **RISKS**: Riesgos operacionales y de regresión.
11. **ROLLBACK**: Procedimiento determinista de reversión de cambios.
12. **EVIDENCE**: Evidencias de certificación y salida de auditoría.

---

### [P0-00] CURRENT STATE FREEZE & MASTER GOVERNANCE
- **PHASE:** `P0-00 — CURRENT STATE FREEZE & MASTER GOVERNANCE`
- **OBJECTIVE:** Crear un snapshot inmutable y verificable del estado del repositorio (414 tests aprobados, compilación limpia, linter verde, servidor en puerto 3000), congelando la línea base e integrando la sección `CURRENT AUTHORITATIVE STATE` en el archivo maestro, separada del historial.
- **FILES:** `BIOAZUCAR_MASTER_DEVELOPMENT.md`, `BIOAZUCAR_EXECUTION_BASELINE.md`, `metadata.json`.
- **SERVICES:** N/A (Gobernanza y trazabilidad de arquitectura).
- **DATA CONTRACTS:** `AppMetadata`, `ProjectHealthSnapshot`.
- **DEPENDENCIES:** Ninguna (Fase raíz).
- **IMPLEMENTATION:**
  1. Auditar hash de commit / fecha del baseline, conteo de pruebas, linter y compilador.
  2. Reorganizar `BIOAZUCAR_MASTER_DEVELOPMENT.md` creando la sección `1. CURRENT AUTHORITATIVE STATE` y segregando el `HISTORICAL CHANGELOG`.
  3. Eliminar inconsistencias de versiones y fijar la línea base oficial.
- **TESTS:** Ejecución completa de vitest, linter y build.
- **ACCEPTANCE CRITERIA:**
  - Estado ejecutable del repositorio verificado (414 tests verdes, 0 fallos).
  - Documento maestro reorganizado sin ambigüedades temporales.
- **RISKS:** Modificaciones accidentales en secciones históricas.
- **ROLLBACK:** Restauración de git snapshot o checkpoint previo.
- **EVIDENCE:** Salida de consola de vitest, linter y build reflejada en bitácora.

---

### [P0-01] INDUSTRIAL SOURCE DISCOVERY ENGINE
- **PHASE:** `P0-01 — INDUSTRIAL SOURCE DISCOVERY ENGINE`
- **OBJECTIVE:** Diseñar e implementar un motor unificado de descubrimiento industrial capaz de explorar activamente redes OT y endpoints de planta (OPC UA Discovery / Browsing de AddressSpace, barrido de esclavos Modbus RTU/TCP, suscripción e introspección de tópicos MQTT Sparkplug B `NBIRTH`/`DBIRTH`, inspección de endpoints EROS DCS y APIs REST), complementado con flujo de importación manual y mapeo guiado para equipos que no soportan auto-discovery.
- **FILES:**
  - `src/services/discovery/types.ts`
  - `src/services/discovery/IndustrialDiscoveryEngine.ts`
  - `src/services/discovery/adapters/OpcUaDiscoveryAdapter.ts`
  - `src/services/discovery/adapters/ModbusDiscoveryAdapter.ts`
  - `src/services/discovery/adapters/SparkplugDiscoveryAdapter.ts`
  - `src/services/discovery/adapters/ErosDiscoveryAdapter.ts`
  - `src/services/discovery/importers/ManualTagCatalogImporter.ts`
  - `src/__tests__/p0IndustrialDiscoveryEngine.test.ts`
  - `server.ts` (rutas `/api/discovery/*`)
- **SERVICES:** `IndustrialDiscoveryEngine`, `IndustrialConnectionRegistry`, `IndustrialDeviceRegistry`.
- **DATA CONTRACTS:** `DiscoveredSource`, `DiscoveredDevice`, `DiscoveredNode`, `DiscoveredTag`, `DiscoveryJob`, `DiscoveryProfile`, `ManualImportPayload`.
- **DEPENDENCIES:** `P0-00`.
- **IMPLEMENTATION:**
  1. Definir contratos canónicos para descubrimiento industrial en `src/services/discovery/types.ts`.
  2. Implementar adaptadores especializados para cada protocolo (OPC UA, Modbus, Sparkplug, EROS).
  3. Crear motor de importación manual y mapeo asistido desde formatos estándar (CSV, AML, PLC L5X / XML).
  4. Exponer endpoints autenticados en backend para disparar tareas de descubrimiento asíncronas con seguimiento de progreso.
  5. Conectar los resultados descubiertos al flujo de staging/commissioning sin activar tags automáticamente en producción.
- **TESTS:**
  - Pruebas unitarias de introspección de namespaces OPC UA y resolución de NodeIds.
  - Pruebas de escaneo de registros de holding Modbus.
  - Pruebas de parseo de payloads de nacimiento Sparkplug B (NBIRTH/DBIRTH).
  - Pruebas de importación manual de catálogos y validación de tipos.
- **ACCEPTANCE CRITERIA:**
  - Descubrimiento de servidores, dispositivos, nodos, tópicos, registros, tipos de datos, unidades y metadatos.
  - Soporte de importación manual para dispositivos que no soportan auto-discovery.
  - Ningún tag descubierto se activa automáticamente sin aprobación humana.
- **RISKS:** Sobrecarga de red o saturación de enlaces serie Modbus durante el escaneo.
- **ROLLBACK:** Desactivación del motor de escaneo y retorno al registro manual estático.
- **EVIDENCE:** Reporte de descubrimiento generado con conteo exacto de nodos detectados y suite de pruebas pasando al 100%.

---

### [P0-02] CANONICAL INDUSTRIAL TAG REGISTRY HARDENING
- **PHASE:** `P0-02 — CANONICAL INDUSTRIAL TAG REGISTRY HARDENING`
- **OBJECTIVE:** Extender y endurecer el registro canónico de tags industriales para incorporar todos los atributos industriales indispensables para zafra real sin romper el contrato existente de `IndustrialDataPoint` ni `IndustrialTagDefinition`.
- **FILES:**
  - `src/types/industrialDataPoint.ts`
  - `src/types/index.ts`
  - `src/services/dataProviders/IndustrialTagRegistryService.ts`
  - `src/services/tagManagementService.ts`
  - `src/__tests__/p0CanonicalTagRegistryHardened.test.ts`
  - `server.ts` (rutas `/api/tags/canonical/*`)
- **SERVICES:** `IndustrialTagRegistryService`, `TagManagementService`, `IndustrialDataQualityGate`.
- **DATA CONTRACTS:** `CanonicalIndustrialTagRecord`, `TagQualityMapping`, `TagAlarmMapping`, `TagSafetyClassification`, `TagCalibrationMetadata`.
- **DEPENDENCIES:** `P0-01`.
- **IMPLEMENTATION:**
  1. Formalizar contrato extendido con 34 atributos obligatorios: `tagId`, `canonicalName`, `sourceId`, `originalAddress`, `protocol`, `driver`, `tenantId`, `siteId`, `areaId`, `processId`, `assetId`, `deviceId`, `variable`, `dataType`, `engineeringUnit`, `scale`, `offset`, `min`, `max`, `deadband`, `scanRate`, `timestampSource`, `qualityMapping`, `alarmMapping`, `criticality`, `semanticClass`, `safetyClassification`, `calibrationState`, `owner`, `approvalStatus`, `version`, `effectiveFrom`, `effectiveTo`.
  2. Implementar servicio de persistencia durable desacoplado de `localStorage` con almacenamiento server-side en Firestore y réplica SQLite local.
  3. Añadir versionado formal de tags y control de vigencia operativa (`effectiveFrom`, `effectiveTo`).
  4. Mantener compatibilidad absoluta hacia atrás con `IndustrialTagDefinition` mediante adaptadores transparentes.
- **TESTS:**
  - Validación de integridad de los 34 campos canónicos.
  - Pruebas de retrocompatibilidad con componentes legacy de UI y SCADA.
  - Pruebas de versionado y auditoría de cambios de tags.
- **ACCEPTANCE CRITERIA:**
  - Todo tag en el sistema contiene los metadatos de ingeniería y gobernanza completos.
  - Zero regresiones sobre los contratos preexistentes de lectura y visualización.
- **RISKS:** Conflicto de nomenclatura de variables entre diferentes sistemas DCS/PLC preexistentes.
- **ROLLBACK:** Revertir a la interfaz anterior conservando los nuevos campos como opcionales.
- **EVIDENCE:** Suite de pruebas unitarias validando la serialización, deserialización y mapeo canónico.

---

### [P0-03] SEMANTIC INDUSTRIAL MODEL & ISA-95 CONTEXT RESOLUTION
- **PHASE:** `P0-03 — SEMANTIC INDUSTRIAL MODEL & ISA-95 CONTEXT RESOLUTION`
- **OBJECTIVE:** Implementar la jerarquía semántica unificada según ISA-95 (`Enterprise -> Site -> Area -> Process Cell -> Process -> Equipment -> Device -> Tag`) y un motor de resolución de contexto capaz de transformar cualquier dirección de campo en su significado operacional exacto.
- **FILES:**
  - `src/types/semanticModel.ts`
  - `src/services/industrial/SemanticModelService.ts`
  - `src/services/industrial/ContextResolutionEngine.ts`
  - `src/__tests__/p0SemanticIndustrialModel.test.ts`
  - `server.ts` (rutas `/api/semantic/*`)
- **SERVICES:** `SemanticModelService`, `ContextResolutionEngine`, `IndustrialTagRegistryService`.
- **DATA CONTRACTS:** `SemanticNode`, `HierarchyLevel`, `OperationalContext`, `ContextResolutionResult`, `PlantTopologyMap`.
- **DEPENDENCIES:** `P0-02`.
- **IMPLEMENTATION:**
  1. Modelar la ontología de planta azucarera (Ingenio/Central, Batey, Molienda, Generación de Vapor, Clarificación, Evaporación, Cristalización, Centrífugas, Secado, Destilería, Tratamiento de Vinazas).
  2. Implementar `ContextResolutionEngine` para traducir direcciones físicas (ej: `DB10.DBW14` o `ns=2;s=Boiler1.DrumLevel`) en contextos legibles (`Central 01 -> Caldera 01 -> Sistema de Vapor -> Nivel de Domo -> 52.4% -> GOOD`).
  3. Proporcionar navegación bidireccional de la jerarquía (Top-Down y Bottom-Up).
- **TESTS:**
  - Resolución contextual de 50 direcciones de campo heterogéneas.
  - Pruebas de integridad del grafo jerárquico y prevención de ciclos.
- **ACCEPTANCE CRITERIA:**
  - Cualquier dato industrial puede asociarse a su contexto operacional en menos de 1 milisegundo.
  - Compatibilidad estricta con los niveles ISA-95.
- **RISKS:** Ambigüedad en equipos compartidos entre procesos (ej. colector común de vapor o bombas de jugo alcalizado).
- **ROLLBACK:** Desactivación de la resolución semántica automática, manteniendo las asociaciones manuales.
- **EVIDENCE:** Árbol de planta serializado y verificado mediante pruebas de navegación de grafo.

---

### [P0-04] INDUSTRIAL DATA QUALITY GATE CENTRALIZATION
- **PHASE:** `P0-04 — INDUSTRIAL DATA QUALITY GATE CENTRALIZATION`
- **OBJECTIVE:** Consolidar el Quality Gate central de datos industriales asegurando que ningún dato `BAD`, `STALE`, `UNKNOWN`, `SIMULATED` o fuera de rango contamine los cálculos críticos ni las recomendaciones de BioAI.
- **FILES:**
  - `src/services/dataProviders/IndustrialDataQualityGate.ts`
  - `src/types/industrialDataPoint.ts`
  - `src/__tests__/p0DataQualityGateCentralized.test.ts`
- **SERVICES:** `IndustrialDataQualityGate`, `KPIEngine`, `BioAiEngineService`.
- **DATA CONTRACTS:** `QualityClassification`, `QualityGateEnforcementResult`, `SignalQualityAuditTrail`.
- **DEPENDENCIES:** `P0-03`.
- **IMPLEMENTATION:**
  1. Enforzar los 7 estados mandatorios: `GOOD`, `UNCERTAIN`, `BAD`, `STALE`, `COMMUNICATION_LOST`, `SIMULATED`, `UNKNOWN`.
  2. Implementar reglas estrictas: `UNKNOWN ≠ ZERO`, `MISSING ≠ ZERO`, `STALE ≠ CURRENT`, `SIMULATED ≠ REAL`.
  3. Descartar automáticamente datos no conformes de los agregadores de balances de masa y energía.
- **TESTS:** Pruebas de inyección de fallos, ceros falsos, desincronización de reloj y señales simuladas en producción.
- **ACCEPTANCE CRITERIA:** 100% de los datos que llegan a los KPIs de fábrica poseen calidad certificada `GOOD`.
- **RISKS:** Falsos positivos de datos `BAD` por picos transitorios legítimos de proceso.
- **ROLLBACK:** Ajuste de filtros de banda muerta y márgenes de desvío aceptable.
- **EVIDENCE:** Trazabilidad de rechazo y aprobación de muestras en bitácora de auditoría.

---

### [P0-05] END-TO-END DATA PROVENANCE & LINEAGE ENGINE
- **PHASE:** `P0-05 — END-TO-END DATA PROVENANCE & LINEAGE ENGINE`
- **OBJECTIVE:** Construir el motor de linaje y trazabilidad de extremo a extremo (`SOURCE -> RAW -> NORMALIZED -> VALIDATED -> TRANSFORMED -> KPI -> REPORT -> AI`), capaz de responder qué datos originales formaron un KPI y qué modelos consumieron cada dato.
- **FILES:**
  - `src/services/provenance/DataLineageEngine.ts`
  - `src/services/provenance/types.ts`
  - `src/__tests__/p0DataLineageEngine.test.ts`
- **SERVICES:** `DataLineageEngine`, `HistorianService`, `KPIEngine`.
- **DATA CONTRACTS:** `LineageNode`, `LineageEdge`, `ProvenanceTrace`, `CorrelationToken`.
- **DEPENDENCIES:** `P0-04`.
- **IMPLEMENTATION:** Inyección de tokens criptográficos de correlación y generación de grafos dirigidos acíclicos (DAG) de procedencia.
- **TESTS:** Trazabilidad inversa y directa de 100 cálculos de rendimiento industrial.
- **ACCEPTANCE CRITERIA:** Capacidad de reconstruir la cadena causal completa de cualquier recomendación o indicador.
- **RISKS:** Sobrecarga de almacenamiento por metadatos de linaje en señales de alta frecuencia.
- **ROLLBACK:** Muestreo o agregación de linaje por ventanas temporales.
- **EVIDENCE:** Grafo de linaje exportable en formato JSON-LD auditado por pruebas automatizadas.

---

### [P0-06] COMMISSIONING & DATA COVERAGE SYSTEM
- **PHASE:** `P0-06 — COMMISSIONING & DATA COVERAGE SYSTEM`
- **OBJECTIVE:** Implementar el panel y motor de cobertura de commissioning (`Discovered -> Mapped -> Validated -> Approved -> Production`), calculando métricas de cobertura y bloqueando activación de tags desconocidos o no verificados.
- **FILES:**
  - `src/services/edge/IndustrialCommissioningService.ts`
  - `src/services/commissioning/CommissioningCoverageEngine.ts`
  - `src/components/commissioning/CommissioningCoverageDashboard.tsx`
  - `src/__tests__/p0CommissioningCoverage.test.ts`
- **SERVICES:** `IndustrialCommissioningService`, `CommissioningCoverageEngine`.
- **DATA CONTRACTS:** `CommissioningCoverageMetrics`, `TagLifecycleStage`, `CommissioningApprovalToken`.
- **DEPENDENCIES:** `P0-05`.
- **IMPLEMENTATION:** Cálculo de ratios de cobertura, flujo de aprobación de dos firmas para puesta en marcha y bloqueo en caliente de tags no comisionados.
- **TESTS:** Pruebas de avance por etapas y bloqueo de activación no autorizada.
- **ACCEPTANCE CRITERIA:** Panel visual y API con métricas exactas de cobertura y discrepancias visibles.
- **RISKS:** Resistencia operativa al flujo de aprobación estricto.
- **ROLLBACK:** Modo de excepción temporal con registro de auditoría reforzado.
- **EVIDENCE:** Certificado de comisionamiento emitido con hash criptográfico y evidencia física de enlace.

---

### [P0-07] CANONICAL DATA CONTRACTS MULTI-DOMAIN
- **PHASE:** `P0-07 — CANONICAL DATA CONTRACTS MULTI-DOMAIN`
- **OBJECTIVE:** Formalizar contratos canónicos transversales unificados para todos los dominios (`Industrial`, `Agriculture`, `Production`, `Energy`, `Quality`, `Maintenance`, `Logistics`, `Economics`, `AI`).
- **FILES:**
  - `src/types/contracts/index.ts`
  - `src/types/contracts/domainContracts.ts`
  - `src/__tests__/p0DomainContractsValidation.test.ts`
- **SERVICES:** `UniversalContractValidator`.
- **DATA CONTRACTS:** `UniversalDomainEntity`, `TenantScopedIdentity`, `AuditableRecord`.
- **DEPENDENCIES:** `P0-06`.
- **IMPLEMENTATION:** Estandarización de `identity`, `tenant`, `site`, `timestamp`, `source`, `quality`, `provenance`, `version` en cada interfaz de dominio.
- **TESTS:** Validación estricta con esquemas Zod o Type Guards en tiempo de compilación y ejecución.
- **ACCEPTANCE CRITERIA:** Cero duplicación de tipos y 100% de entidades compartiendo metadatos universales.
- **RISKS:** Refactorización transversal que requiera actualizar múltiples vistas secundarias.
- **ROLLBACK:** Mantener adaptadores de conversión bidireccional.
- **EVIDENCE:** Suite de validación de esquemas ejecutada satisfactoriamente.

---

### [P0-08] AGRICULTURAL DIGITAL TWIN — CAMPO A PARCELA
- **PHASE:** `P0-08 — AGRICULTURAL DIGITAL TWIN — CAMPO A PARCELA`
- **OBJECTIVE:** Modelar el Gemelo Digital Agrícola con jerarquía completa (`Enterprise -> Central -> UEB -> Zone -> Farm -> Plot -> Sector -> Crop -> Variety -> Cycle -> Operation -> Harvest`), vinculando suelo, clima, insumos y rendimientos.
- **FILES:**
  - `src/types/agriculture.ts`
  - `src/services/agriculture/AgriculturalDigitalTwinService.ts`
  - `src/__tests__/p0AgriculturalDigitalTwin.test.ts`
- **SERVICES:** `AgriculturalDigitalTwinService`, `AgriculturalPersistenceService`.
- **DATA CONTRACTS:** `PlotDigitalTwin`, `AgronomicProfile`, `SoilAnalysis`, `CropCycleOperation`.
- **DEPENDENCIES:** `P0-07`.
- **IMPLEMENTATION:** Persistencia de parcelas con georreferenciación, historial de cortes, variedad y modelo de maduración fenológica.
- **TESTS:** Pruebas de cálculo de TCH observado vs esperado y trazabilidad agronómica.
- **ACCEPTANCE CRITERIA:** Cada parcela cuenta con un gemelo digital vivo con historial de operaciones e insumos.
- **RISKS:** Dispersión o falta de datos edafológicos y climáticos en centrales antiguos.
- **ROLLBACK:** Inicialización con valores de referencia zonales auditados como `BENCHMARK`.
- **EVIDENCE:** Gemelo digital de finca validado con datos agronómicos canónicos.

---

### [P0-09] AGRICULTURAL DATA HARDENING & MOCK ISOLATION
- **PHASE:** `P0-09 — AGRICULTURAL DATA HARDENING & MOCK ISOLATION`
- **OBJECTIVE:** Aislar y bloquear completamente cualquier residuo de datos sintéticos (`INITIAL_*`, `mock*`, `demo*`) en rutas de producción agrícola, etiquetando explícitamente todo dato de referencia.
- **FILES:**
  - `src/services/agriculture/AgriculturalDataTruthService.ts`
  - `src/services/agriculture/AgriculturalParameterRegistry.ts`
  - `src/__tests__/p0AgriculturalDataHardening.test.ts`
- **SERVICES:** `AgriculturalDataTruthService`, `AgriculturalParameterRegistry`.
- **DATA CONTRACTS:** `DataClassificationTag`, `DataTruthAuditReport`.
- **DEPENDENCIES:** `P0-08`.
- **IMPLEMENTATION:** Clasificación rigurosa de parámetros en producción (`ACTUAL` vs `REFERENCE` / `SCENARIO`) y activación de Fail-Closed ante presencia de datos no autorizados.
- **TESTS:** Verificación de inyección de fixtures y comprobación de bloqueo inmediato en perfil de producción.
- **ACCEPTANCE CRITERIA:** Ningún dato no medido en zafra real puede ser presentado con etiqueta `ACTUAL`.
- **RISKS:** Interrupción de visualización si no se cargan datos iniciales de zafra.
- **ROLLBACK:** Procedimiento guiado de carga de datos iniciales vía asistente seguro.
- **EVIDENCE:** Auditoría de verdad de datos agrícola certificando 0% de suposiciones no declaradas.

---

### [P0-10] AGRICULTURAL FORMULA GOVERNANCE & AUDIT TRAIL
- **PHASE:** `P0-10 — AGRICULTURAL FORMULA GOVERNANCE & AUDIT TRAIL`
- **OBJECTIVE:** Auditar y gobernar formalmente todas las fórmulas agrícolas del Plan Director (TCH, producción, demanda de maquinaria, OPEX/t, balances de corte), erradicando fórmulas hardcodeadas en UI.
- **FILES:**
  - `src/services/agriculture/PdaFormulaRegistry.ts`
  - `src/services/agriculture/YieldCalculationService.ts`
  - `src/services/agriculture/AgroEconomicsService.ts`
  - `src/__tests__/p0FormulaGovernanceAudit.test.ts`
- **SERVICES:** `PdaFormulaRegistry`, `YieldCalculationService`, `AgroEconomicsService`.
- **DATA CONTRACTS:** `GovernedFormulaRecord`, `FormulaExecutionResult`, `FormulaAuditLog`.
- **DEPENDENCIES:** `P0-09`.
- **IMPLEMENTATION:** Centralización de cálculos en servicios puros con metadatos de autoría, versión, fecha de vigencia y rango de validez.
- **TESTS:** Pruebas matemáticas contra tablas de cálculo del INICA / ICIDCA con tolerancia < 0.001%.
- **ACCEPTANCE CRITERIA:** Prohibición absoluta de cálculos matemáticos críticos en componentes React de renderizado.
- **RISKS:** Discrepancia con costumbres de cálculo empíricas locales de jefes de campo.
- **ROLLBACK:** Parametrización configurable de coeficientes regionales mediante gobernanza.
- **EVIDENCE:** Bitácora inmutable de cálculo con cada resultado asociado al ID de fórmula y versión.

---

### [P0-11] AGRICULTURE → FACTORY DIGITAL THREAD
- **PHASE:** `P0-11 — AGRICULTURE → FACTORY DIGITAL THREAD`
- **OBJECTIVE:** Implementar el hilo digital bidireccional desde la Parcela agrícola hasta el saco de azúcar (`Plot -> Harvest -> Cane Batch -> CCT -> Truck -> Weighbridge -> Yard -> Mill -> Process -> Sugar`).
- **FILES:**
  - `src/services/digitalThread/AgriculturalIndustrialDigitalThread.ts`
  - `src/types/digitalThread.ts`
  - `src/__tests__/p0DigitalThreadAgroToFactory.test.ts`
- **SERVICES:** `AgriculturalIndustrialDigitalThread`, `MachineryAndLogisticsService`.
- **DATA CONTRACTS:** `CaneBatchPassport`, `WeighbridgeTicket`, `MillingBatchCorrelation`, `SugarQualityPassport`.
- **DEPENDENCIES:** `P0-10`.
- **IMPLEMENTATION:** Creación del pasaporte digital de lote de caña (`CaneBatchPassport`) que viaja desde el corte mecánico/manual hasta los molinos y evaporadores.
- **TESTS:** Pruebas de trazabilidad hacia adelante (Lote -> Azúcar) y hacia atrás (Saco de Azúcar -> Finca y Suelo).
- **ACCEPTANCE CRITERIA:** Se puede determinar el origen agronómico exacto de cualquier lote de producción de azúcar o bioetanol.
- **RISKS:** Retraso en el registro manual de boletos de pesaje en centrales sin báscula automatizada.
- **ROLLBACK:** Registro retroactivo de tickets con sello temporal de corrección y calidad `UNCERTAIN`.
- **EVIDENCE:** Trazabilidad completa demostrada en prueba E2E de ciclo de molienda.

---

### [P0-12] INDUSTRIAL CONTEXT ENGINE
- **PHASE:** `P0-12 — INDUSTRIAL CONTEXT ENGINE`
- **OBJECTIVE:** Crear el motor unificado de contexto que relaciona `IndustrialDataPoint + Asset + Process + Campaign + Plot + Harvest + CaneBatch + Quality + Maintenance + Energy + Events + Historical Data`, sirviendo como única fuente de verdad contextual.
- **FILES:**
  - `src/services/context/IndustrialContextEngine.ts`
  - `src/services/context/types.ts`
  - `src/__tests__/p0IndustrialContextEngine.test.ts`
- **SERVICES:** `IndustrialContextEngine`, `SemanticModelService`, `DataLineageEngine`.
- **DATA CONTRACTS:** `EnrichedIndustrialContext`, `ContextQueryFilter`, `OperationalSituation`.
- **DEPENDENCIES:** `P0-11`.
- **IMPLEMENTATION:** Motor de enriquecimiento en vuelo que dota a cada telemetría de su contexto agronómico, operativo y de mantenimiento.
- **TESTS:** Pruebas de enriquecimiento con latencia < 2 ms por punto.
- **ACCEPTANCE CRITERIA:** Eliminación de lógica duplicada de búsqueda de contexto en vistas y servicios analíticos.
- **RISKS:** Alto consumo de memoria en caché si el volumen de relaciones crece exponencialmente.
- **ROLLBACK:** Indexación LRU con desalojo de contextos inactivos.
- **EVIDENCE:** Respuestas contextuales enriquecidas validadas en suite de integración.

---

### [P0-13] CROSS-DOMAIN DIGITAL THREAD INTEGRATION
- **PHASE:** `P0-13 — CROSS-DOMAIN DIGITAL THREAD INTEGRATION`
- **OBJECTIVE:** Extender las relaciones transversales a Mantenimiento (CMMS), Eficiencia Energética (Generación de Vapor / Turbogeneradores / Cogeneración) y Economía de Zafra.
- **FILES:**
  - `src/services/digitalThread/CrossDomainDigitalThread.ts`
  - `src/__tests__/p0CrossDomainDigitalThread.test.ts`
- **SERVICES:** `CrossDomainDigitalThread`, `OtInfrastructureService`.
- **DATA CONTRACTS:** `EnergyAssetThread`, `MaintenanceAssetThread`, `EconomicBatchTrace`.
- **DEPENDENCIES:** `P0-12`.
- **IMPLEMENTATION:** Relación de paradas imprevistas de molino con costos de lucro cesante y consumo específico de vapor por tonelada molida.
- **TESTS:** Correlación entre fallos de rodamientos de molino y pérdida de extracción sacarosa.
- **ACCEPTANCE CRITERIA:** Navegación fluida entre alarmas de planta, órdenes de trabajo de mantenimiento y costos de zafra.
- **RISKS:** Falta de integración con sistemas CMMS legados de terceros.
- **ROLLBACK:** Exportación e importación vía API estandarizada REST / JSON.
- **EVIDENCE:** Matriz de correlación cruzada validada con pruebas unitarias.

---

### [P0-14] BIOAI REAL DATA FOUNDATION & PROVENANCE
- **PHASE:** `P0-14 — BIOAI REAL DATA FOUNDATION & PROVENANCE`
- **OBJECTIVE:** Sustituir calibraciones sintéticas por datasets históricos anonimizados de zafra real, incorporando validación de esquemas, calidad y control de versiones de datos de entrenamiento.
- **FILES:**
  - `src/services/bioai/datasets/RealZafraDatasetRegistry.ts`
  - `src/services/bioai/datasets/DatasetProvenanceValidator.ts`
  - `src/__tests__/p0BioAiRealDataFoundation.test.ts`
- **SERVICES:** `RealZafraDatasetRegistry`, `DatasetProvenanceValidator`.
- **DATA CONTRACTS:** `ZafraDatasetRecord`, `DatasetValidationReport`, `ModelTrainingBaseline`.
- **DEPENDENCIES:** `P0-13`.
- **IMPLEMENTATION:** Carga de series temporales de fábrica (molienda, calderas, evaporadores, clarificación) con trazabilidad criptográfica de procedencia.
- **TESTS:** Verificación de integridad, detección de datos atípicos y balance de masa estricto.
- **ACCEPTANCE CRITERIA:** Prohibición de entrenar modelos de recomendación sobre datos puramente sintéticos.
- **RISKS:** Ruido en datos históricos debido a instrumentación descalibrada de zafras pasadas.
- **ROLLBACK:** Filtrado previo con algoritmos de eliminación de outliers y verificación de consistencia física.
- **EVIDENCE:** Registro de dataset versionado con firma criptográfica de auditoría.

---

### [P0-15] PREDICTIVE MODEL VALIDATION & DRIFT MONITORING
- **PHASE:** `P0-15 — PREDICTIVE MODEL VALIDATION & DRIFT MONITORING`
- **OBJECTIVE:** Implementar la evaluación rigurosa de modelos predictivos azucareros con cálculo automático de MAE, RMSE, MAPE, sesgo, confianza e intervalos de predicción, segregando TRAIN, VALIDATION, TEST y PRODUCTION.
- **FILES:**
  - `src/services/bioai/validation/ModelValidationEngine.ts`
  - `src/services/bioai/validation/DriftMonitoringService.ts`
  - `src/__tests__/p0ModelValidationAndDrift.test.ts`
- **SERVICES:** `ModelValidationEngine`, `DriftMonitoringService`.
- **DATA CONTRACTS:** `ModelAccuracyMetrics`, `DataDriftReport`, `ConceptDriftAlert`.
- **DEPENDENCIES:** `P0-14`.
- **IMPLEMENTATION:** Comparación continua de predicción vs realidad observada en molienda y evaporación.
- **TESTS:** Detección automática de deriva de proceso provocada por cambios en la variedad de caña o incrustación en calandrias.
- **ACCEPTANCE CRITERIA:** Alertas inmediatas al operador cuando el error MAPE excede el umbral de confianza (ej. > 5%).
- **RISKS:** Sobrecarga de alertas por perturbaciones transitorias de arranque de fábrica.
- **ROLLBACK:** Ventana móvil de filtrado temporal de transitorios.
- **EVIDENCE:** Reporte cuantitativo de métricas de precisión emitido por el validador de modelos.

---

### [P0-16] CLOSED-LOOP AGRICULTURAL PLANNING (PDA LEARNING)
- **PHASE:** `P0-16 — CLOSED-LOOP AGRICULTURAL PLANNING (PDA LEARNING)`
- **OBJECTIVE:** Implementar el bucle cerrado de planificación agrícola (`PLAN -> EXECUTION -> ACTUAL -> RECONCILIATION -> VARIANCE -> ROOT CAUSE -> LEARNING -> NEXT PLAN`), retroalimentando el plan con resultados reales bajo estricta gobernanza humana.
- **FILES:**
  - `src/services/agriculture/ClosedLoopPlanningEngine.ts`
  - `src/services/agriculture/AgriculturalReconciliationService.ts`
  - `src/__tests__/p0ClosedLoopAgriculturalPlanning.test.ts`
- **SERVICES:** `ClosedLoopPlanningEngine`, `AgriculturalPlanningService`.
- **DATA CONTRACTS:** `PlanVarianceAnalysis`, `ReconciliationAction`, `ModelTuningProposal`.
- **DEPENDENCIES:** `P0-15`.
- **IMPLEMENTATION:** Análisis de causas raíz de desvíos en TCH y brix, sugiriendo ajustes calibrados para la zafra subsiguiente que requieren aprobación de la dirección técnica.
- **TESTS:** Validación de ciclo cerrado en escenario multi-finca.
- **ACCEPTANCE CRITERIA:** Ninguna fórmula o parámetro de planificación se altera sin aprobación explícita de un usuario con rol autorizado.
- **RISKS:** Propuestas de ajuste erróneas si la causa de la merma fue una avería de transporte y no un factor agronómico.
- **ROLLBACK:** Rechazo de la propuesta y conservación de los parámetros base.
- **EVIDENCE:** Expediente de reconciliación generado con justificaciones y firmas digitales.

---

### [P0-17] AI GATEWAY HARDENING & CONTROL COMMAND CLASSIFICATION
- **PHASE:** `P0-17 — AI GATEWAY HARDENING & CONTROL COMMAND CLASSIFICATION`
- **OBJECTIVE:** Endurecer el BioAI Gateway multi-proveedor incorporando políticas de retry exponencial, disyuntores por proveedor, aislamiento de credenciales y clasificación estricta de tareas (`INFORMATIONAL`, `ANALYTICAL`, `DIAGNOSTIC`, `PREDICTIVE`, `OPTIMIZATION`, `CONTROL_ADVISORY`, `CONTROL_COMMAND`), prohibiendo fallback automático en tareas de comando.
- **FILES:**
  - `src/services/ai/gateway/AiModelGatewayService.ts`
  - `src/services/ai/gateway/types.ts`
  - `src/__tests__/p0AiGatewayHardening.test.ts`
- **SERVICES:** `AiModelGatewayService`.
- **DATA CONTRACTS:** `TaskCriticalityClass`, `ResiliencePolicy`, `GatewayCircuitState`.
- **DEPENDENCIES:** `P0-16`.
- **IMPLEMENTATION:** Bloqueo de fallback no autorizado en peticiones clasificadas como `CONTROL_COMMAND`. Si el proveedor soberano asignado falla, se aplica Fail-Closed sin transferir la decisión a modelos no autorizados.
- **TESTS:** Pruebas de disrupción de red simulada y validación de políticas por nivel de criticidad.
- **ACCEPTANCE CRITERIA:** Garantía de que ninguna orden de control industrial se delega a un modelo no validado.
- **RISKS:** Indisponibilidad de comandos automatizados si el modelo local sufre una caída de servicio.
- **ROLLBACK:** Transferencia inmediata del mando al operador humano de sala de control.
- **EVIDENCE:** Registro de auditoría certificando el cumplimiento de la política de aislamiento.

---

### [P0-18] INDUSTRIAL OBSERVABILITY & AUDIT TRAIL EXPANSION
- **PHASE:** `P0-18 — INDUSTRIAL OBSERVABILITY & AUDIT TRAIL EXPANSION`
- **OBJECTIVE:** Expandir la observabilidad en tiempo real y la bitácora de auditoría durable distinguiendo explícitamente entre métricas operativas de ejecución, auditoría forense inmutable y estimaciones financieras de consumo de IA.
- **FILES:**
  - `src/services/monitoring/IndustrialObservabilityService.ts`
  - `src/server/authMiddleware.ts`
  - `server.ts`
  - `src/__tests__/p0IndustrialObservability.test.ts`
- **SERVICES:** `IndustrialObservabilityService`, `MetricsTracker`.
- **DATA CONTRACTS:** `OpenMetricsPayload`, `DurableAuditEvent`, `CostEstimationBreakdown`.
- **DEPENDENCIES:** `P0-17`.
- **IMPLEMENTATION:** Exposición granular de métricas de telemetría de campo, latencias de buses y precisión de modelos vía `/metrics` para Prometheus y SIEM.
- **TESTS:** Pruebas de consumo concurrente y validación de sintaxis OpenMetrics / Prometheus.
- **ACCEPTANCE CRITERIA:** Claridad absoluta entre costos estimados de IA y facturación real.
- **RISKS:** Impacto en rendimiento por logging excesivo en bucle de telemetría.
- **ROLLBACK:** Modulación de nivel de log a `WARN` en rutas de alta frecuencia.
- **EVIDENCE:** Salida de `/metrics` validada con el linter de Prometheus.

---

### [P0-19] CYBERSECURITY ALIGNED TO IEC 62443-3-3 SL3
- **PHASE:** `P0-19 — CYBERSECURITY ALIGNED TO IEC 62443-3-3 SL3`
- **OBJECTIVE:** Implementar y verificar los controles técnicos de ciberseguridad industrial según IEC 62443-3-3 Security Level 3 (segmentación de zonas, mTLS, inventario de activos autenticado, cifrado en reposo y en tránsito, principio de menor privilegio y no repudio).
- **FILES:**
  - `src/services/security/Iec62443SecurityEngine.ts`
  - `src/services/edge/security/DriverSignatureValidator.ts`
  - `src/__tests__/p0SecurityIec62443Compliance.test.ts`
- **SERVICES:** `Iec62443SecurityEngine`, `DriverSignatureValidator`.
- **DATA CONTRACTS:** `SecurityZoneDefinition`, `TlsInspectionProfile`, `AccessControlAssertion`.
- **DEPENDENCIES:** `P0-18`.
- **IMPLEMENTATION:** Aislamiento estricto de zonas OT / Edge / DMZ / IT / Cloud con validación criptográfica de identidades y mensajes.
- **TESTS:** Pruebas de inyección de tramas no firmadas, simulación de ataques de repetición y violación de perímetros de red.
- **ACCEPTANCE CRITERIA:** Rechazo inmediato de cualquier paquete sin firma o procedente de zona no autorizada.
- **RISKS:** Bloqueo de comunicaciones de equipos legacy que no soporten mTLS nativo.
- **ROLLBACK:** Uso de pasarelas de seguridad Edge Gateway como proxy de terminación de cifrado.
- **EVIDENCE:** Matriz de cumplimiento de requisitos de seguridad IEC 62443 documentada y probada.

---

### [P0-20] OFFLINE & EDGE AUTONOMY ENGINE
- **PHASE:** `P0-20 — OFFLINE & EDGE AUTONOMY ENGINE`
- **OBJECTIVE:** Garantizar la operación soberana y autónoma de la planta en condiciones de desconexión total (*air-gapped*) mediante almacenamiento local, inferencia con modelos locales (Ollama), historiador local y cola transaccional de sincronización (*Store & Forward*).
- **FILES:**
  - `src/services/offline/OfflineEdgeAutonomyEngine.ts`
  - `src/services/edge/DiskStoreAndForwardEngine.ts`
  - `src/__tests__/p0OfflineEdgeAutonomy.test.ts`
- **SERVICES:** `OfflineEdgeAutonomyEngine`, `DiskStoreAndForwardEngine`.
- **DATA CONTRACTS:** `ReplicationEnvelope`, `SyncConflictResolution`, `AutonomousOperationStatus`.
- **DEPENDENCIES:** `P0-19`.
- **IMPLEMENTATION:** Motor de replicación asíncrona con resolución determinista de conflictos y cero pérdida de datos durante caídas de enlace de semanas.
- **TESTS:** Simulación de corte de enlace de 72 horas con 100.000 eventos retenidos y sincronizados íntegramente al restablecer red.
- **ACCEPTANCE CRITERIA:** La fábrica puede operar al 100% de su capacidad sin requerir conexión a Internet.
- **RISKS:** Agotamiento de almacenamiento local si la desconexión se prolonga por meses.
- **ROLLBACK:** Purgado automático de señales de alta frecuencia conservando promedios minutales comprimidos con SDT.
- **EVIDENCE:** Prueba de desconexión y reconexión transaccional aprobada con 0% de pérdida de tramas.

---

### [P0-21] NO-FAKE-PRODUCTION-DATA HARDENING GATE
- **PHASE:** `P0-21 — NO-FAKE-PRODUCTION-DATA HARDENING GATE`
- **OBJECTIVE:** Establecer una barrera de seguridad inviolable en backend y frontend para garantizar que en el perfil `PRODUCTION` los componentes `SIMULATION`, `DEMO`, `SEED` y `MOCK` queden terminantemente inhabilitados, mostrando indicadores visuales claros de procedencia.
- **FILES:**
  - `src/services/runtime/ProductionIntegrityGate.ts`
  - `src/components/common/DataProvenanceBanner.tsx`
  - `server.ts`
  - `src/__tests__/p0NoFakeProductionDataGate.test.ts`
- **SERVICES:** `ProductionIntegrityGate`.
- **DATA CONTRACTS:** `RuntimeIntegrityAssertion`, `VisualProvenanceBadge`.
- **DEPENDENCIES:** `P0-20`.
- **IMPLEMENTATION:** Interceptores de red y guardias en tiempo de ejecución que abortan cualquier petición con datos sintéticos en producción, forzando `SIMULATION=false`, `DEMO=false`, `SEED=disabled`.
- **TESTS:** Intentos de inyección de datos mock en modo producción verificando el lanzamiento de `PRODUCTION_SIMULATION_PROHIBITED`.
- **ACCEPTANCE CRITERIA:** Distinción inequívoca en toda pantalla entre `REAL`, `SIMULATED`, `HISTORICAL`, `FORECAST` y `SCENARIO`.
- **RISKS:** Bloqueo de interfaces de usuario si los enlaces a campo no han completado el comisionamiento.
- **ROLLBACK:** Presentación explícita de pantalla de espera de enlace de comisionamiento sin datos falsos.
- **EVIDENCE:** Suite de pruebas de seguridad y captura visual de banners de estado.

---

### [P0-22] END-TO-END INDUSTRIAL CHAIN VALIDATION
- **PHASE:** `P0-22 — END-TO-END INDUSTRIAL CHAIN VALIDATION`
- **OBJECTIVE:** Desarrollar e instrumentar pruebas E2E integrales que recorran la cadena operativa completa desde el descubrimiento hasta el reporte auditado y la recomendación de IA.
- **FILES:**
  - `src/__tests__/e2eFullIndustrialOperationalChain.test.ts`
- **SERVICES:** Todos los servicios del ecosistema BioAzúcar 4.0.
- **DATA CONTRACTS:** Todos los contratos canónicos.
- **DEPENDENCIES:** `P0-21`.
- **IMPLEMENTATION:** Prueba automatizada que simula la llegada de una brigada de corte a una finca, el pesaje de camiones en báscula, la molienda con lectura de tags vía Edge, el cálculo de Hugot, la validación de calidad, la historización y la generación de la recomendación de control.
- **TESTS:** Ejecución end-to-end con verificación de estados en cada eslabón.
- **ACCEPTANCE CRITERIA:** 100% de la cadena validada con trazabilidad completa de IDs y cero datos huérfanos.
- **RISKS:** Tiempos de ejecución prolongados en la suite de pruebas integradas.
- **ROLLBACK:** Optimización de mocks controlados en memoria para pruebas de ciclo rápido.
- **EVIDENCE:** Reporte de ejecución de prueba E2E con 0 errores y registro de auditoría completo.

---

### [P0-23] REAL COMMISSIONING & PHYSICAL ACTIVATION MODE
- **PHASE:** `P0-23 — REAL COMMISSIONING & PHYSICAL ACTIVATION MODE`
- **OBJECTIVE:** Crear el modo formal de puesta en marcha física (`DISCOVER -> MAP -> VALIDATE -> APPROVE -> ACTIVATE`), con interfaz gráfica de ingeniería de control para la activación controlada de señales de campo.
- **FILES:**
  - `src/services/commissioning/RealCommissioningWorkflow.ts`
  - `src/components/commissioning/CommissioningWorkflowWizard.tsx`
  - `src/__tests__/p0RealCommissioningWorkflow.test.ts`
- **SERVICES:** `RealCommissioningWorkflow`, `IndustrialCommissioningService`.
- **DATA CONTRACTS:** `CommissioningSession`, `TagActivationRequest`, `CommissioningSignOff`.
- **DEPENDENCIES:** `P0-22`.
- **IMPLEMENTATION:** Asistente paso a paso que exige validación de señal en vivo (tasa de muestreo > 0, calidad >= 90%, latencia < SLA) antes de permitir que un tag ingrese a producción.
- **TESTS:** Simulación de puesta en marcha de un nuevo cuadro de bombeo de jugo alcalizado.
- **ACCEPTANCE CRITERIA:** Ningún tag físico se publica a las pantallas de los operadores sin el acta de puesta en marcha aprobada.
- **RISKS:** Demora en la puesta en marcha por requerimiento de verificación física.
- **ROLLBACK:** Modo de visualización en pruebas (*Staging*) sin impacto en control.
- **EVIDENCE:** Acta digital de comisionamiento firmada electrónicamente.

---

### [P0-24] INDUSTRIAL READINESS MATRIX & FAT/SAT CERTIFICATION
- **PHASE:** `P0-24 — INDUSTRIAL READINESS MATRIX & FAT/SAT CERTIFICATION`
- **OBJECTIVE:** Consolidar la matriz de preparación industrial (*Industrial Readiness Matrix*) con trazabilidad de pruebas de fábrica (FAT) y pruebas en sitio (SAT), certificando la idoneidad técnica para operar en un ingenio real.
- **FILES:**
  - `src/services/verification/IndustrialReadinessMatrix.ts`
  - `src/__tests__/p0IndustrialReadinessCertification.test.ts`
  - `BIOAZUCAR_FAT_SAT_CERTIFICATION.md`
- **SERVICES:** `IndustrialReadinessMatrix`.
- **DATA CONTRACTS:** `ReadinessAssessment`, `FatSatProtocolRecord`.
- **DEPENDENCIES:** `P0-23`.
- **IMPLEMENTATION:** Motor de auditoría continua que evalúa la cobertura de pruebas unitarias, de integración, de seguridad, de HIL y de datos reales para cada módulo funcional.
- **TESTS:** Validación automatizada de criterios FAT/SAT sobre el código compilado.
- **ACCEPTANCE CRITERIA:** Solo las funciones con respaldo de pruebas formales reciben el estado `PRODUCTION_READY`.
- **RISKS:** Detección de módulos secundarios que requieran endurecimiento adicional.
- **ROLLBACK:** Clasificación explícita de dichos módulos como `PROTOTYPE` o `UNDER_COMMISSIONING`.
- **EVIDENCE:** Matriz completa de certificación FAT/SAT exportada en Markdown y JSON.

---

### [P0-25] MASTER DOCUMENT GOVERNANCE REORGANIZATION
- **PHASE:** `P0-25 — MASTER DOCUMENT GOVERNANCE REORGANIZATION`
- **OBJECTIVE:** Reorganizar exhaustivamente `BIOAZUCAR_MASTER_DEVELOPMENT.md` estructurándolo en los 14 apartados estipulados en la orden suprema, reflejando con exactitud quirúrgica la verdad del código ejecutable.
- **FILES:**
  - `BIOAZUCAR_MASTER_DEVELOPMENT.md`
- **SERVICES:** N/A.
- **DATA CONTRACTS:** N/A.
- **DEPENDENCIES:** `P0-24`.
- **IMPLEMENTATION:** Actualización final del documento maestro con índices de evidencia, arquitectura consolidada y estado canónico.
- **TESTS:** Validación de enlaces, sintaxis de código y consistencia de cifras de pruebas.
- **ACCEPTANCE CRITERIA:** Cero discrepancias entre la documentación maestra y los tests ejecutables.
- **RISKS:** Ambigüedades residuales.
- **ROLLBACK:** Revisión de control de versiones.
- **EVIDENCE:** Archivo maestro actualizado y aprobado por el comité de arquitectura.

---

## SECUENCIA INMEDIATA DE EJECUCIÓN

Siguiendo la instrucción categórica del usuario:
1. **Completar emisión de este Plan Maestro (`BIOAZUCAR_MASTER_IMPLEMENTATION_PLAN.md`).**
2. **Ejecutar exclusivamente las fases fundacionales inmediatas:**
   - **`P0-00`**: Congelación del estado actual y reorganización de la gobernanza.
   - **`P0-01`**: Motor de Descubrimiento Industrial (`IndustrialDiscoveryEngine`).
   - **`P0-02`**: Endurecimiento del Registro Canónico de Tags (`IndustrialTagRegistryService`).
   - **`P0-03`**: Modelo Semántico Industrial ISA-95 y Motor de Resolución de Contexto (`SemanticModelService` / `ContextResolutionEngine`).
3. **Validar rigurosamente cada fase con pruebas automatizadas, linter y build antes de avanzar.**
