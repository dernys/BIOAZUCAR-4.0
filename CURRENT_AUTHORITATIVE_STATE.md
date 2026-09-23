# BIOAZÚCAR 4.0 — CURRENT AUTHORITATIVE STATE (SSOT)

> **Documento Oficial de Estado Autoritativo y Reconciliación de Repositorio**  
> **Sistema:** BioAzúcar 4.0 — Unified Industrial Platform & Digital Twin for Sugar Mills & Biomass Cogeneration  
> **Versión Actual:** 4.0.0-PROD  
> **Fecha y Hora de Verificación:** 2026-09-20T09:08:00-07:00 (UTC: 2026-09-20 16:08:00)  
> **ID de Workspace:** `7390a107-972a-4737-bb16-081c36c097ec`  
> **Estado de Aprobación:** `AUTHORITATIVE — SINGLE SOURCE OF TRUTH (SSOT)`

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

1. **`CURRENT AUTHORITATIVE STATE` (Este Documento & HEAD en Ejecución):**
   - El código real existente en el workspace verificado mediante compilador `tsc --noEmit`, suite de pruebas Vitest (45 suites, 442 pruebas 100% pasando), endpoints HTTP/Express reales en puerto 3000, y componentes React/Tailwind.
   - Datos operacionales persistidos en disco mediante SQLite WAL (`SqliteWalEngine.ts`) y Firestore en la nube cuando está configurado.

2. **`HISTORICAL SNAPSHOT`:**
   - Registros de desarrollo pasados, actas de hitos cerrados (ej. `BIOAZUCAR_MASTER_DEVELOPMENT.md` en sus secciones de historial) y snapshots de zafra inmutables (`zafraHistoricalData.ts`).
   - Sirven exclusivamente para auditoría, trazabilidad y comparación de regresión.

3. **`DEMO STATE`:**
   - Estados preconfigurados de demostración para operadores y evaluación ejecutiva.
   - Todo dato procedente de un modo demo está estrictamente marcado con `operationalMode: "DEMO"` y `provenance.isSimulated: true`.

4. **`SIMULATION STATE`:**
   - Datos generados por el simulador dinámico termodinámico de planta (Hugot, ASME PTC 4, turbogeneración) y el banco HIL (Hardware-in-the-Loop).
   - Claramente etiquetados como `operationalMode: "SIMULATION"`. Nunca son reportados ni mezclados silenciosamente como telemetría física de campo.

5. **`TEST FIXTURE`:**
   - Conjunto de datos sintéticos o grabaciones históricas empaquetadas en `src/__tests__/fixtures/` utilizados exclusivamente por los ejecutores de pruebas (`vitest`). Aislados en memoria y directorios temporales `data/test-*`.

---

## 2. INVENTARIO REAL Y VERIFICADO DE CAPACIDADES (HEAD WORKSPACE)

| Componente / Módulo | Estado Real en HEAD | Archivo Fuente Principal | Cobertura de Pruebas |
| :--- | :--- | :--- | :--- |
| **Núcleo de Servidor** | Implementado & Activo | `server.ts` | 100% Verificado |
| **Frontend Web SPA** | Implementado & Activo | `src/App.tsx`, `src/main.tsx` | Compilación Vite OK |
| **Edge Daemon Autónomo** | Implementado | `src/services/edge/daemon.ts` | `Ola2EdgeDaemonAndStoreAndForward.test.ts` |
| **SQLite WAL Engine** | Implementado & Persistente | `src/services/edge/storage/SqliteWalEngine.ts` | `p0SqliteWalDurablePersistence.test.ts` |
| **Store & Forward Disk** | Implementado & Resiliente | `src/services/edge/DiskStoreAndForwardEngine.ts` | `StoreAndForwardAndHugotCritical.test.ts` |
| **Local TSDB & Compresión** | Implementado | `src/services/edge/history/LocalTimeSeriesDatabase.ts` | `SwingingDoorCompressor.ts` |
| **HIL Engine (24h Harness)** | Implementado | `src/services/edge/hil/` | `p0HilValidationEngine.test.ts` |
| **Aprovisionamiento Asimétrico** | Implementado | `src/services/edge/EdgeProvisioningService.ts` | `p0EdgeProvisioningAsymmetric.test.ts` |
| **Catálogo de Tags Canónicos** | Implementado (32 campos) | `src/services/tags/CanonicalTagRegistry.ts` | `p0CanonicalTagRegistryHardened.test.ts` |
| **Modelo Semántico ISA-95** | Implementado | `src/services/semantic/` | `p0SemanticIndustrialModel.test.ts` |
| **Motor Agrícola PDA / TCH** | Implementado (18 fórmulas) | `src/services/agriculture/` | 8 suites dedicadas (100% PASS) |
| **AI Model Gateway** | Implementado Multi-Proveedor | `src/services/ai/AiModelGatewayService.ts` | `p0AiModelGateway.test.ts` |
| **Dataset Zafra SHA-256** | Implementado & Calibrado | `src/services/bioai/` | `p0BioAiRealDatasetsAndCalibration.test.ts` |
| **PWA Web Shell Offline** | Implementado | `public/service-worker.js`, `manifest.json` | `p0OfflinePwaWebShell.test.ts` |
| **Deployment P0-26 (Esta Fase)**| En Implementación | `deploy/` | `p0ProductionDeploymentAndRecovery.test.ts` |

---

## 3. FUENTES DE VERDAD ELIMINADAS O DEPRECADAS

Para evitar duplicidad o desalineación:
1. **Valores por Defecto Ocultos Eliminados:** La plataforma ya no asume 450 TCH o 0.90 de disponibilidad de forma fija cuando no existe telemetría; los valores sin fuente válida reportan calidad `BAD` o `UNKNOWN`.
2. **Desacoplamiento Estricto OT/IT:** La aplicación web central no abre sockets directos a PLCs Modbus/OPC UA en producción; toda comunicación pasa obligatoriamente por el BioAzúcar Edge Daemon.
3. **Persistencia Local Segura:** La configuración de infraestructura y datos de zafra no residen en `localStorage` del navegador; residen en la base de datos persistente SQLite WAL del servidor o Edge node.
