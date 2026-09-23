/**
 * BioAzúcar 4.0 — MQTT Binary Codec & Wire Framing Engine
 * 
 * Complies with the OASIS MQTT 3.1.1 specification:
 * - Variable Byte Integer encoding and decoding (1..4 bytes)
 * - Fixed header, variable header, and payload framing
 * - Stream packet decoding and buffer alignment
 */

import {
  MqttPacketType,
  MqttConnectReturnCode,
  MqttQoS,
  MqttConnectOptions,
  MqttPublishOptions,
  MqttSubscription,
  MqttPacket,
} from "./MqttTypes";

export class MqttBinaryCodec {
  /**
   * Encodes a length value into MQTT Variable Byte Integer representation (1 to 4 bytes).
   */
  public static encodeVariableByteInteger(length: number): Uint8Array {
    if (length < 0 || length > 268435455) {
      throw new Error(`MQTT Variable Byte Integer length out of range: ${length}`);
    }

    const bytes: number[] = [];
    let num = length;
    do {
      let encodedByte = num % 128;
      num = Math.floor(num / 128);
      if (num > 0) {
        encodedByte |= 128;
      }
      bytes.push(encodedByte);
    } while (num > 0);

    return new Uint8Array(bytes);
  }

  /**
   * Decodes an MQTT Variable Byte Integer from a buffer.
   */
  public static decodeVariableByteInteger(
    buffer: Uint8Array,
    offset: number = 0
  ): { value: number; bytesRead: number } {
    let multiplier = 1;
    let value = 0;
    let bytesRead = 0;
    let encodedByte = 0;

    do {
      if (offset + bytesRead >= buffer.length) {
        throw new Error("Malformed Variable Byte Integer: buffer exhausted before terminator");
      }
      if (bytesRead >= 4) {
        throw new Error("Malformed Variable Byte Integer: exceeds 4 bytes");
      }
      encodedByte = buffer[offset + bytesRead];
      value += (encodedByte & 127) * multiplier;
      multiplier *= 128;
      bytesRead++;
    } while ((encodedByte & 128) !== 0);

    return { value, bytesRead };
  }

  /**
   * Encodes a UTF-8 string with a 2-byte Big-Endian length prefix.
   */
  public static encodeUtf8String(str: string): Uint8Array {
    const encoded = new TextEncoder().encode(str);
    const buf = new Uint8Array(2 + encoded.length);
    new DataView(buf.buffer).setUint16(0, encoded.length, false);
    buf.set(encoded, 2);
    return buf;
  }

  /**
   * Decodes a UTF-8 string with a 2-byte Big-Endian length prefix.
   */
  public static decodeUtf8String(
    buffer: Uint8Array,
    offset: number = 0
  ): { str: string; bytesRead: number } {
    if (offset + 2 > buffer.length) {
      throw new Error("Buffer too short for UTF-8 string length prefix");
    }
    const len = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint16(offset, false);
    if (offset + 2 + len > buffer.length) {
      throw new Error(`Buffer too short for UTF-8 string body (expected ${len} bytes)`);
    }
    const strBytes = buffer.subarray(offset + 2, offset + 2 + len);
    const str = new TextDecoder().decode(strBytes);
    return { str, bytesRead: 2 + len };
  }

  // --------------------------------------------------------------------------
  // Packet Builders
  // --------------------------------------------------------------------------

  /**
   * Builds an MQTT CONNECT Packet (Type 1).
   */
  public static buildConnectPacket(options: MqttConnectOptions): Uint8Array {
    const protocolName = this.encodeUtf8String("MQTT"); // 4 bytes + 2 length = 6
    const protocolLevel = 4; // MQTT 3.1.1

    let connectFlags = 0;
    if (options.cleanSession ?? true) connectFlags |= 0x02;

    const hasWill = !!options.willTopic;
    if (hasWill) {
      connectFlags |= 0x04; // Will Flag
      const willQos = options.willQoS || 0;
      connectFlags |= (willQos & 0x03) << 3;
      if (options.willRetain) connectFlags |= 0x20;
    }

    if (options.password !== undefined) connectFlags |= 0x40;
    if (options.username !== undefined) connectFlags |= 0x80;

    const keepAlive = options.keepAliveSeconds ?? 60;

    // Variable Header
    const varHeader = new Uint8Array(protocolName.length + 4);
    varHeader.set(protocolName, 0);
    varHeader[protocolName.length] = protocolLevel;
    varHeader[protocolName.length + 1] = connectFlags;
    new DataView(varHeader.buffer).setUint16(protocolName.length + 2, keepAlive, false);

    // Payload: Client ID, Will Topic, Will Message, Username, Password
    const payloadChunks: Uint8Array[] = [];
    payloadChunks.push(this.encodeUtf8String(options.clientId));

    if (hasWill) {
      payloadChunks.push(this.encodeUtf8String(options.willTopic!));
      const willPayloadBytes =
        typeof options.willMessage === "string"
          ? new TextEncoder().encode(options.willMessage)
          : options.willMessage || new Uint8Array(0);
      const willMsgBuf = new Uint8Array(2 + willPayloadBytes.length);
      new DataView(willMsgBuf.buffer).setUint16(0, willPayloadBytes.length, false);
      willMsgBuf.set(willPayloadBytes, 2);
      payloadChunks.push(willMsgBuf);
    }

    if (options.username !== undefined) {
      payloadChunks.push(this.encodeUtf8String(options.username));
    }
    if (options.password !== undefined) {
      payloadChunks.push(this.encodeUtf8String(options.password));
    }

    const totalPayloadLen = payloadChunks.reduce((acc, c) => acc + c.length, 0);
    const payload = new Uint8Array(totalPayloadLen);
    let offset = 0;
    for (const chunk of payloadChunks) {
      payload.set(chunk, offset);
      offset += chunk.length;
    }

    const remainingLength = varHeader.length + payload.length;
    const remLenBytes = this.encodeVariableByteInteger(remainingLength);

    const fixedHeader = new Uint8Array(1 + remLenBytes.length);
    fixedHeader[0] = (MqttPacketType.CONNECT << 4) & 0xf0;
    fixedHeader.set(remLenBytes, 1);

    const packet = new Uint8Array(fixedHeader.length + remainingLength);
    packet.set(fixedHeader, 0);
    packet.set(varHeader, fixedHeader.length);
    packet.set(payload, fixedHeader.length + varHeader.length);

    return packet;
  }

