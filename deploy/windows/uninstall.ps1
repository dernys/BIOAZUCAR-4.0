<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Production Uninstaller (P0-26)
.DESCRIPTION
    Safely tears down the BioAzúcar 4.0 Docker orchestration fleet.
    Preserves persistent database and backup volumes by default unless -PurgeData is supplied.
#>

[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [string]$ComposeFile = "..\docker\docker-compose.prod.yml",
    [switch]$PurgeData
)

$ErrorActionPreference = "Continue"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION UNINSTALLER" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Step 1: Halting Containers
Write-Host "[1/3] Stopping and removing container instances..." -ForegroundColor Yellow
if ($PurgeData) {
    Write-Warning "PurgeData enabled: Persistent Docker volumes will be removed."
    docker compose -f $ComposeFile down -v --remove-orphans
} else {
    Write-Host "Preserving persistent data volumes."
    docker compose -f $ComposeFile down --remove-orphans
}

# Step 2: Archive check
if (Test-Path (Join-Path $InstallPath "backup")) {
    Write-Host "[2/3] Historical backups preserved in $(Join-Path $InstallPath 'backup')." -ForegroundColor Green
}

# Step 3: Cleanup
Write-Host "[3/3] Platform stopped." -ForegroundColor Green
Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " UNINSTALL COMPLETED" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
