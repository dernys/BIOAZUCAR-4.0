# Manual de Comisionamiento de Campo y Validación de PLCs
## BioAzúcar 4.0 Industrial Edge (IEC 62443 / ISA-95 Nivel 2-3)

---

### 1. Objetivos del Comisionamiento

Este procedimiento técnico describe el protocolo de pruebas SAT (*Site Acceptance Testing*) para integrar controladores lógicos programables (PLCs), sistemas DCS y centros de control de motores (CCMs) de la planta azucarera con el nodo **BioAzúcar Industrial Edge Daemon**.

---

### 2. Matriz de Conectividad y Protocolos Soportados

| Área de Planta | Controladores Típicos | Protocolo Primario | Puerto | Mecanismo de Seguridad |
| :--- | :--- | :--- | :--- | :--- |
| **Báscula y Muestreador** | Toledo / Mettler, Rinstrum | Modbus TCP / RTU | `502` / `802` | Modbus TCP Security / VLAN 20 |
| **Molienda (Tándem 1 y 2)** | Rockwell ControlLogix 1756 | EtherNet/IP / OPC-UA | `44818` / `4840` | OPC-UA Sign & Encrypt (Basic256Sha256) |
| **Generación de Vapor (Calderas)** | Siemens S7-1500 Fail-Safe | S7comm / OPC-UA | `102` / `4840` | Certificados X.509 de Planta |
| **Turbogeneradores y Subestación** | Woodward / SEL-751 | Modbus TCP / DNP3 | `502` / `20000` | Gateway MGUARD Firewall OT |
| **Evaporación y Tachos** | Schneider Modicon M580 | Modbus TCP / OPC-UA | `502` / `4840` | Encriptación mTLS Edge-to-Cloud |
| **Laboratorio Sacarimétrico** | Anton Paar / Schmidt+Haensch | Eros / RS-232 / TCP | `9100` | Formato NIR / Pol / Brix normalizado |

---

### 3. Protocolo de Pruebas en Frío (Cold Commissioning)

#### 3.1 Verificación de Enlace Físico y Direccionamiento
1. Conectar el puerto `eth0` del Edge IPC al switch administrable de la red de control OT (ej. Moxa EDS-510E).
2. Asignar dirección estática en la subred OT del tándem:
   ```bash
   sudo ip addr add 192.168.20.50/24 dev eth0
   sudo ip link set eth0 up
   ```
3. Ejecutar prueba de alcance (*ping* ICMP) a cada PLC:
   ```bash
   ping -c 3 192.168.20.10 # PLC Tandem Molinos
   ping -c 3 192.168.20.11 # PLC Caldera Bagazo
   ```

#### 3.2 Escaneo Seguro de Puertos Industriales
Verificar que únicamente los puertos requeridos respondan:
```bash
nmap -Pn -p 502,802,4840,44818 192.168.20.10
```

---

### 4. Protocolo de Pruebas en Caliente (Hot Commissioning / Loop Check)

#### 4.1 Prueba de Disparo de Tags y Latencia
Iniciar el demonio en modo diagnóstico de campo:
```bash
sudo systemctl stop bioazucar-edge
BIOAZUCAR_LOG_JSON=false \
BIOAZUCAR_SYNC_INTERVAL_MS=1000 \
npx tsx src/services/edge/daemon.ts
```

#### 4.2 Verificación de Calidad de Datos (OPC-UA / Modbus)
- **GOOD (192)**: El valor físico (ej. TCH = 450.2, Brix = 18.4) fluctúa dentro de los rangos válidos del transmisor 4-20mA.
- **BAD_SENSOR_FAILURE (0)**: Desconexión o rotura de hilo de señal del transmisor (NAMUR NE43 < 3.6 mA). El demonio marca inmediatamente la alarma y descarta el punto para el cálculo de KPIs.
- **UNCERTAIN (64)**: Calibración o fuera de escala temporal.

#### 4.3 Simulación de Pérdida de Enlace Nube (Store & Forward Test)
1. Bloquear temporalmente la interfaz de salida a Internet:
   ```bash
   sudo iptables -A OUTPUT -o eth1 -j DROP
   ```
2. Observar en los logs cómo el motor almacena en disco cifrado con AES-256-GCM:
   ```
   [INFO] [bioazucar-edge] Network unreachable. Buffering batch in encrypted disk journal (data/edge-saf-journal.json)...
   ```
3. Restaurar conectividad:
   ```bash
   sudo iptables -D OUTPUT -o eth1 -j DROP
   ```
4. Confirmar que los lotes almacenados se retransmiten en orden estricto de secuencia sin duplicación ni pérdida de muestras.

---

### 5. Criterios de Aceptación y Firma SAT

1. **Latencia OT-to-Daemon**: Menor a 250 ms en muestreo cíclico de 1 segundo.
2. **Disponibilidad de Enlace**: 99.9% durante prueba de estabilidad de 48 horas continuas.
3. **Firmas Criptográficas**: 100% de los lotes recibidos en BioAzúcar Cloud deben tener HMAC-SHA256 y mTLS válidos.
4. **No Disrupción de PLCs**: Cero impacto en el tiempo de escaneo del procesador del PLC (< 5% overhead de comunicación en CPU).
