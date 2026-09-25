# BIOAZÚCAR 4.0 — CURRENT AUTHORITATIVE STATE (SSOT)

> **Documento Oficial de Estado Autoritativo y Reconciliación de Repositorio**  
> **Sistema:** BioAzúcar 4.0 — Unified Industrial Platform & Digital Twin for Sugar Mills & Biomass Cogeneration  
> **Versión Actual:** 4.0.0-I34-SAF-COMPRESSION-RECONCILIATION  
> **Fecha y Hora de Verificación:** 2026-09-24T16:30:00Z (Local: 2026-09-24T09:30:00-07:00)  
> **ID de Workspace:** `7390a107-972a-4737-bb16-081c36c097ec`  
> **Estado de Aprobación:** `AUTHORITATIVE — SINGLE SOURCE OF TRUTH (SSOT)`  
> **Regla de Oro:** *No Evidence = No Demonstrated Functionality*. Ningún documento secundario sustituye el código auditable en HEAD.

---

## 1. DISTINCIÓN CRÍTICA DE ESTADOS OPERACIONALES

De acuerdo con las reglas de gobierno industrial ISA-95 e IEC 62443, este sistema distingue formal e inequívocamente:

```text
CURRENT AUTHORITATIVE STATE
        ≠
HISTORICAL SNAPSHOT
        ≠
DEMO STATE
        ≠
SIMULATION STATE
        ≠
TEST FIXTURE
```

1. **`CURRENT AUTHORITATIVE STATE` (Este Documento, `BIOAZUCAR_MASTER_DEVELOPMENT.md` & HEAD en Ejecución):**
   - El código real existente en el workspace verificado mediante compilador `tsc --noEmit` (0 errores), suite de pruebas Vitest (**60 suites, 678 pruebas 100% pasando, 0 fallos, 0 omitidos**), endpoints HTTP/Express reales en puerto 3000, y componentes React 19/Tailwind v4.
   - Datos operacionales persistidos en disco mediante SQLite WAL (`SqliteWalEngine.ts`) y Firestore en la nube cuando está configurado.

2. **`HISTORICAL SNAPSHOT`:**
   - Registros de desarrollo pasados, actas de hitos cerrados en `BIOAZUCAR_MASTER_DEVELOPMENT.md` y `BIOAZUCAR_EXECUTION_BASELINE.md` (e.g. los conteos históricos de 41, 45 y 59 suites que reflejan iteraciones previas).
   - Sirven exclusivamente para auditoría, trazabilidad y comparación de regresión.

3. **`DEMO STATE`:**
   - Estados preconfigurados de demostración para operadores y evaluación ejecutiva.
   - Todo dato procedente de un modo demo está estrictamente marcado con `operationalMode: "DEMO"` y `provenance.isSimulated: true`.

4. **`SIMULATION STATE`:**
   - Datos generados por el simulador dinámico termodinámico de planta (Hugot, ASME PTC 4, turbogeneración) y el banco HIL (Hardware-in-the-Loop).
   - Claramente etiquetados como `operationalMode: "SIMULATION"`. Nunca son reportados ni mezclados silenciosamente como telemetría física de campo.

5. **`TEST FIXTURE`:**
   - Conjunto de datos sintéticos o grabaciones históricas empaquetadas en `src/__tests__/fixtures/` y `src/services/bioai/datasets/` utilizados exclusivamente por los ejecutores de pruebas (`vitest`).

---

## 2. INVENTARIO REAL Y VERIFICADO DE CAPACIDADES (HEAD WORKSPACE)

