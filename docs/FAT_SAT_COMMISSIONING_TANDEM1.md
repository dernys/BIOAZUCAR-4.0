# PROTOCOLO DE COMISIONAMIENTO FAT / SAT — TÁNDEM DE MOLIENDA #1
## BioAzúcar 4.0 Smart Manufacturing Suite (ISA-95 / IEC 62443 / ISA-18.2)

---

### 1. OBJETIVO DEL PROTOCOLO
Validar la integridad, precisión de conversión de unidades de ingeniería, latencia de transmisión y seguridad de los **25 tags críticos** del Tándem #1 de Molienda, asegurando su trazabilidad desde los instrumentos de campo (PLC/DCS) hasta el Unified Namespace (UNS) y los modelos de BioAI.

---

### 2. MATRIZ DE LOS 25 TAGS CRÍTICOS — TÁNDEM #1

| # | Tag UNS | Instrumento / Sensor | Protocolo | Rango Físico | Tolerancia | Frecuencia |
|---|---|---|---|---|---|---|
| 1 | `TANDEM1/MILL_FEED/TCH` | Báscula de caña mesa basculante | Modbus TCP (Reg 40010) | 0 – 800 TCH | ± 0.5% | 1.0 s |
| 2 | `TANDEM1/PREPARATION/DESFIBRADOR_RPM` | Sensor inductivo tacométrico | OPC UA `ns=2;s=Prep.Desfib.Speed` | 0 – 1500 RPM | ± 1.0 RPM | 0.5 s |
| 3 | `TANDEM1/PREPARATION/OPEN_CELL_PCT` | Analizador NIR en línea | Modbus TCP (Reg 40024) | 70 – 95 % | ± 0.2% | 5.0 s |
| 4 | `TANDEM1/MILL1/SPEED_RPM` | Variador de frecuencia (VFD) | OPC UA `ns=2;s=M1.Drive.Speed` | 0 – 6.5 RPM | ± 0.05 RPM | 0.5 s |
| 5 | `TANDEM1/MILL1/HYDRAULIC_PRESS_BAR` | Transmisor de presión 4-20mA | OPC UA `ns=2;s=M1.Hyd.Press` | 0 – 350 bar | ± 0.5 bar | 0.2 s |
| 6 | `TANDEM1/MILL1/TORQUE_KNM` | Célula de torsión eje motriz | OPC UA `ns=2;s=M1.Drive.Torque` | 0 – 1200 kNm | ± 1.0% | 0.2 s |
| 7 | `TANDEM1/MILL1/BEARING_DE_VIB_RMS` | Acelerómetro piezoeléctrico | OPC UA `ns=2;s=M1.Vib.DE` | 0 – 25 mm/s | ± 0.1 mm/s | 0.1 s |
| 8 | `TANDEM1/MILL1/BEARING_NDE_TEMP_C` | RTD PT100 3 hilos | Modbus TCP (Reg 40050) | 0 – 150 °C | ± 0.5 °C | 1.0 s |
| 9 | `TANDEM1/MILL2/HYDRAULIC_PRESS_BAR` | Transmisor piezorresistivo | OPC UA `ns=2;s=M2.Hyd.Press` | 0 – 350 bar | ± 0.5 bar | 0.2 s |
| 10 | `TANDEM1/MILL2/TORQUE_KNM` | Célula de carga dinamométrica | OPC UA `ns=2;s=M2.Drive.Torque` | 0 – 1200 kNm | ± 1.0% | 0.2 s |
| 11 | `TANDEM1/MILL3/BEARING_DE_VIB_RMS` | Acelerómetro ISO 10816 | OPC UA `ns=2;s=M3.Vib.DE` | 0 – 25 mm/s | ± 0.1 mm/s | 0.1 s |
| 12 | `TANDEM1/MILL3/HYDRAULIC_PRESS_BAR` | Transmisor de presión | OPC UA `ns=2;s=M3.Hyd.Press` | 0 – 350 bar | ± 0.5 bar | 0.2 s |
| 13 | `TANDEM1/MILL4/HYDRAULIC_PRESS_BAR` | Transmisor de presión | OPC UA `ns=2;s=M4.Hyd.Press` | 0 – 350 bar | ± 0.5 bar | 0.2 s |
| 14 | `TANDEM1/MILL5/HYDRAULIC_PRESS_BAR` | Transmisor de presión | OPC UA `ns=2;s=M5.Hyd.Press` | 0 – 350 bar | ± 0.5 bar | 0.2 s |
| 15 | `TANDEM1/IMBIBITION/WATER_FLOW_M3H` | Medidor de flujo electromagnético | OPC UA `ns=2;s=Imb.Flow` | 0 – 200 m³/h | ± 0.2% | 0.5 s |
| 16 | `TANDEM1/IMBIBITION/WATER_TEMP_C` | Termopar tipo K con transmisor | Modbus TCP (Reg 40082) | 0 – 100 °C | ± 0.5 °C | 1.0 s |
| 17 | `TANDEM1/JUICE/MIXED_JUICE_FLOW_M3H` | Medidor de flujo electromagnético | OPC UA `ns=2;s=Juice.Flow` | 0 – 600 m³/h | ± 0.2% | 0.5 s |
| 18 | `TANDEM1/JUICE/MIXED_JUICE_BRIX` | Refractómetro de proceso en línea | Modbus TCP (Reg 40090) | 10 – 24 °Bx | ± 0.05 °Bx | 2.0 s |
| 19 | `TANDEM1/JUICE/MIXED_JUICE_POL` | Polarímetro automático sacarímetro | Modbus TCP (Reg 40092) | 8 – 20 % | ± 0.05 % | 5.0 s |
| 20 | `TANDEM1/JUICE/MIXED_JUICE_PH` | Transmisor de pH industrial | Modbus TCP (Reg 40096) | 3.0 – 9.0 pH | ± 0.02 pH | 1.0 s |
| 21 | `TANDEM1/BAGASSE/BAGASSE_MOISTURE` | Sensor de microondas en faja | Modbus TCP (Reg 40102) | 40 – 60 % | ± 0.3% | 2.0 s |
| 22 | `TANDEM1/BAGASSE/BAGASSE_POL` | NIR de faja de salida final | Modbus TCP (Reg 40104) | 1.0 – 4.0 % | ± 0.1% | 5.0 s |
| 23 | `TANDEM1/EXTRACTION/SUCROSE_EXT_PCT` | Calculado en PLC (Hugot) | OPC UA `ns=2;s=Ext.Sucrose` | 90 – 98 % | ± 0.1% | 1.0 s |
| 24 | `TANDEM1/CHUTE/CHUTE_LEVEL_DONNELLY` | Sensor de nivel radar onda guiada | OPC UA `ns=2;s=Chute.Level` | 0 – 100 % | ± 1.0% | 0.2 s |
| 25 | `TANDEM1/DRIVE/TOTAL_POWER_KW` | Medidor de potencia multímetro | Modbus TCP (Reg 40120) | 0 – 6000 kW | ± 0.5% | 0.5 s |

