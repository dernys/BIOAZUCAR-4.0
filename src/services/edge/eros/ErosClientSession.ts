/**
 * BioAzúcar 4.0 — DCS EROS Client Protocol Session Manager
 * 
 * Manages stateful DCS EROS sessions, transaction tracking via 16-bit sequence numbers,
 * stream packet reassembly, CRC-16 validation, and decoupled explicit messaging.
 */

import { ITransportLayer } from "../transport/ITransportLayer";
import {
  ErosCommandCode,
  ErosStatusCode,
  ErosAreaType,
  ErosDataType,
  getErosStatusDescription,
} from "./ErosTypes";
import { ErosBinaryCodec } from "./ErosBinaryCodec";

export type ErosSessionState =
  | "DISCONNECTED"
  | "CONNECTING_TRANSPORT"
  | "VERIFYING_STATION"
  | "READY"
  | "FAULTED";

interface PendingTransaction {
  sequence: number;
  expectedCommand: ErosCommandCode;
  resolve: (payload: Uint8Array) => void;
  reject: (err: Error) => void;
  timeoutTimer: NodeJS.Timeout;
}

export class ErosClientSession {
  private transport: ITransportLayer;
  private state: ErosSessionState = "DISCONNECTED";
  private stationId: number;
  private timeoutMs: number;
  private sequenceCounter: number = 1;

  private receiveBuffer: Uint8Array = new Uint8Array(0);
  private pendingTransactions = new Map<number, PendingTransaction>();

  constructor(transport: ITransportLayer, stationId: number = 1, timeoutMs: number = 3000) {
    this.transport = transport;
    this.stationId = stationId;
    this.timeoutMs = timeoutMs;

    this.transport.onData((chunk) => this.handleIncomingChunk(chunk));
    this.transport.onStateChange((_oldState, newState) => {
      if (newState === "FAULTED") {
        this.handleTransportLoss("Transport state transitioned to FAULTED");
      } else if (newState === "DISCONNECTED") {
        if (this.state !== "DISCONNECTED") {
          this.handleTransportLoss("Transport disconnected unexpectedly");
        }
      }
    });
  }

  public get sessionState(): ErosSessionState {
    return this.state;
  }

  public get isConnected(): boolean {
    return this.state === "READY";
  }

  public get activeStationId(): number {
    return this.stationId;
  }

  public async connect(): Promise<boolean> {
    if (this.state === "READY") return true;

    this.state = "CONNECTING_TRANSPORT";
    const transportOk = await this.transport.connect();
    if (!transportOk) {
      this.state = "FAULTED";
      throw new Error(
        `Failed to establish TCP transport to EROS gateway ${this.transport.options.host}:${this.transport.options.port}`
      );
    }

    try {
      this.state = "VERIFYING_STATION";
      const pingOk = await this.ping();
      if (!pingOk) {
        throw new Error(`EROS station ${this.stationId} did not respond to heartbeat verification`);
      }

      this.state = "READY";
      return true;
    } catch (err: any) {
      this.state = "FAULTED";
      await this.transport.disconnect("EROS station verification failed");
      throw err;
    }
  }

  public async disconnect(reason: string = "Normal disconnect"): Promise<void> {
    this.state = "DISCONNECTED";
    this.abortAllTransactions(new Error(`Session disconnected: ${reason}`));
    this.receiveBuffer = new Uint8Array(0);
    await this.transport.disconnect(reason);
  }

  /**
   * Pings the EROS DCS station via heartbeat (Command 0x05).
   */
  public async ping(): Promise<boolean> {
    const seq = this.nextSequence();
    const packet = ErosBinaryCodec.buildHeartbeatPacket(seq, this.stationId);

    try {
      const respPayload = await this.sendAndWait(
        packet,
        seq,
        ErosCommandCode.HEARTBEAT_RESPONSE,
        this.timeoutMs
      );
      return respPayload.length > 0 && respPayload[0] === ErosStatusCode.SUCCESS;
    } catch {
      return false;
    }
  }