  /**
   * Builds an MQTT CONNACK Packet (Type 2).
   */
  public static buildConnackPacket(
    sessionPresent: boolean,
    returnCode: MqttConnectReturnCode = MqttConnectReturnCode.ACCEPTED
  ): Uint8Array {
    const packet = new Uint8Array(4);
    packet[0] = (MqttPacketType.CONNACK << 4) & 0xf0;
    packet[1] = 2; // Remaining length
    packet[2] = sessionPresent ? 0x01 : 0x00;
    packet[3] = returnCode & 0xff;
    return packet;
  }

  /**
   * Builds an MQTT PUBLISH Packet (Type 3).
   */
  public static buildPublishPacket(options: MqttPublishOptions): Uint8Array {
    const qos = options.qos || 0;
    let firstByte = (MqttPacketType.PUBLISH << 4) & 0xf0;
    if (options.dup) firstByte |= 0x08;
    firstByte |= (qos & 0x03) << 1;
    if (options.retain) firstByte |= 0x01;

    const topicBytes = this.encodeUtf8String(options.topic);
    const payloadBytes =
      typeof options.payload === "string"
        ? new TextEncoder().encode(options.payload)
        : options.payload;

    let varHeaderLen = topicBytes.length;
    if (qos > 0) {
      varHeaderLen += 2; // Packet Identifier
    }

    const remainingLength = varHeaderLen + payloadBytes.length;
    const remLenBytes = this.encodeVariableByteInteger(remainingLength);

    const packet = new Uint8Array(1 + remLenBytes.length + remainingLength);
    packet[0] = firstByte;
    packet.set(remLenBytes, 1);

    let writeOffset = 1 + remLenBytes.length;
    packet.set(topicBytes, writeOffset);
    writeOffset += topicBytes.length;

    if (qos > 0) {
      const packetId = options.packetId ?? 1;
      new DataView(packet.buffer).setUint16(writeOffset, packetId, false);
      writeOffset += 2;
    }

    packet.set(payloadBytes, writeOffset);
    return packet;
  }

  /**
   * Builds an MQTT PUBACK Packet (Type 4).
   */
  public static buildPubackPacket(packetId: number): Uint8Array {
    const packet = new Uint8Array(4);
    packet[0] = (MqttPacketType.PUBACK << 4) & 0xf0;
    packet[1] = 2; // Remaining length
    new DataView(packet.buffer).setUint16(2, packetId, false);
    return packet;
  }

  /**
   * Builds an MQTT SUBSCRIBE Packet (Type 8).
   */
  public static buildSubscribePacket(
    packetId: number,
    subscriptions: MqttSubscription[]
  ): Uint8Array {
    const subChunks: Uint8Array[] = [];
    for (const sub of subscriptions) {
      const topicBytes = this.encodeUtf8String(sub.topic);
      const chunk = new Uint8Array(topicBytes.length + 1);
      chunk.set(topicBytes, 0);
      chunk[topicBytes.length] = sub.qos & 0x03;
      subChunks.push(chunk);
    }

    const payloadLen = subChunks.reduce((acc, c) => acc + c.length, 0);
    const remainingLength = 2 + payloadLen; // 2 bytes packet ID + payload
    const remLenBytes = this.encodeVariableByteInteger(remainingLength);

    const packet = new Uint8Array(1 + remLenBytes.length + remainingLength);
    packet[0] = (MqttPacketType.SUBSCRIBE << 4) | 0x02; // QoS 1 flag
    packet.set(remLenBytes, 1);

    let offset = 1 + remLenBytes.length;
    new DataView(packet.buffer).setUint16(offset, packetId, false);
    offset += 2;

    for (const chunk of subChunks) {
      packet.set(chunk, offset);
      offset += chunk.length;
    }

    return packet;
  }

