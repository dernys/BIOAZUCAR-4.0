/**
 * BioAzúcar 4.0 — Modbus Client Session (Capa 2 de Protocolo OT)
 * 
 * Manages request-response lifecycle, transaction tracking, timeouts,
 * and exception translation over an ITransportLayer (TCP or Virtual Loopback).
 */

import { ITransportLayer, TransportState } from "../transport/ITransportLayer";
import { ModbusBinaryCodec } from "./ModbusBinaryCodec";
import {
  ModbusExceptionCode,
  getModbusExceptionDescription,
  ModbusFunctionCode,
} from "./ModbusTypes";

export interface ModbusSessionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  defaultUnitId?: number;
}

interface PendingTransaction {
  transactionId: number;
  unitId: number;
  expectedFunctionCode: number;
  resolve: (data: Uint8Array) => void;
  reject: (err: Error) => void;
  timeoutTimer: NodeJS.Timeout;
}

export class ModbusClientSession {
  private transport: ITransportLayer;
  private options: Required<ModbusSessionOptions>;
  private transactionCounter = 0;
  private pendingTransactions = new Map<number, PendingTransaction>();
  private incomingBuffer = new Uint8Array(0);

  constructor(transport: ITransportLayer, options?: ModbusSessionOptions) {
    this.transport = transport;
    this.options = {
      timeoutMs: options?.timeoutMs ?? 3000,
      maxRetries: options?.maxRetries ?? 2,
      defaultUnitId: options?.defaultUnitId ?? 1,
    };

    // Bind transport callbacks
    this.transport.onData((data) => this.handleIncomingData(data));
    this.transport.onStateChange((oldState, newState) => this.handleStateChange(oldState, newState));
    this.transport.onError((err) => this.handleTransportError(err));
  }

  public get isConnected(): boolean {
    return this.transport.state === "CONNECTED";
  }

  public get transportState(): TransportState {
    return this.transport.state;
  }

  private getNextTransactionId(): number {
    this.transactionCounter = (this.transactionCounter + 1) & 0xffff;
    return this.transactionCounter;
  }

  private handleStateChange(_oldState: TransportState, newState: TransportState): void {
    if (newState === "DISCONNECTED" || newState === "FAULTED") {
      this.rejectAllPending(new Error(`Modbus transport disconnected (${newState})`));
    }
  }

  private handleTransportError(err: Error): void {
    this.rejectAllPending(new Error(`Modbus transport error: ${err.message}`));
  }

  private rejectAllPending(err: Error): void {
    for (const [txId, pending] of this.pendingTransactions.entries()) {
      clearTimeout(pending.timeoutTimer);
      pending.reject(err);
      this.pendingTransactions.delete(txId);
    }
  }

  /**
   * Appends incoming bytes and parses complete Modbus TCP frames.
   */
  private handleIncomingData(chunk: Uint8Array): void {
    // Concatenate chunk to buffer
    const merged = new Uint8Array(this.incomingBuffer.length + chunk.length);
    merged.set(this.incomingBuffer);
    merged.set(chunk, this.incomingBuffer.length);
    this.incomingBuffer = merged;

    // Process all complete frames in incomingBuffer
    while (this.incomingBuffer.length >= 7) {
      const view = new DataView(
        this.incomingBuffer.buffer,
        this.incomingBuffer.byteOffset,
        this.incomingBuffer.byteLength
      );
      const length = view.getUint16(4, false); // Length field includes unitId + PDU
      const totalFrameSize = 6 + length;      // 6 bytes (txId + protocolId + length) + length

      if (this.incomingBuffer.length < totalFrameSize) {
        // Frame incomplete, wait for next chunk
        break;
      }

      // Slice out the complete frame
      const frame = this.incomingBuffer.subarray(0, totalFrameSize);
      this.incomingBuffer = this.incomingBuffer.subarray(totalFrameSize);

      this.processFrame(frame);
    }
  }

