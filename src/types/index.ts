export interface ServerConfig {
  mqtt: {
    host: string;
    port: number;
    wsPort: number;
    maxConnections: number;
    keepalive: number;
  };
  http: {
    port: number;
    enabled: boolean;
  };
  auth: {
    enabled: boolean;
    username?: string;
    password?: string;
  };
  meshtastic: {
    enabled: boolean;
    serialPort?: string;
    baudRate: number;
    topicPrefix: string;
  };
  reticulum: {
    enabled: boolean;
    configPath?: string;
    topicPrefix: string;
  };
  logging: {
    level: string;
    file?: string;
  };
  persistence: {
    enabled: boolean;
    path: string;
  };
  tls: {
    enabled: boolean;
    certPath?: string;
    keyPath?: string;
    caPath?: string;
  };
}

export interface MeshtasticMessage {
  from: number;
  to: number;
  id: number;
  channel: number;
  payload: Buffer;
  rxTime: number;
  rxSnr?: number;
  rxRssi?: number;
  hopLimit?: number;
}

export interface ReticulumPacket {
  destination: string;
  source: string;
  data: Buffer;
  timestamp: number;
  hops?: number;
}

export interface MQTTMessage {
  topic: string;
  payload: Buffer | string;
  qos: 0 | 1 | 2;
  retain: boolean;
}

export interface ClientInfo {
  id: string;
  connected: boolean;
  connectedAt?: Date;
  lastActivity?: Date;
  protocol: 'mqtt' | 'meshtastic' | 'reticulum';
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}
