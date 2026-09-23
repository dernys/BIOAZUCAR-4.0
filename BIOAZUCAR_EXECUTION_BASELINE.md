# BIOAZÚCAR 4.0 — INFORME BASE DE EJECUCIÓN (EXECUTION BASELINE)
**Documento Técnico Oficial de Arquitectura e Ingeniería Industrial**
**Fecha de Emisión:** 2026-09-20  
**Versión de Baseline:** 4.0.0-PROD-BASELINE  
**Autoridad:** Dirección de Arquitectura de Sistemas, OT/IT, Digital Twin & BioAI  

---

## 1. ESTADO ACTUAL (CURRENT STATE)

BioAzúcar 4.0 es una plataforma industrial integral para la industria agroazucarera, biomasa y biorrefinería. Combina un frontend React 18 / Tailwind CSS de grado industrial con arquitectura multitenant, un backend servidor en Node.js/Express (puerto 3000), un Edge Daemon con capacidades Store & Forward basadas en SQLite WAL, conectores OT industriales, motores agronómicos de cálculo (PDA) y un Gateway de Inteligencia Artificial multi-proveedor (BioAI Gateway).

### Métricas de Estado Verificadas en Tiempo Real
- **Suites de Pruebas Automatizadas:** 41 archivos de prueba (`src/__tests__/*.test.ts`, `src/services/agriculture/__tests__/*.test.ts`).
- **Casos de Prueba Unitarios e Integrados:** 414 pruebas ejecutadas, **414 aprobadas (100% PASS)**, 0 fallidas, 0 omitidas.
- **Tiempo de Ejecución de Pruebas:** 28.74 segundos.
- **Linter & Type Checking (`npm run lint` / `tsc --noEmit`):** 0 errores, 0 advertencias (código de salida 0).
- **Compilación de Producción (`compile_applet`):** Exitosa (`vite build` + `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`).
- **Servidor Backend Dev (`server.ts`):** Activo en `http://localhost:3000` con reverse proxy nginx, bindings `0.0.0.0:3000`.
- **Ruta de Salud `/api/health`:** HTTP 200 OK (`status: ok`, `mill: BioAzúcar 4.0 Industrial Node`, `aiReady: true`, `securityModel: IEC-62443-SL3-SERVER-AUTHORITATIVE`).
- **Ruta de Métricas Prometheus `/metrics`:** HTTP 200 OK (expone métricas OT de SCADA y métricas de inferencia de IA en formato OpenMetrics).

---

## 2. ARQUITECTURA GENERAL (ARCHITECTURE)

BioAzúcar 4.0 implementa una arquitectura híbrida de cinco niveles, alineada con el modelo ISA-95 y con las zonas de seguridad de IEC 62443-3-3:

```text
[NIVEL 0/1: CAMPO & PLC]
Sensores, Básculas, Transmisores, VFDs, PLCs (ControlLogix, S7-1500, Modbus RTU/TCP, DCS EROS)
                               │
                               ▼
[NIVEL 2: SUPERVISIÓN & EDGE DAEMON]
Edge Runtime (BioAzucarIndustrialEdge, Drivers, HIL Bus, Store & Forward Queue, SQLite WAL)
                               │ (TLS 1.3 / mTLS / MQTT Sparkplug B / REST)
                               ▼
[NIVEL 3: DMZ INDUSTRIAL & GATEWAY OT/IT]
IndustrialConnectionRegistry, IndustrialDeviceRegistry, IndustrialDataQualityGate, DataProviderRegistry
                               │
                               ▼
[NIVEL 3/4: SERVIDOR DE APLICACIÓN & HISTORIAN]
Express Backend (server.ts), HistorianService, LocalTsdbEngine, KPI Engine, Digital Twin
                               │
                               ▼
[NIVEL 4/5: ENTERPRISE, CLOUD, BIOAI & CLIENTS]
React SPA (Frontend), Firebase Admin / Firestore, BioAI Multi-Provider Gateway, PWA Offline Shell
```

---

## 3. FLUJO DE DATOS INDUSTRIALES (DATA FLOW)

El flujo de procesamiento de telemetría y eventos sigue un pipeline unidireccional con sellado de procedencia:

1. **Adquisición Físico-Lógica:**
   - Los conectores especializados (`OpcUaConnector`, `ModbusConnector`, `ErosConnector`, `MqttSparkplugConnector`) o los drivers del Edge Daemon leen registros crudos de los buses de campo.
