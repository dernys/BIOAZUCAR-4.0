/**
 * BioAzúcar 4.0 — Siemens S7 Protocol Client Session Manager
 * 
 * Manages the stateful connection lifecycle for Siemens S7 PLCs:
 * 1. Physical Layer: Decoupled transport over ITransportLayer (TCP 102 / Loopback)
 * 2. COTP Handshake: Connection Request (CR) -> Connection Confirm (CC) with TSAP negotiation
 * 3. S7 Comm Handshake: Setup Communication (FC 0xF0) -> Setup Comm Ack_Data (negotiates PDU length)
 * 4. Operational Requests: Concurrent read/write with PDU Reference matching & timeouts
 * 5. Link Severance & Auto-Recovery: Transparent session re-establishment upon transport reconnect
 */

import { ITransportLayer } from "../transport/ITransportLayer";
import {
  S7ConnectionParameters,
  computeS7Tsap,
  CotpPduType,
  S7ReturnCode,
  getS7ReturnCodeDescription,
  S7AreaCode,
  S7TransportSize,
  parseS7Address,
} from "./S7Types";
import {
  S7BinaryCodec,
  S7ReadItem,
  S7WriteItem,
} from "./S7BinaryCodec";

export type S7SessionState =
  | "DISCONNECTED"
  | "CONNECTING_TRANSPORT"
  | "COTP_HANDSHAKE"
  | "S7_SETUP_COMM"
  | "READY"
  | "FAULTED";

interface PendingRequest {
  pduReference: number;
  resolve: (pdu: Uint8Array) => void;
  reject: (err: Error) => void;
  timer: any;
}

export class S7ClientSession {
  private transport: ITransportLayer;
  private params: S7ConnectionParameters;
  private timeoutMs: number;

  private state: S7SessionState = "DISCONNECTED";
  private pduRefCounter = 1;
  private pendingRequests = new Map<number, PendingRequest>();

  private negotiatedPduLength = 480;
  private maxAmqCaller = 8;
  private maxAmqCallee = 8;

  private rxBuffer = new Uint8Array(0);

  // COTP handshake pending promise
  private cotpResolver: (() => void) | null = null;
  private cotpRejecter: ((err: Error) => void) | null = null;

  // S7 setup comm pending promise
  private setupResolver: (() => void) | null = null;
  private setupRejecter: ((err: Error) => void) | null = null;

  constructor(
    transport: ITransportLayer,
    params: Partial<S7ConnectionParameters> = {},
    timeoutMs: number = 3000
  ) {
    this.transport = transport;
    this.params = {
      rack: params.rack ?? 0,
      slot: params.slot ?? 1,
      connectionType: params.connectionType ?? 0x03,
      pduSize: params.pduSize ?? 480,
      maxAmqCaller: params.maxAmqCaller ?? 8,
      maxAmqCallee: params.maxAmqCallee ?? 8,
    };
    this.timeoutMs = timeoutMs;

    this.transport.onData((chunk) => this.handleIncomingChunk(chunk));
    this.transport.onStateChange((_oldState, newState) => {
      if (newState === "FAULTED") {
        this.handleTransportLoss(`Transport state transitioned to ${newState}`);
      } else if (newState === "DISCONNECTED") {
        if (this.state !== "DISCONNECTED") {
          this.handleTransportLoss("Transport disconnected unexpectedly");
        }
      }
    });
  }

  public get sessionState(): S7SessionState {
    return this.state;
  }

  public get isConnected(): boolean {
    return this.state === "READY";
  }

  public get pduLength(): number {
    return this.negotiatedPduLength;
  }