  /**
   * Reads a variable from EROS DCS station memory.
   */
  public async readVariable(
    dbNumber: number,
    areaType: ErosAreaType,
    offset: number,
    bitIndex: number = 0
  ): Promise<{ value: number | boolean | string; dataType: ErosDataType }> {
    if (this.state !== "READY") {
      throw new Error(`Cannot read variable: EROS session is ${this.state}`);
    }

    const seq = this.nextSequence();
    const packet = ErosBinaryCodec.buildReadVariableRequest(
      seq,
      dbNumber,
      areaType,
      offset,
      bitIndex,
      this.stationId
    );

    const respPayload = await this.sendAndWait(
      packet,
      seq,
      ErosCommandCode.READ_VARIABLE_RESPONSE,
      this.timeoutMs
    );

    if (respPayload.length < 2) {
      throw new Error("Truncated Read Variable response from EROS DCS");
    }

    const status = respPayload[0] as ErosStatusCode;
    if (status !== ErosStatusCode.SUCCESS) {
      throw new Error(`EROS Read Error: ${getErosStatusDescription(status)}`);
    }

    const dataType = respPayload[1] as ErosDataType;
    const valueBytes = respPayload.subarray(2);
    const value = ErosBinaryCodec.decodeValue(valueBytes, dataType);

    return { value, dataType };
  }

  /**
   * Writes a variable to EROS DCS station memory.
   */
  public async writeVariable(
    dbNumber: number,
    areaType: ErosAreaType,
    offset: number,
    value: number | boolean | string,
    dataType: ErosDataType,
    bitIndex: number = 0
  ): Promise<boolean> {
    if (this.state !== "READY") {
      throw new Error(`Cannot write variable: EROS session is ${this.state}`);
    }

    const seq = this.nextSequence();
    const valueBytes = ErosBinaryCodec.encodeValue(value, dataType);
    const packet = ErosBinaryCodec.buildWriteVariableRequest(
      seq,
      dbNumber,
      areaType,
      offset,
      dataType,
      valueBytes,
      bitIndex,
      this.stationId
    );

    const respPayload = await this.sendAndWait(
      packet,
      seq,
      ErosCommandCode.WRITE_VARIABLE_RESPONSE,
      this.timeoutMs
    );

    if (respPayload.length < 1) {
      throw new Error("Truncated Write Variable response from EROS DCS");
    }

    const status = respPayload[0] as ErosStatusCode;
    if (status !== ErosStatusCode.SUCCESS) {
      throw new Error(`EROS Write Error: ${getErosStatusDescription(status)}`);
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private nextSequence(): number {
    const s = this.sequenceCounter;
    this.sequenceCounter = (this.sequenceCounter + 1) & 0xffff;
    if (this.sequenceCounter === 0) this.sequenceCounter = 1;
    return s;
  }

  private sendAndWait(
    packet: Uint8Array,
    sequence: number,
    expectedCommand: ErosCommandCode,
    timeoutMs: number
  ): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTransactions.delete(sequence);
        reject(
          new Error(
            `EROS request seq ${sequence} timed out after ${timeoutMs}ms (cmd 0x${expectedCommand.toString(16)})`
          )
        );
      }, timeoutMs);

      this.pendingTransactions.set(sequence, {
        sequence,
        expectedCommand,
        resolve,
        reject,
        timeoutTimer: timer,
      });

      this.transport.send(packet).catch((err) => {
        clearTimeout(timer);
        this.pendingTransactions.delete(sequence);
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

    while (this.receiveBuffer.length >= 9) {
      const decoded = ErosBinaryCodec.decodePacket(this.receiveBuffer);
      if (!decoded.valid) {
        if (decoded.remaining) {
          this.receiveBuffer = decoded.remaining;
        }
        break;
      }

      this.receiveBuffer = decoded.remaining || new Uint8Array(0);

      const packet = decoded.packet!;
      const pending = this.pendingTransactions.get(packet.header.sequence);

      if (pending) {
        clearTimeout(pending.timeoutTimer);
        this.pendingTransactions.delete(packet.header.sequence);

        if (packet.header.command !== pending.expectedCommand) {
          pending.reject(
            new Error(
              `Unexpected response command 0x${packet.header.command.toString(16)}, expected 0x${pending.expectedCommand.toString(16)}`
            )
          );
        } else {
          pending.resolve(packet.payload);
        }
      }
    }
  }

  private handleTransportLoss(reason: string): void {
    this.state = "FAULTED";
    this.abortAllTransactions(new Error(`EROS physical link lost: ${reason}`));
  }

  private abortAllTransactions(err: Error): void {
    for (const tx of this.pendingTransactions.values()) {
      clearTimeout(tx.timeoutTimer);
      tx.reject(err);
    }
    this.pendingTransactions.clear();
  }
}
