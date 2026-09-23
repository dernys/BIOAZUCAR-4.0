<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Preflight Validation Engine (P0-26)
.DESCRIPTION
    Validates host hardware, operating system, Docker engine, network ports,
    permissions and storage before production deployment.
    Exit codes: 0 = PASS, 1 = FAIL (Critical block), 2 = WARN
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\BioAzucar",
    [int]$MinRamGB = 4,
    [int]$MinDiskGB = 10,
    [int[]]$RequiredPorts = @(3000, 9099, 1883, 9090)
)

$ErrorActionPreference = "Continue"
$failCount = 0
$warnCount = 0
$passCount = 0

function Write-CheckResult {
    param([string]$Id, [string]$Name, [string]$Status, [string]$Message)
    if ($Status -eq "PASS") {
        Write-Host " [PASS] $Id - $Name: $Message" -ForegroundColor Green
        $script:passCount++
    } elseif ($Status -eq "WARN") {
        Write-Host " [WARN] $Id - $Name: $Message" -ForegroundColor Yellow
        $script:warnCount++
    } else {
        Write-Host " [FAIL] $Id - $Name: $Message" -ForegroundColor Red
        $script:failCount++
    }
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — PRODUCTION PREFLIGHT VERIFICATION" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
Write-Host "Target Path: $InstallPath`n"

# 1. Administrator Privileges Check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-CheckResult "PRE-01" "Administrator Privileges" "PASS" "Process is running in elevated context."
} else {
    Write-CheckResult "PRE-01" "Administrator Privileges" "FAIL" "PowerShell session must run as Administrator."
}

# 2. OS Architecture & Version
$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -eq "AMD64" -or $arch -eq "ARM64") {
    Write-CheckResult "PRE-02" "CPU Architecture" "PASS" "Compatible 64-bit architecture ($arch)."
} else {
    Write-CheckResult "PRE-02" "CPU Architecture" "FAIL" "Incompatible architecture ($arch). BioAzúcar requires x64/ARM64."
}

# 3. Memory Verification
try {
    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $totalRamGB = [math]::Round($osInfo.TotalVisibleMemorySize / 1MB, 1)
    $freeRamGB = [math]::Round($osInfo.FreePhysicalMemory / 1MB, 1)
    if ($totalRamGB -ge $MinRamGB) {
        Write-CheckResult "PRE-03" "Host System Memory" "PASS" "Total RAM: $totalRamGB GB, Free RAM: $freeRamGB GB."
    } elseif ($totalRamGB -ge 2) {
        Write-CheckResult "PRE-03" "Host System Memory" "WARN" "Total RAM: $totalRamGB GB is below recommended $MinRamGB GB."
    } else {
        Write-CheckResult "PRE-03" "Host System Memory" "FAIL" "Total RAM: $totalRamGB GB is insufficient."
    }
} catch {
    Write-CheckResult "PRE-03" "Host System Memory" "WARN" "Could not query memory via WMI/CIM: $_"
}

# 4. Storage Space Verification
try {
    $driveLetter = (Split-Path -Path $InstallPath -Qualifier)
    if (-not $driveLetter) { $driveLetter = "C:" }
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$driveLetter'" -ErrorAction Stop
    $freeDiskGB = [math]::Round($disk.FreeSpace / 1GB, 1)
    if ($freeDiskGB -ge $MinDiskGB) {
        Write-CheckResult "PRE-04" "Disk Storage Space" "PASS" "Drive $driveLetter free space: $freeDiskGB GB (Required: $MinDiskGB GB)."
    } else {
        Write-CheckResult "PRE-04" "Disk Storage Space" "FAIL" "Drive $driveLetter free space ($freeDiskGB GB) is lower than $MinDiskGB GB."
    }
} catch {
    Write-CheckResult "PRE-04" "Disk Storage Space" "WARN" "Could not inspect drive space: $_"
}

# 5. Docker Engine Check
$dockerCmd = Get-Command "docker" -ErrorAction SilentlyContinue
if ($dockerCmd) {
    try {
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-CheckResult "PRE-05" "Docker Daemon State" "PASS" "Docker Engine is active and responding."
        } else {
            Write-CheckResult "PRE-05" "Docker Daemon State" "FAIL" "Docker Engine is installed but service is stopped or unreachable."
        }
    } catch {
        Write-CheckResult "PRE-05" "Docker Daemon State" "FAIL" "Error pinging Docker daemon."
    }
} else {
    Write-CheckResult "PRE-05" "Docker Daemon State" "FAIL" "Docker command not found in system PATH."
}

# 6. Docker Compose Check
try {
    $composeVer = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-CheckResult "PRE-06" "Docker Compose" "PASS" "Available: $composeVer"
    } else {
        Write-CheckResult "PRE-06" "Docker Compose" "FAIL" "Docker compose plugin not available."
    }
} catch {
    Write-CheckResult "PRE-06" "Docker Compose" "FAIL" "Error verifying docker compose."
}

# 7. Port Availability Check
foreach ($port in $RequiredPorts) {
    $occupied = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($occupied) {
        Write-CheckResult "PRE-07" "Port $port Availability" "WARN" "Port $port is currently bound by another process."
    } else {
        Write-CheckResult "PRE-07" "Port $port Availability" "PASS" "Port $port is free."
    }
}

# 8. Filesystem & Permission Test
try {
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }
    $testFile = Join-Path $InstallPath ".perm_test_$(Get-Random).tmp"
    Set-Content -Path $testFile -Value "BIOAZUCAR_PERM_TEST" -Force
    Remove-Item -Path $testFile -Force
    Write-CheckResult "PRE-08" "Filesystem Permissions" "PASS" "Target directory $InstallPath is writable."
} catch {
    Write-CheckResult "PRE-08" "Filesystem Permissions" "FAIL" "Cannot write to $InstallPath: $_"
}

Write-Host "`n----------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " PREFLIGHT SUMMARY: $passCount Passed, $warnCount Warnings, $failCount Failures" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------------------" -ForegroundColor Cyan

if ($failCount -gt 0) {
    Write-Host " RESULT: FAIL — Preflight requirements not met. Rectify failures before proceeding.`n" -ForegroundColor Red
    exit 1
} elseif ($warnCount -gt 0) {
    Write-Host " RESULT: WARN — Preflight passed with warnings. Review above messages.`n" -ForegroundColor Yellow
    exit 2
} else {
    Write-Host " RESULT: PASS — Clean server verification successful. System is ready for install.`n" -ForegroundColor Green
    exit 0
}
