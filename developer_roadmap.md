# BioAzúcar 4.0 — Documento Maestro de Desarrollo y Hoja de Ruta Industrial

> **Versión:** 4.3.0-FROZEN-ARCHITECTURE-SPEC  
> **Estado:** ESPECIFICACIÓN TÉCNICA CONGELADA Y AUDITADA — LISTA PARA EJECUCIÓN (I22 READY)  
> **Auditoría Técnica:** Auditoría de Arquitectura Industrial y Cierre de Brechas de Hardware/Runtime  
> **Ámbito:** Industrial Edge Daemon, Runtime Profiles (SIMULATION/LAB/PRODUCTION), Fail-Closed Mandatorio, Data Provenance Canónica (17 Atributos), Desacoplo de Calidad de Datos, Calificación de Dependencias (DQT), Benchmarking SQLite WAL y Modo Síncrono, Seguridad de Comandos (LLM ⨉ PLC), Arquitectura Driver en 4 Capas, DAG Paralelo Optimizado, Clasificación Formal de Métricas y Criterios Inviolables.

---

## 1. PRINCIPIO FUNDAMENTAL Y CLASIFICACIÓN RIGUROSA DE ESTADOS

Bajo el estándar de ingeniería industrial de BioAzúcar 4.0, queda terminantemente prohibido asumir que un componente de software está listo para planta basándose en código compilado, interfaces de usuario interactivas o pruebas automatizadas en memoria.

### 1.1 Cadena Obligatoria de Maduración Tecnológica
Todo módulo, driver, subsistema o capacidad debe evolucionar progresiva y demostrablemente a través de la siguiente cadena de estados:

$$\text{PLANNED} \longrightarrow \text{PARTIAL} \longrightarrow \text{IMPLEMENTED} \longrightarrow \text{TESTED} \longrightarrow \text{INTEGRATED} \longrightarrow \text{VERIFIED} \longrightarrow \text{FIELD\_VALIDATED} \longrightarrow \text{COMMISSIONED} \longrightarrow \text{PRODUCTION\_READY}$$

### 1.2 Definición Operacional de Estados
1. **`PLANNED`**: Requisito de ingeniería documentado con especificación técnica formal, sin código fuente funcional asociado.
2. **`PARTIAL`**: Código incompleto, stubs o funcionalidad interrumpida a nivel lógico o de dependencias.
3. **`IMPLEMENTED`**: Código fuente TypeScript/Node.js/Bash escrito y sintácticamente válido, estructurado según interfaces y contratos.
4. **`SIMULATED`**: La lógica genera o consume datos calculados internamente (ondas senoidales, generadores pseudoaleatorios, retardos artificiales con setTimeout).
5. **`MOCK`**: Respuestas fijas o estructuras hardcoded en memoria o archivos JSON estáticos para emular sistemas externos.
6. **`TESTED`**: Suite automatizada (Vitest/Node) ejecutada en memoria que verifica la lógica interna contra sí misma o contra dobles de prueba (actualmente 338/338 pruebas de software aprobadas).
7. **`INTEGRATED`**: El componente se comunica mediante transporte de red real (socket TCP, puerto serie, TLS) con un peer externo verificable (servidor OPC UA de prueba, broker MQTT local, simulador de campo independiente en red).
8. **`PROTOCOL_INTEROP`**: Comunicación validada contra implementaciones de referencia de la industria (OPC Foundation CTT, Wireshark dissector, Sparkplug-app Tahu, Diagslave Modbus).
9. **`VERIFIED`**: Pruebas formales de rendimiento, carga, estrés o resiliencia ejecutadas con instrumental de laboratorio, hardware representativo y mediciones empíricas reproducibles.
10. **`FIELD_VALIDATED`**: Operación comprobada en hardware físico final (IPC de grado industrial) conectado a instrumentos y controladores reales en sala de control o taller eléctrico.
11. **`COMMISSIONED`**: Puesta en marcha técnica en proceso productivo real (tándem de molienda o caldera) con acta formal de aceptación suscrita por operadores y jefatura de planta.
12. **`PRODUCTION_READY`**: Cumplimiento del 100% de los criterios auditables de disponibilidad ($A \ge 99.9\%$), seguridad IEC 62443 por capas, redundancia física, observabilidad y operación continua en zafra.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REGLA DE NO-PROMOCIÓN ARTIFICIAL (INVIOLABLE):                                                          │
│ IMPLEMENTED ≠ TESTED  │  TESTED ≠ INTEGRATED  │  INTEGRATED ≠ VERIFIED  │  COMMISSIONED ≠ PROD_READY    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Taxonomía de Hardware y Entornos de Prueba

Para no inventar hardware ni asumir disponibilidad no verificada de controladores físicos (Siemens S7, Rockwell CIP, Modbus RTU/TCP, servidores OPC UA y DCS EROS), se establece una taxonomía formal de entornos de prueba y la evidencia técnica específica que aporta cada uno:

| Entorno / Dispositivo | Descripción Técnica | Evidencia que Aporta | Limitaciones Técnicas |
| :--- | :--- | :--- | :--- |
| **`SIMULATOR`** | Proceso software en bucle local (`localhost`) o contenedor Docker que emula respuestas a nivel de protocolo (e.g. sockets emulados, generadores sintéticos). | Valida sintaxis de tramas, máquinas de estados de sesión, serialización/deserialización y manejo de excepciones en CI/CD. | **No valida** comportamiento de red física, latencias de bus, temporización $t_{3.5}$ de UART serie ni saturación de CPU de PLCs reales. |
| **`REFERENCE SERVER`** | Servidor o broker de referencia estándar de la industria ejecutándose en un host de red independiente (e.g. Prosys OPC UA Simulation Server, broker Eclipse Mosquitto con TLS, Diagslave Modbus). | Valida conformidad estricta con el estándar, handshakes TCP/TLS, negociación de seguridad X.509, suscripciones y reconexión ante fallas de enlace. | **No valida** restricciones de memoria de PLCs embebidos, tiempos de ciclo de scan de CPU ni jitter de buses de campo industriales. |
| **`LAB DEVICE`** | Controlador físico (PLC S7/ControlLogix), módulo de I/O remota o instrumento real montado en banco de pruebas de ingeniería fuera de la línea de proceso. | Valida compatibilidad eléctrica, stacks de firmware específicos de fabricante, direccionamiento de memoria real (DBs S7, CIP tags) y comportamiento tras reinicio del autómata. | Operación con señales eléctricas estáticas o simuladas mediante potenciómetros; no experimenta la dinámica de proceso real de zafra. |
| **`HIL (Hardware-in-the-Loop)`** | Banco donde PLCs reales ejecutan lógica de control conectados a un simulador de proceso en tiempo real que emula la dinámica de molienda y calderas. | Valida lazos cerrados de control, tiempos de respuesta extremo a extremo, respuesta ante fallas catastróficas simuladas y saturación de comunicaciones. | Requiere modelos matemáticos rigurosos validados de tándem de molinos y calderas; costo de instrumentación de banco. |
| **`FIELD DEVICE`** | Instrumento de medición, actuador o PLC de control instalado en la línea de producción activa de un ingenio azucarero (e.g. transmisor de presión hidráulica de masa superior). | Valida operación bajo severidad industrial real: armónicos de variadores de frecuencia, temperaturas elevadas, vibración mecánica, polvillo de bagazo y dinámica de caña. | Acceso restringido al calendario de zafra y protocolos de parada; pruebas destructivas estrictamente prohibidas en producción. |

### 1.4 Arquitectura de Runtime Profiles Industriales

Se sustituye cualquier dependencia exclusiva de variables ad-hoc por una arquitectura explícita de **Runtime Profiles** tipados: `SIMULATION`, `LAB` y `PRODUCTION`.

El perfil activo se establece de forma mandatoria mediante la variable de entorno `INDUSTRIAL_RUNTIME_PROFILE`.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REGLA ABSOLUTA DE SEGURIDAD (INVIOLABLE):                                                               │
│ PRODUCTION MUST FAIL CLOSED.                                                                            │
│ Un error de configuración, valor nulo, no reconocido o inconsistencia de certificados JAMÁS debe        │
│ permitir accidentalmente una transición o degradación silenciosa: SIMULATION ──> LIVE_OT.               │
│ Si la configuración es ambigua o inválida, el Edge Daemon ABORTA DE INMEDIATO (process.exit(1)).       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Matriz Exhaustiva de Runtime Profiles

| Dimensión de Control | Perfil `SIMULATION` | Perfil `LAB` | Perfil `PRODUCTION` |
| :--- | :--- | :--- | :--- |
| **Objetivo Operativo** | Desarrollo local, CI/CD automatizado, tests unitarios en memoria. | Banco de pruebas de ingeniería, validación HIL y homologación de drivers. | Operación industrial continua en IPC conectado a planta azucarera. |
| **Drivers Permitidos** | Virtual / Mock / Loopback drivers. | Drivers reales (`node-opcua`, `modbus-serial`, etc.) + Reference Servers. | **Únicamente adaptadores de protocolo reales** con transporte físico OT. |
| **Generación de Datos Sintéticos** | **PERMITIDO** (ondas senoidales, rampas, ruido estocástico). | **PROHIBIDO en canal OT del driver**. Permitido sólo en el peer/simulador externo. | **ESTRICTAMENTE PROHIBIDO** (`FAIL CLOSED`). Cero líneas sintéticas. |
| **Uso de Mocks** | **PERMITIDO**. | **PROHIBIDO en runtime daemon**. Permitido sólo en suites de test de integración aisladas. | **ESTRICTAMENTE PROHIBIDO**. Mocks eliminados del factory de producción. |
| **Requisito de PLC** | Ninguno (autocontenido). | PLC de banco, HIL o Reference Server externo verificado en red. | **Hardware físico en planta obligatorio** (enlace OT vivo verificado). |
| **Permisos de Comandos (Escritura)** | Loopback virtual / Dry-run sin efecto físico. | Habilitado en banco de pruebas con confirmación manual de operador. | **Estrictamente subordinado al Secure Command Gateway** + Enclavamientos + Doble factor / cuatro ojos. |
| **Permisos de BioAI** | Modo experimental / sandbox (sin restricciones de actuador). | Modo prescriptivo evaluado contra telemetría de banco/HIL. | **Sólo recomendaciones advisory** a través de la Envolvente de Seguridad Hugot. Prohibido control directo a PLC. |
| **Historiador Local** | En memoria o SQLite temporal en `/tmp`. | SQLite WAL persistente con rotación de pruebas. | **SQLite WAL duradero** en almacenamiento no volátil con particionado calificado. |
| **Store & Forward** | Mock sink o bypass local. | Activo hacia servidor DMZ local de prueba. | **Motor WAL transaccional** hacia DMZ/Cloud con comprobación de `fsync` y RPO $\le 100	ext{ ms}$. |
| **Auditoría Criptográfica** | Log estructurado a consola / stdout. | Log firmado localmente con hash SHA-256. | **Audit trail inmutable SHA-256** + Syslog industrial redundante remoto. |
| **Observabilidad** | Métricas locales en memoria. | Prometheus exporter activo en puerto local de diagnóstico. | **Prometheus + Node Exporter + Watchdog kernel (`/dev/watchdog`) activo**. |

---

## 2. INFORME FORENSE DE AUDITORÍA DEL REPOSITORIO REAL

La inspección directa del código fuente revela una discrepancia fundamental entre la **sofisticación de la arquitectura de software** y el **estado real de conectividad física con el hardware de planta**:

