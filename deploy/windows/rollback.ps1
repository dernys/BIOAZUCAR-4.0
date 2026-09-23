<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Production Rollback Engine (P0-26)
.DESCRIPTION
    Rolls back an update to the previous operational state, reverting container images,
    restoring pre-update database snapshots, and executing health checks.
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [string]$BackupDir = "C:\BioAzucar\backup",
    [string]$ComposeFile = "..\docker\docker-compose.prod.yml"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION ROLLBACK ENGINE" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Step 1: Discover Most Recent Pre-Update Backup
Write-Host "[1/4] Locating pre-update recovery snapshot..." -ForegroundColor Yellow
$backupCandidates = Get-ChildItem -Path $BackupDir -Directory -Filter "bioazucar-backup-pre-update-*" | Sort-Object CreationTime -Descending

if ($backupCandidates.Count -eq 0) {
    # Fallback to any latest backup
    $backupCandidates = Get-ChildItem -Path $BackupDir -Directory -Filter "bioazucar-backup-*" | Sort-Object CreationTime -Descending
}

if ($backupCandidates.Count -eq 0) {
    Write-Error "No valid backup snapshot found in $BackupDir to perform rollback."
    exit 1
}

$latestBackup = $backupCandidates[0]
Write-Host " Selected rollback target: $($latestBackup.FullName)"

# Step 2: Stop Faulted Fleet
Write-Host "`n[2/4] Halting faulted container instances..." -ForegroundColor Yellow
docker compose -f $ComposeFile down

# Step 3: Execute Controlled State Restoration
Write-Host "`n[3/4] Restoring pre-update state from snapshot..." -ForegroundColor Yellow
$restoreScript = Join-Path $PSScriptRoot "restore.ps1"
& $restoreScript -BackupPath $latestBackup.FullName -InstallPath $InstallPath -ComposeFile $ComposeFile -Force

# Step 4: Validate Recovery
Write-Host "`n[4/4] Validating recovery state health gates..." -ForegroundColor Yellow
$healthScript = Join-Path $PSScriptRoot "healthcheck.ps1"
& $healthScript -InstallPath $InstallPath

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " ROLLBACK PROCEDURE COMPLETED. SYSTEM RESTORED TO KNOWN GOOD STATE." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