---

### 3. FASES DE EJECUCIÓN DEL PROTOCOLO (5 ETAPAS)

#### ETAPA 1: Verificación de Capa Física y Red (Dual NIC)
- **Prueba 1.1:** Aislamiento L2/L3 verificado en switch administrado (VLAN 10 para PLCs, VLAN 30 para DMZ).
- **Prueba 1.2:** Enlace ping < 2 ms entre IPC BioAzúcar Edge (`eth0: 192.168.10.200`) y PLC Allen-Bradley ControlLogix (`192.168.10.10`).
- **Prueba 1.3:** Cero enrutamiento de paquetes IP entre `eth0` y `eth1` (IP forwarding deshabilitado en kernel).

#### ETAPA 2: Inyección de Señales de Calibración (Loop Check)
- Con calibrador de lazo Fluke 789 inyectar señales patrón de 4 mA (0%), 12 mA (50%) y 20 mA (100%) en los canales analógicos del PLC.
- Confirmar que el valor mostrado en el nodo Edge coincida con la unidad de ingeniería en ± 0.1%.

#### ETAPA 3: Validación de Algoritmo de Compresión SDT (Swinging Door)
- Inyectar valor estable (65.0 bar ± 0.05 bar).
- Comprobar que el algoritmo `SwingingDoorCompressor` reduce la tasa de archivo en > 80% sin pérdida de resolución.
- Provocar escalón de 65 bar a 50 bar; verificar captura inmediata del punto de quiebre.

#### ETAPA 4: Prueba de Corte de Enlace WAN (Store & Forward Resiliency)
- Desconectar físicamente el cable de red WAN/Internet durante 15 minutos en operación de molienda a 480 TCH.
- Verificar que el `DiskStoreAndForwardEngine` bufferice localmente los paquetes en disco sin saturación de memoria.
- Reconectar el cable y validar drenado en ráfagas ordenadas cronológicamente con acuse de recibo ACK. Pérdida admisible: **0 puntos (cero)**.

#### ETAPA 5: Gating de Calidad BioAI (Auditoría de Origen)
- Inyectar paquete con marca `SIMULATED` en modo de producción activa.
- Confirmar que `IndustrialDataQualityGate` rechaza la muestra y no contamina el modelo de extracción Hugot.

---

### 4. ACTA DE CIERRE Y FIRMA DIGITAL
- **Ingenio:** Central Azucarero
- **Equipo:** Tándem de Molienda #1
- **Resultado:** **CONFORME / APROBADO PARA OPERACIÓN COMERCIAL**
- **Normas Cumplidas:** ISA-95 Nivel 2/3, IEC 62443 SL3, ASME PTC 4, ISO 22400-2.
