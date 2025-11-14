import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { config } from '../config';
import logger from '../utils/logger';
import { ReticulumPacket } from '../types';

/**
 * Reticulum Network Adapter
 * Bridges MQTT messages with the Reticulum network stack
 *
 * Note: This implementation assumes Reticulum is installed on the system
 * Install with: pip install rns
 */
export class ReticulumAdapter extends EventEmitter {
  private process?: ChildProcess;
  private isRunning: boolean = false;
  private messageQueue: ReticulumPacket[] = [];
  private buffer: string = '';

  constructor() {
    super();
  }

  public async start(): Promise<void> {
    if (!config.reticulum.enabled) {
      logger.info('Reticulum adapter disabled');
      return;
    }

    try {
      logger.info('Starting Reticulum adapter...');

      // Start Reticulum interface process
      // This spawns a Python script that handles Reticulum communication
      this.process = spawn('python3', ['-u', this.getReticulumScriptPath()], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.setupProcessHandlers();
      this.isRunning = true;

      logger.info('Reticulum adapter started successfully');
      this.emit('started');
    } catch (error) {
      logger.error(`Failed to start Reticulum adapter: ${error}`);
      throw error;
    }
  }

  private getReticulumScriptPath(): string {
    // Path to the Python script that interfaces with Reticulum
    return `${__dirname}/../../scripts/reticulum_bridge.py`;
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      logger.error(`Reticulum stderr: ${data.toString()}`);
    });

    this.process.on('exit', (code) => {
      logger.warn(`Reticulum process exited with code ${code}`);
      this.isRunning = false;
      this.emit('stopped');
      this.scheduleRestart();
    });

    this.process.on('error', (error) => {
      logger.error(`Reticulum process error: ${error.message}`);
      this.emit('error', error);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);
        this.handleReticulumMessage(data);
      } catch (error) {
        logger.debug(`Reticulum output: ${line}`);
      }
    }
  }

  private handleReticulumMessage(data: any): void {
    if (data.type === 'packet') {
      const packet: ReticulumPacket = {
        destination: data.destination,
        source: data.source,
        data: Buffer.from(data.data, 'base64'),
        timestamp: data.timestamp || Date.now(),
        hops: data.hops,
      };

      logger.debug(`Received Reticulum packet from ${packet.source}`);
      this.emit('packet', packet);
    } else if (data.type === 'status') {
      logger.info(`Reticulum status: ${data.message}`);
      this.emit('status', data);
    } else if (data.type === 'error') {
      logger.error(`Reticulum error: ${data.message}`);
      this.emit('error', new Error(data.message));
    }
  }

  private scheduleRestart(): void {
    logger.info('Scheduling Reticulum restart in 10 seconds...');
    setTimeout(() => {
      this.start().catch((err) => {
        logger.error(`Reticulum restart failed: ${err.message}`);
      });
    }, 10000);
  }

  public async send(packet: ReticulumPacket): Promise<void> {
    if (!this.isRunning || !this.process?.stdin) {
      throw new Error('Reticulum adapter not running');
    }

    try {
      const message = {
        type: 'send',
        destination: packet.destination,
        data: packet.data.toString('base64'),
        timestamp: packet.timestamp,
      };

      const line = JSON.stringify(message) + '\n';
      this.process.stdin.write(line);

      logger.debug(`Sent Reticulum packet to ${packet.destination}`);
    } catch (error) {
      logger.error(`Failed to send Reticulum packet: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping Reticulum adapter...');

    if (this.process) {
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    }

    this.isRunning = false;
    logger.info('Reticulum adapter stopped');
  }

  public getStatus(): boolean {
    return this.isRunning;
  }
}
