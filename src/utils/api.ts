import express, { Request, Response, Application } from 'express';
import { Server } from 'http';
import { config } from '../config';
import logger from './logger';
import { MQTTBroker } from '../mqtt/broker';
import { MeshtasticAdapter } from '../meshtastic';
import { ReticulumAdapter } from '../reticulum';
import { MessageRouter } from '../router';

export class APIServer {
  private app: Application;
  private server?: Server;
  private mqttBroker: MQTTBroker;
  private meshtasticAdapter: MeshtasticAdapter;
  private reticulumAdapter: ReticulumAdapter;
  private messageRouter: MessageRouter;
  private startTime: number;

  constructor(
    mqttBroker: MQTTBroker,
    meshtasticAdapter: MeshtasticAdapter,
    reticulumAdapter: ReticulumAdapter,
    messageRouter: MessageRouter
  ) {
    this.app = express();
    this.mqttBroker = mqttBroker;
    this.meshtasticAdapter = meshtasticAdapter;
    this.reticulumAdapter = reticulumAdapter;
    this.messageRouter = messageRouter;
    this.startTime = Date.now();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      const health = {
        status: 'ok',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString(),
        services: {
          mqtt: {
            status: 'running',
            clients: this.mqttBroker.getClientCount(),
          },
          meshtastic: {
            status: this.meshtasticAdapter.getConnectionStatus() ? 'connected' : 'disconnected',
          },
          reticulum: {
            status: this.reticulumAdapter.getStatus() ? 'running' : 'stopped',
          },
        },
      };

      res.json(health);
    });

    // System status
    this.app.get('/api/status', (req: Request, res: Response) => {
      const status = {
        server: {
          name: 'IceNet MQTT Server',
          version: '1.0.0',
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
          nodeVersion: process.version,
        },
        mqtt: {
          running: true,
          clients: this.mqttBroker.getClientCount(),
          port: config.mqtt.port,
          wsPort: config.mqtt.wsPort,
        },
        meshtastic: {
          enabled: config.meshtastic.enabled,
          connected: this.meshtasticAdapter.getConnectionStatus(),
          serialPort: config.meshtastic.serialPort,
        },
        reticulum: {
          enabled: config.reticulum.enabled,
          running: this.reticulumAdapter.getStatus(),
        },
        router: this.messageRouter.getStats(),
      };

      res.json(status);
    });

    // MQTT clients
    this.app.get('/api/clients', (req: Request, res: Response) => {
      const clients = this.mqttBroker.getClients().map((client) => ({
        id: client.id,
        connected: client.connected,
      }));

      res.json({ clients, count: clients.length });
    });

    // Publish message to MQTT
    this.app.post('/api/publish', (req: Request, res: Response) => {
      const { topic, message, qos, retain } = req.body;

      if (!topic || !message) {
        return res.status(400).json({ error: 'Topic and message are required' });
      }

      try {
        this.mqttBroker.publish(topic, message, { qos: qos || 0, retain: retain || false });
        res.json({ success: true, topic, message });
      } catch (error: any) {
        logger.error(`Failed to publish via API: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Configuration info
    this.app.get('/api/config', (req: Request, res: Response) => {
      const safeConfig = {
        mqtt: {
          host: config.mqtt.host,
          port: config.mqtt.port,
          wsPort: config.mqtt.wsPort,
          maxConnections: config.mqtt.maxConnections,
        },
        meshtastic: {
          enabled: config.meshtastic.enabled,
          topicPrefix: config.meshtastic.topicPrefix,
        },
        reticulum: {
          enabled: config.reticulum.enabled,
          topicPrefix: config.reticulum.topicPrefix,
        },
      };

      res.json(safeConfig);
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      logger.error(`API error: ${err.message}`);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  public async start(): Promise<void> {
    if (!config.http.enabled) {
      logger.info('HTTP API disabled');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(config.http.port, () => {
        logger.info(`HTTP API server listening on port ${config.http.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          logger.info('HTTP API server stopped');
          resolve();
        });
      });
    }
  }
}
