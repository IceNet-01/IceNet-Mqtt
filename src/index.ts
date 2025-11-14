import { MQTTBroker } from './mqtt/broker';
import { MeshtasticAdapter } from './meshtastic';
import { ReticulumAdapter } from './reticulum';
import { MessageRouter } from './router';
import { APIServer } from './utils/api';
import logger from './utils/logger';
import { config } from './config';

class IceNetMQTTServer {
  private mqttBroker: MQTTBroker;
  private meshtasticAdapter: MeshtasticAdapter;
  private reticulumAdapter: ReticulumAdapter;
  private messageRouter: MessageRouter;
  private apiServer: APIServer;
  private isShuttingDown: boolean = false;

  constructor() {
    // Initialize components
    this.mqttBroker = new MQTTBroker();
    this.meshtasticAdapter = new MeshtasticAdapter();
    this.reticulumAdapter = new ReticulumAdapter();
    this.messageRouter = new MessageRouter(
      this.mqttBroker,
      this.meshtasticAdapter,
      this.reticulumAdapter
    );
    this.apiServer = new APIServer(
      this.mqttBroker,
      this.meshtasticAdapter,
      this.reticulumAdapter,
      this.messageRouter
    );

    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`, error);
      this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`Unhandled rejection at ${promise}: ${reason}`);
    });
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting IceNet MQTT Server...');
      logger.info(`Node version: ${process.version}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

      // Start MQTT broker
      await this.mqttBroker.start();

      // Start Meshtastic adapter if enabled
      if (config.meshtastic.enabled) {
        try {
          await this.meshtasticAdapter.connect();
        } catch (error) {
          logger.warn('Meshtastic adapter failed to start, continuing without it');
        }
      }

      // Start Reticulum adapter if enabled
      if (config.reticulum.enabled) {
        try {
          await this.reticulumAdapter.start();
        } catch (error) {
          logger.warn('Reticulum adapter failed to start, continuing without it');
        }
      }

      // Start HTTP API server
      await this.apiServer.start();

      logger.info('='.repeat(60));
      logger.info('IceNet MQTT Server started successfully!');
      logger.info('='.repeat(60));
      logger.info(`MQTT TCP: ${config.mqtt.host}:${config.mqtt.port}`);
      logger.info(`MQTT WebSocket: ${config.mqtt.host}:${config.mqtt.wsPort}`);
      logger.info(`HTTP API: http://${config.mqtt.host}:${config.http.port}`);
      logger.info(`Meshtastic: ${config.meshtastic.enabled ? 'Enabled' : 'Disabled'}`);
      logger.info(`Reticulum: ${config.reticulum.enabled ? 'Enabled' : 'Disabled'}`);
      logger.info('='.repeat(60));
    } catch (error) {
      logger.error(`Failed to start server: ${error}`);
      throw error;
    }
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      // Stop API server
      await this.apiServer.stop();

      // Stop adapters
      await this.meshtasticAdapter.disconnect();
      await this.reticulumAdapter.stop();

      // Stop MQTT broker last
      await this.mqttBroker.stop();

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  }
}

// Start the server
const server = new IceNetMQTTServer();
server.start().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
