# BIOAZÚCAR 4.0 — CURRENT AUTHORITATIVE STATE (SSOT)

> **Documento Oficial de Estado Autoritativo y Reconciliación de Repositorio**  
> **Sistema:** BioAzúcar 4.0 — Unified Industrial Platform & Digital Twin for Sugar Mills & Biomass Cogeneration  
> **Versión Actual:** 4.0.0-I39-BIOAI-SAFETY-BOUNDARY  
> **Fecha y Hora de Verificación:** 2026-09-29T12:30:00Z (Local: 2026-09-29T05:30:00-07:00)  
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
   - El código real existente en el workspace verificado mediante compilador `tsc --noEmit` (0 errores), suite de pruebas Vitest (**63 suites, 705 pruebas 100% pasando, 0 fallos, 0 omitidos**), endpoints HTTP/Express reales en puerto 3000, y componentes React 19/Tailwind v4.
   - Datos operacionales persistidos en disco mediante SQLite WAL (`SqliteWalEngine.ts`), IndexedDB Vault (`IndustrialIndexedDbVault.ts`) en navegador y Firestore en la nube cuando está configurado.

2. **`HISTORICAL SNAPSHOT`:**
   - Registros de desarrollo pasados, actas de hitos cerrados en `BIOAZUCAR_MASTER_DEVELOPMENT.md` y `BIOAZUCAR_EXECUTION_BASELINE.md` (e.g. los conteos históricos de 41, 45, 59 y 60 suites que reflejan iteraciones previas).
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
| **Modelo de Estado Industrial**| Implementado (4 ejes separados)| `src/types/industrialStateModel.ts` | `industrialStateModelUnified.test.ts` | E3 |
| **Motor de Estado Industrial** | Implementado & Auditado | `src/services/runtime/IndustrialStateModelEngine.ts` | `industrialStateModelUnified.test.ts` | E3 |
| **Edge Daemon Hardened** | Implementado (Fail-Closed) | `src/services/edge/daemon.ts` | `edgeDaemonProductionHardeningAndSaf.test.ts` | E3 |
| **Dual-NIC OT/IT Isolation** | Implementado & Auditado | `src/services/edge/network/DualNicManager.ts` | `edgeDaemonProductionHardeningAndSaf.test.ts` | E3 |
| **IndexedDB Vault Industrial** | Implementado & Clasificado | `src/services/storage/IndustrialIndexedDbVault.ts` | `industrialDataClassificationAndStorage.test.ts` | E3 |
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
| **Ciberseguridad IEC 62443** | Implementado (SL3 Validado)| `src/services/security/Iec62443CertificationPack.ts` | `p0SecurityAuditEvidenceIec62443.test.ts` | E3 |
| **WebAuthn / FIDO2 Físico (YubiKey)** | Implementado (IEC 62443 SL3) | `src/services/security/webauthn/` | `i35WebAuthnFido2PhysicalSecurity.test.tsx` | E3 |
| **Blindaje Multi-Tenant & Anti-Spoofing** | Implementado (IEC 62443 SL3) | `src/server/authMiddleware.ts` | `i36MultiTenantAuthorizationHardening.test.ts` | E3 |
| **Gobernanza Agronómica & Calidad LIMS (I37)** | Implementado (IEC 62443 SL3) | `src/services/agriculture/AgronomicGovernancePipeline.ts` | `i37AgronomicDataGovernance.test.ts` | E3 |
| **Trazabilidad Criptográfica & Linaje de Extracción (I38)** | Implementado (IEC 62443 SL3) | `src/services/lineage/DataLineageEngine.ts` | `i38DataLineageAndCryptographicTraceability.test.ts` | E3 |
| **Frontera de Seguridad BioAI & Desacoplo Físico LLM (I39)** | Implementado (IEC 62443 SL3) | `src/services/bioai/safety/BioAiSafetyBoundaryEngine.ts` | `i39BioAiSafetyBoundaryAndPhysicalDecoupling.test.ts` | E3 |
| **Ciclo de Vida de Credenciales Superadmin & Despliegue** | Implementado (IEC 62443 SL3) | `src/services/security/SuperAdminCredentialsService.ts` | `i39BioAiSafetyBoundaryAndPhysicalDecoupling.test.ts` | E3 |

---

## 3. FUENTES DE VERDAD ELIMINADAS O DEPRECADAS

