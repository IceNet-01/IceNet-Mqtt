import express, { Request, Response, Application } from 'express';
import { Server } from 'http';
import { config } from '../config';
import logger from './logger';
import { MQTTBroker } from '../mqtt/broker';
import { MeshtasticAdapter } from '../meshtastic';
import { ReticulumAdapter } from '../reticulum';
import { MessageRouter } from '../router';
import path from 'path';
import fs from 'fs';

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

    // Serve static files from public directory
    const publicPath = path.join(__dirname, '../../public');
    this.app.use(express.static(publicPath));

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

    // Save settings
    this.app.post('/api/settings', (req: Request, res: Response) => {
      try {
        const settings = req.body;
        const envPath = path.join(process.cwd(), '.env');

        // Build .env content
        let envContent = '# IceNet MQTT Server Configuration\n';
        envContent += `# Updated on ${new Date().toISOString()}\n\n`;

        envContent += '# Server Configuration\n';
        envContent += `NODE_ENV=${process.env.NODE_ENV || 'production'}\n`;
        envContent += `PORT=${settings.mqtt.port}\n`;
        envContent += `WS_PORT=${settings.mqtt.wsPort}\n`;
        envContent += `HTTP_PORT=${config.http.port}\n`;
        envContent += `MQTT_HOST=${config.mqtt.host}\n\n`;

        envContent += '# MQTT Configuration\n';
        envContent += `MQTT_MAX_CONNECTIONS=${settings.mqtt.maxConnections}\n`;
        envContent += `MQTT_KEEPALIVE=${config.mqtt.keepalive}\n\n`;

        envContent += '# Authentication\n';
        envContent += `ENABLE_AUTH=${settings.auth.enabled}\n`;
        if (settings.auth.username) {
          envContent += `MQTT_USERNAME=${settings.auth.username}\n`;
        }
        if (settings.auth.password) {
          envContent += `MQTT_PASSWORD=${settings.auth.password}\n`;
        }
        envContent += '\n';

        envContent += '# Meshtastic Configuration\n';
        envContent += `MESHTASTIC_ENABLED=${settings.meshtastic.enabled}\n`;
        envContent += `MESHTASTIC_SERIAL_PORT=${settings.meshtastic.serialPort}\n`;
        envContent += `MESHTASTIC_BAUD_RATE=${settings.meshtastic.baudRate}\n`;
        envContent += `MESHTASTIC_TOPIC_PREFIX=${config.meshtastic.topicPrefix}\n\n`;

        envContent += '# Reticulum Configuration\n';
        envContent += `RETICULUM_ENABLED=${settings.reticulum.enabled}\n`;
        envContent += `RETICULUM_CONFIG_PATH=${config.reticulum.configPath || './config/reticulum.conf'}\n`;
        envContent += `RETICULUM_TOPIC_PREFIX=${config.reticulum.topicPrefix}\n\n`;

        envContent += '# Logging\n';
        envContent += `LOG_LEVEL=${settings.logging.level}\n`;
        envContent += `LOG_FILE=${config.logging.file || './logs/icenet-mqtt.log'}\n\n`;

        envContent += '# Persistence\n';
        envContent += `ENABLE_PERSISTENCE=${config.persistence.enabled}\n`;
        envContent += `PERSISTENCE_PATH=${config.persistence.path}\n\n`;

        envContent += '# SSL/TLS (optional)\n';
        envContent += `ENABLE_TLS=${config.tls.enabled}\n`;

        // Write to .env file
        fs.writeFileSync(envPath, envContent, 'utf8');

        logger.info('Settings saved successfully');
        res.json({ success: true, message: 'Settings saved. Restart required.' });
      } catch (error: any) {
        logger.error(`Failed to save settings: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Export configuration
    this.app.get('/api/config/export', (req: Request, res: Response) => {
      try {
        const envPath = path.join(process.cwd(), '.env');

        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          res.type('text/plain').send(envContent);
        } else {
          // Generate from current config
          let envContent = '# IceNet MQTT Server Configuration\n\n';
          envContent += `PORT=${config.mqtt.port}\n`;
          envContent += `WS_PORT=${config.mqtt.wsPort}\n`;
          envContent += `HTTP_PORT=${config.http.port}\n`;
          envContent += `MESHTASTIC_ENABLED=${config.meshtastic.enabled}\n`;
          envContent += `RETICULUM_ENABLED=${config.reticulum.enabled}\n`;
          res.type('text/plain').send(envContent);
        }
      } catch (error: any) {
        logger.error(`Failed to export config: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // 404 handler - must be after all routes
    this.app.use((req: Request, res: Response) => {
      // Don't return JSON for HTML requests (browser navigation)
      if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
      } else {
        res.status(404).json({ error: 'Not found' });
      }
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
