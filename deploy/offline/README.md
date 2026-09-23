# BIOAZÚCAR 4.0 — AIR-GAPPED & OFFLINE DEPLOYMENT BUNDLE

Este paquete contiene todos los artefactos de software, imágenes de contenedor Docker, configuraciones de seguridad y esquemas de base de datos necesarios para instalar BioAzúcar 4.0 en centrales azucareros y redes industriales OT aisladas sin acceso a Internet.

## Contenido del Paquete

1. **`manifest.json`**: Metadatos criptográficos, versión de esquema (`003`), versión de Edge (`4.0.0-edge`) y lista de imágenes.
2. **`checksums.txt`**: Huellas digitales SHA-256 de cada archivo en el paquete.
3. **`images/`**: Archivos `.tar` con las imágenes de contenedor (`bioazucar/platform:4.0.0-prod`, `bioazucar/edge-daemon:4.0.0-edge`, `eclipse-mosquitto:2.0.18`, `prom/prometheus:v2.51.0`).
4. **`deploy/windows/`**: Scripts PowerShell de instalación, prechequeo, respaldo, actualización y reversión.
5. **`deploy/docker/`**: Definiciones de `docker-compose.prod.yml` y plantilla de entorno `.env.example`.
6. **`deploy/migrations/`**: Scripts SQL de migración y evolución de esquema transaccional.

## Procedimiento de Instalación Offline en Windows Server

1. Copie este directorio a una unidad local del servidor (ej. `C:\BioAzucar\deploy`).
2. Abra PowerShell como Administrador.
3. Ejecute la verificación de integridad y prechequeo:
   ```powershell
   cd C:\BioAzucar\deploy\windows
   .\preflight.ps1
   ```
4. Si el prechequeo devuelve `PASS`, ejecute la instalación completa:
   ```powershell
   .\install.ps1 -Offline -BundlePath "C:\BioAzucar\deploy\offline"
   ```
5. Verifique el estado del sistema:
   ```powershell
   .\healthcheck.ps1
   ```
