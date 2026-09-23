/**
 * BioAzúcar 4.0 — MQTT 3.1.1 / 5.0 & Sparkplug B Protocol Types
 * 
 * Formal packet specifications, headers, QoS levels, and return codes
 * for industrial MQTT message transport supporting Sparkplug B Unified Namespace.
 */

export enum MqttPacketType {
  CONNECT = 1,
  CONNACK = 2,
  PUBLISH = 3,
  PUBACK = 4,
  PUBREC = 5,
  PUBREL = 6,
  PUBCOMP = 7,
  SUBSCRIBE = 8,
  SUBACK = 9,
  UNSUBSCRIBE = 10,
  UNSUBACK = 11,
  PINGREQ = 12,
  PINGRESP = 13,
  DISCONNECT = 14,
}

export enum MqttConnectReturnCode {
  ACCEPTED = 0x00,
  UNACCEPTABLE_PROTOCOL_VERSION = 0x01,
  IDENTIFIER_REJECTED = 0x02,
  SERVER_UNAVAILABLE = 0x03,
  BAD_USERNAME_OR_PASSWORD = 0x04,
  NOT_AUTHORIZED = 0x05,
}

export type MqttQoS = 0 | 1 | 2;

export interface MqttConnectOptions {
  clientId: string;
  cleanSession?: boolean;
  keepAliveSeconds?: number;
  username?: string;
  password?: string;
  willTopic?: string;
  willMessage?: Uint8Array | string;
  willQoS?: MqttQoS;
  willRetain?: boolean;
}

export interface MqttPublishOptions {
  topic: string;
  payload: Uint8Array | string;
  qos?: MqttQoS;
  retain?: boolean;
  packetId?: number;
  dup?: boolean;
}

export interface MqttSubscription {
  topic: string;
  qos: MqttQoS;
}

export interface MqttPacket {
  type: MqttPacketType;
  flags: number;
  remainingLength: number;
  topic?: string;
  packetId?: number;
  payload?: Uint8Array;
  returnCode?: MqttConnectReturnCode;
  sessionPresent?: boolean;
  grantedQos?: MqttQoS[];
}

export function getMqttConnectReturnCodeDescription(code: MqttConnectReturnCode): string {
  switch (code) {
    case MqttConnectReturnCode.ACCEPTED:
      return "Connection Accepted (0x00)";
    case MqttConnectReturnCode.UNACCEPTABLE_PROTOCOL_VERSION:
      return "Connection Refused: Unacceptable Protocol Version (0x01)";
    case MqttConnectReturnCode.IDENTIFIER_REJECTED:
      return "Connection Refused: Identifier Rejected (0x02)";
    case MqttConnectReturnCode.SERVER_UNAVAILABLE:
      return "Connection Refused: Server Unavailable (0x03)";
    case MqttConnectReturnCode.BAD_USERNAME_OR_PASSWORD:
      return "Connection Refused: Bad Username or Password (0x04)";
    case MqttConnectReturnCode.NOT_AUTHORIZED:
      return "Connection Refused: Not Authorized (0x05)";
    default:
      return `Connection Refused: Unknown Code (0x${Number(code).toString(16).padStart(2, "0")})`;
  }
}
