/**
 * BioAzúcar 4.0 — Sparkplug B Specification Encoder & Protocol Definitions (I6)
 * 
 * Complies with the Eclipse Sparkplug B Specification (spBv1.0):
 * - Topic structure: spBv1.0/<groupId>/<messageType>/<edgeNodeId>[/<deviceId>]
 * - Message types: NBIRTH, DBIRTH, NDATA, DDATA, NDEATH, NCMD, DCMD
 * - Metric representations: name, timestamp, dataType, value, isHistorical
 * - Monotonic sequence numbering: 0..255 (wraps to 0 after 255, resets to 0 on NBIRTH)
 * - Last Will and Testament (LWT) for NDEATH
 */

export type SparkplugMessageType =
  | "NBIRTH"
  | "DBIRTH"
  | "NDATA"
  | "DDATA"
  | "NDEATH"
  | "NCMD"
  | "DCMD";

export type SparkplugDataType =
  | "Int8"
  | "Int16"
  | "Int32"
  | "Int64"
  | "UInt8"
  | "UInt16"
  | "UInt32"
  | "UInt64"
  | "Float"
  | "Double"
  | "Boolean"
  | "String"
  | "DateTime"
  | "Text";

export interface SparkplugMetric {
  name: string;
  alias?: number;
  timestamp: number;
  dataType: SparkplugDataType;
  value: number | string | boolean;
  isHistorical?: boolean;
  isTransient?: boolean;
  isNull?: boolean;
  metadata?: Record<string, any>;
}

export interface SparkplugPayload {
  timestamp: number;
  metrics: SparkplugMetric[];
  seq: number;
  uuid?: string;
  body?: Uint8Array;
}

export class SparkplugBProtocol {
  private static readonly SPARKPLUG_NAMESPACE = "spBv1.0";

  /**
   * Constructs a compliant Sparkplug B topic string.
   */
  public static buildTopic(
    groupId: string,
    messageType: SparkplugMessageType,
    edgeNodeId: string,
    deviceId?: string
  ): string {
    if (deviceId) {
      return `${this.SPARKPLUG_NAMESPACE}/${groupId}/${messageType}/${edgeNodeId}/${deviceId}`;
    }
    return `${this.SPARKPLUG_NAMESPACE}/${groupId}/${messageType}/${edgeNodeId}`;
  }

  /**
   * Parses a Sparkplug B topic into its constituent elements.
   */
  public static parseTopic(topic: string): {
    namespace: string;
    groupId: string;
    messageType: SparkplugMessageType;
    edgeNodeId: string;
    deviceId?: string;
  } | null {
    const parts = topic.split("/");
    if (parts.length < 4 || parts[0] !== this.SPARKPLUG_NAMESPACE) {
      return null;
    }

    return {
      namespace: parts[0],
      groupId: parts[1],
      messageType: parts[2] as SparkplugMessageType,
      edgeNodeId: parts[3],
      deviceId: parts[4] || undefined,
    };
  }

  /**
   * Increments sequence counter strictly in the range 0..255.
   */
  public static nextSequence(currentSeq: number): number {
    return (currentSeq + 1) % 256;
  }

  /**
   * Encodes a standard Sparkplug B payload into an atomic JSON representation.
   */
  public static encodePayload(
    metrics: SparkplugMetric[],
    seq: number,
    timestamp: number = Date.now()
  ): SparkplugPayload {
    return {
      timestamp,
      metrics,
      seq: seq % 256,
    };
  }

  /**
   * Creates an NDEATH payload (used by MQTT broker as Last Will and Testament).
   * Note: As per spec, NDEATH payload does NOT contain a sequence number or has seq=0.
   */
  public static createNDeathPayload(timestamp: number = Date.now()): SparkplugPayload {
    return {
      timestamp,
      metrics: [
        {
          name: "bdSeq",
          timestamp,
          dataType: "UInt64",
          value: 0,
        },
      ],
      seq: 0,
    };
  }

  /**
   * Infers the appropriate Sparkplug data type from a JavaScript value.
   */
  public static inferDataType(value: any): SparkplugDataType {
    if (typeof value === "boolean") return "Boolean";
    if (typeof value === "string") return "String";
    if (typeof value === "number") {
      return Number.isInteger(value) ? "Int32" : "Double";
    }
    return "String";
  }
}
