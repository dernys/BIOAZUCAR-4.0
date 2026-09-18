# BioAzúcar 4.0 — Documento Maestro de Desarrollo y Hoja de Ruta Industrial

> **Versión:** 4.1.0-REBASELINE-INDUSTRIAL  
> **Estado:** DOCUMENTO MAESTRO ACTIVO DE INGENIERÍA  
> **Auditoría Técnica:** Realizada contra el código fuente real del repositorio  
> **Ámbito:** Industrial Edge Daemon, Conectividad OT Wire-Level, Data Truth Inviolable, Ciberseguridad IEC 62443 SL3, Historiador On-Premise, Pipeline BioAI/ML, HMI/SCADA, FAT/SAT en Sitio y Comisionamiento.

---

## 1. REGLA FUNDAMENTAL DE INGENIERÍA Y CLASIFICACIÓN DE ESTADOS

Bajo el estándar de ingeniería industrial de BioAzúcar 4.0, queda terminantemente prohibido asumir que un componente está listo para planta basándose en código compilado, interfaces gráficas interactivas o pruebas automatizadas en memoria.

### 1.1 Taxonomía de Estados Obligatoria
Todo módulo, driver, algoritmo o capacidad debe clasificarse estrictamente en uno de los siguientes estados:

1. **`PLANNED`**: Requisito arquitectónico identificado y documentado, sin código base funcional asociado.
2. **`PARTIAL`**: Código incompleto, stubs parciales o funcionalidad interrumpida a nivel lógico.
3. **`IMPLEMENTED`**: Código fuente TypeScript/Node.js/Bash escrito y sintácticamente válido, estructurado según contratos.
4. **`SIMULATED`**: La lógica genera o consume datos calculados internamente (senos, Math.random, ecuaciones teóricas, retardos artificiales con setTimeout).
5. **`MOCK`**: Respuestas fijas o estructuras hardcoded en memoria o archivos JSON estáticos para emular sistemas externos.
6. **`TESTED`**: Suite automatizada (Vitest/Node) ejecutada en memoria que verifica la lógica interna contra sí misma o contra dobles de prueba (338/338 pruebas verdes).
7. **`INTEGRATED`**: El componente se comunica por socket/red real con un peer externo (servidor OPC UA de prueba, broker Mosquitto, PLC virtual, base de datos local).
8. **`VERIFIED`**: Pruebas formales de rendimiento, carga o estrés ejecutadas con instrumental de laboratorio verificable y repetible (sin números hardcoded).
9. **`FIELD_VALIDATED`**: Operación comprobada en hardware físico final (IPC) conectado a instrumentos y controladores reales en sala de control o taller eléctrico.
10. **`COMMISSIONED`**: Puesta en marcha técnica en proceso productivo real (tándem de molienda o caldera) con acta formal de aceptación suscrita por operadores y jefatura de planta.
11. **`PRODUCTION_READY`**: Cumplimiento del 100% de los criterios de disponibilidad, seguridad IEC 62443 SL3, redundancia física, observabilidad y operación continua de zafra.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REGLA DE NO-PROMOCIÓN ARTIFICIAL:                                                                       │
│ IMPLEMENTED ≠ TESTED  │  TESTED ≠ VERIFIED  │  VERIFIED ≠ FIELD_VALIDATED  │  COMMISSIONED ≠ PRODUCTION │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

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
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `TESTED`.
  - *Evidencia*: Mapeo de variables analógicas/digitales en `memoryMap` con retardo artificial de 90ms (`setTimeout`).

