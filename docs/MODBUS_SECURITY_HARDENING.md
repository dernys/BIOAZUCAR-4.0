# Guía de Ciberseguridad para Modbus en Redes Industriales
## BioAzúcar 4.0 — Modbus Hardening & Modbus TCP Security (IEC 62443 / Port 802)

---

### 1. Diagnóstico del Riesgo en Redes de Centrales Azucareros

El protocolo estándar **Modbus TCP** (puerto 502) fue diseñado originalmente sin autenticación, sin control de integridad y sin cifrado de carga útil (texto plano). En plantas industriales, si la red de control no está segmentada de forma estricta:
1. **Sniffing / Eavesdropping**: Un atacante en la red puede capturar lecturas de básculas de caña, presiones de calderas o posiciones de cuchillas.
2. **Inyección de Comandos / Man-in-the-Middle (MitM)**: Un actor malicioso puede inyectar tramas Modbus falsas modificando valores de registros de proceso o consignas de velocidad de motores hidráulicos.

---

### 2. Mitigación Inmediata: Arquitectura de Segmentación VLAN OT (Fase 1)

Para proteger los dispositivos de campo actuales que no soportan cifrado nativo:

```
+-------------------------------------------------------------------------------+
|                       ZONA OT BÁSCULAS E INSTRUMENTACIÓN                      |
|                                                                               |
|   [Báscula Caña]          [Transmisor Bagazo]          [PLC Turbina]          |
|    192.168.20.10             192.168.20.11             192.168.20.12          |
|         │                         │                          │                |
+---------│-------------------------│--------------------------│----------------+
          ▼                         ▼                          ▼
+───────────────────────────────────────────────────────────────────────────────+
|               SWITCH INDUSTRIAL ADMINISTRABLE (Moxa / Cisco IE)               |
|                                                                               |
|   VLAN 20 (Instrumentación Modbus TCP) — Aislada, sin salida a Internet       |
|   - Puerto 502 restringido exclusivamente a la MAC del Edge IPC               |
|   - Bloqueo de tráfico broadcast/multicast no esencial                        |
+───────────────────────────────────────┬───────────────────────────────────────+
                                        │ (Puerto de acceso VLAN 20)
                                        ▼
+───────────────────────────────────────────────────────────────────────────────+
|               BIOAZÚCAR INDUSTRIAL EDGE GATEWAY (Dual-NIC)                    |
|                                                                               |
|   Interfaz OT eth0.20: 192.168.20.1 (Sin Default Gateway, Solo Modbus 502/802)|
|   Interfaz DMZ eth1:   10.0.0.50 (Salida HTTPS/TLS 1.3 a BioAzúcar Cloud)    |
|   - IP Forwarding = 0 (Prohibido el puenteo entre redes)                      |
+───────────────────────────────────────────────────────────────────────────────+
```

#### Reglas de Firewall (iptables / ufw) en el Gateway de Borde
```bash
# 1. Prohibir reenvío de paquetes
sudo sysctl -w net.ipv4.ip_forward=0

# 2. Permitir solo conexiones salientes a los PLCs específicos en el puerto 502
sudo iptables -A OUTPUT -o eth0 -p tcp -d 192.168.20.0/24 --dport 502 -j ACCEPT
sudo iptables -A INPUT -i eth0 -p tcp -s 192.168.20.0/24 --sport 502 -m state --state ESTABLISHED -j ACCEPT

# 3. Denegar cualquier otro tráfico entrante en la interfaz de campo eth0
sudo iptables -A INPUT -i eth0 -j DROP
```

---

### 3. Solución Definitiva: Modbus TCP Security (MBAP sobre TLS — Puerto 802)

**BioAzúcar 4.0** soporta la especificación oficial **Modbus TCP Security (Modbus.org / MBAP over TLS)**:

- **Puerto Estándar**: `802` TCP (registrado ante IANA para Modbus Security).
- **Cifrado en Tránsito**: TLS 1.3 con suites criptográficas robustas (ECDHE-ECDSA-AES256-GCM-SHA384).
- **Autenticación Mutua (mTLS)**: El conector de borde valida el certificado X.509 de la pasarela de campo y presenta su propio certificado emitido por la CA privada del ingenio.

#### Configuración en `ModbusConnector`:
```typescript
const connector = new ModbusConnector({
  id: "modbus-milling-tandem",
  name: "Gateway Básculas y Molinos",
  mode: "TCP",
  host: "192.168.20.10",
  port: 802, // Puerto de seguridad Modbus
  timeoutMs: 1500,
  maxRetries: 3,
  pollIntervalMs: 1000,
  security: {
    enabled: true,
    tlsMode: "MODBUS_SECURITY_TLS",
    tlsPort: 802,
    caCertPath: "/etc/bioazucar/certs/plant-ca.crt",
    clientCertPath: "/etc/bioazucar/certs/edge-modbus.crt",
    clientKeyPath: "/etc/bioazucar/certs/edge-modbus.key",
    rejectUnauthorized: true,
  },
});
```

Para transmisores antiguos sin soporte nativo de TLS 802, se recomienda interponer un dispositivo **stunnel** de riel DIN (Moxa ioThinx o Phoenix Contact FL MGUARD) como terminador seguro de túnel.
