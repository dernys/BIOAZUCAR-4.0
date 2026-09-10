/**
 * BioAzúcar 4.0 — Official Prometheus Metrics Service (prom-client)
 * 
 * Provides real OpenMetrics & Prometheus format metrics for OT / IT observability,
 * Grafana dashboards, Datadog/VictoriaMetrics collectors, and SIEM pipelines.
 */

import client from "prom-client";

// Initialize default Node.js and runtime metrics (GC, memory, event loop lag, CPU)
client.collectDefaultMetrics({
  prefix: "bioazucar_",
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ============================================================================
// INDUSTRIAL TELEMETRY & PROCESS METRICS (ISA-95 / SUGAR MILL & COGEN)
// ============================================================================

/**
 * Hourly Cane Milling Rate (TCH - Toneladas de Caña por Hora)
 */
export const millingTchGauge = new client.Gauge({
  name: "bioazucar_milling_tch",
  help: "Tasa horaria actual de molienda en toneladas de caña fresca por hora (TCH)",
  labelNames: ["plant", "tandem"],
});

/**
 * High Pressure Steam Generator (Calderas de Bagazo - Bar manométrico)
 */
export const boilerPressureGauge = new client.Gauge({
  name: "bioazucar_boiler_pressure_bar",
  help: "Presión de vapor de alta en domo de caldera (bar)",
  labelNames: ["plant", "boiler_id"],
});

/**
 * Bagasse Moisture Percentage (% Humedad Bagazo a Caldera)
 */
export const bagasseMoistureGauge = new client.Gauge({
  name: "bioazucar_bagasse_moisture_percent",
  help: "Porcentaje de humedad del bagazo alimentado a hornos de caldera (%)",
  labelNames: ["plant", "boiler_id"],
});

/**
 * Net Active Electric Power Dispatched to Grid (Turbogeneradores - MW)
 */
export const powerExportGauge = new client.Gauge({
  name: "bioazucar_power_export_mw",
  help: "Potencia eléctrica activa neta entregada a la red nacional (MW)",
  labelNames: ["plant", "turbogenerator_id"],
});

/**
 * Active ISA-18.2 Alarms Count
 */
export const activeAlarmsGauge = new client.Gauge({
  name: "bioazucar_active_alarms_count",
  help: "Cantidad de alarmas de planta activas según prioridad ISA-18.2",
  labelNames: ["plant", "priority"],
});

// ============================================================================
// EDGE DAEMON & TRANSMISSION METRICS (IEC 62443 / STORE & FORWARD)
// ============================================================================

/**
 * Total Telemetry Data Points Transmitted from Edge to Cloud
 */
export const edgeTransmittedPointsCounter = new client.Counter({
  name: "bioazucar_edge_transmitted_points_total",
  help: "Puntos de telemetría industrial transmitidos con éxito a la nube",
  labelNames: ["node_id", "tenant_id"],
});

/**
 * Total Telemetry Batches Transmitted
 */
export const edgeTransmittedBatchesCounter = new client.Counter({
  name: "bioazucar_edge_transmitted_batches_total",
  help: "Lotes de telemetría transmitidos y acusados por el Cloud API",
  labelNames: ["node_id", "tenant_id"],
});

/**
 * Edge Cloud Synchronization Errors (Network drops, HTTP 5xx)
 */
export const edgeSyncErrorsCounter = new client.Counter({
  name: "bioazucar_edge_sync_errors_total",
  help: "Errores o interrupciones en la transmisión Edge-to-Cloud",
  labelNames: ["node_id", "tenant_id", "error_type"],
});

/**
 * Store and Forward In-Memory / Encrypted Disk Queue Depth
 */
export const edgeBufferDepthGauge = new client.Gauge({
  name: "bioazucar_edge_saf_buffer_depth",
  help: "Cantidad actual de puntos de telemetría en búfer Store and Forward (disco/RAM)",
  labelNames: ["node_id", "tenant_id"],
});

/**
 * Edge-to-Cloud Sync Transmission Duration / Latency (Seconds)
 */
export const edgeSyncDurationHistogram = new client.Histogram({
  name: "bioazucar_edge_sync_duration_seconds",
  help: "Latencia de transmisión y validación criptográfica de lotes (segundos)",
  labelNames: ["node_id", "tenant_id"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// ============================================================================
// HTTP API & SERVER OBSERVABILITY METRICS
// ============================================================================

/**
 * HTTP Requests Counter
 */
export const httpRequestsTotal = new client.Counter({
  name: "bioazucar_http_requests_total",
  help: "Total de peticiones HTTP procesadas por el servidor BioAzúcar",
  labelNames: ["method", "route", "status_code"],
});

/**
 * HTTP Request Latency
 */
export const httpRequestDurationHistogram = new client.Histogram({
  name: "bioazucar_http_request_duration_seconds",
  help: "Distribución del tiempo de respuesta HTTP en segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

/**
 * Security & Audit Events Recorded (IEC 62443 Compliance)
 */
export const auditEventsTotal = new client.Counter({
  name: "bioazucar_audit_events_total",
  help: "Eventos de auditoría de seguridad persistidos (IEC 62443-4-2)",
  labelNames: ["tenant_id", "action", "result", "severity"],
});

// ============================================================================
// EXPORT HELPERS FOR EXPRESS & SCRAPING
// ============================================================================

export const register = client.register;

/**
 * Returns Prometheus / OpenMetrics scraping content type header
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Scrapes all registered Prometheus metrics asynchronously
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * Helper to observe HTTP requests easily in Express middleware
 */
export function trackHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
  httpRequestsTotal.inc({
    method,
    route,
    status_code: String(statusCode),
  });
  httpRequestDurationHistogram.observe(
    {
      method,
      route,
      status_code: String(statusCode),
    },
    durationSeconds
  );
}