### 2.2 Persistencia Local y Store & Forward
- **Store & Forward (`StoreAndForwardQueue.ts`, `DiskStoreAndForwardEngine.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `PARTIAL` / `TESTED`.
  - *Evidencia*: `StoreAndForwardQueue` almacena en un arreglo en memoria JavaScript (`private queue: IndustrialDataPoint[] = []`). `DiskStoreAndForwardEngine` implementa un volcado debounced (500 ms) usando `fs.writeFileSync(JSON.stringify(pending))` con cifrado AES.
  - *Veredicto*: **No es un SQLite WAL**. Un corte repentino de energía en el IPC durante ráfagas de 5,000 tags/s provocaría pérdida de los últimos 500 ms de datos o corrupción por escritura atómica incompleta de un archivo JSON monobloque. La declaración "RPO=0 comprobado ante corte eléctrico" era una aserción simulada en el software de prueba.
- **Historiador Local (`LocalTimeSeriesDatabase.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK` / `TESTED`.
  - *Evidencia*: Utiliza un mapa en memoria RAM: `private tagSeries = new Map<string, StoredSample[]>()`. No persiste series de tiempo en SQLite, InfluxDB ni TimescaleDB. Al reiniciar el proceso, el historial local de 30 días se pierde por completo.

### 2.3 Ciberseguridad IEC 62443, Red Dual-NIC y Hardening
- **Segmentación Dual-NIC (`DualNicManager.ts`, `golden-image-provision.sh`)**:
  - *Estado Real*: `IMPLEMENTED` / `PARTIAL` (Script Bash inicial).
  - *Evidencia*: El script aplica directivas `sysctl` (`net.ipv4.ip_forward = 0`) y genera un par de claves openssl RSA-4096. Sin embargo, no implementa las tablas `nftables`/`iptables` para bloqueo estricto de paquetes entre `eth0` y `eth1`, no instala Chrony/NTS, no configura perfiles AppArmor en modo enforce ni restringe almacenamiento USB mediante reglas udev.
- **Matriz de Auditoría IEC 62443 SL3 (`Iec62443AuditService.ts`)**:
  - *Estado Real*: `IMPLEMENTED` / `MOCK`.
  - *Evidencia*: La clase genera un reporte estático con 100% de cumplimiento en requisitos FR1-FR7 y un SBOM CycloneDX preconfigurado. No existe una auditoría externa ni escaneo de vulnerabilidades dinámico (DAST) contra binarios reales.

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

## 3. REBASELINE HISTÓRICO DE LAS ITERACIONES PREVIAS (I0–I21)

Se corrigen de forma transparente y objetiva los estados de las iteraciones completadas a nivel de software, delimitando con rigor su alcance real:

| Iteración | Título y Alcance Técnico | Estado Anterior | Estado Real Rebaseline | Evidencia de Código y Limitaciones |
| :--- | :--- | :--- | :--- | :--- |
| **I0** | Arquitectura IEC 62443, ISA-95 y Seguridad Base | COMPLETADA | `IMPLEMENTED` / `TESTED` | Zonas lógicas y tipos definidos; segmentación de red física pendiente de switches OT. |
| **I1** | Contrato Canónico de Drivers (`IIndustrialDriver`) | COMPLETADA | `IMPLEMENTED` / `TESTED` | Interfaz y ciclo de vida definidos; drivers operan sobre memoria RAM sin sockets. |
| **I2** | Cliente OPC UA (Suscripciones, Certificados) | COMPLETADA | `IMPLEMENTED` / `MOCK` | Mapeo de AddressSpace en memoria; sin socket TCP ni binario OPC UA nativo. |
| **I3** | Conformidad OPC UA (Suite CTT) | COMPLETADA | `SIMULATED` / `TESTED` | Casos CTT estructurados en TypeScript; sin ejecución contra CTT tool de OPC Foundation. |
| **I4** | Modbus TCP/RTU, Endianness y CRC-16 | COMPLETADA | `IMPLEMENTED` / `MOCK` | Cálculo matemático de CRC16 y endianness funcional; registros simulados en Map. |
| **I5** | Modbus Security (mTLS en Puerto 802) | COMPLETADA | `IMPLEMENTED` / `MOCK` | Reglas lógicas de roles; sin handshake TLS v1.3 wire-level en socket de red. |
| **I6** | MQTT Sparkplug B (NBIRTH, NDATA, NDEATH) | COMPLETADA | `IMPLEMENTED` / `SIMULATED` | Estructuras de datos conformes a especificación; payload en JSON sin Protobuf binario. |
| **I7** | Adaptadores DCS EROS, Siemens S7 y Rockwell CIP | COMPLETADA | `IMPLEMENTED` / `MOCK` | Parsers de direcciones S7/CIP válidos; lecturas ejecutadas sobre Map en memoria. |
| **I8** | Edge Watchdog & Supervisor de Procesos | COMPLETADA | `IMPLEMENTED` / `TESTED` | Máquina de estados de resiliencia probada en Vitest; sin watchdog por hardware Linux (`/dev/watchdog`). |
| **I9** | Historiador On-Premise TSDB | COMPLETADA | `IMPLEMENTED` / `MOCK` | Ring-buffer y algoritmos de agregación en RAM; sin persistencia en disco duradero. |
| **I10** | Sincronización Determinística y Reloj de Lamport | COMPLETADA | `IMPLEMENTED` / `TESTED` | Algoritmo lógico de desempate probado; requiere pruebas de desincronización horaria real. |
| **I11** | Segmentación Física Dual-NIC (eth0 OT / eth1 DMZ) | COMPLETADA | `PARTIAL` / `DESIGNED` | Generador de iptables en software; sin verificación en interfaces físicas de red. |
| **I12** | Acceso Remoto Zero-Trust y Emergency Lockdown | COMPLETADA | `IMPLEMENTED` / `TESTED` | Control lógico de revocación de sesiones; aislamiento a nivel de aplicación. |
| **I13** | Hardening OS CIS Linux Benchmark v2.0 | COMPLETADA | `PARTIAL` / `IMPLEMENTED` | Parámetros sysctl definidos en bash; faltan perfiles AppArmor y políticas udev. |
| **I14** | Principio Inviolable Data Truth (SIMULATED ≠ REAL) | COMPLETADA | `IMPLEMENTED` / `TESTED` | Reglas inmutables en `DataQualityEngine.ts`; todos los datos de prueba son sintéticos. |
| **I15** | Data Quality Engine Industrial (Deadband, Skew) | COMPLETADA | `IMPLEMENTED` / `TESTED` | Filtros de congelamiento, rango y tasa de cambio validados en pruebas unitarias. |
| **I16** | Secure Command Gateway (2FA, Anti-Replay, 4 Ojos) | COMPLETADA | `IMPLEMENTED` / `TESTED` | Tubería criptográfica validada en software; sin interlocks cableados ni escritura en PLC. |
| **I17** | FAT en Banco de Pruebas (5,000 tags/s, Corte) | COMPLETADA | `SIMULATED` / `TESTED` | Reporte FAT programático con números fijos; sin banco de pruebas físico. |
| **I18** | SAT en Planta Piloto (Molienda, Caldera, Turbina) | COMPLETADA | `MOCK` / `PLANNED` | Acta SAT prediseñada; no se ha ejecutado puesta en marcha en ingenio real. |
| **I19** | Chaos Testing Industrial & Resiliencia | COMPLETADA | `IMPLEMENTED` / `TESTED` | Inyección de fallas por software en memoria; sin desconexión física de cables. |
| **I20** | Paquete de Evidencia y Matriz IEC 62443 SL3 | COMPLETADA | `IMPLEMENTED` / `DESIGNED`| Trazabilidad documental de requisitos; sin certificación de laboratorio acreditado. |
| **I21** | Imagen Golden IPC y Despliegue Automatizado | COMPLETADA | `PARTIAL` / `TESTED` | Script bash de aprovisionamiento funcional; sin empaquetado ISO/tarball reproducible. |

---

## 4. HOJA DE RUTA MAESTRA INTEGRAL (ITERACIONES I22 A I52)

A continuación se despliegan las 31 iteraciones obligatorias requeridas para transformar la base de software existente en una plataforma industrial física, validada, segura y comisionada.

---

### I22 — Rebaseline Técnico y Eliminación de Simulaciones Críticas en Ingestión
- **Objetivo**: Desacoplar completamente las fuentes de datos simuladas del pipeline principal del Edge Daemon y garantizar que el modo de producción rechace cualquier generación de valores sintéticos (`Math.random()`, `sin()`).
- **Problema actual**: Los adaptadores de drivers generan ruido sintético cuando una variable no existe o cuando operan sin configuración física.
- **Estado inicial real**: `SIMULATED` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/drivers/*DriverAdapter.ts`, `src/services/edge/daemon.ts`.
- **Cambios técnicos requeridos**: Introducir flag estricto `ALLOW_SIMULATION=false` en el runtime del Daemon. Si no hay conexión física, el driver debe transicionar a `FAULTED` y emitir tags con calidad `BAD` y razón `NO_COMMUNICATION`.
- **Cambios de arquitectura**: Prohibir la autogeneración de datos dentro de los adaptadores de drivers; delegar las simulaciones exclusivamente a un simulador de proceso externo aislado.
- **Implementación**: Refactorizar métodos `readTag()` en todos los drivers para eliminar `Math.random()` y volcados de Maps de prueba cuando no estén en perfil explícito de pruebas unitarias.
- **Pruebas automatizadas**: Suite que valida que con `ALLOW_SIMULATION=false`, la ausencia de hardware físico genera error determinístico y calidad `BAD`.
- **Pruebas de integración**: Arranque del daemon sin red OT comprobando que ningún tag sea emitido como `GOOD`.
- **Pruebas físicas/HIL**: N/A en esta fase.
- **Evidencia requerida**: Logs estructurados mostrando rechazo de generación sintética y calidad `BAD` inmediata.
- **Criterios de aceptación**: Cero llamadas a funciones estocásticas en modo de producción; propagación de calidad `BAD` con código `COMMUNICATION_FAILURE`.
- **Criterios de NO aceptación**: Cualquier tag que reporte calidad `GOOD` o genere valores numéricos fluctuantes sin comunicación física establecida.
- **Dependencias**: I1, I14.
- **Riesgos**: Rotura de dashboards que esperaban valores continuos en demos.
- **Rollback**: Habilitación temporal mediante variable de entorno `BIOAZUCAR_DEMO_MODE=true` en ambientes de desarrollo.
- **Definition of Done**: Código refactorizado, tests unitarios verdes, linteo estricto y configuración de producción sin simulación.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución.

---

### I23 — OPC UA Físico Real Wire-Level (TCP/IP Binario, SecureChannel y mTLS)
- **Objetivo**: Dotar a `OpcUaDriverAdapter` de transporte físico TCP real mediante stack nativo OPC UA sobre puerto 4840.
- **Problema actual**: El driver emula el AddressSpace con un Map en memoria sin conexión socket real.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `package.json`, `src/services/edge/drivers/OpcUaDriverAdapter.ts`, `src/services/edge/drivers/opcua/PhysicalOpcUaClient.ts`.
- **Cambios técnicos requeridos**: Incorporar librería cliente OPC UA industrial (`node-opcua-client`), configuración de canal seguro (Basic256Sha256 / Aes128_Sha256_RsaOaep), validación de certificados de servidor contra TrustList de planta, lectura asíncrona de nodos reales y suscripciones monitored items con deadband de servidor.
- **Cambios de arquitectura**: Conexión directa desde el proceso Node.js del Edge Daemon sobre la interfaz `eth0` hacia la IP del PLC/Servidor.
- **Implementación**: Crear `PhysicalOpcUaClient` encapsulando la sesión, token de seguridad, renovación de credenciales y callback de suscripción con buffers tipados.
- **Pruebas automatizadas**: Test unitario de inicialización, parsing de NodeIds (`ns=2;s=...`) y timeouts.
- **Pruebas de integración**: Conexión contra servidor de prueba local (contenedor Docker open62541 o Prosys OPC UA Simulation Server).
- **Pruebas físicas/HIL**: Conexión a PLC Siemens S7-1500 con servidor OPC UA activo en rack de prueba.
- **Evidencia requerida**: Captura Wireshark (`.pcap`) mostrando handshake OPN/ACK, SecureChannel y mensajes Publish/PublishResponse binarios.
- **Criterios de aceptación**: Conexión TCP estable, negociación mTLS con certificados de 2048/4096 bits, latencia de lectura < 15 ms por lote de 200 tags.
- **Criterios de NO aceptación**: Modos sin cifrar (`None`), caída del daemon por desconexión del servidor, pérdida de memoria en suscripciones.
- **Dependencias**: I22.
- **Riesgos**: Incompatibilidad de perfiles de seguridad con PLCs antiguos.
- **Rollback**: Degradación a modo lectura síncrona por sondeo si las suscripciones fallan.
- **Definition of Done**: Conexión wire-level verificada contra servidor OPC UA real con mTLS y suscripciones activas.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de captura pcap y log de sesión.

---

### I24 — Modbus TCP / RTU Físico Wire-Level (Sockets 502/802 y Serial RS-485)
- **Objetivo**: Reemplazar el `registerMap` en memoria por conexiones socket TCP crudas (puerto 502/802) y puerto serial físico (`/dev/ttyUSB0` / `/dev/ttyS0`).
- **Problema actual**: Modbus lee valores sintéticos y calcula latencias artificiales.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/drivers/ModbusDriverAdapter.ts`, `src/services/edge/drivers/modbus/ModbusTcpTransport.ts`, `src/services/edge/drivers/modbus/ModbusRtuTransport.ts`.
- **Cambios técnicos requeridos**: Implementar cliente Modbus con tramas MBAP (Transaction ID, Protocol ID, Length, Unit ID, Function Code) sobre `net.Socket` para TCP y tramas binarias con CRC-16 para RTU serial. Soporte para Modbus Security TLS sobre puerto 802.
- **Cambios de arquitectura**: Conexión determinística con control de temporización de trama (3.5 caracteres en RTU) y cola de peticiones no bloqueante.
- **Implementación**: Clases de transporte físico con lectura de Holding Registers (FC03), Input Registers (FC04), Coils (FC01) y escritura protegida (FC06, FC16).
- **Pruebas automatizadas**: Serialización/deserialización binaria de tramas PDU y validación de CRC-16.
- **Pruebas de integración**: Pruebas de comunicación contra simulador de campo Modbus (Diagslave / Modbus Server en red local).
- **Pruebas físicas/HIL**: Conexión a multímetro digital industrial / transmisor de presión Modbus RTU vía conversor RS-485 a USB.
- **Evidencia requerida**: Tramas hexadecimales registradas en log de bajo nivel y captura Wireshark en puerto 502/802.
- **Criterios de aceptación**: Lectura consistente de 50 registros por ciclo con dispersión temporal < 5 ms y reintento automático tras timeout de 200 ms.
- **Criterios de NO aceptación**: Bloqueo del hilo de eventos por socket colgado; corrupción de bytes por desalineación de endianness.
- **Dependencias**: I22.
- **Riesgos**: Ruido electromagnético en buses RS-485 de molienda provocando errores de CRC.
- **Rollback**: Disminución de velocidad de baudios (19200 a 9600) y aumento de timeouts en RTU.
- **Definition of Done**: Comunicación socket y serial operando contra equipos reales sin fallas en 100,000 ciclos de sondeo.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de validación en banco de pruebas.

---

### I25 — MQTT / Sparkplug B Wire-Level Nativo (Broker TCP/TLS y Google Protobuf Binario)
- **Objetivo**: Conectar el Edge Daemon a brokers MQTT industriales físicos codificando métricas en formato binario Sparkplug B (Protobuf).
- **Problema actual**: Emisión de cadenas JSON simuladas en memoria sin cliente MQTT de red ni compilación Protobuf.
- **Estado inicial real**: `SIMULATED` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `package.json`, `src/services/edge/drivers/MqttSparkplugDriverAdapter.ts`, `src/services/edge/protocols/SparkplugBProtobuf.ts`.
- **Cambios técnicos requeridos**: Incorporar biblioteca cliente MQTT sobre TCP/TLS (`mqtt`), compilar el archivo proto oficial de Eclipse Tahu para Sparkplug B (`sparkplug_b.proto`), manejar secuencias estrictas `0..255`, LWT binario `NDEATH` y compresión de métricas.
- **Cambios de arquitectura**: El Edge Daemon se convierte en un EoN (Edge of Network) Node oficial dentro del ecosistema Sparkplug B.
- **Implementación**: Integración de socket TLS con validación de certificado CA, codificación binaria de `NBIRTH`, `NDATA`, `DDEATH` y máquina de estados de reconexión sin pérdida de secuencia.
- **Pruebas automatizadas**: Serialización y decodificación de payloads Protobuf comprobando fidelidad de tipos (Double, Float, Int64, String, Boolean).
- **Pruebas de integración**: Conexión contra broker Eclipse Mosquitto / EMQX con TLS y autenticación por credenciales.
- **Pruebas físicas/HIL**: Conexión a broker de planta en sala eléctrica de cogeneración.
- **Evidencia requerida**: Inspección de tópicos en broker (`spBv1.0/Grupo/NDATA/Nodo`) con payloads binarios validados mediante `sparkplug-app`.
- **Criterios de aceptación**: Publicación de telemetría a 10 Hz con secuencia continua, entrega QoS 0/1 garantizada y emisión inmediata de `NDEATH` en corte de enlace.
- **Criterios de NO aceptación**: Transmisión de payloads en texto plano JSON bajo tópicos Sparkplug B; saltos no justificados en el número de secuencia.
- **Dependencias**: I22.
- **Riesgos**: Sobrecarga de red por ráfagas excesivas de DDATA.
- **Rollback**: Filtrado estricto por banda muerta (*deadband*) en origen para reducir frecuencia de publicación.
- **Definition of Done**: Nodo Sparkplug B reconocido por broker industrial enviando datos binarios válidos.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de integración con broker.

---

### I26 — Adaptadores Nativos Siemens S7, Rockwell CIP y DCS EROS
- **Objetivo**: Establecer comunicación física nativa ISO-on-TCP (puerto 102) con PLCs Siemens S7-300/400/1200/1500 y EtherNet/IP CIP (puerto 44818) con Allen-Bradley.
- **Problema actual**: Direcciones S7 y CIP se resuelven contra un `memoryMap` local.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/drivers/SiemensS7DriverAdapter.ts`, `src/services/edge/drivers/EtherNetIpDriverAdapter.ts`, `src/services/edge/drivers/ErosDriverAdapter.ts`.
- **Cambios técnicos requeridos**: Implementar capa de transporte COTP / ISO-on-TCP RFC 1006 para Siemens S7 con PDU negotiation, y encapsulación CIP sobre TCP/IP con Forward Open y Unconnected Message Manager (UCMM) para Rockwell.
- **Cambios de arquitectura**: Comunicación punto a punto de alto rendimiento directa con las CPUs de control sin intermediarios OPC.
- **Implementación**: Integración de sockets TCP asíncronos para lectura de bloques de datos (`DB`), áreas de marcas (`M`) e I/O directas.
- **Pruebas automatizadas**: Construcción de tramas de solicitud PDU y parsing de cabeceras COTP y CIP.
- **Pruebas de integración**: Comunicación con PLC Siemens S7-PLCSIM Advanced o emulador de CPU CIP.
- **Pruebas físicas/HIL**: Conexión física a CPU Siemens S7-1500 (1516-3 PN/DP) en banco de pruebas.
- **Evidencia requerida**: Registro de lecturas con marcas de tiempo exactas y trazas de conexión en puerto 102 y 44818.
- **Criterios de aceptación**: Tiempo de ciclo de lectura < 20 ms para 100 variables analógicas de proceso.
- **Criterios de NO aceptación**: Fallas de rack/slot no recuperadas o bloqueo de socket por caída del PLC.
- **Dependencias**: I22.
- **Riesgos**: Restricciones de seguridad en firmware de S7-1500 (acceso PUT/GET deshabilitado por defecto).
- **Rollback**: Habilitación de PUT/GET en configuración de hardware TIA Portal o uso de interfaz OPC UA.
- **Definition of Done**: Lectura y escritura físicas confirmadas contra CPUs Siemens y Rockwell reales.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de banco de pruebas de PLCs.

---

### I27 — Pipeline Industrial Data Quality Gate End-to-End
- **Objetivo**: Integrar el `DataQualityEngine` directamente en la tubería de adquisición del Daemon para que ningún dato crudo llegue al historiador o a la nube sin clasificación exhaustiva.
- **Problema actual**: El motor de calidad está implementado pero no está cableado como puerta de enlace obligatoria en el flujo continuo del daemon.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Archivos/componentes afectados**: `src/services/edge/dataQualityEngine.ts`, `src/services/edge/daemon.ts`, `src/services/edge/BioAzucarIndustrialEdge.ts`.
- **Cambios técnicos requeridos**: Inserción síncrona del paso de evaluación: `Raw Data -> Range Check -> Skew Check -> Frozen Check -> Rate-of-Change -> Provenance Tagging -> Trusted/Rejected`.
- **Cambios de arquitectura**: Descarte o marcado estricto (`BAD`, `UNCERTAIN`) antes de la persistencia local y la sincronización WAN.
- **Implementación**: Tubería de paso único con cero asignaciones de memoria innecesarias para mantener latencias en microsegundos.
- **Pruebas automatizadas**: 50 casos límite de datos anómalos (sensores en corto, flatline por 10 minutos, picos de aceleración no físicos).
- **Pruebas de integración**: Inyección de flujo de 5,000 tags/s con 5% de anomalías inducidas verificando su detección inmediata.
- **Pruebas físicas/HIL**: Desconexión de cable de señal de un transmisor 4-20 mA comprobando detección de circuito abierto.
- **Evidencia requerida**: Métricas de calidad emitidas en Prometheus (`data_quality_points_total{quality="BAD"}`).
- **Criterios de aceptación**: 100% de anomalías clasificadas en < 1 ms por punto; garantía matemática de que ningún tag simulado adquiera proveniencia física.
- **Criterios de NO aceptación**: Paso de datos corruptos al historiador como válidos (`GOOD`).
- **Dependencias**: I22, I23, I24.
- **Riesgos**: Sobrecarga de CPU si las expresiones de filtrado no están indexadas.
- **Rollback**: Simplificación a chequeo de rangos límites mientras se optimizan los chequeos de tasa de cambio.
- **Definition of Done**: Pipeline de calidad operando inline a velocidad de línea en el Edge Daemon.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de integración continua en daemon.

---

### I28 — Historiador Local On-Premise Duradero en Almacenamiento No Volátil
- **Objetivo**: Sustituir el `Map` en RAM de `LocalTimeSeriesDatabase` por un motor de series temporales embebido persistente en disco industrial (SSD/NVMe).
- **Problema actual**: El historiador pierde todo su contenido si el IPC se reinicia o se corta la alimentación.
- **Estado inicial real**: `MOCK` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/history/LocalTimeSeriesDatabase.ts`, `src/services/edge/history/SqliteTimeSeriesStore.ts`.
- **Cambios técnicos requeridos**: Implementar almacenamiento de series temporales basado en motor relacional embebido optimizado con WAL (`better-sqlite3` con tablas particionadas por fecha y compresión zstd de blobs de métricas).
- **Cambios de arquitectura**: Base de datos de series temporales local autónoma capaz de retener 90 días de operación sin requerir conexión a internet.
- **Implementación**: Creación de esquema relacional indexado por `(tag_id, timestamp)`, compresión por bloques de 1,000 muestras y API de consulta con soporte para agregaciones estadísticas (AVG, MIN, MAX, P95).
- **Pruebas automatizadas**: Pruebas de inserción masiva, consultas de rango temporal y verificación de retención con borrado automático.
- **Pruebas de integración**: Simulación de 7 días de datos históricos y verificación de velocidad de respuesta en consultas de tendencias.
- **Pruebas físicas/HIL**: Prueba de apagado abrupto del sistema operativo en el IPC verificando que la base de datos se recupere en el arranque sin corrupción.
- **Evidencia requerida**: Archivo de base de datos persistente en disco validado mediante `sqlite3_analyzer` e integridad WAL confirmada.
- **Criterios de aceptación**: Inserción continua de 2,000 puntos/s consumiendo < 15% de CPU, consultas de 24h respondidas en < 100 ms.
- **Criterios de NO aceptación**: Pérdida de muestras registradas tras reinicio; fragmentación de disco descontrolada.
- **Dependencias**: I22, I27.
- **Riesgos**: Desgaste excesivo de memoria flash por escrituras sin buffer.
- **Rollback**: Ajuste de `wal_autocheckpoint` a intervalos mayores (ej. cada 10,000 páginas).
- **Definition of Done**: Historiador en disco industrial funcionando con persistencia duradera y cero pérdidas post-reinicio.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de implementación de motor en disco.

---

### I29 — Store & Forward Transaccional con Motor WAL y RPO=0 Real
- **Objetivo**: Sustituir el volcado JSON en memoria de `DiskStoreAndForwardEngine` por un buffer transaccional en disco respaldado por WAL físico y recuperación determinística.
- **Problema actual**: `StoreAndForwardQueue` opera en RAM con volcado JSON periódico, vulnerable a pérdida de datos en caídas abruptas de energía.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/StoreAndForwardQueue.ts`, `src/services/edge/DiskStoreAndForwardEngine.ts`, `src/services/edge/persistence/TransactionalWalQueue.ts`.
- **Cambios técnicos requeridos**: Implementar cola persistente transaccional con escritura síncrona en archivo de bitácora rotativo (WAL con `fsync` por bloque), control de posición de lectura (*commit pointer*), deduplicación por clave criptográfica y cifrado en reposo AES-256-GCM por página.
- **Cambios de arquitectura**: Arquitectura transaccional estricta: ningún dato se confirma al driver hasta que esté asentado en almacenamiento no volátil.
- **Implementación**: Motor de cola de mensajes en disco de alto rendimiento con reintentos exponenciales y drenaje ordenado tras restablecimiento de enlace WAN.
- **Pruebas automatizadas**: Inserción de 100,000 puntos, corte simulado de proceso con `process.exit(1)`, reinicio y verificación de paridad exacta.
- **Pruebas de integración**: Desconexión de interfaz de red WAN durante 2 horas con tráfico continuo de 1,000 tags/s y posterior verificación de sincronización total sin duplicados.
- **Pruebas físicas/HIL**: Desconexión del suministro eléctrico del IPC industrial mediante relé de potencia durante escritura activa de datos.
- **Evidencia requerida**: Bitácora de recuperación post-reinicio demostrando reconstrucción del estado y cero registros omitidos (RPO=0 comprobado).
- **Criterios de aceptación**: Cero pérdida de datos (0 dropped points) en contingencias de red o energía; drenaje a la nube con backoff adaptativo.
- **Criterios de NO aceptación**: Pérdida o corrupción de lotes encolados; reordenamiento temporal en la entrega hacia la nube.
- **Dependencias**: I22, I27, I28.
- **Riesgos**: Llenado de disco en desconexiones WAN prolongadas.
- **Rollback**: Política de compactación progresiva con descarte selectivo de variables no críticas según matriz ISA-95.
- **Definition of Done**: Transaccionalidad física en disco probada bajo corte de energía forzado.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de prueba con corte de suministro eléctrico.

---

### I30 — Edge Runtime Production-Grade con Watchdog de Hardware y Sandboxing
- **Objetivo**: Proteger el proceso del Edge Daemon en el IPC mediante supervisor POSIX de bajo nivel, integración con el temporizador watchdog del hardware (`/dev/watchdog`) y aislamiento de privilegios.
- **Problema actual**: El supervisor existente opera a nivel de aplicación TypeScript y no previene cuelgues del runtime Node.js a nivel de kernel.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/supervisor/EdgeRuntimeSupervisor.ts`, `src/services/edge/daemon.ts`, `deploy/systemd/bioazucar-edge.service`.
- **Cambios técnicos requeridos**: Conexión periódica al dispositivo de hardware watchdog de Linux (enviando pulsos de refresco cada 5 segundos), reinicio forzado del IPC si el daemon se congela por más de 30 segundos, y sandboxing con directivas systemd (`ProtectSystem=strict`, `NoNewPrivileges=true`).
- **Cambios de arquitectura**: Resiliencia de grado industrial: falla de software contenida y reiniciada automáticamente por el kernel o hardware.
- **Implementación**: Módulo nativo o script de interacción con `/dev/watchdog`, configuración de límites de memoria (OOM killer tuning) y manejo de señales POSIX (`SIGTERM`, `SIGINT`, `SIGHUP`).
- **Pruebas automatizadas**: Simulación de bloqueo intencional del hilo de eventos y verificación de reinicio por supervisor.
- **Pruebas de integración**: Ejecución del servicio bajo systemd verificando aislamiento de directorios y límites de descriptores de archivo (65536).
- **Pruebas físicas/HIL**: Bloqueo de CPU al 100% en el IPC industrial físico y comprobación de reinicio por hardware watchdog a los 30 segundos.
- **Evidencia requerida**: Logs del kernel (`dmesg`) registrando el disparo y rearme del watchdog.
- **Criterios de aceptación**: Detección y reinicio de procesos colgados en < 10 segundos; recuperación de servicio en < 5 segundos post-reinicio.
- **Criterios de NO aceptación**: Proceso zombie bloqueando interfaces de red o agotamiento de descriptores de archivo.
- **Dependencias**: I22, I29.
- **Riesgos**: Reinicios en bucle si el fallo de arranque es irrecuperable.
- **Rollback**: Modo seguro de arranque con drivers deshabilitados si se detectan más de 3 fallos consecutivos en 5 minutos.
- **Definition of Done**: Demonio supervisado por systemd y hardware watchdog activo en IPC.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de prueba en hardware IPC.

---

### I31 — Secure Command Gateway Físico con Validación en PLC (Read-After-Write)
- **Objetivo**: Conectar el gateway de comandos a los drivers físicos garantizando la ejecución de escrituras con verificación de lectura confirmatoria en los registros del PLC.
- **Problema actual**: Las escrituras se confirman en el `memoryMap` del driver en memoria sin impactar físicamente los actuadores ni verificar el estado real de los contactos.
- **Estado inicial real**: `IMPLEMENTED` / `MOCK`.
- **Archivos/componentes afectados**: `src/services/edge/security/SecureCommandGateway.ts`, `src/services/edge/drivers/IIndustrialDriver.ts`, `src/services/edge/drivers/*DriverAdapter.ts`.
- **Cambios técnicos requeridos**: Implementar tubería de escritura con lectura de confirmación obligatoria (*read-after-write* en < 200 ms), validación contra enclavamientos (*interlocks*) de seguridad física y registro inmutable en bitácora de auditoría.
- **Cambios de arquitectura**: Ningún comando remoto altera salidas críticas (parada de molino, alivio de caldera) sin doble confirmación física y autorización criptográfica multi-rol (principio de cuatro ojos).
- **Implementación**: Enrutamiento de la orden de escritura hacia el driver nativo correspondiente (OPC UA Write o Modbus FC06/FC16), seguido de una lectura síncrona inmediata para comprobar que el valor registrado en el PLC coincide con el consignado.
- **Pruebas automatizadas**: Casos de prueba de rechazo por token expirado, discrepancia de valor escrito vs leído y denegación por enclavamiento activo.
- **Pruebas de integración**: Envío de comando hacia simulador de PLC verificando que un valor fuera de rango provoque aborto de la transacción.
- **Pruebas físicas/HIL**: Modificación remota de consigna de presión en banco de prueba PLC comprobando confirmación en display de salida analógica.
- **Evidencia requerida**: Registro forense de auditoría conteniendo firma digital del operador, motivo de operación, valor previo, valor escrito y valor verificado.
- **Criterios de aceptación**: Verificación read-after-write completada en < 300 ms; aborto inmediato y notificación de alarma si el valor del registro no coincide.
- **Criterios de NO aceptación**: Escritura ciega sin lectura confirmatoria; ejecución de comandos con credenciales monousuario sin segundo factor en variables críticas.
- **Dependencias**: I23, I24, I26, I30.
- **Riesgos**: Retardo en la respuesta del PLC provocando timeouts falsos.
- **Rollback**: Ventana de tolerancia configurable de hasta 500 ms para actuadores electromecánicos lentos.
- **Definition of Done**: Escritura segura en PLC físico con confirmación de lectura y pista de auditoría completa.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de pruebas contra PLC físico.

---

### I32 — Aislamiento de Red Físico Dual-NIC (eth0 OT / eth1 DMZ) y Reglas de Filtrado
- **Objetivo**: Implementar y verificar el aislamiento estricto entre la red de control industrial (OT) y la red de servicios (DMZ/IT) a nivel de interfaces de red físicas y tablas de enrutamiento del kernel.
- **Problema actual**: El aislamiento Dual-NIC se gestiona mediante cadenas de texto en software sin validación sobre hardware multi-interfaz real.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `deploy/network/dual-nic-setup.sh`, `deploy/network/nftables.conf`, `src/services/edge/network/DualNicManager.ts`.
- **Cambios técnicos requeridos**: Configurar scripts de inicialización de red asignando `eth0` a la subred de control privada (192.168.10.0/24 sin puerta de enlace predeterminada) y `eth1` a la subred DMZ de planta (10.0.0.0/24 con ruta saliente a internet/servidor central). Bloqueo total de forwarding en kernel.
- **Cambios de arquitectura**: El IPC actúa como terminador de protocolos de aplicación, jamás como enrutador de nivel 3 entre redes.
- **Implementación**: Reglas `nftables` / `iptables` con política por defecto `DROP`, permitiendo en `eth0` únicamente tráfico TCP 4840, 502, 102 y en `eth1` únicamente tráfico saliente TCP 443 hacia la dirección IP del servidor central.
- **Pruebas automatizadas**: Script de validación de sintaxis de reglas de firewall y comprobación de parámetros `sysctl`.
- **Pruebas de integración**: Prueba en máquina virtual con 2 interfaces de red verificando que paquetes enviados a `eth0` no puedan enrutarse hacia `eth1`.
- **Pruebas físicas/HIL**: Escaneo de puertos con `nmap` desde la red de oficina hacia la red de molinos pasando por el IPC, confirmando bloqueo del 100% de los paquetes.
- **Evidencia requerida**: Reporte de escaneo de vulnerabilidades de red y salida de comandos `ip route`, `iptables -L -n -v` y `sysctl net.ipv4.ip_forward`.
- **Criterios de aceptación**: Cero paquetes reenviados entre interfaces físicas; bloqueo instantáneo de cualquier protocolo no autorizado en ambas redes.
- **Criterios de NO aceptación**: Detección de `ip_forward = 1` o existencia de rutas cruzadas entre OT y DMZ.
- **Dependencias**: I21.
- **Riesgos**: Pérdida de acceso remoto al IPC si se aplican reglas de firewall incorrectas en `eth1`.
- **Rollback**: Mecanismo de recuperación en consola local (puerto serie ttyS0 / monitor físico) con reinicio de reglas tras 5 minutos sin confirmación.
- **Definition of Done**: Dual-NIC comprobado físicamente con escaneo de penetración de red demostrando aislamiento total.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de prueba con interfaces físicas de red.

---

### I33 — Hardening Integral del IPC y Generación de Imagen Golden Reproducible
- **Objetivo**: Automatizar la configuración y empaquetado del sistema operativo del IPC cumpliendo rigurosamente los controles del estándar CIS Linux Benchmark Nivel 2.
- **Problema actual**: El script `golden-image-provision.sh` es incompleto (no configura AppArmor, Chrony con NTS ni políticas udev para USB).
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `deploy/golden-image-provision.sh`, `deploy/security/apparmor-bioazucar`, `deploy/security/99-usb-block.rules`, `deploy/security/chrony.conf`.
- **Cambios técnicos requeridos**: Inclusión de perfil AppArmor en modo `enforce` para el binario de Node.js, deshabilitación de módulos de kernel para almacenamiento USB (`usb-storage`), configuración de sincronización horaria con servidores NTP/NTS locales de alta precisión y eliminación de compiladores y herramientas innecesarias en producción.
- **Cambios de arquitectura**: Sistema operativo inmutable de superficie de ataque mínima dedicado exclusivamente a la ejecución del Edge Daemon.
- **Implementación**: Script integral de auto-aprovisionamiento que genera un artefacto reproducible (ISO de instalación desatendida o imagen raw para clonación en SSD industrial).
- **Pruebas automatizadas**: Suite de validación de configuración que comprueba permisos de archivos, usuarios existentes y parámetros de seguridad.
- **Pruebas de integración**: Auditoría automatizada con herramienta de cumplimiento CIS (Lynis / OpenSCAP) con puntuación > 85.
- **Pruebas físicas/HIL**: Instalación de la imagen desde unidad booteable en IPC industrial real (Advantech / Siemens Microbox) en menos de 20 minutos.
- **Evidencia requerida**: Reporte de escaneo de Lynis/OpenSCAP certificando el cumplimiento de la línea base de seguridad industrial.
- **Criterios de aceptación**: Tiempo total de instalación < 30 minutos; cero puertos de escucha abiertos excepto los estrictamente necesarios; bloqueo automático de memorias USB no autorizadas.
- **Criterios de NO aceptación**: Presencia de sesiones SSH con autenticación por contraseña; ejecución de servicios con privilegios de superusuario (`root`).
- **Dependencias**: I13, I21, I32.
- **Riesgos**: Incompatibilidad de drivers con tarjetas de red específicas de hardware industrial antiguo.
- **Rollback**: Mantenimiento de imagen base probada en repositorio de artefactos seguro.
- **Definition of Done**: Imagen instalable y verificada mediante escaneo de seguridad CIS en IPC físico.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución en hardware físico.

---

### I34 — Infraestructura de Gestión de Claves, Identidad y Certificados (PKI Industrial)
- **Objetivo**: Implementar un esquema formal de gestión de certificados X.509 para clientes OPC UA, servidores Modbus Security y canales mTLS del Edge Daemon.
- **Problema actual**: Los certificados se generan mediante comandos manuales con fechas de expiración arbitrarias sin gestión de listas de revocación (CRL) ni rotación de claves.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/security/CertificateManager.ts`, `deploy/pki/ca-management.sh`.
- **Cambios técnicos requeridos**: Estructura de Autoridad Certificadora (Root CA y Sub-CA Industrial de Planta), emisión de certificados con Extensiones de Uso de Clave correctas (Server Authentication, Client Authentication), almacenamiento de claves privadas en almacenamiento seguro (TPM 2.0 o almacén cifrado con permisos 0600) y soporte para renovación automática.
- **Cambios de arquitectura**: Identidad criptográfica inmutable por cada IPC físico en la planta, impidiendo la suplantación de nodos de recolección.
- **Implementación**: Servicio en TypeScript para validación estricta de cadenas de confianza de certificados en conexiones OPC UA y sincronización WAN.
- **Pruebas automatizadas**: Verificación de rechazo de certificados caducados, autofirmados no reconocidos o con algoritmos de firma obsoletos (SHA-1).
- **Pruebas de integración**: Renovación de certificados y verificación de reconexión transparente del cliente OPC UA y broker MQTT sin pérdida de servicio.
- **Pruebas físicas/HIL**: Carga de certificados emitidos por la CA de la planta en el chip TPM del IPC industrial.
- **Evidencia requerida**: Cadena de certificados validada mediante `openssl verify` y logs de auditoría de conexiones seguras.
- **Criterios de aceptación**: Rechazo del 100% de certificados no confiables; soporte para llaves RSA >= 2048 bits o ECC secp256r1.
- **Criterios de NO aceptación**: Modos promiscuos que ignoren errores de certificado (`rejectUnauthorized: false`).
- **Dependencias**: I33.
- **Riesgos**: Bloqueo de comunicaciones de planta por expiración inadvertida de certificados de dispositivo.
- **Rollback**: Alertas tempranas en SCADA con 60 días de anticipación ante la proximidad del vencimiento de certificados.
- **Definition of Done**: Infraestructura PKI implementada con validación criptográfica estricta en todos los protocolos.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de despliegue de PKI de planta.

---

### I35 — Observabilidad Industrial, Métricas Prometheus y Alertas Operativas
- **Objetivo**: Instrumentar integralmente el Edge Daemon y los procesos de adquisición con métricas Prometheus nativas y monitoreo de salud en tiempo real.
- **Problema actual**: Existen métricas básicas en memoria pero no están integradas con un exportador robusto ni con dashboards de diagnóstico para los operadores de planta.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/monitoring/PrometheusMetrics.ts`, `src/services/edge/daemon.ts`, `deploy/monitoring/alerts.yml`.
- **Cambios técnicos requeridos**: Exposición de métricas estandarizadas en endpoint `/metrics`: tasa de adquisición por driver, latencia p50/p95/p99 de lectura, tamaño de la cola Store & Forward, puntos descartados por calidad deficiente, consumo de memoria del runtime, temperatura del IPC y estado de sincronización horaria.
- **Cambios de arquitectura**: Visibilidad total del estado de la infraestructura OT desde la consola central y desde sistemas de monitoreo de planta (Grafana / Prometheus).
- **Implementación**: Integración completa con `prom-client`, definición de alertas operacionales de umbral crítico (cola > 80% de capacidad, jitter > 50 ms, fallo de enlace PLC).
- **Pruebas automatizadas**: Pruebas unitarias que confirman el incremento de contadores y actualización de histogramas ante eventos de telemetría.
- **Pruebas de integración**: Raspado periódico de métricas mediante Prometheus local y verificación de cálculo de tasas (`rate()`).
- **Pruebas físicas/HIL**: Verificación de lectura de sensores de temperatura y carga de CPU del IPC bajo operación de molienda.
- **Evidencia requerida**: Salida cruda del endpoint HTTP `/metrics` y captura de dashboard de salud operativa.
- **Criterios de aceptación**: Sobrecarga de CPU del exportador < 1%; emisión inmediata de alertas ante desconexión de drivers o desbordamiento de colas.
- **Criterios de NO aceptación**: Bloqueo del proceso principal durante la recolección de métricas.
- **Dependencias**: I27, I29, I30.
- **Riesgos**: Saturación del puerto de salud por peticiones de monitoreo excesivas.
- **Rollback**: Limitación de tasa de sondeo (*rate limit*) en el endpoint de métricas.
- **Definition of Done**: Métricas completas expuestas y operando con alertas de proceso integradas.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de integración con servidor de métricas.

---

### I36 — Blindaje de Autorización Multi-Tenant y Seguridad en Servidor Central
- **Objetivo**: Auditar y fortalecer el backend central en Node.js/Express y las reglas de seguridad de Firestore para garantizar un aislamiento criptográfico y lógico total entre empresas e ingenios.
- **Problema actual**: Ciertas validaciones de tenencia se apoyan en datos enviados en el cuerpo de las peticiones por el cliente frontend.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Archivos/componentes afectados**: `server.ts`, `firestore.rules`, `src/services/authService.ts`.
- **Cambios técnicos requeridos**: Enforzamiento estricto de tenencia exclusivamente derivado de las afirmaciones del token firmado del usuario (`request.auth.token.tenantId`), prohibiendo cualquier sobreescritura desde el cuerpo HTTP; verificación de tokens JWT con validación de emisor y firma en cada endpoint `/api/edge/*`.
- **Cambios de arquitectura**: La seguridad de datos opera en el servidor bajo el principio de Zero-Trust, considerando al navegador y al frontend como zonas no confiables.
- **Implementación**: Middlewares de Express que interceptan todas las rutas API comprobando rol, permisos de acceso a celdas de proceso específicas y trazabilidad de tenant.
- **Pruebas automatizadas**: Pruebas de penetración automatizadas simulando intentos de inyección de tenant cruzado (usuario de Ingenio A intentando leer telemetría de Ingenio B).
- **Pruebas de integración**: Validación completa de reglas de seguridad de Firestore usando el emulador local oficial de Firebase.
- **Pruebas físicas/HIL**: Conexión de dos terminales de diferentes ingenios comprobando la estricta segregación de vistas y datos operativos.
- **Evidencia requerida**: Reporte de pruebas del emulador de reglas de Firestore demostrando denegación del 100% de accesos no autorizados.
- **Criterios de aceptación**: Aislamiento estricto verificado; denegación inmediata con código 403 y registro de auditoría de seguridad ante cualquier intento de evasión.
- **Criterios de NO aceptación**: Existencia de consultas donde un usuario pueda acceder a documentos sin filtro obligatorio por su `tenantId`.
- **Dependencias**: I12, I16.
- **Riesgos**: Bloqueo inadvertido a usuarios administradores globales legítimos.
- **Rollback**: Permiso explícito únicamente para el rol `superadmin` validado con verificación de dos factores.
- **Definition of Done**: Backend blindado con aislamiento multi-tenant demostrado formalmente en emulador y servidor.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de reporte formal de pruebas de seguridad multi-tenant.

---

### I37 — Gobernanza y Validación End-to-End de Datos Agronómicos (Módulo PDA)
- **Objetivo**: Extender la validación de esquemas y coherencia de datos agrícolas desde la captura en campo hasta la persistencia central, impidiendo inconsistencias de balance de masa en zafra.
- **Problema actual**: Parte de las validaciones de campos obligatorios, rangos de renovación de caña y fechas de campaña se apoyaban en componentes de formulario de React.
- **Estado inicial real**: `IMPLEMENTED` / `TESTED`.
- **Archivos/componentes afectados**: `src/services/agriculture/AgriculturalPersistenceService.ts`, `src/services/agriculture/AgronomicValidationService.ts`, `server.ts`.
- **Cambios técnicos requeridos**: Validación canónica de contratos de dominio en servidor antes de la escritura en base de datos: verificación de consistencia entre toneladas estimadas de caña, rendimiento estimado y azúcar proyectada (`targetMillingTons * yield = targetSugarTons`).
- **Cambios de arquitectura**: Consistencia transaccional de datos agrícolas que alimentan directamente el balance predictivo de fábrica.
- **Implementación**: Tubería de saneamiento que rechaza fechas solapadas de zafra, porcentajes de renovación agronómica fuera del rango 10-25% y variedades de caña no registradas en el catálogo botánico oficial.
- **Pruebas automatizadas**: Batería de 30 casos de prueba agronómicos con datos de prueba incoherentes comprobando su rechazo.
- **Pruebas de integración**: Flujo completo de creación de campaña agrícola desde la interfaz PDA hasta Firestore, validando la pista de auditoría.
- **Pruebas físicas/HIL**: Captura de datos en tableta PDA móvil en campo sin cobertura de red y sincronización posterior en taller de maquinaria.
- **Evidencia requerida**: Registros de auditoría con huellas SHA-256 de cada modificación de lote y campaña agrícola.
- **Criterios de aceptación**: Rechazo en servidor de cualquier registro con inconsistencias matemáticas en el balance estimado de zafra.
- **Criterios de NO aceptación**: Persistencia de campañas con valores nulos o rendimientos físicamente imposibles (> 18% o < 5%).
- **Dependencias**: I36.
- **Riesgos**: Rechazo de datos atípicos legítimos provocados por contingencias climáticas severas.
- **Rollback**: Procedimiento de excepción con autorización firmada por la Superintendencia de Campo.
- **Definition of Done**: Módulo PDA con validación estricta en servidor y sincronización offline-first robusta.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de validación con agrónomos de campo.

---

### I38 — Trazabilidad Criptográfica y Linaje de Datos de Extracción (Data Lineage)
- **Objetivo**: Incorporar a cada registro de telemetría y parámetro agronómico una cadena de procedencia inmutable que permita reconstruir el camino exacto desde el instrumento físico hasta el reporte gerencial.
- **Problema actual**: El linaje se describe conceptualmente pero no contiene encadenamiento criptográfico resistente a manipulación.
- **Estado inicial real**: `PARTIAL` / `IMPLEMENTED`.
- **Archivos/componentes afectados**: `src/services/edge/dataQualityEngine.ts`, `src/services/edge/history/LocalTimeSeriesDatabase.ts`, `src/types/index.ts`.
- **Cambios técnicos requeridos**: Inclusión de campos inmutables en cada `IndustrialDataPoint`: `sourceDeviceId`, `calibrationCertificateId`, `rawElectricalValue`, `conversionFormulaId` y firma HMAC de procedencia.
- **Cambios de arquitectura**: Auditoría forense completa requerida por estándares de inocuidad y certificación azucarera (Bonsucro / FSSC 22000).
- **Implementación**: Generación de hash SHA-256 del punto de medición y propagación a lo largo de las capas de agregación y cálculo analítico.
- **Pruebas automatizadas**: Verificación de detección inmediata de manipulación manual en cualquier etapa intermedia de la base de datos.
- **Pruebas de integración**: Consulta de auditoría de un indicador de eficiencia de extracción moliendo 24 horas continuas, reconstruyendo sus fuentes elementales.
- **Pruebas físicas/HIL**: Verificación de correspondencia entre el número de serie físico del sensor de presión y el registro de telemetría emitido.
- **Evidencia requerida**: Reporte de linaje de datos con árbol de dependencias criptográficas verificado.
- **Criterios de aceptación**: Capacidad de rastrear cualquier dato anómalo hasta el sensor físico de origen y el técnico de calibración responsable.
- **Criterios de NO aceptación**: Puntos de datos huérfanos sin identificación de dispositivo, protocolo o sello de tiempo de adquisición.
- **Dependencias**: I27, I28, I36.
- **Riesgos**: Incremento en el tamaño del payload de telemetría por almacenamiento de metadatos de linaje.
- **Rollback**: Compactación de linaje por lotes (*batch lineage hashes*) en lugar de firmas individuales por muestra.
- **Definition of Done**: Cadena de linaje implementada y verificable en todo el ciclo de vida de los datos de molienda.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de validación de árbol de linaje.

---

### I39 — Separación y Validación Rigurosa de Modelos BioAI (Física vs Heurística vs LLM)
- **Objetivo**: Reestructurar el módulo BioAI para separar estrictamente los modelos basados en leyes físicas fundamentales (Hugot, Spencer-Meade), las heurísticas de proceso y los modelos de lenguaje (LLM).
- **Problema actual**: Se entremezclan aproximaciones heurísticas con salidas de Gemini, catalogándolas genéricamente como predicciones analíticas.
- **Estado inicial real**: `SIMULATED` / `HEURISTIC`.
- **Archivos/componentes afectados**: `src/services/bioai/BioAiEngineService.ts`, `src/services/bioai/SugarMillModelCalibrator.ts`, `src/components/bioai/OperationalPredictionsView.tsx`.
- **Cambios técnicos requeridos**: Etiquetado transparente de cada salida de IA: `PHYSICAL_CALCULATION` (modelo determinista sin incertidumbre estocástica), `STATISTICAL_HEURISTIC` (aproximación empírica con intervalo de confianza documentado) o `LLM_ASSISTED_INSIGHT` (análisis cualitativo sin responsabilidad en lazo de control).
- **Cambios de arquitectura**: Aislamiento estricto: ningún modelo de lenguaje puede sugerir o ejecutar modificaciones directas en setpoints de proceso sin validación contra los límites de seguridad física del modelo mecánico de molienda.
- **Implementación**: Refactorización de `BioAiEngineService` para eliminar cálculos pseudoaleatorios y estructurar las ecuaciones termodinámicas y mecánicas con parámetros calibrables según geometría real de los molinos.
- **Pruebas automatizadas**: Validación numérica de las ecuaciones de balance de extracción contra tablas estándar de la literatura azucarera internacional.
- **Pruebas de integración**: Ejecución del servicio BioAI con telemetría de prueba estática verificando que las recomendaciones operativas se mantengan dentro de la envolvente de seguridad.
- **Pruebas físicas/HIL**: Contraste de las estimaciones del modelo de extracción contra los resultados del laboratorio químico de planta (análisis de sacarosa en bagazo por digestión húmeda).
- **Evidencia requerida**: Matriz de trazabilidad de modelos matemáticos referenciando fórmulas, límites de validez y nivel de certidumbre.
- **Criterios de aceptación**: Cero confusiones en la interfaz entre predicciones físicas calibradas y resúmenes de texto generados por LLM; advertencias explícitas de límites operacionales.
- **Criterios de NO aceptación**: Presentación de salidas generativas de LLM como valores medidos o predicciones matemáticas garantizadas.
- **Dependencias**: I14, I22, I27.
- **Riesgos**: Resistencia de usuarios acostumbrados a cifras predictivas exactas generadas sintéticamente.
- **Rollback**: Presentación de rangos probables (ej. 240–260 TCH) en lugar de valores puntuales cuando la calibración no sea óptima.
- **Definition of Done**: Modelos BioAI refactorizados, clasificados por naturaleza y validados contra balances de masa teóricos.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de validación con datos químicos de planta.

---

### I40 — Calibración Empírica y Validación de Analítica Predictiva con Datos de Zafra
- **Objetivo**: Calibrar los coeficientes del modelo de molienda de caña y combustión de bagazo utilizando datasets reales recolectados durante campañas azucareras anteriores.
- **Problema actual**: Las constantes del modelo (`nominalTch`, índices de consumo de vapor, fibra en caña) son valores estáticos preconfigurados en código.
- **Estado inicial real**: `SIMULATED` / `MOCK`.
- **Archivos/componentes afectados**: `src/services/bioai/SugarMillModelCalibrator.ts`, `src/data/mockIndustrialData.ts`.
- **Cambios técnicos requeridos**: Desarrollar algoritmo de calibración por mínimos cuadrados o regresión robusta que ajuste los parámetros del modelo en función de la variedad de caña, madurez y desgaste de las mazas de molino.
- **Cambios de arquitectura**: Calibración offline periódica que actualiza las tablas de referencia del motor analítico sin interrumpir la operación en tiempo real.
- **Implementación**: Módulo de ajuste de parámetros capaz de ingerir datos históricos de zafra en formato CSV o Parquet y calcular los coeficientes de extracción y consumo de vapor específicos del ingenio.
- **Pruebas automatizadas**: Validación cruzada (*k-fold cross-validation*) sobre dataset histórico midiendo error cuadrático medio (RMSE) y error porcentual absoluto medio (MAPE).
- **Pruebas de integración**: Carga de parámetros calibrados en el motor analítico y verificación de estabilidad de las predicciones a 1h, 8h y 24h.
- **Pruebas físicas/HIL**: Comparación de las predicciones del modelo calibrado contra los datos reales registrados por los instrumentos en un turno completo de 8 horas.
- **Evidencia requerida**: Reporte de calibración estadística demostrando MAPE < 4.5% en la predicción de molienda horaria y vapor generado.
- **Criterios de aceptación**: Precisión predictiva demostrada estadísticamente sobre datos reales de operación; cálculo de intervalos de confianza al 95%.
- **Criterios de NO aceptación**: Uso de parámetros empíricos genéricos sin ajuste a la geometría y condiciones de la planta piloto.
- **Dependencias**: I28, I39.
- **Riesgos**: Datos históricos con mala calidad de medición que sesguen los parámetros del modelo.
- **Rollback**: Filtrado previo de los datos históricos a través del `DataQualityEngine` antes de la calibración.
- **Definition of Done**: Modelo calibrado con datos empíricos y precisión documentada estadísticamente.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de acceso a dataset histórico del ingenio piloto.

---

### I41 — Envolvente de Seguridad Operacional y Límites para Optimización Prescriptiva
- **Objetivo**: Establecer barreras duras e inviolables en el software (*Safety Boundaries*) que impidan que cualquier recomendación u optimización del sistema viole los límites mecánicos y termodinámicos de la maquinaria.
- **Problema actual**: Las recomendaciones de optimización se generan sin verificar enclavamientos físicos de sobrepresión, sobrecarga de motores o cavitación de bombas.
- **Estado inicial real**: `PARTIAL` / `DESIGNED`.
- **Archivos/componentes afectados**: `src/services/bioai/BioAiEngineService.ts`, `src/services/edge/security/SecureCommandGateway.ts`.
- **Cambios técnicos requeridos**: Definición de matriz inmutable de límites de seguridad: presión máxima de caldera (ej. 46 bar), temperatura máxima de vapor sobrecalentado (450 °C), amperaje máximo de motores de molinos y nivel mínimo en domo de caldera.
- **Cambios de arquitectura**: Capa de interlocks lógicos que intercepta cualquier sugerencia o comando antes de su presentación al operador o envío a la planta.
- **Implementación**: Validador de límites que rechaza automáticamente cualquier consigna que acerque las variables a menos de un 10% del umbral de disparo de los sistemas de protección física (válvulas de seguridad, relés térmicos).
- **Pruebas automatizadas**: 100 pruebas de inyección de consignas anómalas confirmando su bloqueo determinístico e inmediato.
- **Pruebas de integración**: Verificación de activación de alarmas de violación de envolvente de seguridad en la consola SCADA.
- **Pruebas físicas/HIL**: Intento de modificación forzada de setpoint hacia zona de riesgo en PLC de banco comprobando su rechazo por el gateway.
- **Evidencia requerida**: Matriz de límites de seguridad firmada por el Jefe de Mantenimiento y Automatización del ingenio.
- **Criterios de aceptación**: Bloqueo absoluto de cualquier consigna que exceda los límites operativos seguros; justificación técnica clara en el mensaje de rechazo.
- **Criterios de NO aceptación**: Existencia de modos de bypass no autorizados que permitan eludir la envolvente de seguridad operacional.
- **Dependencias**: I31, I39.
- **Riesgos**: Restricción excesiva que limite la flexibilidad de los operadores ante contingencias.
- **Rollback**: Modo de anulación manual de emergencia que requiere presencia física y llave de seguridad en el panel de control local.
- **Definition of Done**: Envolvente de seguridad implementada y verificada contra todas las recomendaciones prescriptivas.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de homologación de límites de planta.

---

### I42 — Calificación de Rendimiento de Carga y Estrés Reproducible (Performance Qualification)
- **Objetivo**: Ejecutar y certificar pruebas de rendimiento reproducible bajo cargas extremas utilizando un generador de tráfico real sobre la red física del IPC.
- **Problema actual**: El rendimiento de 5,000 tags/s con p99 de 11.4 ms era un resultado calculado sintéticamente en el código de prueba de la Ola 5.
- **Estado inicial real**: `SIMULATED` / `TARGET`.
- **Archivos/componentes afectados**: `deploy/testing/traffic-generator.ts`, `src/services/edge/daemon.ts`, `deploy/testing/perf-benchmark.sh`.
- **Cambios técnicos requeridos**: Desarrollar un emulador de red industrial capaz de emitir ráfagas de 1,000, 5,000 y 10,000 tags/s reales por socket TCP/UDP, y medir mediante instrumental de sistema operativo (`perf`, `htop`, temporizadores de microsegundos) el comportamiento del Edge Daemon.
- **Cambios de arquitectura**: Calificación técnica basada en mediciones empíricas de kernel y hardware, descartando métricas autodeclaradas.
- **Implementación**: Script de benchmark que ejecuta pruebas de carga sostenida durante 4 horas continuas (*soak testing*) registrando latencias, uso de RAM, ciclos de recolección de basura y consumo de I/O de disco.
- **Pruebas automatizadas**: Test de rendimiento que falla si la latencia percentil p99 supera los 25 ms bajo 5,000 tags/s.
- **Pruebas de integración**: Prueba de estrés combinando adquisición simultánea por OPC UA, Modbus TCP y Sparkplug B en red local gigabit.
- **Pruebas físicas/HIL**: Ejecución del benchmark de 4 horas directamente en el IPC industrial físico monitorizando temperaturas internas del chasis.
- **Evidencia requerida**: Gráficas de distribución de latencia generadas a partir de trazas crudas y reporte de uso de recursos del sistema (`sar` / `sysstat`).
- **Criterios de aceptación**: p99 < 25 ms a 5,000 tags/s sostenidos; uso de memoria RAM estable sin fugas (< 512 MB); cero paquetes descartados por saturación de buffers.
- **Criterios de NO aceptación**: Degradación progresiva de rendimiento; congelamiento del hilo de eventos de Node.js por más de 50 ms.
- **Dependencias**: I23, I24, I25, I27, I28, I29, I30.
- **Riesgos**: Cuellos de botella en la serialización JSON o en la escritura en disco SSD.
- **Rollback**: Optimización de buffers circulares y activación de compresión zstd en bloques mayores.
- **Definition of Done**: Prueba de estrés de 4 horas completada con evidencia física reproducible y métricas auditadas.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución en banco de pruebas con generador de tráfico.

---

### I43 — Verificación Formal de Ciberseguridad (SAST, DAST y Pruebas de Penetración)
- **Objetivo**: Someter la plataforma completa a un ciclo riguroso de escaneo de vulnerabilidades estático, dinámico y pruebas de penetración contra la interfaz web y los servicios de red del IPC.
- **Problema actual**: El reporte de vulnerabilidades existente se deriva de estructuras estáticas sin análisis de dependencias binarias en profundidad.
- **Estado inicial real**: `DESIGNED` / `MOCK`.
- **Archivos/componentes afectados**: Todo el repositorio, dependencias de `package.json`, binarios en `deploy/`.
- **Cambios técnicos requeridos**: Ejecutar análisis SAST exhaustivo con herramientas reconocidas (SonarQube, Snyk, Semgrep), análisis de composición de software (SCA) sobre dependencias npm eliminando componentes vulnerables, y escaneo dinámico DAST (OWASP ZAP) contra las APIs de backend y la consola web.
- **Cambios de arquitectura**: Remediación de cualquier vector que permita inyecciones de comandos, falsificación de peticiones (CSRF), ataques de temporización o enumeración de recursos multi-tenant.
- **Implementación**: Automatización de chequeos de seguridad en pipeline local y remediación de dependencias con vulnerabilidades conocidas (CVEs).
- **Pruebas automatizadas**: Escaneo continuo de código que bloquee la compilación ante cualquier hallazgo con severidad crítica o alta.
- **Pruebas de integración**: Pruebas de inyección SQL/NoSQL en los endpoints de búsqueda y autenticación.
- **Pruebas físicas/HIL**: Evaluación de penetración en red interna (VLAN de control) intentando comprometer el IPC a través de sus puertos abiertos.
- **Evidencia requerida**: Reporte de escaneo emitido por herramientas SAST/DAST acreditadas certificando 0 vulnerabilidades críticas y 0 vulnerabilidades de severidad alta.
- **Criterios de aceptación**: Cero hallazgos críticos/altos abiertos; generación de SBOM CycloneDX validado contra la base de datos nacional de vulnerabilidades (NVD).
- **Criterios de NO aceptación**: Existencia de secretos en texto plano en código, paquetes obsoletos sin soporte o credenciales por defecto.
- **Dependencias**: I32, I33, I34, I36.
- **Riesgos**: Necesidad de actualizar librerías principales con cambios incompatibles (*breaking changes*).
- **Rollback**: Aplicación de parches de seguridad manuales (*vendoring/patching*) si la actualización directa rompe compatibilidad.
- **Definition of Done**: Auditoría de seguridad SAST/DAST superada con reporte limpio y SBOM verificado.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de escaneo formal con herramientas de seguridad.

---

### I44 — Calificación de Resiliencia y Chaos Testing en Hardware (Falla Física Inducida)
- **Objetivo**: Validar la tolerancia a fallos del Edge Daemon provocando anomalías físicas reales en el entorno de laboratorio (corte de cables, perturbación de red, saturación de almacenamiento).
- **Problema actual**: El motor de caos operaba mediante variables lógicas en memoria simulando las fallas mediante llamadas a métodos.
- **Estado inicial real**: `SIMULATED` / `TESTED`.
- **Archivos/componentes afectados**: `src/services/edge/verification/ChaosTestingEngine.ts`, hardware de laboratorio, interfaces de red.
- **Cambios técnicos requeridos**: Automatizar la inducción de fallas a nivel de sistema operativo y hardware: desconexión de interfaces de red con `ip link set eth0 down`, inyección de pérdida y latencia de paquetes con `tc netem`, llenado forzado de partición de disco con `dd` y terminación abrupta del proceso con `kill -9`.
- **Cambios de arquitectura**: Demostración empírica de degradación suave: la plataforma mantiene la adquisición local y el almacenamiento seguro aun cuando los servicios superiores colapsen.
- **Implementación**: Suite de caos automatizada que ejecuta la secuencia de fallas midiendo los tiempos reales de detección, contención y recuperación automática.
- **Pruebas automatizadas**: Test de monitoreo que verifica que ante la caída de un socket se active la alarma correspondiente en < 500 ms.
- **Pruebas de integración**: Ejecución de las 5 contingencias canónicas de forma secuencial durante un periodo continuo de 2 horas.
- **Pruebas físicas/HIL**: Desconexión manual violenta del cable de red de los PLCs durante una maniobra crítica de molienda en banco de pruebas.
- **Evidencia requerida**: Trazas de logs y capturas de pantalla de la consola HMI mostrando la activación inmediata de alarmas y el failover transparente a Store & Forward.
- **Criterios de aceptación**: Recuperación automática sin intervención humana en < 3 segundos tras el restablecimiento del enlace físico; cero corrupción de bases de datos.
- **Criterios de NO aceptación**: Cuelgues no recuperados (*unhandled panics*), corrupción de archivos en disco o pérdida de telemetría previa a la falla.
- **Dependencias**: I27, I28, I29, I30, I35.
- **Riesgos**: Daño en el sistema de archivos del IPC por pruebas destructivas de disco.
- **Rollback**: Restauración automática desde la partición de respaldo de la Imagen Golden.
- **Definition of Done**: Protocolo de caos físico superado con 100% de resiliencia y recuperación autónoma demostrada.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución en banco de pruebas con inyección física.

---

### I45 — Protocolo FAT (Factory Acceptance Test) Formal y Reproducible en Banco
- **Objetivo**: Diseñar y ejecutar el protocolo de Aceptación en Fábrica formal en banco de pruebas de laboratorio, con presencia y firma presencial o remota del cliente técnico.
- **Problema actual**: El protocolo FAT existente contenía resultados y métricas simuladas por software en código.
- **Estado inicial real**: `MOCK` / `PLANNED`.
- **Archivos/componentes afectados**: `deploy/fat/FAT-PROTOCOL-BIOAZUCAR-4.0.pdf`, `src/services/edge/verification/FatAcceptanceService.ts`.
- **Cambios técnicos requeridos**: Redactar el documento técnico formal de procedimiento FAT paso a paso: inspección visual de hardware, verificación de cableado Dual-NIC, prueba de energización, verificación de versión de software (Commit SHA y Configuration Hash inmutables), adquisición continua con generador de carga y prueba de corte de energía con osciloscopio o relé temporizado.
- **Cambios de arquitectura**: El software pasa de ser un desarrollo de laboratorio a un sistema industrial homologado para entrega en sitio.
- **Implementación**: Ejecución rigurosa de los 25 puntos de inspección del protocolo FAT registrando los valores reales medidos por instrumental calibrado.
- **Pruebas automatizadas**: Verificación de integridad de todos los binarios mediante sumas de comprobación SHA-256 antes de iniciar la prueba.
- **Pruebas de integración**: Comunicación continua durante 8 horas entre el IPC y los simuladores de controladores industriales.
- **Pruebas físicas/HIL**: Ejecución del corte intempestivo de energía eléctrica desconectando la fuente de alimentación del IPC y validando el encendido autónomo y la integridad del historiador.
- **Evidencia requerida**: Acta FAT firmada de puño y letra o con certificado digital cualificado por el Lead Industrial Architect y los inspectores técnicos.
- **Criterios de aceptación**: Aprobación unánime del 100% de las pruebas críticas de adquisición, seguridad y resiliencia; lista de pendientes (*punchlist*) de categoría A vacía.
- **Criterios de NO aceptación**: Cualquier falla en la retención de datos durante el corte de energía o discrepancias en la calibración de variables de proceso.
- **Dependencias**: I23, I24, I25, I29, I30, I32, I33, I42, I44.
- **Riesgos**: Detección de fallos de hardware en el IPC que obliguen a reemplazar componentes.
- **Rollback**: Corrección inmediata de observaciones menores de categoría B en banco antes del embalaje y envío a planta.
- **Definition of Done**: Acta FAT formal ejecutada en laboratorio con hardware real, firmada y archivada con sus artefactos de prueba.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución del protocolo de laboratorio.

---

### I46 — Integración Hardware-in-the-Loop (HIL) con PLCs de Laboratorio
- **Objetivo**: Montar un banco de pruebas Hardware-in-the-Loop (HIL) con controladores físicos programables (Siemens S7-1500 y Allen-Bradley CompactLogix) ejecutando lógica real de enclavamientos azucareros.
- **Problema actual**: No existía una etapa de validación intermedia entre las pruebas unitarias y la conexión a la planta física real.
- **Estado inicial real**: `PLANNED`.
- **Archivos/componentes afectados**: Banco de pruebas de hardware, programas de PLC en TIA Portal y Studio 5000, drivers nativos del Edge Daemon.
- **Cambios técnicos requeridos**: Programar bloques de función en los PLCs de laboratorio que emulen la respuesta dinámica de los 6 molinos del tándem (revoluciones, presión hidráulica de mazas superiores, temperatura de chumaceras) y de la caldera de biomasa (tiro inducido, presión de domo).
- **Cambios de arquitectura**: Validación de lazo cerrado en laboratorio: el Edge Daemon lee entradas del PLC, procesa datos y emite comandos de control que el PLC ejecuta y retroalimenta.
- **Implementación**: Conexión física mediante cableado de red industrial entre el IPC y los racks de PLCs de laboratorio.
- **Pruebas automatizadas**: Pruebas continuas de adquisición y respuesta a perturbaciones de consigna durante 24 horas continuas.
- **Pruebas de integración**: Verificación de intercambio de datos bidireccional sin errores de comunicación en más de 1,000,000 de ciclos.
- **Pruebas físicas/HIL**: Simulación de disparo de parada de emergencia en el PLC comprobando que el Edge Daemon registre la secuencia de eventos (SOE) con resolución de milisegundos.
- **Evidencia requerida**: Código fuente exportado de los proyectos de PLC y capturas de oscilograma de respuesta del lazo de control.
- **Criterios de aceptación**: Sincronización temporal perfecta entre los eventos del PLC y las marcas de tiempo registradas en BioAzúcar; respuesta determinística del lazo de control.
- **Criterios de NO aceptación**: Desfase temporal > 10 ms entre eventos físicos del PLC y las marcas de tiempo registradas por el daemon.
- **Dependencias**: I23, I24, I26, I31, I45.
- **Riesgos**: Daño accidental en módulos de I/O de los PLCs durante pruebas de sobretensión.
- **Rollback**: Uso de fusibles rápidos y aisladores galvánicos en todas las líneas de señal del banco HIL.
- **Definition of Done**: Banco HIL montado, comunicando bidireccionalmente y validado en lazo cerrado durante 24 horas.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de montaje físico de banco HIL.

---

### I47 — Integración en Planta Piloto en Modo Escucha (Read-Only Shadow Mode)
- **Objetivo**: Conectar el IPC físico a la red OT del tándem de molinos y caldera del ingenio azucarero operando estrictamente en modo pasivo de solo lectura (*Shadow Mode*), sin capacidad de escritura.
- **Problema actual**: Los datos de planta nunca han sido leídos desde un entorno operativo real en zafra.
- **Estado inicial real**: `PLANNED`.
- **Archivos/componentes afectados**: `src/services/edge/daemon.ts`, configuración física de interfaces de red del ingenio, switch industrial gestionado.
- **Cambios técnicos requeridos**: Conectar físicamente el puerto `eth0` del IPC al switch industrial de la sala de control de molienda; configurar espejado de puertos (*port mirroring*) o conexión directa en modo solo lectura (`readOnly: true` garantizado a nivel de driver y hardware); conexión de `eth1` a la red DMZ del ingenio.
- **Cambios de arquitectura**: Captura de condiciones reales de planta (ruido eléctrico, variaciones térmicas, caídas de tensión) sin riesgo alguno para la producción azucarera.
- **Implementación**: Despliegue in situ del IPC en gabinete eléctrico con riel DIN, puesta a tierra industrial y alimentación redundante de 24 VDC respaldada por UPS.
- **Pruebas automatizadas**: Verificación automática de bloqueo de cualquier intento de transmisión o escritura en la red de control.
- **Pruebas de integración**: Adquisición ininterrumpida de las variables reales del tándem (TCH, nivel de tolva, brix, presión hidráulica) durante 7 días continuos de molienda.
- **Pruebas físicas/HIL**: Verificación de temperatura y vibración en el chasis del IPC bajo condiciones ambientales de sala de molinos (alta humedad, polvo de bagazo).
- **Evidencia requerida**: Registros de telemetría de 7 días continuos comparados contra las pantallas de la consola SCADA existente en el ingenio.
- **Criterios de aceptación**: Discrepancia < 0.1% entre los valores capturados por BioAzúcar y los instrumentos del ingenio; cero impacto o perturbación en la red de control existente.
- **Criterios de NO aceptación**: Cualquier paquete de escritura emitido hacia los PLCs de planta; degradación del ancho de banda de la red de molienda.
- **Dependencias**: I31, I32, I33, I45, I46.
- **Riesgos**: Interferencias electromagnéticas severas por arranque de grandes variadores de frecuencia de molinos (1000+ HP).
- **Rollback**: Desconexión física inmediata del conector Ethernet en el switch si se detecta cualquier anomalía en el bus OT.
- **Definition of Done**: 7 días de operación en sombra (*shadow mode*) completados sin interrupciones con datos reales de molienda.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de instalación física en ingenio azucarero.

---

### I48 — Protocolo SAT (Site Acceptance Test) Formal en Sitio Azucarero
- **Objetivo**: Ejecutar la Aceptación Técnica en Sitio con la planta azucarera en operación real, validando la precisión de todas las variables frente a transmisores e instrumentos patrones contrastados.
- **Problema actual**: El acta SAT en el código era una estructura preconcebida sin firmas ni contrastes reales de campo.
- **Estado inicial real**: `MOCK` / `PLANNED`.
- **Archivos/componentes afectados**: `deploy/sat/SAT-ACTA-FORMAL.pdf`, `src/services/edge/verification/SatCommissioningService.ts`.
- **Cambios técnicos requeridos**: Protocolo formal de calibración y verificación conjunta: contraste de pesaje en báscula de caña con patrones certificados, contraste de presión de vapor vivo con manómetro patrón clase 0.1, verificación de analizador de brix por refractometría óptica de laboratorio y firma formal presencial con las autoridades técnicas del ingenio.
- **Cambios de arquitectura**: Homologación definitiva del sistema como plataforma de grado industrial autorizada para operar en el ingenio.
- **Implementación**: Recorrido de los puntos de medición en patio de caña, tándem de molienda, calderas de vapor y sala de turbogeneradores, cotejando cada valor en pantalla frente al instrumento físico de campo.
- **Pruebas automatizadas**: Verificación automática de integridad de firmas digitales y estampas de tiempo de cada ensayo.
- **Pruebas de integración**: Validación de la visualización en tiempo real en la sala de control con latencia inferior a 1 segundo desde el sensor.
- **Pruebas físicas/HIL**: Verificación en campo durante un cambio de turno de molienda con variaciones abruptas de alimentación de caña.
- **Evidencia requerida**: Acta formal de aceptación SAT física firmada de puño y letra por el Director de Planta, Superintendente de Mantenimiento, Jefe de Instrumentación y el Lead Industrial Architect.
- **Criterios de aceptación**: Cumplimiento del 100% de las tolerancias técnicas de diseño; cero observaciones críticas pendientes; acta suscrita formalmente por todas las partes.
- **Criterios de NO aceptación**: Errores sistemáticos en variables primarias de proceso (presión, flujo, TCH) fuera de las tolerancias de instrumentación.
- **Dependencias**: I47.
- **Riesgos**: Parada imprevista de molienda por causas agrícolas o mecánicas ajenas al sistema informático durante el día de pruebas.
- **Rollback**: Reprogramación de los puntos de prueba afectados durante la siguiente ventana de zafra continua.
- **Definition of Done**: Acta SAT firmada formalmente en sitio con todas las partes técnicas presentes y evidencias adjuntas.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de firma formal en el ingenio piloto.

---

### I49 — Puesta en Marcha Técnica Industrial (Commissioning en Zafra)
- **Objetivo**: Poner en servicio el sistema BioAzúcar 4.0 en operación productiva regular durante una zafra azucarera completa, habilitando el soporte operativo continuo para operadores y supervisores.
- **Problema actual**: El sistema no ha operado nunca como soporte primario de monitoreo y gestión en turnos industriales reales.
- **Estado inicial real**: `PLANNED`.
- **Archivos/componentes afectados**: Todo el sistema, infraestructura de producción, manuales de procedimiento operativo.
- **Cambios técnicos requeridos**: Puesta en línea definitiva de las terminales HMI en sala de control de molinos y calderas; activación de alertas de proceso a dispositivos móviles de supervisores de planta; monitoreo continuo de los lazos de sincronización y salud de los IPCs.
- **Cambios de arquitectura**: Transición de fase de proyecto a fase de producción viva industrial.
- **Implementación**: Soporte técnico presencial en planta 24/7 durante las primeras dos semanas de arranque de zafra (guardias rotativas de 3 turnos).
- **Pruebas automatizadas**: Verificación continua de salud del daemon con generación automática de reportes de disponibilidad diarios.
- **Pruebas de integración**: Intercambio de datos bidireccional con el sistema ERP corporativo (liquidación de caña y despacho de azúcar/energía).
- **Pruebas físicas/HIL**: Operación ininterrumpida durante una molienda continua de más de 50,000 toneladas de caña.
- **Evidencia requerida**: Reporte de disponibilidad técnica operativa certificando > 99.9% de tiempo de actividad durante el periodo de prueba de arranque.
- **Criterios de aceptación**: Operación continua sin fallos críticos durante 30 días de zafra ininterrumpida; aceptación formal por parte del personal de operaciones de planta.
- **Criterios de NO aceptación**: Caídas del sistema que dejen a los operadores a oscuras respecto al estado de la molienda o caldera.
- **Dependencias**: I48.
- **Riesgos**: Fallas en la red eléctrica de planta por fluctuaciones severas durante arranques de motores pesados.
- **Rollback**: Respaldo automático mediante sistemas de instrumentación locales y SCADA de respaldo preexistente.
- **Definition of Done**: 30 días de operación continua en zafra cumplidos con disponibilidad > 99.9% demostrada.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de inicio de zafra azucarera.

---

### I50 — Revisión Formal de Aptitud para Producción (Production Readiness Review - PRR)
- **Objetivo**: Conducir una auditoría formal multidisciplinaria para autorizar el paso definitivo de BioAzúcar 4.0 a estado plenamente comercial y transferible a múltiples ingenios.
- **Problema actual**: Falta un marco de gobernanza formal que impida declarar un sistema listo para producción sin haber cumplido todos los hitos previos.
- **Estado inicial real**: `PLANNED`.
- **Archivos/componentes afectados**: Expediente técnico completo, auditorías de seguridad, actas FAT/SAT, manuales de usuario y código fuente.
- **Cambios técnicos requeridos**: Evaluación rigurosa de los 10 pilares de producción: Conectividad física real probada, RPO=0 demostrado en hardware, aislamiento Dual-NIC certificado, cero dependencias simuladas en rutas críticas, cumplimiento IEC 62443 SL3 auditado, precisión predictiva validada con datos empíricos, observabilidad completa y manuales operativos aprobados.
- **Cambios de arquitectura**: Certificación del producto como solución comercial de grado industrial.
- **Implementación**: Sesión formal del Comité Técnico de Dirección revisando la evidencia documental y de campo de cada una de las iteraciones I0 a I49.
- **Pruebas automatizadas**: Verificación de que el 100% de las suites de prueba de regresión se encuentren en estado aprobado.
- **Pruebas de integración**: Verificación de procesos de despliegue automatizado y recuperación ante desastres (Disaster Recovery).
- **Pruebas físicas/HIL**: Inspección ocular de las instalaciones en planta y del estado de los gabinetes del IPC.
- **Evidencia requerida**: Dictamen formal unánime de Production Readiness Review firmado por todos los miembros del comité técnico.
- **Criterios de aceptación**: Cumplimiento del 100% de los criterios definidos en la matriz maestra sin excepciones de severidad P0 o P1 abiertas.
- **Criterios de NO aceptación**: Existencia de cualquier brecha de seguridad no mitigada o falta de actas formales de campo.
- **Dependencias**: I0 a I49.
- **Riesgos**: Descubrimiento de discrepancias técnicas de última hora que retrasen la aprobación comercial.
- **Rollback**: Plan de acción de contingencia con plazo perentorio de 15 días para solventar observaciones menores.
- **Definition of Done**: Acta PRR aprobada y firmada, declarando formalmente el producto como `PRODUCTION_READY`.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de realización de la sesión de revisión PRR.

---

### I51 — Transferencia Operativa, Capacitación y Manuales de Procedimiento Industrial
- **Objetivo**: Elaborar y transferir a los operadores, agrónomos, instrumentistas y gerentes del ingenio la documentación técnica completa, manuales de contingencia y programas de capacitación práctica.
- **Problema actual**: La documentación existente está orientada a desarrolladores de software y no a operadores de campo de una central azucarera.
- **Estado inicial real**: `PLANNED`.
- **Archivos/componentes afectados**: `docs/manuals/OPERATOR-SCADA-MANUAL.pdf`, `docs/manuals/INSTRUMENTATION-MAINTENANCE.pdf`, `docs/manuals/CYBERSECURITY-INCIDENT-RESPONSE.pdf`.
- **Cambios técnicos requeridos**: Redacción de Procedimientos Operativos Estándar (SOP): Procedimiento ante alarma de molienda, Procedimiento ante falla de enlace de comunicaciones (Store & Forward activo), Procedimiento de reemplazo en caliente de IPC industrial y Manual de administración de roles y usuarios.
- **Cambios de arquitectura**: Empoderamiento del personal local del ingenio para operar y mantener la plataforma de forma autónoma.
- **Implementación**: Talleres presenciales de capacitación con evaluación práctica en sala de control y entrega de manuales impresos laminados y en formato digital.
- **Pruebas automatizadas**: Verificación de consistencia técnica y vigencia de todos los enlaces y capturas de pantalla de los manuales.
- **Pruebas de integración**: Simulacro de contingencia operativa ejecutado por el personal de planta sin ayuda del equipo de desarrollo.
- **Pruebas físicas/HIL**: Maniobra de desconexión y sustitución de hardware por parte del equipo de mantenimiento eléctrico local.
- **Evidencia requerida**: Registro de asistencia a capacitaciones con firmas de los operadores y certificados de aptitud técnica emitidos.
- **Criterios de aceptación**: 100% de los operadores de turno capacitados y evaluados satisfactoriamente; entrega formal de la documentación técnica completa.
- **Criterios de NO aceptación**: Falta de manuales en idioma local o documentación con procedimientos desactualizados.
- **Dependencias**: I50.
- **Riesgos**: Rotación del personal de planta que obligue a reiniciar ciclos de capacitación.
- **Rollback**: Implementación de módulos de auto-capacitación interactivos integrados en la consola HMI.
- **Definition of Done**: Transferencia operativa completada con personal de planta certificado para la operación autónoma.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de ejecución de talleres de capacitación en planta.

---

### I52 — Ciclo de Vida Continuo, MLOps Industrial y Mantenimiento de Seguridad
- **Objetivo**: Establecer el marco de ciclo de vida continuo para la actualización segura del software en los IPCs, recalibración periódica de modelos analíticos y gestión proactiva de vulnerabilidades durante toda la vida útil de la plataforma (10+ años).
- **Problema actual**: No existe un mecanismo definido para el despliegue seguro de parches en caliente ni para la reevaluación de modelos tras modificaciones mecánicas en el tándem de molienda.
- **Estado inicial real**: `PLANNED`.
- **Archivos/componentes afectados**: Pipeline CI/CD, infraestructura de despliegue sobre DMZ, scripts de actualización de firmware de IPC.
- **Cambios técnicos requeridos**: Implementación de mecanismo de actualización de firmware y software tipo A/B particionado (Dual-Boot) con reversión automática ante fallos de arranque, y tubería MLOps para detectar deriva de modelos (*data drift*) ante cambios de variedad de caña en cada zafra.
- **Cambios de arquitectura**: Operación sostenible a largo plazo cumpliendo las directivas de mantenimiento del ciclo de vida del estándar IEC 62443-4-1.
- **Implementación**: Despliegue de servicio de actualización desatendida firmada criptográficamente con verificación de suma SHA-256 antes de la aplicación.
- **Pruebas automatizadas**: Pruebas de actualización de software simulando corte de energía a mitad del proceso de flasheo y comprobando reversión automática a la partición anterior funcional.
- **Pruebas de integración**: Monitoreo de deriva de métricas de molienda y disparo de solicitudes de recalibración al final de cada zafra.
- **Pruebas físicas/HIL**: Actualización remota de un IPC en sala de control comprobando continuidad de la adquisición en menos de 60 segundos de reinicio.
- **Evidencia requerida**: Procedimiento de gestión de cambios y matriz de versionado de software y modelos matemáticos documentada.
- **Criterios de aceptación**: Actualizaciones aplicadas con interrupción < 60 segundos y reversión garantizada al 100% ante cualquier falla; recalibración anual de modelos documentada.
- **Criterios de NO aceptación**: Despliegues directos que no permitan rollback o actualizaciones que requieran acceso a internet sin intermediación de la DMZ.
- **Dependencias**: I50, I51.
- **Riesgos**: Corrupción del arranque del IPC durante actualizaciones de kernel en terreno.
- **Rollback**: Partición B de rescate booteable por hardware watchdog con imagen de fábrica inmutable.
- **Definition of Done**: Marco de ciclo de vida continuo y MLOps operativo y gobernado por el estándar IEC 62443-4-1.
- **Estado**: `PLANNED`.
- **Evidencia**: Pendiente de despliegue de infraestructura de ciclo de vida.

---

## 5. MATRIZ MAESTRA MULTIDIMENSIONAL DE ESTADO REAL

Para evitar porcentajes globales engañosos que oculten brechas críticas de campo, BioAzúcar 4.0 evalúa su madurez técnica a través de 9 dimensiones independientes y desacopladas:

```
====================================================================================================
DIMENSIÓN TÉCNICA               ESTADO AUDITADO                     VALORACIÓN REAL
====================================================================================================
1. Software Completion          Implementación lógica y UI           94.0 %  (Base de software extensa)
2. Automated Test Completion    Pruebas en memoria (Vitest)          100.0 % (338/338 tests verdes)
3. Integration Completion       Sockets, brokers y DBs reales        15.0 %  (Transporte wire-level pendiente)
4. OT Validation Completion     Validación con PLCs físicos          5.0 %   (Sin hardware de planta aún)
5. Security Verification        Auditoría física y pentesting        25.0 %  (Matriz diseñada, audit pending)
6. FAT Completion               Aceptación en banco de pruebas        10.0 %  (Procedimiento simulado en código)
7. SAT Completion               Puesta en servicio en ingenio        0.0 %   (Pendiente de instalación en zafra)
8. Commissioning Completion     Operación continua en planta          0.0 %   (Pendiente de arranque de zafra)
9. Production Readiness         Criterios de pase a producción       18.5 %  (No apto para producción aún)
====================================================================================================
```

### 5.1 Matriz Detallada por Capacidad Industrial

| ID | Capacidad Industrial | Código Fuente | Tests en Memoria | Integración Real | Evidencia Física | Validación Campo | Estado Real Objetivo |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **CAP-01** | Contrato de Drivers Canónicos | `IMPLEMENTED` | `TESTED` | `SIMULATED` | `MOCK` | `PLANNED` | `IMPLEMENTED` (Lógica lista, requiere sockets) |
| **CAP-02** | Cliente OPC UA Wire-Level (TCP 4840) | `IMPLEMENTED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `MOCK` (Opera sobre Map en memoria) |
| **CAP-03** | Modbus TCP/RTU Físico (502/802/Serial) | `IMPLEMENTED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `MOCK` (Registros sintéticos con Math.random) |
| **CAP-04** | MQTT Sparkplug B Binario Protobuf | `IMPLEMENTED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `SIMULATED` (JSON en memoria, sin socket) |
| **CAP-05** | Adaptadores Nativos S7 / CIP / EROS | `IMPLEMENTED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `MOCK` (Parsers listos, sin transporte físico) |
| **CAP-06** | Data Quality Gate Inviolable | `IMPLEMENTED` | `TESTED` | `PARTIAL` | `MOCK` | `PLANNED` | `IMPLEMENTED` (Reglas válidas, falta flujo real) |
| **CAP-07** | Historiador Local On-Premise (TSDB) | `IMPLEMENTED` | `TESTED` | `MOCK` | `MOCK` | `PLANNED` | `MOCK` (RAM ring-buffer, se pierde al reiniciar) |
| **CAP-08** | Store & Forward Transaccional (RPO=0) | `IMPLEMENTED` | `TESTED` | `PARTIAL` | `MOCK` | `PLANNED` | `PARTIAL` (Volcado JSON debounced, no WAL) |
| **CAP-09** | Edge Runtime & Supervisor Watchdog | `IMPLEMENTED` | `TESTED` | `PARTIAL` | `MOCK` | `PLANNED` | `PARTIAL` (Supervisor lógico, falta /dev/watchdog) |
| **CAP-10** | Gateway Comandos Seguros (Read-After-Write) | `IMPLEMENTED` | `TESTED` | `MOCK` | `MOCK` | `PLANNED` | `IMPLEMENTED` (Criptografía lista, sin PLC) |
| **CAP-11** | Segmentación Dual-NIC (eth0 OT / eth1 DMZ) | `PARTIAL` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `PARTIAL` (Script bash inicial, sin pcap) |
| **CAP-12** | Hardening OS CIS Linux Benchmark v2.0 | `PARTIAL` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `PARTIAL` (sysctl configurado, falta AppArmor) |
| **CAP-13** | Gestión de Identidad y PKI Industrial | `PARTIAL` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `PARTIAL` (Certificados autogenerados manuales) |
| **CAP-14** | Observabilidad y Métricas Prometheus | `IMPLEMENTED` | `TESTED` | `PARTIAL` | `MOCK` | `PLANNED` | `IMPLEMENTED` (Endpoints listos, falta grafana) |
| **CAP-15** | Aislamiento Multi-Tenant en Backend | `IMPLEMENTED` | `TESTED` | `TESTED` | `MOCK` | `PLANNED` | `IMPLEMENTED` (Validado en tests de Express) |
| **CAP-16** | Gobernanza Agrícola y Validación PDA | `IMPLEMENTED` | `TESTED` | `TESTED` | `MOCK` | `PLANNED` | `IMPLEMENTED` (Persistencia dual Firestore/Local) |
| **CAP-17** | Linaje de Datos Criptográfico SHA-256 | `PARTIAL` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `PARTIAL` (Estructura base, falta encadenamiento) |
| **CAP-18** | Modelos BioAI Calibrados Empíricamente | `SIMULATED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `SIMULATED` (Heurística + LLM, sin dataset real) |
| **CAP-19** | Envolvente de Seguridad para Optimización | `PARTIAL` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `PARTIAL` (Límites definidos conceptualmente) |
| **CAP-20** | Rendimiento 5,000 tags/s p99 < 25 ms | `TARGET` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `TARGET` (No demostrado con generador de red) |
| **CAP-21** | Verificación Ciberseguridad IEC 62443 SL3 | `DESIGNED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `DESIGNED` (Matriz documental, sin pentest) |
| **CAP-22** | Resiliencia y Chaos Testing Físico | `SIMULATED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `SIMULATED` (Inyección en memoria, sin hardware) |
| **CAP-23** | Protocolo FAT en Banco de Pruebas | `PLANNED` | `TESTED` | `PLANNED` | `MOCK` | `PLANNED` | `PLANNED` (Acta de código simulada, falta banco) |
| **CAP-24** | Banco Hardware-in-the-Loop (HIL) | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Requiere montaje de rack de PLCs) |
| **CAP-25** | Operación en Modo Sombra en Planta | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Requiere conexión física en ingenio) |
| **CAP-26** | Protocolo SAT en Ingenio Piloto | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Requiere ejecución formal en sitio) |
| **CAP-27** | Puesta en Marcha en Zafra Continua | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Requiere inicio de temporada de zafra) |
| **CAP-28** | Production Readiness Review (PRR) | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Auditoría final previa a pase comercial) |
| **CAP-29** | Transferencia Operativa y Capacitación | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Requiere talleres con operadores) |
| **CAP-30** | MLOps y Ciclo de Vida IEC 62443-4-1 | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` | `PLANNED` (Gobernanza de soporte y parches) |

---

## 6. BACKLOG TÉCNICO PRIORIZADO (P0 A P3)

La ejecución no debe guiarse por la creación de pantallas cosméticas, sino por el levantamiento estricto de bloqueadores de producción:

### Prioridad P0 — Bloqueadores Críticos de Producción e Integridad Física
*Cualquier ítem que pueda inducir a datos falsos, pérdida de telemetría, fuga de aislamiento o comandos inseguros:*
- **P0-1 (I22)**: Eliminar toda generación estocástica (`Math.random()`, `sin()`) en la capa de drivers; propagar `BAD` ante fallas de enlace.
- **P0-2 (I23)**: Implementar cliente OPC UA nativo con canal binario TCP/IP (puerto 4840) y negociación estricta mTLS.
- **P0-3 (I24)**: Implementar sockets TCP (502/802) y puerto serial binario para Modbus TCP/RTU.
- **P0-4 (I29)**: Reemplazar el volcado JSON en memoria de Store & Forward por un buffer transaccional en disco con motor WAL y fsync.
- **P0-5 (I31)**: Bloquear escrituras en PLCs que no implementen confirmación inmediata *read-after-write* y validación de interlocks.
- **P0-6 (I32)**: Configurar y auditar físicamente la partición de red Dual-NIC (`eth0` OT / `eth1` DMZ) con `net.ipv4.ip_forward = 0`.
- **P0-7 (I36)**: Eliminar la dependencia de parámetros de tenant en el cuerpo de peticiones HTTP en servidor central.
- **P0-8 (I39)**: Separar tajantemente en la interfaz y en los endpoints las inferencias de LLM de los balances físicos de molienda.

### Prioridad P1 — Requisitos Obligatorios Previos a la Entrada a Planta Piloto
*Necesarios antes de conectar el hardware a la red del ingenio azucarero:*
- **P1-1 (I25)**: Integrar cliente MQTT físico con encoding Sparkplug B en Protobuf binario.
- **P1-2 (I26)**: Implementar sockets ISO-on-TCP (puerto 102) para Siemens S7 y encapsulación CIP para Rockwell.
- **P1-3 (I28)**: Implementar motor TSDB embebido en disco para retención histórica local de 90 días en el IPC.
- **P1-4 (I30)**: Vincular el supervisor del Edge Daemon al temporizador de hardware watchdog de Linux (`/dev/watchdog`).
- **P1-5 (I33)**: Completar el script de imagen Golden con perfiles AppArmor y bloqueo udev de memorias USB.
- **P1-6 (I34)**: Desplegar infraestructura PKI local para emisión y rotación de certificados X.509 de dispositivos.
- **P1-7 (I35)**: Exponer métricas de hardware (temperatura, I/O, jitter) en endpoint Prometheus y configurar alertas operativas.
- **P1-8 (I41)**: Codificar la envolvente de seguridad operacional con límites máximos de presión de vapor y corriente de molienda.
- **P1-9 (I45)**: Redactar y formalizar el protocolo FAT de laboratorio con banco de pruebas de hardware.
- **P1-10 (I46)**: Validar lazo cerrado en banco Hardware-in-the-Loop con CPUs S7-1500 y CompactLogix.

### Prioridad P2 — Requisitos Obligatorios Previos al Pase a Producción Comercial
*Necesarios para firmar el acta de entrega y autorizar la operación continua:*
- **P2-1 (I37)**: Enforzar validaciones de consistencia agronómica de campañas agrícolas en el backend de servidor.
- **P2-2 (I38)**: Implementar encadenamiento de linaje criptográfico SHA-256 desde el sensor hasta el reporte analítico.
- **P2-3 (I40)**: Calibrar los coeficientes del modelo de molienda con un dataset empírico real de una zafra previa.
- **P2-4 (I42)**: Ejecutar prueba de rendimiento reproducible de 4 horas continuas a 5,000 tags/s con p99 < 25 ms en hardware final.
- **P2-5 (I43)**: Superar escaneo de seguridad SAST/DAST con 0 vulnerabilidades críticas/altas y generar SBOM CycloneDX.
- **P2-6 (I44)**: Ejecutar protocolo de Chaos Testing físico en laboratorio provocando corte real de interfaces de red y energía.
- **P2-7 (I47)**: Completar 7 días continuos en modo escucha (*shadow mode*) en el ingenio sin fallas ni impactos en la red OT.
- **P2-8 (I48)**: Ejecutar y suscribir formalmente el Acta de Aceptación Técnica en Sitio (SAT) con las autoridades del ingenio.
- **P2-9 (I49)**: Completar los primeros 30 días de puesta en marcha en zafra continua con disponibilidad > 99.9%.
- **P2-10 (I50)**: Dictamen favorable unánime en la sesión formal de Production Readiness Review (PRR).

### Prioridad P3 — Mejora Continua, Ciclo de Vida y Extensión de Plataforma
*Actividades posteriores al comisionamiento formal:*
- **P3-1 (I51)**: Ejecución de talleres presenciales de capacitación a operadores y entrega de manuales industriales laminados.
- **P3-2 (I52)**: Despliegue de tubería MLOps para detección de deriva de modelos de molienda y actualizaciones A/B seguras.
- **P3-3**: Integración de nuevos protocolos de campo (Profibus DP legacy vía pasarelas, WirelessHART, IO-Link).
- **P3-4**: Soporte multi-idioma formal en consolas HMI (Español, Portugués, Inglés) para ingenios internacionales.

---

## 7. SECUENCIA CRONOLÓGICA DE EJECUCIÓN INDUSTRIAL

Para evitar retrocesos y garantizar la estabilidad del sistema, el trabajo técnico debe seguir estrictamente la siguiente cadena de dependencias:

```
[ PASO 1: DATA TRUTH & TRANSPORTE FÍSICO WIRE-LEVEL ]
  ├── I22: Rebaseline técnico y erradicación de simulaciones estocásticas
  ├── I23: Conectividad nativa OPC UA sobre TCP 4840
  ├── I24: Conectividad nativa Modbus TCP/RTU sobre sockets 502/802 y serial
  ├── I25: Conectividad nativa MQTT Sparkplug B Protobuf
  └── I26: Conectividad nativa Siemens S7 (puerto 102) y Rockwell CIP
                       │
                       ▼
[ PASO 2: EDGE INDUSTRIAL RESILIENTE EN DISCO ]
  ├── I27: Pipeline Data Quality Gate inline en tiempo real
  ├── I28: Historiador TSDB embebido duradero en SSD/NVMe
  ├── I29: Store & Forward transaccional con motor WAL y RPO=0 físico
  └── I30: Supervisor de procesos integrado a hardware watchdog (/dev/watchdog)
                       │
                       ▼
[ PASO 3: CIBERSEGURIDAD, RED Y COMANDOS SEGUROS ]
  ├── I31: Secure Command Gateway físico con confirmación read-after-write
  ├── I32: Aislamiento físico de red Dual-NIC (eth0 OT / eth1 DMZ) con nftables
  ├── I33: Hardening del IPC según CIS Benchmark v2.0 e Imagen Golden
  ├── I34: Infraestructura PKI para certificados X.509 de dispositivo
  └── I36: Blindaje de autorización multi-tenant en backend central
                       │
                       ▼
[ PASO 4: OBSERVABILIDAD, CALIBRACIÓN BIOAI & GOBERNANZA ]
  ├── I35: Exportador Prometheus de hardware y alertas operativas de planta
  ├── I37: Gobernanza y validación server-side de campañas agrícolas (PDA)
  ├── I38: Trazabilidad criptográfica y linaje de datos de molienda
  ├── I39: Separación arquitectónica de modelos físicos, heurísticas y LLM
  ├── I40: Calibración empírica de modelos con datos históricos de zafra
  └── I41: Envolvente de seguridad operacional y barreras de optimización
                       │
                       ▼
[ PASO 5: CUALIFICACIÓN DE LABORATORIO & BANCO HIL ]
  ├── I42: Calificación de rendimiento a 5,000 tags/s sostenidos en hardware
  ├── I43: Escaneo formal de ciberseguridad SAST/DAST y generación de SBOM
  ├── I44: Calificación de resiliencia con inducción de fallas físicas reales
  ├── I45: Ejecución y firma formal del protocolo FAT de laboratorio
  └── I46: Validación lazo cerrado en banco Hardware-in-the-Loop (PLCs físicos)
                       │
                       ▼
[ PASO 6: INTEGRACIÓN EN PLANTA, SAT & COMISIONAMIENTO ]
  ├── I47: Operación pasiva en modo sombra (Shadow Mode) durante 7 días en zafra
  ├── I48: Ejecución y firma formal en sitio del Acta de Aceptación SAT
  ├── I49: Puesta en marcha técnica y operación en zafra continua (30 días)
  ├── I50: Sesión formal y aprobación del Production Readiness Review (PRR)
  ├── I51: Transferencia operativa, manuales y certificación de operadores
  └── I52: Ciclo de vida continuo, MLOps industrial y gestión de parches
```

---

## 8. DEFINICIÓN OBJETIVA DE PRODUCTION_READY

BioAzúcar 4.0 **NO PODRÁ SER DECLARADO `PRODUCTION_READY`** de forma genérica o prematura. La transición al estado `PRODUCTION_READY` requiere el cumplimiento estricto y auditable de las siguientes 10 condiciones técnicas:

1. **Cero Mocks en Enlace de Planta**: Ni un solo tag de proceso catalogado como `LIVE_OT` proviene de mapas en memoria, temporizadores sintéticos o generadores estocásticos. Todo dato proviene de un socket TCP binario o puerto serial físico conectado a instrumentación real.
2. **RPO = 0 Físico Comprobado**: Demostración en laboratorio del corte de alimentación eléctrica del IPC durante escritura masiva en disco, con encendido posterior y recuperación del 100% de los datos encolados mediante la bitácora WAL, sin corrupción ni pérdida de muestras.
3. **Dual-NIC Aislado Físicamente**: El kernel de Linux tiene deshabilitado el enrutamiento de paquetes (`ip_forward = 0`) y las reglas de `nftables` bloquean cualquier comunicación entre la red de control `eth0` y la red corporativa/DMZ `eth1`, actuando únicamente el Edge Daemon como puente de nivel de aplicación.
4. **Protección Criptográfica en Comandos**: Ningún comando de parada o cambio de consigna crítica en la maquinaria de molienda se ejecuta sin autenticación de dos factores, verificación anti-replay (HMAC con ventana < 300 s), principio de cuatro ojos y lectura confirmatoria (*read-after-write*) en el PLC en < 300 ms.
5. **Aislamiento Multi-Tenant Estricto en Servidor**: El 100% de las rutas de backend y consultas a base de datos aplican el filtro obligatorio de `tenantId` derivado exclusivamente del token criptográfico del usuario autenticado, demostrado mediante emulador y suite de pruebas de penetración.
6. **Separación Transparente de Modelos BioAI**: La interfaz y los reportes diferencian de forma explícita los cálculos termodinámicos deterministas, las aproximaciones estadísticas calibradas y las recomendaciones generadas por modelos de lenguaje, estando estas últimas bloqueadas para actuar sobre lazos de control cerrados.
7. **Rendimiento Sostenido Certificado**: El IPC industrial mantiene una tasa sostenida de 5,000 tags/s con latencia percentil p99 < 25 ms, consumo de memoria < 512 MB y carga de CPU < 50% durante una prueba de estrés continua de 4 horas.
8. **Seguridad IEC 62443 SL3 Auditada**: Cero vulnerabilidades críticas o altas detectadas por herramientas SAST/DAST, SBOM CycloneDX validado y hardening del sistema operativo certificado bajo el perfil CIS Linux Benchmark Nivel 2.
9. **Actas FAT y SAT Formales Firmadas**: Existencia física de las actas de Aceptación en Fábrica (laboratorio) y Aceptación en Sitio (ingenio) debidamente firmadas por las autoridades técnicas competentes, sin puntos de punchlist críticos abiertos.
10. **30 Días de Operación Continua en Zafra**: Puesta en marcha completada con una disponibilidad operativa superior al 99.9% durante un mes completo de molienda continua en planta azucarera real.

---

> **Aprobado por:**  
> Lead Industrial Software Architect & CTO BioAzúcar 4.0  
> *Documento Maestro de Ingeniería Industrial y Hoja de Ruta Oficial — BioAzúcar 4.0*