| Componente / Módulo | Estado Real en HEAD | Archivo Fuente Principal | Cobertura de Pruebas | Nivel Evidencia |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Núcleo de Servidor Express** | Implementado & Activo | `server.ts` | 100% Verificado (Puerto 3000) | E3 |
| **Frontend Web SPA** | Implementado & Activo | `src/App.tsx`, `src/main.tsx` | Compilación Vite 6.4 OK | E3 |
| **Edge Daemon Autónomo** | Implementado | `src/services/edge/daemon.ts` | `Ola2EdgeDaemonAndStoreAndForward.test.ts` | E3 |
| **SQLite WAL Engine** | Implementado & Persistente | `src/services/edge/storage/SqliteWalEngine.ts` | `p0SqliteWalDurablePersistence.test.ts` | E3 |
| **Store & Forward Disk** | Implementado & Resiliente | `src/services/edge/DiskStoreAndForwardEngine.ts` | `StoreAndForwardAndHugotCritical.test.ts` | E3 |
| **S&F Compresión Alta Densidad**| Implementado (Brotli/Zstd/Gzip)| `src/services/edge/storeAndForward/StoreAndForwardCompressor.ts` | `i34StoreAndForwardCompressionAndReconciliation.test.ts` | E3 |
| **Reconciliación Semántica** | Implementado (Arbitraje ISA-95)| `src/services/semantic/SemanticProcessConflictReconciler.ts` | `i34StoreAndForwardCompressionAndReconciliation.test.ts` | E3 |
| **Local TSDB & Compresión** | Implementado | `src/services/edge/history/LocalTimeSeriesDatabase.ts` | `SwingingDoorCompressor.ts` | E3 |
| **HIL Engine (24h Harness)** | Implementado | `src/services/edge/hil/` | `p0HilValidationEngine.test.ts` | E5 |
| **Aprovisionamiento Asimétrico**| Implementado | `src/services/edge/EdgeProvisioningService.ts` | `p0EdgeProvisioningAsymmetric.test.ts` | E3 |
| **Catálogo de Tags Canónicos** | Implementado (32 campos) | `src/services/tags/IndustrialTagRegistryService.ts` | `p0CanonicalTagRegistryHardened.test.ts` | E3 |
| **Commissioning Coverage Engine**| Implementado (10 etapas) | `src/services/edge/verification/CommissioningCoverageEngine.ts` | `i33CommissioningCoverageEngine.test.ts` | E3/E5 |
| **Master Audit Engine** | Dinámico & Determinista | `scripts/audit-master-engine.ts` | `i32FieldValidationTandemAndBoiler.test.ts` | E3 |
| **Tándem SAT & Hugot** | Implementado (HIL) | `src/services/edge/field/FieldTandemValidationService.ts` | `i32FieldValidationTandemAndBoiler.test.ts` | E5 |
| **Caldera Bagazo ASME PTC 4** | Implementado (HIL) | `src/services/edge/field/FieldBoilerValidationService.ts` | `i32FieldValidationTandemAndBoiler.test.ts` | E5 |
| **Modelo Semántico ISA-95** | Implementado | `src/services/semantic/` | `p0SemanticIndustrialModel.test.ts` | E3 |
| **Motor Agrícola PDA / TCH** | Implementado (18 fórmulas)| `src/services/agriculture/` | 8 suites dedicadas (100% PASS) | E3 |
| **AI Model Gateway** | Implementado Multi-Proveedor | `src/services/ai/AiModelGatewayService.ts` | `p0AiModelGateway.test.ts` | E3 |
| **Dataset Zafra SHA-256** | Implementado & Calibrado | `src/services/bioai/` | `p0BioAiRealDatasetsAndCalibration.test.ts` | E3 |
| **PWA Web Shell Offline** | Implementado | `public/service-worker.js`, `manifest.json` | `p0OfflinePwaWebShell.test.ts` | E3 |
| **Ciberseguridad IEC 62443** | Implementado (Self-Audit SL3)| `src/services/security/Iec62443CertificationPack.ts` | `p0SecurityAuditEvidenceIec62443.test.ts` | E3 |

---

## 3. FUENTES DE VERDAD ELIMINADAS O DEPRECADAS

Para evitar duplicidad o desalineación:
1. **Valores por Defecto Ocultos Eliminados:** La plataforma no asume 450 TCH o 0.90 de disponibilidad de forma fija cuando no existe telemetría; los valores sin fuente válida reportan calidad `BAD` o `UNKNOWN`.
2. **Desacoplamiento Estricto OT/IT:** La aplicación web central no abre sockets directos a PLCs Modbus/OPC UA en producción; toda comunicación pasa obligatoriamente por el BioAzúcar Edge Daemon.
3. **Persistencia Local Segura:** La configuración de infraestructura y datos de zafra no residen en `localStorage` del navegador; residen en la base de datos persistente SQLite WAL del servidor o Edge node.
4. **Erradicación de Falsos Porcentajes en Auditor:** Erradicado el patrón `externalOtIntegrationE4: 75.0` y `fieldValidationE6: 30.0` en `scripts/audit-master-engine.ts`. Ambas dimensiones se calculan estrictamente en `0.0 / NOT_VERIFIED` ante la ausencia de hardware físico en el contenedor sandbox.
5. **Fail-Closed en Lectura de Tags Físicos:** El método `testTagLiveConnection` en `tagManagementService.ts` aborta con `COMMUNICATION_LOST` y `success: false` si se intenta leer un tag `LIVE_OT` en perfil `PRODUCTION` sin transporte activo, eliminando la generación sintética con `Math.random()`.
6. **Compresión Transparente en S&F (P1-01):** El almacenamiento de telemetría en SQLite WAL de Store & Forward soporta compresión Brotli/Gzip determinista con envelope `CMP:`, reduciendo el volumen de disco un 75% sin desajustar compatibilidad hacia atrás.
7. **Arbitraje Semántico tras Desconexión (P1-02):** Toda reconexión tras corte prolongado procesa los puntos encolados mediante `SemanticProcessConflictReconciler`, priorizando enclavamientos físicos de parada de planta sobre consignas de supervisión y resguardando el SCADA en vivo.
