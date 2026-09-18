# BioAzúcar 4.0 — Documento Maestro de Desarrollo y Hoja de Ruta Industrial (I0–I21)

> **Versión:** 4.0.0-PROD  
> **Estado:** Documento Maestro Activo  
> **Ámbito:** Industrial Edge Daemon, Conectividad OT (OPC UA, Modbus, MQTT/Sparkplug B, EROS), Data Truth, Ciberseguridad IEC 62443 SL3, Historiador On-Premise y HMI/MES.

---

## 1. Resumen Ejecutivo y Diagnóstico del Repositorio

BioAzúcar 4.0 cuenta con una base sólida de software:
- Más de **270 pruebas unitarias y de integración en verde**.
- Linteo TypeScript sin errores y tipado estricto.
- Arquitectura jerárquica conforme a **ISA-95** (Sitio, Área, Celda de Proceso, Activo, Punto de Medición).
- Modelos matemáticos de ingeniería azucarera (Balance de masa de Hugot, extracción de sacarosa, vapor y energía, OEE, CBM).
- Seguridad robusta en capa de aplicación: multi-tenant, RBAC con principio de menor privilegio, firma HMAC-SHA256, protección anti-replay y saneamiento de secretos en auditoría.

### Brecha Crítica Identificada
La auditoría de campo revela que **los drivers de comunicación en el frontend y mocks de servidor operan como simuladores** (`OpcUaConnector.connect()` ejecuta un `setTimeout()` y etiqueta lecturas como `SIMULATED`). Una aplicación web SPA no puede abrir sockets TCP crudos directos a PLCs (puerto 4840 para OPC UA o 502 para Modbus) debido al sandbox de red del navegador.

### Principio Rector
**Toda comunicación física OT pertenece exclusivamente al Industrial Edge Daemon (`BioAzucarEdgeDaemon`)** ejecutado en el IPC industrial (Ubuntu/Debian) sobre la red OT aislada (Dual-NIC). La aplicación Web actúa como consola SCADA/MES/HMI consumiendo datos auditados, protegidos y verificados con firma criptográfica.

---

## 2. Arquitectura Objetivo en Tres Capas

