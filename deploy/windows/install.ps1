<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Production Installer (P0-26 Golden Path)
.DESCRIPTION
    Automates the installation of the BioAzúcar 4.0 Industrial SCADA/MES platform,
    supporting clean-server setup, Docker orchestration, database initialization,
    air-gapped/offline image loading, and health gate verification.
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [switch]$Offline,
    [string]$BundlePath = "..\offline",
    [string]$ComposeFile = "..\docker\docker-compose.prod.yml",
    [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION INSTALLER (WINDOWS SERVER)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Installation Target: $InstallPath"
Write-Host "Mode: $(if ($Offline) { 'OFFLINE (Air-Gapped)' } else { 'ONLINE / STANDARD' })`n"

# Step 1: Preflight Verification
if (-not $SkipPreflight) {
    Write-Host "[Step 1/7] Executing Preflight Verification..." -ForegroundColor Yellow
    $preflightScript = Join-Path $PSScriptRoot "preflight.ps1"
    if (Test-Path $preflightScript) {
        & $preflightScript -InstallPath $InstallPath
        if ($LASTEXITCODE -eq 1) {
            Write-Error "Preflight check failed. Installation aborted."
            exit 1
        }
    }
}

# Step 2: Directory Structure Creation
Write-Host "`n[Step 2/7] Initializing Directory Hierarchy..." -ForegroundColor Yellow
$dirs = @("data", "logs", "backup", "certificates", "config", "migrations", "docker")
foreach ($d in $dirs) {
    $targetDir = Join-Path $InstallPath $d
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host " Created: $targetDir"
    }
}

# Step 3: Offline Bundle Ingestion (If requested)
if ($Offline) {
    Write-Host "`n[Step 3/7] Ingesting Air-Gapped Deployment Bundle..." -ForegroundColor Yellow
    $resolvedBundle = Resolve-Path $BundlePath -ErrorAction Stop
    $manifestPath = Join-Path $resolvedBundle "manifest.json"
    
    if (-not (Test-Path $manifestPath)) {
        Write-Error "Offline manifest missing at: $manifestPath. Installation aborted."
        exit 1
    }
    
    Write-Host " Manifest detected. Loading container images..."
    $imagesDir = Join-Path $resolvedBundle "images"
    if (Test-Path $imagesDir) {
        $tarFiles = Get-ChildItem -Path $imagesDir -Filter "*.tar"
        foreach ($tar in $tarFiles) {
            Write-Host " Loading image: $($tar.Name)..."
            docker load -i $tar.FullName
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to load container image: $($tar.FullName)"
                exit 1
            }
        }
    }
} else {
    Write-Host "`n[Step 3/7] Pulling production container images from registry..." -ForegroundColor Yellow
    docker compose -f $ComposeFile pull --quiet
}

# Step 4: Environment & Configuration Setup
Write-Host "`n[Step 4/7] Generating Secure Configuration..." -ForegroundColor Yellow
$targetEnv = Join-Path $InstallPath "docker\.env"
if (-not (Test-Path $targetEnv)) {
    $templateEnv = Resolve-Path "..\docker\.env.example"
    Copy-Item -Path $templateEnv -Destination $targetEnv -Force
    Write-Host " Configured default production .env at $targetEnv"
}

# Step 5: Database Migrations (Schema initialization)
Write-Host "`n[Step 5/7] Executing Database Migrations..." -ForegroundColor Yellow
$migrationRunner = Resolve-Path "..\migrations\migrationRunner.ts" -ErrorAction SilentlyContinue
if ($migrationRunner -and (Get-Command "npx" -ErrorAction SilentlyContinue)) {
    Write-Host " Running migration runner..."
    npx tsx $migrationRunner up
} else {
    Write-Host " Migration will be executed inside application container on startup."
}

# Step 6: Launch Production Fleet
Write-Host "`n[Step 6/7] Starting Container Orchestration Fleet..." -ForegroundColor Yellow
docker compose -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker compose up failed to launch services."
    exit 1
}

Write-Host " Waiting 15 seconds for application warming and readiness probes..."
Start-Sleep -Seconds 15

# Step 7: Post-Installation Health Check
Write-Host "`n[Step 7/7] Validating Operational Health Gates..." -ForegroundColor Yellow
$healthScript = Join-Path $PSScriptRoot "healthcheck.ps1"
if (Test-Path $healthScript) {
    & $healthScript -InstallPath $InstallPath
    $healthCode = $LASTEXITCODE
    if ($healthCode -eq 1) {
        Write-Warning "Healthcheck reported FAILED. Inspect container logs with 'docker compose logs'."
    } elseif ($healthCode -eq 0) {
        Write-Host "`n======================================================================" -ForegroundColor Green
        Write-Host " BIOAZÚCAR 4.0 INSTALLED & OPERATIONAL — GOLDEN PATH COMPLETE" -ForegroundColor Green
        Write-Host " Access Web SCADA Portal at: http://localhost:3000" -ForegroundColor Green
        Write-Host "======================================================================" -ForegroundColor Green
    }
}
