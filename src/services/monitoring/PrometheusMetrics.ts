/**
 * BioAzúcar 4.0 — Prometheus & OpenMetrics Industrial Exporter
 * 
 * Generates OpenMetrics compliant metrics for scraping by Prometheus,
 * Grafana, VictoriaMetrics, and Datadog agents.
 */

export interface MetricLabels {
  node_id?: string;
  tenant_id?: string;
  area?: string;
  protocol?: string;
  quality?: string;
  origin?: string;
  [key: string]: string | undefined;
}

export class PrometheusRegistry {
  private static instance: PrometheusRegistry;

  // Counters
  private counters = new Map<string, { value: number; labels: MetricLabels; help: string }>();

  // Gauges
  private gauges = new Map<string, { value: number; labels: MetricLabels; help: string }>();

  // Latencies (moving average / last sample)
  private latencies = new Map<string, { lastSeconds: number; avgSeconds: number; count: number; help: string }>();

  public static getInstance(): PrometheusRegistry {
    if (!PrometheusRegistry.instance) {
      PrometheusRegistry.instance = new PrometheusRegistry();
    }
    return PrometheusRegistry.instance;
  }

  public incCounter(name: string, help: string, delta: number = 1, labels: MetricLabels = {}): void {
    const key = this.serializeKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += delta;
    } else {
      this.counters.set(key, { value: delta, labels, help });
    }
  }

  public setGauge(name: string, help: string, value: number, labels: MetricLabels = {}): void {
    const key = this.serializeKey(name, labels);
    this.gauges.set(key, { value, labels, help });
  }

  public observeLatency(name: string, help: string, seconds: number): void {
    const existing = this.latencies.get(name);
    if (existing) {
      existing.count += 1;
      existing.lastSeconds = seconds;
      existing.avgSeconds = (existing.avgSeconds * (existing.count - 1) + seconds) / existing.count;
    } else {
      this.latencies.set(name, {
        lastSeconds: seconds,
        avgSeconds: seconds,
        count: 1,
        help,
      });
    }
  }

  /**
   * Render Prometheus text exposition format (version 0.0.4)
   */
  public scrape(): string {
    const lines: string[] = [];

    // Group counters by metric name for HELP/TYPE headers
    const groupedCounters = new Map<string, Array<{ key: string; value: number; labels: MetricLabels; help: string }>>();
    for (const [key, data] of this.counters.entries()) {
      const metricName = key.split("{")[0];
      if (!groupedCounters.has(metricName)) groupedCounters.set(metricName, []);
      groupedCounters.get(metricName)!.push({ key, ...data });
    }

    for (const [name, list] of groupedCounters.entries()) {
      lines.push(`# HELP ${name} ${list[0].help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const item of list) {
        lines.push(`${this.formatMetric(name, item.labels)} ${item.value}`);
      }
    }

    // Group gauges
    const groupedGauges = new Map<string, Array<{ key: string; value: number; labels: MetricLabels; help: string }>>();
    for (const [key, data] of this.gauges.entries()) {
      const metricName = key.split("{")[0];
      if (!groupedGauges.has(metricName)) groupedGauges.set(metricName, []);
      groupedGauges.get(metricName)!.push({ key, ...data });
    }

    for (const [name, list] of groupedGauges.entries()) {
      lines.push(`# HELP ${name} ${list[0].help}`);
      lines.push(`# TYPE ${name} gauge`);
      for (const item of list) {
        lines.push(`${this.formatMetric(name, item.labels)} ${item.value}`);
      }
    }

    // Latencies
    for (const [name, lat] of this.latencies.entries()) {
      lines.push(`# HELP ${name}_seconds Latency in seconds`);
      lines.push(`# TYPE ${name}_seconds gauge`);
      lines.push(`${name}_seconds{stat="last"} ${lat.lastSeconds.toFixed(4)}`);
      lines.push(`${name}_seconds{stat="avg"} ${lat.avgSeconds.toFixed(4)}`);
      lines.push(`${name}_count ${lat.count}`);
    }

    return lines.join("\n") + "\n";
  }

  private serializeKey(name: string, labels: MetricLabels): string {
    const labelPairs = Object.entries(labels)
      .filter(([_, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return labelPairs ? `${name}{${labelPairs}}` : name;
  }

  private formatMetric(name: string, labels: MetricLabels): string {
    const labelPairs = Object.entries(labels)
      .filter(([_, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return labelPairs ? `${name}{${labelPairs}}` : name;
  }
}

export const prometheusMetrics = PrometheusRegistry.getInstance();
