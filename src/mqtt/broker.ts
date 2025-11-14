import Aedes from 'aedes';
import type { Client, PublishPacket, Subscription, AuthenticateError } from 'aedes';
import { createServer, Server as NetServer } from 'net';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import ws from 'ws';
import { config } from '../config';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

export class MQTTBroker extends EventEmitter {
  private broker: Aedes;
  private tcpServer?: NetServer;
  private wsServer?: HttpServer;
  private clients: Map<string, Client> = new Map();

  constructor() {
    super();
    this.broker = new Aedes({
      id: 'icenet-mqtt-broker',
      heartbeatInterval: config.mqtt.keepalive * 1000,
      connectTimeout: 30000,
    });

    this.setupBrokerEvents();
    this.setupAuthentication();
  }

  private setupBrokerEvents(): void {
    this.broker.on('client', (client: Client) => {
      logger.info(`Client connected: ${client.id}`);
      this.clients.set(client.id, client);
      this.emit('clientConnected', client);
    });

    this.broker.on('clientDisconnect', (client: Client) => {
      logger.info(`Client disconnected: ${client.id}`);
      this.clients.delete(client.id);
      this.emit('clientDisconnected', client);
    });

    this.broker.on('publish', (packet: PublishPacket, client: Client | null) => {
      if (client) {
        logger.debug(`Message published to ${packet.topic} by ${client.id}`);
        this.emit('message', {
          topic: packet.topic,
          payload: packet.payload,
          qos: packet.qos,
          retain: packet.retain,
          clientId: client.id,
        });
      }
    });

    this.broker.on('subscribe', (subscriptions: Subscription[], client: Client) => {
      logger.debug(
        `Client ${client.id} subscribed to: ${subscriptions.map((s: Subscription) => s.topic).join(', ')}`
      );
      this.emit('subscribe', { subscriptions, clientId: client.id });
    });

    this.broker.on('unsubscribe', (subscriptions: string[], client: Client) => {
      logger.debug(`Client ${client.id} unsubscribed from: ${subscriptions.join(', ')}`);
      this.emit('unsubscribe', { subscriptions, clientId: client.id });
    });

    this.broker.on('clientError', (client: Client, err: Error) => {
      logger.error(`Client error for ${client.id}: ${err.message}`);
    });

    this.broker.on('connectionError', (client: Client, err: Error) => {
      logger.error(`Connection error for ${client.id}: ${err.message}`);
    });
  }

  private setupAuthentication(): void {
    if (!config.auth.enabled) {
      logger.info('Authentication disabled');
      return;
    }

    this.broker.authenticate = (client: Client, username: Readonly<string> | undefined, password: Readonly<Buffer> | undefined, callback: (error: AuthenticateError | null, success: boolean | null) => void) => {
      const passwordStr = password?.toString();
      const usernameStr = username?.toString();

      if (
        config.auth.username &&
        config.auth.password &&
        usernameStr === config.auth.username &&
        passwordStr === config.auth.password
      ) {
        logger.info(`Authentication successful for ${client.id}`);
        callback(null, true);
      } else {
        logger.warn(`Authentication failed for ${client.id}`);
        const error = new Error('Authentication failed') as AuthenticateError;
        error.returnCode = 4; // Bad username or password
        callback(error, false);
      }
    };
  }

  public async start(): Promise<void> {
    try {
      // Start TCP server
      this.tcpServer = createServer(this.broker.handle);
      await new Promise<void>((resolve, reject) => {
        this.tcpServer!.listen(config.mqtt.port, config.mqtt.host, () => {
          logger.info(`MQTT TCP server listening on ${config.mqtt.host}:${config.mqtt.port}`);
          resolve();
        });
        this.tcpServer!.on('error', reject);
      });

      // Start WebSocket server
      this.wsServer = createHttpServer();
      const wsInstance = new ws.Server({ server: this.wsServer });
      wsInstance.on('connection', (stream) => {
        this.broker.handle(stream as any);
      });

      await new Promise<void>((resolve, reject) => {
        this.wsServer!.listen(config.mqtt.wsPort, config.mqtt.host, () => {
          logger.info(
            `MQTT WebSocket server listening on ${config.mqtt.host}:${config.mqtt.wsPort}`
          );
          resolve();
        });
        this.wsServer!.on('error', reject);
      });

      logger.info('MQTT Broker started successfully');
    } catch (error) {
      logger.error(`Failed to start MQTT broker: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping MQTT broker...');

    if (this.tcpServer) {
      await new Promise<void>((resolve) => {
        this.tcpServer!.close(() => resolve());
      });
    }

    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer!.close(() => resolve());
      });
    }

    await new Promise<void>((resolve) => {
      this.broker.close(() => resolve());
    });

    logger.info('MQTT broker stopped');
  }

  public publish(topic: string, payload: Buffer | string, options?: any): void {
    this.broker.publish(
      {
        cmd: 'publish',
        topic,
        payload: Buffer.isBuffer(payload) ? payload : Buffer.from(payload),
        qos: options?.qos || 0,
        retain: options?.retain || false,
        dup: false,
      },
      (error: Error | undefined) => {
        if (error) {
          logger.error(`Failed to publish to ${topic}: ${error.message}`);
        }
      }
    );
  }

  public getClients(): Client[] {
    return Array.from(this.clients.values());
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getBroker(): Aedes {
    return this.broker;
  }
}