  /**
   * Connects the underlying transport and performs both COTP and S7 handshakes.
   */
  public async connect(): Promise<boolean> {
    if (this.state === "READY") return true;

    this.state = "CONNECTING_TRANSPORT";
    const transportOk = await this.transport.connect();
    if (!transportOk) {
      this.state = "FAULTED";
      throw new Error(`Failed to establish TCP transport to ${this.transport.options.host}:${this.transport.options.port}`);
    }

    try {
      // Step 1: COTP Connection Request
      this.state = "COTP_HANDSHAKE";
      await this.executeCotpHandshake();

      // Step 2: S7 Setup Communication
      this.state = "S7_SETUP_COMM";
      await this.executeSetupCommunication();

      this.state = "READY";
      return true;
    } catch (err: any) {
      this.state = "FAULTED";
      await this.transport.disconnect(`S7 Handshake failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Gracefully disconnects session and underlying transport.
   */
  public async disconnect(reason: string = "User initiated disconnect"): Promise<void> {
    this.state = "DISCONNECTED";
    this.rejectAllPending(new Error(`Session disconnected: ${reason}`));
    this.rxBuffer = new Uint8Array(0);
    await this.transport.disconnect(reason);
  }

  /**
   * Executes S7 Read Variable (FC 0x04) and returns the raw data bytes.
   */
  public async readBytes(
    areaCode: S7AreaCode,
    dbNumber: number,
    byteOffset: number,
    byteCount: number,
    bitOffset: number = 0,
    transportSize: S7TransportSize = S7TransportSize.BYTE
  ): Promise<Uint8Array> {
    if (this.state !== "READY") {
      throw new Error(`Cannot read S7 variable: Session is in state ${this.state}`);
    }

    const pduRef = this.nextPduReference();
    const item: S7ReadItem = {
      areaCode,
      dbNumber,
      byteOffset,
      bitOffset,
      count: byteCount,
      transportSize,
    };

    const s7Pdu = S7BinaryCodec.buildReadVarPdu(pduRef, [item]);
    const tpktFrame = S7BinaryCodec.buildCotpDataFrame(s7Pdu);

    const responsePdu = await this.sendS7Request(pduRef, tpktFrame);
    const readResults = S7BinaryCodec.decodeReadVarResponse(responsePdu);

    if (readResults.length === 0) {
      throw new Error("Empty read response from S7 PLC");
    }

    const res = readResults[0];
    if (res.returnCode !== S7ReturnCode.SUCCESS) {
      throw new Error(`S7 Read Error: ${getS7ReturnCodeDescription(res.returnCode)}`);
    }

    return res.data;
  }

  /**
   * Executes S7 Write Variable (FC 0x05).
   */
  public async writeBytes(
    areaCode: S7AreaCode,
    dbNumber: number,
    byteOffset: number,
    data: Uint8Array,
    bitOffset: number = 0,
    transportSize: S7TransportSize = S7TransportSize.BYTE
  ): Promise<boolean> {
    if (this.state !== "READY") {
      throw new Error(`Cannot write S7 variable: Session is in state ${this.state}`);
    }

    const pduRef = this.nextPduReference();
    const item: S7WriteItem = {
      areaCode,
      dbNumber,
      byteOffset,
      bitOffset,
      count: data.length,
      transportSize,
      data,
    };

    const s7Pdu = S7BinaryCodec.buildWriteVarPdu(pduRef, [item]);
    const tpktFrame = S7BinaryCodec.buildCotpDataFrame(s7Pdu);

    const responsePdu = await this.sendS7Request(pduRef, tpktFrame);
    const returnCodes = S7BinaryCodec.decodeWriteVarResponse(responsePdu);

    if (returnCodes.length === 0) {
      throw new Error("Empty write response from S7 PLC");
    }

    const code = returnCodes[0];
    if (code !== S7ReturnCode.SUCCESS) {
      throw new Error(`S7 Write Error: ${getS7ReturnCodeDescription(code)}`);
    }

    return true;
  }

  /**
   * High-level read for canonical address string.
   */
  public async readTag(rawAddress: string): Promise<number | boolean> {
    const parsed = parseS7Address(rawAddress);
    const bytes = await this.readBytes(
      parsed.areaCode,
      parsed.dbNumber || 0,
      parsed.byteOffset,
      parsed.lengthBytes,
      parsed.bitOffset,
      parsed.transportSize
    );
    return S7BinaryCodec.decodeBytesToValue(bytes, parsed.dataType, parsed.bitOffset);
  }

  /**
   * High-level write for canonical address string.
   */
  public async writeTag(rawAddress: string, value: number | boolean): Promise<boolean> {
    const parsed = parseS7Address(rawAddress);
    const bytes = S7BinaryCodec.encodeValueToBytes(value, parsed.dataType, parsed.bitOffset);
    return this.writeBytes(
      parsed.areaCode,
      parsed.dbNumber || 0,
      parsed.byteOffset,
      bytes,
      parsed.bitOffset,
      parsed.transportSize
    );
  }

  // --------------------------------------------------------------------------
  // Private Protocol Handlers
  // --------------------------------------------------------------------------

  private executeCotpHandshake(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cotpResolver = null;
        this.cotpRejecter = null;
        reject(new Error(`COTP Handshake Timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.cotpResolver = () => {
        clearTimeout(timer);
        this.cotpResolver = null;
        this.cotpRejecter = null;
        resolve();
      };

      this.cotpRejecter = (err) => {
        clearTimeout(timer);
        this.cotpResolver = null;
        this.cotpRejecter = null;
        reject(err);
      };

      const { callingTsap, calledTsap } = computeS7Tsap(
        this.params.rack,
        this.params.slot,
        this.params.connectionType
      );

      const crFrame = S7BinaryCodec.buildCotpConnectionRequest(callingTsap, calledTsap);
      this.transport.send(crFrame).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private executeSetupCommunication(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const pduRef = this.nextPduReference();
      const setupPdu = S7BinaryCodec.buildSetupCommunicationPdu(
        pduRef,
        this.params.maxAmqCaller,
        this.params.maxAmqCallee,
        this.params.pduSize
      );
      const tpktFrame = S7BinaryCodec.buildCotpDataFrame(setupPdu);

      const timer = setTimeout(() => {
        this.pendingRequests.delete(pduRef);
        reject(new Error(`S7 Setup Communication Timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pendingRequests.set(pduRef, {
        pduReference: pduRef,
        resolve: (ackPdu) => {
          clearTimeout(timer);
          try {
            const decoded = S7BinaryCodec.decodeS7Pdu(ackPdu);
            if (decoded.errorClass !== 0 || decoded.errorCode !== 0) {
              reject(new Error(`S7 Setup Comm Rejected: Error Class 0x${decoded.errorClass.toString(16)}`));
              return;
            }
            if (decoded.paramData.length >= 8) {
              const view = new DataView(decoded.paramData.buffer, decoded.paramData.byteOffset);
              this.maxAmqCaller = view.getUint16(2, false);
              this.maxAmqCallee = view.getUint16(4, false);
              this.negotiatedPduLength = view.getUint16(6, false);
            }
            resolve();
          } catch (err: any) {
            reject(err);
          }
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });

      this.transport.send(tpktFrame).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(pduRef);
        reject(err);
      });
    });
  }

  private sendS7Request(pduReference: number, frame: Uint8Array): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(pduReference);
        reject(new Error(`S7 Request (ref ${pduReference}) timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pendingRequests.set(pduReference, {
        pduReference,
        resolve: (pdu) => {
          clearTimeout(timer);
          resolve(pdu);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });

      this.transport.send(frame).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(pduReference);
        reject(err);
      });
    });
  }

  private handleIncomingChunk(chunk: Uint8Array): void {
    // Append chunk to rxBuffer
    const combined = new Uint8Array(this.rxBuffer.length + chunk.length);
    combined.set(this.rxBuffer, 0);
    combined.set(chunk, this.rxBuffer.length);
    this.rxBuffer = combined;

    // Process all complete TPKT frames in buffer
    while (this.rxBuffer.length >= 4) {
      const decodedTpkt = S7BinaryCodec.decodeTpktFrame(this.rxBuffer);
      if (!decodedTpkt.valid) {
        if (decodedTpkt.error?.includes("Fragmented")) {
          // Await more data
          break;
        } else {
          // Corrupted stream, discard 1 byte to seek next 0x03 marker
          this.rxBuffer = this.rxBuffer.subarray(1);
          continue;
        }
      }

      // Slice out processed frame
      const framePayload = decodedTpkt.payload;
      this.rxBuffer = this.rxBuffer.subarray(decodedTpkt.totalLength);

      this.dispatchTpktPayload(framePayload);
    }
  }

  private dispatchTpktPayload(payload: Uint8Array): void {
    try {
      const cotp = S7BinaryCodec.decodeCotp(payload);

      // Handle COTP Connection Confirm (CC)
      if (cotp.pduType === CotpPduType.CC) {
        if (this.cotpResolver) {
          this.cotpResolver();
        }
        return;
      }

      // Handle COTP Data Transfer (DT) -> S7 PDU
      if (cotp.pduType === CotpPduType.DT) {
        const s7Pdu = cotp.userData;
        if (s7Pdu.length < 10) return;

        const decodedHeader = S7BinaryCodec.decodeS7Pdu(s7Pdu);
        const req = this.pendingRequests.get(decodedHeader.pduReference);
        if (req) {
          this.pendingRequests.delete(decodedHeader.pduReference);
          req.resolve(s7Pdu);
        }
      }
    } catch (err: any) {
      if (this.cotpRejecter) {
        this.cotpRejecter(err);
      }
    }
  }

  private handleTransportLoss(reason: string): void {
    this.state = "FAULTED";
    this.rejectAllPending(new Error(`S7 connection lost: ${reason}`));
  }

  private rejectAllPending(err: Error): void {
    if (this.cotpRejecter) {
      this.cotpRejecter(err);
      this.cotpResolver = null;
      this.cotpRejecter = null;
    }
    for (const req of this.pendingRequests.values()) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    this.pendingRequests.clear();
  }

  private nextPduReference(): number {
    const ref = this.pduRefCounter;
    this.pduRefCounter = (this.pduRefCounter % 65535) + 1;
    return ref;
  }
}