  private processFrame(frame: Uint8Array): void {
    try {
      const response = ModbusBinaryCodec.decodeTcpResponse(frame);
      const pending = this.pendingTransactions.get(response.transactionId);

      if (!pending) {
        // Unmatched transaction ID (possibly timed out), discard safely
        return;
      }

      clearTimeout(pending.timeoutTimer);
      this.pendingTransactions.delete(response.transactionId);

      if (response.isException) {
        const desc = getModbusExceptionDescription(
          response.exceptionCode || ModbusExceptionCode.SLAVE_DEVICE_FAILURE
        );
        pending.reject(
          new Error(`Modbus Exception from Unit ${response.unitId}: ${desc}`)
        );
        return;
      }

      pending.resolve(response.data);
    } catch (err: any) {
      console.error("[ModbusClientSession] Error processing frame:", err);
    }
  }

  /**
   * Sends a request frame and awaits response matching transaction ID.
   */
  private async executeRequest(
    frame: Uint8Array,
    transactionId: number,
    unitId: number,
    expectedFunctionCode: number
  ): Promise<Uint8Array> {
    if (this.transport.state !== "CONNECTED") {
      throw new Error(
        `Cannot send Modbus request: Transport is ${this.transport.state}`
      );
    }

    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTransactions.has(transactionId)) {
          this.pendingTransactions.delete(transactionId);
          reject(
            new Error(
              `Modbus transaction ${transactionId} timed out after ${this.options.timeoutMs}ms (Unit ${unitId}, FC 0x${expectedFunctionCode.toString(16)})`
            )
          );
        }
      }, this.options.timeoutMs);

      this.pendingTransactions.set(transactionId, {
        transactionId,
        unitId,
        expectedFunctionCode,
        resolve,
        reject,
        timeoutTimer: timer,
      });

      this.transport.send(frame).catch((err) => {
        clearTimeout(timer);
        this.pendingTransactions.delete(transactionId);
        reject(err);
      });
    });
  }

  // ==========================================
  // HIGH-LEVEL INDUSTRIAL COMMANDS
  // ==========================================

  public async readHoldingRegisters(
    unitId: number,
    startAddress: number,
    quantity: number
  ): Promise<number[]> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeReadHoldingRegisters(
      txId,
      unitId,
      startAddress,
      quantity
    );
    const data = await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.READ_HOLDING_REGISTERS
    );
    return ModbusBinaryCodec.parseRegistersFromResponse(data);
  }

  public async readInputRegisters(
    unitId: number,
    startAddress: number,
    quantity: number
  ): Promise<number[]> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeReadInputRegisters(
      txId,
      unitId,
      startAddress,
      quantity
    );
    const data = await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.READ_INPUT_REGISTERS
    );
    return ModbusBinaryCodec.parseRegistersFromResponse(data);
  }

  public async readCoils(
    unitId: number,
    startAddress: number,
    quantity: number
  ): Promise<boolean[]> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeReadCoils(
      txId,
      unitId,
      startAddress,
      quantity
    );
    const data = await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.READ_COILS
    );
    return ModbusBinaryCodec.parseBitsFromResponse(data, quantity);
  }

  public async readDiscreteInputs(
    unitId: number,
    startAddress: number,
    quantity: number
  ): Promise<boolean[]> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeReadDiscreteInputs(
      txId,
      unitId,
      startAddress,
      quantity
    );
    const data = await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.READ_DISCRETE_INPUTS
    );
    return ModbusBinaryCodec.parseBitsFromResponse(data, quantity);
  }

  public async writeSingleRegister(
    unitId: number,
    address: number,
    value: number
  ): Promise<void> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeWriteSingleRegister(
      txId,
      unitId,
      address,
      value
    );
    await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.WRITE_SINGLE_REGISTER
    );
  }

  public async writeSingleCoil(
    unitId: number,
    address: number,
    state: boolean
  ): Promise<void> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeWriteSingleCoil(
      txId,
      unitId,
      address,
      state
    );
    await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.WRITE_SINGLE_COIL
    );
  }

  public async writeMultipleRegisters(
    unitId: number,
    startAddress: number,
    registers: number[]
  ): Promise<void> {
    const txId = this.getNextTransactionId();
    const frame = ModbusBinaryCodec.encodeWriteMultipleRegisters(
      txId,
      unitId,
      startAddress,
      registers
    );
    await this.executeRequest(
      frame,
      txId,
      unitId,
      ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS
    );
  }
}
