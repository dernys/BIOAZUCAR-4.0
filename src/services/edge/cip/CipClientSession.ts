/**
 * BioAzúcar 4.0 — Rockwell EtherNet/IP & CIP Client Session Manager
 * 
 * Manages stateful CIP sessions, transaction tracking via 8-byte sender context,
 * streaming packet reassembly, and explicit messaging over decoupled ITransportLayer.
 */

import { ITransportLayer } from "../transport/ITransportLayer";
import {
  EipCommand,
  EipStatus,
  CpfTypeId,
  CipGeneralStatus,
  CipStandardDataType,
  getCipStatusDescription,
  getCipDataTypeName,
} from "./CipTypes";
import { CipBinaryCodec } from "./CipBinaryCodec";

export type CipSessionState =
  | "DISCONNECTED"
  | "CONNECTING_TRANSPORT"
  | "REGISTERING_SESSION"
  | "READY"
  | "FAULTED";

interface PendingTransaction {
  senderContextKey: string;
  expectedCommand: number;
  resolve: (payload: Uint8Array) => void;
  reject: (err: Error) => void;
  timeoutTimer: NodeJS.Timeout;
}

export class CipClientSession {
  private transport: ITransportLayer;
  private state: CipSessionState = "DISCONNECTED";
  private sessionHandle: number = 0;
  private timeoutMs: number;
  private contextCounter: number = 1;

  private receiveBuffer: Uint8Array = new Uint8Array(0);
  private pendingTransactions = new Map<string, PendingTransaction>();

  constructor(transport: ITransportLayer, timeoutMs: number = 3000) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;

