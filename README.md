# BioAzúcar 4.0 — Plataforma Industrial Inteligente & Gemelo Digital para Ingenios Azucareros y Cogeneración con Biomasa

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-145%20Passed-success.svg?logo=vitest)](https://vitest.dev/)
[![IEC 62443](https://img.shields.io/badge/Security-IEC%2062443--4--2%20SL3-darkgreen.svg)](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa99)
[![ISA-95](https://img.shields.io/badge/Architecture-ISA--95%20Level%201--4-orange.svg)](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa95)
[![ISA-18.2](https://img.shields.io/badge/Alarms-ISA--18.2%20Compliant-red.svg)](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa18)

---

## 1. Descripción Ejecutiva

**BioAzúcar 4.0** es una plataforma integral de transformación digital, control en tiempo real, mantenimiento prescriptivo y gemelo digital termodinámico diseñada específicamente para la **industria azucarera y plantas de cogeneración de bioenergía**.

La plataforma unifica en una arquitectura **Unified Namespace (UNS)** la telemetría de campo, el control de procesos de molienda y calderas de biomasa, la gestión de laboratorio (LIMS), el mantenimiento centrado en confiabilidad (RCM/CMMS) y la inteligencia artificial industrial aplicada, permitiendo a superintendentes, ingenieros y operadores maximizar la extracción de sacarosa y la venta de potencia eléctrica a la red nacional.

---

## 2. Arquitectura del Sistema (ISA-95 / IEC 62443)

El sistema está estructurado respetando la jerarquía internacional de automatización industrial:

```
+-----------------------------------------------------------------------------------------+
|  NIVEL 4: GESTIÓN EMPRESARIAL & IA INDUSTRIAL                                           |
|  - Unified Namespace (UNS) MQTT / TSDB Time-Series Engine                               |
|  - BioAI Copilot (Gemini Industrial Engine con Evidence-First & Rigor RBAC)             |
|  - Análisis de Causa Raíz (RCA) & Proyecciones Predictivas 24h Molienda/Vapor           |
|  - Auditoría Inmutable de Acciones Operativas (Compliance SEC-6)                        |
+-----------------------------------------------------------------------------------------+
                                             ▲
                                             │ HTTPS / TLS 1.3 + HMAC-SHA256
                                             │ (Ventana Anti-Repetición 300s)
                                             ▼
+-----------------------------------------------------------------------------------------+
|  NIVEL 2.5: BIOAZÚCAR INDUSTRIAL EDGE DAEMON (IEC 62443 L2/L3)                          |
|  - Concentrador de Protocolos OT: OPC UA (IEC 62541), Modbus TCP, DCS EROS, Sparkplug B |
|  - Compresor Determinístico: Swinging Door Trending (SDT: Dev 0.25%, Min 1s)            |
|  - Resiliencia Eléctrica: Store & Forward con Journal en Disco Cifrado (AES-256-GCM)    |
|  - Calidad de Datos & Linaje: Industrial Data Quality Gate (Separación Real vs Simulado)|
|  - Watchdog de Salud Local en Puerto HTTP 9099                                          |
+-----------------------------------------------------------------------------------------+
                                             ▲
                                             │ Red de Control Aislada (Dual-NIC eth0)
                                             │ Subred PLCs: 192.168.10.x / 192.168.20.x
                                             ▼
+-----------------------------------------------------------------------------------------+
|  NIVEL 1 & 2: CONTROL DE PROCESOS & INSTRUMENTACIÓN DE PLANTA                           |
|  - Tándem de Molienda (Cuchillas, Desfibrador, Molinos 1 a 5 con Donelly Chute)        |
|  - Calderas Acuotubulares de Biomasa (64 bar, 510°C, Balances ASME PTC 4)               |
|  - Turbogeneradores de Extracción/Condensación & Subestación de Exportación Eléctrica   |
|  - Básculas de Camiones & Espectrómetros NIR de Laboratorio                             |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Módulos Funcionales

### 3.1. SCADA & Visualización Sinóptica de Planta
- Representación esquemática animada de tándems de molinos, donelly chutes con control PID de nivel, imbibición compuesta y tren de calderas.
- Diagrama interactivo de balance de masa y vapor (alta presión 64 bar, media 20 bar, escape a evaporadores 1.5 bar).
- Visualización de estado de compuertas, motores hidráulicos y bombas de jugo mixto.

### 3.2. Historiador TSDB con Downsampling LTTB y Algoritmo SDT
- Motor de series temporales con algoritmo **Largest Triangle Three Buckets (LTTB)** para renderizar tendencias anuales o por turno en milisegundos sin pérdida de picos o valles críticos.
- Compresión de ingesta mediante **Swinging Door Trending (SDT)** con reducción de ancho de banda superior al 84%.
- Selector de densidad de muestreo (alta fidelidad vs datos brutos) con linaje de procedencia auditable por punto.

### 3.3. Despacho Energético & Balances Termodinámicos
- Algoritmo de calibración de Hugot ($k_w$) para extracción de sacarosa en tándem de molinos.
- Pérdidas por calor sensible, gases secos y humedad de bagazo según norma **ASME PTC 4**.
- Monitoreo en tiempo real de exportación neta MW a la red eléctrica y cálculo de ingresos económicos según precio spot spot/PPA.

### 3.4. Mantenimiento Centrado en Confiabilidad (RCM / CMMS)
- Monitoreo de vibraciones RMS según norma **ISO 10816-3** en chumaceras de molinos, turbinas y ventiladores de tiro inducido (ID Fan).
- Análisis probabilístico de fallas mediante **Distribución de Weibull** ($\beta$ factor de forma, $\eta$ vida característica, MTBF y disponibilidad proyectada).
- Flujo de órdenes de trabajo con control de criticidad de activos e inventario de repuestos.

### 3.5. Sistema de Gestión de Información de Laboratorio (LIMS)
- Registro y cálculo automático de calidad de caña y jugos: **°Brix, %Pol, Pureza Aparente, Fibra y Azúcares Reductores**.
- Cálculo de Pérdida Indeterminada y Sacarosa Recuperable según método **Spencer-Meade**.
- Trazabilidad por frente de corte, variedad de caña y lote de entrega.

### 3.6. Gestión de Alarmas ISA-18.2
- Clasificación de severidad: `INFO`, `WARNING`, `CRITICAL`, `SAFETY_INTERLOCK`.
- Ciclo de vida estricto: `UNACKNOWLEDGED` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `CLEARED` o `SHELVED`.
- Detección de avalanchas de alarmas (*alarm floods*) y supresión operacional automática basada en estado del proceso.

### 3.7. BioAI Copilot & Análisis de Causa Raíz (RCA)
- Asistente de ingeniería contextual impulsado por modelos Gemini con estricta disciplina Evidence-First.
- Distinción auditada de fuentes: jamás confunde telemetría física en vivo con simulaciones o documentos teóricos.
- Flujo de dos fases con tokens de confirmación temporal para cambios de consigna y mandos remotos (Nivel 3).

---

## 4. Seguridad de Datos y Transmisiones (IEC 62443-4-2 SL3)

BioAzúcar 4.0 cuenta con una arquitectura de ciberseguridad industrial de grado militar:

| Control de Seguridad | Estándar / Mecanismo | Implementación |
|---|---|---|
| **Autenticación en Tránsito** | HMAC-SHA256 | Cabecera `x-bioazucar-edge-signature` calculada como `HMAC(NodeID:Timestamp:Payload)` con secreto rotativo. |
| **Defensa Anti-Repetición** | Ventana Temporal Estricta | Timestamp verificado contra reloj atómico (NTP) con rechazo de paquetes con desviación $>300$ segundos. |
| **Aislamiento de Red** | Dual-NIC DMZ Architecture | Separación física de interfaz OT (`eth0`, sin gateway a internet) e interfaz DMZ (`eth1`, salida HTTPS exclusiva). |
| **Cifrado en Reposo** | AES-256-GCM (0600) | Cola Store & Forward persistida en disco SSD con permisos restringidos y cifrado de hardware/software. |
| **Control de Acceso (RBAC)** | Jerarquía de 4 Niveles | Roles: `operador`, `supervisor`, `administrador`, `superadmin` con validación en servidor de cada endpoint. |
| **Auditoría Inmutable** | SEC-6 Audit Logging | Registro inmutable de cada cambio de setpoint, inicio de sesión o reconocimiento de alarma con IP y hash de actor. |

---

## 5. Demonio de Borde Industrial (BioAzúcar Edge Daemon)

El demonio de borde se ejecuta de manera autónoma en computadores industriales (IPC Advantech, Siemens, Kontron o Raspberry Pi Industrial) ubicados junto a los centros de control de motores (CCM) o salas de control de molienda y calderas.

### Instalación Rápida como Servicio Nativo (Linux systemd)

```bash
# 1. Clonar el repositorio
git clone https://github.com/dernys/BIOAZUCAR-4.0.git
cd BIOAZUCAR-4.0

# 2. Ejecutar script de despliegue automatizado con privilegios de root
sudo bash deploy/deploy-edge.sh

# 3. Verificar estado del servicio
sudo systemctl status bioazucar-edge

# 4. Monitorear logs de sincronización y compresión en vivo
journalctl -u bioazucar-edge -f
```

### Despliegue con Docker Compose

```bash
# Construir e iniciar el contenedor en modo host networking
docker compose -f deploy/docker-compose.edge.yml up -d

# Consultar el Watchdog de Salud Local
curl http://127.0.0.1:9099/health
```

> Consulte la guía detallada en [`docs/EDGE_DAEMON_DEPLOYMENT_GUIDE.md`](docs/EDGE_DAEMON_DEPLOYMENT_GUIDE.md).

---

## 6. Puesta en Marcha del Servidor Central & Aplicación Web

### Requisitos Previos
- Node.js 20.x o superior
- npm o bun
- Navegador moderno compatible con WebGL / Canvas

### Instalación y Ejecución en Desarrollo

```bash
# Instalar dependencias del proyecto
npm install

# Iniciar servidor completo (Backend Express + Frontend Vite en puerto 3000)
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Compilación y Ejecución en Producción

```bash
# Compilar cliente estático y servidor backend empaquetado en dist/server.cjs
npm run build

# Iniciar servicio de producción
npm start
```

---

## 7. Pruebas Automatizadas y Calidad de Código

El sistema cuenta con una cobertura integral de pruebas unitarias, de integración y físicas con Vitest:

```bash
# Ejecutar la suite completa de pruebas
npx vitest run

# Ejecutar validación de tipos TypeScript
npx tsc --noEmit
```

**Módulos probados**:
- `EdgeTelemetrySyncAndQualityGate.test.ts`: Validación de HMAC-SHA256, rechazo de simulaciones en producción, compresión SDT y Store & Forward.
- `SugarMillModelCalibrator.test.ts`: Balances de Hugot, eficiencia de extracción y pérdidas de caldera ASME PTC 4.
- `HistorianTSDB.test.ts`: Algoritmo LTTB y reducción de series de tiempo.
- `SecurityInterlocks.test.ts`: Protocolos de dos fases y roles RBAC.

---

## 8. Catálogo de Conectividad de Campo

El sistema incluye plantillas y mapeos preconfigurados para instrumentación de ingenios:

- **OPC UA (IEC 62541)**: Servidores KEPServerEX, Matrikon, Siemens S7-1500, Allen-Bradley ControlLogix.
- **Modbus TCP/RTU**: Pasarelas Moxa NPort, básculas de caña Avery Weigh-Tronix, analizadores NIR FOSS.
- **DCS Propietarios**: Conector bidireccional para sistemas **EROS** (v4.x/5.x).
- **MQTT Sparkplug B**: Integración con brókers industriales (EMQX, HiveMQ) para telemetría distribuida.

Consulte el protocolo de comisionamiento en [`docs/FAT_SAT_COMMISSIONING_TANDEM1.md`](docs/FAT_SAT_COMMISSIONING_TANDEM1.md).

---

## 9. Licencia y Soporte

Desarrollado para la modernización de la agroindustria de la caña de azúcar y cogeneración renovable.  
Documentación y soporte técnico: `engineering@bioazucar40.com`