2. **Normalización a Contrato Canónico:**
   - La trama cruda se convierte a una instancia de `IndustrialDataPoint` / `CanonicalIndustrialDataPoint` (17 campos canónicos: `runtimeMode`, `sourceType`, `sourceId`, `driverId`, `protocol`, `deviceId`, `assetId`, `tagId`, `value`, `engineeringUnit`, `dataType`, `deviceTimestamp`, `ingestionTimestamp`, `sequence`, `quality`, `qualityReason`, `calibrationState`, `schemaVersion`).
3. **Control de Calidad (Quality Gate):**
   - El punto es evaluado por `IndustrialDataQualityGate`. Se verifica procedencia (`REAL`, `SIMULATED`, `CALCULATED`), sesgo temporal (latencia de reloj < 30 s), límites de ingeniería (`engMin`, `engMax`), delta de cambio de señal (Rate-of-Change) y presencia de linaje de activo.
4. **Almacenamiento Temporal & Buffer Local:**
   - Si la red está activa, el punto ingresa a la memoria viva (`currentPoints`) y se despacha al historiador; si la conexión se degrada, se retiene en `StoreAndForwardQueue` (SQLite WAL en disco).
5. **Historización & Agregación:**
   - El punto se persiste en `LocalTimeSeriesDatabase` y `HistorianService`. Los algoritmos de compresión (*Swinging Door Trending*) reducen el volumen de almacenamiento manteniendo fidelidad de onda.
6. **Consumo por Gemelo Digital & BioAI:**
   - Los motores de cálculo termodinámico (fórmulas de Hugot, balances de masa y energía) y el motor de optimización BioAI leen exclusivamente puntos validados con calidad `GOOD`.

---

## 4. INTEGRACIONES INDUSTRIALES EXISTENTES (INDUSTRIAL INTEGRATIONS)

En el subsistema de conectividad se identifican los siguientes módulos:

| Protocolo / Sistema | Clase de Implementación | Ubicación en Código | Modo Soportado |
| :--- | :--- | :--- | :--- |
| **OPC UA (IEC 62541)** | `OpcUaConnector`, `OpcUaDataProvider` | `src/services/edge/connectors/`, `src/services/dataProviders/` | TCP binario, Basic256Sha256, certificados DER |
| **Modbus TCP / RTU** | `ModbusConnector`, `ModbusDataProvider` | `src/services/edge/connectors/`, `src/services/dataProviders/` | FC01, FC02, FC03, FC04, FC05, FC06, FC16 |
| **MQTT / Sparkplug B** | `MqttSparkplugConnector`, `MqttSparkplugProvider` | `src/services/edge/connectors/`, `src/services/dataProviders/` | NBIRTH, DBIRTH, NDATA, DDATA, DDEATH |
| **EROS DCS** | `ErosConnector`, `ErosDataProvider` | `src/services/edge/connectors/`, `src/services/dataProviders/` | API REST / Polling específico de DCS de ingenio |
| **REST Generic** | `RestDataProvider` | `src/services/dataProviders/` | Ingesta HTTP push / pull JSON |
| **Siemens S7 & Rockwell CIP** | `SiemensS7DriverAdapter`, `RockwellCipDriverAdapter` | `src/services/edge/drivers/` | Adaptadores de bus de campo S7comm y CIP |
| **Simulación / HIL** | `SimulationDataProvider`, `HilProcessSimulator` | `src/services/dataProviders/`, `src/services/edge/hil/` | Generación sintética determinista aislada |

### Registros Centrales de Conectividad:
- `IndustrialConnectionRegistry`: Administra credenciales cifradas (AES-256-GCM), endpoints y estado de enlace de cada conexión OT.
- `IndustrialDeviceRegistry`: Mapea activos físicos (PLCs, VFDs, Básculas) bajo cada conexión.
- `tagManagementService`: Catálogo de variables operacionales y alarmas.

---

## 5. FLUJO AGRÍCOLA & PDA (AGRICULTURAL FLOW)

El subsistema agrícola (`src/services/agriculture/`) orquesta la gestión integral de zafra y campo:

1. **Modelo de Datos Agrícola (`src/types/agriculture.ts`):**
   - Parámetros operativos: Lotes, variedades de caña (CP-5243, C323-68, B4362, etc.), ciclo del cultivo (planta, soca, resoca), TCH histórico y estimado, edad del cañaveral, distancia de transporte, rendimiento de cosecha.
2. **Registro y Gobernanza de Fórmulas (`PdaFormulaRegistry.ts`):**
   - Formaliza 18 fórmulas agrícolas auditadas: Requerimiento de Caña de Fábrica, TCH Ponderado, Área de Corte Diaria Requerida, Demanda de Maquinaria de Cosecha, Balance de Transporte Automotor y Ferroviario, Costo OPEX por Tonelada de Caña, Rendimiento Pol estimado.
