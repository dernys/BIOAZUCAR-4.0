/**
 * BioAzúcar 4.0 — OPC UA TCP Binary Framing & Protocol Codec (IEC 62541-6)
 * 
 * Encodes and decodes OPC UA TCP frames:
 * - HEL (Hello) / ACK (Acknowledge) / ERR (Error)
 * - OPN (OpenSecureChannel)
 * - MSG (Message / Session service calls)
 * - CLO (CloseSecureChannel)
 */

import { OpcUaHelloMessage, OpcUaAcknowledgeMessage, OpcUaErrorMessage } from "./OpcUaTypes";

export class OpcUaBinaryCodec {
  public static readonly DEFAULT_BUFFER_SIZE = 65536; // 64 KiB standard
  public static readonly PROTOCOL_VERSION = 0;

  /**
   * Encodes a HEL (Hello) frame to initiate binary TCP handshake.
   */
  public static encodeHello(endpointUrl: string): Uint8Array {
    const urlBytes = new TextEncoder().encode(endpointUrl);
    // Header (8 bytes) + ProtocolVersion(4) + RecvBuf(4) + SendBuf(4) + MaxMsg(4) + MaxChunk(4) + UrlLen(4) + UrlBytes
    const totalSize = 8 + 24 + urlBytes.length;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // MessageType: 'H', 'E', 'L', 'F' (Final)
    bytes[0] = 0x48; // 'H'
    bytes[1] = 0x45; // 'E'
    bytes[2] = 0x4c; // 'L'
    bytes[3] = 0x46; // 'F'
    view.setUint32(4, totalSize, true); // MessageSize (Little-Endian)

    // Body
    view.setUint32(8, this.PROTOCOL_VERSION, true);
    view.setUint32(12, this.DEFAULT_BUFFER_SIZE, true); // ReceiveBufferSize
    view.setUint32(16, this.DEFAULT_BUFFER_SIZE, true); // SendBufferSize
    view.setUint32(20, 16777216, true); // MaxMessageSize (16 MiB)
    view.setUint32(24, 5000, true); // MaxChunkCount
    view.setUint32(28, urlBytes.length, true);
    bytes.set(urlBytes, 32);

    return bytes;
  }

  /**
   * Decodes an ACK (Acknowledge) frame received from the server.
   */
  public static decodeAcknowledge(frame: Uint8Array): OpcUaAcknowledgeMessage {
    if (frame.length < 28) {
      throw new Error(`Invalid OPC UA ACK frame: length ${frame.length} < 28 bytes`);
    }

    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const typeStr = String.fromCharCode(frame[0], frame[1], frame[2]);
    if (typeStr !== "ACK") {
      throw new Error(`Expected ACK frame, got '${typeStr}'`);
    }

    return {
      messageType: "ACK",
      protocolVersion: view.getUint32(8, true),
      receiveBufferSize: view.getUint32(12, true),
      sendBufferSize: view.getUint32(16, true),
      maxMessageSize: view.getUint32(20, true),
      maxChunkCount: view.getUint32(24, true),
    };
  }

  /**
   * Encodes an ACK frame (used by in-memory virtual reference server).
   */
  public static encodeAcknowledge(ack: Partial<OpcUaAcknowledgeMessage> = {}): Uint8Array {
    const totalSize = 28;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    bytes[0] = 0x41; // 'A'
    bytes[1] = 0x43; // 'C'
    bytes[2] = 0x4b; // 'K'
    bytes[3] = 0x46; // 'F'
    view.setUint32(4, totalSize, true);

    view.setUint32(8, ack.protocolVersion ?? this.PROTOCOL_VERSION, true);
    view.setUint32(12, ack.receiveBufferSize ?? this.DEFAULT_BUFFER_SIZE, true);
    view.setUint32(16, ack.sendBufferSize ?? this.DEFAULT_BUFFER_SIZE, true);
    view.setUint32(20, ack.maxMessageSize ?? 16777216, true);
    view.setUint32(24, ack.maxChunkCount ?? 5000, true);

    return bytes;
  }

  /**
   * Encodes a standard SecureChannel message frame (OPN or MSG).
   */
  public static encodeMessage(
    type: "OPN" | "MSG" | "CLO",
    secureChannelId: number,
    securityTokenId: number,
    sequenceNumber: number,
    requestId: number,
    payload: Record<string, any>
  ): Uint8Array {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
    // Header (8) + SecureChannelId(4) + SecurityTokenId(4) + SequenceNumber(4) + RequestId(4) + PayloadLen(4) + Payload
    const totalSize = 8 + 20 + jsonBytes.length;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    bytes[0] = type.charCodeAt(0);
    bytes[1] = type.charCodeAt(1);
    bytes[2] = type.charCodeAt(2);
    bytes[3] = 0x46; // 'F' (Final chunk)
    view.setUint32(4, totalSize, true);

    view.setUint32(8, secureChannelId, true);
    view.setUint32(12, securityTokenId, true);
    view.setUint32(16, sequenceNumber, true);
    view.setUint32(20, requestId, true);
    view.setUint32(24, jsonBytes.length, true);
    bytes.set(jsonBytes, 28);

    return bytes;
  }

  /**
   * Decodes a standard SecureChannel message frame.
   */
  public static decodeMessage(frame: Uint8Array): {
    messageType: string;
    chunkType: string;
    messageSize: number;
    secureChannelId: number;
    securityTokenId: number;
    sequenceNumber: number;
    requestId: number;
    payload: any;
  } {
    if (frame.length < 28) {
      throw new Error(`OPC UA Message frame too short: ${frame.length} < 28 bytes`);
    }

    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const messageType = String.fromCharCode(frame[0], frame[1], frame[2]);
    const chunkType = String.fromCharCode(frame[3]);
    const messageSize = view.getUint32(4, true);

    const secureChannelId = view.getUint32(8, true);
    const securityTokenId = view.getUint32(12, true);
    const sequenceNumber = view.getUint32(16, true);
    const requestId = view.getUint32(20, true);
    const payloadLen = view.getUint32(24, true);

    const payloadBytes = frame.slice(28, 28 + payloadLen);
    const jsonStr = new TextDecoder().decode(payloadBytes);
    let payload: any = {};
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      payload = { raw: jsonStr };
    }

    return {
      messageType,
      chunkType,
      messageSize,
      secureChannelId,
      securityTokenId,
      sequenceNumber,
      requestId,
      payload,
    };
  }
}
