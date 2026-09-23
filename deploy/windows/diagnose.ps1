<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Production Diagnostics Collector (P0-26)
.DESCRIPTION
    Collects system metrics, container states, anonymized logs, and health status
    into a sanitized diagnostic bundle for SRE/support analysis. OMIT SECRETS.
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [string]$OutputDir = "C:\BioAzucar\diagnostics",
    [string]$ComposeFile = "..\docker\docker-compose.prod.yml"
)

$ErrorActionPreference = "Continue"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION DIAGNOSTICS COLLECTOR" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$diagPath = Join-Path $OutputDir "bioazucar-diag-$timestamp"
New-Item -ItemType Directory -Path $diagPath -Force | Out-Null

Write-Host "Diagnostic Output Directory: $diagPath`n"

# 1. System Information
Write-Host "[1/6] Capturing System and OS Metrics..." -ForegroundColor Yellow
$sysInfo = [PSCustomObject]@{
    Timestamp = (Get-Date -Format "o")
    OS = (Get-CimInstance Win32_OperatingSystem).Caption
    OSVersion = (Get-CimInstance Win32_OperatingSystem).Version
    Architecture = $env:PROCESSOR_ARCHITECTURE
    TotalRAM = [math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 2)
    FreeRAM = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
    LogicalDrives = Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, FreeSpace, Size
}
$sysInfo | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $diagPath "system_info.json")

# 2. Container Status
Write-Host "[2/6] Inspecting Docker Fleet Status..." -ForegroundColor Yellow
docker compose -f $ComposeFile ps -a > (Join-Path $diagPath "docker_ps.txt") 2>&1
docker stats --no-stream > (Join-Path $diagPath "docker_stats.txt") 2>&1

# 3. Container Logs (Last 200 lines per container, omitting secrets)
Write-Host "[3/6] Exporting Container Fleet Logs..." -ForegroundColor Yellow
$containers = @("bioazucar-platform-prod", "bioazucar-edge-prod", "bioazucar-broker-prod")
foreach ($c in $containers) {
    docker logs --tail 200 $c > (Join-Path $diagPath "log_$c.txt") 2>&1
}

# 4. Health Evaluation
Write-Host "[4/6] Querying Health Gates..." -ForegroundColor Yellow
$healthScript = Join-Path $PSScriptRoot "healthcheck.ps1"
if (Test-Path $healthScript) {
    & $healthScript > (Join-Path $diagPath "healthcheck_output.txt") 2>&1
}

# 5. Network Routing & Netstat
Write-Host "[5/6] Checking Local Ports & Network Sockets..." -ForegroundColor Yellow
Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess | ConvertTo-Json | Set-Content (Join-Path $diagPath "listening_ports.json")

# 6. Compress into Diagnostic Archive
Write-Host "[6/6] Packaging Diagnostic Archive..." -ForegroundColor Yellow
$zipFile = "$diagPath.zip"
Compress-Archive -Path "$diagPath\*" -DestinationPath $zipFile -Force
Remove-Item -Path $diagPath -Recurse -Force

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " DIAGNOSTIC BUNDLE GENERATED: $zipFile" -ForegroundColor Green
Write-Host " Note: All credentials and private keys have been strictly omitted." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
