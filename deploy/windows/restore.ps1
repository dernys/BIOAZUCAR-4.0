<#
.SYNOPSIS
    BioAzúcar 4.0 — Production Restore Engine (P0-26)
.DESCRIPTION
    Restores platform state from a verified backup archive, verifying SHA-256
    integrity, stopping services, restoring databases/config, and running health checks.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,
    [string]$InstallPath = "C:\BioAzucar",
    [string]$ComposeFile = "..\docker\docker-compose.prod.yml",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION RESTORE ENGINE" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Source Backup: $BackupPath"
Write-Host "Target System: $InstallPath`n"

# Step 1: Validate Backup & Check Manifest
Write-Host "[1/5] Validating backup integrity and manifest..." -ForegroundColor Yellow
$manifestPath = Join-Path $BackupPath "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Error "Backup manifest missing at: $manifestPath. Restore aborted."
    exit 1
}

$manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
Write-Host " Manifest detected for: $($manifest.product) v$($manifest.version) (Backup ID: $($manifest.backupId))"

# Step 2: Verify Checksums
Write-Host "[2/5] Verifying SHA-256 integrity of backed up files..." -ForegroundColor Yellow
foreach ($fileEntry in $manifest.files) {
    $fullPath = Join-Path $BackupPath $fileEntry.relativePath.Replace("/", "\")
    if (-not (Test-Path $fullPath)) {
        Write-Error "CRITICAL INTEGRITY FAILURE: Missing file in backup: $($fileEntry.relativePath)"
        exit 1
    }
    $actualHash = (Get-FileHash -Path $fullPath -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -ne $fileEntry.sha256.ToLower()) {
        Write-Error "CRITICAL INTEGRITY FAILURE: Hash mismatch on $($fileEntry.relativePath). Expected: $($fileEntry.sha256), Got: $actualHash"
        exit 1
    }
}
Write-Host " All $($manifest.files.Count) files verified authentic." -ForegroundColor Green

# Step 3: Gracefully Stop Production Containers
Write-Host "`n[3/5] Stopping active containers..." -ForegroundColor Yellow
docker compose -f $ComposeFile down
Write-Host " Services stopped."

# Step 4: Restore Data and Configuration
Write-Host "`n[4/5] Restoring databases and system configurations..." -ForegroundColor Yellow
$srcData = Join-Path $BackupPath "data"
if (Test-Path $srcData) {
    $targetData = Join-Path $InstallPath "data"
    Copy-Item -Path "$srcData\*" -Destination $targetData -Recurse -Force
    Write-Host " Restored database files to $targetData"
}

$srcConfig = Join-Path $BackupPath "config"
if (Test-Path $srcConfig) {
    $targetConfig = Join-Path $InstallPath "config"
    Copy-Item -Path "$srcConfig\*" -Destination $targetConfig -Recurse -Force
    Write-Host " Restored configuration files."
}

$srcEnv = Join-Path $BackupPath ".env"
if (Test-Path $srcEnv) {
    $targetEnv = Join-Path $InstallPath "docker\.env"
    Copy-Item -Path $srcEnv -Destination $targetEnv -Force
    Write-Host " Restored environment variables."
}

# Step 5: Restart Platform & Verify Health
Write-Host "`n[5/5] Restarting production services and evaluating health gates..." -ForegroundColor Yellow
docker compose -f $ComposeFile up -d
Start-Sleep -Seconds 15

$healthScript = Join-Path $PSScriptRoot "healthcheck.ps1"
if (Test-Path $healthScript) {
    & $healthScript -InstallPath $InstallPath
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " RESTORE PROCEDURE COMPLETED FOR $($manifest.backupId)" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
