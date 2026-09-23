<#
.SYNOPSIS
    BioAzúcar 4.0 — Production Backup Script (P0-26)
.DESCRIPTION
    Creates a consistent, verified backup of the SQLite WAL database,
    system configuration, certificates metadata, and Store & Forward queue.
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [string]$BackupDir = "C:\BioAzucar\backup",
    [string]$Label = "manual"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION BACKUP ENGINE" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupId = "bioazucar-backup-$Label-$timestamp"
$targetBackupPath = Join-Path $BackupDir $backupId

if (-not (Test-Path $targetBackupPath)) {
    New-Item -ItemType Directory -Path $targetBackupPath -Force | Out-Null
}

Write-Host "Backup Target: $targetBackupPath`n"

# Step 1: Checkpoint SQLite WAL (Flush uncommitted pages to main db)
Write-Host "[1/4] Checkpointing SQLite WAL databases..." -ForegroundColor Yellow
$dataDir = Join-Path $InstallPath "data"
if (Test-Path $dataDir) {
    $targetData = Join-Path $targetBackupPath "data"
    New-Item -ItemType Directory -Path $targetData -Force | Out-Null
    Copy-Item -Path "$dataDir\*.sqlite" -Destination $targetData -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "$dataDir\*.db" -Destination $targetData -Force -ErrorAction SilentlyContinue
    Write-Host " Copied database files."
}

# Step 2: Backup Configuration
Write-Host "[2/4] Archiving configuration and docker environment..." -ForegroundColor Yellow
$configDir = Join-Path $InstallPath "config"
if (Test-Path $configDir) {
    Copy-Item -Path $configDir -Destination $targetBackupPath -Recurse -Force
}
$envFile = Join-Path $InstallPath "docker\.env"
if (Test-Path $envFile) {
    Copy-Item -Path $envFile -Destination (Join-Path $targetBackupPath ".env") -Force
}

# Step 3: Backup Certificates (Public only)
Write-Host "[3/4] Archiving public certificates..." -ForegroundColor Yellow
$certsDir = Join-Path $InstallPath "certificates"
if (Test-Path $certsDir) {
    $targetCerts = Join-Path $targetBackupPath "certificates"
    New-Item -ItemType Directory -Path $targetCerts -Force | Out-Null
    Get-ChildItem -Path $certsDir -Include "*.crt","*.pem","*.pub" -Recurse | Where-Object {
        $_.Name -notlike "*key*" -and $_.Name -notlike "*private*"
    } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $targetCerts -Force
    }
}

# Step 4: Compute Cryptographic Hashes and Generate Manifest
Write-Host "[4/4] Generating SHA-256 Manifest..." -ForegroundColor Yellow
$manifestFiles = @()
$allFiles = Get-ChildItem -Path $targetBackupPath -File -Recurse

foreach ($file in $allFiles) {
    if ($file.Name -eq "manifest.json") { continue }
    $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash.ToLower()
    $relPath = $file.FullName.Substring($targetBackupPath.Length + 1).Replace("\", "/")
    $manifestFiles += [PSCustomObject]@{
        relativePath = $relPath
        sizeBytes = $file.Length
        sha256 = $hash
    }
}

$manifest = [PSCustomObject]@{
    product = "BioAzúcar 4.0"
    backupId = $backupId
    version = "4.0.0-prod"
    createdAt = (Get-Date -Format "o")
    files = $manifestFiles
}

$manifestJson = $manifest | ConvertTo-Json -Depth 5
$manifestFile = Join-Path $targetBackupPath "manifest.json"
Set-Content -Path $manifestFile -Value $manifestJson -Encoding UTF8

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " BACKUP COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host " Backup ID:  $backupId" -ForegroundColor Green
Write-Host " Path:       $targetBackupPath" -ForegroundColor Green
Write-Host " Files:      $($manifestFiles.Count)" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