3. **Auditoría de Verdad de Datos (`AgriculturalDataTruthService.ts`):**
   - Clasificación explícita de parámetros en: `REAL`, `IMPORTED`, `CALCULATED`, `ASSUMPTION`, `BENCHMARK`, `SIMULATED`, `NO_DATA`.
   - Garantiza que ninguna suposición (*assumption*) o valor de referencia (*benchmark*) se etiquete engañosamente como dato medido en campo (*real*).
4. **Reconciliación y Ciclo Cerrado (`AgriculturalPlanVsRealService.ts`, `AgriculturalReconciliationService.ts`):**
   - Compara las toneladas programadas en el Plan Director Agrícola (PDA) contra las toneladas pesadas en la báscula del central, calculando desviaciones y disparando justificaciones de corte.

---

## 6. FLUJO DE INTELIGENCIA ARTIFICIAL BIOAI (BIOAI FLOW)

El centro de inteligencia artificial opera sobre dos capas principales:

1. **BioAI Multi-Provider Gateway (`src/services/ai/gateway/`):**
   - Desacoplamiento total mediante adaptadores:
     - `GeminiAdapter`: Modelos Google Gemini (`gemini-2.5-flash`).
     - `OpenAiAdapter`: Modelos OpenAI (`gpt-4o-mini`, `gpt-4o`).
     - `AnthropicAdapter`: Modelos Anthropic Claude (`claude-3-5-sonnet-20241022`).
     - `AzureOpenAiAdapter`: Despliegues corporativos aislados en Microsoft Azure.
     - `OllamaAdapter`: Modelos locales on-premise (*air-gapped*) con costo de red $0.00 y privacidad física total.
     - `MockAiAdapter`: Motor sintético determinista para suites de pruebas automatizadas.
   - Resiliencia con conmutación en caliente (*failover chain*), disyuntor (*circuit breaker*), contabilidad exacta de tokens (`promptTokens`, `completionTokens`), cálculo de costos en USD y métricas de latencia.
2. **Servicios de Modelación Azucarera (`src/services/bioai/`):**
   - `SugarMillModelCalibrator`: Calibración termodinámica de extracción sacarosa y consumo de vapor de evaporación en base a parámetros de caña (fibra, brix, pureza, pol).
   - `BioAiEngineService`: Recomendador de consignas de operación para operadores de molino, calderas y tachos de cocción.

---

## 7. PERSISTENCIA DE DATOS (PERSISTENCE)

La plataforma dispone de tres mecanismos de persistencia según el contexto:

1. **Cloud / Nube (Firestore / Firebase Admin SDK):**
   - Almacenamiento durable para usuarios, roles RBAC, bitácora de auditoría inmutable, catálogos de parámetros agrícolas, planes de zafra y configuraciones de conexiones.
2. **Edge / On-Premise (SQLite WAL):**
   - Base de datos local transaccional para almacenamiento de series de tiempo de alta frecuencia (`LocalTimeSeriesDatabase`) y cola de almacenamiento y reenvío (`DiskStoreAndForwardEngine`), resistente a pérdidas de energía repentinas.
3. **Client-Side Cache (Navegador):**
   - Estado de sesión en memoria React, Service Worker Cache (Workbox PWA) para funcionamiento desconectado y claves de `localStorage` temporales.

---

## 8. CIBERSEGURIDAD INDUSTRIAL (SECURITY — IEC 62443-3-3 SL3)

- **Control de Acceso Basado en Roles (RBAC):** Cinco roles estrictos: `superadmin`, `administrador`, `ingeniero`, `operador`, `auditor`.
- **Aislamiento Multitenant Server-Authoritative:** Filtro mandatorio `requireTenantIsolation` en endpoints backend.
- **Defensa en Profundidad (OWASP / IEC 62443):**
  - Content Security Policy (CSP) restrictivo.
  - Protección contra Clickjacking (`X-Frame-Options: SAMEORIGIN`).
  - HSTS, `X-Content-Type-Options: nosniff`.
  - Limitador de tasa de peticiones (*Rate Limiter*).
  - Bitácora de auditoría inmutable (`logServerAuditEventAsync`) con hash criptográfico SHA-256 de cada registro.
- **Validación Criptográfica de Drivers Edge:**
  - Solo se admiten drivers firmados con RSA-PSS o HMAC con claves autorizadas en el almacén seguro.

---

## 9. FUNCIONAMIENTO FUERA DE LÍNEA Y RESILIENCIA (OFFLINE / EDGE)