Para evitar duplicidad o desalineación:
1. **Valores por Defecto Ocultos Eliminados:** La plataforma no asume 450 TCH o 0.90 de disponibilidad de forma fija cuando no existe telemetría; los valores sin fuente válida reportan calidad `BAD` o `UNKNOWN`.
2. **Desacoplamiento Estricto OT/IT:** La aplicación web central no abre sockets directos a PLCs Modbus/OPC UA en producción; toda comunicación pasa obligatoriamente por el BioAzúcar Edge Daemon.
3. **Persistencia Local Segura:** La configuración de infraestructura, telemetría y datos de zafra no residen en `localStorage` del navegador; residen en la base de datos persistente SQLite WAL del servidor/Edge node o en IndexedDB Vault (`IndustrialIndexedDbVault.ts`) en el cliente.
4. **Erradicación de Metodología de Desarrollo en UI:** Eliminadas todas las etiquetas, códigos internos y menciones a "OLA 1..5", "P0", "P1", "P2" y ciclos internos de la interfaz operativa del producto. La interfaz representa exclusivamente conceptos industriales y operativos.
5. **Fail-Closed en Autenticación Edge en Producción:** Erradicado el uso de secretos por defecto en perfil `PRODUCTION`; si `BIOAZUCAR_EDGE_SECRET` falta o contiene un valor inseguro por defecto, el Edge Daemon aborta inmediatamente el arranque.
6. **Rechazo Mandatorio de HTTP en Producción:** En perfil `PRODUCTION`, el Edge Daemon rechaza endpoints de sincronización no cifrados `http://`; HTTPS o mTLS es obligatorio conforme a IEC 62443-3-3 FR5.
7. **Aislamiento Dual-NIC Verificado en Arranque:** El Edge Daemon audita el kernel (`net.ipv4.ip_forward == 0`) antes de iniciar para prevenir fugas de enrutamiento entre la red OT de campo y la red IT/DMZ.
8. **Contabilidad Estricta Store & Forward:** Medición y reporte en tiempo real de puntos generados, persistidos, recuperados, transmitidos, confirmados, duplicados y perdidos con resiliencia total ante caídas de enlace.
9. **Aislamiento Multi-Tenant Estricto (I36):** La inyección de cabecera `X-Tenant-Id` no autorizada es rechazada determinísticamente (código `TENANT_HEADER_SPOOFING_REJECTED`); particionado de auditoría y telemetría por tenant obligatorio con auditoría de intrusión transfronteriza `CROSS_TENANT_ACCESS_ATTEMPT`.
10. **Gobernanza Agronómica Estricta & Inmutabilidad LIMS (I37):** Validación fisiológica obligatoria de Saccharum officinarum (8.0°Bx - 28.0°Bx, 5.0% - 24.0% Pol, Pol <= Brix, Pureza <= 100%, Fibra 8% - 22%, Trash <= 25%). Sellado criptográfico SHA-256 inmutable de cada muestra de laboratorio con detección en tiempo real de manipulaciones maliciosas retroactivas y reconciliación de desvíos en báscula de batey.
11. **Linaje Criptográfico de Extracción & Encadenamiento de Bloques de Azúcar (I38):** Encadenamiento criptográfico por bloques inmutables (Merkle-style sequential ledger) desde el surco cañero (parcela/variedad) hasta el lote de azúcar terminado (SugarBatch), enlazando balances de extracción en tándem de molienda (Hugot), evaporación, cristalización y pureza de melaza, con verificación del Factor de Seguridad ICUMSA (humedad/(100-Pol) <= 0.25), detección inmediata de alteraciones retroactivas (tamper detection) y configuración explícita de usuario superadmin en variables de entorno (SUPERADMIN_EMAIL).
12. **Frontera de Seguridad BioAI & Desacoplo Físico de LLM (I39):** Delimitación estricta de 5 niveles de modelos BioAI (Física de Primeros Principios [Nivel 5 - Absoluto Hugot/ASME], Heurísticas Expertas [Nivel 3], Machine Learning [Nivel 2], Estadístico Empírico [Nivel 1] y Generativo LLM [Nivel 0 - Solo Asistencia Narrativa]). Regla inviolable: los modelos LLM tienen terminantemente prohibido emitir setpoints, ajustes de válvulas o comandos de control hacia PLCs o Secure Command Gateway (código `LLM_DIRECT_CONTROL_PROHIBITED`). Toda recomendación de máquina pasa obligatoriamente por el filtro de envolvente física (ASME PTC 4 y Hugot) y exige autorización humana previa (HITL) con rol supervisor o superior y sellado criptográfico SHA-256. La contraseña del superadmin se almacena en variable de entorno (`SUPERADMIN_PASSWORD`) para entornos de desarrollo y pruebas, mientras que en producción se exige su creación interactiva explícita o su promoción auditada bajo criterios de complejidad IEC 62443-4-2 (12+ caracteres, entropía >= 60 bits).