### 2.1 Drivers Industriales (`src/services/edge/drivers/`)
- **OPC UA (`OpcUaDriverAdapter.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `TESTED`.
  - *Evidencia*: No utiliza dependencias de transporte nativo (`node-opcua` no está en `package.json`). Utiliza un `Map<string, any>` en memoria (`tagValues`) inicializado con valores estáticos (`64.8 bar`, `420.5 t/h`). Cuando un tag no existe, genera variación sintética: `val = 50.0 + (Math.sin(Date.now() / 10000) * 5)`.
  - *Veredicto*: No existe socket TCP (puerto 4840), ni handshake binario de canal seguro, ni intercambio de certificados X.509 real.
- **Modbus TCP / RTU (`ModbusDriverAdapter.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `TESTED`.
  - *Evidencia*: Posee decodificación válida de endianness (ABCD, CDAB, BADC, DCBA) y cálculo estático de CRC16. Sin embargo, no hay sockets `net.Socket` ni `serialport`. `connect()` valida strings y cambia el flag `_status = "AUTHENTICATED"`. `readTag()` lee de `registerMap = new Map<string, number>()` o genera: `regVal = 1000 + Math.floor(Math.random() * 50)`.
  - *Veredicto*: Emulación de registros en memoria; no hay transporte físico a puerto 502/802 ni a `/dev/ttyUSB0`.
- **MQTT / Sparkplug B (`MqttSparkplugDriverAdapter.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `SIMULATED` / `TESTED`.
  - *Evidencia*: No utiliza la librería `mqtt`. Genera estructuras JSON que emulan payloads Sparkplug B, pero no codifica en Google Protobuf binario ni establece sesión MQTT persistente con broker externo. `connect()` invoca internamente `this.publishNBirth()` en memoria.
- **Siemens S7 (`SiemensS7DriverAdapter.ts`) & Allen-Bradley CIP (`EtherNetIpDriverAdapter.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `TESTED`.
  - *Evidencia*: Parsing regex riguroso de direcciones S7 (`DB1.DBD0`, `MW100`) y CIP paths, pero lectura/escritura direccionada a un `memoryMap` y generación de session handles con `Math.random()`. Sin transporte ISO-on-TCP (RFC 1006 COTP) ni encapsulación TCP CIP (puerto 44818).
- **DCS EROS (`ErosDriverAdapter.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `PROTOCOL_SPEC_REQUIRED`.
  - *Evidencia*: Mapeo de variables analógicas/digitales en `memoryMap` con retardo artificial de 90ms (`setTimeout`). No existe documentación de ingeniería del protocolo nativo del sistema EROS de ICINAZ/CubaAzúcar en el repositorio.

### 2.2 Persistencia Local y Store & Forward
- **Store & Forward (`StoreAndForwardQueue.ts`, `DiskStoreAndForwardEngine.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `PARTIAL` / `TESTED`.
  - *Evidencia*: `StoreAndForwardQueue` almacena en un arreglo en memoria JavaScript (`private queue: IndustrialDataPoint[] = []`). `DiskStoreAndForwardEngine` implementa un volcado debounced (500 ms) usando `fs.writeFileSync(JSON.stringify(pending))` con cifrado AES.
  - *Veredicto*: **No es un motor WAL transaccional**. Un corte repentino de energía en el IPC durante ráfagas provocaría pérdida de datos no volcados o corrupción por escritura atómica incompleta de un archivo JSON monobloque. La declaración previa de "RPO=0 comprobado ante corte eléctrico" era una aserción simulada en el software de prueba.
- **Historiador Local (`LocalTimeSeriesDatabase.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `TESTED`.
  - *Evidencia*: Utiliza un mapa en memoria RAM: `private tagSeries = new Map<string, StoredSample[]>()`. No persiste series de tiempo en disco duradero. Al reiniciar el proceso, el historial local de 30 días se pierde por completo.

### 2.3 Ciberseguridad IEC 62443, Red Dual-NIC y Hardening
- **Segmentación Dual-NIC (`DualNicManager.ts`, `golden-image-provision.sh`)**:
  - *Estado Real*: `IMPLEMENTED` / `PARTIAL`.
  - *Evidencia*: El script aplica directivas `sysctl` (`net.ipv4.ip_forward = 0`) y genera un par de claves openssl RSA-4096. Sin embargo, no implementa las tablas `nftables`/`iptables` para bloqueo estricto de paquetes entre `eth0` y `eth1`, no instala Chrony/NTS, no configura perfiles AppArmor en modo enforce ni restringe almacenamiento USB mediante reglas udev.
- **Matriz de Ciberseguridad IEC 62443 (`Iec62443AuditService.ts`)**:
  - *Estado Real*: `DESIGNED` / `IMPLEMENTED` (Autoevaluación Interna de Software).
  - *Evidencia*: Genera un reporte estático declarando cumplimiento de controles FR1-FR7 y un SBOM CycloneDX. Queda terminantemente prohibido declarar el sistema como `CERTIFIED` sin una auditoría formal ejecutada por un organismo de certificación independiente acreditado (ej. exida, TÜV Rheinland).

### 2.4 Motores de Inteligencia BioAI y Analítica Predictiva
- **BioAI Engine (`BioAiEngineService.ts`, `server.ts`)**:
  - *Estado Real*: `SIMULATED` / `HEURISTIC` / `LLM`.
  - *Evidencia*: Los cálculos de TCH futuro y consumo de vapor aplican multiplicadores heurísticos fijos con ruido sintético: `const tchNext1h = Math.round(currentTch * (1 + (Math.random() * 0.04 - 0.02)) * 10) / 10`. En el backend, las explicaciones cualitativas dependen de Gemini (LLM), lo cual no constituye un modelo predictivo industrial validado con datos históricos empíricos de molienda y bagazo.

### 2.5 Protocolos FAT / SAT
- **FAT (`FatAcceptanceService.ts`) & SAT (`SatCommissioningService.ts`)**:
  - *Estado Real*: `SIMULATED` / `MOCK`.
  - *Evidencia*: El benchmark de 5,000 tags/s y latencia p99 de 11.4 ms está hardcoded (`actualTagsPerSec: Math.round(tagsPerSec * 1.02)`, `latencyMs: { p99: 11.4 }`). El acta SAT contiene valores estáticos preconcebidos (`254.2 TCH`, `44.1 bar`, `18.6 MW`) con firmas digitales auto-validadas en memoria sin intervención de operadores en planta.

### 2.6 Diagnóstico de las 338/338 Pruebas Automatizadas
- **Significado Objetivo**: **338/338 pruebas de software pasaron con éxito en memoria**.
- **Límites de la Evidencia**: El 100% de estas pruebas evalúan código TypeScript contra dobles de prueba y mocks en Node.js. **Cero pruebas se han ejecutado contra un PLC físico, un socket de red industrial real o una planta azucarera en operación.**

---

## 3. ARQUITECTURA ISA-95 (NIVELES L0 A L4) Y LÍMITES DE SEGURIDAD

BioAzúcar 4.0 opera bajo una estricta segmentación conforme al modelo jerárquico ISA-95 / Purdue Model:

```
[ Nivel 4 — Nube / Enterprise ]
  Cloud Central Service / BioAI Core / BigQuery / ERP Azucarero
  ▲ (Saliente TLS 1.3 / HTTPS / WSS sobre WAN — Puerto 443)
──┼────────────────────────────────────────────────────────────────────────────
[ Nivel 3.5 — DMZ Industrial / Enlace Perimetral ]
  eth1: 10.0.0.X/24 (Gateway con salida exclusiva a IP de Cloud)
  Firewall nftables: DROP Inbound / ONLY Established Outbound
──┼────────────────────────────────────────────────────────────────────────────
[ Nivel 3 — Operaciones de Planta y Supervisión Local ]
  BioAzúcar Industrial Edge Daemon (IPC)
  - Historiador Embebido On-Premise (SQLite WAL)
  - Motor de Calidad de Datos (Data Quality Gate)
  - Store & Forward Transaccional
  - Supervisor Watchdog Hardware
──┼────────────────────────────────────────────────────────────────────────────
[ Nivel 2 — Supervisión de Área / SCADA / HMI ]
  Consolas locales de operador, SCADA tándem de molinos, SCADA calderas
──┼────────────────────────────────────────────────────────────────────────────
[ Nivel 1 — Control Básico y Enclavamientos ]
  eth0: 192.168.10.X/24 (Subred OT aislada, SIN gateway predeterminado)
  PLCs Siemens S7-1500, Allen-Bradley ControlLogix, DCS EROS, I/O Modbus
──┼────────────────────────────────────────────────────────────────────────────
[ Nivel 0 — Proceso Físico ]
  Cuchillas picadoras, desmenuzadora, molinos 1..5, calderas de bagazo, turbinas
```

### 3.1 Pipeline Inviolable de Seguridad de Comandos: LLM ⨉ PLC

Queda formalmente tipificada la prohibición absoluta de cualquier conexión o comando directo originado en modelos de lenguaje o algoritmos generativos hacia autómatas de control de planta:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REGLA DE SEGURIDAD OPERACIONAL P0:                                                                      │
│                   ┌─────────┐                                                                           │
│                   │   LLM   │ ─── ⨉ ───> [ PLC / CONTROLADOR L1 ]  (ESTRICTAMENTE PROHIBIDO)            │
│                   └─────────┘                                                                           │
│ Ningún componente de inteligencia generativa tiene permitido generar, canalizar ni emitir setpoints,    │
│ paquetes de red ni señales de control hacia el Nivel 1 o Nivel 0 de la pirámide ISA-95.                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

El único flujo prescriptivo de optimización autorizado en BioAzúcar 4.0 opera bajo el siguiente pipeline secuencial de 9 etapas con compuertas de seguridad físicas y humanas:

$$egin{aligned}
	ext{LLM / ML (Nivel 4/Cloud)} & \longrightarrow 	ext{1. Recomendación Operativa (Advisory Only)} \
& \longrightarrow 	ext{2. Safety Envelope (Ecuaciones Físicas Canónicas de Hugot/Spencer-Meade)} \
& \longrightarrow 	ext{3. Policy Validation (Enclavamientos de Nivel 1 y Rangos Permitidos)} \
& \longrightarrow 	ext{4. Human Approval (Doble Factor y Principio de Cuatro Ojos en HMI/SCADA)} \
& \longrightarrow 	ext{5. Secure Command Gateway (Edge Daemon con Token Criptográfico Efímero)} \
& \longrightarrow 	ext{6. Protocol Driver Calificado (OPC UA / Modbus / S7 / CIP)} \
& \longrightarrow 	ext{7. PLC / Autómata Físico (Escritura en Registro/Tag)} \
& \longrightarrow 	ext{8. Read-After-Write Verification (Confirmación de Setpoint Alcanzado)} \
& \longrightarrow 	ext{9. Cryptographic Audit Trail (Registro Inmutable SHA-256 de la Acción)}
\end{aligned}$$

### 3.2 Regla de Oro ISA-95
**LA NUBE NUNCA SE COMUNICA DIRECTAMENTE CON EL NIVEL 1 O NIVEL 0.**  
Queda terminantemente prohibido cualquier túnel directo, puerto entrante en el firewall de planta o polling de la nube hacia PLCs. Toda comunicación está mediada por el Edge Daemon en Nivel 3, con terminación completa de protocolos y filtrado de comandos por el Secure Command Gateway.

---

## 4. POLÍTICA FUNDAMENTAL DE DATA TRUTH (P0 ABSOLUTO)

La premisa central de ingeniería de BioAzúcar 4.0 es que **los datos no confiables son peores que la ausencia de datos**. Un setpoint, diagnóstico o inferencia de molienda generado a partir de datos sintéticos, interpolados o no verificados puede provocar daños mecánicos severos en molinos (fractura de masa superior por sobrepresión hidráulica) o explosiones en calderas de bagazo.

### 4.1 Contrato Canónico de Datos Industriales con Proveniencia de Primera Clase

Todo dato que circule por el ecosistema BioAzúcar 4.0 debe implementar estrictamente el contrato tipado `IndustrialDataPoint`, el cual eleva la proveniencia al nivel de requerimiento arquitectónico indispensable:

```typescript
export interface IndustrialDataPoint {
  // --- Metadatos de Runtime y Origen ---
  readonly runtimeMode: 'SIMULATION' | 'LAB' | 'PRODUCTION';
  readonly sourceType: 'PLC' | 'DCS' | 'SENSOR' | 'LAB_INSTRUMENT' | 'SIMULATOR' | 'MOCK';
  readonly sourceId: string;          // e.g. "PLC-MOLINO-01", "SIM-TURBINA-02"
  readonly driverId: string;          // e.g. "driver-modbus-tcp-01", "driver-opcua-client-01"
  readonly protocol: 'OPC_UA' | 'MODBUS_TCP' | 'MODBUS_RTU' | 'SPARKPLUG_B' | 'SIEMENS_S7' | 'ROCKWELL_CIP' | 'EROS' | 'CANONICAL_TEST';
  readonly deviceId: string;          // e.g. "DEV-TANDEM-M1"
  readonly assetId: string;           // e.g. "MOLINO-01-MASA-SUPERIOR"
  readonly tagId: string;             // e.g. "M1_HYDR_PRESS_DS"

  // --- Carga Útil y Tipado de Ingeniería ---
  readonly value: number | boolean | string;
  readonly engineeringUnit: string;   // e.g. "bar", "t/h", "°C", "%", "rpm"
  readonly dataType: 'FLOAT32' | 'FLOAT64' | 'INT16' | 'INT32' | 'UINT16' | 'UINT32' | 'BOOLEAN' | 'STRING';

  // --- Estampas Temporales y Secuencia ---
  readonly deviceTimestamp: string;   // ISO-8601 UTC estampa del reloj del dispositivo emisor
  readonly ingestionTimestamp: string;// ISO-8601 UTC estampa monótona del Edge Daemon al recibir la trama
  readonly sequence: number;          // Contador monótono uint64 para detección de huecos/pérdida

  // --- Calidad y Diagnóstico ---
  readonly quality: 'GOOD' | 'BAD' | 'UNCERTAIN' | 'STALE' | 'SIMULATED';
  readonly qualityReason: 'NORMAL' | 'TIMEOUT' | 'COMM_FAILURE' | 'CRC_ERROR' | 'OUT_OF_RANGE' | 'RATE_OF_CHANGE_EXCEEDED' | 'CONFIG_ERROR' | 'UNVERIFIED_SOURCE' | 'PROVENANCE_MISMATCH';
  readonly calibrationState: 'CALIBRATED' | 'EXPIRED' | 'UNCALIBRATED' | 'NOT_APPLICABLE';
  readonly schemaVersion: string;     // SemVer del contrato canónico, e.g. "1.0.0"
}
```

### 4.2 Cadena Inviolable de Procesamiento de Datos

Todo flujo de telemetría debe recorrer obligatoriamente y sin atajos la siguiente cadena de transformación:

$$	ext{SOURCE} \longrightarrow 	ext{PROVENANCE} \longrightarrow 	ext{NORMALIZATION} \longrightarrow 	ext{DATA QUALITY} \longrightarrow 	ext{TRUST} \longrightarrow 	ext{HISTORIAN} \longrightarrow 	ext{ANALYTICS} \longrightarrow 	ext{BIOAI}$$

1. **SOURCE**: Origen físico o virtual del dato (PLC, instrumento, simulador de laboratorio).
2. **PROVENANCE**: Asignación inmutable de metadatos de origen (`runtimeMode`, `sourceType`, `protocol`, `deviceId`, `driverId`, `sequence`).
3. **NORMALIZATION**: Conversión de representación binaria/endianness a unidades de ingeniería canónicas y timestamp ISO-8601.
4. **DATA QUALITY**: Evaluación de límites de rango, tasa de cambio máxima ($\Delta v/\Delta t$), estancamiento temporal y validez de calibración.
5. **TRUST**: Clasificación criptográfica del dato (`TRUSTED_OT`, `UNVERIFIED`, `REJECTED`). Los datos con calidad distinta de `GOOD` jamás reciben estatus `TRUSTED_OT`.
6. **HISTORIAN**: Persistencia en el historiador local SQLite WAL con índices de tiempo y calidad.
7. **ANALYTICS**: Cálculo de KPIs de ingeniería (balance de masa, eficiencias térmicas, indicadores de extracción).
8. **BIOAI**: Modelos prescriptivos y predictivos. **Requisito de Linaje**: Todo valor consumido por BioAI debe ser 100% reconstruible y auditable hasta su sensor físico, PLC, driver y estampa temporal original.

### 4.3 Política de Fail-Closed en Perfil de Producción

En perfil `PRODUCTION`, rigen las siguientes prohibiciones absolutas sin excepción:
- `synthetic fallback = FORBIDDEN` (Prohibido generar valores sintéticos ante falla de enlace).
- `mock driver = FORBIDDEN` (Prohibido registrar o instanciar adaptadores mock en el factory de producción).
- `fake timestamps = FORBIDDEN` (Prohibido inventar estampas temporales no recibidas del dispositivo).
- `random data = FORBIDDEN` (Prohibido el uso de `Math.random()` o generadores pseudoaleatorios).
- `silent fallback = FORBIDDEN` (Prohibido silenciar errores o responder con valores por defecto sin degradar calidad).

**Comportamiento ante Desconexión de PLC o Sensor en Producción**:
$$egin{aligned}
	ext{Pérdida de Enlace OT} & \longrightarrow 	ext{1. Driver emite error explícito de comunicación} \
& \longrightarrow 	ext{2. Quality transiciona a BAD o UNCERTAIN (Reason: COMM\_FAILURE o TIMEOUT)} \
& \longrightarrow 	ext{3. Metadatos de Provenance se conservan intactos para auditoría forense} \
& \longrightarrow 	ext{4. Se dispara alarma industrial inmediata a SCADA/Prometheus} \
& \longrightarrow 	ext{5. Historiador registra la muestra con su calidad BAD explícita} \
& \longrightarrow 	ext{6. Motores de BioAI excluyen inmediatamente la muestra de sus cálculos}
\end{aligned}$$

---

## 5. REGLA DE ADOPCIÓN TECNOLÓGICA Y MINIMALIDAD

Para erradicar la sobreingeniería y prevenir que el equipo desarrolle innecesariamente desde cero pilas de comunicación complejas:

### 5.1 Cuadrante de Exigencia Industrial
1. **PROTOCOLO REAL**: Conexión binaria estandarizada al puerto de red o interfaz física correspondiente.
2. **TRANSPORTE REAL**: Tráfico sobre sockets TCP/IP, túneles TLS o puertos serie físicos.
3. **PEER REAL**: Interlocutor real (PLC de laboratorio, simulador de campo independiente de referencia, o broker industrial).
4. **PRUEBA DE INTEROPERABILIDAD**: Conformidad validada con analizador de red (Wireshark) o herramientas de prueba de la industria.

### 5.2 Tarea Obligatoria de Calificación de Dependencias (Dependency Qualification Task - DQT)

Antes de incorporar cualquier biblioteca externa (`node-opcua-client`, `modbus-serial`, `mqtt`, `sparkplug-payload`, `nodes7`, `ethernet-ip`, `better-sqlite3`), el equipo de ingeniería debe ejecutar y documentar formalmente la **Calificación de Dependencias (DQT)**.

Queda terminantemente prohibido asumir que versiones documentadas previamente siguen siendo actuales o seguras. Las versiones deben verificarse en vivo en el registro oficial en el momento exacto de su implementación.

#### Ficha de Calificación Requerida para Cada Dependencia:
1. **Current Stable Version**: Versión semántica estable verificada en vivo en NPM registry.
2. **Node.js Compatibility**: Compatibilidad comprobada con el motor Node.js activo en producción (Node.js 20+ LTS).
3. **TypeScript Compatibility**: Soporte completo de tipado estático (`d.ts` nativos o paquete `@types/*` auditado).
4. **License Audit**: Licencia de código abierto permisiva (MIT, Apache-2.0, BSD-3-Clause). Prohibidas licencias virales copyleft (GPL/AGPL) en drivers industriales embebidos.
5. **Maintenance & Community Status**: Actividad de commits en los últimos 90 días, cadencia de releases y volumen de issues abiertos.
6. **Security Vulnerabilities**: Auditoría de vulnerabilidades conocidas (CVEs en NVD, `npm audit` cero vulnerabilidades críticas/altas).
7. **Protocol Standard Conformance**: Cobertura demostrada de especificaciones oficiales (OPC Foundation, Modbus-IDA, Eclipse Sparkplug, RFC 1006).
8. **API Stability & Memory Leak Profile**: Estabilidad de interfaces públicas y ausencia de memory leaks en benchmarks de estrés de sockets.
9. **Evaluated Alternatives**: Mínimo 2 alternativas técnicas evaluadas y descartadas con justificación técnica.
10. **Reason for Selection**: Criterio de ingeniería decisorio para la selección final.

### 5.3 Arquitectura de Drivers Industriales en Cuatro Capas Desacopladas

Para prevenir código monolítico o acoplamiento entre la lógica de dominio y los sockets de transporte, todo driver en BioAzúcar 4.0 debe implementar la siguiente arquitectura en cuatro capas desacopladas:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: IIndustrialDriver (Contrato Canónico de Dominio)                                                │
│         Define interfaces unificadas: connect(), disconnect(), readTags(), writeTag(), subscribe()     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ CAPA 2: Protocol Adapter (Traductor de Semántica Industrial)                                            │
│         Traduce direcciones industriales (DB1.DBD0, 40001, ns=2;s=Tag) al contrato canónico            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ CAPA 3: Transport Layer (Gestor de Enlace Físico / Sockets)                                            │
│         TCP / TLS / Serial / ISO-on-TCP gestionado mediante biblioteca madura calificada por DQT        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ CAPA 4: Industrial Peer (Dispositivo Remoto en Planta o Laboratorio)                                    │
│         PLC Siemens S7, Allen-Bradley ControlLogix, Instrumento Modbus RTU/TCP, Servidor OPC UA         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Flujos de Implementación Específicos**:
- **OPC UA**: `OpcUaDriverAdapter` $\longrightarrow$ `node-opcua-client` $\longrightarrow$ Socket TCP con SecureChannel / TLS $\longrightarrow$ Servidor OPC UA de Planta (puerto 4840).
- **Modbus**: `ModbusDriverAdapter` $\longrightarrow$ `modbus-serial` $\longrightarrow$ Socket TCP (puerto 502) o Puerto Serie `/dev/ttyUSB0` (RS-485) $\longrightarrow$ Dispositivo Modbus Esclavo.
- **MQTT Sparkplug B**: `MqttSparkplugAdapter` $\longrightarrow$ `mqtt` + `sparkplug-payload` $\longrightarrow$ Socket TLS (puerto 8883) $\longrightarrow$ Broker MQTT Central con decodificación Protobuf.
- **Siemens S7**: `SiemensS7Adapter` $\longrightarrow$ `nodes7` $\longrightarrow$ Socket ISO-on-TCP (RFC 1006, puerto 102) $\longrightarrow$ CPU S7-300 / S7-1200 / S7-1500.
- **Rockwell CIP**: `EtherNetIpAdapter` $\longrightarrow$ `ethernet-ip` $\longrightarrow$ Socket TCP/IP Encapsulado (puerto 44818) $\longrightarrow$ ControlLogix / CompactLogix.

### 5.4 Justificación de Tecnologías Seleccionadas (Rule of Minimality)
- **OPC UA**: Se pre-selecciona `node-opcua-client` sujeto a DQT. Evita implementar desde cero el complejísimo stack de SecureChannel y serialización binaria de la OPC Foundation.
- **Modbus**: Se pre-selecciona `modbus-serial` sujeto a DQT. Soporta Modbus TCP (502) y RTU sobre RS-485 serial nativo; minimiza la superficie de código.
- **Sparkplug B**: Se pre-selecciona `mqtt` + `sparkplug-payload` sujeto a DQT. Codificación binaria Google Protobuf según especificación Eclipse Tahu v2.2/v3.0 sin reinventar el serializador.
- **Siemens S7**: Se pre-selecciona `nodes7` sujeto a DQT. Implementa RFC 1006 COTP e ISO-on-TCP maduro para Siemens S7 sin requerir drivers propietarios.
- **Rockwell CIP**: Se pre-selecciona `ethernet-ip` sujeto a DQT. Maneja encapsulación TCP CIP (puerto 44818) sin licencias privativas.
- **Historiador Local**: Se pre-selecciona `better-sqlite3` sujeto a DQT. Persistencia ACID duradera en proceso, cero daemons externos, cero puertos expuestos, consumo de RAM < 30 MB y **objetivo de retención de 90 días sujeto a calificación técnica**. InfluxDB/TimescaleDB se descartan por sobrecarga innecesaria para el IPC Edge.

---

## 6. HOJA DE RUTA MAESTRA INTEGRAL (ITERACIONES I22 A I52)

A continuación se despliegan las 31 iteraciones obligatorias requeridas para transformar la base de software existente en una plataforma industrial física, validada, segura y comisionada.

---

### I22 — Rebaseline Técnico, Arquitectura de Runtime Profiles y Contrato Canónico
- **Objetivo**: Establecer la frontera estricta entre desarrollo, banco de pruebas y producción mediante Runtime Profiles y consolidar el contrato canónico `IndustrialDataPoint` con proveniencia de primera clase.
- **Alcance**:
  - Implementación formal de los tres perfiles: `SIMULATION`, `LAB` y `PRODUCTION` mediante `INDUSTRIAL_RUNTIME_PROFILE`.
  - **Fail-Closed de Producción**: Si el perfil es `PRODUCTION`, queda prohibido cualquier fallback sintético, mock o dato aleatorio. Si la configuración es inválida, ambigua o ausente, el Daemon aborta de inmediato (`process.exit(1)`).
  - Implementación del contrato unificado `IndustrialDataPoint` con los 17 atributos mandatorios de proveniencia y calidad (`runtimeMode`, `sourceType`, `sourceId`, `driverId`, `protocol`, `deviceId`, `assetId`, `tagId`, `value`, `engineeringUnit`, `dataType`, `deviceTimestamp`, `ingestionTimestamp`, `sequence`, `quality`, `qualityReason`, `calibrationState`, `schemaVersion`).
  - Refactorización de la interfaz `IIndustrialDriver` desacoplada del protocolo subyacente (`Capa 1` de la arquitectura de drivers).
  - Garantizar que las 338 pruebas existentes sigan pasando en CI configurando explícitamente el perfil `SIMULATION` en los entornos de prueba unitaria automatizada.
- **Entregables**:
  1. `src/services/edge/config/runtimeProfile.ts` con validación exhaustiva de perfiles y política Fail-Closed.
  2. `src/types/industrialDataPoint.ts` con la definición canónica del contrato de proveniencia y validadores Zod.
  3. `src/services/edge/drivers/IIndustrialDriver.ts` refactorizado con soporte nativo de `IndustrialDataPoint`.
  4. Guardias de aserción en los adaptadores existentes para bloquear cualquier emisión simulada en perfil `PRODUCTION`.
  5. Suite de pruebas unitarias que verifique la detención inmediata ante configuraciones inválidas en producción.
- **Criterio de Aprobación**: Cero emisiones sintéticas en perfil `PRODUCTION`, fallo cerrado garantizado y 100% de pruebas unitarias de la suite base (338/338) pasando en perfil `SIMULATION`.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución.

---

### I23 — Cliente OPC UA Real Interoperable con Servidor Industrial Real
- **Objetivo**: Implementar un cliente OPC UA industrial de producción, robusto e interoperable con servidores OPC UA de planta (PLCs, DCS, servidores SCADA).
- **Problema actual**: El driver actual emula el AddressSpace con un Map en memoria sin conexión socket real ni soporte de canal seguro.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Especificación de Pila Tecnológica**:
  - **Librería**: `node-opcua-client` (parte del stack oficial de NodeOPCUA).
  - **Versión**: `^2.115.0`.
  - **Licencia**: MIT.
  - **Protocolo**: OPC Unified Architecture (IEC 62541).
  - **Transporte**: `opc.tcp://` sobre socket TCP binario estándar.
  - **Puertos**: 4840 (puerto estándar) / puertos configurables por endpoint de planta.
  - **Autenticación**: Anónimo (solo en laboratorio de pruebas), Usuario/Contraseña cifrada, y Certificado X.509.
  - **Seguridad TLS / SecureChannel**:
    - SecurityPolicy: `Basic256Sha256`, `Aes128_Sha256_RsaOaep`, `None` (solo desarrollo).
    - SecurityMode: `SignAndEncrypt`, `Sign`.
    - Certificados X.509: Claves RSA 2048/4096 bits. Directorio de certificados de cliente (`client_cert.pem`, `client_key.pem`).
    - Validación de TrustList: Verificación de certificados de servidor contra carpeta `pki/trusted/certs` y rechazo con `pki/rejected`.
    - ApplicationUri: Identificador canónico: `urn:bioazucar:edge:client:<edgeId>`.
  - **Operaciones**:
    - `Session`: Creación, activación, auditoría de sesión, renovación periódica de token de seguridad.
    - `Browse`: Navegación estructurada del AddressSpace industrial (`ObjectsFolder`, `RootFolder`).
    - `Read`: Lectura de lote síncrona/asíncrona con mapeo de StatusCode OPC UA a DataQuality canónico (`Good` -> `GOOD`, `Uncertain` -> `UNCERTAIN`, `Bad` -> `BAD`).
    - `Write`: Escritura validada con StatusCode de retorno.
    - `Subscription`: Suscripción a grupos de variables con `publishingInterval` (100 ms a 1000 ms), `maxKeepAliveCount` (10), `lifetimeCount` (30).
    - `MonitoredItems`: Monitoreo de tags con `samplingInterval` y filtro por deadband absoluto/porcentual en servidor.
    - `Reconnect`: Máquina de reconexión automática con backoff exponencial (1s, 2s, 4s, máx 30s) y re-establecimiento transparente de suscripciones.
    - `Timeout`: Timeout de conexión de 5000 ms, timeout de sesión de 10000 ms.
    - `Clock & Stale Quality`: Detección de desviación de reloj de servidor contra tiempo local del IPC; marcado a `UNCERTAIN` si el timestamp del servidor difiere > 5000 ms.
- **Estrategia de Pruebas**:
  - *Software Test*: Pruebas unitarias de parsing de NodeId (`ns=2;s=Molino1.PresionHyd`), mapeo de StatusCode y control de timeouts.
  - *Integration Test*: Conexión automática en CI contra servidor de prueba local de referencia (contenedor Docker `open62541` o Prosys OPC UA Simulation Server) en `opc.tcp://localhost:4840`.
  - *Interop Test*: Validación de handshake binario, SecureChannel y suscripciones contra herramienta de conformidad oficial OPC Foundation CTT o Wireshark OPC UA dissector.
  - *HIL Test*: Conexión física a servidor OPC UA embebido en CPU Siemens S7-1500 en banco de pruebas.
- **Criterios de aceptación**: Conexión `opc.tcp` activa, mTLS `SignAndEncrypt` funcionando, suscripción de 200 monitored items a 10 Hz sin pérdida de eventos, reconexión automática en < 10 s tras corte de red.
- **Criterios de NO aceptación**: Modos sin cifrar en entornos productivos; bloqueo del event-loop de Node.js por reconexión síncrona; memory leaks en suscripciones.
- **Dependencias**: I22.
- **Riesgos**: Sobrecarga de memoria de la biblioteca si el servidor emite ráfagas desmedidas sin backpressure.
- **Rollback**: Reducción del número de monitored items o aumento del intervalo de muestreo a 1000 ms.
- **Definition of Done**: Interoperabilidad verificada contra servidor OPC UA de prueba y de laboratorio con tráfico binario seguro.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de registro de sesión OPC UA y captura pcap.

---

### I24 — Modbus Real: Diferenciación Standard (TCP/RTU) y Modbus Security
- **Objetivo**: Implementar un cliente Modbus real que soporte tanto el estándar universal en ingenios (Modbus TCP y Modbus RTU RS-485) como Modbus Security (TLS puerto 802) en los equipos que explícitamente lo soporten.
- **Problema actual**: El driver opera contra un `registerMap` en memoria y calcula latencias sintéticas.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Especificación de Pila Tecnológica**:
  - **Librería**: `modbus-serial` (probada en campo y con soporte para TCP, RTU sobre serial y RTU sobre TCP).
  - **Versión**: `^8.0.8`.
  - **Licencia**: BSD-3-Clause.
  - **Protocolos y Transportes Diferenciados**:
    1. **Standard Modbus TCP**:
       - Transporte: Socket TCP crudo (`net.Socket`).
       - Puerto: `502` por defecto.
       - Trama: MBAP Header (Transaction ID 2 bytes, Protocol ID 0x0000, Length 2 bytes, Unit ID 1 byte) + PDU.
    2. **Standard Modbus RTU**:
       - Transporte: Puerto serie físico (`serialport`) sobre `/dev/ttyUSB0`, `/dev/ttyS0` o enlaces RS-485 bifilares.
       - Velocidad de baudios: 9600, 19200, 38400, 115200 bps. Paridad: None, Even, Odd. Bits de datos: 8. Bits de parada: 1 o 2.
       - Trama: Dirección de esclavo (1 byte) + PDU + CRC-16 (2 bytes, polinomio 0xA001).
       - Temporización: Silencio inter-trama estricto de 3.5 caracteres ($t_{3.5}$).
    3. **Modbus Security**:
       - Condición de Activación: **ÚNICAMENTE** si el equipo objetivo de planta cuenta con soporte de firmware comprobado para Modbus Security (especificación Modbus.org 2018). No asumir que los ingenios azucareros convencionales lo poseen en instrumentos de campo.
       - Transporte: TLS v1.2 / v1.3 sobre socket TCP seguro (`tls.connect`).
       - Puerto: `802` por defecto.
       - Autenticación: Certificados X.509 de cliente y servidor, con verificación mTLS obligatoria y validación de roles en certificado.
  - **Operaciones Modbus Soportadas**:
    - FC01: Read Coils.
    - FC02: Read Discrete Inputs.
    - FC03: Read Holding Registers.
    - FC04: Read Input Registers.
    - FC05: Write Single Coil.
    - FC06: Write Single Register.
    - FC15: Write Multiple Coils.
    - FC16: Write Multiple Registers.
  - **Gestión de Datos y Conversión**:
    - Endianness configurable por registro: ABCD (Big Endian estándar), CDAB (Little Endian Word Swap), BADC (Big Endian Byte Swap), DCBA (Little Endian).
    - Decodificación IEEE 754 Float32, Int32, UInt32, Int16, UInt16, Scaled Integer con multiplicador de ingeniería.
  - **Gestión de Errores y Timeouts**:
    - Timeout por comando: 300 ms (TCP) / 1000 ms (RTU).
    - Reintentos: Máximo 3 intentos con intervalo de 50 ms antes de marcar calidad `BAD` con código `MODBUS_TIMEOUT`.
    - Manejo de excepciones Modbus estándar: 0x01 (Illegal Function), 0x02 (Illegal Data Address), 0x03 (Illegal Data Value), 0x04 (Slave Device Failure).
- **Estrategia de Pruebas**:
  - *TCP Integration Test*: Ejecución de pruebas automatizadas contra simulador Modbus TCP real local (`diagslave` o `modbus-server` en contenedor).
  - *RTU Integration Test*: Pruebas sobre par de puertos serie virtuales creados con `socat` emulando latencias y ruidos de línea RS-485.
  - *CRC & Malformed Frame Verification*: Inyección de tramas con CRC alterado y bytes truncados verificando descarte inmediato.
  - *HIL Test*: Conexión física a transmisor de temperatura/presión Modbus RTU real en banco de pruebas con conversor USB/RS-485 industrial aislado.
- **Criterios de aceptación**: Lectura cíclica de 100 registros cada 250 ms con cero fallas de CRC en 10,000 transacciones; decodificación exacta de valores flotantes de ingeniería; reconexión de socket en < 3 s tras reinicio del esclavo.
- **Criterios de NO aceptación**: Bloqueo del puerto serie; mezclas de tramas por falta de exclusión mutua en solicitudes concurrentes.
- **Dependencias**: I22.
- **Riesgos**: Ruido eléctrico severo de variadores de frecuencia en ingenio provocando pérdidas de trama en RS-485.
- **Rollback**: Descenso de baudrate a 9600 bps y activación de terminadores de bus de 120 ohmios.
- **Definition of Done**: Comunicación Modbus TCP y RTU operando contra peers reales con decodificación de datos y propagación de calidad verificada.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de registro de comunicación y captura de tramas hex.

---

### I25 — MQTT / Sparkplug B Wire-Level Interoperable (Broker Real y Protobuf Binario)
- **Objetivo**: Integrar un cliente MQTT / Sparkplug B nativo que codifique métricas en Google Protobuf binario y se comunique con brokers MQTT industriales siguiendo estrictamente la especificación Eclipse Sparkplug B v2.2 / v3.0.
- **Problema actual**: El código actual simula objetos JSON en memoria y no utiliza serialización Protobuf ni conexión MQTT de red.
- **Estado inicial real**: `SIMULATED` / `IMPLEMENTED`.
- **Especificación de Pila Tecnológica**:
  - **Librería MQTT**: `mqtt` (cliente MQTT de producción para Node.js).
  - **Versión**: `^5.3.5`.
  - **Licencia**: MIT.
  - **Librería Protobuf / Sparkplug**: `sparkplug-payload` (compilador oficial de payload Sparkplug B de Eclipse Tahu) o compilación nativa con `protobufjs` del archivo canónico `sparkplug_b.proto`.
  - **Versión Protobuf**: `^7.2.6`.
  - **Licencia**: Apache-2.0.
  - **Protocolo**: MQTT v3.1.1 / v5.0 con payload Sparkplug B binario comprimido.
  - **Transporte**: `mqtt://` (puerto 1883 en pruebas locales) o `mqtts://` (puerto 8883 con TLS 1.3 y certificados en producción).
  - **Estructura Canónica de Tópicos Sparkplug B**:
    - `spBv1.0/{groupId}/NBIRTH/{edgeNodeId}`: Mensaje de nacimiento del nodo Edge.
    - `spBv1.0/{groupId}/NDATA/{edgeNodeId}`: Datos de telemetría de tags locales.
    - `spBv1.0/{groupId}/NDEATH/{edgeNodeId}`: Mensaje de última voluntad (LWT) configurado en el broker con QoS 1 y Retain=false.
    - `spBv1.0/{groupId}/DBIRTH/{edgeNodeId}/{deviceId}`: Nacimiento de dispositivos conectados (ej. Molino 1, Caldera 2).
    - `spBv1.0/{groupId}/DDATA/{edgeNodeId}/{deviceId}`: Telemetría a nivel de dispositivo.
    - `spBv1.0/{groupId}/NCMD/{edgeNodeId}`: Comandos hacia el nodo Edge.
  - **Gestión de Secuencia y Estado**:
    - Secuencia estricta de 8 bits (`seq = 0..255`). `seq` arranca en 0 con `NBIRTH` y se incrementa en cada mensaje subsiguiente (`NDATA`, `DDATA`).
    - Detección de pérdida de mensajes por el suscriptor si la secuencia no es correlativa.
    - Inclusión de `timestamp` (milisegundos Unix) en cada métrica individual del payload Protobuf.
  - **Reconexión y Calidad de Servicio**:
    - `cleanSession = false` con `keepalive = 30s`.
    - Calidad de Servicio: QoS 0 para NDATA/DDATA de alta frecuencia; QoS 1 para NBIRTH y NDEATH.
- **Estrategia de Pruebas**:
  - *Software Test*: Serialización y deserialización de un payload Protobuf verificando correspondencia bit a bit de tipos (Float, Int64, String, Boolean, DataSet).
  - *Integration Test*: Conexión automática en entorno de pruebas contra broker MQTT real (contenedor Docker Eclipse Mosquitto v2.0 o EMQX) en `localhost:1883`.
  - *Subscriber Interop Test*: Suscripción con cliente independiente (ej. `sparkplug-app` de Eclipse Tahu o MQTT Explorer) comprobando decodificación limpia sin errores de esquema.
  - *HIL Test*: Conexión a broker central de planta en red DMZ a través de interfaz `eth1`.
- **Criterios de aceptación**: Publicación continua a 10 Hz de 500 métricas en payload Protobuf binario; secuencia matemática continua 0..255; disparo automático del mensaje LWT NDEATH en corte abrupto de red.
- **Criterios de NO aceptación**: Cadenas JSON en tópicos Sparkplug B; desconexiones por payload malformado; desincronización de secuencia sin emitir nuevo NBIRTH.
- **Dependencias**: I22.
- **Riesgos**: Latencia de red o acumulación de memoria en desconexión prolongada de broker.
- **Rollback**: Encolado en buffer persistente local de Store & Forward y limitación de tasa de publicación por banda muerta.
- **Definition of Done**: Publicación y suscripción Sparkplug B binaria validada contra broker Mosquitto real en suite de integración.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de captura de mensajes decodificados con Eclipse Tahu.

---

### I26 — Adaptadores Nativos Siemens S7, Rockwell CIP y Protocol Specification EROS
- **Objetivo**: Implementar comunicación física con PLCs Siemens y Rockwell usando librerías industriales probadas, y formalizar la especificación de interfaz requerida para el sistema DCS EROS.
- **Problema actual**: Las direcciones S7 y CIP se resuelven contra un `memoryMap` en memoria. El protocolo de DCS EROS no está documentado en el repositorio.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED` (S7/Rockwell) y `PROTOCOL_SPEC_REQUIRED` (EROS).
- **Especificación de Pila Tecnológica**:
  - **Siemens S7**:
    - **Librería**: `nodes7` (cliente maduro y probado en producción industrial para Siemens S7-300, S7-400, S7-1200 y S7-1500).
    - **Versión**: `^0.4.3`.
    - **Licencia**: MIT.
    - **Protocolo**: S7 Communication sobre ISO-on-TCP (RFC 1006 COTP).
    - **Transporte**: TCP puerto 102.
    - **Áreas de Memoria Soportadas**: Data Blocks (`DB`), Marcas/Flags (`M`, `MW`, `MD`), Entradas (`I`, `IW`, `ID`), Salidas (`Q`, `QW`, `QD`).
    - **Optimización**: Agrupación automática de solicitudes contiguas en una sola PDU ISO-on-TCP para minimizar llamadas de red.
    - **Requisitos de PLC**: S7-1200/1500 requiere en TIA Portal: acceso DB "No optimizado" (acceso estándar por offset) y permiso de comunicación "Permitir acceso vía comunicación PUT/GET del interlocutor remoto".
  - **Rockwell / Allen-Bradley EtherNet/IP CIP**:
    - **Librería**: `ethernet-ip` (cliente CIP para ControlLogix, CompactLogix y Micro800).
    - **Versión**: `^1.2.6`.
    - **Licencia**: MIT.
    - **Protocolo**: Common Industrial Protocol (CIP) encapsulado sobre TCP/IP.
    - **Transporte**: TCP puerto 44818.
    - **Operaciones**: Registro de sesión CIP (`RegisterSession`), Forward Open (conexión de mensajería conectada), lectura explícita de tags por nombre simbólico (`Tag Read`), y escritura de tags atómica.
  - **DCS EROS (ICINAZ / CubaAzúcar)**:
    - **ESTADO TÉCNICO FORMAL**: `PROTOCOL_SPEC_REQUIRED`.
    - **Justificación**: En el repositorio no existe la especificación de capas física, enlace y aplicación del sistema EROS. Queda terminantemente prohibido inventar o adivinar un protocolo propietario.
    - **Tarea de Ingeniería Asignada**: Generar la Solicitud Formal de Documentación Técnica (RFI) a la Dirección de Automatización Industrial de AZCUBA/ICINAZ para determinar si EROS expone:
      a) Pasarela Modbus RTU/TCP interna.
      b) Enlace serie propietario RS-485 con tramas ASCII/Binarias (requiere manual de comandos y baudrate).
      c) Servidor OPC DA / OPC UA externo.
      d) Tarjetas concentradoras de E/S con salida analógica estándar 4-20 mA.
    - **Plan de Acción**: El adaptador `ErosDriverAdapter` mantendrá su estado en `PROTOCOL_SPEC_REQUIRED` y no entrará a producción hasta la recepción y validación del documento técnico oficial.
- **Estrategia de Pruebas**:
  - *Software Test*: Parsing de sintaxis S7 (`DB100,REAL20`, `M10.2`) y rutas de tags CIP (`Program:MainProgram.MotorSpeed`).
  - *Integration Test S7*: Conexión contra PLC virtual (Snap7 Server o S7-PLCSIM Advanced en máquina de prueba).
  - *Integration Test Rockwell*: Conexión contra emulador de PLC CIP en puerto 44818.
  - *HIL Test*: Conexión en rack a CPU Siemens S7-1500 (1516-3 PN/DP) leyendo variables de pesaje de caña.
- **Criterios de aceptación**: Lectura cíclica de 150 variables S7 en un ciclo de red < 30 ms; lectura de tags simbólicos CIP en < 50 ms; reporte documentado de estado de protocolo EROS.
- **Criterios de NO aceptación**: Intentos de adivinar formatos de trama para EROS sin especificación oficial; caídas del hilo por fallo de conexión COTP.
- **Dependencias**: I22.
- **Riesgos**: Restricciones de ciberseguridad en firmware moderno de Siemens que bloqueen PUT/GET.
- **Rollback**: Uso del servidor OPC UA embebido del S7-1500 (cubierto en I23) si PUT/GET está prohibido por política de planta.
- **Definition of Done**: S7 y CIP integrados con librerías maduras contra peers de prueba; especificación técnica de EROS formalmente requerida.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de pruebas contra Snap7 y documento RFI de EROS.

---

### I27 — Pipeline Industrial Data Quality Gate End-to-End (Desacoplado de Drivers Específicos)
- **Objetivo**: Filtrar, clasificar y validar la integridad y calidad de cada muestra antes de que ingrese al historiador o a los motores de BioAI, operando sobre el contrato canónico `IndustrialDataPoint`.
- **Dependencias**: I22 (Contrato Canónico y Runtime Profiles). **Desacoplo Arquitectural**: No depende de la finalización de todos los drivers físicos (I23/I24/I25/I26); se valida y desarrolla contra el contrato canónico utilizando arneses de prueba de laboratorio (`Canonical Test Harness`).
- **Alcance**:
  - Implementación de compuertas de calidad en línea:
    1. *Validación de Proveniencia*: Verificación de que `runtimeMode`, `sourceType` y `driverId` coincidan con el perfil activo de la planta; rechazo inmediato con `qualityReason = PROVENANCE_MISMATCH` ante discrepancias.
    2. *Rango de Instrumento*: Rechazo o marcado `BAD (OUT_OF_RANGE)` si el valor excede límites físicos del sensor (e.g. presión hidráulica > 350 bar o < 0 bar).
    3. *Tasa de Cambio Máxima ($\Delta v / \Delta t$)*: Detección de picos de ruido impulsivo o escalones no físicos según la inercia mecánica del molino o térmica de calderas.
    4. *Filtro de Congelamiento (Frozen/Stale)*: Detección de pérdida de dinámica en variables intrínsecamente ruidosas (vibración, presión de molienda), marcando `UNCERTAIN (FROZEN_SENSOR)`.
    5. *Verificación de Timestamp y Deriva*: Detección de desviación entre `deviceTimestamp` e `ingestionTimestamp` ($|\Delta t| > 1000	ext{ ms}$).
  - Marcado estricto conforme a OPC UA / IEC 61158 (`GOOD`, `UNCERTAIN`, `BAD`, `STALE`, `SIMULATED`).
- **Entregables**:
  1. `src/services/edge/quality/DataQualityGate.ts` operando sobre `IndustrialDataPoint`.
  2. Motor de reglas de validación física configurables por tipo de activo y variable agroindustrial.
  3. `src/services/edge/quality/CanonicalTestHarness.ts` para pruebas automatizadas completas del motor sin requerir PLCs físicos conectados.
- **Criterio de Aprobación**: El 100% de los datos que ingresan al bus interno poseen proveniencia verificada y estatus de calidad auditado; ningún dato `BAD`, `STALE` o `SIMULATED` es admitido en BioAI.
- **Estado**: `PLANNED`.

---

### I28 — Historiador Local On-Premise en SQLite con Benchmark de Calificación y Evaluación de Modo Síncrono
- **Objetivo**: Proporcionar persistencia local duradera de series temporales industriales en el IPC, estableciendo un objetivo de retención de 90 días de zafra sujeto a calificación empírica, evaluando rigurosamente el modo de sincronización.
- **Dependencias**: I27 (Data Quality Gate).
- **Alcance**:
  - Ejecución de la tarea **Dependency Qualification Task (DQT)** para `better-sqlite3`.
  - Integración de SQLite embebido de alto rendimiento operando en proceso sin exponer puertos de red adicionales.
  - **Evaluación y Selección de Modo Síncrono (`PRAGMA synchronous`)**:
    No se fija de forma arbitraria `NORMAL`. Se evalúan empíricamente en laboratorio las opciones:
    1. `OFF`: Máximo throughput, vulnerable a corrupción física de la base de datos si ocurre un corte eléctrico antes del flush del sistema operativo.
    2. `NORMAL`: Consistente y seguro en modo WAL frente a caídas del daemon; seguro frente a cortes eléctricos si el disco cuenta con Power Loss Protection (PLP).
    3. `FULL`: Sincronización a disco en cada transacción; máxima durabilidad pero mayor latencia y desgaste de memoria flash.
    - *Criterio de Selección*: Se seleccionará mediante matriz de decisión basada en: (a) prueba destructiva de corte intempestivo de energía en banco de hardware, (b) presencia de SSD de grado industrial con PLP (supercondensadores), (c) protección de la fuente 24 VDC por UPS/buffer, (d) latencia de escritura y (e) RPO demostrado ($\le 100	ext{ ms}$).
  - **Batería Formal de Benchmark de Calificación de Capacidad y Rendimiento**:
    El compromiso de retención se define formalmente como: **"90-day retention target subject to qualification"**. Se ejecuta un benchmark reproducible que mide y documenta:
    1. Cantidad de tags concurrentes (500, 1,000 y 5,000 tags).
    2. Frecuencia de muestreo (sample rate de 100 ms, 500 ms y 1,000 ms).
    3. Tamaño de payload por registro (bytes promedio por punto persistido).
    4. Volumen de filas por día (rows/day) y proyección acumulada a 7, 30 y 90 días.
    5. Tamaño del archivo WAL bajo carga y tras checkpoints automáticos pasivos y activos.
    6. Tamaño final del archivo de base de datos `.db` particionado mensualmente.
    7. Latencia de consulta (query latency p50, p95, p99 en ventanas de 1 hora, 24 horas y 7 días).
    8. Latencia de escritura (write latency por bloque de inserción transaccional).
    9. Consumo porcentual de CPU sostenido en el IPC durante ráfagas de ingestión.
    10. Huella de memoria RAM (working set resident) del proceso SQLite.
    11. Tasa de I/O de disco (MB/s de escritura sostenida en almacenamiento eMMC/NVMe).
    12. Tiempo e impacto de I/O de la purga automática de particiones históricas vencidas.
    13. Tiempo de recuperación de la base de datos tras parada intempestiva (WAL recovery).
- **Entregables**:
  1. Documento DQT de calificación técnica de `better-sqlite3`.
  2. Informe de laboratorio justificando la selección de `PRAGMA synchronous` con prueba de corte eléctrico.
  3. `src/services/edge/historian/SqliteHistorian.ts` con transacciones por lotes e inserción del contrato canónico `IndustrialDataPoint`.
  4. Informe del Benchmark de Calificación con curvas de proyección para el objetivo de retención de 90 días.
- **Criterio de Aprobación**: Benchmark de inserción transaccional completado y documentado; selección de `PRAGMA synchronous` respaldada por pruebas de corte físico de energía; cero exposición de puertos de red.
- **Estado**: `PLANNED`.

---

### I29 — Store & Forward Transaccional con Motor WAL y RPO Demostrado
- **Objetivo**: Asegurar cero pérdida de datos telemetrados ante caídas de enlace WAN/Satélite durante zafra mediante almacenamiento persistente transaccional con RPO demostrado $\le 100	ext{ ms}$ (`ENGINEERING REQUIREMENT`) bajo corte intempestivo de energía.
- **Dependencias**: I28 (Historiador SQLite WAL).
- **Alcance**:
  - Reemplazo total del almacenamiento volátil en memoria y buffers JSON por una cola persistente transaccional en SQLite WAL.
  - Implementación de transacciones atómicas por lotes:
    - Máquina de estados de sincronización: `PENDING` $\longrightarrow$ `IN_TRANSIT` $\longrightarrow$ `ACKNOWLEDGED`.
    - En caso de caída de red WAN o corte eléctrico del IPC, las transacciones no confirmadas permanecen en el WAL y se recuperan de forma consistente al reiniciar el servicio.
    - Confirmación obligatoria de escritura a disco no volátil (`fsync`) antes de marcar lotes de telemetría crítica como asegurados.
  - Pipeline de transmisión con compresión gzip/zstd por lotes hacia la DMZ / Cloud.
  - Deduplicación idempotente en recepción en el Servidor Central mediante clave única compuesta:
    $$	ext{IdempotencyKey} = 	ext{hash}(	ext{sourceId} : 	ext{tagId} : 	ext{deviceTimestamp} : 	ext{sequence})$$
  - Clasificación Formal de Métricas de Resiliencia:
    - **RPO**: `ENGINEERING REQUIREMENT` fijado en $\le 100	ext{ ms}$ bajo corte intempestivo de energía eléctrica.
    - **RTO**: `PROVISIONAL ENGINEERING TARGET` fijado en $\le 10	ext{ s}$ para reanudar el vaciado de cola tras restablecimiento de la interfaz WAN.
- **Entregables**:
  1. `src/services/edge/storeAndForward/PersistentQueue.ts` operando sobre el contrato canónico `IndustrialDataPoint`.
  2. Protocolo de prueba destructiva de corte abrupto de proceso (`kill -9`) y corte de alimentación eléctrica en banco de pruebas.
  3. Verificación criptográfica de cero duplicados y cero pérdidas en el receptor tras reconexión.
- **Criterio de Aprobación**: Prueba de corte intempestivo de alimentación eléctrica con cola saturada demostrando recuperación íntegra sin pérdidas que superen los 100 ms y sin duplicados en el destino.
- **Estado**: `PLANNED`.

---

### I30 — Edge Runtime Production-Grade con Watchdog de Hardware y Sandboxing
- **Objetivo**: Aislar y proteger el proceso del Edge Daemon en el sistema operativo del IPC mediante supervisión a nivel de kernel, integración con el temporizador watchdog de hardware y sandboxing estricto de privilegios.
- **Problema actual**: El supervisor actual es un objeto TypeScript dentro del mismo proceso Node.js; si el proceso se cuelga a nivel de runtime, no hay recuperación.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Componentes y Mecanismos de Protección**:
  - **Hardware Watchdog**: Integración con el driver del kernel de Linux (`/dev/watchdog`). El daemon debe enviar un latido (*heartbeat ping*) cada 5 segundos. Si el runtime se congela por más de 30 segundos, el microcontrolador del IPC ejecuta un reinicio de hardware forzado.
  - **Supervisión Systemd**: Servicio `bioazucar-edge.service` con directivas:
    - `Restart=always`, `RestartSec=5s`.
    - `User=otuser`, `Group=otgroup` (prohibido ejecutar como root).
    - `ProtectSystem=strict`, `ProtectHome=true`, `PrivateTmp=true`, `NoNewPrivileges=true`.
    - `ReadWritePaths=/opt/bioazucar/data /opt/bioazucar/logs`.
    - `LimitNOFILE=65536`.
  - **Manejo de Señales POSIX**: Atrapado ordenado de `SIGTERM` y `SIGINT` para cierre limpio de sockets industriales y volcado final de buffers WAL en < 3 segundos.
- **Estrategia de Pruebas**: Simulación de bloqueo intencional del event-loop de Node.js mediante un bucle infinito forzado; comprobación de que el hardware watchdog de Linux detecta la ausencia de ping y reinicia el sistema operativo del IPC a los 30 segundos.
- **Criterios de aceptación**: Detección y reinicio de procesos congelados; restablecimiento del servicio en < 15 segundos tras rearranque; operación en modo usuario sin privilegios root.
- **Dependencias**: I22, I29.
- **Estado**: `PLANNED`.

---

### I31 — Secure Command Gateway Físico con Read-After-Write y Enclavamientos
- **Objetivo**: Conectar el gateway de comandos a los drivers físicos garantizando ejecución segura, autorización multi-rol, validación estricta de enclavamientos de proceso y verificación confirmatoria de lectura.
- **Problema actual**: Las escrituras se confirman en el `memoryMap` sin alterar registros de PLCs reales ni comprobar el estado físico de los actuadores.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Pipeline de Ejecución de Comandos**:
  1. `Solicitud de Comando` (Firma criptográfica del operador, rol RBAC validado, token anti-replay con timestamp < 5s).
  2. `Evaluación de Enclavamientos de Seguridad (Interlocks)`: Verificación local en el Edge de que el estado actual del proceso permite la maniobra (ej. Prohibido abrir vapor a turbo si no hay vacío en condensador).
  3. `Regla de Cuatro Ojos`: Para comandos de impacto operacional severo (parada de molienda, bypass de caldera), se exige aprobación de un segundo operador autorizado.
  4. `Escritura Wire-Level en PLC`: Envío de la instrucción a través del driver correspondiente (OPC UA Write o Modbus FC06/FC16).
  5. `Verificación Read-After-Write (RAW)`: Lectura síncrona obligatoria del registro del PLC a los 100 ms. Si el valor del registro en el PLC no coincide con la consigna dentro de la tolerancia permitida, se declara `WRITE_FAILED_VERIFICATION_MISMATCH` y se genera alarma de seguridad inmediata.
  6. `Registro de Auditoría Forense Inmutable`: Volcado del evento en bitácora local cifrada.
- **Estrategia de Pruebas**: Intentos de escritura con tokens adulterados; escrituras con enclavamientos bloqueados; simulación de PLC que rechaza la escritura comprobando que el ciclo Read-After-Write detecta la discordancia y aborta la transacción.
- **Criterios de aceptación**: 100% de comandos ejecutados con verificación Read-After-Write en < 300 ms; aborto seguro inmediato si el actuador no responde.
- **Dependencias**: I23, I24, I26, I30.
- **Estado**: `PLANNED`.

---

### I32 — Aislamiento de Red Físico Dual-NIC (eth0 OT / eth1 DMZ) con nftables
- **Objetivo**: Garantizar el aislamiento estricto entre la red de control industrial (OT) y la red de servicios (DMZ/IT) a nivel de interfaces de red físicas y tablas de filtrado de paquetes del kernel.
- **Problema actual**: La segmentación se gestiona de forma teórica en el código sin validación de reglas de firewall reales en hardware multi-interfaz.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Configuración de Interfaces y Firewall**:
  - `eth0 (Subred OT)`: 192.168.10.10/24. Conectada al switch de control de PLCs. **SIN PUERTA DE ENLACE PREDETERMINADA (NO DEFAULT GATEWAY)**.
  - `eth1 (Subred DMZ)`: 10.0.0.10/24. Conectada a la red de enlace con salida a internet/Cloud.
  - Reglas `nftables` en `/etc/nftables.conf`:
    - `net.ipv4.ip_forward = 0` estricto en kernel.
    - Cadena de reenvío (`forward`): Política por defecto `DROP`. Bloqueo absoluto de cualquier paquete entre `eth0` y `eth1`.
    - En `eth0`: Permitir únicamente tráfico saliente TCP 4840 (OPC UA), 502/802 (Modbus) y 102 (S7) hacia IPs de PLCs autorizadas. Tráfico entrante `DROP`.
    - En `eth1`: Permitir únicamente tráfico saliente TCP 443 hacia la IP/FQDN del servidor central de BioAzúcar y NTP hacia servidor horario de planta.
- **Estrategia de Pruebas**: Escaneo de penetración de red con `nmap` desde la red de oficina intentando alcanzar la subred de PLCs atravesando el IPC; verificación de que el 100% de los paquetes son descartados silenciosamente.
- **Criterios de aceptación**: Cero paquetes reenviados entre interfaces físicas; bloqueo total de tráfico no especificado en la lista blanca de puertos.
- **Dependencias**: I21.
- **Estado**: `PLANNED`.

---

### I33 — Hardening Integral del IPC y Generación de Imagen Golden Reproducible
- **Objetivo**: Automatizar la configuración y empaquetado del sistema operativo del IPC cumpliendo rigurosamente los controles del estándar CIS Linux Benchmark Nivel 2.
- **Problema actual**: El script `golden-image-provision.sh` no incluye perfiles AppArmor, sincronización Chrony con NTS ni políticas de bloqueo de dispositivos de almacenamiento USB.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Acciones de Hardening**:
  - Configuración de perfil AppArmor en modo `enforce` para el ejecutable de Node.js, confinando el acceso a archivos exclusivamente a `/opt/bioazucar`.
  - Bloqueo de módulos de kernel para dispositivos de almacenamiento masivo USB (`install usb-storage /bin/true` en modprobe.d y regla udev `99-usb-block.rules`).
  - Instalación y configuración de `chrony` sincronizado contra servidores de tiempo NTS locales de la planta azucarera.
  - Generación de imagen base instalable (ISO desatendida o raw image) con tiempo de despliegue < 20 minutos en hardware IPC.
- **Estrategia de Pruebas**: Ejecución de la herramienta de auditoría automatizada OpenSCAP / Lynis contra el sistema operativo instalado, verificando puntuación de cumplimiento > 85/100 en CIS Benchmark Level 2.
- **Criterios de aceptación**: Cero vulnerabilidades críticas o altas en el sistema operativo base; bloqueo automático de pendrives USB conectados en caliente; arranque seguro verificado.
- **Dependencias**: I13, I21, I32.
- **Estado**: `PLANNED`.

---

### I34 — Infraestructura de Gestión de Claves, Identidad y Certificados (PKI Industrial)
- **Objetivo**: Establecer la infraestructura de clave pública (PKI) y gestión del ciclo de vida de certificados X.509 para clientes OPC UA, brokers MQTT y canales de sincronización WAN.
- **Problema actual**: Los certificados se generan con comandos manuales ad-hoc sin gestión de cadenas de confianza de planta ni procedimientos de rotación.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Estructura Criptográfica**:
  - Autoridad Certificadora de Planta (Root CA Industrial y Sub-CA de Nivel 3).
  - Emisión de certificados de dispositivo con par de claves RSA 4096 bits o ECDSA P-256.
  - Almacenamiento de claves privadas protegido con permisos `0600` y soporte para hardware criptográfico (TPM 2.0 en IPCs que lo posean).
  - Mecanismo de rotación de certificados sin interrupción de servicio con alerta temprana a 60 días de la expiración.
- **Estrategia de Pruebas**: Verificación de rechazo estricto ante certificados caducados, autofirmados no incluidos en la TrustList o firmados con algoritmos obsoletos (SHA-1/MD5).
- **Criterios de aceptación**: 100% de canales de comunicación protegidos con mTLS verificando la cadena completa de certificación hasta la CA raíz de planta.
- **Dependencias**: I33.
- **Estado**: `PLANNED`.

---

### I35 — Observabilidad Industrial, Métricas Prometheus y Diagnóstico Operativo
- **Objetivo**: Instrumentar integralmente el Edge Daemon con métricas Prometheus nativas y monitoreo de salud operativa en tiempo real para operadores y personal de automatización.
- **Problema actual**: Las métricas actuales residen en memoria y no cuentan con un exportador estandarizado ni con dashboards de diagnóstico de planta.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Métricas Expuestas (Endpoint HTTP `/metrics` local)**:
  - Tasa de adquisición por driver (`bioazucar_driver_samples_total`).
  - Latencia de ciclo de sondeo p50, p95 y p99 (`bioazucar_driver_cycle_duration_seconds`).
  - Tamaño de cola Store & Forward y conteo de puntos pendientes (`bioazucar_saf_queue_size`).
  - Muestras rechazadas por el Data Quality Gate por categoría (`bioazucar_quality_rejected_total`).
  - Recursos del IPC: Uso de CPU, memoria RSS, temperatura de CPU y espacio libre en disco (`bioazucar_system_*`).
- **Estrategia de Pruebas**: Raspado continuo de métricas con Prometheus durante pruebas de carga de 24 horas comprobando que la sobrecarga del exportador sea < 1% de CPU.
- **Criterios de aceptación**: Exposición conforme a OpenMetrics; emisión de alertas ante jitter > 50 ms o desconexión de cualquier driver de control.
- **Dependencias**: I27, I29, I30.
- **Estado**: `PLANNED`.

---

### I36 — Blindaje de Autorización Multi-Tenant y Seguridad en Servidor Central
- **Objetivo**: Blindar el servidor central en Cloud (Express + Firestore) contra cualquier posibilidad de acceso cruzado entre diferentes ingenios azucareros (tenants).
- **Problema actual**: Existen validaciones de tenant en código, pero deben consolidarse en una barrera de autorización infranqueable a nivel de token y reglas de Firestore.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Mecanismos de Blindaje**:
  - Middleware `requireTenantIsolation()` en todos los endpoints de la API, verificando la correspondencia estricta entre el `tenantId` inyectado en el JWT firmado y los datos solicitados.
  - Reglas de seguridad de Firestore (`firestore.rules`) auditadas para asegurar que ninguna consulta sin filtro de tenant sea permitida.
- **Estrategia de Pruebas**: Pruebas automatizadas de inyección y suplantación de identidad donde un usuario del Ingenio A intenta consultar telemetría del Ingenio B, verificando respuesta HTTP 403 Forbidden determinística.
- **Criterios de aceptación**: Cero fugas de información entre ingenios; auditoría de acceso multi-tenant completamente aprobada.
- **Dependencias**: I0, I16.
- **Estado**: `PLANNED`.

---

### I37 — Gobernanza y Validación End-to-End de Datos Agronómicos (Módulo PDA)
- **Objetivo**: Asegurar la consistencia matemática e inmutabilidad de los datos agrícolas (toneladas de caña cosechadas, rendimientos por lote, variedades de caña) ingresados al sistema.
- **Problema actual**: El motor agronómico posee lógica en TypeScript pero requiere verificación estricta de pistas de auditoría y validaciones de rango fenológico.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Reglas Agronómicas**: Validación de madurez (grados Brix, Pol en caña, índice de pureza), cálculo de TCH estimado según variedad y fecha de siembra, y control de desvíos en recepción de batey.
- **Estrategia de Pruebas**: Pruebas de integración verificando que valores fuera de límites fisiológicos de la caña de azúcar sean rechazados con explicaciones agronómicas claras.
- **Criterios de aceptación**: Registro inmutable de cada muestra de caña con firma de laboratorio y pesaje en báscula.
- **Dependencias**: I14, I36.
- **Estado**: `PLANNED`.

---

### I38 — Trazabilidad Criptográfica y Linaje de Datos de Extracción (Data Lineage)
- **Objetivo**: Proporcionar una pista de auditoría criptográfica inviolable que encadene cada tonelada de azúcar producida con los lotes de caña procesados y las variables de molienda y evaporación.
- **Problema actual**: Los registros de trazabilidad no cuentan con encadenamiento criptográfico por bloques.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Mecanismo**: Cada lote de azúcar (`SugarBatch`) incluye un hash SHA-256 que enlaza los lotes de caña (`CaneBatch`), los balances de extracción de molienda y los datos de pureza de melaza.
- **Estrategia de Pruebas**: Intento de alteración retroactiva de un registro histórico en la base de datos comprobando que la verificación de integridad de la cadena detecta la ruptura del hash inmediatamente.
- **Criterios de aceptación**: Trazabilidad completa desde el surco cañero hasta el saco de azúcar en almacén con verificación de integridad de datos.
- **Dependencias**: I27, I37.
- **Estado**: `PLANNED`.

---

### I39 — Separación Rigurosa de Modelos BioAI: Física vs Heurística vs ML vs LLM
- **Objetivo**: Delimitar de forma estricta las capas del motor de inteligencia artificial BioAI, estableciendo fronteras de seguridad (*Safety Boundaries*) que impidan que modelos de lenguaje o aproximaciones estadísticas interfieran directamente con el control de planta.
- **Problema actual**: Los cálculos de predicción mezclan ruido aleatorio sintético con heurísticas y textos generados por LLM.
- **Estado inicial real**: `SIMULATED` / `IMPLEMENTED`.
- **Clasificación Estricta de Modelos en BioAI**:
  1. **Ecuaciones Físicas de Primeros Principios (First-Principles Physics)**:
     - Balances de masa y energía en tándem de molinos (fórmulas canónicas de E. Hugot y Spencer-Meade).
     - Modelado de extracción de sacarosa en función de agua de imbibición y presión hidráulica.
     - Balances térmicos en calderas de vapor y generación eléctrica en turbinas.
     - *Nivel de Autoridad*: Absoluto. Sus límites no pueden ser violados por ninguna recomendación de software.
  2. **Modelos Estadísticos y Empíricos**:
     - Regresiones polinomiales y series temporales (ARIMA/Holt-Winters) para tendencia de acumulación de bagazo.
     - *Nivel de Autoridad*: Informativo y de apoyo a la planificación.
  3. **Modelos de Machine Learning (ML)**:
     - Modelos entrenados offline (Random Forest / XGBoost) para detección de degradación de cuchillas picadoras.
     - *Nivel de Autoridad*: Diagnóstico predictivo y priorización de mantenimiento.
  4. **Reglas Heurísticas Expertas**:
     - Lógica difusa y árboles de decisión basados en el conocimiento de maestros azucareros para puntos de ebullición en tachas.
     - *Nivel de Autoridad*: Recomendación supervisada.
  5. **Modelos Generativos / LLM (Gemini)**:
     - Generación de resúmenes operativos en lenguaje natural, explicaciones de causas raíz para reportes de turno y copiloto conversacional para operadores.
     - **REGLA DE SEGURIDAD INVIOLABLE**: **LOS MODELOS LLM TIENEN PROHIBIDO EMITIR SETPOINTS, COMANDOS DE CONTROL O INSTRUCCIONES HACIA EL SECURE COMMAND GATEWAY O PLCS**.
- **Flujo de Seguridad del Recomendador (Safety Boundary)**:
  $$\text{BioAI / ML} \longrightarrow \text{Recomendación} \longrightarrow \text{Filtro Envolvente Física (Hugot)} \longrightarrow \text{Autorización Humana} \longrightarrow \text{Secure Gateway} \longrightarrow \text{PLC}$$
- **Estrategia de Pruebas**: Simulación de una sugerencia generada por el LLM con un valor de presión fuera de norma; comprobación de que el filtro de envolvente física bloquea la recomendación y emite alerta de seguridad.
- **Criterios de aceptación**: Aislamiento total del LLM de cualquier canal de control; todas las predicciones de proceso sustentadas en ecuaciones físicas auditables.
- **Dependencias**: I27, I31.
- **Estado**: `PLANNED`.

---

### I40 — Calibración Empírica y Validación de Analítica Predictiva con Datos de Zafra
- **Objetivo**: Calibrar los coeficientes de los modelos predictivos de molienda y generación de vapor utilizando conjuntos de datos reales de zafras históricas de ingenios azucareros.
- **Problema actual**: Las predicciones aplican multiplicadores estáticos hardcoded (`currentTch * 1.01`, `steamFlow * 0.46`).
- **Estado inicial real**: `SIMULATED` / `IMPLEMENTED`.
- **Procedimiento de Calibración**:
  - Ingesta de dataset histórico de zafra (mínimo 60 días de operación continua de molienda con muestreo a 1 minuto).
  - Ajuste de parámetros de fibra en caña, humedad de bagazo y consumo específico de vapor mediante optimización de mínimos cuadrados.
  - Validación cruzada contra datos no observados midiendo error cuadrático medio (RMSE) y error porcentual absoluto medio (MAPE < 5%).
- **Estrategia de Pruebas**: Evaluación del modelo calibrado contra 10 jornadas de molienda históricas verificando que el pronóstico de toneladas de azúcar molidas tenga un desvío inferior al 3% respecto a las pesadas finales de báscula.
- **Criterios de aceptación**: Modelos matemáticos ajustados con datos reales demostrables; eliminación total de constantes arbitrarias en el backend.
- **Dependencias**: I39.
- **Estado**: `PLANNED`.

---

### I41 — Envolvente de Seguridad Operacional y Límites para Optimización Prescriptiva
- **Objetivo**: Implementar una envolvente de seguridad operacional dura (*Operational Safety Envelope*) que restrinja cualquier cálculo de optimización dentro de los límites mecánicos, térmicos y de diseño de los equipos del ingenio.
- **Problema actual**: No existe una capa formal que impida matemáticamente que un optimizador sugiera sobrepresiones o sobrevelocidades peligrosas.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Límites de la Envolvente**:
  - Tándem: Velocidad máxima de motores de molienda (rpm), torque máximo en reductores, presión hidráulica en vírgenes de molino ($P_{\text{max}} \le 250\text{ bar}$).
  - Calderas: Presión máxima de vapor sobrecalentado ($P_{\text{max}} \le 65\text{ bar}$), temperatura máxima de metal en sobrecalentador ($T_{\text{max}} \le 480^\circ\text{C}$), nivel mínimo de agua en domo superior.
  - Turbogeneradores: Límite de potencia activa (MW), corriente de estator máxima, frecuencia de red (59.5 - 60.5 Hz).
- **Estrategia de Pruebas**: Inyección de condiciones extremas al optimizador (ej. precio de energía alto que incentivaría forzar la caldera más allá de su capacidad nominal); comprobación de que la envolvente corta el setpoint exactamente en el límite de placa del fabricante.
- **Criterios de aceptación**: Ninguna sugerencia prescriptiva puede rebasar la envolvente bajo ninguna condición matemática.
- **Dependencias**: I39, I40.
- **Estado**: `PLANNED`.

---

### I42 — Calificación de Rendimiento de Carga y Estrés Reproducible (Performance Qualification)
- **Objetivo**: Ejecutar la calificación formal de rendimiento del Edge Daemon bajo condiciones de carga extrema controlada en laboratorio y hardware representativo, sustituyendo los números hardcoded por mediciones empíricas reproducibles.
- **Problema actual**: Las métricas de "5,000 tags/s y p99 de 11.4 ms" provienen de un archivo TypeScript con valores fijos simulados.
- **Estado inicial real**: `SIMULATED` / `TESTED`.
- **Entorno de Calificación Obligatorio**:
  - **Hardware del IPC**: Procesador x86_64 Quad-Core (Intel Elkhart Lake x6425E o superior / Core i5), 8 GB RAM DDR4, SSD NVMe industrial con protección de pérdida de energía (PLP).
  - **Sistema Operativo**: Linux Ubuntu Core 22.04 LTS o Debian 12 con kernel `PREEMPT_RT` o estándar hardening CIS.
  - **Runtime**: Node.js 20 LTS (v20.x).
  - **Configuración de Carga**: 5,000 tags/s distribuidos entre OPC UA (2,000 tags), Modbus TCP (1,500 tags), Siemens S7 (1,000 tags) y Sparkplug B (500 tags).
  - **Duración del Ensayo**: 24 horas ininterrumpidas.
- **Métricas Registradas por Instrumental Externo**:
  - Latencia de ciclo de adquisición: percentiles p50, p95 y p99. (Objetivo de diseño calificado: p99 < 25 ms).
  - Utilización de CPU: promedio y pico. (Objetivo: promedio < 65% de CPU total).
  - Consumo de Memoria: estabilidad de memoria RSS sin fugas (*memory leaks*). (Objetivo: crecimiento neto < 5 MB en 24 horas).
  - Rendimiento de I/O en Disco: IOPS y bytes escritos por segundo en el archivo WAL.
  - Muestras perdidas (*dropped samples*): 0 muestras perdidas en condiciones de operación nominal.
- **Estrategia de Pruebas**: Banco de pruebas de estrés con generador de carga industrial independiente; registro continuo en Prometheus/Grafana y reporte de telemetría exportado en CSV.
- **Criterios de aceptación**: Superación de la prueba de 24h a 5,000 tags/s cumpliendo todos los objetivos de latencia y recursos con reporte firmado por el equipo de QA.
- **Dependencias**: I23, I24, I25, I26, I27, I28, I29, I30, I35.
- **Estado**: `PLANNED`.

---

### I43 — Verificación Formal de Ciberseguridad (SAST, DAST y Pruebas de Penetración)
- **Objetivo**: Someter la totalidad del software, dependencias y configuración del IPC a análisis estático, análisis dinámico y pruebas de penetración contra puertos y servicios.
- **Problema actual**: La matriz de auditoría IEC 62443 es un reporte estático generado en código sin ejecución de herramientas de escaneo activas.
- **Estado inicial real**: `DESIGNED` / `TESTED` (Lógica).
- **Herramientas y Protocolos de Escaneo**:
  - **SAST**: Análisis de código fuente con SonarQube / Semgrep / Snyk buscando debilidades OWASP Top 10 y CWE.
  - **SCA / SBOM**: Auditoría de dependencias npm y del sistema operativo con Trivy y Grype, con generación de SBOM en formato CycloneDX v1.5. Cero vulnerabilidades críticas o altas no mitigadas.
  - **DAST y Penetration Testing**: Escaneo dinámico con OWASP ZAP contra endpoints HTTP/HTTPS; escaneo con `nmap` y `nessus` contra interfaces físicas `eth0` y `eth1` en busca de puertos o servicios vulnerables.
- **Estrategia de Pruebas**: Ejecución automatizada de escaneos en pipeline de integración continua y reporte formal de resultados.
- **Criterios de aceptación**: 100% de dependencias auditadas sin vulnerabilidades críticas o altas; bloqueo de escaneos de penetración; reporte de seguridad formal emitido.
- **Dependencias**: I32, I33, I34, I36.
- **Estado**: `PLANNED`.

---

### I44 — Calificación de Resiliencia y Chaos Testing en Hardware Físico
- **Objetivo**: Validar la tolerancia a fallas de la plataforma mediante la inducción deliberada y destructiva de perturbaciones físicas y de red sobre el IPC en banco de pruebas.
- **Problema actual**: El chaos testing actual inyecta errores simulados por software en variables en memoria.
- **Estado inicial real**: `SIMULATED` / `TESTED`.
- **Ensayos Físicos Inducidos**:
  1. **Corte Abrupto de Suministro Eléctrico**: 50 ciclos consecutivos de corte de energía mediante relé temporizado mientras el IPC escribe a máxima tasa de adquisición.
  2. **Desconexión Física de Cables de Red (Cable Pulling)**: Desconexión repetida del cable de red OT (`eth0`) y del cable de red DMZ (`eth1`) en intervalos de 1 a 60 minutos.
  3. **Saturación de Red y Tormentas de Broadcast**: Inyección de ráfagas masivas de paquetes en la interfaz OT para verificar la estabilidad de los sockets de los drivers.
  4. **Degradación Térmica de Hardware**: Operación del IPC en cámara de prueba a 55 °C comprobando disipación térmica pasiva sin throttling térmico crítico.
- **Estrategia de Pruebas**: Instrumentación con osciloscopio y analizador de red para registrar el comportamiento eléctrico y lógico del sistema durante las perturbaciones.
- **Criterios de aceptación**: Cero corrupciones de archivos en disco; recuperación de la conectividad en < 5 segundos tras reconectar cables de red; cero pérdidas de telemetría previa a los cortes eléctricos.
- **Dependencias**: I29, I30, I32, I42.
- **Estado**: `PLANNED`.

---

### I45 — Protocolo FAT (Factory Acceptance Test) Formal y Reproducible en Banco
- **Objetivo**: Ejecutar el Protocolo de Pruebas de Aceptación en Fábrica (FAT) formal, reproducible y auditable en laboratorio de automatización antes de cualquier envío de hardware a planta.
- **Problema actual**: El reporte FAT existente es un objeto JSON estático generado por código en memoria.
- **Estado inicial real**: `SIMULATED` / `MOCK`.
- **Estructura Obligatoria del Protocolo FAT**:
  - Identificador único de prueba (`FAT-BIOAZUCAR-2026-XX`).
  - Identificación de hardware: Número de serie del IPC, dirección MAC de interfaces `eth0` y `eth1`.
  - Integridad de software: Git Commit SHA y SHA-256 del bundle compilado (`dist/server.cjs`).
  - Certificados de calibración del instrumental de laboratorio utilizado.
  - Matriz de casos de prueba: Comprobación de cada protocolo (OPC UA, Modbus, S7, CIP, MQTT), Store & Forward, tiempos de respuesta, corte de energía y alarmas.
  - Registro de resultados: Valores esperados vs valores medidos en tiempo real durante la prueba.
  - Veredicto: PASS / FAIL explícito por cada caso.
  - Evidencia anexa: Capturas de tráfico Wireshark, logs de auditoría y reportes exportados.
  - Firmas formales: Aprobación manuscrita/digital del Ingeniero de Automatización y del Responsable de Calidad (QA).
- **Estrategia de Pruebas**: Sesión formal de prueba en laboratorio ejecutando el 100% de los casos del cuaderno FAT ante testigos técnicos.
- **Criterios de aceptación**: 100% de los casos de prueba de aceptación en fábrica con veredicto PASS sin excepciones críticas; acta de FAT suscrita formalmente.
- **Dependencias**: I42, I43, I44.
- **Estado**: `PLANNED`.

---

### I46 — Integración Hardware-in-the-Loop (HIL) con PLCs de Laboratorio
- **Objetivo**: Demostrar el funcionamiento del lazo completo de control y adquisición en un banco de pruebas HIL (Hardware-in-the-Loop) con controladores programables reales y simuladores de proceso en tiempo real.
- **Problema actual**: Los lazos de control han sido probados únicamente en código de prueba unitario.
- **Estado inicial real**: `PLANNED` / `MOCK`.
- **Composición del Banco HIL**:
  - PLC Siemens S7-1500 (CPU 1516-3 PN/DP) programado en TIA Portal ejecutando lógica de control de nivel de imbibición.
  - PLC Allen-Bradley CompactLogix ejecutando lazo de presión de vapor en caldera.
  - Simulador de Proceso en Tiempo Real (ej. MATLAB/Simulink o PLC auxiliar) emulando la inercia térmica y mecánica del tándem de molinos.
  - Switch industrial gestionable Nivel 2/3 con VLANs de control.
  - IPC BioAzúcar conectado a través de `eth0` ejecutando el software auditado.
- **Estrategia de Pruebas**: Ejecución de maniobras de cambio de molienda y disparo de alarmas en el banco HIL verificando la respuesta coordinada de drivers, Data Quality Gate, historiador y comandos seguros.
- **Criterios de aceptación**: Lazo cerrado funcionando de forma continua durante 48 horas sin discrepancias de variables entre el PLC y el Edge.
- **Dependencias**: I45.
- **Estado**: `PLANNED`.

---

### I47 — Integración en Planta Piloto en Modo Escucha (Read-Only Shadow Mode)
- **Objetivo**: Conectar el IPC de BioAzúcar a la red industrial real de un ingenio azucarero operando estrictamente en modo de solo lectura (*Shadow Mode*), sin capacidad de emitir comandos de escritura al proceso.
- **Problema actual**: El sistema nunca se ha conectado a la infraestructura física de un ingenio azucarero.
- **Estado inicial real**: `PLANNED`.
- **Condiciones de Operación en Sombra**:
  - Conexión física de `eth0` al switch de la sala de control de molienda / calderas.
  - Deshabilitación por software y por configuración de cualquier función de escritura hacia los PLCs (`READ_ONLY_MODE=true`).
  - Periodo de prueba: Mínimo 7 días consecutivos de zafra real.
  - Objetivos de observación:
    - Adquisición en tiempo real de los tags de molienda (TCH, presión de molinos, extracción, brix).
    - Verificación del comportamiento de los drivers ante el ruido electromagnético real de la planta.
    - Comparación de los datos históricos recolectados en el historiador local contra los datos del SCADA comercial existente del ingenio para verificar exactitud de lecturas.
- **Estrategia de Pruebas**: Cotejo diario de telemetría contra reportes de turno manuales de los operadores de molienda.
- **Criterios de aceptación**: 7 días de adquisición continua sin caídas del daemon; discrepancia entre lecturas de BioAzúcar y el SCADA existente < 0.1% en variables analógicas.
- **Dependencias**: I45, I46.
- **Estado**: `PLANNED`.

---

### I48 — Protocolo SAT (Site Acceptance Test) Formal en Sitio Azucarero
- **Objetivo**: Ejecutar el Protocolo de Pruebas de Aceptación en Sitio (SAT) en las instalaciones del ingenio azucarero, con la planta en operación activa y personal autorizado de la industria.
- **Problema actual**: El acta SAT actual es un mock en código con valores de TCH y presiones hardcoded.
- **Estado inicial real**: `MOCK` / `PLANNED`.
- **Requisitos Rigurosos del SAT en Planta**:
  - Los valores registrados en el acta (TCH, bar, MW, temperaturas, flujos) deben ser **valores físicos reales medidos durante la zafra**, no simulaciones ni estimaciones teóricas.
  - La prueba debe realizarse con presencia de:
    - Superintendente de Fabricación del Ingenio.
    - Jefe de Automatización e Instrumentación de Planta.
    - Especialista de Ciberseguridad / Redes de la empresa azucarera.
    - Líder de Ingeniería de BioAzúcar.
  - Pruebas en sitio:
    - Verificación de lazos de comunicación con todos los instrumentos de campo.
    - Prueba de corte intempestivo de energía en la subestación del tándem verificando recuperación del IPC.
    - Prueba de desconexión del enlace satelital/WAN comprobando almacenamiento en Store & Forward.
    - Inspección de calidad de datos en consolas locales HMI.
  - Acta de Aceptación Técnica en Sitio con firmas ológrafas o certificados digitales válidos de los funcionarios responsables.
- **Estrategia de Pruebas**: Ejecución del cuaderno SAT punto por punto durante el turno diurno de molienda en zafra.
- **Criterios de aceptación**: 100% de los puntos del protocolo SAT aprobados por la jefatura del ingenio sin objeciones técnicas de severidad 1 o 2; firma formal del acta.
- **Dependencias**: I47.
- **Estado**: `PLANNED`.

---

### I49 — Puesta en Marcha Técnica Industrial (Commissioning en Zafra Continua)
- **Objetivo**: Habilitar formalmente el sistema BioAzúcar 4.0 para operación continua en la zafra azucarera, activando los módulos prescriptivos y de optimización de forma progresiva.
- **Problema actual**: No existe una puesta en marcha formal en producción.
- **Estado inicial real**: `PLANNED`.
- **Fases del Comisionamiento**:
  1. *Fase A (Semana 1)*: Operación en línea para monitoreo y analítica histórica; habilitación de dashboards operativos en sala de control.
  2. *Fase B (Semana 2)*: Activación del recomendador BioAI en modo asesor (el operador revisa la sugerencia y la aplica manualmente en su panel).
  3. *Fase C (Semanas 3 y 4)*: Habilitación de lazos de optimización prescriptiva supervisada a través del Secure Command Gateway con enclavamientos activos.
- **Cálculo Riguroso de Disponibilidad Operacional**:
  Se audita la disponibilidad del sistema durante 30 días continuos bajo la fórmula formal:
  $$A = \frac{\text{MTBF}}{\text{MTBF} + \text{MTTR}} \times 100$$
  - **Diferenciación de Tiempos de Parada**:
    - *BioAzúcar Software Downtime*: Tiempo en que el Edge Daemon, la base de datos o el portal web no están operativos debido a fallas de software o del IPC.
    - *Plant Downtime*: Paradas de molienda por falta de caña, rotura mecánica en molinos, corte de vapor o paradas programadas de mantenimiento de planta (estas paradas NO se imputan a BioAzúcar).
    - *Ventanas de Mantenimiento Programado*: Acordadas contractualmente para aplicación de parches de seguridad (máximo 2 horas al mes en horarios de bajo impacto).
- **Criterios de aceptación**: Disponibilidad de BioAzúcar $A \ge 99.9\%$ durante 30 días continuos de molienda; cero incidentes de seguridad operacional.
- **Dependencias**: I48.
- **Estado**: `PLANNED`.

---

### I50 — Revisión Formal de Aptitud para Producción (Production Readiness Review - PRR)
- **Objetivo**: Conducir la revisión multidisciplinaria formal de aptitud para producción (PRR) verificando el cumplimiento estricto y auditable de las 10 condiciones no negociables de ingeniería.
- **Problema actual**: No se ha realizado una revisión formal con evidencia física auditable.
- **Estado inicial real**: `PLANNED`.
- **Procedimiento**: Evaluación de cada uno de los 10 criterios de Production Ready por un panel técnico independiente (Ingeniería de Software, Automatización Industrial, Ciberseguridad y Operaciones de Planta).
- **Criterios de aceptación**: Aprobación unánime del panel PRR con cada evidencia respaldada por artefactos de prueba verificables.
- **Dependencias**: I49.
- **Estado**: `PLANNED`.

---

### I51 — Transferencia Operativa, Capacitación y Manuales de Procedimiento
- **Objetivo**: Capacitar formalmente al personal de la planta azucarera y transferir la documentación de ingeniería, manuales de operación y procedimientos de respuesta ante contingencias.
- **Problema actual**: La documentación actual está dispersa en archivos de código sin manuales de planta formales.
- **Estado inicial real**: `PLANNED`.
- **Entregables de Documentación**:
  - Manual de Operador de Sala de Control (interpretación de pantallas HMI, alarmas y recomendaciones BioAI).
  - Manual del Ingeniero de Automatización (configuración de drivers, mapeo de tags, calibración de deadbands y diagnóstico de red).
  - Manual de Ciberseguridad y Recuperación ante Desastres (rotación de certificados, procedimientos de aislamiento de emergencia y restauración de copias de seguridad de base de datos).
  - Certificados de capacitación emitidos a operadores y técnicos de instrumentación de la planta.
- **Criterios de aceptación**: 100% de operadores de turno evaluados y aprobados en el manejo seguro del sistema; manuales técnicos entregados y archivados en sala técnica.
- **Dependencias**: I50.
- **Estado**: `PLANNED`.

---

### I52 — Ciclo de Vida Continuo, MLOps Industrial y Mantenimiento de Seguridad
- **Objetivo**: Establecer el proceso de mejora continua, gobernanza de modelos de machine learning (MLOps) y mantenimiento proactivo de la plataforma durante sucesivas zafras azucareras.
- **Problema actual**: No existe un procedimiento estructurado para reentrenar modelos predictivos con nuevas zafras ni para actualizar componentes de seguridad.
- **Estado inicial real**: `PLANNED`.
- **Actividades del Ciclo de Vida**:
  - Detección de desviación de datos (*Data Drift* y *Concept Drift*) en los modelos predictivos conforme varía la variedad de caña o el desgaste del tándem.
  - Reentrenamiento periódico y versionado de modelos con registro en catálogo auditable de modelos.
  - Aplicación de parches de seguridad trimestrales en el sistema operativo del IPC y dependencias.
  - Auditoría anual de cumplimiento de ciberseguridad industrial.
- **Criterios de aceptación**: Pipeline de MLOps automatizado; política de soporte y actualización continua documentada y activa.
- **Dependencias**: I50, I51.
- **Estado**: `PLANNED`.

---

## 7. MATRIZ MAESTRA MULTIDIMENSIONAL DE MADUREZ INDUSTRIAL

Para erradicar cualquier ambigüedad sobre el estado de la plataforma, cada subsistema y capacidad se evalúa de manera independiente a lo largo de las 11 dimensiones técnicas obligatorias:

### 7.1 Dimensiones de Evaluación
1. **`CODE`**: Código fuente escrito y sintácticamente válido.
2. **`AUTO_TEST`**: Suite de pruebas unitarias/integración en memoria aprobadas en CI (338/338).
3. **`INTEGRATION`**: Comunicación mediante sockets de red o puertos físicos reales implementada.
4. **`PROTO_INTEROP`**: Interoperabilidad verificada contra herramientas/stacks estándar de la industria.
5. **`HIL`**: Validación en banco Hardware-in-the-Loop con PLCs físicos.
6. **`SEC_TEST`**: Pruebas de ciberseguridad, SAST/DAST y análisis de penetración ejecutados.
7. **`FIELD_TEST`**: Operación verificada en hardware IPC final en entorno industrial.
8. **`FAT`**: Protocolo de Pruebas de Aceptación en Fábrica formal completado y firmado.
9. **`SAT`**: Protocolo de Pruebas de Aceptación en Sitio con caña real completado y firmado.
10. **`COMMISSIONING`**: Puesta en marcha técnica en zafra con disponibilidad $A \ge 99.9\%$ auditada.
11. **`PRODUCTION`**: Certificación final de aptitud para operación comercial continua.

### 7.2 Matriz Detallada por Capacidad Técnica

| Capacidad / Componente | CODE | AUTO_TEST | INTEGRATION | PROTO_INTEROP | HIL | SEC_TEST | FIELD_TEST | FAT | SAT | COMMISSIONING | PRODUCTION |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Arquitectura Base e ISA-95 (I0)** | YES | YES | PARTIAL | NO | NO | PARTIAL | NO | NO | NO | NO | NO |
| **Driver OPC UA Cliente (I23)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Driver Modbus TCP/RTU (I24)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Driver MQTT / Sparkplug B (I25)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Driver Siemens S7 ISO-on-TCP (I26)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Driver Rockwell CIP (I26)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Interfaz DCS EROS (I26)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Data Quality Gate Inline (I27)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Historiador Local SQLite WAL (I28)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Store & Forward WAL Transaccional (I29)** | PARTIAL| YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Runtime IPC & Hardware Watchdog (I30)** | PARTIAL| YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Secure Command Gateway RAW (I31)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Aislamiento Físico Dual-NIC (I32)** | PARTIAL| YES | NO | NO | NO | PARTIAL | NO | NO | NO | NO | NO |
| **Hardening OS CIS Level 2 (I33)** | PARTIAL| YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **PKI Industrial y Certificados (I34)** | PARTIAL| YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Observabilidad Prometheus (I35)** | PARTIAL| YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Seguridad Multi-Tenant Central (I36)** | YES | YES | YES | NO | NO | PARTIAL | NO | NO | NO | NO | NO |
| **Gobernanza Datos PDA (I37)** | YES | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO |
| **Trazabilidad Lotes SHA-256 (I38)** | YES | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO |
| **Modelos BioAI & Safety Boundary (I39)**| YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Calibración Empírica Zafra (I40)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Envolvente Operacional Hugot (I41)** | YES | YES | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Calificación de Carga 5,000 tags (I42)**| NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Auditoría SAST/DAST/PenTest (I43)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Chaos Testing Hardware (I44)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Protocolo FAT de Banco (I45)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Validación HIL con PLCs (I46)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Shadow Mode en Ingenio (I47)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Protocolo SAT en Planta (I48)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Puesta en Marcha en Zafra (I49)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **Production Readiness Review (I50)** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |

---

## 8. GRAFO EXPLICITO DE DEPENDENCIAS (DAG DE EJECUCIÓN OPTIMIZADO)

El siguiente Grafo Dirigido Acíclico (DAG) establece la secuencia formal de ejecución para las iteraciones I22 a I52, **optimizando el paralelismo seguro**:
1. **Desacoplo del Núcleo de Calidad (I27)**: No se bloquea por la disponibilidad física de todos los drivers; se inicia inmediatamente contra el Contrato Canónico `IndustrialDataPoint` y el arnés de prueba de laboratorio (`Canonical Test Harness`).
2. **Desarrollo Modular y Asíncrono de Drivers (I23, I24, I25, I26)**: Cada adaptador se conecta al contrato canónico de forma independiente según disponibilidad de hardware/servidores de referencia.
3. **Paralelismo de Calificación y Pruebas (I42, I43, I44)**: Tras consolidar el runtime y las envolventes de seguridad, las pruebas de Rendimiento (I42), Seguridad (I43) y Chaos Testing (I44) se ejecutan en ramas concurrentes antes de la convergencia en el banco formal FAT (I45).

```
                      [ I22: Runtime Profiles, Fail-Closed y Contrato Canónico ]
                                                  │
                 ┌────────────────────────────────┴───────────────────────────────┐
                 │                                                                │ (Desacoplo Inmediato)
                 ▼                                                                ▼
      [ RAMA DRIVERS INDUSTRIALES (DQT) ]                        [ I27: Data Quality Gate Inline ]
      ├─► [ I23: OPC UA Real (node-opcua) ]                                       │  (Canónicamente probado)
      ├─► [ I24: Modbus TCP/RTU (modbus-serial) ]                                 ├───────────────────────────────┐
      ├─► [ I25: MQTT / Sparkplug B (Protobuf) ]                                  ▼                               ▼
      └─► [ I26: S7 / CIP / EROS Spec RFI ]                       [ I28: Historiador SQLite WAL ]   [ I29: Store & Forward WAL ]
                 │                                               (Benchmark 90d + Sync Eval)    (RPO ≤ 100 ms fsync)
                 │ (Integración modular en contrato)                              │                               │
                 └────────────────────────────────┬───────────────────────────────┴───────────────────────────────┘
                                                  ▼
                                 [ I30: Watchdog Hardware y Sandbox ]
                                                  │
                 ┌────────────────────────────────┼───────────────────────────────┐
                 ▼                                ▼                               ▼
   [ I31: Secure Command Gateway ]    [ I32: Dual-NIC nftables ]      [ I33: Hardening CIS IPC ]
   (LLM ⨉ PLC / Human Approval)                   │                               │
                 │                                └───────────────┬───────────────┘
                 │                                                ▼
                 │                                 [ I34: PKI y Certificados X.509 ]
                 │                                                │
                 └────────────────────────────────┬───────────────┘
                                                  ▼
                                 [ I35: Observabilidad Prometheus ]
                                                  │
                                 [ I36: Multi-Tenant Cloud Hardening ]
                                                  │
                 ┌────────────────────────────────┴───────────────────────────────┐
                 ▼                                                                ▼
   [ I37: Gobernanza Datos PDA ]                                  [ I39: BioAI Safety Boundary ]
                 │                                                (Desacoplo Físico de LLM)
   [ I38: Trazabilidad SHA-256 ]                                                  │
                 │                                                [ I40: Calibración Empírica Zafra ]
                 │                                                                │
                 │                                                [ I41: Envolvente Operacional Hugot ]
                 │                                                                │
                 └────────────────────────────────┬───────────────────────────────┘
                                                  ▼
                 ┌────────────────────────────────┼───────────────────────────────┐
                 │ (Ramas Paralelas de Calificación Técnica)                       │
                 ▼                                ▼                               ▼
   [ I42: Calificación Rendimiento ]  [ I43: Verificación Seguridad ]  [ I44: Chaos Testing Físico ]
   (Target 5k tags/s, p99<25ms)       (SAST, DAST, Hardening)         (Power-loss destructivo)
                 │                                │                               │
                 └────────────────────────────────┼───────────────────────────────┘
                                                  ▼
                                   [ I45: Protocolo FAT en Banco ]
                                   (Pruebas de Aceptación en Fábrica)
                                                  │
                                   [ I46: Integración HIL con PLCs ]
                                   (Hardware-in-the-Loop con dinámica)
                                                  │
                                   [ I47: Shadow Mode Planta Piloto ]
                                   (Read-Only 7 días continuos)
                                                  │
                                   [ I48: Protocolo SAT en Ingenio ]
                                   (Site Acceptance Test con firmas)
                                                  │
                                   [ I49: Commissioning en Zafra ]
                                   (30 días continuos A ≥ 99.9%)
                                                  │
                                   [ I50: Production Readiness Review (PRR) ]
                                                  │
                 ┌────────────────────────────────┴───────────────────────────────┐
                 ▼                                                                ▼
   [ I51: Transferencia Operativa y Manuales ]                    [ I52: MLOps Industrial y Ciclo Continuo ]
```

---

## 9. DEFINICIÓN OBJETIVA DE PRODUCTION_READY Y CLASIFICACIÓN DE MÉTRICAS

### 9.1 Matriz de Clasificación de Métricas y Valores de Ingeniería

Queda terminantemente prohibido declarar como "100% completada" cualquier métrica o condición que dependa de hardware de planta, condiciones de zafra o validaciones de campo. Cada cifra utilizada en este documento se clasifica estrictamente en una de las siguientes categorías normativas:

| Métrica / Parámetro | Valor Nominal | Clasificación Formal | Método y Evidencia de Validación |
| :--- | :--- | :--- | :--- |
| **Throughput de Ingestión** | $5,000	ext{ tags/s}$ | `PROVISIONAL ENGINEERING TARGET` | Benchmark sintético de estrés en laboratorio I42 sobre hardware IPC industrial final. |
| **Latencia p99 de Ingestión** | $< 25	ext{ ms}$ | `PROVISIONAL ENGINEERING TARGET` | Telemetría monótona interna en arnés de prueba de estrés I42. |
| **Utilización de CPU en IPC** | $< 65\%$ | `PROVISIONAL ENGINEERING TARGET` | Monitoreo continuo mediante cgroups de Linux y Node Exporter bajo carga plena en I42. |
| **Retención en Historiador** | $90	ext{ días}$ | `PROVISIONAL ENGINEERING TARGET` | Benchmark de calificación de base de datos I28 con extrapolación volumétrica y particionado mensual. |
| **RPO ante Corte Eléctrico** | $\le 100	ext{ ms}$ | `ENGINEERING REQUIREMENT` | Prueba física destructiva de corte intempestivo de alimentación de 24 VDC a plena carga en I29/I44. |
| **RTO de Enlace WAN** | $\le 10	ext{ s}$ | `PROVISIONAL ENGINEERING TARGET` | Prueba de desconexión y restablecimiento de interfaz WAN en banco de pruebas I29. |
| **Estabilidad en Shadow Mode** | $7	ext{ días continuos}$ | `QUALIFICATION CRITERION` | Registro ininterrumpido en modo sólo lectura en planta piloto (I47) sin fallas ni reinicios del daemon. |
| **Disponibilidad Operativa ($A$)** | $\ge 99.9\%$ | `FIELD ACCEPTANCE CRITERION` | Medición matemática formal durante 30 días de zafra industrial continua en I49 sin downtime de BioAzúcar. |
| **Comisionamiento en Zafra** | $30	ext{ días continuos}$ | `FIELD ACCEPTANCE CRITERION` | Operación en línea en tándem de molinos con acta formal de aceptación suscrita por la jefatura de planta (I49). |

### 9.2 Diez Condiciones Auditables de Production Readiness

Para certificar formalmente la plataforma como `PRODUCTION_READY`, cada una de las siguientes 10 condiciones debe contar con evidencia verificable, responsable asignado y criterio de aceptación formal:

| # | Requisito Industrial | Artefacto de Evidencia Obligatorio | Responsable Técnico | Método de Verificación | Criterio de Aceptación Estricto | Estado Actual |
| :-: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Conectividad OT Wire-Level Real** | Capturas `.pcap` de Wireshark de sesiones OPC UA mTLS, Modbus TCP/RTU y S7 ISO-on-TCP. | Especialista de Conectividad OT | Inspección profunda de paquetes contra PLCs físicos / reference servers. | Cero llamadas sintéticas; tramas de red conformes a RFC/IEC. | `PENDING_I23_I26` |
| **2** | **Data Truth Inviolable** | Logs estructurados de `DataQualityGate` y métricas Prometheus de calidad. | Líder de Arquitectura de Datos | Inyección forzada de señales simuladas, deriva temporal y flatlines. | 100% de datos sintéticos o anómalos marcados como no confiables. | `PENDING_I27` |
| **3** | **Persistencia Duradera y RPO Demostrado** | Archivos de base de datos SQLite WAL recuperados tras corte de suministro eléctrico. | Ingeniero de Sistemas Embebidos | Ensayo de corte eléctrico intempestivo en banco de pruebas con disco PLP. | Cero corrupción de base de datos; RPO garantizado $\le 100	ext{ ms}$. | `PENDING_I28_I29` |
| **4** | **Aislamiento de Red Dual-NIC y Hardening** | Salida de `nftables -L`, reporte Lynis/OpenSCAP (>85/100) y escaneo nmap limpio. | Oficial de Ciberseguridad OT | Escaneo de puertos y pruebas de reenvío entre interfaces físicas `eth0`/`eth1`. | Cero paquetes reenviados entre OT y DMZ; AppArmor activo en modo enforce. | `PENDING_I32_I33` |
| **5** | **Gateway de Comandos con Read-After-Write** | Bitácora de auditoría forense con firmas criptográficas y lecturas de confirmación. | Ingeniero de Control y Seguridad | Prueba de consignas sobre registros de PLC con interlocks activos y doble factor. | 100% de escrituras verificadas por lectura síncrona previa a confirmación. | `PENDING_I31` |
| **6** | **BioAI con Safety Boundary** | Trazas de inferencia demostrando desacoplo físico del LLM y límites de envolvente Hugot. | Científico de Datos / Especialista Azúcar | Inyección de setpoints extremos por optimizador de IA. | Ninguna recomendación de IA puede superar los límites mecánicos del molino. | `PENDING_I39_I41` |
| **7** | **Calificación de Carga y Resiliencia** | Reporte de prueba de 24 horas a 5,000 tags/s firmado con métricas de jitter y recursos. | Líder de Pruebas y QA | Ensayo continuo de estrés en IPC físico en laboratorio (I42/I44). | p99 < 25 ms, CPU < 65%, 0 memoria fugada, 0 muestras perdidas. | `PENDING_I42_I44` |
| **8** | **Acta FAT de Banco Aprobada** | Documento FAT formal con firmas de ingeniería, números de serie y SHA de software. | Jefe de Aseguramiento de Calidad | Ejecución formal del cuaderno de pruebas FAT en laboratorio. | 100% de casos de prueba aprobados (PASS) sin excepciones abiertas. | `PENDING_I45` |
| **9** | **Acta SAT de Sitio Azucarero Aprobada** | Documento SAT en planta suscrito por Superintendente de Molienda y Jefe de Automatización. | Director de Operaciones / Cliente | Pruebas funcionales en planta durante zafra activa. | Valores de proceso reales verificados y aprobados por la planta. | `PENDING_I48` |
| **10** | **Comisionamiento y Disponibilidad en Zafra** | Bitácora de disponibilidad de 30 días continuos con cálculo de MTBF y MTTR. | Gerente de Puesta en Marcha | Monitoreo ininterrumpido en campaña de producción continua. | Disponibilidad de software $A \ge 99.9\%$; cero interrupciones de zafra. | `PENDING_I49_I50` |

---

## 10. CRITERIOS TÉCNICOS DEFINITIVOS PARA INICIAR LA ITERACIÓN I22

La iteración I22 puede dar inicio formal de manera inmediata al haberse verificado satisfactoriamente los siguientes cuatro prerrequisitos:

1. **Hoja de Ruta Bloqueada y Congelada**: El presente documento (`developer_roadmap.md` Versión 4.3.0-FROZEN-ARCHITECTURE-SPEC) ha sido congelado y auditado como la única especificación autoritativa de ingeniería para el proyecto.
2. **Integridad de Pruebas de Línea Base**: La suite automatizada existente en memoria (338/338 pruebas) se mantiene pasando al 100% y la compilación del proyecto (`compile_applet`) es plenamente exitosa.
3. **Arquitectura de Runtime Profiles y Fail-Closed Especificada**: El diseño de I22 incorpora formalmente los tres perfiles (`SIMULATION`, `LAB`, `PRODUCTION`) y la política mandatoria Fail-Closed en producción, superando cualquier dependencia exclusiva de variables binarias ad-hoc.
4. **Contrato Canónico de Proveniencia de Primera Clase**: El contrato `IndustrialDataPoint` con sus 17 campos tipados y la cadena inviolable de datos (`SOURCE -> PROVENANCE -> NORMALIZATION -> DATA QUALITY -> TRUST -> HISTORIAN -> ANALYTICS -> BIOAI`) se encuentran formalmente definidos para su implementación inmediata.