  /**
   * Builds an MQTT SUBACK Packet (Type 9).
   */
  public static buildSubackPacket(packetId: number, grantedQos: MqttQoS[]): Uint8Array {
    const remainingLength = 2 + grantedQos.length;
    const remLenBytes = this.encodeVariableByteInteger(remainingLength);

    const packet = new Uint8Array(1 + remLenBytes.length + remainingLength);
    packet[0] = (MqttPacketType.SUBACK << 4) & 0xf0;
    packet.set(remLenBytes, 1);

    let offset = 1 + remLenBytes.length;
    new DataView(packet.buffer).setUint16(offset, packetId, false);
    offset += 2;

    for (let i = 0; i < grantedQos.length; i++) {
      packet[offset + i] = grantedQos[i];
    }

    return packet;
  }

  /**
   * Builds an MQTT PINGREQ Packet (Type 12).
   */
  public static buildPingreqPacket(): Uint8Array {
    return new Uint8Array([(MqttPacketType.PINGREQ << 4) & 0xf0, 0x00]);
  }

  /**
   * Builds an MQTT PINGRESP Packet (Type 13).
   */
  public static buildPingrespPacket(): Uint8Array {
    return new Uint8Array([(MqttPacketType.PINGRESP << 4) & 0xf0, 0x00]);
  }

  /**
   * Builds an MQTT DISCONNECT Packet (Type 14).
   */
  public static buildDisconnectPacket(): Uint8Array {
    return new Uint8Array([(MqttPacketType.DISCONNECT << 4) & 0xf0, 0x00]);
  }

  // --------------------------------------------------------------------------
  // Stream Packet Decoder
  // --------------------------------------------------------------------------

  /**
   * Decodes an MQTT packet from an incoming stream buffer.
   */
  public static decodePacket(data: Uint8Array): {
    valid: boolean;
    packet?: MqttPacket;
    remaining?: Uint8Array;
    error?: string;
  } {
    if (data.length < 2) {
      return { valid: false, remaining: data, error: "Buffer too short for MQTT fixed header" };
    }

    const firstByte = data[0];
    const type = (firstByte >> 4) as MqttPacketType;
    const flags = firstByte & 0x0f;

    let varInt: { value: number; bytesRead: number };
    try {
      varInt = this.decodeVariableByteInteger(data, 1);
    } catch {
      return { valid: false, remaining: data, error: "Incomplete Variable Byte Integer" };
    }

    const remainingLength = varInt.value;
    const headerSize = 1 + varInt.bytesRead;
    const totalPacketSize = headerSize + remainingLength;

    if (data.length < totalPacketSize) {
      return {
        valid: false,
        remaining: data,
        error: `Fragmented packet: received ${data.length} bytes, expected ${totalPacketSize}`,
      };
    }

    const packetBody = data.subarray(headerSize, totalPacketSize);
    const remaining = data.length > totalPacketSize ? data.subarray(totalPacketSize) : undefined;

    const packet: MqttPacket = {
      type,
      flags,
      remainingLength,
    };

    const view = new DataView(packetBody.buffer, packetBody.byteOffset, packetBody.byteLength);

    switch (type) {
      case MqttPacketType.CONNACK: {
        if (packetBody.length >= 2) {
          packet.sessionPresent = (packetBody[0] & 0x01) !== 0;
          packet.returnCode = packetBody[1] as MqttConnectReturnCode;
        }
        break;
      }

      case MqttPacketType.PUBLISH: {
        const qos = ((flags >> 1) & 0x03) as MqttQoS;
        const topicDec = this.decodeUtf8String(packetBody, 0);
        packet.topic = topicDec.str;
        let payloadOffset = topicDec.bytesRead;

        if (qos > 0) {
          if (packetBody.length < payloadOffset + 2) {
            return { valid: false, remaining, error: "Truncated packetId in PUBLISH" };
          }
          packet.packetId = view.getUint16(payloadOffset, false);
          payloadOffset += 2;
        }

        packet.payload = packetBody.subarray(payloadOffset);
        break;
      }

      case MqttPacketType.PUBACK: {
        if (packetBody.length >= 2) {
          packet.packetId = view.getUint16(0, false);
        }
        break;
      }

      case MqttPacketType.SUBACK: {
        if (packetBody.length >= 2) {
          packet.packetId = view.getUint16(0, false);
          const granted: MqttQoS[] = [];
          for (let i = 2; i < packetBody.length; i++) {
            granted.push(packetBody[i] as MqttQoS);
          }
          packet.grantedQos = granted;
        }
        break;
      }

      case MqttPacketType.PINGREQ:
      case MqttPacketType.PINGRESP:
      case MqttPacketType.DISCONNECT:
        break;

      default:
        packet.payload = packetBody;
        break;
    }

    return {
      valid: true,
      packet,
      remaining,
    };
  }
}
