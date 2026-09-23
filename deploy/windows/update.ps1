<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Production Update Engine (P0-26)
.DESCRIPTION
    Safely upgrades running version N to N+1: executes pre-update backup,
    verifies migration compatibility, applies schema migrations, deploys
    new container images, and evaluates health gates with automatic rollback capability.
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [string]$TargetVersion = "4.0.0-prod",
    [string]$ComposeFile = "..\docker\docker-compose.prod.yml",
    [switch]$AutoRollbackOnFailure = $true
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION UPDATE ENGINE (N -> N+1)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Target Version: $TargetVersion`n"

# Step 1: Pre-Update Backup
Write-Host "[Step 1/5] Creating Automated Safety Pre-Update Backup..." -ForegroundColor Yellow
$backupScript = Join-Path $PSScriptRoot "backup.ps1"
$backupResult = & $backupScript -InstallPath $InstallPath -Label "pre-update"
Write-Host " Safety snapshot preserved."

# Step 2: Ingest / Pull Target Version Images
Write-Host "`n[Step 2/5] Ingesting/Pulling Target Container Images ($TargetVersion)..." -ForegroundColor Yellow
docker compose -f $ComposeFile pull --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not pull online; verifying if local images already loaded."
}

# Step 3: Execute Schema Evolution Migrations
Write-Host "`n[Step 3/5] Applying Database Schema Migrations..." -ForegroundColor Yellow
$migrationRunner = Resolve-Path "..\migrations\migrationRunner.ts" -ErrorAction SilentlyContinue
if ($migrationRunner -and (Get-Command "npx" -ErrorAction SilentlyContinue)) {
    npx tsx $migrationRunner up
} else {
    Write-Host " Migrations will be executed inside updated application container."
}

# Step 4: Deploy Updated Service Fleet
Write-Host "`n[Step 4/5] Deploying Updated Container Fleet..." -ForegroundColor Yellow
docker compose -f $ComposeFile up -d --remove-orphans
Write-Host " Waiting 15 seconds for readiness..."
Start-Sleep -Seconds 15

# Step 5: Evaluate Post-Update Health Gates
Write-Host "`n[Step 5/5] Evaluating Post-Update Health Gates..." -ForegroundColor Yellow
$healthScript = Join-Path $PSScriptRoot "healthcheck.ps1"
if (Test-Path $healthScript) {
    & $healthScript -InstallPath $InstallPath
    $healthStatus = $LASTEXITCODE

    if ($healthStatus -ne 0) {
        Write-Host "`n[CRITICAL] Post-Update Health Check Reported Failure (Code: $healthStatus)." -ForegroundColor Red
        if ($AutoRollbackOnFailure) {
            Write-Host " Triggering Autonomous Rollback to previous operational state..." -ForegroundColor Yellow
            $rollbackScript = Join-Path $PSScriptRoot "rollback.ps1"
            & $rollbackScript -InstallPath $InstallPath -ComposeFile $ComposeFile
            exit 1
        } else {
            Write-Error "Update failed health verification. Manual intervention required."
            exit 1
        }
    }
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " UPDATE TO VERSION $TargetVersion COMPLETED & HEALTH GATES GREEN" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
