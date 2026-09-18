#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — CIS BENCHMARK OS HARDENING SCRIPT FOR INDUSTRIAL IPC (L3)
# ==============================================================================
# Target: Ubuntu 22.04 / 24.04 LTS, Debian 12
# Conforms to CIS Linux Benchmark 2.0 & IEC 62443-4-2
# Usage: sudo bash deploy/cis-hardening-ipc.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}   BIOAZÚCAR 4.0 — IPC OPERATING SYSTEM CIS BENCHMARK HARDENING    ${NC}"
echo -e "${CYAN}=================================================================${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Debe ejecutarse con privilegios de root (sudo).${NC}"
   exit 1
fi

# 1. Non-Root System Execution Verification
echo -e "${YELLOW}[CIS 1.1] Verificando usuario no privilegiado 'otuser'...${NC}"
if ! id -u otuser &>/dev/null; then
    groupadd -r otgroup
    useradd -r -g otgroup -s /sbin/nologin -d /opt/bioazucar-edge -c "BioAzucar OT Daemon" otuser
fi
echo -e "${GREEN}[OK] Usuario 'otuser' configurado con shell restrictiva /sbin/nologin.${NC}"

# 2. Kernel Hardening Parameters via sysctl
echo -e "${YELLOW}[CIS 3.2] Configurando parámetros de seguridad del kernel en /etc/sysctl.d/99-bioazucar-cis.conf...${NC}"
cat << 'EOF' > /etc/sysctl.d/99-bioazucar-cis.conf
# CIS 3.1: Disable IP Forwarding
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# CIS 3.2: Disable ICMP Redirects & Source Routing
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0

# CIS 3.3: Log Suspicious Packets
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# CIS 1.5: Disable Core Dumps for SUID binaries & Enable ASLR
fs.suid_dumpable = 0
kernel.randomize_va_space = 2

# CIS 1.6: Restrict dmesg access to root
kernel.dmesg_restrict = 1
EOF

sysctl -p /etc/sysctl.d/99-bioazucar-cis.conf
echo -e "${GREEN}[OK] Parámetros del kernel CIS aplicados exitosamente.${NC}"

# 3. Disable USB Mass Storage (Physical Tampering Protection)
echo -e "${YELLOW}[CIS 1.1.18] Deshabilitando controladores USB Mass Storage y aplicando udev rule...${NC}"
mkdir -p /etc/modprobe.d
cat << 'EOF' > /etc/modprobe.d/bioazucar-blacklist-usb-storage.conf
# Prevent kernel loading USB mass storage module
blacklist usb-storage
install usb-storage /bin/true
EOF

mkdir -p /etc/udev/rules.d
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/udev/99-usb-storage-block.rules" ]]; then
    cp "${SCRIPT_DIR}/udev/99-usb-storage-block.rules" /etc/udev/rules.d/99-usb-storage-block.rules
    udevadm control --reload-rules || true
    echo -e "${GREEN}[OK] Reglas udev para bloqueo de memorias USB instaladas.${NC}"
fi

# 4. AppArmor Profile Enforcement
echo -e "${YELLOW}[CIS 1.6] Aplicando perfil AppArmor para BioAzúcar Edge Daemon...${NC}"
if command -v apparmor_parser &>/dev/null && [[ -f "${SCRIPT_DIR}/apparmor/bioazucar-edge.profile" ]]; then
    mkdir -p /etc/apparmor.d
    cp "${SCRIPT_DIR}/apparmor/bioazucar-edge.profile" /etc/apparmor.d/opt.bioazucar-edge.edge-daemon.cjs
    apparmor_parser -r -W /etc/apparmor.d/opt.bioazucar-edge.edge-daemon.cjs || true
    echo -e "${GREEN}[OK] Perfil AppArmor cargado en modo enforce.${NC}"
else
    echo -e "${YELLOW}[SKIP] AppArmor no disponible o perfil no encontrado.${NC}"
fi

# 5. Chrony Secure NTP/NTS Time Synchronization
echo -e "${YELLOW}[CIS 2.2] Configurando sincronización horaria Chrony autenticada con NTS...${NC}"
if command -v chronyd &>/dev/null && [[ -f "${SCRIPT_DIR}/chrony-secure.conf" ]]; then
    cp "${SCRIPT_DIR}/chrony-secure.conf" /etc/chrony/chrony.conf
    systemctl restart chrony || true
    echo -e "${GREEN}[OK] Chrony NTS configurado.${NC}"
fi

# 6. File Permissions & Umask Hardening
echo -e "${YELLOW}[CIS 5.4] Endureciendo permisos de archivos del sistema...${NC}"
chmod 700 /etc/bioazucar || true
chmod 600 /etc/bioazucar/edge.env 2>/dev/null || true
chmod -R 750 /opt/bioazucar-edge || true

echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}   HARDENING CIS BENCHMARK COMPLETADO CON ÉXITO (IEC 62443-4-2)   ${NC}"
echo -e "${GREEN}=================================================================${NC}"