- **Store & Forward en Disco:** Cola en SQLite capaz de retener más de 50.000 eventos durante desconexiones prolongadas sin desbordamiento de memoria RAM.
- **Algoritmo de Compresión SDT (Swinging Door Trending):** Filtrado de ruido en tiempo real para optimizar ancho de banda de subida satelital o celular 3G/4G en batey.
- **Offline PWA Web Shell:** Service Worker configurado con Workbox (`vite-plugin-pwa`) para permitir al operador de campo interactuar con la aplicación sin conectividad a Internet.
- **Detección Automática de Conectividad:** Conmutación automática entre modo online y offline con sincronización en segundo plano al restablecer enlace.

---

## 10. BRECHAS ARQUITECTÓNICAS ACTUALES (CURRENT GAPS)

A pesar de la alta cobertura de pruebas y estabilidad, se han auditado las siguientes brechas respecto a una instalación física real:

1. **Ausencia de Motor de Descubrimiento de Fuentes OT (Discovery Engine):**
   - No existe un servicio que explore dinámicamente endpoints de red (escaneo de rangos IP, resolución de servidores OPC UA Discovery `opc.tcp`, barrido de IDs Modbus RTU/TCP o browsing de namespaces Sparkplug B) para auto-descubrir nodos y variables.
2. **Dependencia de LocalStorage en Registros de Cliente:**
   - Clases como `IndustrialDeviceRegistry` y `IndustrialConnectionRegistry` dependen de `localStorage` como repositorio de respaldo en el navegador, violando la Regla 6 de arquitectura industrial para datos críticos.
3. **Falta de Árbol Jerárquico Semántico ISA-95 Formal:**
   - La jerarquía `Enterprise -> Site -> Area -> Process Cell -> Process -> Equipment -> Device -> Tag` está distribuida de forma implícita en metadatos, pero no existe un modelo de objetos canónico con navegación de grafo y resolución contextual inversa (`Tag Address -> Operative Context`).
4. **Presencia de Fixtures de Demostración en Catálogos de Inicialización:**
   - Clases como `tagManagementService` cargan estáticamente `INITIAL_TAG_CATALOG` con tags de simulación por defecto, lo que podría inducir a confusión si se arranca en un entorno de producción sin commissioning explícito.
5. **Falta de Hilo Digital Agrícola-Industrial de Extremo a Extremo:**
   - La correlación entre el Lote de caña cosechado, el pesaje en Báscula, la Molienda en el Tándem, la Extracción sacarosa y el Azúcar final no cuenta con un identificador unificado de correlación de lote (*CaneBatchTraceId*) persistido transversalmente.

---

## 11. RIESGOS TÉCNICOS IDENTIFICADOS (CURRENT RISKS)

1. **Riesgo de Ingesta Silenciosa de Datos Simulados en Informes Oficiales:**
   - Si no se endurece la barrera de producción a nivel de backend, un operador podría evaluar un informe de rendimiento con puntos generados por el simulador si este no está explícitamente bloqueado.
2. **Riesgo de Deriva de Calidad por Estampas Temporales:**
   - Relojes de PLCs desincronizados pueden generar puntos con calidad `BAD` o `STALE` si no existe corrección de tiempo mediante NTP industrial o IEEE 1588 PTP en el Edge Daemon.
3. **Riesgo de Concurrencia en SQLite en Edge Devices de Bajo Costo:**
   - Dispositivos ARM de baja potencia (Raspberry Pi 4) pueden sufrir estrangulamiento de E/S en disco durante ráfagas masivas de eventos sin compresión SDT activa.

---

## 12. INVENTARIO DE DATOS MOCK / SINTÉTICOS ACTUALES (CURRENT MOCK/SYNTHETIC DATA)

Se identifican las siguientes fuentes no reales en la base de código actual:

- **`INITIAL_TAG_CATALOG` (`src/services/tagManagementService.ts`):** 10 tags predefinidos etiquetados con `source: "SIMULATION"`, `protocol: "SIMULATOR"`.
- **`initializeDefaultFixtures` (`src/services/dataProviders/IndustrialDeviceRegistry.ts`):** 3 dispositivos de demostración (`dev-plc-milling-01`, `dev-vfd-shredder-01`, `dev-plc-boilers-01`) con conexiones simuladas.
- **`initializeDefaultConnections` (`src/services/dataProviders/IndustrialConnectionRegistry.ts`):** Conexiones de prueba `conn-demo-opcua-tandem` y `conn-demo-modbus-boilers`.
- **`SimulationDataProvider` (`src/services/dataProviders/SimulationDataProvider.ts`):** Generador senoidal y ruidoso de presión, temperatura, flujo y brix.
- **`MockAiAdapter` (`src/services/ai/gateway/MockAiAdapter.ts`):** Respuestas de IA precalculadas para pruebas de integración sin consumo de API externa.