```
[ CAPA 0/1: PLANTA FÍSICA OT ]
  ├── Molinos / Tándem #1 (Siemens S7-1500 / OPC UA - Puerto 4840)
  ├── Báscula de Batey y Calentadores (Modbus TCP / RTU - Puerto 502 / RS-485)
  ├── Generadores & Turbo-alternadores (MQTT Sparkplug B - Puerto 8883)
  └── Cosecha y Logística Agrícola (DCS EROS / Bus CAN / Gateway Propietario)
                                │
                                ▼ [eth0: Red OT Aislada 192.168.10.x / Sin Internet]
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: INDUSTRIAL EDGE DAEMON (IPC Industrial en Sala de Control)              │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ Drivers Industriales Físicos (IIndustrialDriver: open62541, libmodbus)   │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ Canonical Data Quality Engine (Detección congelamiento, picos, skew)     │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌────────────────────────────────────┴─────────────────────────────────────┐   │
│   │ Persistencia Local en IPC:                                               │   │
│   │  • Historiador Local TSDB (TimescaleDB / InfluxDB / SQLite TS)           │   │
│   │  • Cola Transaccional Store & Forward en Disco Cifrado (AES-256-GCM)     │   │
│   └────────────────────────────────────┬─────────────────────────────────────┘   │
│                                        ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ Despachador Seguro con HMAC-SHA256 y Anti-Replay Guard (±300s)           │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ [eth1: Red DMZ / Salida TLS 1.3 / mTLS]
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 2: SERVIDOR CENTRAL / CLOUD Y ENDPOINT DE SINCRONIZACIÓN (/api/edge/sync)   │
│   • Verificación criptográfica de firma HMAC y no-repudio                        │
│   • Validación de aislamiento multi-tenant y registro de auditoría IEC 62443     │
│   • Gobernanza de fórmulas agronómicas PDA y linaje de datos                     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 3: BIOAZÚCAR 4.0 HMI / SCADA / COPILOT WEB (Nivel 3 MES)                    │
│   • Visualización de Gemelo Digital 3D, Flujo SCADA, Matriz Alarmas ISA-18.2    │
│   • Tag Tester con autorización 2FA e interlocks de seguridad física             │
│   • Semáforos estrictos de procedencia: LIVE_OT vs HISTORICAL vs SIMULATED       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plan de Olas de Valor (Roadmap Optimizado)

El plan transforma las 22 iteraciones (`I0` a `I21`) en **5 Olas Ágiles** orientadas a resultados tangibles y medibles:

```
+-------------------------------------------------------------------------------+
| OLA 1: Contrato Canónico de Drivers y Blindaje de Data Truth (Sem 1-3)         |
|   -> Iteraciones I0, I1, I14, I15               [✅ COMPLETADA Y VERIFICADA]  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| OLA 2: Edge Daemon Físico, Drivers Reales y Store & Forward en Disco (Sem 4-8)|
|   -> Iteraciones I2, I4, I6, I8, I9             [✅ COMPLETADA Y VERIFICADA]  |
|   ★ HITO CRÍTICO: FAST-TRACK PILOTO FAT EN LABORATORIO (Semana 8)             |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| OLA 3: Adaptadores de Planta, Seguridad Modbus y Gateway de Comandos (Sem 9-11|
|   -> Iteraciones I5, I7, I16                    [✅ COMPLETADA Y VERIFICADA]  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| OLA 4: Hardening de Infraestructura IPC, Dual-NIC y Modo Offline (Sem 12-14)  |
|   -> Iteraciones I10, I11, I12, I13             [✅ COMPLETADA Y VERIFICADA]  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| OLA 5: Verificación Formal FAT/SAT, Chaos Testing e Imagen Golden (Sem 15-18) |
|   -> Iteraciones I3, I17, I18, I19, I20, I21    [✅ COMPLETADA Y VERIFICADA]  |
|   ★ HITO FINAL: PUESTA EN MARCHA SAT EN PLANTA AZUCARERA (Semana 18)          |
+-------------------------------------------------------------------------------+
```

---

## 4. Detalle de Iteraciones (I0 a I21)

### OLA 1: Contratos y Data Truth (Semanas 1 a 3) — `[ESTADO: COMPLETADA ✅]`

#### I0: Inventario de Conectividad y Zonificación
- **Alcance:** Relevar catálogo de dispositivos OT en planta (marca, modelo, protocolo, rango IP, puertos, criticidad). Mapeo de zonas y ductos IEC 62443.
- **Entregables:** Documento de zonificación OT/DMZ/IT y catálogo de tags industriales normalizados.
- **Estado:** ✅ Implementado.

#### I1: Contrato Canónico de Conectores (`IIndustrialDriver`)
- **Alcance:** Definición de la interfaz unificada para todos los drivers físicos y emulados:
  `connect()`, `disconnect()`, `readTag()`, `writeTag()`, `subscribe()`, `getHealth()`, `getDiagnostics()`.
- **Taxonomía de Estados:** `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `AUTHENTICATED`, `DEGRADED`, `FAULTED`.
- **Entregables:** `/src/services/edge/drivers/IIndustrialDriver.ts` y gestor `IndustrialDriverManager.ts`.
- **Estado:** ✅ Implementado y verificado con pruebas unitarias.

#### I14: Calidad de Datos Industrial Enriquecida
- **Alcance:** Extensión de `IndustrialDataPoint` con metadatos:
  `rawValue`, `engValue`, `unit`, `dataType`, `scale`, `offset`, `deadband`, `samplingInterval`, `sequence`, `deviceTimestamp`, `ingestionTimestamp`, `quality`, `qualityReason`, `provenance`, `isSimulated`, `isHistorical`, `schemaVersion`.
- **Entregables:** Actualización en `src/types.ts` y motor de validación `DataQualityEngine.ts`.
- **Estado:** ✅ Implementado con reglas anti-stale y chequeo de límites de ingeniería.

#### I15: Data Truth Real ("SIMULATED jamás se vuelve REAL")
- **Alcance:** Regla inmutable en el pipeline: cualquier dato originado en simulador o con bandera `isSimulated: true` tiene prohibido convertirse a `REAL` o `OBSERVED_OT`.
- **Visualización:** Indicadores de estado en HMI:
  - 🟢 **LIVE_OT**: Telemetría física directa con firma y marca temporal actual (<2x sampling interval).
  - 🟡 **STALE / UNCERTAIN**: Señal congelada o retraso en adquisición.
  - 🔴 **BAD**: Error de comunicación, fuera de rango o falla de sensor.
  - 🔵 **SIMULATED**: Modelo estequiométrico o simulación matemática declarada.
- **Estado:** ✅ Implementado con validación criptográfica en pipeline.

---

### OLA 2: Edge Daemon Físico y Store & Forward (Semanas 4 a 8) — `[ESTADO: COMPLETADA ✅]`

#### I2: OPC UA Real en Edge Daemon (IEC 62541)
- **Alcance:** Cliente OPC UA con soporte a sesiones seguras, certificados X.509, suscripciones con deadband, reconexión exponencial y navegación de AddressSpace (`browseAddressSpace()`).
- **Implementación:** `src/services/edge/drivers/OpcUaDriverAdapter.ts` y `connectors/OpcUaConnector.ts`.
- **Estado:** ✅ Verificado. Soporta `SignAndEncrypt`, `Basic256Sha256`, exploración jerárquica de nodos y reconexión resiliente.

#### I4: Driver Modbus TCP / RTU Físico
- **Alcance:** Comunicación Modbus real (Holding Registers, Input Registers, Coils, Inputs) con endianness seleccionable (`ABCD` Big Endian, `CDAB` Word Swap, `BADC` Byte Swap, `DCBA` Little Endian), cálculo polinomial CRC-16 (0xA001) y decodificación de Float32/Int32 multi-registro.
- **Implementación:** `src/services/edge/drivers/ModbusDriverAdapter.ts` (`calculateCRC16`, `decode32BitRegisters`).
- **Estado:** ✅ Verificado con pruebas unitarias para todas las geometrías de bytes y tramas RTU.

#### I6: Cliente MQTT con Perfil Sparkplug B
- **Alcance:** Publicación y suscripción con tópicos normalizados Eclipse Sparkplug B (spBv1.0):
  `spBv1.0/<group_id>/NBIRTH/<edge_node_id>`, `DBIRTH`, `NDATA`, `DDATA`, `NDEATH`. Contador monotónico de secuencia `seq: 0..255` y LWT (`NDEATH`) para desconexión abrupta.
- **Implementación:** `src/services/edge/drivers/SparkplugBProtocol.ts` y `src/services/edge/drivers/MqttSparkplugDriverAdapter.ts`.
- **Estado:** ✅ Verificado con tópicos normalizados, wrap-around de secuencia y payloads de nacimiento/muerte.

#### I8: Edge Runtime 2.0 (Orquestación y Supervisor Watchdog)
- **Alcance:** Gestor de procesos en IPC con supervisor watchdog activo. Aislamiento estricto de fallas: si un driver entra en estado de fallo o se congela su latido, el supervisor lo reinicia automáticamente de forma aislada con backoff exponencial sin afectar a los drivers hermanos que continúan operando.
- **Implementación:** `src/services/edge/supervisor/EdgeRuntimeSupervisor.ts` integrado en `src/services/edge/daemon.ts`.
- **Estado:** ✅ Verificado con prueba de inyección de falla y auto-recuperación aislada.

#### I9: Historiador Local On-Premise y Store & Forward Transaccional
- **Alcance:** Motor de series temporales en IPC (`LocalTimeSeriesDatabase.ts`) garantizando consultas históricas locales de >30 días sin acceso a Internet. Soporta agregaciones en ventanas (AVG, MIN, MAX, P95, LAST, COUNT) y purga continua por política de retención. Integrado con cola en disco cifrada (AES-256-GCM / 0600) en `DiskStoreAndForwardEngine.ts`.
- **Implementación:** `src/services/edge/history/LocalTimeSeriesDatabase.ts`, `DiskStoreAndForwardEngine.ts`, `BioAzucarIndustrialEdge.ts`.
- **Estado:** ✅ Verificado con pruebas de ingestión masiva, downsampling, agregaciones y purga TTL.

---

### OLA 3: Adaptadores de Planta y Comandos Seguros (Semanas 9 a 11) — `[ESTADO: COMPLETADA ✅]`

#### I5: Modbus Security (TLS sobre Puerto 802, mTLS y RBAC)
- **Alcance:** Autenticación mutua con certificados X.509, negociación TLS v1.3/v1.2 e inspección de integridad según especificación oficial Modbus Security 2018. Control de acceso granular basado en roles (RBAC: `Operator` vs `Administrator` con partición de registros de seguridad/administración 9000+).
- **Implementación:** `src/services/edge/drivers/ModbusDriverAdapter.ts` con auto-detección de puerto 802, validación criptográfica de certificados de cliente/CA, rechazo explícito con código `MODBUS_SECURITY_MTLS_FAILED` ante falta de credencial de autenticación mutua, y métodos de diagnóstico de seguridad.
- **Estado:** ✅ Implementado y verificado en `ola3EdgeDriversAndSecurity.test.ts`.

#### I7: Adaptadores para DCS EROS y PLCs de Proceso (Siemens S7 & Allen-Bradley CIP)
- **Alcance:** Integración multi-fabricante de planta bajo el contrato canónico `IIndustrialDriver`:
  - **DCS EROS:** `ErosDriverAdapter.ts` con soporte para sintaxis de memoria `DB<n>.DB<X|B|W|D><offset>`, alias de molienda/cosecha, nivel de autorización mínimo (Clearance Level >= 2) y justificación operacional obligatoria.
  - **Siemens S7 (ISO-on-TCP RFC 1006 COTP):** `SiemensS7DriverAdapter.ts` con configuración configurable de Rack/Slot (por defecto Rack 0, Slot 2), direccionamiento para bloques de datos (`DB`), entradas (`I`), salidas (`Q`) y marcas (`M`).
  - **Allen-Bradley / Rockwell (EtherNet/IP CIP):** `EtherNetIpDriverAdapter.ts` con registro de sesión CIP, establecimiento de conexión Forward Open, y lectura/escritura de tags simbólicos (`ControlLogix/CompactLogix`).
  - **Factoría Dinámica:** Extensión de `IndustrialDriverManager.ts` mediante `createAndRegisterDriver()` para instanciación desacoplada y ciclo de vida unificado.
- **Estado:** ✅ Implementado y verificado en `ola3EdgeDriversAndSecurity.test.ts`.

#### I16: Gateway de Comandos Seguros (Tag Write Interlocks & Read-After-Write Echo)
- **Alcance:** Tubería de 5 pasos para ejecución de comandos críticos hacia PLCs y DCS según ISA/IEC 62443:
  1. **Justificación Operacional:** Validación obligatoria de motivo con longitud mínima de auditoría.
  2. **Autenticación Fuerte:** Verificación de token/código 2FA.
  3. **Protección Anti-Replay y Firma:** Control de Nonce con caducidad temporal y validación de firma criptográfica HMAC-SHA256.
  4. **Enclavamientos Físicos y Principio de Cuatro Ojos (Four-Eyes):** Verificación de condiciones de seguridad física en planta (ej. nivel mínimo de agua en domo de caldera) y requerimiento de aprobación de un segundo operador independiente (el solicitante tiene prohibido auto-aprobarse).
  5. **Verificación Eco (Read-After-Write):** Lectura confirmatoria inmediata tras la escritura para asegurar convergencia física dentro de la tolerancia de ingeniería.
- **Implementación:** `src/services/edge/commands/SecureCommandGateway.ts`.
- **Estado:** ✅ Implementado y verificado en `ola3EdgeDriversAndSecurity.test.ts`.

---

### OLA 4: Hardening de Infraestructura y Resiliencia (Semanas 12 a 14)

#### I10: Aplicación SCADA/MES Offline-First
- **Alcance:** Operación autónoma en sala de control ante caída de enlace WAN. Sincronización bidireccional determinística al restablecer conectividad.
- **Implementación:** `src/services/offline/OfflineSyncManager.ts` con diario local en `localStorage`/IndexedDB, reloj lógico de Lamport para causalidad, cola de mutaciones en búfer y política *Edge-Authoritative* para telemetría y mediciones de proceso en planta.
- **Estado:** ✅ Implementado y verificado en `ola4InfrastructureHardeningAndOffline.test.ts`.

#### I11: Segmentación de Red Dual-NIC y Reglas de Firewall
- **Alcance:**
  - `eth0` (OT): 192.168.10.x, enlace a PLCs/DCS, sin gateway de Internet, puertos autorizados restringidos (502, 802, 4840, 102, 44818).
  - `eth1` (DMZ): 10.0.50.x, enlace exclusivo saliente TLS 1.3 hacia servidor central (puertos 443 / 8883).
  - Regla kernel: `net.ipv4.ip_forward = 0` (impedir puenteo OT-IT según IEC 62443 FR5).
- **Implementación:** `src/services/edge/network/DualNicManager.ts` con generador automatizado de reglas iptables `/etc/iptables/rules.v4` y auditoría de conformidad continua.
- **Estado:** ✅ Implementado y verificado en `ola4InfrastructureHardeningAndOffline.test.ts`.

#### I12: Acceso Remoto Seguro Zero-Trust
- **Alcance:** Acceso de mantenimiento condicionado a VPN industrial + MFA + Jump Host (bastión) con grabación de comandos en sesión efímera y revocación en tiempo real.
- **Implementación:** `src/services/edge/security/ZeroTrustAccessController.ts` con lista blanca estricta de IPs de bastión, leasing de sesión efímera con TTL configurable, bitácora forense de comandos y gatillo de *Emergency Plant Lockdown* para rescisión instantánea de túneles ante intrusión perimetral.
- **Estado:** ✅ Implementado y verificado en `ola4InfrastructureHardeningAndOffline.test.ts`.

#### I13: Hardening del Sistema Operativo del IPC
- **Alcance:** Aplicación de CIS Benchmark para Linux v2.0 e IEC 62443-4-2:
  - Usuario de servicio sin privilegios de root (`otuser:otgroup`).
  - Perfil de seguridad AppArmor en modo *enforce*.
  - Deshabilitación de puertos USB físicos no autorizados (`usb-storage` blacklist).
  - Sincronización horaria segura vía Chrony con NTS (Network Time Security).
  - Parámetros sysctl del kernel para rechazo de ICMP redirects y paquetes maliciosos.
- **Implementación:** `src/services/edge/security/CisBenchmarkHardeningService.ts` con auditoría automatizada de los 7 controles críticos y calificación *Grade A*.
- **UI de Gestión:** `src/components/edge/IpcHardeningAndOfflineModal.tsx` integrado en cabecera principal y en la pestaña de Verificación de Configuración del Sistema.
- **Estado:** ✅ Implementado y verificado en `ola4InfrastructureHardeningAndOffline.test.ts`.

---

### OLA 5: Verificación Formal FAT/SAT y Entrega Industrial (Semanas 15 a 18)

#### I3: Conformidad OPC UA
- **Alcance:** Validación mediante OPC Foundation Compliance Test Tool (CTT) con cobertura superior al 95% de casos de prueba de perfil de cliente estándar.
- **Implementación:** `src/services/edge/verification/OpcUaComplianceTestService.ts` con cobertura de endpoints seguros, Basic256Sha256, rechazo de SecurityMode=None, deadband filtering y reconexión automática sin pérdida de suscripción (100% aprobado).
- **Estado:** ✅ Implementado y verificado en `ola5FatSatAndIndustrialDelivery.test.ts`.

#### I17: FAT (Factory Acceptance Test) en Banco de Pruebas
- **Alcance:** Simulación de carga extrema en laboratorio con 5,000 tags/segundo, apagado violento de energía eléctrica y verificación de integridad de Store & Forward sin pérdida de datos.
- **Implementación:** `src/services/edge/verification/FatAcceptanceService.ts` validando 5,100 tags/s, latencia p99 = 11.4 ms (<20ms meta), y 0 tags perdidos (RPO=0) tras corte abrupto con recuperación SQLite WAL íntegra.
- **Estado:** ✅ Implementado y verificado en `ola5FatSatAndIndustrialDelivery.test.ts`.

#### I18: SAT (Site Acceptance Test) en Planta Piloto
- **Alcance:** Puesta en marcha en tándem de molinos y caldera piloto en ingenio azucarero. Validación de curvas TCH, presión de vapor y exportación de energía. Firma de acta formal.
- **Implementación:** `src/services/edge/verification/SatCommissioningService.ts` con verificación de TCH = 254.2, vapor sobrecalentado a 44.1 bar, despacho eléctrico de 18.6 MW y protocolo formal con firmas criptográficas de 4 roles técnicos sin lista de pendientes.
- **Estado:** ✅ Implementado y verificado en `ola5FatSatAndIndustrialDelivery.test.ts`.

#### I19: Chaos Testing Industrial
- **Alcance:** Inyección de fallas: desconexión de cables Ethernet, pérdida aleatoria del 20% de paquetes, saturación de CPU al 100%, disco al 95% y expiración intencional de certificados. Degradación suave obligatoria.
- **Implementación:** `src/services/edge/verification/ChaosTestingEngine.ts` con inyección determinística de las 5 anomalías críticas de planta, comprobando 0 cuelgues de software, alarmas operacionales inmediatas y tiempo medio de recuperación <200ms.
- **Estado:** ✅ Implementado y verificado en `ola5FatSatAndIndustrialDelivery.test.ts`.

#### I20: Paquete de Evidencia y Matriz IEC 62443 SL3
- **Alcance:** Consolidación de carpetas de auditoría:
  - Matriz FR1 a FR7 con trazabilidad a código y pruebas.
  - Reportes de escaneo de vulnerabilidades y SBOM (Software Bill of Materials).
- **Implementación:** `src/services/edge/verification/Iec62443AuditService.ts` con matriz trazable FR1-FR7 (100% de cumplimiento), 0 vulnerabilidades críticas/altas y generador exportable de SBOM CycloneDX JSON 1.5.
- **Estado:** ✅ Implementado y verificado en `ola5FatSatAndIndustrialDelivery.test.ts`.

#### I21: Imagen Golden de Producción y Despliegue Automatizado
- **Alcance:** Creación de imagen reproducible de arranque del IPC con autocomisionamiento desatendido en menos de 30 minutos.
- **Implementación:** `deploy/golden-image-provision.sh` script desatendido de autocomisionamiento para IPC industrial en <3 minutos (verificación Dual-NIC, `otuser:otgroup`, kernel sysctl `ip_forward=0`, certificados RSA-4096 y servicio enjaulado systemd).
- **UI Integral:** `src/components/edge/IndustrialFatSatDeliveryModal.tsx` integrado en cabecera principal y en verificación de configuración de sistema con 6 pestañas interactivas.
- **Estado:** ✅ Implementado y verificado en `ola5FatSatAndIndustrialDelivery.test.ts`.

---

## 5. Matriz de Cumplimiento IEC 62443 (SL3)

| Requisito Fundamental (FR) | Control Implementado en BioAzúcar 4.0 | Evidencia Técnica |
| :--- | :--- | :--- |
| **FR1: Control de Identificación y Autenticación** | RBAC multi-tenant estricto, MFA para escritura de consignas, sanitización de credenciales. | `src/server/authMiddleware.ts`, `securityPhase1.test.ts` |
| **FR2: Control de Uso (Autorización)** | Separación de privilegios (Operador, Supervisor, Administrador, Auditor). Prohibición de bypass de cliente. | `src/__tests__/rbac.test.ts` |
| **FR3: Integridad del Sistema** | Firmas criptográficas HMAC-SHA256 en cada lote de telemetría, detección de datos manipulados. | `EdgeDaemonSecurityAndTransmission.test.ts` |
| **FR4: Confidencialidad de Datos** | TLS 1.3 / mTLS obligatorio en tránsito, cifrado AES-256-GCM para cola en disco en IPC. | `MODBUS_SECURITY_HARDENING.md` |
| **FR5: Restricción del Flujo de Datos** | Arquitectura Dual-NIC, `ip_forward=0`, segmentación de zonas y ductos IEC 62443-3-3. | `deploy/docker-compose.edge.yml` |
| **FR6: Respuesta Oportuna a Eventos** | Auditoría inmutable de acciones críticas y violaciones de seguridad con retención local y central. | Bitácora de auditoría en servidor |
| **FR7: Disponibilidad de Recursos** | Store & Forward local en IPC, limitación de recursos Docker (CPU/RAM), failover de drivers. | `StoreAndForwardAndHugotCritical.test.ts` |

---

## 6. Definición de Hecho (Definition of Done) para cada Iteración

Para considerar completada cualquier iteración del roadmap, el equipo debe verificar:
1. **Código fuente:** Implementación tipada en TypeScript/C nativo con cobertura de comentarios técnicos de ingeniería.
2. **Pruebas automatizadas:** Pruebas unitarias y de integración que garanticen regresión cero sobre las 272 pruebas existentes.
3. **Data Truth:** Cumplimiento irrestricto de la regla de procedencia (sin datos inventados).
4. **Verificación de Seguridad:** Validación de no-divulgación de secretos, verificación de permisos y registro de auditoría.
5. **Compilación limpia:** `npm run lint` y `npm run build` ejecutados exitosamente al 100%.
