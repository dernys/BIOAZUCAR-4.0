/**
 * BioAzúcar 4.0 — MQTT Client Session & Protocol State Machine
 * 
 * Manages MQTT 3.1.1 / 5.0 client connection lifecycle over decoupled ITransportLayer:
 * - Handshake with CONNECT / CONNACK
 * - Monotonic packetId sequence tracking for QoS 1 transactions
 * - Topic filter matching with MQTT wildcards (+ and #)
 * - KeepAlive heartbeat monitoring with PINGREQ / PINGRESP
 * - Reconnection and transport fault detection
 */

import { ITransportLayer } from "../transport/ITransportLayer";
import {
  MqttPacketType,
  MqttConnectReturnCode,
  MqttQoS,
  MqttConnectOptions,
  MqttPublishOptions,
  MqttSubscription,
  MqttPacket,
  getMqttConnectReturnCodeDescription,
} from "./MqttTypes";
import { MqttBinaryCodec } from "./MqttBinaryCodec";

export type MqttSessionStatus =
  | "DISCONNECTED"
  | "CONNECTING_TRANSPORT"
  | "CONNECT_HANDSHAKE"
  | "READY"
  | "FAULTED";

export type MqttMessageCallback = (topic: string, payload: Uint8Array, packet: MqttPacket) => void;

interface PendingAck {
  resolve: (val?: any) => void;
  reject: (err: Error) => void;
  timer: any;
  type: MqttPacketType;
}

export class MqttClientSession {
  private transport: ITransportLayer;
  private options: MqttConnectOptions;
  private _status: MqttSessionStatus = "DISCONNECTED";

  private rxStreamBuffer: Uint8Array = new Uint8Array(0);
  private nextPacketId: number = 1;

  private pendingAcks = new Map<number, PendingAck>();
  private subscriptions = new Map<string, { qos: MqttQoS; callback: MqttMessageCallback }>();

  private keepAliveTimer?: any;
  private pingTimeoutTimer?: any;
  private isAwaitingPingResp = false;

  private onStatusChangeCallbacks: Array<(status: MqttSessionStatus) => void> = [];

  constructor(transport: ITransportLayer, options: MqttConnectOptions) {
    this.transport = transport;
    this.options = options;

    this.transport.onData((data) => this.handleIncomingData(data));
    this.transport.onError((err) => this.handleTransportError(err));
    this.transport.onStateChange((_oldState, newState) => {
      if (newState === "FAULTED") {
        this.handleTransportError(new Error("Transport transitioned to FAULTED"));
      } else if (newState === "DISCONNECTED") {
        this.handleTransportClose();
      }
    });
  }

  public get status(): MqttSessionStatus {
    return this._status;
  }

  public onStatusChange(cb: (status: MqttSessionStatus) => void): void {
    this.onStatusChangeCallbacks.push(cb);
  }

  private setStatus(status: MqttSessionStatus): void {
    if (this._status !== status) {
      this._status = status;
      for (const cb of this.onStatusChangeCallbacks) {
        cb(status);
      }
    }
  }

  private getNextPacketId(): number {
    const id = this.nextPacketId++;
    if (this.nextPacketId > 65535) {
      this.nextPacketId = 1;
    }
    return id;
  }

