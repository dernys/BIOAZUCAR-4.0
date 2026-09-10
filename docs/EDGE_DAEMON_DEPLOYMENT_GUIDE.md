# Guía de Configuración y Despliegue del Demonio de Borde Industrial
## BioAzúcar 4.0 — Edge Gateway Daemon (IEC 62443 L2/L3)

---

### 1. Visión General de la Arquitectura de Borde

El **Demonio de Borde de BioAzúcar 4.0** (`BioAzucarEdgeDaemon`) es el componente de software autónomo que se ejecuta en computadores industriales (IPC) en el piso de planta de los ingenios azucareros. Su función es concentrar la telemetría proveniente de PLCs, RTUs, DCS (EROS, Honeywell, Yokogawa, Siemens PCS 7) y transmisores inteligentes, aplicar compresión determinística en tiempo real (*Swinging Door Trending* - SDT), garantizar persistencia tolerante a fallas (*Store & Forward*) y sincronizar de forma segura con la nube mediante transmisiones criptográficamente autenticadas.

```
+-----------------------------------------------------------------------------------+
|                            ZONA DE CONTROL OT (ISA-95 Nivel 2)                    |
|  [Báscula Caña]     [Tándem Molinos #1]     [Calderas Biomasa]     [Turbogenerador] |
|   Modbus TCP           OPC UA IEC 62541          DCS EROS           MQTT Sparkplug|
+-----------------------------------------------------------------------------------+
                                         │  (NIC eth0: 192.168.10.x - Sin Internet)
                                         ▼
+-----------------------------------------------------------------------------------+
|            COMPUTADOR INDUSTRIAL (IPC) — BIOAZÚCAR EDGE DAEMON                    |
|                                                                                   |
|  ┌───────────────────┐    ┌────────────────────┐    ┌──────────────────────────┐  |
|  │ Conectores Campo  │───>│ Compresor SDT      │───>│ Store & Forward          │  |
|  │ OPC-UA/Modbus/EROS│    │ (Dev 0.25%, Min 1s)│    │ Journal Disco Cifrado    │  |
|  └───────────────────┘    └────────────────────┘    │ AES-256-GCM (0600)       │  |
|                                                     └────────────┬─────────────┘  |
|  ┌───────────────────┐    ┌────────────────────┐                 │                |
|  │ Watchdog HTTP     │    │ Quality Gate OT    │                 ▼                |
|  │ Puerto 9099       │    │ Linaje y Auditoría │    ┌──────────────────────────┐  |
|  └───────────────────┘    └────────────────────┘    │ Uploader HTTPS/mTLS      │  |
|                                                     │ Firma HMAC-SHA256        │  |
|                                                     │ Anti-Replay Guard 300s   │  |
|                                                     └────────────┬─────────────┘  |
+------------------------------------------------------------------│----------------+
                                         │  (NIC eth1: 10.0.0.x - DMZ / Outbound)
                                         ▼
+-----------------------------------------------------------------------------------+
|                        NUBE / SERVIDOR CENTRAL (ISA-95 Nivel 4)                   |
|                        Endpoint: /api/edge/telemetry-sync                         |
|                     BioAzúcar Cloud Engine + TSDB Historiador                     |
+-----------------------------------------------------------------------------------+
```

---

### 2. Seguridad de Datos y Transmisiones (IEC 62443-4-2 SL3)

El demonio implementa los principios de defensa en profundidad requeridos por la norma **IEC 62443**:

1. **Aislamiento Físico de Red (Dual-NIC)**:
   - **Interfaz OT (`eth0`)**: Conectada a la red privada de control (192.168.10.x). No tiene puerta de enlace predeterminada a Internet. Solo acepta tráfico local a puertos de instrumentación (502 Modbus, 4840 OPC-UA).
   - **Interfaz DMZ (`eth1`)**: Conectada a la red empresarial o enlace satelital con salida exclusiva hacia la nube (puerto 443 HTTPS o 8883 MQTT).
   - **Prohibición de Forwarding**: El IPC tiene el reenvío de paquetes desactivado a nivel de kernel (`net.ipv4.ip_forward = 0`).

2. **Autenticación Criptográfica de Mensajes (HMAC-SHA256)**:
   - Cada lote de telemetría transmitido es firmado con una clave simétrica compartida (`BIOAZUCAR_EDGE_SECRET`).
   - La firma se calcula sobre la tupla `NodeID : TimestampISO : JSON_Payload`.
   - El servidor verifica la firma antes de procesar el lote; cualquier alteración de un bit en tránsito produce un rechazo inmediato (HTTP 403 `HMAC_INVALID`).

3. **Protección Anti-Repetición (Anti-Replay Window)**:
   - El encabezado `x-bioazucar-edge-timestamp` tiene una ventana estricta de validez de ±300 segundos. Mensajes capturados por atacantes en tránsito y retransmitidos más tarde son descartados (HTTP 401 `REPLAY_REJECTED`).

4. **Cifrado en Tránsito (mTLS / TLS 1.3)**:
   - La comunicación hacia la nube se realiza sobre HTTPS con TLS 1.3. Opcionalmente, se pueden habilitar certificados de cliente para autenticación mutua (mTLS) entre el IPC y el balanceador de carga.

