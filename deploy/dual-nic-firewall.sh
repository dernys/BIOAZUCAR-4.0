#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — DUAL-NIC FIREWALL SCRIPT (IEC 62443-3-3 FR5 CONDUIT ENFORCEMENT)
# ==============================================================================
# Target: Linux Edge Industrial PC (Debian, Ubuntu Server, Alpine)
# Usage: sudo bash deploy/dual-nic-firewall.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}   BIOAZÚCAR 4.0 — DUAL-NIC HARDENING & FIREWALL (IEC 62443 FR5)  ${NC}"
echo -e "${CYAN}=================================================================${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Este script debe ejecutarse con privilegios de root (sudo).${NC}"
   exit 1
fi

# 1. Flush existing rules
echo -e "${YELLOW}[CONFIG] Limpiando tablas iptables existentes...${NC}"
iptables -F
iptables -X
iptables -t nat -F || true
iptables -t mangle -F || true

# 2. Set strict default policies
echo -e "${YELLOW}[SECURITY] Aplicando políticas estrictas (INPUT DROP, FORWARD DROP)...${NC}"
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 3. Allow Loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 4. State tracking: allow established and related
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 5. Drop invalid packets
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP
iptables -A FORWARD -m conntrack --ctstate INVALID -j DROP

# 6. Industrial OT Interface (eth0: 192.168.10.0/24)
echo -e "${YELLOW}[FIREWALL] Configurando conductos industriales para eth0 (Planta OT)...${NC}"
# Modbus RTU/TCP (Port 502) & Modbus Security (Port 802)
iptables -A INPUT -i eth0 -p tcp --dport 502 -s 192.168.10.0/24 -j ACCEPT
iptables -A INPUT -i eth0 -p tcp --dport 802 -s 192.168.10.0/24 -j ACCEPT
# OPC UA Binary Protocol (Port 4840)
iptables -A INPUT -i eth0 -p tcp --dport 4840 -s 192.168.10.0/24 -j ACCEPT
# Siemens S7 ISO-on-TCP RFC 1006 (Port 102)
iptables -A INPUT -i eth0 -p tcp --dport 102 -s 192.168.10.0/24 -j ACCEPT
# Allen-Bradley EtherNet/IP CIP (TCP 44818, UDP 2222)
iptables -A INPUT -i eth0 -p tcp --dport 44818 -s 192.168.10.0/24 -j ACCEPT
iptables -A INPUT -i eth0 -p udp --dport 2222 -s 192.168.10.0/24 -j ACCEPT

# Log & Drop unauthorized OT traffic
iptables -A INPUT -i eth0 -m limit --limit 5/min -j LOG --log-prefix "BIOAZUCAR_OT_DROP: " --log-level 7
iptables -A INPUT -i eth0 -j DROP

# 7. DMZ Interface (eth1: 10.0.50.0/24)
echo -e "${YELLOW}[FIREWALL] Configurando conductos DMZ para eth1 (Supervisión IT/Cloud)...${NC}"
# Local health check
iptables -A INPUT -i eth1 -p tcp --dport 9099 -s 10.0.50.0/24 -j ACCEPT

# 8. Enforce Kernel IP Forwarding Disablement
echo -e "${YELLOW}[KERNEL] Deshabilitando enrutamiento entre interfaces (net.ipv4.ip_forward = 0)...${NC}"
cat << 'EOF' > /etc/sysctl.d/99-bioazucar-ot-forwarding.conf
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
EOF

sysctl -p /etc/sysctl.d/99-bioazucar-ot-forwarding.conf

# 9. Verify
FORWARD_STATUS=$(sysctl -n net.ipv4.ip_forward)
if [[ "${FORWARD_STATUS}" == "0" ]]; then
    echo -e "${GREEN}[OK] net.ipv4.ip_forward = 0 (Verificado). No hay puenteo L3 entre OT y DMZ.${NC}"
else
    echo -e "${RED}[FAIL] Falló el endurecimiento de ip_forward.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Reglas de firewall Dual-NIC aplicadas exitosamente.${NC}"
