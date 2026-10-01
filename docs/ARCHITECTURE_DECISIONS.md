# BIOAZÚCAR 4.0 — ARCHITECTURAL DECISION RECORDS (ADR)

> **Norma de Referencia:** IEC 62443-3-3 SL3 / ISA-95 Level 3/4  
> **Sistema:** BioAzúcar 4.0 — Unified Industrial Platform & Digital Twin for Sugar Mills & Biomass Cogeneration  
> **Estado:** AUTORITATIVO & VERIFICADO EN CÓDIGO  

---

## ADR-011: BioAI Control Plane Architecture

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** La observabilidad básica previa de pasarela IA no permitía gobernar proveedores, modelos, presupuestos, herramientas industriales ni políticas de contingencia en un único punto de control.
- **Decisión:** Transformar la pasarela en `BioAI Control Center` (`BioAiControlCenterView.tsx`), articulando 17 módulos de gobernanza (Overview, Providers, Models, API Connections, Routing, Fallback, Budgets, Token Usage, Cost Analytics, Copilot, RAG, Tools, Prompts, Policies, Local AI, Health, Audit).
- **Consecuencias:** Visibilidad holística y gobernanza centralizada sin romper los contratos del gateway subyacente.

---

## ADR-012: Persistent AI Model Registry

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** Se requería un registro persistente que formalizara capacidades (visión, audio, herramientas, salida estructurada), ventana de contexto, entorno de despliegue y estado de ciclo de vida de los modelos.
- **Decisión:** Implementar `AiModelRegistry` con soporte CRUD exhaustivo (CREATE, READ, UPDATE, DELETE, ENABLE, DISABLE, TEST CONNECTION, TEST MODEL) sincronizado con el registro de precios.
- **Consecuencias:** Desacoplamiento entre adaptadores de bajo nivel y modelos operacionales disponibles para los operadores e ingenieros.

---

## ADR-013: Real AI Pricing Registry with Source Verification

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** Hardcodear precios dentro de adaptadores o inventar tarifas inducía a distorsiones financieras inaceptables en plantas agroindustriales.
- **Decisión:** Crear `AiPricingRegistry` con tarifas versionadas por token de entrada, token cacheado (descuento 75%), escritura de caché, token de salida y tokens de razonamiento. Cada tarifa incluye obligatoriamente `pricingSource`, `sourceUrl`, `verifiedAt` y marca explícita `PRICE_UNVERIFIED` si no proviene de documentación oficial verificada.
- **Consecuencias:** Auditoría financiera auditable y trazabilidad contractual de costes de IA.

---

## ADR-014: AI Cost & Token Audit Ledger (Estimated vs Actual)

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** Se requería separar estrictamente los costes estimados de la facturación real retornada por proveedores y evitar escrituras masivas en Firestore por cada token de telemetría.
- **Decisión:** Implementar `AiCostLedger` como libro mayor local en memoria y almacenamiento duradero con diferenciación entre `estimatedCostUsd`, `actualCostUsd` y `costVarianceUsd`.
- **Consecuencias:** Eliminación de sobrecostes por escrituras de control-plane y reporte fidedigno de latencias (p50, p95, p99) y variaciones de costes.

---

## ADR-015: Configurable Industrial Budget Engine

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** Las inferencias de LLM sin control de cuotas pueden sobrepasar presupuestos operativos o amenazar la viabilidad económica en zafra.
- **Decisión:** Crear `AiBudgetEngine` con reglas jerárquicas (GLOBAL, TENANT, USER, MODULE, PROVIDER, MODEL), umbrales (80% WARNING, 90% CRITICAL, 100% EXCEEDED) y políticas ejecutivas automáticas: `BLOCK`, `FALLBACK_TO_LOCAL`, `SWITCH_TO_CHEAPER_MODEL` y `REQUIRE_ADMIN_APPROVAL`.
- **Consecuencias:** Protección proactiva contra desbordamiento de costes sin corte abrupto del servicio operativo.

---

## ADR-016: Intelligent Industrial AI Router

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** Una consulta simple de operador no debe invocar un modelo de razonamiento pesado de $5.00/1M tokens, mientras que un análisis de causa raíz requiere alta capacidad analítica.
- **Decisión:** Diseñar `AiRouter` con matriz de decisión multi-criterio basada en `useCase`, `complexity`, `latencySla`, `costSensitivity`, `privacyLevel`, estado de salud del proveedor y presupuesto disponible. Cada decisión registra su justificación explícita (`routingRationale`).
- **Consecuencias:** Asignación óptima de carga: consultas rutinarias a Flash/Lite, diagnósticos complejos a modelos de razonamiento y datos confidenciales OT confinados a Ollama local.

---

## ADR-017: Industrial Copilot Controlled Tool Calling & Grounded Evidence

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** El asistente industrial no debe consultar bases de datos en bruto mediante SQL libre ni alucinar parámetros de proceso.
- **Decisión:** Implementar `CopilotEvidenceEngine` con 16 herramientas controladas (`queryHistorian`, `getLivePlantState`, `getAlarms`, `getEquipmentState`, `getProduction`, `getEnergy`, `getBoilerState`, `getCogenerationState`, `getAgricultureState`, `getMaintenance`, `getLimsResults`, `getOee`, `searchRag`, `calculate`, `comparePeriods`, `generateReport`). Cada respuesta etiqueta su procedencia inequívocamente como `REAL`, `SIMULATED`, `HISTORICAL`, `RAG`, `HEURISTIC` o `LLM`.
- **Consecuencias:** Cumplimiento de la regla de oro: *No Evidence = No Demonstrated Functionality*. Respuestas fundamentadas en telemetría auditada.

---

## ADR-018: RAG Governance & Telemetry Stream Decoupling

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** La base de conocimiento vectorial no debe inundarse con series temporales RAW de alta frecuencia provenientes de SCADA.
- **Decisión:** Establecer `AiRagGovernanceService` para procedimientos operativos estándar (SOP), manuales de equipo y normativas técnicas, implementando un filtro estricto que rechaza volcados directos de telemetría numérica cruda.
- **Consecuencias:** Precisión en recuperación semántica (relevance score >90%) y preservación del Historiador TSDB para series temporales.

---

## ADR-019: Cross-Module Fullscreen UX & Viewport Protection

- **Estado:** ACEPTADO & IMPLEMENTADO
- **Contexto:** En salas de control de ingenios y tablets industriales, los operadores necesitan maximizar el área gráfica útil sin perder navegación básica ni alterar RBAC o variables de proceso.
- **Decisión:** Implementar la terna reutilizable `useModuleFullscreen`, `ModuleFullscreenButton` y `FullscreenModuleLayout`. En modo pantalla completa, se utiliza la API Fullscreen con fallback visual seguro en CSS viewport, ocultando docks inferiores y footers mientras se preserva una barra flotante con botón de salida (Esc) y navegación mínima.
- **Consecuencias:** Experiencia transversal homogénea en los 17 módulos de la suite BioAzúcar 4.0 sin duplicación de código ni riesgo sobre la seguridad industrial.