5. **Cifrado en Reposo para Store & Forward (Data-at-Rest)**:
   - Los puntos de telemetría que no han podido enviarse por caídas de conectividad se escriben en el archivo diario en disco (`/var/lib/bioazucar-edge/saf-journal.json`).
   - Si se configura `BIOAZUCAR_DISK_ENCRYPTION_KEY`, el archivo se almacena cifrado con **AES-256-GCM** y permisos de sistema de archivos `0600`, impidiendo la extracción de datos en caso de robo o acceso físico no autorizado al equipo.

---

### 3. Opciones de Despliegue

#### Opción A: Servicio Nativo Linux (systemd) — **Recomendado para IPCs**

Es el método preferido para equipos dedicados (Advantech UNO, Siemens Simatic Microbox, Kontron, etc.).

1. **Ejecutar el script de despliegue automatizado**:
   ```bash
   sudo bash deploy/deploy-edge.sh
   ```

2. **Personalizar la configuración**:
   Edite el archivo `/etc/bioazucar/edge.env`:
   ```bash
   sudo nano /etc/bioazucar/edge.env
   ```
   Configure las variables del ingenio:
   - `BIOAZUCAR_TENANT_ID`: ID del ingenio (ej. `TENANT_AZUCAR_01`).
   - `BIOAZUCAR_EDGE_ID`: Identificador del nodo (ej. `edge-node-tandem-1`).
   - `BIOAZUCAR_CLOUD_URL`: URL del endpoint de sincronización central.
   - `BIOAZUCAR_EDGE_SECRET`: Clave secreta HMAC compartida con el servidor.

3. **Reiniciar y verificar el servicio**:
   ```bash
   sudo systemctl restart bioazucar-edge
   sudo systemctl status bioazucar-edge
   ```

4. **Monitoreo de logs en tiempo real**:
   ```bash
   journalctl -u bioazucar-edge -f
   ```

---

#### Opción B: Despliegue con Docker / Docker Compose

Ideal para flotas gestionadas con Kubernetes ligero (k3s), Portainer o BalenaOS.

1. **Construir la imagen de contenedor**:
   ```bash
   docker build -t bioazucar/edge-daemon:latest -f Dockerfile.edge .
   ```

2. **Iniciar con Docker Compose**:
   ```bash
   docker compose -f deploy/docker-compose.edge.yml up -d
   ```

3. **Verificar estado del contenedor**:
   ```bash
   docker ps -f name=bioazucar-edge-node
   docker logs -f bioazucar-edge-node
   ```

---

#### Opción C: Ejecución Manual en Entornos de Prueba

Para validaciones durante comisionamiento FAT/SAT en banco de pruebas:

```bash
export BIOAZUCAR_TENANT_ID="TENANT_AZUCAR_01"
export BIOAZUCAR_EDGE_ID="edge-test-bench"
export BIOAZUCAR_CLOUD_URL="http://localhost:3000/api/edge/telemetry-sync"
export BIOAZUCAR_EDGE_SECRET="bioazucar_industrial_edge_super_secret_key"
export BIOAZUCAR_SYNC_INTERVAL_MS="1000"

npx tsx src/services/edge/daemon.ts
```

---

### 4. Verificación de Salud y Watchdog Local

El demonio expone un servidor HTTP local en el puerto `9099` (`http://127.0.0.1:9099/health`) para ser consumido por herramientas de monitoreo locales:

**Ejemplo de consulta**:
```bash
curl -s http://127.0.0.1:9099/health | jq .
```

**Respuesta típica**:
```json
{
  "status": "HEALTHY",
  "edgeId": "edge-node-tandem-1",
  "tenantId": "TENANT_AZUCAR_01",
  "uptimeSeconds": 3840,
  "consecutiveErrors": 0,
  "totalTransmittedPoints": 184500,
  "totalTransmittedBatches": 1845,
  "lastSuccessfulSync": "2026-09-09T19:15:30.124Z",
  "lastErrorReason": null,
  "bufferState": {
    "bufferedCount": 0,
    "maxCapacity": 50000,
    "cloudConnected": true,
    "totalIngested": 184500,
    "totalAcknowledged": 184500,
    "totalDropped": 0
  },
  "securityStandard": "IEC-62443-4-2 SL3"
}
```

---

### 5. Prueba de Resiliencia ante Pérdida de Conectividad (Store & Forward)

Para verificar que no se pierden datos durante caídas de telecomunicaciones:

1. **Simular corte de enlace** (desconectar interfaz o bloquear IP de nube):
   ```bash
   sudo iptables -A OUTPUT -p tcp --dport 443 -j DROP
   ```
2. **Observar en los logs del demonio**:
   El estado cambiará a `DEGRADED`, los puntos se acumulan en el buffer `bufferedCount` y se escriben en `/var/lib/bioazucar-edge/saf-journal.json`.
3. **Restablecer la conectividad**:
   ```bash
   sudo iptables -D OUTPUT -p tcp --dport 443 -j DROP
   ```
4. **Verificación de entrega**:
   El demonio drenará automáticamente los lotes pendientes en orden cronológico estricto sin pérdida de secuencias (`totalAcknowledged` se iguala con `totalIngested`).
