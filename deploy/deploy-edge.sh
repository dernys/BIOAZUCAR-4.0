#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — INDUSTRIAL EDGE DAEMON INSTALLATION & DEPLOYMENT SCRIPT
# ==============================================================================
# Target: Ubuntu 22.04 / 24.04 LTS, Debian 12, Alpine Linux, RHEL 9
# Run with root/sudo privileges: sudo bash deploy/deploy-edge.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}   BIOAZÚCAR 4.0 — INDUSTRIAL EDGE DAEMON DEPLOYMENT (IEC 62443)  ${NC}"
echo -e "${CYAN}=================================================================${NC}"

# 1. Check Root Privileges
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Este script debe ejecutarse con privilegios de root (sudo).${NC}"
   exit 1
fi

# 2. Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[INFO] Node.js no detectado. Instalando Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs build-essential
fi

NODE_VER=$(node -v)
echo -e "${GREEN}[OK] Node.js version:${NC} ${NODE_VER}"

# 3. Create Dedicated Non-Root OT User
if ! id -u otuser &>/dev/null; then
    echo -e "${YELLOW}[CONFIG] Creando usuario y grupo de sistema 'otuser' (IEC 62443 Least Privilege)...${NC}"
    groupadd -r otgroup || true
    useradd -r -g otgroup -s /sbin/nologin -d /opt/bioazucar-edge -c "BioAzucar OT Daemon" otuser || true
else
    echo -e "${GREEN}[OK] Usuario 'otuser' existente.${NC}"
fi

# 4. Create Standard Directories
echo -e "${YELLOW}[CONFIG] Configurando directorios de ejecución y persistencia...${NC}"
mkdir -p /opt/bioazucar-edge
mkdir -p /etc/bioazucar
mkdir -p /var/lib/bioazucar-edge
mkdir -p /var/log/bioazucar

# 5. Compile / Bundle Standalone Daemon
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${YELLOW}[BUILD] Empaquetando binario autocontenido edge-daemon.cjs...${NC}"
cd "${PROJECT_ROOT}"
npx esbuild src/services/edge/daemon.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=/opt/bioazucar-edge/edge-daemon.cjs

# 6. Install Configuration if Not Present
if [[ ! -f /etc/bioazucar/edge.env ]]; then
    echo -e "${YELLOW}[CONFIG] Generando /etc/bioazucar/edge.env desde plantilla...${NC}"
    cp "${PROJECT_ROOT}/deploy/edge.env.example" /etc/bioazucar/edge.env
    
    # Auto-generate secure random HMAC key
    RANDOM_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/replace_with_a_secure_random_64_character_hex_secret_here/${RANDOM_SECRET}/g" /etc/bioazucar/edge.env
    echo -e "${GREEN}[OK] Clave HMAC-SHA256 aleatoria generada en /etc/bioazucar/edge.env${NC}"
else
    echo -e "${GREEN}[OK] Archivo /etc/bioazucar/edge.env ya existe. Preservando configuración.${NC}"
fi

# Set restrictive permissions (0600)
chmod 600 /etc/bioazucar/edge.env
chown otuser:otgroup /etc/bioazucar/edge.env

# 7. Fix Ownership
chown -R otuser:otgroup /opt/bioazucar-edge
chown -R otuser:otgroup /var/lib/bioazucar-edge
chown -R otuser:otgroup /var/log/bioazucar

# 8. Install Systemd Service
echo -e "${YELLOW}[SYSTEMD] Instalando servicio /etc/systemd/system/bioazucar-edge.service...${NC}"
cp "${PROJECT_ROOT}/deploy/bioazucar-edge.service" /etc/systemd/system/bioazucar-edge.service
systemctl daemon-reload
systemctl enable bioazucar-edge.service

# 9. Start / Restart Service
echo -e "${YELLOW}[SYSTEMD] Iniciando servicio bioazucar-edge...${NC}"
systemctl restart bioazucar-edge.service

# 10. Health Verification
sleep 2
if systemctl is-active --quiet bioazucar-edge.service; then
    echo -e "${GREEN}=================================================================${NC}"
    echo -e "${GREEN}   [ÉXITO] BIOAZÚCAR EDGE DAEMON EN EJECUCIÓN Y OPERATIVO       ${NC}"
    echo -e "${GREEN}=================================================================${NC}"
    echo -e "Estado del servicio: ${CYAN}systemctl status bioazucar-edge${NC}"
    echo -e "Monitoreo en vivo:   ${CYAN}journalctl -u bioazucar-edge -f${NC}"
    echo -e "Watchdog local HTTP: ${CYAN}curl http://127.0.0.1:9099/health${NC}"
    echo -e "Configuración:       ${CYAN}/etc/bioazucar/edge.env${NC}"
else
    echo -e "${RED}[ERROR] El servicio no pudo arrancar. Revise los logs con:${NC}"
    echo -e "${YELLOW}journalctl -u bioazucar-edge -n 50 --no-pager${NC}"
    exit 1
fi
