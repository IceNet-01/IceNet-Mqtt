import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import { config } from '../config';
import logger from '../utils/logger';
import { MeshtasticMessage } from '../types';

export class MeshtasticAdapter extends EventEmitter {
  private serialPort?: SerialPort;
  private isConnected: boolean = false;
  private reconnectInterval?: NodeJS.Timeout;
  private buffer: Buffer = Buffer.alloc(0);

  constructor() {
    super();
  }

  public async connect(): Promise<void> {
    if (!config.meshtastic.enabled) {
      logger.info('Meshtastic adapter disabled');
      return;
    }

    if (!config.meshtastic.serialPort) {
      logger.warn('Meshtastic serial port not configured');
      return;
    }

    try {
      logger.info(
        `Connecting to Meshtastic device on ${config.meshtastic.serialPort} @ ${config.meshtastic.baudRate}`
      );

      this.serialPort = new SerialPort({
        path: config.meshtastic.serialPort,
        baudRate: config.meshtastic.baudRate,
        autoOpen: false,
      });

      this.serialPort.on('data', (data: Buffer) => this.handleData(data));
      this.serialPort.on('error', (err) => this.handleError(err));
      this.serialPort.on('close', () => this.handleClose());

      await new Promise<void>((resolve, reject) => {
        this.serialPort!.open((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.isConnected = true;
      logger.info('Meshtastic device connected successfully');
      this.emit('connected');
    } catch (error) {
      logger.error(`Failed to connect to Meshtastic device: ${error}`);
      this.scheduleReconnect();
      throw error;
    }
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    // Process complete messages from buffer
    while (this.buffer.length > 0) {
      const message = this.parseMessage();
      if (!message) break;

      logger.debug(`Received Meshtastic message from node ${message.from}`);
      this.emit('message', message);
    }
  }

  private parseMessage(): MeshtasticMessage | null {
    // Simple frame parsing - in production, use proper protobuf parsing
    // This is a placeholder implementation
    if (this.buffer.length < 16) return null;

    try {
      // Basic message structure parsing
      const from = this.buffer.readUInt32LE(0);
      const to = this.buffer.readUInt32LE(4);
      const id = this.buffer.readUInt32LE(8);
      const channel = this.buffer.readUInt8(12);
      const payloadLength = this.buffer.readUInt16LE(13);

      if (this.buffer.length < 16 + payloadLength) return null;

      const payload = this.buffer.slice(16, 16 + payloadLength);
      this.buffer = this.buffer.slice(16 + payloadLength);

      return {
        from,
        to,
        id,
        channel,
        payload,
        rxTime: Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to parse Meshtastic message: ${error}`);
      this.buffer = Buffer.alloc(0);
      return null;
    }
  }

  private handleError(error: Error): void {
    logger.error(`Meshtastic serial port error: ${error.message}`);
    this.emit('error', error);
  }

  private handleClose(): void {
    logger.warn('Meshtastic device connection closed');
    this.isConnected = false;
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;

    logger.info('Scheduling Meshtastic reconnection in 5 seconds...');
    this.reconnectInterval = setTimeout(() => {
      this.reconnectInterval = undefined;
      this.connect().catch((err) => {
        logger.error(`Reconnection failed: ${err.message}`);
      });
    }, 5000);
  }

  public async send(message: MeshtasticMessage): Promise<void> {
    if (!this.isConnected || !this.serialPort) {
      throw new Error('Meshtastic device not connected');
    }

    try {
      // Construct message frame
      const header = Buffer.alloc(16);
      header.writeUInt32LE(message.from, 0);
      header.writeUInt32LE(message.to, 4);
      header.writeUInt32LE(message.id, 8);
      header.writeUInt8(message.channel, 12);
      header.writeUInt16LE(message.payload.length, 13);

      const frame = Buffer.concat([header, message.payload]);

      await new Promise<void>((resolve, reject) => {
        this.serialPort!.write(frame, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.debug(`Sent Meshtastic message to node ${message.to}`);
    } catch (error) {
      logger.error(`Failed to send Meshtastic message: ${error}`);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }

    if (this.serialPort && this.serialPort.isOpen) {
      await new Promise<void>((resolve) => {
        this.serialPort!.close(() => resolve());
      });
    }

    this.isConnected = false;
    logger.info('Meshtastic adapter disconnected');
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
