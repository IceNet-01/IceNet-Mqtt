import dotenv from 'dotenv';
import { ServerConfig } from '../types';

dotenv.config();

export function loadConfig(): ServerConfig {
  return {
    mqtt: {
      host: process.env.MQTT_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '1883', 10),
      wsPort: parseInt(process.env.WS_PORT || '8883', 10),
      maxConnections: parseInt(process.env.MQTT_MAX_CONNECTIONS || '1000', 10),
      keepalive: parseInt(process.env.MQTT_KEEPALIVE || '60', 10),
    },
    http: {
      port: parseInt(process.env.HTTP_PORT || '8080', 10),
      enabled: true,
    },
    auth: {
      enabled: process.env.ENABLE_AUTH === 'true',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
    },
    meshtastic: {
      enabled: process.env.MESHTASTIC_ENABLED === 'true',
      serialPort: process.env.MESHTASTIC_SERIAL_PORT,
      baudRate: parseInt(process.env.MESHTASTIC_BAUD_RATE || '115200', 10),
      topicPrefix: process.env.MESHTASTIC_TOPIC_PREFIX || 'meshtastic',
    },
    reticulum: {
      enabled: process.env.RETICULUM_ENABLED === 'true',
      configPath: process.env.RETICULUM_CONFIG_PATH,
      topicPrefix: process.env.RETICULUM_TOPIC_PREFIX || 'reticulum',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE,
    },
    persistence: {
      enabled: process.env.ENABLE_PERSISTENCE === 'true',
      path: process.env.PERSISTENCE_PATH || './mqtt-data',
    },
    tls: {
      enabled: process.env.ENABLE_TLS === 'true',
      certPath: process.env.TLS_CERT_PATH,
      keyPath: process.env.TLS_KEY_PATH,
      caPath: process.env.TLS_CA_PATH,
    },
  };
}

export const config = loadConfig();