    this.transport.onData((chunk) => this.handleIncomingChunk(chunk));
    this.transport.onStateChange((_oldState, newState) => {
      if (newState === "FAULTED") {
        this.handleTransportLoss(`Transport state transitioned to FAULTED`);
      } else if (newState === "DISCONNECTED") {
        if (this.state !== "DISCONNECTED") {
          this.handleTransportLoss("Transport disconnected unexpectedly");
        }
      }
    });
  }

  public get sessionState(): CipSessionState {
    return this.state;
  }

  public get isConnected(): boolean {
    return this.state === "READY";
  }

  public get activeSessionHandle(): number {
    return this.sessionHandle;
  }

  public async connect(): Promise<boolean> {
    if (this.state === "READY") return true;

    this.state = "CONNECTING_TRANSPORT";
    const transportOk = await this.transport.connect();
    if (!transportOk) {
      this.state = "FAULTED";
      throw new Error(
        `Failed to establish TCP transport to ${this.transport.options.host}:${this.transport.options.port}`
      );
    }

    try {
      this.state = "REGISTERING_SESSION";
      const context = this.generateSenderContext();
      const regPacket = CipBinaryCodec.buildRegisterSessionPacket(context);

      const respPayload = await this.sendAndWait(
        regPacket,
        context,
        EipCommand.REGISTER_SESSION,
        this.timeoutMs
      );

      // On RegisterSession success, sessionHandle is extracted from header in sendAndWait
      if (this.sessionHandle === 0) {
        throw new Error("RegisterSession returned invalid session handle 0");
      }

      this.state = "READY";
      return true;
    } catch (err: any) {
      this.state = "FAULTED";
      await this.transport.disconnect("CIP RegisterSession handshake failed");
      throw err;
    }
  }

  public async disconnect(reason: string = "Normal disconnect"): Promise<void> {
    if (this.sessionHandle !== 0 && this.transport.state === "CONNECTED") {
      try {
        const unregPacket = CipBinaryCodec.buildUnRegisterSessionPacket(this.sessionHandle);
        await this.transport.send(unregPacket);
      } catch {
        // Best-effort unregister
      }
    }

    this.sessionHandle = 0;
    this.state = "DISCONNECTED";
    this.abortAllTransactions(new Error(`Session disconnected: ${reason}`));
    this.receiveBuffer = new Uint8Array(0);
    await this.transport.disconnect(reason);
  }

  /**
   * Reads a symbolic tag from the Logix controller using CIP Read Tag Service (0x4C).
   */
  public async readTag(
    tagName: string
  ): Promise<{ value: number | boolean | string; dataType: CipStandardDataType }> {
    if (this.state !== "READY" || this.sessionHandle === 0) {
      throw new Error(`Cannot read tag '${tagName}': CIP session is ${this.state}`);
    }

    const cipReq = CipBinaryCodec.buildReadTagRequest(tagName, 1);
    const context = this.generateSenderContext();
    const packet = CipBinaryCodec.buildSendRRDataPacket(
      this.sessionHandle,
      cipReq,
      context,
      Math.floor(this.timeoutMs / 1000)
    );

    const respBytes = await this.sendAndWait(
      packet,
      context,
      EipCommand.SEND_RR_DATA,
      this.timeoutMs
    );

    const cpf = CipBinaryCodec.decodeCpfPacket(respBytes);
    const dataItem = cpf.items.find((it) => it.typeId === CpfTypeId.UNCONNECTED_DATA);
    if (!dataItem) {
      throw new Error("Missing Unconnected Data item in CIP SendRRData response");
    }

    const cipResp = CipBinaryCodec.decodeCipResponse(dataItem.data);
    if (cipResp.generalStatus !== CipGeneralStatus.SUCCESS) {
      const desc = getCipStatusDescription(cipResp.generalStatus);
      throw new Error(`CIP Read failed for '${tagName}': ${desc}`);
    }

    const typeCode = cipResp.dataType ?? 0x00ca;
    const typeName = getCipDataTypeName(typeCode);
    const val = CipBinaryCodec.decodeBytesToValue(cipResp.data, typeName);

    return { value: val, dataType: typeName };
  }

  /**
   * Writes a value to a symbolic tag on the Logix controller using CIP Write Tag Service (0x4D).
   */
  public async writeTag(
    tagName: string,
    value: number | boolean | string,
    dataType?: CipStandardDataType
  ): Promise<boolean> {
    if (this.state !== "READY" || this.sessionHandle === 0) {
      throw new Error(`Cannot write tag '${tagName}': CIP session is ${this.state}`);
    }

    let resolvedType: CipStandardDataType = dataType || "REAL";
    if (!dataType) {
      if (typeof value === "boolean") resolvedType = "BOOL";
      else if (typeof value === "string") resolvedType = "STRING";
      else if (Number.isInteger(value)) resolvedType = "DINT";
      else resolvedType = "REAL";
    }

    const cipReq = CipBinaryCodec.buildWriteTagRequest(tagName, value, resolvedType, 1);
    const context = this.generateSenderContext();
    const packet = CipBinaryCodec.buildSendRRDataPacket(
      this.sessionHandle,
      cipReq,
      context,
      Math.floor(this.timeoutMs / 1000)
    );

    const respBytes = await this.sendAndWait(
      packet,
      context,
      EipCommand.SEND_RR_DATA,
      this.timeoutMs
    );

    const cpf = CipBinaryCodec.decodeCpfPacket(respBytes);
    const dataItem = cpf.items.find((it) => it.typeId === CpfTypeId.UNCONNECTED_DATA);
    if (!dataItem) {
      throw new Error("Missing Unconnected Data item in CIP SendRRData response");
    }

    const cipResp = CipBinaryCodec.decodeCipResponse(dataItem.data);
    if (cipResp.generalStatus !== CipGeneralStatus.SUCCESS) {
      const desc = getCipStatusDescription(cipResp.generalStatus);
      throw new Error(`CIP Write failed for '${tagName}': ${desc}`);
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private generateSenderContext(): Uint8Array {
    const ctx = new Uint8Array(8);
    const view = new DataView(ctx.buffer);
    view.setUint32(0, 0x42494f41, true); // "BIOA" signature
    view.setUint32(4, this.contextCounter++, true);
    return ctx;
  }

  private contextToKey(context: Uint8Array): string {
    return Array.from(context)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private sendAndWait(
    packet: Uint8Array,
    context: Uint8Array,
    expectedCommand: number,
    timeoutMs: number
  ): Promise<Uint8Array> {
    const key = this.contextToKey(context);

    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTransactions.delete(key);
        reject(
          new Error(
            `CIP request timed out after ${timeoutMs}ms (command 0x${expectedCommand.toString(16)})`
          )
        );
      }, timeoutMs);

      this.pendingTransactions.set(key, {
        senderContextKey: key,
        expectedCommand,
        resolve,
        reject,
        timeoutTimer: timer,
      });

      this.transport.send(packet).catch((err) => {
        clearTimeout(timer);
        this.pendingTransactions.delete(key);
        reject(err);
      });
    });
  }

  private handleIncomingChunk(chunk: Uint8Array): void {
    if (this.receiveBuffer.length === 0) {
      this.receiveBuffer = chunk;
    } else {
      const merged = new Uint8Array(this.receiveBuffer.length + chunk.length);
      merged.set(this.receiveBuffer, 0);
      merged.set(chunk, this.receiveBuffer.length);
      this.receiveBuffer = merged;
    }

    while (this.receiveBuffer.length >= CipBinaryCodec.ENCAPSULATION_HEADER_LEN) {
      const decoded = CipBinaryCodec.decodeEncapsulationPacket(this.receiveBuffer);
      if (!decoded.valid) {
        // Wait for more chunks if fragmented
        break;
      }

      this.receiveBuffer = decoded.remaining || new Uint8Array(0);

      // Handle decoded packet
      const header = decoded.header;
      if (header.command === EipCommand.REGISTER_SESSION) {
        this.sessionHandle = header.sessionHandle;
      }

      const key = this.contextToKey(header.senderContext);
      const pending = this.pendingTransactions.get(key);

      if (pending) {
        clearTimeout(pending.timeoutTimer);
        this.pendingTransactions.delete(key);

        if (header.status !== EipStatus.SUCCESS) {
          pending.reject(
            new Error(
              `EtherNet/IP error status: 0x${header.status.toString(16).padStart(8, "0")}`
            )
          );
        } else {
          pending.resolve(decoded.payload);
        }
      }
    }
  }

  private handleTransportLoss(reason: string): void {
    this.state = "FAULTED";
    this.abortAllTransactions(new Error(`Physical link lost: ${reason}`));
  }

  private abortAllTransactions(err: Error): void {
    for (const tx of this.pendingTransactions.values()) {
      clearTimeout(tx.timeoutTimer);
      tx.reject(err);
    }
    this.pendingTransactions.clear();
  }
}