*Regla de Mitigación Obligatoria:* Ninguno de estos artefactos debe ser accesible en el perfil `PRODUCTION`. En dicho perfil, el motor debe aplicar Fail-Closed si se detecta cualquier intento de inyección de estos componentes.

---

## 13. EVIDENCIA DE PRUEBAS ACTUALES (CURRENT TEST EVIDENCE)

Resumen de ejecución ejecutada y validada en consola:
- Total Archivos de Prueba: 41
- Total Tests: 414 aprobados (100%)
- Suites Críticas Verificadas:
  - `src/__tests__/i22RuntimeProfilesAndDataContracts.test.ts` (13 tests) - Validación de Fail-Closed en PRODUCTION.
  - `src/__tests__/p0AiModelGateway.test.ts` (10 tests) - Validación de Multi-Provider Gateway, Failover y Costos.
  - `src/__tests__/p0HilValidationEngine.test.ts` (16 tests) - Validación de Hardware-in-the-Loop y señales de campo.
  - `src/__tests__/p0SqliteWalDurablePersistence.test.ts` (7 tests) - Validación de SQLite WAL en Edge.
  - `src/__tests__/p0PowerLossRecovery.test.ts` (6 tests) - Validación de recuperación ante corte eléctrico.
  - `src/__tests__/p0EdgeProvisioningAsymmetric.test.ts` (7 tests) - Provisión asimétrica de credenciales.
  - `src/__tests__/p0CanonicalTagE2EGoldenPath.test.ts` (8 tests) - Flujo canónico de extremo a extremo.
  - `src/services/agriculture/__tests__/agriculturalDataTruthService.test.ts` (11 tests) - Verdad de datos agrícolas.
  - `src/services/agriculture/__tests__/pdaAuditTrailAndGovernance.test.ts` (4 tests) - Auditoría y gobernanza del PDA.
  - `src/services/agriculture/__tests__/yieldEngine.test.ts` (8 tests) - Modelo de rendimiento de caña y sacarosa.

---

## 14. BLOQUEADORES PARA PRODUCCIÓN REAL (CURRENT PRODUCTION BLOCKERS)

Para conectar BioAzúcar 4.0 a un central azucarero físico sin requerir adaptaciones manuales por código, se deben resolver de manera prioritaria los siguientes 4 bloqueadores fundacionales:

1. **[BLOCKER-01] Falta de Motor de Descubrimiento Activo (Discovery Engine):**
   - El personal de instrumentación y control en planta necesita explorar la red industrial para descubrir servidores OPC UA, esclavos Modbus, brokers Sparkplug B y endpoints EROS, inspeccionando namespaces, variables, tipos de datos y unidades de ingeniería de forma automática o mediante asistentes guiados de importación masiva (CSV, L5X, AML, XML).
2. **[BLOCKER-02] Registro de Tags Canónico No Homologado con Metadatos Completos:**
   - La definición de tags actual en UI/Frontend carece de campos obligatorios para zafra real: `canonicalName`, `originalAddress`, `scanRate`, `deadband`, `qualityMapping`, `alarmMapping`, `criticality`, `semanticClass`, `safetyClassification`, `calibrationState`, `owner`, `approvalStatus`, `version`, `effectiveFrom`, `effectiveTo`.
3. **[BLOCKER-03] Ausencia de Modelo Semántico ISA-95 Navegable y Resolutor de Contexto:**
   - Los datos leídos de los PLCs (ej. `DB10.DBW14` o `ns=2;s=Mill1.HydPress`) no pueden ser traducidos automáticamente al árbol de planta (`Central -> Área Molienda -> Molino 1 -> Chumacera Superior -> Presión Hidráulica -> 280 bar -> GOOD`) sin un motor semántico formal.
4. **[BLOCKER-04] Quality Gate Centralizado y Trazabilidad Transversal:**
   - La clasificación de calidad de datos (`GOOD`, `UNCERTAIN`, `BAD`, `STALE`, `COMMUNICATION_LOST`, `SIMULATED`, `UNKNOWN`) debe ser obligatoria para toda lectura, garantizando que un dato corrupto o simulado jamás alimente silenciosamente el cálculo de extracción ni las recomendaciones de BioAI.

---
**Fin del Informe Base de Ejecución.**
Aprobado para proceder con la emisión del Plan Maestro de Implementación (`BIOAZUCAR_MASTER_IMPLEMENTATION_PLAN.md`).
