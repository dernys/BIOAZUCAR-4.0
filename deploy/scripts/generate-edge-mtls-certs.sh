#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — INDUSTRIAL mTLS CERTIFICATE GENERATOR (IEC 62443-4-2 SL3)
# ==============================================================================
# Generates Root Plant CA, Server Certificate, and Edge IPC Client Certificate
# with strict Subject Alternative Names (SAN) and 4096-bit RSA keys.
# ==============================================================================

set -euo pipefail

CERT_DIR="${1:-/etc/bioazucar/certs}"
DAYS_VALID=730 # 2 years

echo "==> Creating Certificate Directory at: ${CERT_DIR}"
mkdir -p "${CERT_DIR}"
chmod 700 "${CERT_DIR}"

# 1. Root Plant CA
echo "==> [1/3] Generating Plant Root CA (BioAzúcar Industrial Trust Root)..."
openssl genrsa -out "${CERT_DIR}/ca.key" 4096
chmod 600 "${CERT_DIR}/ca.key"

openssl req -x509 -new -nodes \
  -key "${CERT_DIR}/ca.key" \
  -sha256 -days "${DAYS_VALID}" \
  -out "${CERT_DIR}/plant-ca.crt" \
  -subj "/C=CU/ST=Habana/O=BioAzucar 4.0/OU=Industrial Cybersecurity/CN=BioAzucar-Root-CA"

chmod 644 "${CERT_DIR}/plant-ca.crt"

# 2. Server Certificate (Cloud/Gateway endpoint)
echo "==> [2/3] Generating Cloud Gateway Server Certificate..."
openssl genrsa -out "${CERT_DIR}/server.key" 4096
chmod 600 "${CERT_DIR}/server.key"

cat <<EOF > "${CERT_DIR}/server_san.cnf"
[req]
default_bits = 4096
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
C = CU
ST = Habana
O = BioAzucar 4.0
OU = Cloud Gateway
CN = api.bioazucar40.com

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = api.bioazucar40.com
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

openssl req -new -key "${CERT_DIR}/server.key" -out "${CERT_DIR}/server.csr" -config "${CERT_DIR}/server_san.cnf"
openssl x509 -req -in "${CERT_DIR}/server.csr" \
  -CA "${CERT_DIR}/plant-ca.crt" -CAkey "${CERT_DIR}/ca.key" -CAcreateserial \
  -out "${CERT_DIR}/server.crt" -days "${DAYS_VALID}" -sha256 \
  -extfile "${CERT_DIR}/server_san.cnf" -extensions req_ext

chmod 644 "${CERT_DIR}/server.crt"

# 3. Edge IPC Client Certificate (Mutual TLS Client Authentication)
echo "==> [3/3] Generating Edge IPC Node Client Certificate..."
openssl genrsa -out "${CERT_DIR}/edge-client.key" 4096
chmod 600 "${CERT_DIR}/edge-client.key"

cat <<EOF > "${CERT_DIR}/client_san.cnf"
[req]
default_bits = 4096
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
C = CU
ST = Villa Clara
O = BioAzucar 4.0
OU = Edge Computing
CN = edge-node-tandem-1

[req_ext]
subjectAltName = @alt_names
extendedKeyUsage = clientAuth

[alt_names]
DNS.1 = edge-node-tandem-1.local
IP.1 = 192.168.10.45
EOF

openssl req -new -key "${CERT_DIR}/edge-client.key" -out "${CERT_DIR}/edge-client.csr" -config "${CERT_DIR}/client_san.cnf"
openssl x509 -req -in "${CERT_DIR}/edge-client.csr" \
  -CA "${CERT_DIR}/plant-ca.crt" -CAkey "${CERT_DIR}/ca.key" -CAcreateserial \
  -out "${CERT_DIR}/edge-client.crt" -days "${DAYS_VALID}" -sha256 \
  -extfile "${CERT_DIR}/client_san.cnf" -extensions req_ext

chmod 644 "${CERT_DIR}/edge-client.crt"

# Cleanup CSRs and configs
rm -f "${CERT_DIR}"/*.csr "${CERT_DIR}"/*.cnf

echo "==> SUCCESS! Industrial mTLS certificates generated in ${CERT_DIR}:"
ls -la "${CERT_DIR}"
