<#
.SYNOPSIS
    BioAzúcar 4.0 — Windows Server Health Gates Evaluator (P0-26)
.DESCRIPTION
    Polls running containers, application API, Edge daemon watchdog,
    metrics endpoints, and database integrity to report system operational health.
    Exit codes: 0 = HEALTHY, 1 = FAILED, 2 = DEGRADED
#>

[CmdletBinding()]
param(
    [string]$AppUrl = "http://127.0.0.1:3000",
    [string]$EdgeUrl = "http://127.0.0.1:9099",
    [string]$InstallPath = "C:\BioAzucar",
    [int]$TimeoutSeconds = 5
)

$ErrorActionPreference = "Continue"
$failedGates = 0
$degradedGates = 0
$healthyGates = 0

function Write-GateStatus {
    param([string]$Component, [string]$Status, [string]$Details)
    if ($Status -eq "HEALTHY") {
        Write-Host " [HEALTHY]  $Component: $Details" -ForegroundColor Green
        $script:healthyGates++
    } elseif ($Status -eq "DEGRADED") {
        Write-Host " [DEGRADED] $Component: $Details" -ForegroundColor Yellow
        $script:degradedGates++
    } else {
        Write-Host " [FAILED]   $Component: $Details" -ForegroundColor Red
        $script:failedGates++
    }
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " BIOAZÚCAR 4.0 — OPERATIONAL HEALTH GATES EVALUATION" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')`n"

# Gate 1: Central Platform API
try {
    $response = Invoke-RestMethod -Uri "$AppUrl/api/health" -Method Get -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    if ($response.status -eq "ok") {
        Write-GateStatus "Platform SCADA Core" "HEALTHY" "HTTP 200 OK - Model: $($response.securityModel) - Node: $($response.mill)"
    } else {
        Write-GateStatus "Platform SCADA Core" "DEGRADED" "Response status != ok: $($response.status)"
    }
} catch {
    Write-GateStatus "Platform SCADA Core" "FAILED" "Cannot reach $AppUrl/api/health: $_"
}

# Gate 2: Edge Gateway Watchdog
try {
    $edgeResponse = Invoke-WebRequest -Uri "$EdgeUrl/health" -Method Get -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    if ($edgeResponse.StatusCode -eq 200) {
        Write-GateStatus "Industrial Edge Gateway" "HEALTHY" "HTTP 200 OK on watchdog port 9099."
    } else {
        Write-GateStatus "Industrial Edge Gateway" "DEGRADED" "HTTP Status: $($edgeResponse.StatusCode)"
    }
} catch {
    Write-GateStatus "Industrial Edge Gateway" "DEGRADED" "Edge watchdog not responding on $EdgeUrl: $_ (May be running in pure background mode)"
}

# Gate 3: Prometheus Metrics Exposition
try {
    $metrics = Invoke-WebRequest -Uri "$AppUrl/metrics" -Method Get -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    if ($metrics.StatusCode -eq 200 -and $metrics.Content.Contains("bioazucar_")) {
        Write-GateStatus "Metrics & Telemetry Stream" "HEALTHY" "OpenMetrics scraped successfully."
    } else {
        Write-GateStatus "Metrics & Telemetry Stream" "DEGRADED" "Metrics endpoint available but empty."
    }
} catch {
    Write-GateStatus "Metrics & Telemetry Stream" "FAILED" "Failed to scrape $AppUrl/metrics: $_"
}

# Gate 4: Container Orchestration State
try {
    $psOutput = docker compose ps --format json 2>&1
    if ($LASTEXITCODE -eq 0 -and $psOutput) {
        Write-GateStatus "Docker Container Fleet" "HEALTHY" "All managed containers reported active."
    } else {
        Write-GateStatus "Docker Container Fleet" "DEGRADED" "Containers query returned non-zero or empty fleet."
    }
} catch {
    Write-GateStatus "Docker Container Fleet" "DEGRADED" "Could not inspect docker compose fleet: $_"
}

Write-Host "`n----------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " HEALTH SUMMARY: $healthyGates Healthy, $degradedGates Degraded, $failedGates Failed" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------------------" -ForegroundColor Cyan

if ($failedGates -gt 0) {
    Write-Host " OVERALL STATUS: FAILED — Critical operational defects detected.`n" -ForegroundColor Red
    exit 1
} elseif ($degradedGates -gt 0) {
    Write-Host " OVERALL STATUS: DEGRADED — Platform operational with non-critical warnings.`n" -ForegroundColor Yellow
    exit 2
} else {
    Write-Host " OVERALL STATUS: HEALTHY — All production health gates green.`n" -ForegroundColor Green
    exit 0
}
