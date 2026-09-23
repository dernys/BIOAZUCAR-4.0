/**
 * BioAzúcar 4.0 — Manual Tag Catalog Importer & Mapping Workflow
 * 
 * Spec Reference: P0-01 (INDUSTRIAL SOURCE DISCOVERY: MANUAL IMPORT WORKFLOW)
 * Handles offline / legacy systems where network discovery is unavailable (air-gapped,
 * legacy PLC-5, serial RTU or proprietary DCS).
 * Supports: CSV, JSON, AML (AutomationML), and Tag Export formats.
 */

import {
  ManualImportPayload,
  DiscoveredTag,
  DiscoveredDevice,
  DiscoveredSource,
} from "../types";
import { IndustrialDataType } from "../../../types/industrialDataPoint";

export interface ManualImportResult {
  source: DiscoveredSource;
  devices: DiscoveredDevice[];
  tags: DiscoveredTag[];
  warnings: string[];
  totalRowsProcessed: number;
  validTagsCount: number;
  rejectedTagsCount: number;
}

export class ManualTagCatalogImporter {
  public importCatalog(payload: ManualImportPayload): ManualImportResult {
    const warnings: string[] = [];
    const sourceId = payload.defaultSourceId || `src-manual-${Date.now()}`;
    const defaultDeviceId = payload.defaultDeviceId || `dev-manual-catalog-01`;

    const source: DiscoveredSource = {
      sourceId,
      name: `Catálogo Importado Manualmente (${payload.format})`,
      endpoint: "file://local/import",
      protocol: payload.defaultProtocol || "MANUAL_IMPORT",
      status: "ONLINE",
      serverInfo: {
        vendorName: "Manual Engineering Specification / Plant DCS Export",
        productName: `Manual Import Service [${payload.format}]`,
        softwareVersion: "4.0.0",
      },
      discoveredAt: new Date().toISOString(),
      metadata: { format: payload.format, tenantId: payload.tenantId, siteId: payload.siteId },
    };

    const deviceMap = new Map<string, DiscoveredDevice>();
    deviceMap.set(defaultDeviceId, {
      deviceId: defaultDeviceId,
      sourceId,
      name: "Dispositivo de Proceso Predeterminado",
      deviceType: "PLC",
      status: "ONLINE",
      discoveredAt: new Date().toISOString(),
    });

    const tags: DiscoveredTag[] = [];
    let totalRowsProcessed = 0;
    let validTagsCount = 0;
    let rejectedTagsCount = 0;

    switch (payload.format) {
      case "JSON": {
        try {
          const parsed = JSON.parse(payload.content);
          const rawList = Array.isArray(parsed) ? parsed : parsed.tags || [];
          totalRowsProcessed = rawList.length;

          for (const item of rawList) {
            const tag = this.normalizeTagItem(item, sourceId, defaultDeviceId, payload, warnings);
            if (tag) {
              tags.push(tag);
              validTagsCount++;
            } else {
              rejectedTagsCount++;
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`Error al parsear archivo JSON: ${msg}`);
        }
        break;
      }

      case "CSV": {
        const lines = payload.content
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          warnings.push("El archivo CSV está vacío.");
          break;
        }

        const delimiter = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
        totalRowsProcessed = lines.length - 1;

        // Map column indices
        const colIdx = {
          tagId: headers.findIndex((h) => h.includes("tag") || h.includes("id")),
          name: headers.findIndex((h) => h.includes("name") || h.includes("nombre") || h.includes("descripcion")),
          address: headers.findIndex((h) => h.includes("address") || h.includes("direccion") || h.includes("dir")),
          variable: headers.findIndex((h) => h.includes("variable") || h.includes("symbol") || h.includes("tagname")),
          dataType: headers.findIndex((h) => h.includes("type") || h.includes("tipo")),
          unit: headers.findIndex((h) => h.includes("unit") || h.includes("unidad") || h.includes("eu")),
          min: headers.findIndex((h) => h.includes("min") || h.includes("low")),
          max: headers.findIndex((h) => h.includes("max") || h.includes("high")),
          equipment: headers.findIndex((h) => h.includes("equip") || h.includes("equipo")),
        };

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim());
          if (cols.length < 2) continue;

          const rawAddress = colIdx.address >= 0 ? cols[colIdx.address] : `ROW_${i}`;
          const rawName = colIdx.name >= 0 ? cols[colIdx.name] : `Tag_Fila_${i}`;
          const rawVar = colIdx.variable >= 0 ? cols[colIdx.variable] : `VAR_${i}`;
          const rawType = colIdx.dataType >= 0 ? cols[colIdx.dataType] : "FLOAT";
          const rawUnit = colIdx.unit >= 0 ? cols[colIdx.unit] : "EU";
          const rawMin = colIdx.min >= 0 ? parseFloat(cols[colIdx.min]) : 0;
          const rawMax = colIdx.max >= 0 ? parseFloat(cols[colIdx.max]) : 100;
          const rawEquipment = colIdx.equipment >= 0 ? cols[colIdx.equipment] : undefined;

          let targetDevId = defaultDeviceId;
          if (rawEquipment) {
            targetDevId = `dev-${rawEquipment.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
            if (!deviceMap.has(targetDevId)) {
              deviceMap.set(targetDevId, {
                deviceId: targetDevId,
                sourceId,
                name: rawEquipment,
                deviceType: "PLC",
                status: "ONLINE",
                discoveredAt: new Date().toISOString(),
              });
            }
          }

          const discoveredTag: DiscoveredTag = {
            id: `disc-tag-csv-${i}`,
            sourceId,
            deviceId: targetDevId,
            canonicalName: rawName,
            originalAddress: rawAddress,
            protocol: payload.defaultProtocol || "MANUAL_IMPORT",
            variable: rawVar,
            dataType: this.mapDataType(rawType),
            engineeringUnit: rawUnit,
            min: isNaN(rawMin) ? 0 : rawMin,
            max: isNaN(rawMax) ? 100 : rawMax,
            deadband: 0.1,
            scanRateMs: 1000,
            quality: "GOOD",
            approvalStatus: "MAPPED",
            discoveredAt: new Date().toISOString(),
            metadata: { importedRow: i },
          };

          tags.push(discoveredTag);
          validTagsCount++;
        }
        break;
      }

      case "AML":
      case "PLC_L5X": {
        // XML / AutomationML extraction
        warnings.push(`Parser de ${payload.format} procesado con introspección estructural.`);
        // Basic element parsing for XML tags
        const tagMatches = payload.content.matchAll(/<Tag\s+Name="([^"]+)"\s+DataType="([^"]+)"/g);
        let count = 0;
        for (const match of tagMatches) {
          count++;
          totalRowsProcessed++;
          const tagName = match[1];
          const dataType = match[2];

          tags.push({
            id: `disc-tag-xml-${count}`,
            sourceId,
            deviceId: defaultDeviceId,
            canonicalName: tagName,
            originalAddress: `L5X:${tagName}`,
            protocol: "MANUAL_IMPORT",
            variable: tagName,
            dataType: this.mapDataType(dataType),
            engineeringUnit: "EU",
            approvalStatus: "MAPPED",
            discoveredAt: new Date().toISOString(),
            metadata: { xmlSource: payload.format },
          });
          validTagsCount++;
        }
        if (count === 0) {
          warnings.push(`No se encontraron nodos <Tag> válidos en el payload ${payload.format}.`);
        }
        break;
      }
    }

    return {
      source,
      devices: Array.from(deviceMap.values()),
      tags,
      warnings,
      totalRowsProcessed,
      validTagsCount,
      rejectedTagsCount,
    };
  }

  private normalizeTagItem(
    item: Record<string, unknown>,
    sourceId: string,
    defaultDeviceId: string,
    payload: ManualImportPayload,
    warnings: string[]
  ): DiscoveredTag | null {
    const rawAddress = String(item.originalAddress || item.address || item.tagAddress || "");
    const rawName = String(item.canonicalName || item.name || item.description || "");
    const rawVar = String(item.variable || item.tag || item.code || rawName);

    if (!rawAddress && !rawVar) {
      warnings.push("Registro omitido por carecer de dirección o identificador de variable.");
      return null;
    }

    return {
      id: `disc-tag-json-${Math.random().toString(36).substring(2, 9)}`,
      sourceId,
      deviceId: String(item.deviceId || defaultDeviceId),
      canonicalName: rawName || rawVar,
      originalAddress: rawAddress || rawVar,
      protocol: payload.defaultProtocol || "MANUAL_IMPORT",
      variable: rawVar,
      dataType: this.mapDataType(String(item.dataType || "FLOAT")),
      engineeringUnit: String(item.engineeringUnit || item.unit || "EU"),
      min: typeof item.min === "number" ? item.min : 0,
      max: typeof item.max === "number" ? item.max : 100,
      deadband: typeof item.deadband === "number" ? item.deadband : 0.1,
      scanRateMs: typeof item.scanRateMs === "number" ? item.scanRateMs : 1000,
      quality: "GOOD",
      approvalStatus: "MAPPED",
      discoveredAt: new Date().toISOString(),
      metadata: typeof item.metadata === "object" && item.metadata !== null ? (item.metadata as Record<string, unknown>) : {},
    };
  }

  private mapDataType(raw: string): IndustrialDataType {
    const clean = raw.toUpperCase().trim();
    if (clean.includes("FLOAT") || clean.includes("REAL") || clean.includes("SINGLE") || clean.includes("DOUBLE")) {
      return "FLOAT";
    }
    if (clean.includes("INT") || clean.includes("WORD") || clean.includes("DINT") || clean.includes("LONG")) {
      return "INT32";
    }
    if (clean.includes("BOOL") || clean.includes("BIT") || clean.includes("DISCRETE")) {
      return "BOOLEAN";
    }
    return "STRING";
  }
}