  /**
   * Initiates connection to MQTT broker over transport layer.
   */
  public async connect(timeoutMs: number = 5000): Promise<boolean> {
    if (this._status === "READY") return true;

    this.setStatus("CONNECTING_TRANSPORT");
    const transportConnected = await this.transport.connect();
    if (!transportConnected) {
      this.setStatus("FAULTED");
      throw new Error(`Failed to establish transport connection for MQTT client '${this.options.clientId}'`);
    }

    this.setStatus("CONNECT_HANDSHAKE");

    return new Promise<boolean>((resolve, reject) => {
      const handshakeTimer = setTimeout(() => {
        this.setStatus("FAULTED");
        reject(new Error(`MQTT CONNECT handshake timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Register temporary ACK listener for CONNACK
      const tempAckId = -1;
      this.pendingAcks.set(tempAckId, {
        resolve: () => {
          clearTimeout(handshakeTimer);
          this.setStatus("READY");
          this.startKeepAlive();
          resolve(true);
        },
        reject: (err) => {
          clearTimeout(handshakeTimer);
          this.setStatus("FAULTED");
          reject(err);
        },
        timer: handshakeTimer,
        type: MqttPacketType.CONNACK,
      });

      try {
        const connectPacket = MqttBinaryCodec.buildConnectPacket(this.options);
        this.transport.send(connectPacket);
      } catch (err: any) {
        clearTimeout(handshakeTimer);
        this.pendingAcks.delete(tempAckId);
        this.setStatus("FAULTED");
        reject(err);
      }
    });
  }

  /**
   * Publishes an MQTT message with optional QoS 1 delivery confirmation.
   */
  public async publish(
    topic: string,
    payload: Uint8Array | string,
    qos: MqttQoS = 0,
    retain: boolean = false,
    timeoutMs: number = 5000
  ): Promise<void> {
    if (this._status !== "READY") {
      throw new Error(`Cannot publish: MQTT session is ${this._status}`);
    }

    if (qos === 0) {
      const packet = MqttBinaryCodec.buildPublishPacket({
        topic,
        payload,
        qos: 0,
        retain,
      });
      await this.transport.send(packet);
      return;
    }

    // QoS 1
    const packetId = this.getNextPacketId();
    const packet = MqttBinaryCodec.buildPublishPacket({
      topic,
      payload,
      qos: 1,
      retain,
      packetId,
    });

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(packetId);
        reject(new Error(`MQTT PUBACK timed out for packetId ${packetId} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingAcks.set(packetId, {
        resolve: () => resolve(),
        reject,
        timer,
        type: MqttPacketType.PUBACK,
      });

      this.transport.send(packet).catch((err) => {
        clearTimeout(timer);
        this.pendingAcks.delete(packetId);
        reject(err);
      });
    });
  }

  /**
   * Subscribes to an MQTT topic with a message handler.
   */
  public async subscribe(
    topic: string,
    qos: MqttQoS = 0,
    callback: MqttMessageCallback,
    timeoutMs: number = 5000
  ): Promise<void> {
    if (this._status !== "READY") {
      throw new Error(`Cannot subscribe: MQTT session is ${this._status}`);
    }

    this.subscriptions.set(topic, { qos, callback });

    const packetId = this.getNextPacketId();
    const subPacket = MqttBinaryCodec.buildSubscribePacket(packetId, [{ topic, qos }]);

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(packetId);
        reject(new Error(`MQTT SUBACK timed out for packetId ${packetId} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingAcks.set(packetId, {
        resolve: () => resolve(),
        reject,
        timer,
        type: MqttPacketType.SUBACK,
      });

      this.transport.send(subPacket).catch((err) => {
        clearTimeout(timer);
        this.pendingAcks.delete(packetId);
        reject(err);
      });
    });
  }

  /**
   * Sends an explicit PINGREQ heartbeat.
   */
  public async ping(timeoutMs: number = 3000): Promise<void> {
    if (this._status !== "READY") {
      throw new Error(`Cannot ping: MQTT session is ${this._status}`);
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(0);
        this.setStatus("FAULTED");
        reject(new Error(`MQTT PINGRESP timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingAcks.set(0, {
        resolve: () => resolve(),
        reject,
        timer,
        type: MqttPacketType.PINGRESP,
      });

      const pingPacket = MqttBinaryCodec.buildPingreqPacket();
      this.transport.send(pingPacket).catch((err) => {
        clearTimeout(timer);
        this.pendingAcks.delete(0);
        reject(err);
      });
    });
  }

  /**
   * Gracefully disconnects session.
   */
  public async disconnect(): Promise<void> {
    this.stopKeepAlive();

    if (this._status === "READY") {
      try {
        const disconnectPacket = MqttBinaryCodec.buildDisconnectPacket();
        await this.transport.send(disconnectPacket);
      } catch {
        // Ignore disconnect send errors during shutdown
      }
    }

    await this.transport.disconnect();
    this.setStatus("DISCONNECTED");
    this.clearPendingAcks("MQTT session disconnected");
  }

  private handleIncomingData(data: Uint8Array): void {
    const combined = new Uint8Array(this.rxStreamBuffer.length + data.length);
    combined.set(this.rxStreamBuffer, 0);
    combined.set(data, this.rxStreamBuffer.length);
    this.rxStreamBuffer = combined;

    while (this.rxStreamBuffer.length > 0) {
      const decoded = MqttBinaryCodec.decodePacket(this.rxStreamBuffer);
      if (!decoded.valid) {
        // Wait for more bytes
        break;
      }

      this.rxStreamBuffer = decoded.remaining || new Uint8Array(0);
      if (decoded.packet) {
        this.processPacket(decoded.packet);
      }
    }
  }

  private processPacket(packet: MqttPacket): void {
    switch (packet.type) {
      case MqttPacketType.CONNACK: {
        const pending = this.pendingAcks.get(-1);
        if (pending && pending.type === MqttPacketType.CONNACK) {
          clearTimeout(pending.timer);
          this.pendingAcks.delete(-1);
          if (packet.returnCode === MqttConnectReturnCode.ACCEPTED) {
            pending.resolve();
          } else {
            pending.reject(
              new Error(
                `MQTT Connection rejected by broker: ${getMqttConnectReturnCodeDescription(
                  packet.returnCode ?? MqttConnectReturnCode.UNACCEPTABLE_PROTOCOL_VERSION
                )}`
              )
            );
          }
        }
        break;
      }

      case MqttPacketType.PUBLISH: {
        if (packet.topic && packet.payload) {
          this.routeMessage(packet.topic, packet.payload, packet);
        }

        // If QoS 1, send PUBACK
        const qos = ((packet.flags >> 1) & 0x03) as MqttQoS;
        if (qos === 1 && packet.packetId !== undefined) {
          const puback = MqttBinaryCodec.buildPubackPacket(packet.packetId);
          this.transport.send(puback).catch(() => {});
        }
        break;
      }

      case MqttPacketType.PUBACK: {
        if (packet.packetId !== undefined) {
          const pending = this.pendingAcks.get(packet.packetId);
          if (pending && pending.type === MqttPacketType.PUBACK) {
            clearTimeout(pending.timer);
            this.pendingAcks.delete(packet.packetId);
            pending.resolve();
          }
        }
        break;
      }

      case MqttPacketType.SUBACK: {
        if (packet.packetId !== undefined) {
          const pending = this.pendingAcks.get(packet.packetId);
          if (pending && pending.type === MqttPacketType.SUBACK) {
            clearTimeout(pending.timer);
            this.pendingAcks.delete(packet.packetId);
            pending.resolve();
          }
        }
        break;
      }

      case MqttPacketType.PINGREQ: {
        const pingresp = MqttBinaryCodec.buildPingrespPacket();
        this.transport.send(pingresp).catch(() => {});
        break;
      }

      case MqttPacketType.PINGRESP: {
        this.isAwaitingPingResp = false;
        if (this.pingTimeoutTimer) {
          clearTimeout(this.pingTimeoutTimer);
          this.pingTimeoutTimer = undefined;
        }
        const pending = this.pendingAcks.get(0);
        if (pending && pending.type === MqttPacketType.PINGRESP) {
          clearTimeout(pending.timer);
          this.pendingAcks.delete(0);
          pending.resolve();
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Matches topic against subscriptions using MQTT wildcards (+ and #).
   */
  private routeMessage(topic: string, payload: Uint8Array, packet: MqttPacket): void {
    for (const [filter, sub] of this.subscriptions.entries()) {
      if (this.matchesTopicFilter(topic, filter)) {
        try {
          sub.callback(topic, payload, packet);
        } catch (err) {
          console.error(`Error in MQTT subscription handler for '${topic}':`, err);
        }
      }
    }
  }

  public matchesTopicFilter(topic: string, filter: string): boolean {
    if (topic === filter) return true;
    if (filter === "#") return true;

    const topicParts = topic.split("/");
    const filterParts = filter.split("/");

    for (let i = 0; i < filterParts.length; i++) {
      const f = filterParts[i];
      if (f === "#") {
        return true;
      }
      if (f === "+") {
        if (i >= topicParts.length) return false;
        continue;
      }
      if (f !== topicParts[i]) {
        return false;
      }
    }

    return filterParts.length === topicParts.length;
  }

  private startKeepAlive(): void {
    const keepAliveSec = this.options.keepAliveSeconds ?? 60;
    if (keepAliveSec <= 0) return;

    const intervalMs = Math.max(1000, Math.floor((keepAliveSec * 1000) / 2));
    this.keepAliveTimer = setInterval(async () => {
      if (this._status !== "READY") return;

      try {
        await this.ping(3000);
      } catch {
        this.handleTransportError(new Error("KeepAlive PINGREQ heartbeat failed"));
      }
    }, intervalMs);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }
  }

  private handleTransportError(err: Error): void {
    this.setStatus("FAULTED");
    this.stopKeepAlive();
    this.clearPendingAcks(`Transport error: ${err.message}`);
  }

  private handleTransportClose(): void {
    if (this._status !== "DISCONNECTED") {
      this.setStatus("FAULTED");
      this.stopKeepAlive();
      this.clearPendingAcks("Transport connection closed unexpectedly");
    }
  }

  private clearPendingAcks(reason: string): void {
    for (const [id, ack] of this.pendingAcks.entries()) {
      clearTimeout(ack.timer);
      ack.reject(new Error(`Operation aborted: ${reason}`));
      this.pendingAcks.delete(id);
    }
  }
}
